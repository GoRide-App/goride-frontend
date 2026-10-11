"use client";

import * as React from "react";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, Check, Clock3, CreditCard, MessageSquare, Phone, Route, Siren, Users, Wallet } from "lucide-react";
import type { FareEstimate, Payment, Trip, TripDriverSummary, VehicleType } from "@/types";
import { cn, formatKm, formatLKR, formatMinutes } from "@/lib/utils";
import { VEHICLE_IMAGES } from "@/lib/constants";
import { IconButton } from "@/components/ui/button";
import { easeOut, fadeOnly, fades, itemVariants } from "@/components/ui/motion";
import { Avatar, Badge, RatingInline, RouteStops } from "@/components/ui/primitives";

/* ------------------------------------------------------------------ */
/* Availability: only the Tuk Tuk is bookable in this stage             */
/* ------------------------------------------------------------------ */

export function isTukCode(code: string) {
  return code === "TUK" || code === "TUKTUK";
}

/** The API may say so explicitly; until it does, only the Tuk Tuk is bookable. */
export function isVehicleAvailable(code: string, estimate?: FareEstimate | null) {
  return estimate?.available ?? isTukCode(code);
}

export function vehicleDisplayName(vt: Pick<VehicleType, "code" | "name">, estimate?: FareEstimate | null) {
  return estimate?.displayName ?? (isTukCode(vt.code) ? "Tuk Tuk" : vt.name);
}

/* ------------------------------------------------------------------ */
/* Vehicle glyph: the same 24-grid strokes the map markers use          */
/* ------------------------------------------------------------------ */

export function VehicleGlyph({ code, size = 18, className }: { code: string; size?: number; className?: string }) {
  const key = code === "XL" ? "CAR" : code === "TUKTUK" ? "TUK" : code;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={cn("shrink-0", className)}>
      {key === "BIKE" ? (
        <>
          <circle cx="18.5" cy="17.5" r="3.5" />
          <circle cx="5.5" cy="17.5" r="3.5" />
          <circle cx="15" cy="5" r="1" />
          <path d="M12 17.5V14l-3-3 4-3 2 3h2" />
        </>
      ) : key === "TUK" ? (
        <>
          <path d="M4 16V9.5A2.5 2.5 0 0 1 6.5 7H14l4.5 4.5H20a1 1 0 0 1 1 1V16" />
          <path d="M6.5 7 7.5 4.5H13" />
          <path d="M14 7v4.5H4" />
          <circle cx="7.5" cy="17" r="2" />
          <circle cx="16.5" cy="17" r="2" />
          <path d="M9.5 17h5" />
        </>
      ) : (
        <>
          <path d="m21 8-2 2-1.5-3.7A2 2 0 0 0 15.646 5H8.4a2 2 0 0 0-1.903 1.257L5 10 3 8" />
          <path d="M7 14h.01" />
          <path d="M17 14h.01" />
          <rect width="18" height="8" x="3" y="10" rx="2" />
          <path d="M5 18v2" />
          <path d="M19 18v2" />
        </>
      )}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Phase motion: one grammar for every panel swap                      */
/* ------------------------------------------------------------------ */

/** Cross-fade + 12px rise on enter, quieter fall on exit (~220ms). Opacity only under reduced motion. */
export function usePhaseMotion() {
  const reduce = useReducedMotion();
  return React.useMemo(
    () =>
      reduce
        ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0, transition: fades.exit }, transition: fades.fast }
        : {
            initial: { opacity: 0, y: 12 },
            animate: { opacity: 1, y: 0 },
            exit: { opacity: 0, y: -8, transition: fades.exit },
            transition: { duration: 0.22, ease: easeOut },
          },
    [reduce],
  );
}

/** Item variant for staggered lists that honours reduced motion. */
export function useListItemVariants() {
  const reduce = useReducedMotion();
  return reduce ? fadeOnly : itemVariants;
}

