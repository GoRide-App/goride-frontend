"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, LocateFixed, MailWarning, Search, ShieldCheck, Users } from "lucide-react";
import type { LatLng, Place, VehicleType } from "@/types";
import { api } from "@/lib/api";
import { ROUTES, VEHICLE_IMAGES } from "@/lib/constants";
import { cn, formatLKR } from "@/lib/utils";
import { useCurrentUser } from "@/components/layout/role-guard";
import { MapOverlay, MapSplit, PanelBody } from "@/components/layout/map-split";
import { useSetShellHeader } from "@/components/layout/shell-header";
import { MapView } from "@/components/map";
import { Button, IconButton } from "@/components/ui/button";
import { listVariants } from "@/components/ui/motion";
import { Chip, ChipRow, ListRow, RouteStops, SectionTitle } from "@/components/ui/primitives";
import { useRideStore } from "@/store/ride-store";
import { PlaceRow, RECENT_PLACES } from "@/components/rider/location-search";
import { VehicleGlyph, isVehicleAvailable, useListItemVariants, vehicleDisplayName } from "@/components/rider/ride-bits";
import { getCurrentPosition, reverseGeocode } from "@/lib/geo/providers";

export default function RiderHomePage() {
  return (
    <React.Suspense fallback={<div className="map-grid h-full w-full" aria-busy="true" />}>
      <RiderHome />
    </React.Suspense>
  );
}

/** Tuk first (the ride you can book today), then the rest in rate-table order. */
function orderForHome(types: VehicleType[]) {
  return [...types].sort((a, b) => Number(isVehicleAvailable(b.code)) - Number(isVehicleAvailable(a.code)));
}

