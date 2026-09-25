"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Clock, LocateFixed, MapPin, MapPinned, X } from "lucide-react";
import type { LatLng } from "@/types";
import type { LiveDriverOffer } from "@/lib/api/live-matching";
import { AppShell } from "@/components/layout/app-shell";
import { RoleGuard, useCurrentUser } from "@/components/layout/role-guard";
import { MapSplit, PanelBody } from "@/components/layout/map-split";
import { useSetShellHeader } from "@/components/layout/shell-header";
import { MapView } from "@/components/map";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/field";
import { Card } from "@/components/ui/primitives";
import { Spinner } from "@/components/ui/spinner";
import { useDriverStore } from "@/store/driver-store";
import { reverseGeocode } from "@/lib/geo/providers";

export default function DriverHomePage() {
    return (
        <RoleGuard role="Driver">
            <DriverHomeFrame />
        </RoleGuard>
    );
}

function DriverHomeFrame() {
    const user = useCurrentUser()!;
    return (
        <AppShell user={user} variant="split">
            <DriverMap driverId={user.id} name={user.name} />
        </AppShell>
    );
}

/** Re-renders every `ms` so countdowns tick. */
function useNow(ms: number) {
    const [now, setNow] = React.useState(() => Date.now());
    React.useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), ms);
        return () => clearInterval(timer);
    }, [ms]);
    return now;
}

function money(n?: number | null) {
    return n == null ? null : `Rs ${n.toLocaleString()}`;
}

/** Statuses that mean "this driver has an accepted trip on their hands right now". */
const ACTIVE_OFFER_STATUSES = ["Accepted", "Arrived", "InProgress", "Completed"];

const ACTIVE_TRIP_LABEL: Record<string, string> = {
    Accepted: "Head to the pickup point",
    Arrived: "Waiting at pickup",
    InProgress: "Trip in progress",
};

/**
 * The trip this driver is currently on, with manual controls to mark arrival, start, and
 * complete it. Backed entirely by the real trip-matching service (not the local mock trip),
 * since the rider is very likely on a different device that has no way to share local state.
 */
