"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, MapPinned, X } from "lucide-react";
import type { LatLng } from "@/types";
import type { LiveDriverOffer } from "@/lib/api/live-matching";
import { AppShell } from "@/components/layout/app-shell";
import { RoleGuard, useCurrentUser } from "@/components/layout/role-guard";
import { MapSplit, PanelBody, PanelFooter, PanelHeader } from "@/components/layout/map-split";
import { useSetShellHeader } from "@/components/layout/shell-header";
import { MapView } from "@/components/map";
import { Button, IconButton } from "@/components/ui/button";
import { fadeOnly, fades, itemVariants, listVariants } from "@/components/ui/motion";
import { Spinner } from "@/components/ui/spinner";
import { useIsMobile } from "@/components/ui/use-media";
import { ACTIVE_OFFER_STATUSES, ActiveTripAction, ActiveTripCard } from "@/components/driver/active-trip-card";
import { GoOnlineCard } from "@/components/driver/go-online-card";
import { LocationCard } from "@/components/driver/location-card";
import { ListeningCard, OfferCard, money } from "@/components/driver/offer-card";
import { liveTripLocked, useDriverStore } from "@/store/driver-store";
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

/** Re-renders every `ms` so countdowns tick; idle while `enabled` is false. */
function useNow(ms: number, enabled = true) {
    const [now, setNow] = React.useState(() => Date.now());
    React.useEffect(() => {
        if (!enabled) return;
        const timer = setInterval(() => setNow(Date.now()), ms);
        return () => clearInterval(timer);
    }, [ms, enabled]);
    return now;
}

/**
 * Ride requests the real matching service has offered this driver (polled by the
 * store while online). "Not now" only hides a request on this screen; the service
 * has no decline call, so the offer simply expires on its own.
 */
function RideRequests({ offers, now, near, onDismiss, acceptInFooter }: { offers: LiveDriverOffer[]; now: number; near: string | null; onDismiss: (tripId: string) => void; acceptInFooter: boolean }) {
    const acceptingTripId = useDriverStore((s) => s.acceptingTripId);

    return (
        <div className="flex flex-col gap-3" aria-live="polite">
            <AnimatePresence initial={false}>
                {offers.length === 0 ? (
                    <motion.div key="listening" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: fades.exit }} transition={fades.normal}>
                        <ListeningCard near={near} />
                    </motion.div>
                ) : (
                    offers.map((o) => {
                        const secondsLeft = Math.max(0, Math.ceil((new Date(o.expiresAt).getTime() - now) / 1000));
                        return (
                            <OfferCard
                                key={o.tripId}
                                offer={o}
                                secondsLeft={secondsLeft}
                                accepting={acceptingTripId === o.tripId}
                                disabled={acceptingTripId !== null}
                                onAccept={() => useDriverStore.getState().acceptLiveOffer(o.tripId)}
                                onDismiss={() => onDismiss(o.tripId)}
                                acceptInFooter={acceptInFooter}
                            />
                        );
                    })
                )}
            </AnimatePresence>
        </div>
    );
}

