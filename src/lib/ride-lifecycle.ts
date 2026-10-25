import type { LiveDriverOffer, TripStatusAction } from "./api/live-matching";

export const DRIVER_STAGES: { status: string; headline: string; lede: string; action: string; next: TripStatusAction | null }[] = [
  { status: "Accepted", headline: "Head to the pickup point", lede: "The rider is waiting. Follow the map to the pickup and tap below when you get there.", action: "I've arrived", next: "Arrived" },
  { status: "Arrived", headline: "Waiting at pickup", lede: "Let the rider know you're here. Start the trip once they're in.", action: "Start trip", next: "InProgress" },
  { status: "InProgress", headline: "Trip in progress", lede: "Follow the route to the drop-off and complete the trip when you arrive.", action: "Complete trip", next: "Completed" },
  { status: "Completed", headline: "Trip completed", lede: "Nice work. Tap Done to finish and get back to new requests.", action: "Done", next: null },
];

export function stageFor(status: string) {
  const index = DRIVER_STAGES.findIndex((s) => s.status === status);
  return index < 0 ? null : { index, stage: DRIVER_STAGES[index] };
}

export function rideEnded(status: string): status is "Cancelled" | "DriverCancelled" | "Expired" {
  return status === "Cancelled" || status === "DriverCancelled" || status === "Expired";
}

export const RIDER_STAGE: Record<string, number> = { Searching: 0, NoDriver: 0, Accepted: 1, Arrived: 2, InProgress: 3, Completed: 4 };

/** A lost response or rejected action is recoverable when the server can still be read. */
export async function actionWithResync<T>(action: () => Promise<T>, refresh: () => Promise<T>): Promise<T> {
  try { return await action(); } catch { return refresh(); }
}

export interface DriverTripSnapshot {
  offer: LiveDriverOffer | null;
  endedStatus?: string;
}

/** An older completed ride must never replace a trip that just disappeared from /active. */
export function driverTripSnapshot(active: LiveDriverOffer | null, previous: LiveDriverOffer | null, status?: string): DriverTripSnapshot {
  const endedStatus = status && rideEnded(status) ? status : undefined;
  const offer = active && (active.status !== "Completed" || active.tripId === previous?.tripId) && !rideEnded(active.status) ? active : null;
  return { offer, endedStatus: endedStatus ?? (active && rideEnded(active.status) ? active.status : undefined) };
}
