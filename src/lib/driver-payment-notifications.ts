import type { Trip } from "@/types";

export interface DriverPaymentNotification {
  tripId: string;
  amount: number;
  currency: string;
  cardBrand: string | null;
  cardLast4: string | null;
  paidAt: string;
}

type StorageLike = Pick<Storage, "getItem" | "setItem">;
const memory = new Map<string, string>();

/** Account and mode scoped, with a memory fallback if browser storage is unavailable. */
export function driverPaymentNotices(driverId: string, mock: boolean, storage?: StorageLike) {
  const prefix = `goride.driver-payments.v1.${mock ? "mock" : "live"}.${encodeURIComponent(driverId)}.`;
  function read(key: string) {
    try { return storage?.getItem(key) ?? memory.get(key); } catch { return memory.get(key); }
  }
  function write(key: string, value: string) {
    memory.set(key, value);
    try { storage?.setItem(key, value); } catch { /* Keep notices usable in private browsing. */ }
  }
  return {
    rememberDestination(tripId: string, destination?: string | null) {
      if (destination) write(`${prefix}destination.${encodeURIComponent(tripId)}`, destination);
    },
    /** Claim before showing so overlapping polls/focus events cannot toast the same trip twice. */
    claim(notification: DriverPaymentNotification): string | null {
      const { tripId, amount, currency, paidAt } = notification;
      if (!tripId || !Number.isFinite(amount) || amount <= 0 || currency !== "LKR" || !Number.isFinite(Date.parse(paidAt))) return null;
      const key = `${prefix}seen.${encodeURIComponent(tripId)}`;
      if (read(key)) return null;
      write(key, paidAt);
      const destination = read(`${prefix}destination.${encodeURIComponent(tripId)}`);
      const trip = destination ? `your trip to ${destination}` : `trip ${tripId}`;
      return `Card payment received: LKR ${amount.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} for ${trip}`;
    },
  };
}

/** Simulated rides use their confirmed card outcome, never their estimate or a cash payment. */
export function mockDriverPaymentNotifications(trips: Trip[], driverId: string, since: string): DriverPaymentNotification[] {
  return trips.flatMap((trip) => {
    const payment = trip.payment;
    if (trip.driverId !== driverId || payment?.method !== "Card" || payment.status !== "Paid"
      || !payment.processedAt || Date.parse(payment.processedAt) < Date.parse(since)) return [];
    return [{ tripId: trip.id, amount: payment.finalFare, currency: "LKR", paidAt: payment.processedAt, cardBrand: null, cardLast4: null }];
  });
}
