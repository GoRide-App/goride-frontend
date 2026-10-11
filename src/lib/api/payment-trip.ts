import { isLiveTrip } from "./live-rider-matching";

/** Stable across polls, retries and reloads; only simulated rides use the demo namespace. */
export function toPaymentTripId(tripId: string): string {
  return process.env.NEXT_PUBLIC_API_MODE === "http" || isLiveTrip(tripId) ? tripId : `demo_${tripId}`;
}

/** Restore UI trip IDs in payment records, nested confirmations and collection responses. */
export function fromPaymentTripIds<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => fromPaymentTripIds(item)) as T;
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key,
    key === "tripId" && typeof item === "string" && item.startsWith("demo_trp_")
      ? item.slice(5)
      : fromPaymentTripIds(item),
  ])) as T;
}
