"use client";

import { create } from "zustand";
import type { Driver, DriverLocation, DriverOffer, LatLng, Trip } from "@/types";
import { api, IS_MOCK, errorMessage, type DriverTripAction } from "@/lib/api";
import { world } from "@/lib/mock/world";
import { bearing } from "@/lib/utils";
import { getCurrentPosition } from "@/lib/geo/providers";
import {
  acceptOfferLive,
  refreshDriverTripLive,
  cancelOfferLive,
  declineOfferLive,
  getPendingOffersLive,
  updateTripStatusLive,
  ON_TRIP_STATUSES,
  type LiveDriverOffer,
  type TripStatusAction,
} from "@/lib/api/live-matching";
import { actionWithResync, driverTripSnapshot, type DriverTripSnapshot } from "@/lib/ride-lifecycle";
import { toast } from "@/components/ui/toast";

interface DriverState {
  driver: Driver | null;
  driverId: string | null;
  loading: boolean;
  online: boolean;
  offer: DriverOffer | null;
  trip: Trip | null;
  location: DriverLocation | null;
  /** True once the driver has pinned their location manually, pausing the live GPS watch. */
  manualLocation: boolean;
  /** Ride requests from the real matching service waiting for this driver (polled while online). */
  liveOffers: LiveDriverOffer[];
  /** The ride this driver accepted and is on (or just completed, until they tap Done). */
  acceptedOffer: LiveDriverOffer | null;
  /** Trip id of the accept call in flight, if any (the trip card already shows, optimistically). */
  acceptingTripId: string | null;
  busy: boolean;
  restoringLiveTrip: boolean;
  error: string | null;

  load: (driverId: string) => Promise<void>;
  start: (driverId: string) => void;
  stop: () => void;
  setOnline: (online: boolean) => Promise<boolean>;
  /** Pin the driver's current location by hand (e.g. dragging the map pin); persists it and stops the GPS watch from overriding it. */
  setManualLocation: (pos: LatLng) => Promise<void>;
  /** Resume tracking from the device's real GPS position. */
  recenterGps: () => Promise<void>;
  /** Picks up the driver's current live trip from the trip service (after a reload, or a DRIVER_BUSY). */
  restoreLiveTrip: () => Promise<void>;
  /** Accept a ride request from the real matching service. Resolves true if this driver got the ride. */
  acceptLiveOffer: (tripId: string) => Promise<boolean>;
  /** Advance the accepted trip one stage (Arrived / InProgress / Completed). Resolves true on success. */
  advanceLiveTrip: (action: TripStatusAction) => Promise<boolean>;
  cancelLiveTrip: () => Promise<boolean>;
  declineLiveOffer: (tripId: string) => Promise<void>;
  /** Clears the finished trip. Refused only while it is still underway. */
  dismissAcceptedOffer: () => void;
  accept: () => Promise<boolean>;
  decline: () => Promise<void>;
  advance: (action: DriverTripAction) => Promise<boolean>;
  cancel: (reason: string) => Promise<boolean>;
  rateRider: (stars: number, comment?: string) => Promise<void>;
  triggerSos: () => Promise<void>;
  finishTrip: () => void;
  refresh: () => Promise<void>;
}

/**
 * A driver is tied to their live trip only while driving it: no going offline, no new offers,
 * status OnTrip. Once it is completed they can finish straight away; paying is the rider's side.
 */
export function liveTripLocked(st: Pick<DriverState, "acceptedOffer">) {
  return !!st.acceptedOffer && ON_TRIP_STATUSES.includes(st.acceptedOffer.status);
}

/** What goride-location should hear: OnTrip while on a (mock or live) trip, else the toggle. */
function locationStatus(st: Pick<DriverState, "trip" | "online" | "acceptedOffer">): DriverLocation["status"] {
  // A live trip's browser copy can lag after switching from rider to driver in the
  // same browser. Only the server offer controls availability for those trips.
  const localTrip = st.trip && (!IS_MOCK || !world().get().sim[st.trip.id]?.live);
  const driving = localTrip && ["DRIVER_ASSIGNED", "DRIVER_EN_ROUTE", "DRIVER_ARRIVED", "TRIP_IN_PROGRESS"].includes(st.trip!.status);
  return driving || liveTripLocked(st) ? "OnTrip" : st.online ? "Online" : "Offline";
}

