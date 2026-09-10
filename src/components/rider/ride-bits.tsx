"use client";

import * as React from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { Clock3, Route, Users } from "lucide-react";
import type { FareEstimate, VehicleType } from "@/types";
import { cn, formatKm, formatLKR, formatMinutes } from "@/lib/utils";
import { VEHICLE_IMAGES } from "@/lib/constants";

export function TripMeta({ distanceKm, durationMin, className }: { distanceKm: number; durationMin: number; className?: string }) {
  return (
    <div className={cn("flex items-center gap-3 text-xs font-semibold text-muted", className)}>
      <span className="inline-flex items-center gap-1">
        <Route size={13} /> {formatKm(distanceKm)}
      </span>
      <span className="h-3 w-px bg-zinc-300" />
      <span className="inline-flex items-center gap-1">
        <Clock3 size={13} /> {formatMinutes(durationMin)}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Vehicle option (theme's SelectVehicle card) — SCRUM-53/54             */
/* ------------------------------------------------------------------ */

export function VehicleOption({ vt, estimate, selected, onSelect, index = 0 }: { vt: VehicleType; estimate?: FareEstimate; selected: boolean; onSelect: () => void; index?: number }) {
  // Only TukTuk is bookable in this stage -- every other vehicle type is
  // display-only, even though its fare is real (calculated by
  // goride-trip-matching, same as TukTuk's).
  const isTuk = vt.code === "TUK" || (vt.code as string) === "TUKTUK";
  const isAvailable = isTuk;
  const displayName = isTuk ? "Tuk Tuk" : vt.name;

  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, type: "spring", stiffness: 320, damping: 28 }}
      onClick={isAvailable ? onSelect : undefined}
      disabled={!isAvailable}
      aria-pressed={selected}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border-[3px] bg-surface-2/70 px-2 py-2 text-left transition-all duration-150",
        !isAvailable && "opacity-60 cursor-not-allowed",
        selected ? "border-ink bg-white shadow-card" : isAvailable ? "border-transparent hover:border-zinc-300" : "border-transparent",
      )}
    >
      <Image src={VEHICLE_IMAGES[vt.code] ?? "/vehicles/car.png"} alt={displayName} width={96} height={64} className={cn("h-14 w-24 shrink-0 object-contain mix-blend-multiply transition-transform", selected && "scale-105")} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="text-[15px] font-semibold leading-tight">{displayName}</span>
          <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-muted">
            <Users size={11} /> {vt.capacity}
          </span>
          {!isAvailable && (
            <span className="rounded bg-zinc-200 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-600">
              Unavailable
            </span>
          )}
        </span>
        <span className="block truncate text-xs font-normal text-muted">{vt.description}</span>
      </span>
      <span className="shrink-0 text-right">
        <span className="block text-[15px] font-bold">{estimate ? formatLKR(estimate.estimatedFare) : "—"}</span>
        <span className="block text-[10px] font-medium text-muted">estimate</span>
      </span>
    </motion.button>
  );
}
