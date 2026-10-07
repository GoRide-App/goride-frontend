"use client";

import * as React from "react";
import { LocateFixed, MapPin, MapPinned } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

/**
 * Where the matching service thinks this driver is: the reverse-geocoded
 * current (or hand-pinned) position, with "Locate me" and "Set on map".
 */
export function LocationCard({
  pinned,
  address,
  resolving,
  locating,
  onLocate,
  onPin,
}: {
  pinned: boolean;
  address: string;
  resolving: boolean;
  locating: boolean;
  onLocate: () => void;
  onPin: () => void;
}) {
  return (
    <section aria-label="Your location" className="rounded-card bg-white shadow-card ring-1 ring-line">
      <div className="flex items-center gap-3 p-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink" aria-hidden>
          <MapPin size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium leading-none text-muted">{pinned ? "Pinned location" : "Current location"}</p>
          <p className="mt-1 flex items-center gap-2 text-[15px] font-semibold leading-snug" aria-live="polite">
            {resolving && <Spinner className="h-4 w-4 shrink-0 text-muted" />}
            <span className="truncate">{address}</span>
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-1 border-t border-line p-2">
        <Button size="sm" variant="ghost" leftIcon={<LocateFixed size={16} />} loading={locating} loadingText="Locating…" onClick={onLocate}>
          Locate me
        </Button>
        <Button size="sm" variant="ghost" leftIcon={<MapPinned size={16} />} onClick={onPin}>
          Set on map
        </Button>
      </div>
    </section>
  );
}