function RiderHome() {
  const user = useCurrentUser()!;
  const router = useRouter();

  const [pos, setPos] = React.useState<LatLng | null>(null);
  const [here, setHere] = React.useState<Place | null>(null);
  const [vehicleTypes, setVehicleTypes] = React.useState<VehicleType[]>([]);
  const itemVariants = useListItemVariants();

  const setDestination = useRideStore((s) => s.setDestination);
  const selectedVehicleTypeId = useRideStore((s) => s.selectedVehicleTypeId);
  const setSelectedVehicle = useRideStore((s) => s.setSelectedVehicle);

  const greeting = React.useMemo(() => {
    const h = new Date().getHours();
    return h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
  }, []);
  const firstName = user.name.split(" ")[0];

  useSetShellHeader({ title: "Book a ride" });

  const locate = React.useCallback(async () => {
    const { pos } = await getCurrentPosition();
    setPos({ ...pos });
    const place = await reverseGeocode(pos);
    setHere(place);
  }, []);

  React.useEffect(() => {
    let alive = true;
    getCurrentPosition().then(async ({ pos }) => {
      if (!alive) return;
      setPos(pos);
      const place = await reverseGeocode(pos);
      if (alive) setHere(place);
    });
    api.trips.vehicleTypes().then((types) => alive && setVehicleTypes(orderForHome(types))).catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const startRide = (destination?: Place) => {
    if (destination) setDestination(destination);
    router.push(ROUTES.rider.ride);
  };

  // The chip row mirrors the store's preferred ride; when nothing bookable is
  // preferred yet, the first bookable type stands in (that is where the fare
  // list lands anyway).
  const firstAvailable = vehicleTypes.find((v) => isVehicleAvailable(v.code)) ?? null;
  const preferred = vehicleTypes.find((v) => v.id === selectedVehicleTypeId && isVehicleAvailable(v.code)) ?? firstAvailable;
  const unavailableNames = vehicleTypes.filter((v) => !isVehicleAvailable(v.code)).map((v) => vehicleDisplayName(v));

  return (
    <MapSplit
      ariaLabel="Book a ride"
      // a taller resting sheet keeps the ride-type chips clear of the floating tab bar on phones
      peek={0.62}
      map={
        <>
          <MapView center={pos ?? undefined} zoom={15} user={pos} className="h-full w-full" />
          <MapOverlay className="bottom-4 right-4">
            <IconButton label="Recenter on my location" onClick={locate} className="shadow-float">
              <LocateFixed size={18} />
            </IconButton>
          </MapOverlay>
        </>
      }
    >
      <PanelBody>
        {!user.emailVerified && (
          <Link href={`${ROUTES.verify}?email=${encodeURIComponent(user.email)}`} className="mb-4 flex min-h-11 items-center gap-2.5 rounded-2xl bg-amber-50 px-3.5 py-2.5 text-[13px] font-semibold text-amber-800 transition-colors hover:bg-amber-100">
            <MailWarning size={16} className="shrink-0" />
            <span className="min-w-0 flex-1">Verify your email to request rides</span>
            <ArrowRight size={16} className="shrink-0" />
          </Link>
        )}

        <h2 className="text-[26px] font-semibold leading-tight tracking-[-0.02em] text-balance">
          Good {greeting}, {firstName}
        </h2>
        <p className="mt-1 text-[15px] text-muted">Where would you like to go?</p>

        <RouteStops
          className="mt-5"
          dashed
          items={[
            {
              label: "Pickup",
              value: here?.name ?? "Current location",
              right: (
                <IconButton label="Use my current location" variant="ghost" onClick={locate} className="-mr-2 text-brand-800">
                  <LocateFixed size={18} />
                </IconButton>
              ),
            },
            {
              label: "Where to?",
              placeholder: "Search a destination",
              onClick: () => startRide(),
              right: (
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-400 text-ink" aria-hidden>
                  <Search size={18} strokeWidth={2.5} />
                </span>
              ),
            },
          ]}
        />

        {vehicleTypes.length > 0 && (
          <>
            <SectionTitle className="mb-2.5 mt-7" action={<span className="font-medium">Fares shown before you book</span>}>
              Ride type
            </SectionTitle>
            <ChipRow>
              {vehicleTypes.map((vt) => {
                const available = isVehicleAvailable(vt.code);
                return (
                  <Chip key={vt.id} selected={preferred?.id === vt.id} disabled={!available} onClick={() => setSelectedVehicle(vt.id)} icon={<VehicleGlyph code={vt.code} />}>
                    {vehicleDisplayName(vt)}
                    {!available && <span className="sr-only">, not available yet</span>}
                  </Chip>
                );
              })}
            </ChipRow>

            {preferred && (
              <motion.div key={preferred.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }} className="mt-3 flex items-center gap-4 rounded-card bg-surface-2 p-4 ring-1 ring-line">
                <Image src={VEHICLE_IMAGES[preferred.code] ?? "/vehicles/car.png"} alt="" width={120} height={80} className="h-16 w-24 shrink-0 object-contain" />
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold leading-tight">{vehicleDisplayName(preferred)}</p>
                  <p className="mt-0.5 text-[13px] leading-snug text-muted text-pretty">{preferred.description}</p>
                  <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] font-medium tabular-nums">
                    <span className="inline-flex items-center gap-1 text-muted">
                      <Users size={13} /> Up to {preferred.capacity}
                    </span>
                    <span>From {formatLKR(preferred.baseFare)}</span>
                    <span className="font-normal text-muted">{formatLKR(preferred.ratePerKm)}/km</span>
                  </p>
                </div>
                <Button
                  size="sm"
                  full={false}
                  arrow
                  onClick={() => {
                    setSelectedVehicle(preferred.id);
                    startRide();
                  }}
                >
                  Book now
                </Button>
              </motion.div>
            )}
            {unavailableNames.length > 0 && (
              <p className="mt-2.5 text-xs leading-snug text-muted text-pretty">
                {unavailableNames.length > 1 ? `${unavailableNames.slice(0, -1).join(", ")} and ${unavailableNames[unavailableNames.length - 1]} aren't` : `${unavailableNames[0]} isn't`} available yet.
              </p>
            )}
          </>
        )}

        <SectionTitle className="mb-1 mt-7">Recent destinations</SectionTitle>
        <motion.ul variants={listVariants} initial="hidden" animate="show" className={cn("flex flex-col")} aria-label="Recent destinations">
          {RECENT_PLACES.map((p) => (
            <motion.li key={p.name} variants={itemVariants}>
              <PlaceRow place={p} onPick={startRide} />
            </motion.li>
          ))}
        </motion.ul>

        <ListRow
          className="mt-5 bg-ink text-white hover:bg-navy-800 active:bg-navy-950 [&_span.text-muted]:text-white/60"
          icon={<ShieldCheck />}
          iconTone="brand"
          title={<span className="text-white">Safety on every trip</span>}
          description={<span className="text-white/65">SOS and your emergency contacts are one tap away during a ride</span>}
          href={ROUTES.rider.profile}
          right={<ArrowRight size={18} className="shrink-0 text-brand-300" />}
        />
      </PanelBody>
    </MapSplit>
  );
}
