"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { Calendar, ChevronDown, Clock, CreditCard, History, Star, Wallet } from "lucide-react";
import type { Trip } from "@/types";
import { TRIP_STATUS_META, VEHICLE_IMAGES } from "@/lib/constants";
import { cn, formatDate, formatLKR, formatTime, relativeDay } from "@/lib/utils";
import { fades } from "@/components/ui/motion";
import { Badge, EmptyState, RouteRail, Skeleton } from "@/components/ui/primitives";

/** Ride history card: date · time · fare header, then the pickup → destination rail. */
export function TripCard({ trip, href, perspective = "rider", index = 0 }: { trip: Trip; href: string; perspective?: "rider" | "driver"; index?: number }) {
  const meta = TRIP_STATUS_META[trip.status];
  const other = perspective === "rider" ? trip.driver?.name : trip.rider?.name;
  const fare = trip.finalFare ?? trip.estimatedFare;
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...fades.normal, delay: Math.min(index, 8) * 0.05 }}>
      <Link href={href} className="block rounded-card bg-white p-4 shadow-card ring-1 ring-line transition-[transform,box-shadow] duration-200 ease-(--ease-spring) hover:shadow-float active:scale-[0.99]">
        <div className="flex items-center justify-between gap-2 text-xs font-medium text-muted tabular-nums">
          <span className="inline-flex items-center gap-1.5">
            <Calendar size={13} /> {formatDate(trip.requestedAt ?? trip.createdAt)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock size={13} /> {formatTime(trip.requestedAt ?? trip.createdAt)}
          </span>
          <span className="inline-flex items-center gap-1.5 font-semibold text-ink">
            {trip.payment?.method === "Card" ? <CreditCard size={13} /> : <Wallet size={13} />} {formatLKR(fare)}
          </span>
        </div>
        <div className="my-3 h-px bg-line" />
        <div className="flex items-stretch gap-3">
          <RouteRail stops={trip.stops.length} className="w-3.5" />
          <div className="flex min-w-0 flex-1 flex-col justify-between py-1">
            <p className="truncate text-sm font-semibold" title={trip.pickup.address}>
              {trip.pickup.name}
            </p>
            {trip.stops.map((s) => (
              <p key={s.id} className="truncate text-[13px] text-muted" title={s.address}>
                {s.name}
              </p>
            ))}
            <p className="truncate text-sm font-semibold" title={trip.destination.address}>
              {trip.destination.name}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end justify-between">
            <Badge tone={meta.tone}>{meta.label}</Badge>
            <div className="flex items-center gap-1.5">
              <Image src={VEHICLE_IMAGES[trip.vehicleTypeCode]} alt="" width={48} height={32} className="h-6 w-9 object-contain" />
              {trip.myRating && perspective === "rider" && (
                <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold tabular-nums">
                  <Star size={11} className="fill-brand-400 text-brand-400" /> {trip.myRating}
                </span>
              )}
            </div>
          </div>
        </div>
        {other && (
          <p className="mt-3 truncate text-[12px] text-muted">
            {perspective === "rider" ? "Driver" : "Rider"}: {other}
          </p>
        )}
      </Link>
    </motion.div>
  );
}

export function GroupedTripList({ trips, hrefFor, perspective = "rider", loading }: { trips: Trip[] | null; hrefFor: (id: string) => string; perspective?: "rider" | "driver"; loading?: boolean }) {
  const groups = React.useMemo(() => {
    const g: Record<string, Trip[]> = { Today: [], Yesterday: [], Earlier: [] };
    (trips ?? []).forEach((t) => g[relativeDay(t.requestedAt ?? t.createdAt)].push(t));
    return g;
  }, [trips]);

  if (loading || !trips) {
    return (
      <div className="space-y-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 rounded-card" />
        ))}
      </div>
    );
  }
  if (trips.length === 0) return <EmptyState icon={<History size={22} />} title="No trips yet" description={perspective === "rider" ? "Your completed and cancelled rides will appear here." : "Completed trips will appear here once you go online and accept rides."} />;

  let idx = 0;
  return (
    <div className="space-y-5">
      {(["Today", "Yesterday", "Earlier"] as const).map((label) => (
        <details key={label} open className="group">
          <summary className="mb-2 flex min-h-11 cursor-pointer select-none items-center justify-between rounded-xl text-[15px] font-semibold text-ink">
            <span>
              {label} <span className="ml-1 text-[13px] font-medium text-muted tabular-nums">({groups[label].length})</span>
            </span>
            <ChevronDown size={18} className="text-muted transition-transform duration-300 ease-(--ease-spring) group-open:rotate-180" />
          </summary>
          {groups[label].length === 0 ? (
            <p className={cn("py-2 text-center text-[13px] text-muted")}>No rides</p>
          ) : (
            <div className="space-y-2.5">
              {groups[label].map((t) => (
                <TripCard key={t.id} trip={t} href={hrefFor(t.id)} perspective={perspective} index={idx++} />
              ))}
            </div>
          )}
        </details>
      ))}
    </div>
  );
}
