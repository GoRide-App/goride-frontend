"use client";

import * as React from "react";
import { Users } from "lucide-react";
import type { AdminDriverActivity, InternalUser } from "@/lib/api";
import { Badge, EmptyState, Skeleton } from "@/components/ui/primitives";
import { Select } from "@/components/ui/field";
import { cn, formatDate, formatDateTime } from "@/lib/utils";
import { DRIVER_STATUS_LABELS, isValidDate, statusLabel, statusTone, vehicleTypeName } from "./driver-status";
import { VehicleThumb } from "./driver-table";

function Row({ label, value, warn }: { label: string; value: React.ReactNode; warn?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <dt className="shrink-0 text-[13px] text-muted">{label}</dt>
      <dd className={cn("min-w-0 text-right text-[13px] font-medium text-ink", warn && "font-semibold text-danger")}>{value}</dd>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5">
      <h4 className="text-[13px] font-semibold tracking-[-0.01em] text-ink">{title}</h4>
      <dl className="mt-1 divide-y divide-line">{children}</dl>
    </section>
  );
}

function dateOr(value: string | null | undefined, fallback: string, fn: (v: string) => string = formatDateTime) {
  if (!value) return fallback;
  return isValidDate(value) ? fn(value) : value;
}

const STATUS_OPTIONS = DRIVER_STATUS_LABELS.map((_, n) => ({ value: String(n), label: statusLabel(n) }));

/**
 * The selected driver: identity (from the internal-users lookup), vehicle and
 * licence, history, and the status control. Changing the select asks the
 * console to confirm; nothing is sent until the admin confirms.
 */
export function DriverDetail({
  driver,
  user,
  loading,
  statusUpdating,
  onRequestStatusChange,
  className,
}: {
  driver: AdminDriverActivity | null;
  user: InternalUser | null;
  loading: boolean;
  statusUpdating: boolean;
  onRequestStatusChange: (statusNum: number) => void;
  className?: string;
}) {
  const [now] = React.useState(() => Date.now());
  if (!driver)
    return (
      <EmptyState
        compact
        icon={<Users />}
        title="Select a driver"
        description="Pick a driver from the roster to review their details and change their status."
        className={cn("min-h-[320px]", className)}
      />
    );

  const skeleton = <Skeleton className="ml-auto h-4 w-28" />;
  const licenceExpired = isValidDate(driver.licenseExpiry) && new Date(driver.licenseExpiry).getTime() < now;
  const expiry = dateOr(driver.licenseExpiry, "—", formatDate);

  return (
    <div className={cn("flex flex-col", className)}>
      <header className="flex items-start gap-4">
        <VehicleThumb code={driver.vehicleTypeCode} size="lg" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[20px] font-semibold leading-tight tracking-[-0.015em]">
            {driver.vehicleMake} {driver.vehicleModel}
          </h3>
          <p className="mt-0.5 text-[13px] text-muted">
            <span className="font-semibold tabular-nums text-ink">{driver.vehiclePlate}</span> · {vehicleTypeName(driver.vehicleTypeCode)}
          </p>
          <div className="mt-2">
            <Badge tone={statusTone(driver.status)} dot size="md">
              {statusLabel(driver.status)}
            </Badge>
          </div>
        </div>
      </header>

      <div className="mt-5 rounded-2xl bg-surface-2 p-4">
        <Select
          label="Account status"
          value={String(driver.status)}
          disabled={statusUpdating}
          onChange={(event) => onRequestStatusChange(Number(event.target.value))}
          options={STATUS_OPTIONS}
          hint={statusUpdating ? "Updating status…" : "You'll be asked to confirm. Every change is written to the audit log."}
          className="bg-white"
        />
      </div>

      <Group title="Account">
        <Row label="Username" value={user?.username ?? (loading ? skeleton : "Unavailable")} />
        <Row label="Email" value={user?.email ?? (loading ? skeleton : "—")} />
        <Row label="Phone" value={user?.phone ?? (loading ? skeleton : "—")} />
        <Row label="Driver ID" value={<span className="break-all text-[12px] text-ink-2">{driver.driverId}</span>} />
      </Group>

      <Group title="Vehicle & licence">
        <Row label="Vehicle" value={`${driver.vehicleMake} ${driver.vehicleModel}`} />
        <Row label="Plate" value={<span className="tabular-nums">{driver.vehiclePlate}</span>} />
        <Row label="Type" value={vehicleTypeName(driver.vehicleTypeCode)} />
        <Row label="Licence number" value={<span className="tabular-nums">{driver.licenseNumber}</span>} />
        <Row label="Licence expiry" value={licenceExpired ? `Expired ${expiry}` : expiry} warn={licenceExpired} />
      </Group>

      <Group title="History">
        <Row label="Verified" value={dateOr(driver.verifiedAt, "Not verified yet")} />
        <Row label="Created" value={dateOr(driver.createdAt, "—")} />
        <Row label="Last updated" value={dateOr(driver.updatedAt, "—")} />
      </Group>
    </div>
  );
}
