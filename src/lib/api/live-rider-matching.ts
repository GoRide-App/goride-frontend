/**
 * Rider side of real driver matching.
 *
 * The rider's trip itself still lives in the in-browser mock world. When they request a
 * ride we hand the *search* to the real goride-trip-matching service instead of the mock
 * matcher: it finds nearby available drivers and offers them the ride. This module then
 * watches for the outcome and feeds it back into the mock trip:
 *   - nobody available / nobody accepts in time -> NO_DRIVER_FOUND
 *   - a driver accepts                          -> DRIVER_ASSIGNED
 * If the real service can't be reached, the mock matcher takes over as before.
 */
import type { LatLng, VehicleTypeCode } from "@/types";
import { DRIVER_OFFER_TTL_SECONDS } from "@/lib/constants";
import { toast } from "@/components/ui/toast";
import { world, type LiveDriverInfo } from "@/lib/mock/world";
import { getRideRequestStatusLive, requestRideLive } from "./live-matching";

const ASSIGNED_STATUSES = ["DRIVER_ASSIGNED", "DRIVER_EN_ROUTE", "DRIVER_ARRIVED", "TRIP_IN_PROGRESS"];

const POLL_MS = 2000;
const RESOLVE_TIMEOUT_MS = 2500;
/** Offers lapse after DRIVER_OFFER_TTL_SECONDS; allow a little grace, then stop waiting. */
const GIVE_UP_MS = (DRIVER_OFFER_TTL_SECONDS + 15) * 1000;
const SEARCHING = ["SEARCHING_DRIVER", "REMATCHING"];
const VEHICLE_CODES: VehicleTypeCode[] = ["BIKE", "TUK", "CAR", "XL"];

export interface LiveMatchingDeps {
  /** The accepting driver's display name and current position (best effort; both have fallbacks). */
  resolveDriver: (driverId: string) => Promise<{ name?: string; location?: LatLng }>;
}

const polling = new Set<string>();

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
    watchLiveTripStatus(tripId);
  }
}

function watchOutcome(tripId: string, deps: LiveMatchingDeps, startedAt: number) {
  if (polling.has(tripId)) return;
  polling.add(tripId);

  const finish = () => polling.delete(tripId);

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

      if (status.status === "Accepted" && status.driver) {
        const d = status.driver;
        // The name/position lookups only decorate the assignment, so never let a slow or
        // unreachable service hold it up: give them RESOLVE_TIMEOUT_MS, then use the fallbacks.
        const resolved = await Promise.race([
          deps.resolveDriver(d.driverId),
          new Promise<{ name?: string; location?: LatLng }>((resolve) => setTimeout(() => resolve({}), RESOLVE_TIMEOUT_MS)),
        ]).catch(() => ({}) as { name?: string; location?: LatLng });
        const code = d.vehicleTypeCode === "TUKTUK" ? "TUK" : d.vehicleTypeCode;
        w.assignLiveDriver(tripId, {
          id: d.driverId,
          name: resolved.name || "Your driver",
          vehicleMake: d.vehicleMake,
          vehicleModel: d.vehicleModel,
          vehiclePlate: d.vehiclePlate,
          vehicleTypeCode: VEHICLE_CODES.includes(code as VehicleTypeCode) ? (code as VehicleTypeCode) : trip.vehicleTypeCode,
          location: resolved.location ?? trip.pickup,
        } satisfies LiveDriverInfo);
        watchLiveTripStatus(tripId);
        return finish();
      }
    } catch (err) {
      // A failed poll just means try again; GIVE_UP_MS bounds the wait.
      console.warn("[goride-trip-matching] checking the ride request failed, will retry", err);
    }

    setTimeout(step, POLL_MS);
  };

  setTimeout(step, POLL_MS);
}

const progressPolling = new Set<string>();

/**
 * Once a real driver is assigned, keep polling the same status endpoint for the stages they
 * report themselves from their own device (Arrived / InProgress / Completed) and bridge each one
 * into the mock trip so the rider's existing sheets react to them, same as the simulated flow.
 */
function watchLiveTripStatus(tripId: string) {
  if (progressPolling.has(tripId)) return;
  progressPolling.add(tripId);
  const finish = () => progressPolling.delete(tripId);

  const step = async () => {
    const w = world();
    const trip = w.get().trips.find((t) => t.id === tripId);
    if (!trip || !ASSIGNED_STATUSES.includes(trip.status)) return finish(); // cancelled, or wrapped up locally already

    try {
      const status = await getRideRequestStatusLive(tripId);

      if (status.status === "Arrived" && trip.status !== "DRIVER_ARRIVED") {
        w.markLiveArrived(tripId);
      } else if (status.status === "InProgress" && trip.status !== "TRIP_IN_PROGRESS") {
        w.startLiveTrip(tripId);
      } else if (status.status === "Completed") {
        w.completeLiveTrip(tripId);
        return finish();
      }
    } catch (err) {
      // A failed poll just means try again; there's no give-up bound here since the driver
      // could be mid-trip for a long time.
      console.warn("[goride-trip-matching] checking trip progress failed, will retry", err);
    }

    setTimeout(step, POLL_MS);
  };

  setTimeout(step, POLL_MS);
}
