import type { LatLng } from "@/types";

export interface RouteCoordinate {
  lat: number;
  lng: number;
}

export interface RidePlanResponse {
  distanceKm: number;
  durationMinutes: number;
  coordinates: RouteCoordinate[];
  pickupLabel: string;
  destinationLabel: string;
}

export const LOCATION_API_URL = (
  process.env.NEXT_PUBLIC_LOCATION_API_URL ?? "http://localhost:5000"
).replace(/\/+$/, "");

/**
 * Calls goride-location microservice (POST /rides/plan) to get road-network distance,
 * duration, and geometry coordinates, and to validate that pickup and destination are inside
 * the GoRide serviceable area.
 */
export async function planRide(
  pickup: LatLng,
  destination: LatLng
): Promise<RidePlanResponse> {
  const res = await fetch(`${LOCATION_API_URL}/rides/plan`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      pickupLat: pickup.lat,
      pickupLng: pickup.lng,
      destinationLat: destination.lat,
      destinationLng: destination.lng,
    }),
  });

  if (!res.ok) {
    let errorMessage = "Unable to plan ride.";
    try {
      const errorData = await res.json();
      errorMessage = errorData.detail || errorData.title || errorData.message || errorMessage;
    } catch {
      const text = await res.text().catch(() => "");
      if (text) errorMessage = text;
    }
    throw new Error(errorMessage);
  }

  const data = (await res.json()) as {
    distanceKm: number;
    durationMinutes: number;
    coordinates?: { lat: number; lng: number }[];
    pickupLabel?: string;
    destinationLabel?: string;
  };

  return {
    distanceKm: data.distanceKm,
    durationMinutes: data.durationMinutes,
    coordinates: (data.coordinates ?? []).map((c) => ({ lat: c.lat, lng: c.lng })),
    pickupLabel: data.pickupLabel ?? `${pickup.lat.toFixed(6)}, ${pickup.lng.toFixed(6)}`,
    destinationLabel: data.destinationLabel ?? `${destination.lat.toFixed(6)}, ${destination.lng.toFixed(6)}`,
  };
}
