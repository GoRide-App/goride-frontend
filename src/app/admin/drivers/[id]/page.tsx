"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Ban,
  Car,
  CheckCircle2,
  Clock,
  FileCheck2,
  FileText,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  XCircle,
} from "lucide-react";
import type { DriverStatus } from "@/types";
import {
  getAdminDriverById,
  updateAdminDriverStatus,
  type DriverAccountAdminDto,
} from "@/lib/api";
import { ROUTES, VEHICLE_IMAGES } from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/utils";
import { useSetAdminHeader } from "@/components/admin/admin-shell";
import {
  ACTION_COPY,
  AdminActionType,
  DriverStatusBadge,
  Panel,
  ReasonDialog,
} from "@/components/admin/admin-bits";
import { Badge, Card, Skeleton } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/auth/identity-store";

export default function AdminDriverDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ? decodeURIComponent(params.id) : "";
  const [driver, setDriver] = React.useState<DriverAccountAdminDto | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [action, setAction] = React.useState<AdminActionType | null>(null);

  useSetAdminHeader(
    driver ? `Driver Account: ${driver.driverId}` : "Driver Account Details",
    driver
      ? `${driver.vehicleMake} ${driver.vehicleModel} · ${driver.vehiclePlate}`
      : undefined,
  );

  const load = React.useCallback(() => {
    if (!id) return;
    setLoading(true);
    getAdminDriverById(id)
      .then((d) => {
        if (!d) {
          setError("Driver account not found.");
        } else {
          setDriver(d);
        }
      })
      .catch((e) => {
        setError(errorMessage(e, "Failed to load driver account details."));
      })
      .finally(() => setLoading(false));
  }, [id]);

  React.useEffect(load, [load]);

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error || !driver) {
    return (
      <div className="space-y-4">
        <Link
          href={ROUTES.admin.drivers}
          className="inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-ink"
        >
          <ArrowLeft size={14} /> Back to driver accounts
        </Link>
        <Card className="p-6 text-center">
          <p className="text-sm font-semibold text-red-600">
            {error ?? "Driver profile not found."}
          </p>
        </Card>
      </div>
    );
  }

  const st = driver.status;
  const available: AdminActionType[] =
    st === "PendingVerification" || st === "DocumentReview"
      ? ["Approve", "Reject"]
      : st === "Active"
        ? ["Suspend", "Deactivate"]
        : st === "Suspended"
          ? ["Reactivate", "Deactivate"]
          : st === "Rejected"
            ? ["Approve"]
            : st === "Deactivated"
              ? ["Reactivate"]
              : ["Approve"];

  const actionIcon: Record<AdminActionType, React.ReactNode> = {
    Approve: <CheckCircle2 size={16} />,
    Reject: <XCircle size={16} />,
    Suspend: <Ban size={16} />,
    Deactivate: <ShieldOff size={16} />,
    Reactivate: <RotateCcw size={16} />,
  };

  return (
    <div className="space-y-4">
      <Link
        href={ROUTES.admin.drivers}
        className="inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-ink"
      >
        <ArrowLeft size={14} /> All driver accounts
      </Link>

      {/* Header card */}
      <div className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-card md:flex-row md:items-center">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
          <Car size={28} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">{driver.driverId}</h2>
            <DriverStatusBadge status={st} />
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
            <span>Registered {formatDate(driver.createdAt)}</span>
            <span>Last updated {formatDateTime(driver.updatedAt)}</span>
            {driver.verifiedAt && (
              <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                <ShieldCheck size={14} /> Verified {formatDate(driver.verifiedAt)}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {available.map((a) => (
            <Button
              key={a}
              size="sm"
              full={false}
              variant={
                a === "Approve" || a === "Reactivate"
                  ? "primary"
                  : a === "Deactivate" || a === "Reject"
                    ? "danger"
                    : "outline"
              }
              leftIcon={actionIcon[a]}
              onClick={() => setAction(a)}
            >
              {a}
            </Button>
          ))}
          {available.length === 0 && (
            <Badge tone="neutral">No actions available</Badge>
          )}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {/* Verification & vehicle details */}
        <Panel title="Vehicle & Verification Information" className="xl:col-span-2">
          <div className="space-y-4">
            <div className="flex items-center gap-4 rounded-xl border border-zinc-100 bg-zinc-50 p-4">
              <Image
                src={VEHICLE_IMAGES[driver.vehicleTypeCode] ?? "/vehicles/car.png"}
                alt=""
                width={80}
                height={50}
                className="h-12 w-20 object-contain mix-blend-multiply"
              />
              <div className="min-w-0 flex-1">
                <p className="text-base font-bold">
                  {driver.vehicleMake} {driver.vehicleModel}
                </p>
                <p className="text-xs font-semibold text-brand-800">
                  License Plate: {driver.vehiclePlate || "N/A"}
                </p>
                <p className="text-xs text-muted">
                  Vehicle Type Code: {driver.vehicleTypeCode}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-zinc-200 p-3">
                <p className="text-xs font-semibold text-muted uppercase">
                  License Number
                </p>
                <p className="mt-1 text-sm font-semibold">
                  {driver.licenseNumber || "N/A"}
                </p>
              </div>

              <div className="rounded-lg border border-zinc-200 p-3">
                <p className="text-xs font-semibold text-muted uppercase">
                  License Expiry Date
                </p>
                <p className="mt-1 text-sm font-semibold">
                  {formatDate(driver.licenseExpiry)}
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-zinc-200 p-3">
              <p className="text-xs font-semibold text-muted uppercase">
                Verification Status Details
              </p>
              <div className="mt-2 flex items-center gap-2">
                <Badge
                  tone={
                    st === "Active"
                      ? "success"
                      : st === "PendingVerification"
                        ? "warning"
                        : st === "Rejected"
                          ? "danger"
                          : "neutral"
                  }
                >
                  {st}
                </Badge>
                <span className="text-xs text-muted">
                  {st === "Active"
                    ? "Driver is active and verified to accept trip requests."
                    : st === "PendingVerification"
                      ? "Pending admin verification review."
                      : st === "Rejected"
                        ? "Driver application has been rejected."
                        : st === "Suspended"
                          ? "Driver account is currently suspended."
                          : "Account is not active."}
                </span>
              </div>
            </div>
          </div>
        </Panel>

        {/* Audit & status reason history */}
        <Panel title="Action & Reason Record">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted">
              <FileCheck2 size={16} /> Latest Recorded Reason
            </div>

            {driver.statusReason ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
                <p className="font-semibold">Recorded Reason for Current State:</p>
                <p className="mt-1 text-sm font-medium leading-relaxed">
                  &ldquo;{driver.statusReason}&rdquo;
                </p>
                <p className="mt-2 text-[11px] opacity-75">
                  Enforced on backend and recorded in audit log.
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-xs text-muted">
                No custom reason recorded for initial state.
              </div>
            )}

            <div className="mt-4 border-t border-zinc-100 pt-3">
              <p className="text-xs font-semibold text-muted uppercase mb-2">
                Enforcement Rules
              </p>
              <ul className="space-y-1.5 text-xs text-muted">
                <li className="flex items-center gap-1.5">
                  <Clock size={13} className="text-brand-600" /> State updates take effect immediately on backend.
                </li>
                <li className="flex items-center gap-1.5">
                  <ShieldAlert size={13} className="text-amber-600" /> Non-active drivers are blocked from going online.
                </li>
              </ul>
            </div>
          </div>
        </Panel>
      </div>

      <ReasonDialog
        open={!!action}
        onClose={() => setAction(null)}
        title={action ? ACTION_COPY[action].title : ""}
        description={
          action
            ? `${ACTION_COPY[action].description} Target Driver ID: ${driver.driverId}`
            : undefined
        }
        confirmLabel={action ? ACTION_COPY[action].confirm : "Confirm"}
        destructive={action ? ACTION_COPY[action].destructive : false}
        onConfirm={async (reason) => {
          if (!action) return;
          const targetStatus = ACTION_COPY[action].targetStatus;
          try {
            const updated = await updateAdminDriverStatus(
              driver.driverId,
              targetStatus,
              reason,
            );
            setDriver(updated);
            setAction(null);
            toast.success(
              `${action} applied`,
              `Driver account status updated to ${updated.status}. Reason recorded: "${reason}"`,
            );
          } catch (e) {
            toast.error("Action failed", errorMessage(e));
          }
        }}
      />
    </div>
  );
}
