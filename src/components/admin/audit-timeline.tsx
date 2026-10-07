"use client";

import * as React from "react";
import { ArrowLeft, ArrowRight, Ban, Clock, FileSearch, PowerOff, ScrollText, ShieldCheck, UserX, XCircle } from "lucide-react";
import type { AdminAuditLog } from "@/lib/api";
import { IconButton } from "@/components/ui/button";
import { EmptyState, Skeleton, type Tone } from "@/components/ui/primitives";
import { cn, formatDate, formatTime } from "@/lib/utils";
import { DRIVER_STATUS_LABELS, formatAuditTimestamp, isValidDate, relativeTime, shortId, statusLabel, statusTone } from "./driver-status";

/** One icon per status number, same order as DRIVER_STATUS_LABELS. */
const ICONS = [Clock, FileSearch, XCircle, Ban, UserX, ShieldCheck, PowerOff] as const;

const tiles: Record<Tone, string> = {
  neutral: "bg-surface-2 text-ink",
  brand: "bg-brand-100 text-brand-800",
  info: "bg-blue-50 text-blue-700",
  warning: "bg-amber-50 text-amber-800",
  danger: "bg-red-50 text-red-700",
  success: "bg-emerald-50 text-emerald-700",
  driver: "bg-orange-50 text-orange-800",
  ink: "bg-ink text-white",
};

function dayLabel(iso: string) {
  return isValidDate(iso) ? formatDate(iso, { weekday: "short", day: "numeric", month: "short", year: "numeric" }) : iso;
}

function Entry({ log }: { log: AdminAuditLog }) {
  const known = log.action in DRIVER_STATUS_LABELS;
  const Icon = known ? ICONS[log.action] : ScrollText;
  const tone = known ? statusTone(log.action) : "neutral";
  const valid = isValidDate(log.timeStampUtc);
  return (
    <li className="relative flex items-start gap-4 py-3 pl-7">
      <span className={cn("absolute -left-4 top-3 flex h-8 w-8 items-center justify-center rounded-full ring-4 ring-white", tiles[tone])} aria-hidden>
        <Icon size={15} strokeWidth={2.25} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold leading-snug">{known ? `Status set to ${statusLabel(log.action)}` : "Unknown action"}</p>
        <p className="mt-0.5 text-[13px] leading-snug text-muted">
          Driver{" "}
          <span className="font-medium text-ink-2" title={log.targetId}>
            {shortId(log.targetId)}
          </span>{" "}
          · by{" "}
          <span className="font-medium text-ink-2" title={log.actorId}>
            {shortId(log.actorId)}
          </span>
        </p>
        <p className="mt-0.5 text-[11px] text-muted/80">Log {log.id}</p>
      </div>
      <time dateTime={valid ? log.timeStampUtc : undefined} title={formatAuditTimestamp(log.timeStampUtc)} className="shrink-0 text-right text-[13px] tabular-nums text-ink-2">
        {valid ? formatTime(log.timeStampUtc) : log.timeStampUtc}
        {valid && <span className="block text-[11px] text-muted">{relativeTime(log.timeStampUtc)}</span>}
      </time>
    </li>
  );
}

/**
 * Audit log as a readable timeline grouped by day, ten entries a page. Times
 * are local; the full UTC stamp sits in the tooltip.
 */
export function AuditTimeline({ logs, loading, page, onPageChange }: { logs: AdminAuditLog[]; loading: boolean; page: number; onPageChange: (page: number) => void }) {
  const pageSize = 10;
  const pageCount = Math.max(1, Math.ceil(logs.length / pageSize));
  const visibleLogs = logs.slice((page - 1) * pageSize, page * pageSize);

  if (loading)
    return (
      <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading audit log">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[72px] rounded-card" />
        ))}
      </div>
    );

  if (logs.length === 0)
    return (
      <div className="rounded-card bg-white shadow-card ring-1 ring-line">
        <EmptyState icon={<ScrollText />} title="No audit entries yet" description="Every driver status change made by an admin is recorded here." compact />
      </div>
    );

  const groups: { day: string; items: AdminAuditLog[] }[] = [];
  for (const log of visibleLogs) {
    const day = dayLabel(log.timeStampUtc);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.items.push(log);
    else groups.push({ day, items: [log] });
  }

  return (
    <div className="rounded-card bg-white shadow-card ring-1 ring-line">
      <ol className="px-5 pb-2 pt-1">
        {groups.map((g) => (
          <li key={g.day}>
            <p className="pb-1 pt-4 text-[12px] font-semibold text-muted">{g.day}</p>
            <ol className="ml-4 border-l border-line">
              {g.items.map((log) => (
                <Entry key={log.id} log={log} />
              ))}
            </ol>
          </li>
        ))}
      </ol>
      <footer className="flex items-center justify-between gap-3 border-t border-line px-5 py-3">
        <p className="text-xs tabular-nums text-muted">
          Page {page} of {pageCount} · {logs.length} {logs.length === 1 ? "entry" : "entries"}
        </p>
        <div className="flex items-center gap-2">
          <IconButton label="Previous audit log page" variant="secondary" size="icon-sm" disabled={page === 1} onClick={() => onPageChange(page - 1)}>
            <ArrowLeft size={16} />
          </IconButton>
          <IconButton label="Next audit log page" variant="secondary" size="icon-sm" disabled={page === pageCount} onClick={() => onPageChange(page + 1)}>
            <ArrowRight size={16} />
          </IconButton>
        </div>
      </footer>
    </div>
  );
}
