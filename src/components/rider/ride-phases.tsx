"use client";

import * as React from "react";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, ArrowLeft, Check, CreditCard, Flag, Info, LocateFixed, MapPinned, Plus, RefreshCw, ShieldCheck, Wallet, X } from "lucide-react";
import type { FareEstimate, Place, Trip, VehicleType } from "@/types";
import { CANCEL_REASONS_RIDER, COMPLAINT_CATEGORIES, MATCH_ROUNDS, VEHICLE_IMAGES } from "@/lib/constants";
import { IS_MOCK } from "@/lib/api";
import { cn, formatKm, formatLKR, formatMinutes } from "@/lib/utils";
import { Button, IconButton } from "@/components/ui/button";
import { Textarea, Toggle } from "@/components/ui/field";
import { easeOut, fades, listVariants, springs } from "@/components/ui/motion";
import { Badge, Chip, RatingStars, RouteRail } from "@/components/ui/primitives";
import { SheetHeader } from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { PanelBody, PanelFooter, PanelHeader } from "@/components/layout/map-split";
import { RECENT_PLACES, SearchInput, SuggestionList, usePlaceSearch } from "./location-search";
import { DriverCard, EtaTile, FareBreakdownList, FareReceipt, FareRow, InlineAlert, StatusHeadline, TripMeta, TripProgress, TripRoute, VehicleOption, isVehicleAvailable, useListItemVariants, vehicleDisplayName } from "./ride-bits";

/* ------------------------------------------------------------------ */
/* Shared bits                                                           */
/* ------------------------------------------------------------------ */

function BackButton({ onClick, label = "Back" }: { onClick: () => void; label?: string }) {
  return (
    <IconButton label={label} variant="ghost" onClick={onClick} className="-ml-2">
      <ArrowLeft size={20} strokeWidth={2.5} />
    </IconButton>
  );
}

function PanelTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="min-w-0 flex-1 truncate text-[17px] font-semibold leading-tight tracking-[-0.01em]">{children}</h2>;
}

function FieldLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("text-[13px] font-semibold text-ink", className)}>{children}</p>;
}

