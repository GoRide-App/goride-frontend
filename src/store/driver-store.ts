"use client";

import { create } from "zustand";
import type { Driver, DriverLocation, DriverOffer, LatLng, Trip } from "@/types";
import { api, IS_MOCK, errorMessage, type DriverTripAction } from "@/lib/api";
import { world } from "@/lib/mock/world";
import { bearing } from "@/lib/utils";
import { getCurrentPosition } from "@/lib/geo/providers";
import { acceptOfferLive, getPendingOffersLive, updateTripStatusLive, LiveMatchingError, type LiveDriverOffer, type TripStatusAction } from "@/lib/api/live-matching";
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
  /** The ride request this driver most recently accepted. */
  acceptedOffer: LiveDriverOffer | null;
  /** Trip id of the accept call in flight, if any. */
  acceptingTripId: string | null;
  busy: boolean;
  error: string | null;

  load: (driverId: string) => Promise<void>;
  start: (driverId: string) => void;
  stop: () => void;
  setOnline: (online: boolean) => Promise<boolean>;
  /** Pin the driver's current location by hand (e.g. dragging the map pin); persists it and stops the GPS watch from overriding it. */
  setManualLocation: (pos: LatLng) => Promise<void>;
  /** Resume tracking from the device's real GPS position. */
  recenterGps: () => Promise<void>;
  /** Accept a ride request from the real matching service. Resolves true if this driver got the ride. */
  acceptLiveOffer: (tripId: string) => Promise<boolean>;
  /** Advance the accepted trip one stage (Arrived / InProgress / Completed). Resolves true on success. */
  advanceLiveTrip: (action: TripStatusAction) => Promise<boolean>;
  dismissAcceptedOffer: () => void;
  accept: () => Promise<boolean>;
  decline: () => Promise<void>;
  advance: (action: DriverTripAction) => Promise<boolean>;
  cancel: (reason: string) => Promise<boolean>;
  confirmCash: () => Promise<boolean>;
  rateRider: (stars: number, comment?: string) => Promise<void>;
  triggerSos: () => Promise<void>;
  finishTrip: () => void;
  refresh: () => Promise<void>;
}

