"use client";

import dynamic from "next/dynamic";
import type { MapViewProps } from "./map-view";

/** Leaflet touches `window` at import time, so the map loads client-side only. */
export const MapView = dynamic<MapViewProps>(() => import("./map-view"), {
    ssr: false,
    loading: () => (
        <div className="map-grid relative h-full w-full" aria-busy="true" aria-label="Loading map">
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/90 px-4 py-2 text-xs font-semibold text-muted shadow-card">Loading map…</span>
        </div>
    ),
});

export type { MapViewProps, MapVehicle } from "./map-view";