function PayWithChips({ value, onChange, disabled }: { value: "Card" | "Cash"; onChange: (m: "Card" | "Cash") => void; disabled?: boolean }) {
  return (
    <div className="flex gap-2" role="group" aria-label="Pay with">
      <Chip selected={value === "Cash"} onClick={() => onChange("Cash")} icon={<Wallet />} disabled={disabled}>
        Cash
      </Chip>
      <Chip selected={value === "Card"} onClick={() => onChange("Card")} icon={<CreditCard />} disabled={disabled}>
        Card
      </Chip>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 1. Plan panel — FR-RIDE-02..07                                        */
/* ------------------------------------------------------------------ */

export type ActiveField = "pickup" | "destination" | `stop-${number}` | null;

export function PlanPanel({
  pickup,
  destination,
  stops,
  activeField,
  setActiveField,
  onPick,
  onUseCurrent,
  onSetOnMap,
  onAddStop,
  onRemoveStop,
  onSearch,
  busy,
  error,
  onBack,
  locating,
}: {
  pickup: Place | null;
  destination: Place | null;
  stops: Place[];
  activeField: ActiveField;
  setActiveField: (f: ActiveField) => void;
  onPick: (field: Exclude<ActiveField, null>, p: Place) => void;
  onUseCurrent: () => void;
  onSetOnMap: () => void;
  onAddStop: () => void;
  onRemoveStop: (i: number) => void;
  onSearch: () => void;
  busy: boolean;
  error: string | null;
  onBack: () => void;
  locating: boolean;
}) {
  const reduce = useReducedMotion();
  const [query, setQuery] = React.useState("");
  const [pickupText, setPickupText] = React.useState(pickup?.name ?? "");
  const [destText, setDestText] = React.useState(destination?.name ?? "");
  const [stopTexts, setStopTexts] = React.useState<string[]>(stops.map((s) => s.name));
  // Keep the text fields in sync when the selected places change (adjust-state-during-render pattern)
  const [prevPickup, setPrevPickup] = React.useState(pickup);
  const [prevDest, setPrevDest] = React.useState(destination);
  const [prevStops, setPrevStops] = React.useState(stops);
  if (pickup !== prevPickup) {
    setPrevPickup(pickup);
    setPickupText(pickup?.name ?? "");
  }
  if (destination !== prevDest) {
    setPrevDest(destination);
    setDestText(destination?.name ?? "");
  }
  if (stops !== prevStops) {
    setPrevStops(stops);
    setStopTexts(stops.map((s) => s.name));
  }

  const { results, loading } = usePlaceSearch(query, !!activeField);
  const editing = activeField !== null;
  const ready = !!pickup && !!destination && !editing;
  const fieldValue = (f: ActiveField) => (f === "pickup" ? pickupText : f === "destination" ? destText : f ? (stopTexts[Number(f.split("-")[1])] ?? "") : "");

  const onChangeField = (f: Exclude<ActiveField, null>, v: string) => {
    setQuery(v);
    if (f === "pickup") setPickupText(v);
    else if (f === "destination") setDestText(v);
    else setStopTexts((arr) => arr.map((x, i) => (i === Number(f.split("-")[1]) ? v : x)));
  };

  const focusField = (f: Exclude<ActiveField, null>) => {
    setActiveField(f);
    setQuery(fieldValue(f));
  };

  const activeLabel = activeField === "pickup" ? "pickup" : activeField === "destination" ? "drop-off" : activeField ? `stop ${Number(activeField.split("-")[1]) + 1}` : null;

  return (
    <>
      <PanelHeader>
        <BackButton onClick={editing ? () => setActiveField(null) : onBack} label={editing ? "Stop editing" : "Back"} />
        <PanelTitle>{editing ? `Choose a ${activeLabel}` : "Where to?"}</PanelTitle>
        {stops.length < 2 && !editing && (
          <Button variant="secondary" size="sm" full={false} leftIcon={<Plus size={16} />} onClick={onAddStop}>
            Add stop
          </Button>
        )}
      </PanelHeader>

      <PanelBody>
        <div className="flex items-stretch gap-3 rounded-card bg-white px-4 shadow-card ring-1 ring-line">
          <RouteRail stops={stops.length} dashed className="w-3.5" />
          <div className="flex min-w-0 flex-1 flex-col divide-y divide-line">
            <SearchInput
              label="Pickup"
              value={fieldValue("pickup")}
              onChange={(v) => onChangeField("pickup", v)}
              onFocus={() => focusField("pickup")}
              onClear={() => onChangeField("pickup", "")}
              placeholder={locating ? "Locating you…" : "Set a pickup location"}
              active={activeField === "pickup"}
              trailing={
                locating ? (
                  <span className="flex h-11 w-11 items-center justify-center text-brand-700" role="status" aria-label="Locating you">
                    <Spinner className="h-4 w-4" />
                  </span>
                ) : (
                  <IconButton label="Use my current location" variant="ghost" onClick={onUseCurrent} className="text-brand-800">
                    <LocateFixed size={18} />
                  </IconButton>
                )
              }
            />
            {stops.map((s, i) => (
              <SearchInput
                key={`${s.name}-${i}`}
                label={`Stop ${i + 1}`}
                value={fieldValue(`stop-${i}`)}
                onChange={(v) => onChangeField(`stop-${i}`, v)}
                onFocus={() => focusField(`stop-${i}`)}
                onClear={() => onChangeField(`stop-${i}`, "")}
                placeholder="Add a stop along the way"
                active={activeField === `stop-${i}`}
                trailing={
                  <IconButton label={`Remove stop ${i + 1}`} variant="ghost" onClick={() => onRemoveStop(i)} className="text-muted hover:text-danger">
                    <X size={16} />
                  </IconButton>
                }
              />
            ))}
            <SearchInput
              label="Drop-off"
              value={fieldValue("destination")}
              onChange={(v) => onChangeField("destination", v)}
              onFocus={() => focusField("destination")}
              onClear={() => onChangeField("destination", "")}
              placeholder="Search a destination"
              autoFocus={!destination}
              active={activeField === "destination"}
            />
          </div>
        </div>

        {error && <InlineAlert className="mt-3">{error}</InlineAlert>}

        <div className="mt-4">
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
            <SuggestionList items={[]} emptyQuery recents={RECENT_PLACES} onPick={(p) => onPick("destination", p)} />
          )}
        </div>
      </PanelBody>

      <AnimatePresence initial={false}>
        {ready && (
          <motion.div key="cta" className="shrink-0" initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: fades.exit }} transition={reduce ? fades.fast : springs.sheet}>
            <PanelFooter>
              <Button size="lg" arrow loading={busy} loadingText="Calculating fares…" onClick={onSearch}>
                See prices
              </Button>
            </PanelFooter>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Pin-drop chrome (FR-RIDE-04)                                          */
/* ------------------------------------------------------------------ */

export function PinDropChrome({ label, resolving, onConfirm, onCancel }: { label: string; resolving: boolean; onConfirm: () => void; onCancel: () => void }) {
  return (
    <>
      <PanelHeader>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-400 text-ink">
          <MapPinned size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[17px] font-semibold leading-tight tracking-[-0.01em]">Set your pickup</h2>
          <p className="truncate text-xs text-muted">Drag the map until the pin sits where you&apos;ll wait</p>
        </div>
        <IconButton label="Cancel pin drop" variant="ghost" onClick={onCancel} className="-mr-2">
          <X size={18} />
        </IconButton>
      </PanelHeader>
      <PanelBody>
        <FieldLabel className="text-muted">Pickup</FieldLabel>
        <p className="mt-1.5 flex items-start gap-2 text-lg font-semibold leading-snug text-balance" aria-live="polite">
          {resolving && <Spinner className="mt-1 h-4 w-4 shrink-0 text-brand-700" />}
          <span>{label}</span>
        </p>
        <p className="mt-3 text-[13px] leading-snug text-muted text-pretty">Your driver will head for this exact spot, so pick a kerb they can stop at.</p>
      </PanelBody>
      <PanelFooter className="flex flex-col gap-2">
        <Button size="lg" arrow arrowIcon={<Check strokeWidth={3} />} onClick={onConfirm} disabled={resolving}>
          Confirm pickup
        </Button>
      </PanelFooter>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* 2. Vehicle selection + fares — FR-FARE-*                              */
/* ------------------------------------------------------------------ */

export function SelectVehicleSheet({
  trip,
  vehicleTypes,
  estimates,
  selectedId,
  onSelect,
  onBack,
  onContinue,
  busy,
  paymentPreference,
  onPaymentPreference,
}: {
  trip: Trip;
  vehicleTypes: VehicleType[];
  estimates: FareEstimate[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onBack: () => void;
  onContinue: () => void;
  busy: boolean;
  paymentPreference: "Card" | "Cash";
  onPaymentPreference: (m: "Card" | "Cash") => void;
}) {
  const estimateFor = (id: string) => estimates.find((e) => e.vehicleTypeId === id);
  // Bookable rides first; the rest stay visible but clearly not available yet.
  const ordered = React.useMemo(() => {
    const avail = (vt: VehicleType) => isVehicleAvailable(vt.code, estimates.find((e) => e.vehicleTypeId === vt.id));
    return [...vehicleTypes].sort((a, b) => Number(avail(b)) - Number(avail(a)));
  }, [vehicleTypes, estimates]);

  const selected = selectedId ? estimateFor(selectedId) : undefined;
  const selectedVt = vehicleTypes.find((v) => v.id === selectedId) ?? null;
  const selectedAvailable = !!selectedVt && isVehicleAvailable(selectedVt.code, selected);
  const firstAvailable = ordered.find((vt) => isVehicleAvailable(vt.code, estimateFor(vt.id))) ?? null;

  // The store defaults to a Car; if that ride can't be booked yet, move the
  // selection to the first one that can (same setter the user would tap).
  React.useEffect(() => {
    if (!selectedAvailable && firstAvailable && firstAvailable.id !== selectedId) onSelect(firstAvailable.id);
  }, [selectedAvailable, firstAvailable, selectedId, onSelect]);

  const ctaLabel = selected && selectedVt && selectedAvailable ? `Choose ${vehicleDisplayName(selectedVt, selected)} · ${formatLKR(selected.estimatedFare)}` : "Choose an available ride";

  return (
    <>
      <PanelHeader>
        <BackButton onClick={onBack} label="Back to planning" />
        <PanelTitle>Choose a ride</PanelTitle>
        <TripMeta distanceKm={trip.distanceKm} durationMin={trip.durationMin} />
      </PanelHeader>
      <PanelBody>
        <motion.ul variants={listVariants} initial="hidden" animate="show" className="flex flex-col gap-2.5" aria-label="Ride options">
          {ordered.map((vt) => (
            <VehicleOption key={vt.id} vt={vt} estimate={estimateFor(vt.id)} selected={vt.id === selectedId} onSelect={() => onSelect(vt.id)} />
          ))}
        </motion.ul>

        <div className="mt-6">
          <FieldLabel className="mb-2">Pay with</FieldLabel>
          <PayWithChips value={paymentPreference} onChange={onPaymentPreference} />
        </div>

        <p className="mt-5 flex items-start gap-2 text-xs leading-snug text-muted text-pretty">
          <Info size={14} className="mt-px shrink-0" />
          Fares are estimates in LKR. The final fare uses the actual distance and time driven, and you pay after the trip.
        </p>
      </PanelBody>
      <PanelFooter>
        <Button size="lg" arrow disabled={!selected || !selectedAvailable} loading={busy} onClick={onContinue}>
          {ctaLabel}
        </Button>
      </PanelFooter>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* 3. Review & request — FR-FARE-05                                      */
/* ------------------------------------------------------------------ */

export function ReviewSheet({
  trip,
  vehicleType,
  estimate,
  paymentPreference,
  onPaymentPreference,
  onBack,
  onConfirm,
  busy,
  error,
  emailVerified,
}: {
  trip: Trip;
  vehicleType: VehicleType;
  estimate: FareEstimate;
  paymentPreference: "Card" | "Cash";
  onPaymentPreference: (m: "Card" | "Cash") => void;
  onBack: () => void;
  onConfirm: () => void;
  busy: boolean;
  error: string | null;
  emailVerified: boolean;
}) {
  const [showBreakdown, setShowBreakdown] = React.useState(false);
  const name = vehicleDisplayName(vehicleType, estimate);
  return (
    <>
      <PanelHeader>
        <BackButton onClick={onBack} />
        <PanelTitle>Review and request</PanelTitle>
      </PanelHeader>
      <PanelBody>
        <div className="rounded-card bg-surface-2 p-4 ring-1 ring-line">
          <div className="flex items-center gap-3">
            <Image src={VEHICLE_IMAGES[vehicleType.code] ?? "/vehicles/car.png"} alt="" width={96} height={64} className="h-14 w-20 shrink-0 object-contain" />
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold leading-tight">{name}</p>
              <p className="mt-0.5 text-[13px] leading-snug text-muted">Up to {vehicleType.capacity} passengers</p>
            </div>
            <p className="shrink-0 text-[22px] font-semibold leading-none tracking-[-0.02em] tabular-nums">{formatLKR(estimate.estimatedFare)}</p>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3">
            <TripMeta distanceKm={estimate.distanceKm} durationMin={estimate.durationMin} />
            <button type="button" onClick={() => setShowBreakdown((s) => !s)} aria-expanded={showBreakdown} className="text-xs font-semibold text-brand-800 underline-offset-4 hover:underline">
              {showBreakdown ? "Hide breakdown" : "See breakdown"}
            </button>
          </div>
          <AnimatePresence initial={false}>
            {showBreakdown && (
              <motion.div key="breakdown" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22, ease: easeOut }} className="overflow-hidden">
                <FareBreakdownList estimate={estimate} className="mt-3" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <TripRoute trip={trip} className="mt-4" />

        <div className="mt-6">
          <FieldLabel className="mb-2">Pay with</FieldLabel>
          <PayWithChips value={paymentPreference} onChange={onPaymentPreference} />
          <p className="mt-2.5 text-xs leading-snug text-muted text-pretty">You pay after the trip ends. If a card is declined twice, the trip switches to cash.</p>
        </div>

        {!emailVerified && (
          <InlineAlert tone="warning" className="mt-4">
            Verify your email before requesting a ride.
          </InlineAlert>
        )}
        {error && <InlineAlert className="mt-4">{error}</InlineAlert>}
      </PanelBody>
      <PanelFooter>
        <Button size="lg" arrow loading={busy} loadingText="Requesting…" onClick={onConfirm} disabled={!emailVerified}>
          Request {name} · {formatLKR(estimate.estimatedFare)}
        </Button>
      </PanelFooter>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* 4. Searching — FR-MATCH-06/07/08                                      */
/* ------------------------------------------------------------------ */

export function SearchingSheet({ trip, vehicleType, onCancel, busy }: { trip: Trip; vehicleType?: VehicleType; onCancel: () => void; busy: boolean }) {
  const reduce = useReducedMotion();
  const itemVariants = useListItemVariants();
  const round = trip.matchRoundReached;
  const cfg = MATCH_ROUNDS[round - 1];
  const rematch = trip.status === "REMATCHING";
  const name = vehicleType ? vehicleDisplayName(vehicleType) : "nearby";
  const steps = [
    `We offer your ride to ${name} drivers nearby and widen the search each round.`,
    "A driver accepts, and you see their name, plate and live location.",
    "You pay after the trip, by card or cash, once the final fare is confirmed.",
  ];

  return (
    <>
      <PanelBody contentClassName="pt-6">
        <div className="flex flex-col items-center text-center">
          <div className="relative flex h-24 w-24 items-center justify-center">
            <span className="absolute inset-0 rounded-full bg-brand-400/30 animate-radar" />
            <span className="absolute inset-0 rounded-full bg-brand-400/30 animate-radar-delayed" />
            <span className="absolute inset-4 rounded-full bg-brand-100" />
            {vehicleType && <Image src={VEHICLE_IMAGES[vehicleType.code] ?? "/vehicles/car.png"} alt="" width={96} height={64} className="relative h-12 w-auto object-contain" />}
          </div>
          <h2 className="mt-4 text-xl font-semibold leading-tight tracking-[-0.015em] text-balance" aria-live="polite">
            {rematch ? "Finding you another driver" : "Looking for nearby drivers"}
          </h2>
          <p className="mt-1.5 max-w-[34ch] text-[13px] leading-snug text-muted text-pretty">
            {rematch ? "Your previous driver cancelled, so we're matching you again automatically." : `Offering your ride to ${name} drivers within ${cfg.radiusKm} km.`}
          </p>
        </div>

        <div className="mt-6">
          <div className="flex items-center justify-between text-xs font-semibold tabular-nums">
            <span>Search round {round} of 3</span>
            <span className="text-muted">{cfg.radiusKm} km radius</span>
          </div>
          <div className="mt-2 flex gap-1.5" aria-hidden>
            {MATCH_ROUNDS.map((r) => (
              <span key={r.round} className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
                {r.round < round && <span className="absolute inset-0 bg-brand-400" />}
                {r.round === round && (
                  <motion.span key={`${trip.id}-${round}-${trip.requestedAt}`} className="absolute inset-y-0 left-0 bg-brand-400" initial={{ width: "0%" }} animate={{ width: "100%" }} transition={{ duration: reduce ? 0 : r.seconds, ease: "linear" }} />
                )}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-5 rounded-card bg-surface-2 p-4 ring-1 ring-line">
          <TripRoute trip={trip} compact className="bg-transparent px-0 shadow-none ring-0" />
          <div className="mt-2 flex items-center justify-between border-t border-line pt-3 text-sm">
            <span className="text-muted">Estimated fare</span>
            <span className="font-semibold tabular-nums">{formatLKR(trip.estimatedFare)}</span>
          </div>
        </div>

        <motion.ol variants={listVariants} initial="hidden" animate="show" className="mt-6 flex flex-col gap-3" aria-label="What happens next">
          {steps.map((step, i) => (
            <motion.li key={step} variants={itemVariants} className="flex items-start gap-3 text-[13px] leading-snug text-muted text-pretty">
              <span className={cn("mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums", i === 0 ? "bg-brand-400 text-ink" : "bg-surface-2 text-ink")}>{i + 1}</span>
              <span className={cn(i === 0 && "text-ink")}>{step}</span>
            </motion.li>
          ))}
        </motion.ol>
      </PanelBody>
      <PanelFooter>
        <Button size="lg" variant="outline" onClick={onCancel} loading={busy}>
          Cancel request
        </Button>
      </PanelFooter>
    </>
  );
}

export function NoDriverSheet({ trip, vehicleTypes, estimates, onRetry, onRetryWith, onHome, busy }: { trip: Trip; vehicleTypes: VehicleType[]; estimates: FareEstimate[]; onRetry: () => void; onRetryWith: (id: string) => void; onHome: () => void; busy: boolean }) {
  const current = vehicleTypes.find((v) => v.id === trip.vehicleTypeId);
  const name = current ? vehicleDisplayName(current) : "";
  const others = vehicleTypes.filter((v) => v.id !== trip.vehicleTypeId && isVehicleAvailable(v.code, estimates.find((e) => e.vehicleTypeId === v.id)));
  return (
    <>
      <PanelBody>
        <div className="flex items-start gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-danger">
            <AlertTriangle size={22} />
          </span>
          <div className="min-w-0">
            <h2 className="text-xl font-semibold leading-tight tracking-[-0.015em] text-balance">No drivers available right now</h2>
            <p className="mt-1.5 text-[13px] leading-snug text-muted text-pretty">No {name} driver near your pickup accepted in time. You haven&apos;t been charged.</p>
          </div>
        </div>

        {others.length > 0 ? (
          <>
            <FieldLabel className="mb-2 mt-6">Or choose another ride</FieldLabel>
            <motion.ul variants={listVariants} initial="hidden" animate="show" className="flex flex-col gap-2.5">
              {others.map((vt) => (
                <VehicleOption key={vt.id} vt={vt} estimate={estimates.find((e) => e.vehicleTypeId === vt.id)} selected={false} onSelect={() => onRetryWith(vt.id)} />
              ))}
            </motion.ul>
          </>
        ) : (
          <p className="mt-5 text-[13px] leading-snug text-muted text-pretty">Other ride types aren&apos;t available yet, so searching again looks for a {name} once more.</p>
        )}

        <TripRoute trip={trip} compact className="mt-5" />
      </PanelBody>
      <PanelFooter className="flex flex-col gap-2">
        <Button size="lg" arrow arrowIcon={<RefreshCw strokeWidth={2.5} />} onClick={onRetry} loading={busy} loadingText="Searching again…">
          Search again
        </Button>
        <Button variant="ghost" onClick={onHome}>
          Back to home
        </Button>
      </PanelFooter>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* 5. Driver en route / arrived — FR-PICK-02..04                         */
/* ------------------------------------------------------------------ */

export function EnRouteSheet({ trip, etaMin, onCancel, arrived }: { trip: Trip; etaMin: number | null; onCancel: () => void; arrived?: boolean }) {
  const reduce = useReducedMotion();
  if (!trip.driver) return null;
  const first = trip.driver.name.split(" ")[0];
  return (
    <>
      <PanelBody>
        <StatusHeadline
          title={arrived ? "Your driver has arrived" : "Your driver is on the way"}
          description={arrived ? `${first} is waiting at ${trip.pickup.name}` : etaMin != null ? `Arriving in about ${formatMinutes(etaMin)}` : "Calculating arrival time…"}
          right={
            arrived ? (
              <Badge tone="success" dot size="md">
                Arrived
              </Badge>
            ) : etaMin != null ? (
              <EtaTile minutes={etaMin} />
            ) : (
              <Badge tone="brand" dot size="md">
                En route
              </Badge>
            )
          }
        />

        {arrived && (
          <motion.div
            key="meet"
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, scale: [0.96, 1.02, 1] }}
            transition={reduce ? fades.fast : { duration: 0.6, ease: easeOut }}
            className="mt-4 flex items-start gap-3 rounded-card bg-brand-400 p-4 text-ink"
          >
            <ShieldCheck size={22} className="mt-px shrink-0" />
            <div className="min-w-0">
              <p className="text-[15px] font-semibold leading-tight">Meet your driver</p>
              <p className="mt-1 text-[13px] leading-snug text-ink/75 text-pretty">
                Check the plate <span className="font-semibold text-ink tabular-nums">{trip.driver.vehiclePlate}</span> before getting in. {first} will wait a few minutes at the pickup.
              </p>
            </div>
          </motion.div>
        )}

        <DriverCard driver={trip.driver} className="mt-4" />
        <TripRoute trip={trip} compact className="mt-4" />
        <FareRow label="Estimated fare" value={formatLKR(trip.estimatedFare)} className="mt-3" />
      </PanelBody>
      <PanelFooter>
        <Button size="lg" variant="outline" onClick={onCancel}>
          Cancel ride
        </Button>
      </PanelFooter>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* 6. In progress — FR-TRIP-01/02, FR-CAN-08                             */
/* ------------------------------------------------------------------ */

export function InProgressSheet({ trip, etaMin, remainingKm, onCancelWithComplaint }: { trip: Trip; etaMin: number | null; remainingKm: number | null; onCancelWithComplaint: () => void }) {
  const fraction = remainingKm != null && trip.distanceKm > 0 ? 1 - remainingKm / trip.distanceKm : 0;
  return (
    <>
      <PanelBody>
        <StatusHeadline
          title={`Heading to ${trip.destination.name}`}
          description={etaMin != null ? `Arriving in about ${formatMinutes(etaMin)}${remainingKm != null ? ` · ${formatKm(remainingKm)} to go` : ""}` : "On the way to your destination"}
          right={
            etaMin != null ? (
              <EtaTile minutes={etaMin} />
            ) : (
              <Badge tone="info" dot size="md">
                In trip
              </Badge>
            )
          }
        />
        <TripProgress fraction={fraction} from={trip.pickup.name} to={trip.destination.name} className="mt-4" />
        {trip.driver && <DriverCard driver={trip.driver} className="mt-4" />}
        <TripRoute trip={trip} compact className="mt-4" />
        <FareRow label="Estimated fare" value={formatLKR(trip.estimatedFare)} className="mt-3" />
      </PanelBody>
      <PanelFooter>
        <Button variant="ghost" leftIcon={<Flag size={16} />} onClick={onCancelWithComplaint} className="text-muted hover:text-ink">
          End trip early and file a complaint
        </Button>
      </PanelFooter>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* 7. Payment — FR-PAY-*, FR-CASH-*                                      */
/* ------------------------------------------------------------------ */

export function PaymentSheet({ trip, preference, busy, onSelectCash, onPayCard, cardResult }: { trip: Trip; preference: "Card" | "Cash"; busy: boolean; onSelectCash: () => void; onPayCard: (forceFail: boolean) => void; cardResult: { ok: boolean; message?: string; cardDisabled?: boolean } | null }) {
  const p = trip.payment;
  const [forceFail, setForceFail] = React.useState(false);
  const [method, setMethod] = React.useState<"Card" | "Cash">(p?.cardDisabled ? "Cash" : (p?.method ?? preference));
  const cashSelected = p?.method === "Cash" && p.status === "AwaitingCash";
  const attemptsLeft = 2 - (p?.cardAttemptCount ?? 0);
  const processing = busy && method === "Card" && !cashSelected;
  const first = trip.driver?.name.split(" ")[0];

  if (!p) {
    return (
      <PanelBody>
        <StatusHeadline title="You've arrived" description={`${trip.pickup.name} → ${trip.destination.name}`} right={<Badge tone="success" size="md">Completed</Badge>} />
        <div className="mt-4 rounded-card bg-ink p-5 text-white" role="status" aria-live="polite">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/60">Final fare</p>
          <div className="mt-3 flex items-center gap-3">
            <Spinner className="h-5 w-5 text-brand-300" />
            <p className="text-sm font-medium">Finalising your fare from the distance and time driven…</p>
          </div>
          <div className="mt-5 space-y-2.5 border-t border-dashed border-white/20 pt-4" aria-hidden>
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex justify-between gap-3">
                <span className="h-3 w-24 rounded-full bg-white/10" />
                <span className="h-3 w-14 rounded-full bg-white/10" />
              </div>
            ))}
          </div>
        </div>
      </PanelBody>
    );
  }

  return (
    <>
      <PanelBody>
        <StatusHeadline title="You've arrived" description={`${trip.pickup.name} → ${trip.destination.name}`} right={<Badge tone="success" size="md">Completed</Badge>} />
        <FareReceipt payment={p} trip={trip} className="mt-4" />

        {cashSelected ? (
          <div className="mt-4 flex flex-col items-center rounded-card bg-brand-50 p-5 text-center ring-1 ring-brand-200">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-400 text-ink">
              <Wallet size={22} />
            </span>
            <p className="mt-3 text-[15px] font-semibold text-balance">
              Pay <span className="tabular-nums">{formatLKR(p.finalFare)}</span> in cash to {first}
            </p>
            <p className="mt-1 text-[13px] leading-snug text-muted text-pretty">{p.cardDisabled ? "Your card was declined twice, so this trip is now cash only." : "Your driver confirms once they've received it."}</p>
            <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-brand-800" role="status" aria-live="polite">
              <Spinner className="h-4 w-4" /> Waiting for driver confirmation…
            </div>
          </div>
        ) : (
          <>
            <FieldLabel className="mb-2 mt-6">Payment method</FieldLabel>
            <div className="grid grid-cols-2 gap-2" role="group" aria-label="Payment method">
              {(["Card", "Cash"] as const).map((m) => {
                const disabled = m === "Card" && p.cardDisabled;
                const active = method === m && !disabled;
                return (
                  <button
                    key={m}
                    type="button"
                    disabled={disabled || processing}
                    aria-pressed={active}
                    onClick={() => setMethod(m)}
                    className={cn(
                      "flex min-h-[96px] flex-col items-start gap-2 rounded-card p-3.5 text-left ring-1 transition-[background-color,box-shadow] duration-200 ease-(--ease-spring)",
                      active ? "bg-brand-50 ring-2 ring-brand-400" : "bg-white ring-line hover:bg-surface-2",
                      disabled && "cursor-not-allowed opacity-50",
                    )}
                  >
                    <span className="flex w-full items-center justify-between">
                      <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl", active ? "bg-brand-400 text-ink" : "bg-surface-2 text-ink")}>{m === "Card" ? <CreditCard size={18} /> : <Wallet size={18} />}</span>
                      {active && <Check size={18} strokeWidth={3} className="text-ink" />}
                    </span>
                    <span>
                      <span className="block text-sm font-semibold">{m}</span>
                      <span className="block text-[11px] leading-snug text-muted">{m === "Card" ? (disabled ? "Disabled after 2 declines" : "Visa •••• 4242") : "Pay your driver directly"}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            {cardResult && !cardResult.ok && <InlineAlert className="mt-3">{cardResult.message}</InlineAlert>}

            {IS_MOCK && method === "Card" && !p.cardDisabled && (
              <div className="mt-3 rounded-2xl bg-surface-2 px-4 py-3">
                <Toggle checked={forceFail} onChange={setForceFail} tone="ink" label={<span className="text-[13px]">Demo: simulate a card decline</span>} description={<span className="text-[11px]">{attemptsLeft === 2 ? "One automatic retry, then cash fallback" : "The next decline switches this trip to cash"}</span>} />
              </div>
            )}

            <p className="mt-4 text-center text-[11px] leading-snug text-muted text-pretty">Card details are tokenised by the payment provider. GoRide never stores them.</p>
          </>
        )}
      </PanelBody>
      {!cashSelected && (
        <PanelFooter>
          {method === "Card" ? (
            <Button size="lg" arrow loading={processing} loadingText={attemptsLeft === 1 ? "Retrying card…" : "Processing securely…"} onClick={() => onPayCard(forceFail)}>
              Pay {formatLKR(p.finalFare)} by card
            </Button>
          ) : (
            <Button size="lg" arrow loading={busy} onClick={onSelectCash}>
              Pay {formatLKR(p.finalFare)} in cash
            </Button>
          )}
        </PanelFooter>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* 8. Paid + rating — FR-RATE-01/02                                      */
/* ------------------------------------------------------------------ */

export function PaidSheet({ trip, onRate, onDone, onReceipt }: { trip: Trip; onRate: (stars: number, comment?: string) => Promise<void>; onDone: () => void; onReceipt: () => void }) {
  const reduce = useReducedMotion();
  const [stars, setStars] = React.useState(trip.myRating ?? 0);
  const [comment, setComment] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const rated = !!trip.myRating;
  const p = trip.payment;
  const first = trip.driver?.name.split(" ")[0];
  return (
    <>
      <PanelBody contentClassName="pt-6">
        <div className="flex flex-col items-center text-center">
          <motion.span
            initial={reduce ? { opacity: 0 } : { scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={reduce ? fades.fast : { type: "spring", stiffness: 300, damping: 18 }}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-400 text-ink shadow-glow"
          >
            <Check size={30} strokeWidth={3} />
          </motion.span>
          <h2 className="mt-4 text-xl font-semibold leading-tight tracking-[-0.015em]">Thanks for riding with GoRide</h2>
          <p className="mt-1.5 text-[13px] leading-snug text-muted tabular-nums">
            {formatLKR(p?.finalFare ?? trip.finalFare)} paid by {p?.method ?? "—"}
            {p?.receiptNo ? ` · Receipt ${p.receiptNo}` : ""}
          </p>
        </div>

        {trip.driver && (
          <div className="mt-6 rounded-card bg-surface-2 p-5 text-center ring-1 ring-line">
            <p className="text-[15px] font-semibold text-balance">{rated ? `You rated ${first} ${trip.myRating} out of 5` : `How was your trip with ${first}?`}</p>
            <RatingStars value={stars} onChange={rated ? undefined : setStars} readOnly={rated} size={34} className="mt-3" />
            <AnimatePresence initial={false}>
              {!rated && stars > 0 && (
                <motion.div key="comment" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.22, ease: easeOut }} className="overflow-hidden text-left">
                  <Textarea placeholder={stars >= 4 ? "What went well? (optional)" : "Tell us what happened (optional)"} value={comment} onChange={(e) => setComment(e.target.value)} className="mt-4 min-h-24 bg-white" aria-label="Comment for your driver" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </PanelBody>
      <PanelFooter className="flex flex-col gap-2">
        {!rated && stars > 0 ? (
          <Button
            size="lg"
            arrow
            loading={saving}
            loadingText="Saving your rating…"
            onClick={async () => {
              setSaving(true);
              await onRate(stars, comment.trim() || undefined);
              setSaving(false);
            }}
          >
            Submit rating
          </Button>
        ) : (
          <Button size="lg" arrow onClick={onDone}>
            Done
          </Button>
        )}
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onReceipt}>
            View receipt
          </Button>
          {!rated && (
            <Button variant="ghost" onClick={onDone}>
              Skip rating
            </Button>
          )}
        </div>
      </PanelFooter>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* 9. Cancelled                                                          */
/* ------------------------------------------------------------------ */

export function CancelledSheet({ trip, onAgain, onHome }: { trip: Trip; onAgain: () => void; onHome: () => void }) {
  return (
    <>
      <PanelBody contentClassName="pt-6">
        <div className="flex flex-col items-center text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-danger">
            <X size={28} strokeWidth={3} />
          </span>
          <h2 className="mt-4 text-xl font-semibold leading-tight tracking-[-0.015em]">Trip cancelled</h2>
          <p className="mt-1.5 max-w-[36ch] text-[13px] leading-snug text-muted text-pretty">
            {trip.cancelledBy === "Rider" ? "You cancelled this trip." : trip.cancelledBy === "Driver" ? "Your driver cancelled this trip." : "This trip was cancelled."}
            {trip.cancellationReason ? ` Reason: ${trip.cancellationReason}.` : ""}
          </p>
          {trip.cancellationFee ? (
            <Badge tone="warning" size="md" className="mt-4 tabular-nums">
              Cancellation fee {formatLKR(trip.cancellationFee)}
            </Badge>
          ) : (
            <Badge tone="success" size="md" className="mt-4">
              No cancellation fee
            </Badge>
          )}
        </div>
        <TripRoute trip={trip} compact className="mt-6" />
      </PanelBody>
      <PanelFooter className="flex flex-col gap-2">
        <Button size="lg" arrow onClick={onAgain}>
          Book another ride
        </Button>
        <Button variant="ghost" onClick={onHome}>
          Back to home
        </Button>
      </PanelFooter>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Cancel sheet (reason picker) — FR-CAN-01/02                           */
/* ------------------------------------------------------------------ */

export function CancelReasonPanel({ feeNote, onConfirm, onClose, busy, requireComplaint }: { feeNote?: string; onConfirm: (reason: string, complaint?: { category: string; details: string }) => void; onClose: () => void; busy: boolean; requireComplaint?: boolean }) {
  const [reason, setReason] = React.useState<string>(requireComplaint ? COMPLAINT_CATEGORIES[0] : CANCEL_REASONS_RIDER[0]);
  const [details, setDetails] = React.useState("");
  const reasons = requireComplaint ? COMPLAINT_CATEGORIES : CANCEL_REASONS_RIDER;
  const canSubmit = requireComplaint ? details.trim().length >= 10 : true;
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);

  const onKey = (e: React.KeyboardEvent, i: number) => {
    const next = e.key === "ArrowDown" || e.key === "ArrowRight" ? i + 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? i - 1 : null;
    if (next == null) return;
    e.preventDefault();
    const j = (next + reasons.length) % reasons.length;
    setReason(reasons[j]);
    refs.current[j]?.focus();
  };

  return (
    <div className="flex flex-col">
      <SheetHeader title={requireComplaint ? "End trip with a complaint" : "Why are you cancelling?"} description={requireComplaint ? "A trip in progress can only be ended with a complaint, which goes straight to our safety team." : (feeNote ?? "Cancelling is free before your driver arrives.")} onClose={onClose} />
      <div role="radiogroup" aria-label={requireComplaint ? "Complaint category" : "Cancellation reason"} className="flex flex-col gap-2">
        {reasons.map((r, i) => {
          const checked = reason === r;
          return (
            <button
              key={r}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={checked}
              tabIndex={checked ? 0 : -1}
              onClick={() => setReason(r)}
              onKeyDown={(e) => onKey(e, i)}
              className={cn(
                "flex min-h-12 items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left text-sm font-medium ring-1 transition-[background-color,box-shadow] duration-150",
                checked ? "bg-brand-50 ring-2 ring-brand-400" : "bg-surface-2 ring-transparent hover:bg-surface-3",
              )}
            >
              {r}
              {checked && <Check size={16} strokeWidth={3} className="shrink-0" />}
            </button>
          );
        })}
      </div>
      {requireComplaint && <Textarea className="mt-4" placeholder="Describe what happened (at least 10 characters)" value={details} onChange={(e) => setDetails(e.target.value)} aria-label="Complaint details" />}
      <div className="mt-5 flex gap-2">
        <Button variant="secondary" size="lg" onClick={onClose} disabled={busy}>
          Keep ride
        </Button>
        <Button variant="danger" size="lg" loading={busy} disabled={!canSubmit} onClick={() => onConfirm(reason, requireComplaint ? { category: reason, details: details.trim() } : undefined)}>
          {requireComplaint ? "File and end trip" : "Cancel ride"}
        </Button>
      </div>
    </div>
  );
}