let unsub: (() => void) | null = null;
let heartbeat: ReturnType<typeof setInterval> | null = null;
let locPoll: ReturnType<typeof setInterval> | null = null;
let offerPoll: ReturnType<typeof setInterval> | null = null;
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
        const status = st.trip ? "OnTrip" : st.online ? "Online" : "Offline";
        set({ location: { driverId, ...pos, heading, status, lastUpdated: new Date().toISOString() }, manualLocation: false });
        if (st.online) api.location.updateDriverLocation(driverId, pos, heading, status).catch(() => {});
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000 },
    );
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
  error: null,

  async load(driverId) {
    set({ loading: true, driverId });
    try {
      const [driver, trip, offer, location] = await Promise.all([api.drivers.get(driverId), api.trips.activeForDriver(driverId), api.trips.currentOffer(driverId), api.location.getDriverLocation(driverId)]);
      set({ driver, online: driver.profile.online, trip, offer, location, loading: false });
      if (trip) lastTripToast = `${trip.id}|${trip.status}`;
    } catch (e) {
      set({ loading: false, error: errorMessage(e) });
    }
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
            if (t.payment?.method === "Cash" && t.payment.status === "AwaitingCash" && prev?.payment?.status !== "AwaitingCash") toast.notify("Rider is paying cash", `Collect Rs ${t.payment.finalFare.toLocaleString()} and confirm.`);
            if (t.payment?.status === "Paid" && prev?.payment?.status !== "Paid") toast.success(t.payment.method === "Card" ? "Card payment received" : "Cash confirmed", `Rs ${t.payment.finalFare.toLocaleString()} credited`);
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
    // so re-send the current position periodically while online.
    locHeartbeat = setInterval(() => {
      const st = get();
      if (!st.online || !st.location || !st.driverId) return;
      const status: DriverLocation["status"] = st.trip ? "OnTrip" : "Online";
      api.location.updateDriverLocation(st.driverId, st.location, st.location.heading, status).catch(() => {});
    }, 30_000);

    // Ride requests from the real matching service. Only an online driver is offered rides.
    offerPoll = setInterval(async () => {
      const st = get();
      if (!st.driverId) return;
      if (!st.online) {
        if (st.liveOffers.length > 0) set({ liveOffers: [] });
        return;
      }
      try {
        set({ liveOffers: await getPendingOffersLive(st.driverId) });
      } catch {
        /* service unreachable — keep whatever we last saw and try again */
      }
    }, 2000);

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
    if (offerPoll) clearInterval(offerPoll);
    if (locHeartbeat) clearInterval(locHeartbeat);
    if (geoWatch != null && typeof navigator !== "undefined") navigator.geolocation.clearWatch(geoWatch);
    heartbeat = locPoll = offerPoll = locHeartbeat = null;
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
    const st = get();
    const status: DriverLocation["status"] = st.trip ? "OnTrip" : st.online ? "Online" : "Offline";
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
    const st = get();
    const status: DriverLocation["status"] = st.trip ? "OnTrip" : st.online ? "Online" : "Offline";
    set({ location: { driverId, ...pos, heading: 0, status, lastUpdated: new Date().toISOString() }, manualLocation: false });
    api.location.updateDriverLocation(driverId, pos, 0, status).catch(() => {});
    if (!IS_MOCK && typeof navigator !== "undefined" && navigator.geolocation) {
      if (geoWatch != null) navigator.geolocation.clearWatch(geoWatch);
      beginGeoWatch(driverId);
    }
  },

  async acceptLiveOffer(tripId) {
    const driverId = get().driverId;
    if (!driverId || get().acceptingTripId) return false;
    set({ acceptingTripId: tripId });
    try {
      const offer = await acceptOfferLive(tripId, driverId);
      set({ acceptedOffer: offer, liveOffers: get().liveOffers.filter((o) => o.tripId !== tripId), acceptingTripId: null });
      toast.success("Ride accepted", `Head to ${offer.pickupLocation ?? "the pickup point"}`);
      return true;
    } catch (e) {
      // 404/409 mean this offer is gone (expired or already decided) — drop it from the list.
      const gone = e instanceof LiveMatchingError && (e.status === 404 || e.status === 409);
      set({ acceptingTripId: null, liveOffers: gone ? get().liveOffers.filter((o) => o.tripId !== tripId) : get().liveOffers });
      toast.error(gone ? "Too late" : "Couldn't accept the ride", errorMessage(e));
      return false;
    }
  },

  async advanceLiveTrip(action) {
    const offer = get().acceptedOffer;
    const driverId = get().driverId;
    if (!offer || !driverId) return false;
    set({ busy: true, error: null });
    try {
      const updated = await updateTripStatusLive(offer.tripId, driverId, action);
      set({ acceptedOffer: updated, busy: false });
      return true;
    } catch (e) {
      set({ busy: false, error: errorMessage(e) });
      toast.error("Couldn't update the trip", errorMessage(e));
      return false;
    }
  },

  dismissAcceptedOffer() {
    set({ acceptedOffer: null });
  },

  async setOnline(online) {
    const driverId = get().driverId;
    if (!driverId) return false;
    set({ busy: true, error: null });

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

    set({ online, busy: false });

    // Source of truth: push the new status to goride-location immediately
    // rather than waiting for the next GPS tick, using whatever position we
    // already have (or a fresh fix if we don't have one yet).
    let loc = get().location;
    const status: DriverLocation["status"] = get().trip ? "OnTrip" : online ? "Online" : "Offline";
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
        toast.error("Couldn't save availability", errorMessage(e));
        return false;
      }
    }

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

  async confirmCash() {
    const t = get().trip;
    if (!t) return false;
    set({ busy: true, error: null });
    try {
      const payment = await api.payments.confirmCash(t.id);
      set({ trip: { ...t, payment, status: "PAID" }, busy: false });
      return true;
    } catch (e) {
      set({ busy: false, error: errorMessage(e) });
      toast.error("Couldn't confirm cash", errorMessage(e));
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
