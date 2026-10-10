"use client";

import * as React from "react";
import { IS_MOCK } from "@/lib/api";
import { paymentService } from "@/lib/api/payments-live";
import { driverPaymentNotices, mockDriverPaymentNotifications, type DriverPaymentNotification } from "@/lib/driver-payment-notifications";
import { world } from "@/lib/mock/world";
import { useDriverStore } from "@/store/driver-store";
import { toast } from "@/components/ui/toast";

/** Runs independently of trip completion and never changes availability or the current trip. */
export function DriverPaymentNotifications({ driverId }: { driverId: string }) {
  const online = useDriverStore((s) => s.online && s.driverId === driverId);

  React.useEffect(() => {
    let storage: Storage | undefined;
    try { storage = window.localStorage; } catch { /* Memory dedupe still works. */ }
    const notices = driverPaymentNotices(driverId, IS_MOCK, storage);
    const remember = () => {
      const state = useDriverStore.getState();
      if (state.driverId !== driverId) return;
      const offer = state.acceptedOffer;
      if (offer) notices.rememberDestination(offer.tripId, offer.dropoffLocation);
      if (state.trip) notices.rememberDestination(state.trip.id, state.trip.destination.name);
    };
    remember();
    return useDriverStore.subscribe(remember);
  }, [driverId]);

  React.useEffect(() => {
    if (!online) return;
    let storage: Storage | undefined;
    try { storage = window.localStorage; } catch { /* Memory dedupe still works. */ }
    const notices = driverPaymentNotices(driverId, IS_MOCK, storage);
    let stopped = false;
    let busy = false;
    const pending = new Map<string, DriverPaymentNotification>();
    let nextToastAt = 0;
    const active = () => !stopped && useDriverStore.getState().online && useDriverStore.getState().driverId === driverId;
    const showNext = () => {
      if (!active() || document.visibilityState === "hidden" || Date.now() < nextToastAt) return;
      for (const [tripId, notification] of pending) {
        pending.delete(tripId);
        const message = notices.claim(notification);
        if (message) {
          toast.notify(message);
          nextToastAt = Date.now() + 6500;
          break;
        }
      }
    };
    const poll = async () => {
      if (!active() || busy || document.visibilityState === "hidden") return;
      busy = true;
      try {
        // Rescan the recent window each round: a transaction committing late cannot be skipped.
        const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        if (IS_MOCK) {
          const trips = world().get().trips;
          for (const trip of trips) {
            if (trip.driverId === driverId) notices.rememberDestination(trip.id, trip.destination.name);
          }
          for (const notification of mockDriverPaymentNotifications(trips, driverId, since)) {
            pending.set(notification.tripId, notification);
          }
        } else {
          let after: number | undefined;
          do {
            const page = await paymentService.driverNotifications(since, after);
            if (!active()) return;
            for (const notification of page.notifications) {
              pending.set(notification.tripId, notification);
            }
            after = page.nextCursor ?? undefined;
          } while (after !== undefined && active());
        }
      } catch {
        // A failed poll leaves all unseen trips eligible for the next round.
      } finally {
        busy = false;
        showNext();
      }
    };
    void poll();
    const timer = setInterval(() => void poll(), 10_000);
    const noticeTimer = setInterval(showNext, 1000);
    const focus = () => void poll();
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", focus);
    return () => {
      stopped = true;
      clearInterval(timer);
      clearInterval(noticeTimer);
      window.removeEventListener("focus", focus);
      document.removeEventListener("visibilitychange", focus);
    };
  }, [driverId, online]);

  return null;
}
