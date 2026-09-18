"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { LocateFixed, MapPinned, X } from "lucide-react";
import type { LatLng } from "@/types";
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

function DriverMap({ driverId, name }: { driverId: string; name: string }) {
    const online = useDriverStore((s) => s.online);
    const location = useDriverStore((s) => s.location);
    const manualLocation = useDriverStore((s) => s.manualLocation);
    const busy = useDriverStore((s) => s.busy);

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

    return (
        <MapSplit
            map={
                <MapView
                    center={pinDrop ? undefined : location ?? undefined}
                    zoom={15}
                    user={pinDrop ? null : location}
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
