import type { Tone } from "@/components/ui/primitives";
import type { DriverStatus } from "@/types";
import { DRIVER_STATUS_META, VEHICLE_IMAGES, VEHICLE_TYPES } from "@/lib/constants";

/**
 * Numeric driver status as the admin API encodes it: the index in this array
 * IS the status number sent to `updateAdminDriverStatus`. Never reorder.
 */
export const DRIVER_STATUS_LABELS = [
  "PendingVerification",
  "DocumentReview",
  "Rejected",
  "Suspended",
  "Deactivated",
  "Active",
  "Offline",
] as const;

export function statusKey(n: number): DriverStatus | undefined {
  return DRIVER_STATUS_LABELS[n];
}

/** Plain-language label ("Pending verification", "Under review", …). */
export function statusLabel(n: number): string {
  const key = statusKey(n);
  return key ? DRIVER_STATUS_META[key].label : "Unknown";
}

export function statusTone(n: number): Tone {
  const key = statusKey(n);
  return key ? DRIVER_STATUS_META[key].tone : "neutral";
}

/** Statuses that take a driver off the road; the confirm dialog goes red for these. */
export const DESTRUCTIVE_STATUSES = new Set<number>([2, 3, 4]);

export function vehicleTypeName(code: string) {
  return VEHICLE_TYPES.find((v) => v.code === code)?.name ?? code;
}

export function vehicleImage(code: string) {
  return VEHICLE_IMAGES[code] ?? VEHICLE_IMAGES.CAR;
}

/** Long opaque ids read better shortened; the full id stays in a title. */
export function shortId(id: string) {
  return id.length > 16 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id;
}

/** The original dashboard's UTC stamp, kept for tooltips. */
export function formatAuditTimestamp(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : `${date.toISOString().replace("T", " ").slice(0, 19)} UTC`;
}

export function isValidDate(value: string) {
  return !Number.isNaN(new Date(value).getTime());
}

const rtf = typeof Intl !== "undefined" && "RelativeTimeFormat" in Intl ? new Intl.RelativeTimeFormat("en", { numeric: "auto" }) : null;
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["minute", 60],
  ["hour", 3600],
  ["day", 86_400],
  ["week", 604_800],
  ["month", 2_629_800],
  ["year", 31_557_600],
];

/** "7 days ago", "3 hours ago", "just now": full words, for operators scanning a list. */
export function relativeTime(iso: string, now = Date.now()) {
  const diff = (new Date(iso).getTime() - now) / 1000;
  const abs = Math.abs(diff);
  if (abs < 45) return "just now";
  let unit: Intl.RelativeTimeFormatUnit = "minute";
  let value = diff / 60;
  for (const [u, s] of UNITS) {
    if (abs >= s) {
      unit = u;
      value = diff / s;
    }
  }
  const rounded = Math.round(value);
  if (rtf) return rtf.format(rounded, unit);
  const n = Math.abs(rounded);
  return `${n} ${unit}${n === 1 ? "" : "s"} ${diff < 0 ? "ago" : "from now"}`;
}