/** One sync round every SYNC_MS, never overlapping: open offers, or the accepted trip's stage. */
const SYNC_MS = 1500;

let unsub: (() => void) | null = null;
let heartbeat: ReturnType<typeof setInterval> | null = null;
let locPoll: ReturnType<typeof setInterval> | null = null;
let syncTimer: ReturnType<typeof setTimeout> | null = null;
let syncToken = 0;
let liveRevision = 0;
let locHeartbeat: ReturnType<typeof setInterval> | null = null;
let geoWatch: number | null = null;
let lastOfferToast = "";
let lastTripToast = "";

export const useDriverStore = create<DriverState>()((set, get) => {
  function beginGeoWatch(driverId: string) {
    let last: { lat: number; lng: number } | null = null;
    geoWatch = navigator.geolocation.watchPosition(
      (p) => {
        const pos = { lat: p.coords.latitude, lng: p.coords.longitude };
        const heading = p.coords.heading ?? (last ? bearing(last, pos) : 0);
        last = pos;
        const st = get();
        const status = locationStatus(st);
        set({ location: { driverId, ...pos, heading, status, lastUpdated: new Date().toISOString() }, manualLocation: false });
        if (st.online || liveTripLocked(st)) api.location.updateDriverLocation(driverId, pos, heading, status).catch(() => {});
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000 },
    );
  }

  /** Re-sends the current position with the status the driver should have right now (e.g. OnTrip after accepting). */
  function pushStatus() {
    const st = get();
    if (!st.driverId || !st.location) return;
    const status = locationStatus(st);
    if (st.location.status !== status) set({ location: { ...st.location, status } });
    api.location.updateDriverLocation(st.driverId, st.location, st.location.heading, status).catch(() => {});
  }

  /** Swaps in a (new) accepted trip. */
  function setAccepted(offer: LiveDriverOffer | null) {
    set({ acceptedOffer: offer, error: null, ...(offer ? { liveOffers: [] } : {}) });
  }

  function applySnapshot(snapshot: DriverTripSnapshot) {
    const previous = get().acceptedOffer;
    setAccepted(snapshot.offer);
    if (previous?.tripId !== snapshot.offer?.tripId || previous?.status !== snapshot.offer?.status || get().location?.status !== locationStatus(get())) pushStatus();
    if (snapshot.endedStatus === "Cancelled") toast.info("Rider cancelled this trip");
    else if (snapshot.endedStatus === "Expired") toast.info("Trip expired", "You can receive new ride requests.");
    else if (snapshot.endedStatus === "DriverCancelled") toast.info("Trip cancelled");
  }

  /** Ignore reads begun before an action, stop, or account change. */
  async function syncOnce(driverId: string) {
    const st = get();
    if (st.busy || st.acceptingTripId || st.restoringLiveTrip) return;
    const revision = liveRevision;
    const token = syncToken;
    const current = () => revision === liveRevision && token === syncToken && get().driverId === driverId && !get().busy;
    try {
      if (st.acceptedOffer?.status === "Completed") return;
      const snapshot = await refreshDriverTripLive(driverId, st.acceptedOffer);
      if (!current()) return;
      applySnapshot(snapshot);
      if (!snapshot.offer && get().online) {
        const offers = await getPendingOffersLive(driverId);
        if (current() && !get().acceptedOffer) set({ liveOffers: offers });
      } else if (!get().online) set({ liveOffers: [] });
    } catch { /* Keep the last confirmed state and retry on the next round. */ }
  }

  async function changeLiveTrip(action: (offer: LiveDriverOffer, driverId: string) => Promise<LiveDriverOffer>) {
    const { acceptedOffer: offer, driverId, busy, acceptingTripId, restoringLiveTrip } = get();
    if (!offer || !driverId || busy || acceptingTripId || restoringLiveTrip) return false;
    const revision = ++liveRevision;
    set({ busy: true, error: null });
    try {
      const snapshot = await actionWithResync(
        async () => {
          const updated = await action(offer, driverId);
          return { ...driverTripSnapshot(updated, offer), endedStatus: updated.status === "Cancelled" ? "DriverCancelled" : undefined };
        },
        () => refreshDriverTripLive(driverId, offer),
      );
      if (revision !== liveRevision || get().driverId !== driverId) return false;
      applySnapshot(snapshot);
      return true;
    } catch (e) {
      if (revision === liveRevision && get().driverId === driverId) {
        set({ error: errorMessage(e) });
        toast.error("Couldn't refresh the trip", errorMessage(e));
      }
      return false;
    } finally {
      if (revision === liveRevision && get().driverId === driverId) set({ busy: false });
    }
  }

  function startSync(driverId: string) {
    stopSync();
    const token = syncToken;
    const step = async () => {
      if (token !== syncToken) return;
      await syncOnce(driverId);
      if (token !== syncToken) return;
      syncTimer = setTimeout(step, SYNC_MS);
    };
    syncTimer = setTimeout(step, 0);
  }

  function stopSync() {
    syncToken += 1;
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = null;
  }

  return {
  driver: null,
  driverId: null,
  loading: true,
  online: false,
  offer: null,
  trip: null,
  location: null,
  manualLocation: false,
  liveOffers: [],
  acceptedOffer: null,
  acceptingTripId: null,
  busy: false,
  restoringLiveTrip: true,
  error: null,

  async load(driverId) {
    if (get().driverId !== driverId) set({ acceptedOffer: null, liveOffers: [], busy: false, acceptingTripId: null });
    set({ loading: true, driverId });
    // Independent of the mock-world lookups below, which reject for real (Asgardeo) drivers.
    const restoring = get().restoreLiveTrip();
    // Each lookup stands alone: the mock-world ones reject with "Driver not found" for real
    // (Asgardeo) drivers, who aren't seeded there. That is expected, so it must not surface as
    // an error or stop the location (and with it the online state) from loading.
    const [driver, trip, offer, location] = await Promise.allSettled([
      api.drivers.get(driverId),
      api.trips.activeForDriver(driverId),
      api.trips.currentOffer(driverId),
      api.location.getDriverLocation(driverId),
    ]);
    const value = <T,>(r: PromiseSettledResult<T>) => (r.status === "fulfilled" ? r.value : null);
    const mockDriver = value(driver);
    const loc = value(location);
    const activeTrip = value(trip);
    if (get().driverId !== driverId) return;
    set({
      driver: mockDriver,
      // Real drivers: goride-location's status is the source of truth (OnTrip counts as online).
      online: mockDriver ? mockDriver.profile.online : loc?.status === "Online" || loc?.status === "OnTrip",
      trip: activeTrip,
      offer: value(offer),
      location: loc,
      loading: false,
      error: null,
    });
    await restoring;
    pushStatus();
    if (activeTrip) lastTripToast = `${activeTrip.id}|${activeTrip.status}`;
  },

  start(driverId) {
    get().stop();
    set({ driverId });
    unsub = api.trips.subscribeDriver(driverId, (e) => {
      if (e.type === "offer.received" && e.offer) {
        set({ offer: e.offer });
        if (lastOfferToast !== e.offer.id) {
          lastOfferToast = e.offer.id;
          toast.notify("New ride request", `${e.offer.trip.pickup.name} → ${e.offer.trip.destination.name}`);
          try {
            navigator.vibrate?.([120, 60, 120]);
          } catch {
            /* ignore */
          }
        }
      } else if (e.type === "offer.expired") {
        set({ offer: null });
      } else if (e.type === "trip.updated") {
        const prev = get().trip;
        const t = e.trip ?? null;
        set({ trip: t });
        if (t) {
          const sig = `${t.id}|${t.status}|${t.payment?.status}|${t.payment?.method}`;
          if (sig !== lastTripToast) {
            lastTripToast = sig;
            if (t.status === "CANCELLED" && prev && prev.status !== "CANCELLED") toast.warning("Trip cancelled", t.cancellationReason ?? "The rider cancelled this trip.");
            if (t.payment?.method === "Cash" && t.payment.status === "AwaitingCash" && prev?.payment?.status !== "AwaitingCash") toast.notify("Rider is paying cash", `Collect Rs ${t.payment.finalFare.toLocaleString()} from the rider.`);
            if (t.payment?.method === "Cash" && t.payment.status === "Paid" && prev?.payment?.status !== "Paid") toast.success("Cash confirmed", `Rs ${t.payment.finalFare.toLocaleString()} credited`);
          }
        } else if (prev && ["DRIVER_ASSIGNED", "DRIVER_EN_ROUTE", "DRIVER_ARRIVED", "TRIP_IN_PROGRESS"].includes(prev.status)) {
          // Trip left our active set (rider cancelled) — fetch the terminal state for the UI
          api.trips.get(prev.id).then((full) => set({ trip: full })).catch(() => set({ trip: null }));
        }
      }
    });

    // presence + location
    heartbeat = setInterval(() => {
      const st = get();
      if (!st.online || !st.driver) return;
      if (IS_MOCK) {
        world().presenceOwner = driverId;
        world().heartbeatDriver(driverId);
      }
    }, 1000);

    // goride-location only treats a driver as available if their position was refreshed within
    // the last 2 minutes. GPS ticks do that in real mode, but the mock location source doesn't,
    // so re-send the current position periodically while online (or tied to a live trip).
    locHeartbeat = setInterval(() => {
      const st = get();
      if ((!st.online && !liveTripLocked(st)) || !st.location || !st.driverId) return;
      api.location.updateDriverLocation(st.driverId, st.location, st.location.heading, locationStatus(st)).catch(() => {});
    }, 30_000);

    // Ride requests and the accepted trip's stage, from the real trip service.
    startSync(driverId);

    if (IS_MOCK) {
      locPoll = setInterval(async () => {
        const loc = await api.location.getDriverLocation(driverId);
        if (loc) set({ location: loc });
      }, 1000);
    } else if (typeof navigator !== "undefined" && navigator.geolocation) {
      beginGeoWatch(driverId);
    }
  },

  stop() {
    unsub?.();
    unsub = null;
    if (heartbeat) clearInterval(heartbeat);
    if (locPoll) clearInterval(locPoll);
    if (locHeartbeat) clearInterval(locHeartbeat);
    stopSync();
    if (geoWatch != null && typeof navigator !== "undefined") navigator.geolocation.clearWatch(geoWatch);
    heartbeat = locPoll = locHeartbeat = null;
    geoWatch = null;
    if (IS_MOCK) world().presenceOwner = null;
  },

  async setManualLocation(pos) {
    const driverId = get().driverId;
    if (!driverId) return;
    if (geoWatch != null && typeof navigator !== "undefined") {
      navigator.geolocation.clearWatch(geoWatch);
      geoWatch = null;
    }
    const status = locationStatus(get());
    set({ location: { driverId, ...pos, heading: 0, status, lastUpdated: new Date().toISOString() }, manualLocation: true });
    try {
      await api.location.updateDriverLocation(driverId, pos, 0, status);
    } catch (e) {
      toast.error("Couldn't save location", errorMessage(e));
    }
  },

  async recenterGps() {
    const driverId = get().driverId;
    if (!driverId) return;
    const { pos } = await getCurrentPosition();
    const status = locationStatus(get());
    set({ location: { driverId, ...pos, heading: 0, status, lastUpdated: new Date().toISOString() }, manualLocation: false });
    api.location.updateDriverLocation(driverId, pos, 0, status).catch(() => {});
    if (!IS_MOCK && typeof navigator !== "undefined" && navigator.geolocation) {
      if (geoWatch != null) navigator.geolocation.clearWatch(geoWatch);
      beginGeoWatch(driverId);
    }
  },

  async restoreLiveTrip() {
    const driverId = get().driverId;
    if (!driverId || get().busy || get().acceptingTripId) return;
    const revision = ++liveRevision;
    set({ restoringLiveTrip: true });
    try {
      const snapshot = await refreshDriverTripLive(driverId, get().acceptedOffer);
      if (revision === liveRevision && get().driverId === driverId) applySnapshot(snapshot);
    } catch (e) {
      if (get().driverId === driverId) set({ error: errorMessage(e) });
    } finally {
      if (revision === liveRevision && get().driverId === driverId) set({ restoringLiveTrip: false });
    }
  },

  async acceptLiveOffer(tripId) {
    const st = get();
    const driverId = st.driverId;
    if (!driverId || st.busy || st.restoringLiveTrip || st.acceptingTripId || liveTripLocked(st)) return false;
    if (!st.liveOffers.some((o) => o.tripId === tripId)) return false;
    const revision = ++liveRevision;
    set({ busy: true, acceptingTripId: tripId, error: null });
    try {
      const snapshot = await actionWithResync(
        async () => driverTripSnapshot(await acceptOfferLive(tripId, driverId), null),
        () => refreshDriverTripLive(driverId, null),
      );
      if (revision !== liveRevision || get().driverId !== driverId) return false;
      applySnapshot(snapshot);
      set({ liveOffers: get().liveOffers.filter((o) => o.tripId !== tripId) });
      return snapshot.offer?.tripId === tripId;
    } catch (e) {
      if (get().driverId === driverId) {
        set({ error: errorMessage(e) });
        toast.error("Couldn't refresh the trip", errorMessage(e));
      }
      return false;
    } finally {
      if (revision === liveRevision && get().driverId === driverId) set({ busy: false, acceptingTripId: null });
    }
  },

  advanceLiveTrip(action) {
    return changeLiveTrip((offer, driverId) => updateTripStatusLive(offer.tripId, driverId, action));
  },

  cancelLiveTrip() {
    if (!["Accepted", "Arrived"].includes(get().acceptedOffer?.status ?? "")) return Promise.resolve(false);
    return changeLiveTrip((offer, driverId) => cancelOfferLive(offer.tripId, driverId));
  },

  async declineLiveOffer(tripId) {
    const { driverId, busy, restoringLiveTrip } = get();
    if (!driverId || busy || restoringLiveTrip || liveTripLocked(get())) return;
    const revision = ++liveRevision;
    set({ busy: true, error: null });
    try {
      await actionWithResync(
        async () => {
          await declineOfferLive(tripId, driverId);
          if (revision === liveRevision && get().driverId === driverId)
            set({ liveOffers: get().liveOffers.filter((o) => o.tripId !== tripId) });
        },
        async () => {
          const snapshot = await refreshDriverTripLive(driverId, get().acceptedOffer);
          const offers = await getPendingOffersLive(driverId);
          if (revision === liveRevision && get().driverId === driverId) {
            applySnapshot(snapshot);
            set({ liveOffers: snapshot.offer ? [] : offers });
          }
        },
      );
    } catch (e) {
      if (get().driverId === driverId) {
        set({ error: errorMessage(e) });
        toast.error("Couldn't refresh ride requests", errorMessage(e));
      }
    } finally {
      if (revision === liveRevision && get().driverId === driverId) set({ busy: false });
    }
  },

  dismissAcceptedOffer() {
    if (get().busy || liveTripLocked(get())) return;
    liveRevision += 1;
    setAccepted(null);
    pushStatus();
  },

  async setOnline(online) {
    const driverId = get().driverId;
    if (!driverId || get().busy || get().restoringLiveTrip) return false;
    if (liveTripLocked(get())) {
      toast.info("You're on a trip", "You can go offline once this trip is finished.");
      return false;
    }
    set({ busy: true, error: null });
    liveRevision += 1;
    try {
      applySnapshot(await refreshDriverTripLive(driverId, get().acceptedOffer));
      if (liveTripLocked(get())) {
        set({ busy: false });
        return false;
      }
    } catch (e) {
      set({ busy: false, error: errorMessage(e) });
      toast.error("Couldn't refresh the trip", errorMessage(e));
      return false;
    }

    // Best-effort: mock-world bookkeeping, so seeded demo drivers keep their
    // existing offer/presence simulation working exactly as before. Real
    // drivers (signed in via Asgardeo) aren't seeded in the mock world, so
    // this rejects for them — that's fine, availability itself is persisted
    // below via the location service regardless of whether this succeeds.
    try {
      const driver = await api.drivers.setOnline(driverId, online);
      set({ driver, offer: online ? get().offer : null });
      if (IS_MOCK && online) {
        world().presenceOwner = driverId;
        world().heartbeatDriver(driverId);
      }
    } catch {
      /* ignore — see comment above */
    }

    set({ online });

    // Source of truth: push the new status to goride-location immediately
    // rather than waiting for the next GPS tick, using whatever position we
    // already have (or a fresh fix if we don't have one yet).
    let loc = get().location;
    const status = locationStatus(get());
    if (!loc) {
      try {
        const { pos } = await getCurrentPosition();
        loc = { driverId, ...pos, heading: 0, status, lastUpdated: new Date().toISOString() };
      } catch {
        loc = null;
      }
    }
    if (loc) {
      const updated = { ...loc, status };
      set({ location: updated });
      try {
        await api.location.updateDriverLocation(driverId, updated, updated.heading, status);
      } catch (e) {
        set({ busy: false });
        toast.error("Couldn't save availability", errorMessage(e));
        return false;
      }
    }

    set({ busy: false });
    toast[online ? "success" : "info"](online ? "You're online" : "You're offline", online ? "We'll send you nearby ride requests." : "You won't receive ride requests.");
    return true;
  },

  async accept() {
    const { offer, driver } = get();
    if (!offer || !driver) return false;
    set({ busy: true, error: null });
    try {
      const trip = await api.trips.accept(offer.tripId, driver.id);
      lastTripToast = `${trip.id}|${trip.status}`;
      set({ trip, offer: null, busy: false });
      toast.success("Ride accepted", `Head to ${trip.pickup.name}`);
      return true;
    } catch (e) {
      set({ busy: false, offer: null, error: errorMessage(e) });
      toast.error("Too late", errorMessage(e));
      return false;
    }
  },

  async decline() {
    const { offer, driver } = get();
    if (!offer || !driver) return;
    set({ offer: null });
    await api.trips.decline(offer.tripId, driver.id).catch(() => {});
  },

  async advance(action) {
    const t = get().trip;
    if (!t) return false;
    set({ busy: true, error: null });
    try {
      const trip = await api.trips.setDriverStatus(t.id, action);
      lastTripToast = `${trip.id}|${trip.status}|${trip.payment?.status}|${trip.payment?.method}`;
      set({ trip, busy: false });
      return true;
    } catch (e) {
      set({ busy: false, error: errorMessage(e) });
      return false;
    }
  },

  async cancel(reason) {
    const t = get().trip;
    if (!t) return false;
    set({ busy: true, error: null });
    try {
      await api.trips.cancel(t.id, "Driver", reason);
      set({ trip: null, busy: false });
      toast.info("Trip cancelled", "The rider is being re-matched automatically.");
      return true;
    } catch (e) {
      set({ busy: false, error: errorMessage(e) });
      toast.error("Couldn't cancel", errorMessage(e));
      return false;
    }
  },

  async rateRider(stars, comment) {
    const { trip, driver } = get();
    if (!trip || !driver) return;
    await api.trips.rate(trip.id, driver.id, stars, comment).catch(() => {});
  },

  async triggerSos() {
    const { trip, driver, location } = get();
    if (!trip || !driver) return;
    const pos = location ?? trip.pickup;
    try {
      await api.trips.triggerSos(trip.id, driver.id, { lat: pos.lat, lng: pos.lng });
      toast.error("SOS sent", "Admin has been alerted with your live location.");
    } catch (e) {
      toast.error("SOS failed", errorMessage(e));
    }
  },

  finishTrip() {
    set({ trip: null });
  },

  async refresh() {
    const d = get().driver;
    if (!d) return;
    const [driver, trip] = await Promise.all([api.drivers.get(d.id), api.trips.activeForDriver(d.id)]);
    set({ driver, online: driver.profile.online, trip: trip ?? get().trip });
  },
  };
});
