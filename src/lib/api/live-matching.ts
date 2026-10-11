/**
 * Client for the real goride-trip-matching service's driver matching endpoints
 * (POST /matching/ride-requests, GET /matching/ride-requests/{tripId},
 * GET /matching/offers, GET /matching/offers/active, POST /matching/offers/{tripId}/accept,
 * POST /matching/offers/{tripId}/status).
 *
 * Everything here talks to the live backend directly. Callers decide what to do
 * when it's unreachable (the rider side falls back to the mock matcher).
 */
import type { LatLng } from "@/types";

const TRIP_API_URL = (process.env.NEXT_PUBLIC_TRIP_API_URL ?? "http://localhost:8080").replace(/\/+$/, "");

/** Thrown for non-2xx responses so callers can branch on the status (404/409/…) or `code` (e.g. DRIVER_BUSY). */
export class LiveMatchingError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
  }
}

/** 204 No Content resolves to null. */
async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${TRIP_API_URL}${path}`, {
    ...init,
    cache: "no-store",
    headers: { Accept: "application/json", ...(init?.body ? { "Content-Type": "application/json" } : {}), ...init?.headers },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string; title?: string; code?: string } | null;
    throw new LiveMatchingError(body?.error ?? body?.title ?? `Request failed (${res.status})`, res.status, body?.code);
  }
  if (res.status === 204) return null as T;
  return res.json() as Promise<T>;
}

/* ---- rider side ---- */

export interface RideRequestPayload {
  tripId: string;
  riderId: string;
  pickup: LatLng;
  dropoff: LatLng;
  vehicleTypeCode: string;
  pickupLocation?: string;
  dropoffLocation?: string;
  fare?: number;
}

export interface MatchedDriver {
  driverId: string;
  vehicleTypeCode: string;
  vehicleMake: string;
  vehicleModel: string;
  vehiclePlate: string;
  lat: number;
  lng: number;
  distanceKm: number;
}

export interface RideRequestResult {
  /** False when no available driver of that vehicle type was found within the radius. */
  matched: boolean;
  radiusKm: number;
  drivers: MatchedDriver[];
}

/** Finds nearby available drivers and delivers the ride request to them. */
export function requestRideLive(p: RideRequestPayload): Promise<RideRequestResult> {
  return call("/matching/ride-requests", {
    method: "POST",
    body: JSON.stringify({
      tripId: p.tripId,
      riderId: p.riderId,
      pickupLat: p.pickup.lat,
      pickupLng: p.pickup.lng,
      vehicleTypeCode: p.vehicleTypeCode,
      pickupLocation: p.pickupLocation,
      dropoffLocation: p.dropoffLocation,
      dropoffLat: p.dropoff.lat,
      dropoffLng: p.dropoff.lng,
      fare: p.fare,
    }),
  });
}

export interface RideRequestStatus {
  tripId: string;
  /** "Searching", "NoDriver", or the accepted driver's trip stage. */
  status: "Searching" | "NoDriver" | "Accepted" | "Arrived" | "InProgress" | "Completed";
  /** Present once status is "Accepted" or later. */
  driver?: {
    driverId: string;
    vehicleTypeCode: string;
    vehicleMake: string;
    vehicleModel: string;
    vehiclePlate: string;
  } | null;
  /** Trip details, present once status is "Accepted" or later. */
  pickupLocation?: string | null;
  pickupLat?: number | null;
  pickupLng?: number | null;
  dropoffLocation?: string | null;
  dropoffLat?: number | null;
  dropoffLng?: number | null;
  fare?: number | null;
}

export function getRideRequestStatusLive(tripId: string): Promise<RideRequestStatus> {
  return call(`/matching/ride-requests/${encodeURIComponent(tripId)}`);
}

/* ---- driver side ---- */

export interface LiveDriverOffer {
  tripId: string;
  driverId: string;
  riderId: string;
  /** Pending/Accepted/Declined/Expired, or -- once accepted -- Arrived/InProgress/Completed. */
  status: string;
  distanceKm: number;
  pickupLocation?: string | null;
  pickupLat?: number | null;
  pickupLng?: number | null;
  dropoffLocation?: string | null;
  dropoffLat?: number | null;
  dropoffLng?: number | null;
  fare?: number | null;
  createdAt: string;
  /** When this offer stops being acceptable (ISO, UTC). */
  expiresAt: string;
}

/** An accepted trip's stages while the driver is still driving it (Completed comes after). */
export const ON_TRIP_STATUSES = ["Accepted", "Arrived", "InProgress"];

/** The driver's pending, not-yet-expired ride requests, newest first. */
export function getPendingOffersLive(driverId: string): Promise<LiveDriverOffer[]> {
  return call(`/matching/offers?driverId=${encodeURIComponent(driverId)}`);
}

/**
 * The driver's current trip — Accepted / Arrived / InProgress, or Completed within the last
 * 6 h — in the same shape as the accept response; null (204) when there is none. Lets the
 * driver app pick its trip back up after a reload.
 */
export function getActiveOfferLive(driverId: string): Promise<LiveDriverOffer | null> {
  return call(`/matching/offers/active?driverId=${encodeURIComponent(driverId)}`);
}

/**
 * Accepts a ride request. Rejects with LiveMatchingError: 404 = this driver was never
 * offered the trip, 409 = the offer expired or was already decided, or (code DRIVER_BUSY)
 * the driver already has an active trip.
 */
export function acceptOfferLive(tripId: string, driverId: string): Promise<LiveDriverOffer> {
  return call(`/matching/offers/${encodeURIComponent(tripId)}/accept`, {
    method: "POST",
    body: JSON.stringify({ driverId }),
  });
}

export type TripStatusAction = "Arrived" | "InProgress" | "Completed";

/**
 * The driver advances their accepted trip one stage at a time. Rejects with LiveMatchingError:
 * 404 = this driver has no accepted trip with that id, 409 = not the next valid stage.
 */
export function updateTripStatusLive(tripId: string, driverId: string, action: TripStatusAction): Promise<LiveDriverOffer> {
  return call(`/matching/offers/${encodeURIComponent(tripId)}/status`, {
    method: "POST",
    body: JSON.stringify({ driverId, action }),
  });
}
