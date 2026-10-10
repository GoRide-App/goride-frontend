"use client";

import * as React from "react";
import Image from "next/image";
import { ChevronRight } from "lucide-react";
import type { AdminDriverActivity } from "@/lib/api";
import { Badge } from "@/components/ui/primitives";
import { cn, formatDate, formatDateTime } from "@/lib/utils";
import { isValidDate, relativeTime, statusLabel, statusTone, vehicleImage, vehicleTypeName } from "./driver-status";

interface RosterProps {
  drivers: AdminDriverActivity[];
  selectedId?: string | null;
  onSelect: (driver: AdminDriverActivity) => void;
}

/** Vehicle silhouette on a warm tile; used in the roster and the detail header. */
export function VehicleThumb({ code, size = "sm", className }: { code: string; size?: "sm" | "lg"; className?: string }) {
  return (
    <span className={cn("flex shrink-0 items-center justify-center rounded-2xl bg-surface-2", size === "sm" ? "h-10 w-14" : "h-16 w-24", className)} aria-hidden>
      <Image src={vehicleImage(code)} alt="" width={96} height={64} className={cn("object-contain", size === "sm" ? "h-8 w-12" : "h-14 w-20")} />
    </span>
  );
}

function LicenceCell({ expiry }: { expiry: string }) {
  const [now] = React.useState(() => Date.now());
  if (!isValidDate(expiry)) return <>{expiry}</>;
  const expired = new Date(expiry).getTime() < now;
  return <span className={cn(expired && "font-semibold text-danger")}>{expired ? `Expired ${formatDate(expiry)}` : formatDate(expiry)}</span>;
}

function Updated({ iso, prefix }: { iso: string; prefix?: string }) {
  if (!isValidDate(iso))
    return (
      <>
        {prefix}
        {iso}
      </>
    );
  return (
    <time dateTime={iso} title={formatDateTime(iso)}>
      {prefix}
      {relativeTime(iso)}
    </time>
  );
}

/** Desktop roster: a scannable table. Rows are keyboard-selectable. */
export function DriverTable({ drivers, selectedId, onSelect }: RosterProps) {
  return (
    <div className="hidden overflow-hidden rounded-card bg-white shadow-card ring-1 ring-line md:block">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-line text-[12px] font-semibold text-muted">
            <th scope="col" className="px-5 py-3">
              Driver
            </th>
            <th scope="col" className="px-4 py-3">
              Type
            </th>
            <th scope="col" className="px-4 py-3">
              Status
            </th>
            <th scope="col" className="hidden whitespace-nowrap px-4 py-3 2xl:table-cell">
              Licence
            </th>
            <th scope="col" className="whitespace-nowrap px-4 py-3">
              Updated
            </th>
            <th scope="col" className="w-12 px-3 py-3">
              <span className="sr-only">Open details</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {drivers.map((d) => {
            const selected = d.driverId === selectedId;
            return (
              <tr
                key={d.driverId}
                tabIndex={0}
                aria-selected={selected}
                onClick={() => onSelect(d)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(d);
                  }
                }}
                className={cn(
                  "cursor-pointer border-b border-line transition-colors duration-150 last:border-0 hover:bg-surface-2",
                  "focus-visible:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink",
                  selected && "bg-brand-50 hover:bg-brand-50",
                )}
              >
                <td className="px-5 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <VehicleThumb code={d.vehicleTypeCode} />
                    <div className="min-w-0">
                      <p className="truncate font-semibold">
                        {d.vehicleMake} {d.vehicleModel}
                      </p>
                      <p className="text-xs tabular-nums text-muted">{d.vehiclePlate}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-[13px] text-ink-2">{vehicleTypeName(d.vehicleTypeCode)}</td>
                <td className="px-4 py-3">
                  <Badge tone={statusTone(d.status)}>{statusLabel(d.status)}</Badge>
                </td>
                <td className="hidden whitespace-nowrap px-4 py-3 text-[13px] tabular-nums text-ink-2 2xl:table-cell">
                  <LicenceCell expiry={d.licenseExpiry} />
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-[13px] tabular-nums text-muted">
                  <Updated iso={d.updatedAt} />
                </td>
                <td className="px-3 py-3">
                  <ChevronRight size={18} className={cn("text-muted transition-colors", selected && "text-ink")} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Phone roster: one card per driver. */
export function DriverCards({ drivers, selectedId, onSelect }: RosterProps) {
  return (
    <ul className="flex flex-col gap-2 md:hidden">
      {drivers.map((d) => {
        const selected = d.driverId === selectedId;
        return (
          <li key={d.driverId}>
            <button
              type="button"
              onClick={() => onSelect(d)}
              aria-pressed={selected}
              className={cn(
                "flex w-full items-center gap-3 rounded-card bg-white p-3.5 text-left shadow-card ring-1 ring-line",
                "transition-[background-color,box-shadow] duration-150 active:bg-surface-2",
                selected && "ring-2 ring-brand-400",
              )}
            >
              <VehicleThumb code={d.vehicleTypeCode} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-[15px] font-semibold leading-snug">
                    {d.vehicleMake} {d.vehicleModel}
                  </span>
                  <Badge tone={statusTone(d.status)}>{statusLabel(d.status)}</Badge>
                </span>
                <span className="mt-0.5 block truncate text-[13px] leading-snug text-muted">
                  <span className="tabular-nums">{d.vehiclePlate}</span> · {vehicleTypeName(d.vehicleTypeCode)}
                </span>
                <span className="mt-0.5 block text-[12px] leading-snug text-muted">
                  <Updated iso={d.updatedAt} prefix="Updated " />
                </span>
              </span>
              <ChevronRight size={18} className="shrink-0 text-muted" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
