"use client";

import * as React from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface DriverVehicleSummary {
  make: string;
  model: string;
  plate: string;
}

/**
 * The captain's main control. Charcoal with a yellow "Go online" pill while
 * offline; the whole card turns taxi-yellow once online, with a charcoal
 * "Go offline". `compact` is the single-row version shown during a trip.
 * `lockedReason` freezes the toggle (on a trip, or a finished trip not yet
 * paid) and says why, right under it.
 */
export function GoOnlineCard({
  online,
  busy,
  name,
  vehicle,
  compact,
  lockedReason,
  onChange,
}: {
  online: boolean;
  busy: boolean;
  name: string;
  vehicle?: DriverVehicleSummary | null;
  compact?: boolean;
  lockedReason?: string | null;
  onChange: (online: boolean) => void;
}) {
  const locked = !!lockedReason;
  const label = online ? "Go offline" : "Go online";
  const statusPill = (
    <span role="status" aria-live="polite" className={cn("inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold leading-none", online || locked ? "bg-ink/10 text-ink" : "bg-white/10 text-white/85")}>
      <span className={cn("h-2 w-2 rounded-full", online || locked ? "bg-ink animate-pulse-dot" : "bg-white/50")} aria-hidden />
      {locked ? "On a trip" : online ? "Online" : "Offline"}
    </span>
  );
  // A locked card is always on the yellow ground, so the note is ink.
  const lockNote = locked && (
    <p className="flex items-start gap-1.5 text-[12px] font-medium leading-snug text-ink/70 text-pretty">
      <Lock size={13} className="mt-px shrink-0" aria-hidden />
      {lockedReason}
    </p>
  );

  if (compact) {
    return (
      <div className={cn("flex flex-col gap-2 rounded-card p-3", online || locked ? "bg-brand-400 text-ink" : "bg-navy-900 text-white")}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {statusPill}
            {vehicle && <span className="truncate text-[13px] font-semibold tabular-nums">{vehicle.plate}</span>}
          </div>
          {/* Locked: there is nothing to toggle, so no button that reads "Go online" mid-trip. */}
          {!locked && (
            <Button size="sm" variant={online ? "dark" : "primary"} full={false} loading={busy} onClick={() => onChange(!online)}>
              {label}
            </Button>
          )}
        </div>
        {lockNote && <div className="px-1 pb-0.5">{lockNote}</div>}
      </div>
    );
  }

  return (
    <section aria-label="Availability" className={cn("rounded-card p-5 transition-colors duration-300 ease-out md:p-6", online || locked ? "bg-brand-400 text-ink shadow-glow" : "bg-navy-900 text-white")}>
      <div className="flex items-start justify-between gap-3">
        {statusPill}
        {vehicle && (
          <span className={cn("min-w-0 truncate text-right text-xs font-medium leading-tight", online || locked ? "text-ink/70" : "text-white/60")}>
            {vehicle.make} {vehicle.model} · <span className="font-semibold tabular-nums">{vehicle.plate}</span>
          </span>
        )}
      </div>
      <h2 className="mt-5 text-[26px] font-semibold leading-[1.1] tracking-[-0.02em] text-balance md:text-[28px]">
        {locked ? "You're on a trip" : online ? "You're online" : `Ready to drive, ${name}?`}
      </h2>
      <p className={cn("mt-2 text-[14px] leading-relaxed text-pretty", online || locked ? "text-ink/70" : "text-white/65")}>
        {locked
          ? "New ride requests pause until this trip is done."
          : online
            ? "We'll offer you ride requests near you. Keep this screen open while you wait."
            : "Go online to start receiving ride requests near your location."}
      </p>
      {!locked && (
        <Button
          className="mt-5"
          size="lg"
          variant={online ? "dark" : "primary"}
          arrow={!online}
          loading={busy}
          loadingText={online ? "Going offline…" : "Going online…"}
          onClick={() => onChange(!online)}
        >
          {label}
        </Button>
      )}
      {lockNote && <div className="mt-3">{lockNote}</div>}
    </section>
  );
}
