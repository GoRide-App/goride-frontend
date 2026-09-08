/**
 * Places search — the only piece of this the SCRUM-54 slice actually uses,
 * for picking pickup/destination coordinates without a map: Nominatim
 * (Sri Lanka-bounded) + a local landmark list, so it still works offline.
 *
 * `getRoute` / `isInsideServiceArea` stay here only because
 * lib/mock/world.ts's (currently unreachable) driver-movement simulation
 * still imports them -- not part of the live UI. Reverse geocoding and
 * browser geolocation were removed with the map/live-location UI they
 * existed to support.
 */
import type { LatLng, Place } from "@/types";
import { PLACES } from "@/lib/mock/seed";
import { SERVICE_AREA } from "@/lib/constants";
import { haversineKm, pathLengthKm, syntheticRoute } from "@/lib/utils";
import { estimateDurationMin } from "@/lib/mock/seed";

const NOMINATIM = "https://nominatim.openstreetmap.org";
const OSRM = "https://router.project-osrm.org";
const ONLINE_PROVIDERS = process.env.NEXT_PUBLIC_GEO_PROVIDERS !== "offline";

function localSearch(query: string, limit = 6): Place[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return PLACES.filter((p) => p.name.toLowerCase().includes(q) || p.address.toLowerCase().includes(q)).slice(0, limit);
}

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
  name?: string;
  address?: Record<string, string>;
}

function toPlace(r: NominatimResult): Place {
  const parts = r.display_name.split(",").map((s) => s.trim());
  const name = r.name || parts[0];
  const address = parts.slice(0, 4).join(", ");
  return { name, address, lat: parseFloat(r.lat), lng: parseFloat(r.lon) };
}

let searchAbort: AbortController | null = null;

export async function searchPlaces(query: string): Promise<Place[]> {
  const local = localSearch(query);
  if (!ONLINE_PROVIDERS || query.trim().length < 3) return local;
  try {
    searchAbort?.abort();
    searchAbort = new AbortController();
    const url = `${NOMINATIM}/search?format=jsonv2&limit=6&countrycodes=lk&viewbox=79.75,7.15,80.15,6.70&bounded=0&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, { signal: searchAbort.signal, headers: { Accept: "application/json" } });
    if (!res.ok) return local;
    const data = (await res.json()) as NominatimResult[];
    const remote = data.map(toPlace);
    // de-dupe against local by proximity
    const merged = [...local];
    for (const r of remote) {
      if (!merged.some((m) => haversineKm(m, r) < 0.15)) merged.push(r);
    }
    return merged.slice(0, 8);
  } catch {
    return local;
  }
}

export interface RouteResult {
  geometry: LatLng[];
  distanceKm: number;
  durationMin: number;
}

export async function getRoute(points: LatLng[]): Promise<RouteResult> {
  const fallback = (): RouteResult => {
    const geometry: LatLng[] = [];
    for (let i = 0; i < points.length - 1; i++) geometry.push(...syntheticRoute(points[i], points[i + 1], 18));
    const distanceKm = Math.round(pathLengthKm(geometry) * 1.15 * 10) / 10;
    return { geometry, distanceKm, durationMin: estimateDurationMin(distanceKm) };
  };
  if (!ONLINE_PROVIDERS || points.length < 2) return fallback();
  try {
    const coords = points.map((p) => `${p.lng},${p.lat}`).join(";");
    const res = await fetch(`${OSRM}/route/v1/driving/${coords}?overview=full&geometries=geojson`);
    if (!res.ok) return fallback();
    const data = await res.json();
    const route = data?.routes?.[0];
    if (!route) return fallback();
    const geometry: LatLng[] = route.geometry.coordinates.map((c: [number, number]) => ({ lat: c[1], lng: c[0] }));
    const distanceKm = Math.round((route.distance / 1000) * 10) / 10;
    // OSRM demo durations are optimistic for Colombo traffic — calibrate up a touch
    const durationMin = Math.max(3, Math.round((route.duration / 60) * 1.35));
    return { geometry, distanceKm, durationMin };
  } catch {
    return fallback();
  }
}

export function isInsideServiceArea(p: LatLng) {
  return haversineKm(p, SERVICE_AREA.center) <= SERVICE_AREA.radiusKm;
}
