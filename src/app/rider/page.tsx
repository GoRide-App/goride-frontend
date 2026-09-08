"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, ChevronRight, Clock, LocateFixed, MailWarning, Search } from "lucide-react";
import type { DriverLocation, LatLng, Place, Trip } from "@/types";
import { api, IS_MOCK } from "@/lib/api";
import { getCurrentPosition } from "@/lib/geo/providers";
import { ROUTES, TRIP_STATUS_META, VEHICLE_IMAGES } from "@/lib/constants";
import { cn, splitAddress } from "@/lib/utils";
import { world } from "@/lib/mock/world";
import { useCurrentUser } from "@/components/layout/role-guard";
import { InboxSheet } from "@/components/layout/inbox-sheet";
import { MapOverlay, MapSplit, PanelBody } from "@/components/layout/map-split";
import { useSetShellHeader } from "@/components/layout/shell-header";
import { MapView, type MapVehicle } from "@/components/map";
import { Badge } from "@/components/ui/primitives";
import { useRideStore } from "@/store/ride-store";
import { RECENT_PLACES } from "@/components/rider/location-search";

export default function RiderHomePage() {
  return (
    <React.Suspense fallback={<div className="map-grid h-full w-full" aria-busy="true" />}>
      <RiderHome />
    </React.Suspense>
  );
}

function RiderHome() {
  const user = useCurrentUser()!;
  const router = useRouter();
  const search = useSearchParams();
  const inboxOpen = search.get("inbox") === "1";

  const [pos, setPos] = React.useState<LatLng | null>(null);
  const [nearby, setNearby] = React.useState<DriverLocation[]>([]);
  const [active, setActive] = React.useState<Trip | null>(null);
  const [recents, setRecents] = React.useState<Place[]>(RECENT_PLACES);

  const setPickup = useRideStore((s) => s.setPickup);
  const setDestination = useRideStore((s) => s.setDestination);
  const setUiPhase = useRideStore((s) => s.setUiPhase);

  const greeting = React.useMemo(() => {
    const h = new Date().getHours();
    return h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
  }, []);

  useSetShellHeader({ title: "Book a ride", description: `Good ${greeting}, ${user.name.split(" ")[0]} 👋` });

  React.useEffect(() => {
    let alive = true;
    getCurrentPosition().then(({ pos }) => alive && setPos(pos));
    api.trips.activeForRider(user.id).then((t) => alive && setActive(t)).catch(() => {});
    api.trips
      .list({ riderId: user.id, limit: 6 })
      .then((trips) => {
        if (!alive) return;
        const seen = new Set<string>();
        const places: Place[] = [];
        for (const t of trips) {
          if (!seen.has(t.destination.name)) {
            seen.add(t.destination.name);
            places.push(t.destination);
          }
        }
        if (places.length) setRecents(places.slice(0, 3));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [user.id]);

  React.useEffect(() => {
    if (!pos) return;
    let alive = true;
    const load = () =>
      api.location
        .nearbyDrivers(pos, undefined, 5)
        .then((d) => alive && setNearby(d))
        .catch(() => {});
    load();
    const id = setInterval(load, 3000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [pos]);

  const vehicles: MapVehicle[] = React.useMemo(() => {
    const s = IS_MOCK ? world().get() : null;
    return nearby.map((n) => ({
      id: n.driverId,
      pos: n,
      heading: n.heading,
      code: s?.drivers.find((d) => d.id === n.driverId)?.profile.vehicleTypeCode ?? "CAR",
      dim: true,
    }));
  }, [nearby]);

  const startRide = (destination?: Place) => {
    setUiPhase("plan");
    if (destination) setDestination(destination);
    if (pos && !useRideStore.getState().pickup) {
      // The ride page reverse-geocodes; seed a provisional pickup for instant feedback
      setPickup({ name: "Current location", address: "Locating…", lat: pos.lat, lng: pos.lng });
    }
    router.push(ROUTES.rider.ride);
  };

  return (
    <MapSplit
      map={
        <>
          <MapView center={pos ?? undefined} zoom={15} user={pos} vehicles={vehicles} className="h-full w-full" />
          <MapOverlay className="bottom-4 right-4">
            <button
              type="button"
              aria-label="Recenter"
              onClick={() => getCurrentPosition().then(({ pos }) => setPos({ ...pos }))}
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-ink shadow-float transition hover:bg-surface-2"
            >
              <LocateFixed size={18} />
            </button>
          </MapOverlay>
          <MapOverlay className="left-4 top-4">
            <span className="rounded-lg bg-white/90 px-3 py-1.5 text-[11px] font-semibold shadow-card backdrop-blur">
              {nearby.length} {nearby.length === 1 ? "driver" : "drivers"} nearby
            </span>
          </MapOverlay>
        </>
      }
    >
      <PanelBody>
        {!user.emailVerified && (
          <Link
            href={`${ROUTES.verify}?email=${encodeURIComponent(user.email)}`}
            className="mb-4 flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-xs font-semibold text-amber-800 hover:bg-amber-100"
          >
            <MailWarning size={16} /> Verify your email to request rides
            <ArrowRight size={14} className="ml-auto" />
          </Link>
        )}

        {active && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-4">
            <Link href={ROUTES.rider.ride} className="flex items-center gap-3 rounded-xl bg-ink p-3 text-white shadow-float">
              {active.driver ? (
                <Image src={VEHICLE_IMAGES[active.driver.vehicleTypeCode]} alt="" width={64} height={40} className="h-9 w-14 object-contain" />
              ) : (
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10">
                  <Search size={16} />
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{TRIP_STATUS_META[active.status].riderHeadline}</span>
                <span className="block truncate text-[11px] text-white/70">
                  {active.pickup.name} → {active.destination.name}
                </span>
              </span>
              <Badge tone="brand" dot>
                Live
              </Badge>
              <ChevronRight size={18} className="text-white/60" />
            </Link>
          </motion.div>
        )}

        <h2 className="text-2xl font-semibold leading-tight tracking-tight">Where to?</h2>
        <button
          type="button"
          onClick={() => startRide()}
          className="mt-4 flex h-14 w-full items-center gap-3 rounded-xl bg-surface-2 px-4 text-left text-sm text-zinc-500 transition hover:bg-surface-3"
        >
          <Search size={18} className="text-ink" />
          <span className="flex-1 font-medium">Search destination</span>
          <span className="rounded-md bg-white px-2 py-1 text-[10px] font-semibold text-ink shadow-card">Now</span>
        </button>

        <p className="mb-1 mt-6 text-[11px] font-semibold uppercase tracking-wide text-muted">Recent destinations</p>
        <ul>
          {recents.map((p, i) => {
            const { secondary } = splitAddress(p.address);
            return (
              <li key={p.name}>
                <button
                  type="button"
                  onClick={() => startRide(p)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-2 py-3 text-left transition hover:bg-surface-2",
                    i < recents.length - 1 && "border-b border-zinc-100",
                  )}
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-2">
                    <Clock size={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{p.name}</span>
                    <span className="block truncate text-xs font-normal text-muted">{secondary || p.address}</span>
                  </span>
                  <ChevronRight size={16} className="text-zinc-400" />
                </button>
              </li>
            );
          })}
        </ul>
      </PanelBody>

      <InboxSheet open={inboxOpen} onClose={() => router.replace(ROUTES.rider.home)} userId={user.id} />
    </MapSplit>
  );
}
