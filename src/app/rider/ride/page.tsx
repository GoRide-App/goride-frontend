"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { LatLng, Place, VehicleType } from "@/types";
import { api } from "@/lib/api/index";
import { getCurrentPosition, reverseGeocode } from "@/lib/geo/providers";
import { ROUTES } from "@/lib/constants";
import { useCurrentUser } from "@/components/layout/role-guard";
import { MapSplit, PanelBody } from "@/components/layout/map-split";
import { useSetShellHeader } from "@/components/layout/shell-header";
import { MapView } from "@/components/map";
import { toast } from "@/components/ui/toast";
import { type ActiveField, PinDropChrome, PlanPanel, SelectVehicleSheet } from "@/components/rider/ride-phases";
import { useRideStore } from "@/store/ride-store";

/** Map padding (px) so fitted routes never hide behind the map's own chrome. */
const MAP_PAD = 48;

const PHASE_TITLE: Record<string, string> = {
    plan: "Find a trip",
    select: "Choose a ride",
};

/**
 * Rider ride page — SCRUM-46/47/48/50/53/54 slice only: map-based pickup/
 * destination selection (GPS, address search, pin-drop) -> vehicle types +
 * calculated fare. Trip request, driver matching, live tracking, payment
 * and rating aren't implemented yet, so the flow stops at vehicle selection.
 */
export default function RiderRidePage() {
    const user = useCurrentUser()!;
    const router = useRouter();
    const s = useRideStore();

    const [vehicleTypes, setVehicleTypes] = React.useState<VehicleType[]>([]);
    const [activeField, setActiveField] = React.useState<ActiveField>(null);
    const [pinDrop, setPinDrop] = React.useState(false);
    const [pinPlace, setPinPlace] = React.useState<Place | null>(null);
    const [pinResolving, setPinResolving] = React.useState(false);
    const [locating, setLocating] = React.useState(false);
    const [userPos, setUserPos] = React.useState<LatLng | null>(null);

    useSetShellHeader({ title: PHASE_TITLE[s.uiPhase] ?? "Your ride", description: "Map on the left, trip options on the right" });

    React.useEffect(() => {
        api.trips.vehicleTypes().then(setVehicleTypes).catch(() => { });
    }, []);

    const locate = React.useCallback(async () => {
        setLocating(true);
        const { pos } = await getCurrentPosition();
        setUserPos(pos);
        const place = await reverseGeocode(pos);
        s.setPickup(place);
        setLocating(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    React.useEffect(() => {
        if (!s.pickup || s.pickup.address === "Locating…") locate();
        else getCurrentPosition().then(({ pos }) => setUserPos(pos));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const fitTo = React.useMemo<LatLng[] | undefined>(() => {
        if (pinDrop) return undefined;
        return s.pickup && s.destination ? [s.pickup, s.destination] : undefined;
    }, [pinDrop, s.pickup, s.destination]);

    const mapCenter = React.useMemo(() => {
        if (pinDrop) return s.pickup ?? userPos ?? undefined;
        if (!s.destination) return s.pickup ?? userPos ?? undefined;
        return undefined;
    }, [pinDrop, s.pickup, s.destination, userPos]);

    const onPick = (field: Exclude<ActiveField, null>, p: Place) => {
        if (field === "pickup") s.setPickup(p);
        else s.setDestination(p);
        setActiveField(null);
    };

    const onSearch = async () => {
        const ok = await s.createDraft(user.id);
        if (!ok && s.error) toast.error("Couldn't calculate fares", s.error);
    };

    const map = (
        <MapView
            className="h-full w-full"
            center={mapCenter}
            zoom={15}
            fitTo={fitTo}
            paddingBottom={MAP_PAD}
            paddingTop={MAP_PAD}
            user={userPos}
            pickup={pinDrop ? null : (s.pickup ?? null)}
            destination={s.destination ?? null}
            route={s.trip?.routeGeometry ?? null}
            pinDrop={pinDrop}
            onPinMoveStart={() => setPinResolving(true)}
            onPinMove={async (pos) => {
                setPinResolving(true);
                const place = await reverseGeocode(pos);
                setPinPlace(place);
                setPinResolving(false);
            }}
            draggablePickup={s.uiPhase === "plan" && !pinDrop}
            onPickupDragEnd={async (pos) => {
                const place = await reverseGeocode(pos);
                s.setPickup(place);
            }}
        />
    );

    return (
        <MapSplit map={map}>
            {pinDrop ? (
                <PinDropChrome
                    label={pinPlace?.name ? `${pinPlace.name}${pinPlace.address && pinPlace.address !== pinPlace.name ? ` · ${pinPlace.address}` : ""}` : "Move the map…"}
                    resolving={pinResolving}
                    onCancel={() => setPinDrop(false)}
                    onConfirm={() => {
                        if (pinPlace) s.setPickup(pinPlace);
                        setPinDrop(false);
                    }}
                />
            ) : s.uiPhase === "plan" ? (
                <PlanPanel
                    pickup={s.pickup}
                    destination={s.destination}
                    activeField={activeField}
                    setActiveField={setActiveField}
                    onPick={onPick}
                    onUseCurrent={() => {
                        setActiveField(null);
                        locate();
                    }}
                    onSetOnMap={() => {
                        setActiveField(null);
                        setPinPlace(s.pickup);
                        setPinDrop(true);
                    }}
                    onSearch={onSearch}
                    busy={s.busy}
                    error={s.error}
                    onBack={() => router.push(ROUTES.rider.home)}
                    locating={locating}
                />
            ) : (
                s.trip && (
                    <PanelBody>
                        <SelectVehicleSheet
                            trip={s.trip}
                            vehicleTypes={vehicleTypes}
                            estimates={s.estimates}
                            selectedId={s.selectedVehicleTypeId}
                            onSelect={s.setSelectedVehicle}
                            onBack={() => {
                                s.resetPlanning();
                                setActiveField(null);
                            }}
                        />
                    </PanelBody>
                )
            )}
        </MapSplit>
    );
}
