/**
 * Rider side of real driver matching.
 *
 * The rider's trip itself still lives in the in-browser mock world. When they request a
 * ride we hand the *search* to the real goride-trip-matching service instead of the mock
 * matcher: it finds nearby available drivers and offers them the ride. This module then
 * watches for the outcome and feeds it back into the mock trip:
 *   - nobody available / nobody accepts in time -> NO_DRIVER_FOUND
 *   - a driver accepts                          -> DRIVER_ASSIGNED (straight away)
 *   - the driver's own stages                   -> arrived / in progress / completed
 * If the real service can't be reached, the mock matcher takes over as before.
 */
import type { LatLng, Trip, VehicleTypeCode } from "@/types";
import { DRIVER_OFFER_TTL_SECONDS } from "@/lib/constants";
import { toast } from "@/components/ui/toast";
import { world, type LiveDriverInfo } from "@/lib/mock/world";
import { getRideRequestStatusLive, requestRideLive, type MatchedDriver, type RideRequestStatus } from "./live-matching";

const ASSIGNED_STATUSES = ["DRIVER_ASSIGNED", "DRIVER_EN_ROUTE", "DRIVER_ARRIVED", "TRIP_IN_PROGRESS"];

/** While searching, a second matters: the driver is waiting on the rider's screen too. */
const SEARCH_POLL_MS = 1000;
/** Once assigned, stages change on a human timescale. */
const TRIP_POLL_MS = 1500;
/** Offers lapse after DRIVER_OFFER_TTL_SECONDS; allow a little grace, then stop waiting. */
const GIVE_UP_MS = (DRIVER_OFFER_TTL_SECONDS + 15) * 1000;
const SEARCHING = ["SEARCHING_DRIVER", "REMATCHING"];
const VEHICLE_CODES: VehicleTypeCode[] = ["BIKE", "TUK", "CAR", "XL"];

/** How far along the trip service says the trip is; Accepted and beyond carry the driver. */
const STAGE: Record<RideRequestStatus["status"], number> = { Searching: 0, NoDriver: 0, Accepted: 1, Arrived: 2, InProgress: 3, Completed: 4 };

export interface LiveMatchingDeps {
  /** The accepting driver's display name and current position (best effort; both have fallbacks). */
  resolveDriver: (driverId: string) => Promise<{ name?: string; location?: LatLng }>;
}

/**
 * True when the real matcher found this trip's driver (as opposed to a simulated one). Its
 * completion — and so its payment — then comes from the trip service, not the browser.
 */
export function isLiveTrip(tripId: string) {
  return !!world().get().sim[tripId]?.live;
}

const polling = new Set<string>();
/** The nearby drivers the request went to, so an acceptance can be placed on the map at once. */
const offeredTo = new Map<string, MatchedDriver[]>();

/**
 * Sends the trip's ride request to the real matcher. Must be called right after the mock
 * request created the trip in SEARCHING_DRIVER, so the mock matcher can be switched off
 * before it gets a chance to assign a simulated driver.
 */
export async function startLiveRideRequest(tripId: string, deps: LiveMatchingDeps): Promise<void> {
  const w = world();
  const trip = w.trip(tripId);
  w.setLiveMatching(tripId, true); // synchronous: happens before any mock matching tick

  try {
    const result = await requestRideLive({
      tripId,
      riderId: trip.riderId,
      pickup: trip.pickup,
      dropoff: trip.destination,
      vehicleTypeCode: trip.vehicleTypeCode,
      pickupLocation: trip.pickup.name,
      dropoffLocation: trip.destination.name,
      fare: trip.estimatedFare ?? undefined,
    });

    if (!result.matched) {
      w.failLiveMatching(tripId);
      return;
    }
    offeredTo.set(tripId, result.drivers ?? []);
  } catch (err) {
    console.warn("[goride-trip-matching] live ride request failed, falling back to the mock matcher", err);
    // Otherwise the rider just sees demo drivers with no hint that the real service wasn't used.
    toast.warning("Live driver matching unavailable", "Showing demo drivers instead. Check that goride-trip-matching is running.");
    w.setLiveMatching(tripId, false);
    return;
  }

  watchOutcome(tripId, deps, Date.now());
}

/** After a page reload the poller is gone; pick the wait back up for a trip still handed to the real matcher. */
export function resumeLiveRideRequest(tripId: string, deps: LiveMatchingDeps): void {
  const s = world().get();
  const trip = s.trips.find((t) => t.id === tripId);
  if (!trip || !s.sim[tripId]?.live) return;

  if (SEARCHING.includes(trip.status)) {
    if (!polling.has(tripId)) watchOutcome(tripId, deps, new Date(trip.requestedAt ?? Date.now()).getTime());
  } else if (ASSIGNED_STATUSES.includes(trip.status)) {
    watchLiveTripStatus(tripId, 0);
  }
}

