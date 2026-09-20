/**
 * Client for the real goride-trip-matching service's driver matching endpoints
 * (POST /matching/ride-requests, GET /matching/ride-requests/{tripId},
 * GET /matching/offers, POST /matching/offers/{tripId}/accept).
 *
 * Everything here talks to the live backend directly. Callers decide what to do
 * when it's unreachable (the rider side falls back to the mock matcher).
 */
import type { LatLng } from "@/types";

const TRIP_API_URL = (process.env.NEXT_PUBLIC_TRIP_API_URL ?? "http://localhost:8080").replace(/\/+$/, "");

/** Thrown for non-2xx responses so callers can branch on the status (404/409/…). */
export class LiveMatchingError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${TRIP_API_URL}${path}`, {
    ...init,
    headers: { Accept: "application/json", ...(init?.body ? { "Content-Type": "application/json" } : {}), ...init?.headers },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new LiveMatchingError(body?.error ?? `Request failed (${res.status})`, res.status);
  }
  return res.json() as Promise<T>;
}

/* ---- rider side ---- */

export interface RideRequestPayload {
  tripId: string;
  riderId: string;
  pickup: LatLng;
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
      fare: p.fare,
    }),
  });
}

export interface RideRequestStatus {
  tripId: string;
  status: "Searching" | "Accepted" | "NoDriver";
  /** Present when status is "Accepted". */
  driver?: {
    driverId: string;
    vehicleTypeCode: string;
    vehicleMake: string;
    vehicleModel: string;
    vehiclePlate: string;
  } | null;
}

export function getRideRequestStatusLive(tripId: string): Promise<RideRequestStatus> {
  return call(`/matching/ride-requests/${encodeURIComponent(tripId)}`);
}

/* ---- driver side ---- */

export interface LiveDriverOffer {
  tripId: string;
  driverId: string;
  riderId: string;
  status: string;
  distanceKm: number;
  pickupLocation?: string | null;
  dropoffLocation?: string | null;
  fare?: number | null;
  createdAt: string;
  /** When this offer stops being acceptable (ISO, UTC). */
  expiresAt: string;
}

/** The driver's pending, not-yet-expired ride requests, newest first. */
export function getPendingOffersLive(driverId: string): Promise<LiveDriverOffer[]> {
  return call(`/matching/offers?driverId=${encodeURIComponent(driverId)}`);
}

/**
 * Accepts a ride request. Rejects with LiveMatchingError: 404 = this driver was never
 * offered the trip, 409 = the offer expired or was already decided.
 */
export function acceptOfferLive(tripId: string, driverId: string): Promise<LiveDriverOffer> {
  return call(`/matching/offers/${encodeURIComponent(tripId)}/accept`, {
    method: "POST",
    body: JSON.stringify({ driverId }),
  });
}
