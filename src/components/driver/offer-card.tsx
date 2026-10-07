"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import type { LiveDriverOffer } from "@/lib/api/live-matching";
import { DRIVER_OFFER_TTL_SECONDS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { fades, popIn, springs } from "@/components/ui/motion";
import { cn } from "@/lib/utils";

export function money(n?: number | null) {
  return n == null ? null : `Rs ${n.toLocaleString()}`;
}

/** How long the backend gave the driver to answer, from the offer itself. */
export function offerWindowSeconds(offer: LiveDriverOffer) {
  const start = new Date(offer.createdAt).getTime();
  const end = new Date(offer.expiresAt).getTime();
  const seconds = Math.round((end - start) / 1000);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : DRIVER_OFFER_TTL_SECONDS;
}

function CountdownRing({ seconds, total }: { seconds: number; total: number }) {
  const r = 24;
  const c = 2 * Math.PI * r;
  const frac = Math.max(0, Math.min(1, total ? seconds / total : 0));
  const urgent = seconds <= 5;
  return (
    <div className="relative flex h-16 w-16 shrink-0 items-center justify-center" role="timer" aria-live="off" aria-label={`${seconds} seconds to accept`}>
      <svg viewBox="0 0 56 56" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden>
        <circle cx="28" cy="28" r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="4" />
        <circle
          cx="28"
          cy="28"
          r={r}
          fill="none"
          stroke={urgent ? "#ff8a8c" : "#ffc21a"}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - frac)}
          className="transition-[stroke-dashoffset,stroke] duration-1000 ease-linear"
        />
      </svg>
      <span className={cn("text-[17px] font-semibold leading-none tabular-nums", urgent && "text-[#ff8a8c]")}>{seconds}</span>
    </div>
  );
}

function RouteRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-14 items-center py-2.5">
      <span className="min-w-0">
        <span className="block text-[11px] font-medium leading-none text-white/55">{label}</span>
        <span className="mt-1 block truncate text-[15px] font-semibold leading-snug">{value}</span>
      </span>
    </div>
  );
}

/**
 * An incoming ride request. Urgent but calm: the fare leads, the pickup and
 * drop-off read as a route, the ring counts down, and Accept is the one yellow
 * action. "Not now" hides the request on this screen; it still expires on its
 * own (the matching service has no decline call).
 */
export function OfferCard({
  offer,
  secondsLeft,
  accepting,
  disabled,
  onAccept,
  onDismiss,
  acceptInFooter,
}: {
  offer: LiveDriverOffer;
  secondsLeft: number;
  accepting: boolean;
  disabled: boolean;
  onAccept: () => void;
  onDismiss: () => void;
  /** Phones: Accept lives in the pinned panel footer so it is reachable at the sheet's resting height. */
  acceptInFooter?: boolean;
}) {
  const reduce = useReducedMotion();
  const total = offerWindowSeconds(offer);
  const fare = money(offer.fare);
  return (
    <motion.article
      layout={!reduce}
      initial={reduce ? { opacity: 0 } : popIn.initial}
      animate={reduce ? { opacity: 1 } : popIn.animate}
      exit={reduce ? { opacity: 0, transition: fades.exit } : popIn.exit}
      transition={reduce ? fades.fast : springs.soft}
      aria-label="New ride request"
      className="rounded-card bg-navy-900 p-5 text-white shadow-float"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-brand-300">New ride request</p>
          {fare ? (
            <p className="mt-1.5 text-[32px] font-semibold leading-none tracking-[-0.02em] tabular-nums">{fare}</p>
          ) : (
            <p className="mt-1.5 text-[22px] font-semibold leading-none tracking-[-0.02em]">Fare set on completion</p>
          )}
          <p className="mt-2 text-[13px] tabular-nums text-white/60">{offer.distanceKm.toFixed(1)} km to the pickup</p>
        </div>
        <CountdownRing seconds={secondsLeft} total={total} />
      </div>

      <div className="mt-4 flex items-stretch gap-3 rounded-2xl bg-white/[0.06] px-4">
        <div className="flex w-3.5 flex-col items-center self-stretch py-[18px]" aria-hidden>
          <span className="h-3 w-3 shrink-0 rounded-full border-[3px] border-white bg-navy-900" />
          <span className="w-0 flex-1 border-l-2 border-dotted border-white/35" />
          <span className="h-3.5 w-3.5 shrink-0 rounded-[4px] border-[3px] border-white bg-brand-400" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col divide-y divide-white/10">
          <RouteRow label="Pickup" value={offer.pickupLocation ?? "Pickup point"} />
          <RouteRow label="Drop-off" value={offer.dropoffLocation ?? "Destination"} />
        </div>
      </div>

      <div className={cn("mt-4 flex gap-2", acceptInFooter && "mt-3 justify-end")}>
        {!acceptInFooter && (
          <Button size="lg" variant="primary" arrow arrowIcon={<Check strokeWidth={3} />} loading={accepting} loadingText="Accepting…" disabled={disabled} onClick={onAccept} className="flex-1">
            Accept ride
          </Button>
        )}
        <Button
          size={acceptInFooter ? "sm" : "lg"}
          variant="ghost"
          full={false}
          disabled={accepting}
          onClick={onDismiss}
          className={cn("text-white hover:bg-white/10 active:bg-white/15 focus-visible:outline-brand-400", acceptInFooter ? "px-4" : "px-5")}
        >
          Not now
        </Button>
      </div>
    </motion.article>
  );
}

/** Online, nothing offered yet: a calm listening state with the radar pulse. */
export function ListeningCard({ near }: { near: string | null }) {
  return (
    <div className="flex items-center gap-3 rounded-card bg-white p-4 shadow-card ring-1 ring-line" role="status">
      <span className="relative flex h-11 w-11 shrink-0 items-center justify-center" aria-hidden>
        <span className="absolute inset-0 rounded-full bg-brand-400/40 animate-pin-pulse" />
        <span className="absolute inset-2 rounded-full bg-brand-400/35 [animation-delay:0.7s] animate-pin-pulse" />
        <span className="relative h-3 w-3 rounded-full bg-brand-500 ring-4 ring-white" />
      </span>
      <div className="min-w-0">
        <p className="text-[15px] font-semibold leading-snug">Listening for ride requests</p>
        <p className="mt-0.5 text-[13px] leading-snug text-muted text-pretty">{near ? `Requests near ${near} appear here as riders book.` : "Requests near you appear here as riders book."}</p>
      </div>
    </div>
  );
}