/**
 * Assigns the accepting driver straight from the poll: vehicle from the status, position from
 * the request's nearby-driver list (or the pickup until we know better). Their name and live
 * position are filled in afterwards, so a slow identity or location lookup never holds it up.
 */
function assignNow(tripId: string, trip: Trip, status: RideRequestStatus, deps: LiveMatchingDeps) {
  const d = status.driver!;
  const code = d.vehicleTypeCode === "TUKTUK" ? "TUK" : d.vehicleTypeCode;
  const seen = offeredTo.get(tripId)?.find((m) => m.driverId === d.driverId);
  offeredTo.delete(tripId);
  world().assignLiveDriver(tripId, {
    id: d.driverId,
    name: "Your driver",
    vehicleMake: d.vehicleMake,
    vehicleModel: d.vehicleModel,
    vehiclePlate: d.vehiclePlate,
    vehicleTypeCode: VEHICLE_CODES.includes(code as VehicleTypeCode) ? (code as VehicleTypeCode) : trip.vehicleTypeCode,
    location: seen ? { lat: seen.lat, lng: seen.lng } : trip.pickup,
  } satisfies LiveDriverInfo);

  deps
    .resolveDriver(d.driverId)
    .then((r) => world().updateLiveDriver(tripId, d.driverId, { name: r.name, location: seen ? undefined : r.location }))
    .catch(() => {
      /* the fallbacks stay */
    });
}

function watchOutcome(tripId: string, deps: LiveMatchingDeps, startedAt: number) {
  if (polling.has(tripId)) return;
  polling.add(tripId);

  const finish = () => {
    polling.delete(tripId);
    offeredTo.delete(tripId);
  };

  const step = async () => {
    const w = world();
    const trip = w.get().trips.find((t) => t.id === tripId);
    if (!trip || !SEARCHING.includes(trip.status)) return finish(); // cancelled, or already resolved

    if (Date.now() - startedAt > GIVE_UP_MS) {
      w.failLiveMatching(tripId);
      return finish();
    }

    try {
      const status = await getRideRequestStatusLive(tripId);

      if (status.status === "NoDriver") {
        w.failLiveMatching(tripId);
        return finish();
      }

      // Accepted — or already further along if the driver was quick (or a poll was missed).
      if (STAGE[status.status] >= STAGE.Accepted && status.driver) {
        assignNow(tripId, trip, status, deps);
        finish();
        if (status.status !== "Accepted") w.advanceLiveTrip(tripId, status.status as "Arrived" | "InProgress" | "Completed", status.fare);
        watchLiveTripStatus(tripId);
        return;
      }
    } catch (err) {
      // A failed poll just means try again; GIVE_UP_MS bounds the wait.
      console.warn("[goride-trip-matching] checking the ride request failed, will retry", err);
    }

    setTimeout(step, SEARCH_POLL_MS);
  };

  // First check right away: the request has just landed.
  void step();
}

const progressPolling = new Set<string>();

/**
 * Once a real driver is assigned, keep polling the same status endpoint for the stages they
 * report from their own device (Arrived / InProgress / Completed) and bridge them into the mock
 * trip, so the rider's existing sheets react to them, same as the simulated flow. Stops once
 * Completed has been applied (the payment sheet takes over) or the trip is no longer active.
 */
function watchLiveTripStatus(tripId: string, firstDelayMs = TRIP_POLL_MS) {
  if (progressPolling.has(tripId)) return;
  progressPolling.add(tripId);
  const finish = () => progressPolling.delete(tripId);

  const step = async () => {
    const w = world();
    const trip = w.get().trips.find((t) => t.id === tripId);
    if (!trip || !ASSIGNED_STATUSES.includes(trip.status)) return finish(); // cancelled, or wrapped up already

    try {
      const status = await getRideRequestStatusLive(tripId);
      if (STAGE[status.status] > STAGE.Accepted) w.advanceLiveTrip(tripId, status.status as "Arrived" | "InProgress" | "Completed", status.fare);
    } catch (err) {
      // A failed poll just means try again; there's no give-up bound here since the driver
      // could be mid-trip for a long time.
      console.warn("[goride-trip-matching] checking trip progress failed, will retry", err);
    }

    setTimeout(step, TRIP_POLL_MS);
  };

  setTimeout(step, firstDelayMs);
}
