"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, ArrowLeft, Info, MapPinned, X } from "lucide-react";
import type { FareEstimate, Place, Trip, VehicleType } from "@/types";
import { Button } from "@/components/ui/button";
import { RouteRail } from "@/components/ui/primitives";
import { Spinner } from "@/components/ui/spinner";
import { SearchInput, SuggestionList, usePlaceSearch, RECENT_PLACES } from "./location-search";
import { TripMeta, VehicleOption } from "./ride-bits";

/* ------------------------------------------------------------------ */
/* 1. Plan panel — pickup / destination selection                       */
/* ------------------------------------------------------------------ */

export type ActiveField = "pickup" | "destination" | null;

export function PlanPanel({
  pickup,
  destination,
  activeField,
  setActiveField,
  onPick,
  onUseCurrent,
  onSetOnMap,
  onSearch,
  busy,
  error,
  onBack,
  locating,
}: {
  pickup: Place | null;
  destination: Place | null;
  activeField: ActiveField;
  setActiveField: (f: ActiveField) => void;
  onPick: (field: Exclude<ActiveField, null>, p: Place) => void;
  onUseCurrent: () => void;
  onSetOnMap: () => void;
  onSearch: () => void;
  busy: boolean;
  error: string | null;
  onBack: () => void;
  locating: boolean;
}) {
  const [query, setQuery] = React.useState("");
  const [pickupText, setPickupText] = React.useState(pickup?.name ?? "");
  const [destText, setDestText] = React.useState(destination?.name ?? "");
  const [prevPickup, setPrevPickup] = React.useState(pickup);
  const [prevDest, setPrevDest] = React.useState(destination);
  if (pickup !== prevPickup) {
    setPrevPickup(pickup);
    setPickupText(pickup?.name ?? "");
  }
  if (destination !== prevDest) {
    setPrevDest(destination);
    setDestText(destination?.name ?? "");
  }

  const { results, loading } = usePlaceSearch(query, !!activeField);
  const editing = activeField !== null;
  const ready = !!pickup && !!destination && !editing;
  const fieldValue = (f: ActiveField) => (f === "pickup" ? pickupText : f === "destination" ? destText : "");

  const onChangeField = (f: Exclude<ActiveField, null>, v: string) => {
    setQuery(v);
    if (f === "pickup") setPickupText(v);
    else setDestText(v);
  };

  const focusField = (f: Exclude<ActiveField, null>) => {
    setActiveField(f);
    setQuery(fieldValue(f));
  };

  return (
    <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 320, damping: 32 }} className="relative flex min-h-0 flex-1 flex-col bg-white">
      <div className="mx-auto flex w-full max-w-[620px] items-center gap-2 px-4 pt-4">
        <button type="button" onClick={editing ? () => setActiveField(null) : onBack} aria-label="Back" className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-surface-2">
          <ArrowLeft size={20} strokeWidth={2.5} />
        </button>
        <h1 className="text-xl font-semibold">Find a trip</h1>
      </div>

      <div className="mx-auto flex w-full max-w-[620px] items-stretch gap-2 px-5 pt-3">
        <RouteRail stops={0} className="w-3" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="relative">
            <SearchInput value={fieldValue("pickup")} onChange={(v) => onChangeField("pickup", v)} onFocus={() => focusField("pickup")} onClear={() => onChangeField("pickup", "")} placeholder={locating ? "Locating you…" : "Add a pick-up location"} />
            {locating && <Spinner className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-600" />}
          </div>
          <SearchInput value={fieldValue("destination")} onChange={(v) => onChangeField("destination", v)} onFocus={() => focusField("destination")} onClear={() => onChangeField("destination", "")} placeholder="Add a drop-off location" autoFocus={!destination} />
        </div>
      </div>

      {error && (
        <p className="mx-auto mt-3 flex w-full max-w-[620px] items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-danger">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {error}
        </p>
      )}

      <div className="mx-auto min-h-0 w-full max-w-[620px] flex-1 overflow-y-auto scrollbar-visible px-5 pb-4 pt-2">
        {editing ? (
          <SuggestionList
            items={results}
            loading={loading}
            emptyQuery={query.trim().length < 2}
            recents={RECENT_PLACES}
            onPick={(p) => {
              onPick(activeField!, p);
              setQuery("");
            }}
            onUseCurrent={activeField === "pickup" ? onUseCurrent : undefined}
            onSetOnMap={activeField === "pickup" ? onSetOnMap : undefined}
          />
        ) : (
          <AnimatePresence>
            {ready && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="pt-1">
                <Button size="lg" loading={busy} loadingText="Calculating fares…" onClick={onSearch}>
                  Search
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Pin-drop chrome — SCRUM-48                                            */
/* ------------------------------------------------------------------ */

export function PinDropChrome({ label, resolving, onConfirm, onCancel }: { label: string; resolving: boolean; onConfirm: () => void; onCancel: () => void }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex min-h-0 flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-[620px] items-center gap-2 border-b border-zinc-200/80 px-5 py-3.5">
        <MapPinned size={18} className="shrink-0 text-brand-600" />
        <p className="min-w-0 flex-1 text-xs font-semibold">Drag the map to place your pickup pin</p>
        <button type="button" onClick={onCancel} aria-label="Cancel" className="rounded-lg p-1.5 hover:bg-surface-2">
          <X size={16} />
        </button>
      </div>
      <div className="mx-auto flex w-full max-w-[620px] flex-1 flex-col justify-center px-5 py-6">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Pickup</p>
        <p className="mt-1 flex items-center gap-2 text-lg font-semibold leading-snug">
          {resolving && <Spinner className="h-4 w-4 shrink-0 text-brand-600" />} {label}
        </p>
        <Button className="mt-5" size="lg" onClick={onConfirm} disabled={resolving}>
          Confirm pickup
        </Button>
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* 2. Vehicle selection + fare display — SCRUM-53/54                    */
/* ------------------------------------------------------------------ */

export function SelectVehicleSheet({
  trip,
  vehicleTypes,
  estimates,
  selectedId,
  onSelect,
  onBack,
}: {
  trip: Trip;
  vehicleTypes: VehicleType[];
  estimates: FareEstimate[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onBack: () => void;
}) {
  return (
    <div className="flex flex-col">
      <div className="mb-3 flex items-center gap-2">
        <button type="button" onClick={onBack} aria-label="Back to planning" className="-ml-2 flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 hover:bg-surface-2 hover:text-ink">
          <ArrowLeft size={18} strokeWidth={2.5} />
        </button>
        <h2 className="flex-1 text-lg font-semibold">Choose a ride</h2>
        <TripMeta distanceKm={trip.distanceKm} durationMin={trip.durationMin} />
      </div>
      <div className="flex flex-col gap-1.5">
        {vehicleTypes.map((vt, i) => (
          <VehicleOption key={vt.id} vt={vt} estimate={estimates.find((e) => e.vehicleTypeId === vt.id)} selected={vt.id === selectedId} onSelect={() => onSelect(vt.id)} index={i} />
        ))}
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-[11px] font-normal text-muted">
        <Info size={12} /> Fares are estimates, calculated from route distance and vehicle type (SCRUM-53/54). Trip booking is not implemented yet.
      </p>
    </div>
  );
}
