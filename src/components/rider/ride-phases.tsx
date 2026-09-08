"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, ArrowLeft, Info } from "lucide-react";
import type { FareEstimate, Place, Trip, VehicleType } from "@/types";
import { Button } from "@/components/ui/button";
import { RouteRail } from "@/components/ui/primitives";
import { SearchInput, SuggestionList, usePlaceSearch, RECENT_PLACES } from "./location-search";
import { TripMeta, VehicleOption } from "./ride-bits";

/**
 * SCRUM-54 slice only: pickup/destination selection (this file) through
 * vehicle-type + fare display (`SelectVehicleSheet`). Everything past
 * choosing a vehicle -- trip request, matching, tracking, payment, rating,
 * cancel, SOS -- isn't implemented yet and comes back story by story.
 */

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
  onSearch,
  busy,
  error,
  onBack,
}: {
  pickup: Place | null;
  destination: Place | null;
  activeField: ActiveField;
  setActiveField: (f: ActiveField) => void;
  onPick: (field: Exclude<ActiveField, null>, p: Place) => void;
  onSearch: () => void;
  busy: boolean;
  error: string | null;
  onBack: () => void;
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
      <div className="flex items-center gap-2 pt-4">
        <button type="button" onClick={editing ? () => setActiveField(null) : onBack} aria-label="Back" className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-surface-2">
          <ArrowLeft size={20} strokeWidth={2.5} />
        </button>
        <h1 className="text-xl font-semibold">Find a trip</h1>
      </div>

      <div className="flex items-stretch gap-2 pt-3">
        <RouteRail stops={0} className="w-3" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <SearchInput value={fieldValue("pickup")} onChange={(v) => onChangeField("pickup", v)} onFocus={() => focusField("pickup")} onClear={() => onChangeField("pickup", "")} placeholder="Add a pick-up location" />
          <SearchInput value={fieldValue("destination")} onChange={(v) => onChangeField("destination", v)} onFocus={() => focusField("destination")} onClear={() => onChangeField("destination", "")} placeholder="Add a drop-off location" autoFocus={!destination} />
        </div>
      </div>

      {error && (
        <p className="mt-3 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-danger">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {error}
        </p>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-visible pb-4 pt-2">
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
/* 2. Vehicle selection + fare display — SCRUM-54                       */
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
  // trip.distanceKm is a same-origin placeholder (see mock/api.ts) used only
  // to get a trip id -- the real, SCRUM-54-calculated distance/duration is
  // whatever the trip-matching service returned with the fares.
  const distanceKm = estimates[0]?.distanceKm ?? trip.distanceKm;
  const durationMin = estimates[0]?.durationMin ?? trip.durationMin;
  return (
    <div className="flex flex-col">
      <div className="mb-3 flex items-center gap-2">
        <button type="button" onClick={onBack} aria-label="Back to planning" className="-ml-2 flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 hover:bg-surface-2 hover:text-ink">
          <ArrowLeft size={18} strokeWidth={2.5} />
        </button>
        <h2 className="flex-1 text-lg font-semibold">Choose a ride</h2>
        <TripMeta distanceKm={distanceKm} durationMin={durationMin} />
      </div>
      <div className="flex flex-col gap-1.5">
        {vehicleTypes.map((vt, i) => (
          <VehicleOption key={vt.id} vt={vt} estimate={estimates.find((e) => e.vehicleTypeId === vt.id)} selected={vt.id === selectedId} onSelect={() => onSelect(vt.id)} index={i} />
        ))}
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-[11px] font-normal text-muted">
        <Info size={12} /> Fares are estimates, calculated from route distance and vehicle type (SCRUM-54). Trip booking is not implemented yet.
      </p>
    </div>
  );
}
