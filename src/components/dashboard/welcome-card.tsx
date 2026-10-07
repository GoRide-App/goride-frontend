"use client";

import * as React from "react";
import Image from "next/image";
import type { Role } from "@/types";
import { VEHICLE_IMAGES } from "@/lib/constants";
import { cn } from "@/lib/utils";

/** "Good morning" / "Good afternoon" / "Good evening" from the local clock. */
export function greetingFor(date = new Date()) {
  const h = date.getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

const COPY: Record<Role, { lede: string; vehicle: string | null }> = {
  Rider: {
    lede: "Where to today? Your fare is shown in rupees before you book, and SOS is one tap away on every trip.",
    vehicle: VEHICLE_IMAGES.TUK,
  },
  Driver: {
    lede: "Ready for a shift? Open the driver console to go online and start receiving ride requests near you.",
    // The bike cut-out has clean edges on charcoal; the car asset's matte speckles on dark.
    vehicle: VEHICLE_IMAGES.BIKE,
  },
  Admin: {
    lede: "Keep the driver roster trustworthy: verify, suspend or reactivate drivers, and read the audit log.",
    vehicle: null,
  },
};

/**
 * The charcoal welcome card at the top of the dashboard: greeting, role pill,
 * one line of plain-language direction and (for riders and drivers) the
 * vehicle sitting on a taxi-yellow disc, the Waygo splash echo.
 */
export function WelcomeCard({ role, name, action, className }: { role: Role; name: string; action?: React.ReactNode; className?: string }) {
  const copy = COPY[role];
  return (
    <section aria-label="Welcome" className={cn("relative overflow-hidden rounded-card bg-navy-900 text-white", className)}>
      <div className={cn("relative flex flex-col gap-6 p-6 md:p-8", copy.vehicle && "sm:flex-row sm:items-end sm:justify-between")}>
        <div className="min-w-0 max-w-[38ch]">
          <h1 className="text-[28px] font-semibold leading-[1.1] tracking-[-0.02em] text-balance md:text-[34px]">
            {greetingFor()}, {name}.
          </h1>
          <p className="mt-2.5 text-[15px] leading-relaxed text-white/65 text-pretty">{copy.lede}</p>
          {action && <div className="mt-5">{action}</div>}
        </div>
        {copy.vehicle && (
          <div className="relative h-[130px] w-[190px] shrink-0 self-end sm:mb-[-4px] sm:h-[170px] sm:w-[250px]" aria-hidden>
            <span className="absolute left-1/2 top-1/2 h-[128px] w-[128px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-400 sm:h-[168px] sm:w-[168px]" />
            <Image src={copy.vehicle} alt="" width={250} height={170} priority className="relative h-full w-full object-contain drop-shadow-[0_18px_22px_rgba(0,0,0,0.5)]" />
          </div>
        )}
      </div>
    </section>
  );
}