function ActiveTrip({ offer }: { offer: LiveDriverOffer }) {
    const busy = useDriverStore((s) => s.busy);
    const error = useDriverStore((s) => s.error);

    const done = offer.status === "Completed";

    return (
        <Card className="mt-4 border-driver-200 bg-driver-50/50">
            <div className="flex items-start gap-3">
                <CheckCircle2 size={22} className="mt-0.5 shrink-0 text-driver-600" />
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{done ? "Trip completed" : (ACTIVE_TRIP_LABEL[offer.status] ?? "Ride accepted")}</p>
                    <p className="mt-2 flex items-center gap-1.5 text-sm font-medium">
                        <MapPin size={14} className="shrink-0" /> {offer.pickupLocation ?? "Pickup"}
                    </p>
                    <p className="mt-0.5 pl-5 text-xs text-muted">to {offer.dropoffLocation ?? "destination"}</p>
                    {money(offer.fare) && <p className="mt-2 text-sm font-semibold">{money(offer.fare)}</p>}
                </div>
            </div>

            {offer.status === "Accepted" && (
                <Button className="mt-3" variant="driver" onClick={() => useDriverStore.getState().advanceLiveTrip("Arrived")} loading={busy}>
                    I&apos;ve arrived
                </Button>
            )}

            {offer.status === "Arrived" && (
                <Button className="mt-3" variant="driver" onClick={() => useDriverStore.getState().advanceLiveTrip("InProgress")} loading={busy}>
                    Start trip
                </Button>
            )}

            {offer.status === "InProgress" && (
                <Button className="mt-3" variant="driver" onClick={() => useDriverStore.getState().advanceLiveTrip("Completed")} loading={busy}>
                    Complete trip
                </Button>
            )}

            {done && (
                <>
                    <p className="mt-3 text-xs text-muted">Fare {money(offer.fare) ?? "pending"} — awaiting rider payment.</p>
                    <Button className="mt-3" size="sm" variant="secondary" onClick={() => useDriverStore.getState().dismissAcceptedOffer()}>
                        Done
                    </Button>
                </>
            )}
            {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        </Card>
    );
}

/** Ride requests the real matching service has offered this driver, plus the ride they're currently on. */
function RideRequests({ online }: { online: boolean }) {
    const offers = useDriverStore((s) => s.liveOffers);
    const accepted = useDriverStore((s) => s.acceptedOffer);
    const acceptingTripId = useDriverStore((s) => s.acceptingTripId);
    const now = useNow(1000);

    if (accepted && ACTIVE_OFFER_STATUSES.includes(accepted.status)) {
        return <ActiveTrip offer={accepted} />;
    }

    if (!online) return null;

    const open = offers.filter((o) => new Date(o.expiresAt).getTime() > now);

    if (open.length === 0) {
        return <p className="mt-4 text-center text-xs text-muted">Waiting for ride requests near you…</p>;
    }

    return (
        <div className="mt-4 flex flex-col gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Ride requests</p>
            {open.map((o) => {
                const secondsLeft = Math.max(0, Math.ceil((new Date(o.expiresAt).getTime() - now) / 1000));
                return (
                    <Card key={o.tripId} className="border-driver-200">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <p className="flex items-center gap-1.5 text-sm font-semibold">
                                    <MapPin size={14} className="shrink-0 text-driver-600" /> <span className="truncate">{o.pickupLocation ?? "Pickup"}</span>
                                </p>
                                <p className="mt-0.5 truncate pl-5 text-xs text-muted">to {o.dropoffLocation ?? "destination"}</p>
                            </div>
                            <span className="flex shrink-0 items-center gap-1 rounded-md bg-driver-50 px-2 py-1 text-xs font-semibold text-driver-700">
                                <Clock size={12} /> {secondsLeft}s
                            </span>
                        </div>
                        <p className="mt-2 text-xs text-muted">
                            {o.distanceKm.toFixed(1)} km from you{money(o.fare) ? ` · ${money(o.fare)}` : ""}
                        </p>
                        <Button
                            className="mt-3"
                            variant="driver"
                            onClick={() => useDriverStore.getState().acceptLiveOffer(o.tripId)}
                            loading={acceptingTripId === o.tripId}
                            disabled={acceptingTripId !== null}
                        >
                            Accept ride
                        </Button>
                    </Card>
                );
            })}
        </div>
    );
}

function DriverMap({ driverId, name }: { driverId: string; name: string }) {
    const online = useDriverStore((s) => s.online);
    const location = useDriverStore((s) => s.location);
    const manualLocation = useDriverStore((s) => s.manualLocation);
    const busy = useDriverStore((s) => s.busy);
    const acceptedOffer = useDriverStore((s) => s.acceptedOffer);

    const activeOffer = acceptedOffer && ACTIVE_OFFER_STATUSES.includes(acceptedOffer.status) ? acceptedOffer : null;
    const activePickupLat = activeOffer?.pickupLat;
    const activePickupLng = activeOffer?.pickupLng;
    const activeDropoffLat = activeOffer?.dropoffLat;
    const activeDropoffLng = activeOffer?.dropoffLng;
    const activePickup = React.useMemo<LatLng | null>(
        () => (activePickupLat != null && activePickupLng != null ? { lat: activePickupLat, lng: activePickupLng } : null),
        [activePickupLat, activePickupLng],
    );
    const activeDestination = React.useMemo<LatLng | null>(
        () => (activeDropoffLat != null && activeDropoffLng != null ? { lat: activeDropoffLat, lng: activeDropoffLng } : null),
        [activeDropoffLat, activeDropoffLng],
    );

    const [locating, setLocating] = React.useState(false);
    const [pinDrop, setPinDrop] = React.useState(false);
    const [pinPos, setPinPos] = React.useState<LatLng | null>(null);
    const [pinLabel, setPinLabel] = React.useState("");
    const [resolvingPin, setResolvingPin] = React.useState(false);
    const [confirmingPin, setConfirmingPin] = React.useState(false);
    const [addressLabel, setAddressLabel] = React.useState<string | null>(null);
    const [addressResolving, setAddressResolving] = React.useState(false);

    useSetShellHeader({
        title: online ? "You're online" : "You're offline",
        description: online ? "Nearby riders can be matched to you" : `Good to see you, ${name.split(" ")[0]}`,
    });

    React.useEffect(() => {
        const store = useDriverStore.getState();
        store.load(driverId);
        store.start(driverId);
        if (!store.location) store.recenterGps();
        return () => store.stop();
    }, [driverId]);

    const locKey = location ? `${location.lat.toFixed(4)},${location.lng.toFixed(4)}` : null;
    React.useEffect(() => {
        if (!location || pinDrop) return;
        let alive = true;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setAddressResolving(true);
        reverseGeocode(location)
            .then((place) => {
                if (alive) setAddressLabel(place.name);
            })
            .catch(() => {})
            .finally(() => {
                if (alive) setAddressResolving(false);
            });
        return () => {
            alive = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [locKey, pinDrop]);

    const handleLocateMe = async () => {
        setLocating(true);
        try {
            await useDriverStore.getState().recenterGps();
        } finally {
            setLocating(false);
        }
    };

    const startPinDrop = () => {
        setPinPos(location ?? null);
        setPinLabel("");
        setPinDrop(true);
    };

    const handlePinMove = async (pos: LatLng) => {
        setPinPos(pos);
        setResolvingPin(true);
        try {
            const place = await reverseGeocode(pos);
            setPinLabel(place.name);
        } finally {
            setResolvingPin(false);
        }
    };

    const confirmPin = async () => {
        if (!pinPos) return;
        setConfirmingPin(true);
        try {
            await useDriverStore.getState().setManualLocation(pinPos);
            setPinDrop(false);
        } finally {
            setConfirmingPin(false);
        }
    };

    // While on a trip, fit the map to the driver and wherever they're headed next
    // (the pickup, or the destination once the trip has actually started).
    const fitTo = React.useMemo<LatLng[] | undefined>(() => {
        if (pinDrop || !activeOffer) return undefined;
        const target = activeOffer.status === "InProgress" ? activeDestination : activePickup;
        if (!target) return undefined;
        return location ? [location, target] : [target];
    }, [pinDrop, activeOffer, activePickup, activeDestination, location]);

    return (
        <MapSplit
            map={
                <MapView
                    center={pinDrop || activeOffer ? undefined : location ?? undefined}
                    zoom={15}
                    fitTo={fitTo}
                    user={pinDrop ? null : location}
                    pickup={pinDrop ? null : activePickup}
                    destination={pinDrop ? null : activeDestination}
                    pinDrop={pinDrop}
                    pinLabel="Set as my location"
                    onPinMoveStart={() => setResolvingPin(true)}
                    onPinMove={handlePinMove}
                    className="h-full w-full"
                />
            }
        >
            {pinDrop ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex min-h-0 flex-1 flex-col">
                    <div className="mx-auto flex w-full max-w-[620px] items-center gap-2 border-b border-zinc-200/80 px-5 py-3.5">
                        <MapPinned size={18} className="shrink-0 text-driver-600" />
                        <p className="min-w-0 flex-1 text-xs font-semibold">Drag the map to place your location pin</p>
                        <button type="button" onClick={() => setPinDrop(false)} aria-label="Cancel" className="rounded-lg p-1.5 hover:bg-surface-2">
                            <X size={16} />
                        </button>
                    </div>
                    <div className="mx-auto flex w-full max-w-[620px] flex-1 flex-col justify-center px-5 py-6">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Your location</p>
                        <p className="mt-1 flex items-center gap-2 text-lg font-semibold leading-snug">
                            {resolvingPin && <Spinner className="h-4 w-4 shrink-0 text-driver-600" />} {pinLabel || "Locating…"}
                        </p>
                        <Button className="mt-5" size="lg" variant="driver" onClick={confirmPin} disabled={resolvingPin || confirmingPin} loading={confirmingPin}>
                            Confirm location
                        </Button>
                    </div>
                </motion.div>
            ) : (
                <PanelBody>
                    <h2 className="text-2xl font-semibold leading-tight tracking-tight">Hi, {name.split(" ")[0]}</h2>

                    <Card className="mt-4">
                        <Toggle
                            checked={online}
                            onChange={(v) => useDriverStore.getState().setOnline(v)}
                            disabled={busy}
                            tone="driver"
                            size="lg"
                            label="Available"
                            description={online ? "You'll receive nearby ride requests" : "Turn on to start receiving ride requests"}
                        />
                    </Card>

                    <RideRequests online={online} />

                    <div className="mt-5 flex flex-col gap-3">
                        <Button variant="secondary" leftIcon={<LocateFixed size={18} />} onClick={handleLocateMe} loading={locating} loadingText="Locating…">
                            Locate me
                        </Button>

                        <div className="rounded-xl bg-surface-2 p-3">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{manualLocation ? "Pinned location" : "Current location"}</p>
                            <p className="mt-1 text-sm font-medium leading-snug">
                                {addressResolving ? "Locating…" : addressLabel ?? (location ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` : "Unknown")}
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={startPinDrop}
                            className="flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-semibold text-muted transition hover:bg-surface-2 hover:text-ink"
                        >
                            <MapPinned size={14} /> Set my location on the map
                        </button>
                    </div>
                </PanelBody>
            )}
        </MapSplit>
    );
}