/* ------------------------------------------------------------------ */
/* Trip route summary (pickup → stops → destination)                    */
/* ------------------------------------------------------------------ */

export function TripRoute({ trip, compact, className }: { trip: Pick<Trip, "pickup" | "destination" | "stops">; compact?: boolean; className?: string }) {
  const items = [
    { label: compact ? undefined : "Pickup", value: trip.pickup.name },
    ...trip.stops.map((s, i) => ({ label: compact ? undefined : `Stop ${i + 1}`, value: s.name })),
    { label: compact ? undefined : "Drop-off", value: trip.destination.name },
  ];
  return <RouteStops items={items} className={cn(compact && "[&_.min-h-14]:min-h-12", className)} />;
}

export function TripMeta({ distanceKm, durationMin, className }: { distanceKm: number; durationMin: number; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5 whitespace-nowrap text-xs font-medium text-muted tabular-nums", className)}>
      <span className="inline-flex items-center gap-1">
        <Route size={13} className="shrink-0" /> {formatKm(distanceKm)}
      </span>
      <span className="h-3 w-px shrink-0 bg-surface-3" aria-hidden />
      <span className="inline-flex items-center gap-1">
        <Clock3 size={13} className="shrink-0" /> {formatMinutes(durationMin)}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Headline + status for the live phases                                */
/* ------------------------------------------------------------------ */

export function StatusHeadline({ title, description, right, className }: { title: React.ReactNode; description?: React.ReactNode; right?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        <h2 className="text-xl font-semibold leading-tight tracking-[-0.015em] text-balance">{title}</h2>
        {description && <p className="mt-1 text-[13px] leading-snug text-muted text-pretty">{description}</p>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}

/** Big tabular ETA that never shifts layout as the number changes. */
export function EtaTile({ minutes, label = "min", className }: { minutes: number; label?: string; className?: string }) {
  return (
    <div className={cn("flex min-w-[64px] flex-col items-center justify-center rounded-2xl bg-ink px-3 py-2 text-white", className)} aria-label={`${Math.max(1, Math.round(minutes))} minutes`}>
      <span className="text-[22px] font-semibold leading-none tracking-[-0.02em] tabular-nums">{Math.max(1, Math.round(minutes))}</span>
      <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-brand-300">{label}</span>
    </div>
  );
}

export function InlineAlert({ children, tone = "danger", className }: { children: React.ReactNode; tone?: "danger" | "warning"; className?: string }) {
  return (
    <p role="alert" className={cn("flex items-start gap-2 rounded-2xl px-3.5 py-3 text-[13px] font-medium leading-snug", tone === "danger" ? "bg-red-50 text-danger" : "bg-amber-50 text-amber-800", className)}>
      <AlertTriangle size={16} className="mt-px shrink-0" />
      <span className="text-pretty">{children}</span>
    </p>
  );
}

export function FareRow({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center justify-between rounded-2xl bg-surface-2 px-4 py-3 text-sm", className)}>
      <span className="text-muted">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Vehicle option (the fare list card)                                  */
/* ------------------------------------------------------------------ */

export function VehicleOption({ vt, estimate, selected, onSelect }: { vt: VehicleType; estimate?: FareEstimate; selected: boolean; onSelect: () => void }) {
  const variants = useListItemVariants();
  const available = isVehicleAvailable(vt.code, estimate);
  const name = vehicleDisplayName(vt, estimate);

  return (
    <motion.li variants={variants} className="list-none">
      <button
        type="button"
        onClick={available ? onSelect : undefined}
        disabled={!available}
        aria-pressed={selected}
        className={cn(
          "relative flex w-full items-center gap-3 rounded-card p-3 text-left ring-1 transition-[background-color,box-shadow,transform] duration-200 ease-(--ease-spring)",
          selected ? "bg-brand-50 ring-2 ring-brand-400 shadow-[0_14px_32px_-20px_rgba(255,194,26,0.95)]" : "bg-white ring-line",
          available && !selected && "hover:bg-surface-2 active:scale-[0.99]",
          !available && "cursor-not-allowed bg-surface-2/60",
        )}
      >
        <span className="flex h-16 w-24 shrink-0 items-center justify-center">
          <Image src={VEHICLE_IMAGES[vt.code] ?? "/vehicles/car.png"} alt="" width={96} height={64} className={cn("h-14 w-24 object-contain transition-transform duration-300 ease-(--ease-spring)", selected && "scale-105", !available && "opacity-55 grayscale")} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className={cn("text-[15px] font-semibold leading-tight", !available && "text-muted")}>{name}</span>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-muted tabular-nums">
              <Users size={12} /> {vt.capacity}
            </span>
          </span>
          <span className="mt-0.5 block truncate text-[13px] leading-snug text-muted">{vt.description}</span>
          <span className="mt-1.5 block">
            {available ? (
              estimate && <span className="text-xs font-semibold text-brand-800 tabular-nums">{estimate.etaMin > 0 ? `${estimate.etaMin} min away` : "Searching a wider area"}</span>
            ) : (
              <Badge tone="neutral">Not available yet</Badge>
            )}
          </span>
        </span>
        <span className="shrink-0 self-start text-right">
          <span className={cn("block text-[17px] font-semibold leading-tight tracking-[-0.01em] tabular-nums", !available && "text-muted")}>{estimate ? formatLKR(estimate.estimatedFare) : "Rs —"}</span>
          <span className="block text-[11px] text-muted">estimate</span>
        </span>
        {selected && (
          <span className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-brand-400 text-ink ring-[3px] ring-white" aria-hidden>
            <Check size={13} strokeWidth={3} />
          </span>
        )}
      </button>
    </motion.li>
  );
}

/* ------------------------------------------------------------------ */
/* Driver ticket                                                        */
/* ------------------------------------------------------------------ */

/** Number-plate style chip: white plate, charcoal frame, yellow band. */
export function PlateChip({ plate, className }: { plate: string; className?: string }) {
  return (
    <span className={cn("inline-flex shrink-0 items-stretch overflow-hidden rounded-lg bg-white ring-2 ring-ink", className)} aria-label={`Plate ${plate}`}>
      <span className="w-2 bg-brand-400" aria-hidden />
      <span className="px-2.5 py-1 text-sm font-bold leading-6 tracking-[0.08em] tabular-nums">{plate}</span>
    </span>
  );
}

function TicketDivider() {
  return (
    <div className="relative mx-4 border-t border-dashed border-ink/15" aria-hidden>
      <span className="absolute -left-[23px] -top-[7px] h-[14px] w-[14px] rounded-full bg-white" />
      <span className="absolute -right-[23px] -top-[7px] h-[14px] w-[14px] rounded-full bg-white" />
    </div>
  );
}

export function DriverCard({ driver, className, contact = true }: { driver: TripDriverSummary; className?: string; contact?: boolean }) {
  const vehicle = [driver.vehicleColor, driver.vehicleMake, driver.vehicleModel].filter(Boolean).join(" ");
  return (
    <div className={cn("rounded-card bg-surface-2 ring-1 ring-line", className)}>
      <div className="flex items-center gap-3 p-4">
        <Avatar name={driver.name} src={driver.photoUrl} size="lg" className="ring-4 ring-white" />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-[17px] font-semibold leading-tight tracking-[-0.01em] text-balance">{driver.name}</p>
          <RatingInline value={driver.rating} count={driver.ratingCount} className="mt-1" />
        </div>
        <PlateChip plate={driver.vehiclePlate} />
      </div>
      <TicketDivider />
      <div className="flex items-center gap-3 p-4 pt-3.5">
        <Image src={VEHICLE_IMAGES[driver.vehicleTypeCode] ?? "/vehicles/car.png"} alt="" width={96} height={64} className="h-12 w-[72px] shrink-0 object-contain" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium leading-none text-muted">Look for this vehicle</p>
          <p className="mt-1 line-clamp-2 text-sm font-semibold leading-snug">{vehicle}</p>
        </div>
        {contact && (
          <div className="flex shrink-0 gap-2">
            {/* Button's href branch renders a Link without the aria-label, so the name travels as sr-only text. */}
            <IconButton label="Message driver" variant="white" href={`sms:${driver.phone ?? ""}`}>
              <MessageSquare size={18} />
              <span className="sr-only">Message driver</span>
            </IconButton>
            <IconButton label="Call driver" variant="dark" href={`tel:${driver.phone ?? ""}`}>
              <Phone size={18} />
              <span className="sr-only">Call driver</span>
            </IconButton>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Trip progress (in progress)                                          */
/* ------------------------------------------------------------------ */

export function TripProgress({ fraction, from, to, className }: { fraction: number; from: string; to: string; className?: string }) {
  const reduce = useReducedMotion();
  const pct = Math.round(Math.min(1, Math.max(0, fraction)) * 100);
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="h-2 w-full overflow-hidden rounded-full bg-surface-3" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Trip progress">
        <motion.div className="h-full rounded-full bg-brand-400" initial={false} animate={{ width: `${pct}%` }} transition={reduce ? { duration: 0 } : { duration: 0.6, ease: easeOut }} />
      </div>
      <div className="flex items-center justify-between gap-3 text-[11px] font-medium text-muted">
        <span className="truncate">{from}</span>
        <span className="shrink-0 tabular-nums">{pct}%</span>
        <span className="truncate text-right">{to}</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Fare rows & receipt                                                  */
/* ------------------------------------------------------------------ */

function breakdownRows(b: Payment["breakdown"], meta?: { distanceKm?: number; durationMin?: number }) {
  const km = meta?.distanceKm != null ? ` · ${formatKm(meta.distanceKm)}` : "";
  const min = meta?.durationMin != null ? ` · ${formatMinutes(meta.durationMin)}` : "";
  return [
    ["Base fare", b.base],
    [`Distance${km}`, b.distance],
    [`Time${min}`, b.time],
    ...(b.stops ? [["Stops", b.stops] as const] : []),
    ...(b.waiting ? [["Waiting", b.waiting] as const] : []),
  ] as const;
}

export function FareBreakdownList({ payment, estimate, className }: { payment?: Payment | null; estimate?: FareEstimate | null; className?: string }) {
  const b = payment?.breakdown ?? estimate?.breakdown;
  if (!b) return null;
  const rows = breakdownRows(b, estimate ? { distanceKm: estimate.distanceKm, durationMin: estimate.durationMin } : undefined);
  return (
    <dl className={cn("text-sm tabular-nums", className)}>
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-baseline justify-between gap-3 py-1.5 text-muted">
          <dt>{k}</dt>
          <dd className="font-medium text-ink">{formatLKR(v)}</dd>
        </div>
      ))}
      <div className="mt-1 flex items-baseline justify-between gap-3 border-t border-dashed border-ink/15 pt-2.5 font-semibold">
        <dt>{payment ? "Final fare" : "Estimated fare"}</dt>
        <dd>{formatLKR(b.total)}</dd>
      </div>
      {payment && payment.estimatedFare !== payment.finalFare && <p className="mt-2 text-[11px] leading-snug text-muted text-pretty">Estimate was {formatLKR(payment.estimatedFare)}. The final fare reflects the actual distance and time driven.</p>}
    </dl>
  );
}

/** Charcoal receipt: the total on top, the itemised rows below a perforation. */
export function FareReceipt({ payment, trip, className }: { payment: Payment; trip: Pick<Trip, "distanceKm" | "durationMin">; className?: string }) {
  const rows = breakdownRows(payment.breakdown, { distanceKm: trip.distanceKm, durationMin: trip.durationMin });
  return (
    <div className={cn("rounded-card bg-ink p-5 text-white", className)}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/60">Final fare</p>
      <p className="mt-2 text-[34px] font-semibold leading-none tracking-[-0.02em] tabular-nums">{formatLKR(payment.finalFare)}</p>
      <p className="mt-2 text-xs text-white/60">{payment.estimatedFare !== payment.finalFare ? `Estimate was ${formatLKR(payment.estimatedFare)} · based on the distance and time driven` : "Matches your estimate"}</p>
      <dl className="mt-5 border-t border-dashed border-white/20 pt-3 text-sm tabular-nums">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-3 py-1.5">
            <dt className="text-white/70">{k}</dt>
            <dd className="font-medium">{formatLKR(v)}</dd>
          </div>
        ))}
        <div className="mt-1.5 flex items-baseline justify-between gap-3 border-t border-white/15 pt-3 font-semibold">
          <dt>Total</dt>
          <dd className="text-brand-300">{formatLKR(payment.breakdown.total)}</dd>
        </div>
      </dl>
    </div>
  );
}

export function PaymentMethodRow({ method, className }: { method: Payment["method"]; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-semibold", className)}>
      {method === "Card" ? <CreditCard size={14} /> : <Wallet size={14} />}
      {method ?? "Not selected"}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* SOS floating button (hold 1.2s, or Enter/Space)                      */
/* ------------------------------------------------------------------ */

export function SosButton({ onTrigger, className, armed }: { onTrigger: () => void; className?: string; armed?: boolean }) {
  const reduce = useReducedMotion();
  const [holding, setHolding] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const timer = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setHolding(false);
    setProgress(0);
  };
  const start = () => {
    setHolding(true);
    const t0 = Date.now();
    timer.current = setInterval(() => {
      const p = Math.min(1, (Date.now() - t0) / 1200);
      setProgress(p);
      if (p >= 1) {
        stop();
        onTrigger();
      }
    }, 40);
  };
  return (
    <div className={cn("flex flex-col items-center gap-1.5", className)}>
      <button
        type="button"
        aria-label="Hold to send SOS"
        aria-pressed={armed || undefined}
        onPointerDown={start}
        onPointerUp={stop}
        onPointerLeave={stop}
        onPointerCancel={stop}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onTrigger();
          }
        }}
        className={cn(
          "relative flex h-14 w-14 select-none items-center justify-center rounded-full bg-danger text-white shadow-float ring-4 ring-white/85 transition-[transform,box-shadow] duration-150 active:scale-95",
          armed && "ring-red-200",
        )}
        style={{ touchAction: "none" }}
      >
        <AnimatePresence>
          {armed && !reduce && <motion.span key="pulse" aria-hidden className="absolute inset-0 rounded-full bg-danger/50" initial={{ scale: 1, opacity: 0.7 }} animate={{ scale: 1.9, opacity: 0 }} exit={{ opacity: 0 }} transition={{ duration: 1.2, repeat: Infinity, ease: "easeOut" }} />}
        </AnimatePresence>
        <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 56 56" aria-hidden>
          <circle cx="28" cy="28" r="25" fill="none" stroke="rgba(255,255,255,.25)" strokeWidth="3" />
          <circle cx="28" cy="28" r="25" fill="none" stroke="#fff" strokeWidth="3" strokeDasharray={`${2 * Math.PI * 25}`} strokeDashoffset={`${2 * Math.PI * 25 * (1 - progress)}`} strokeLinecap="round" />
        </svg>
        {holding ? <span className="relative text-[10px] font-bold tracking-wide">HOLD</span> : <Siren size={22} className="relative" />}
      </button>
      <span className={cn("rounded-full bg-white px-2.5 py-1 text-[10px] font-bold tracking-[0.08em] shadow-card", armed ? "text-ink" : "text-danger")}>{armed ? "SENT" : "SOS"}</span>
    </div>
  );
}