function DriverMap({ driverId, name }: { driverId: string; name: string }) {
    const online = useDriverStore((s) => s.online);
    const location = useDriverStore((s) => s.location);
    const manualLocation = useDriverStore((s) => s.manualLocation);
    const busy = useDriverStore((s) => s.busy);
    const error = useDriverStore((s) => s.error);
    const driver = useDriverStore((s) => s.driver);
    const acceptedOffer = useDriverStore((s) => s.acceptedOffer);
    const liveOffers = useDriverStore((s) => s.liveOffers);
    const acceptingTripId = useDriverStore((s) => s.acceptingTripId);
    // While a live trip is underway the toggle and new offers wait (see liveTripLocked).
    const locked = liveTripLocked({ acceptedOffer });
    const mobile = useIsMobile();
    const reduce = useReducedMotion();
    const item = reduce ? fadeOnly : itemVariants;
    const firstName = name.split(" ")[0];

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

    // Open offers: not yet expired and not hidden with "Not now". Ticks only while there is something to count down.
    const now = useNow(1000, online && liveOffers.length > 0);
    const [dismissed, setDismissed] = React.useState<string[]>([]);
    const openOffers = React.useMemo(
        () => (online ? liveOffers.filter((o) => new Date(o.expiresAt).getTime() > now && !dismissed.includes(o.tripId)) : []),
        [online, liveOffers, now, dismissed],
    );
    const dismissOffer = React.useCallback((tripId: string) => setDismissed((d) => [...d, tripId]), []);

    const [locating, setLocating] = React.useState(false);
    const [pinDrop, setPinDrop] = React.useState(false);
    const [pinPos, setPinPos] = React.useState<LatLng | null>(null);
    const [pinLabel, setPinLabel] = React.useState("");
    const [resolvingPin, setResolvingPin] = React.useState(false);
    const [confirmingPin, setConfirmingPin] = React.useState(false);
    const [addressLabel, setAddressLabel] = React.useState<string | null>(null);
    const [addressResolving, setAddressResolving] = React.useState(false);

    useSetShellHeader({
        title: locked ? "You're on a trip" : online ? "You're online" : "You're offline",
        description: locked ? "New requests pause until this trip is done" : online ? "Nearby riders can be matched to you" : `Good to see you, ${firstName}`,
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

    const vehicle = driver?.profile ? { make: driver.profile.vehicleMake, model: driver.profile.vehicleModel, plate: driver.profile.vehiclePlate } : null;
    const addressText = addressResolving ? "Locating…" : addressLabel ?? (location ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` : "Location not available yet");
    const setOnline = (v: boolean) => useDriverStore.getState().setOnline(v);
    // The big availability card steps aside as soon as there is a request or a trip to act on,
    // so the thing that matters is at the top of the sheet even at its resting height.
    const compactOnline = !!activeOffer || openOffers.length > 0;
    // Phones: the first open request's Accept is pinned in the footer so it never hides under the tab bar.
    const footerOffer = mobile && !activeOffer ? (openOffers[0] ?? null) : null;

    return (
        <MapSplit
            ariaLabel="Driver console"
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
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={fades.normal} className="flex min-h-0 flex-1 flex-col">
                    <PanelHeader>
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-400 text-ink" aria-hidden>
                            <MapPinned size={18} />
                        </span>
                        <div className="min-w-0 flex-1">
                            <p className="text-[15px] font-semibold leading-snug">Set your location</p>
                            <p className="text-[13px] leading-snug text-muted">Drag the map until the pin sits where you are.</p>
                        </div>
                        <IconButton label="Cancel" variant="ghost" size="icon" onClick={() => setPinDrop(false)}>
                            <X size={18} />
                        </IconButton>
                    </PanelHeader>
                    <PanelBody>
                        <div className="rounded-card bg-surface-2 p-4">
                            <p className="text-[11px] font-medium leading-none text-muted">Pin location</p>
                            <p className="mt-1.5 flex items-center gap-2 text-[17px] font-semibold leading-snug" aria-live="polite">
                                {resolvingPin && <Spinner className="h-4 w-4 shrink-0 text-muted" />}
                                <span>{pinLabel || "Locating…"}</span>
                            </p>
                        </div>
                    </PanelBody>
                    <PanelFooter>
                        <Button size="lg" variant="primary" arrow onClick={confirmPin} disabled={resolvingPin || confirmingPin} loading={confirmingPin} loadingText="Saving location…">
                            Confirm location
                        </Button>
                    </PanelFooter>
                </motion.div>
            ) : (
                <>
                    {/* Re-keyed per trip stage so each stage opens scrolled to its headline. */}
                    <PanelBody key={activeOffer ? `trip-${activeOffer.status}` : "idle"}>
                        <motion.div variants={listVariants} initial="hidden" animate="show" className="flex flex-col gap-4">
                            {activeOffer && (
                                <motion.div variants={item}>
                                    <ActiveTripCard offer={activeOffer} error={error} />
                                </motion.div>
                            )}
                            <motion.div variants={item}>
                                <GoOnlineCard
                                    compact={compactOnline}
                                    online={online}
                                    busy={busy && !activeOffer}
                                    name={firstName}
                                    vehicle={vehicle}
                                    lockedReason={locked ? "You can go offline once this trip is finished." : null}
                                    onChange={setOnline}
                                />
                            </motion.div>
                            {!activeOffer && online && (
                                <motion.div variants={item}>
                                    <RideRequests offers={openOffers} now={now} near={addressLabel} onDismiss={dismissOffer} acceptInFooter={mobile} />
                                </motion.div>
                            )}
                            <motion.div variants={item}>
                                <LocationCard pinned={manualLocation} address={addressText} resolving={addressResolving} locating={locating} onLocate={handleLocateMe} onPin={startPinDrop} />
                            </motion.div>
                        </motion.div>
                    </PanelBody>
                    {activeOffer ? (
                        <PanelFooter>
                            <ActiveTripAction
                                offer={activeOffer}
                                busy={busy}
                                confirming={acceptingTripId === activeOffer.tripId}
                                onAdvance={(action) => useDriverStore.getState().advanceLiveTrip(action)}
                                onDone={() => useDriverStore.getState().dismissAcceptedOffer()}
                            />
                        </PanelFooter>
                    ) : (
                        footerOffer && (
                            <PanelFooter>
                                <Button
                                    size="lg"
                                    variant="primary"
                                    arrow
                                    arrowIcon={<Check strokeWidth={3} />}
                                    loading={acceptingTripId === footerOffer.tripId}
                                    loadingText="Accepting…"
                                    disabled={acceptingTripId !== null}
                                    onClick={() => useDriverStore.getState().acceptLiveOffer(footerOffer.tripId)}
                                >
                                    Accept ride{money(footerOffer.fare) ? ` · ${money(footerOffer.fare)}` : ""}
                                </Button>
                            </PanelFooter>
                        )
                    )}
                </>
            )}
        </MapSplit>
    );
}
