"use client";

import * as React from "react";
import { Search } from "lucide-react";
import type { DriverStatus } from "@/types";
import { DRIVER_STATUS_META } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/primitives";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";

export type AdminActionType =
  | "Approve"
  | "Reject"
  | "Suspend"
  | "Deactivate"
  | "Reactivate";

/* ------------------------------------------------------------------ */
/* Status badges                                                        */
/* ------------------------------------------------------------------ */

export function DriverStatusBadge({
  status,
  online,
}: {
  status: DriverStatus;
  online?: boolean;
}) {
  const m = DRIVER_STATUS_META[status] ?? {
    label: status,
    tone: "neutral" as const,
  };
  return (
    <span className="inline-flex items-center gap-1.5">
      <Badge tone={m.tone}>{m.label}</Badge>
      {online && (
        <Badge tone="success" dot>
          Online
        </Badge>
      )}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Data table                                                           */
/* ------------------------------------------------------------------ */

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  className?: string;
  headerClassName?: string;
  width?: string;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  empty,
  loading,
  dense,
  className,
}: {
  columns: Column<T>[];
  rows: T[] | null;
  rowKey: (r: T) => string;
  onRowClick?: (r: T) => void;
  empty?: React.ReactNode;
  loading?: boolean;
  dense?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-card scrollbar-visible",
        className,
      )}
    >
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">
        <thead className="sticky top-0 z-10 bg-zinc-50 text-[11px] font-semibold uppercase tracking-wide text-muted">
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                className={cn(
                  "whitespace-nowrap border-b border-zinc-200 px-3 py-2.5 font-semibold",
                  c.headerClassName,
                )}
                style={c.width ? { width: c.width } : undefined}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading || !rows ? (
            Array.from({ length: 6 }).map((_, i) => (
              <tr key={i} className="border-b border-zinc-100 last:border-b-0">
                {columns.map((c) => (
                  <td key={c.key} className="px-3 py-3">
                    <div className="skeleton h-4 w-full max-w-[160px] rounded" />
                  </td>
                ))}
              </tr>
            ))
          ) : rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-3 py-10 text-center text-sm text-muted"
              >
                {empty ?? "Nothing to show"}
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr
                key={rowKey(r)}
                onClick={onRowClick ? () => onRowClick(r) : undefined}
                className={cn(
                  "border-b border-zinc-100 transition-colors last:border-b-0",
                  onRowClick && "cursor-pointer hover:bg-brand-50/40",
                )}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={cn(
                      "align-middle px-3",
                      dense ? "py-2" : "py-3",
                      c.className,
                    )}
                  >
                    {c.cell(r)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Toolbar                                                              */
/* ------------------------------------------------------------------ */

export function SearchBox({
  value,
  onChange,
  placeholder = "Search…",
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <Search
        size={16}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
      />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-lg border border-zinc-200 bg-white pl-9 pr-3 text-sm outline-none transition focus:ring-2 focus:ring-ink"
      />
    </div>
  );
}

export function FilterChips<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; count?: number }[];
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
              active
                ? "border-ink bg-ink text-white"
                : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400",
            )}
          >
            {o.label}
            {o.count != null && (
              <span
                className={cn(
                  "rounded-full px-1.5 text-[10px]",
                  active ? "bg-white/20" : "bg-zinc-100",
                )}
              >
                {o.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Reason dialog — every admin action requires a reason                */
/* ------------------------------------------------------------------ */

export const ACTION_COPY: Record<
  AdminActionType,
  {
    title: string;
    description: string;
    confirm: string;
    destructive?: boolean;
    targetStatus: DriverStatus;
  }
> = {
  Approve: {
    title: "Approve driver",
    description: "The driver profile becomes Active immediately.",
    confirm: "Approve",
    targetStatus: "Active",
  },
  Reject: {
    title: "Reject application",
    description: "The driver application status will be marked as Rejected.",
    confirm: "Reject",
    destructive: true,
    targetStatus: "Rejected",
  },
  Suspend: {
    title: "Suspend driver",
    description:
      "Temporarily blocks the driver from going online. Reversible.",
    confirm: "Suspend",
    destructive: true,
    targetStatus: "Suspended",
  },
  Deactivate: {
    title: "Deactivate driver",
    description:
      "Deactivates the account. Use only when necessary.",
    confirm: "Deactivate",
    destructive: true,
    targetStatus: "Deactivated",
  },
  Reactivate: {
    title: "Reactivate driver",
    description: "Restores a suspended or deactivated driver to Active.",
    confirm: "Reactivate",
    targetStatus: "Active",
  },
};

export function ReasonDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  destructive,
  placeholder = "Reason (required, recorded in the audit log)",
  minLength = 4,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void> | void;
  title: React.ReactNode;
  description?: React.ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  placeholder?: string;
  minLength?: number;
}) {
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const close = () => {
    setReason("");
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      title={title}
      description={description}
      position="fixed"
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant={destructive ? "danger" : "primary"}
            loading={busy}
            disabled={reason.trim().length < minLength}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm(reason.trim());
                setReason("");
              } finally {
                setBusy(false);
              }
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <Textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={placeholder}
        hint={`Minimum ${minLength} characters. Reason will be recorded in the database.`}
      />
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Page section                                                         */
/* ------------------------------------------------------------------ */

export function Panel({
  title,
  action,
  children,
  className,
  padded = true,
}: {
  title?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section
      className={cn(
        "rounded-xl border border-zinc-200 bg-white shadow-card",
        className,
      )}
    >
      {(title || action) && (
        <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
          {title && <h2 className="text-sm font-semibold">{title}</h2>}
          {action}
        </div>
      )}
      <div className={cn(padded && "p-4")}>{children}</div>
    </section>
  );
}
