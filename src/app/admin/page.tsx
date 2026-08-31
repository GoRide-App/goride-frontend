"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Car, CheckCircle2, ShieldCheck, UserCheck } from "lucide-react";
import { getAdminDrivers, type DriverAccountAdminDto } from "@/lib/api";
import { ROUTES } from "@/lib/constants";
import { useSetAdminHeader } from "@/components/admin/admin-shell";
import { DriverStatusBadge, Panel } from "@/components/admin/admin-bits";
import { Card, Skeleton, StatTile } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";

export default function AdminDashboardPage() {
  return (
    <React.Suspense fallback={<p className="p-4 text-sm text-muted">Loading dashboard…</p>}>
      <Dashboard />
    </React.Suspense>
  );
}

function Dashboard() {
  useSetAdminHeader(
    "Operations Dashboard",
    "Driver verification queue, driver accounts and system controls",
  );
  const [drivers, setDrivers] = React.useState<DriverAccountAdminDto[] | null>(null);

  React.useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const d = await getAdminDrivers();
        if (alive) setDrivers(d);
      } catch {
        /* ignore */
      }
    };
    load();
    const id = setInterval(load, 8000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const stats = React.useMemo(() => {
    if (!drivers) return null;
    const total = drivers.length;
    const active = drivers.filter((d) => d.status === "Active").length;
    const pending = drivers.filter(
      (d) => d.status === "PendingVerification" || d.status === "DocumentReview",
    ).length;
    const suspended = drivers.filter((d) => d.status === "Suspended").length;
    const rejected = drivers.filter((d) => d.status === "Rejected").length;
    return { total, active, pending, suspended, rejected };
  }, [drivers]);

  const queue = React.useMemo(() => {
    if (!drivers) return null;
    return drivers.filter(
      (d) => d.status === "PendingVerification" || d.status === "DocumentReview",
    );
  }, [drivers]);

  return (
    <div className="space-y-4">
      {/* KPI tiles */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats ? (
          <>
            <StatTile
              label="Total Drivers"
              value={stats.total}
              sub={`${stats.active} active drivers`}
              icon={<Car size={16} />}
            />
            <StatTile
              label="Pending Verification"
              value={stats.pending}
              sub={`${stats.pending} waiting for review`}
              icon={<UserCheck size={16} />}
              tone={stats.pending > 0 ? "brand" : "light"}
            />
            <StatTile
              label="Active Accounts"
              value={stats.active}
              sub="Verified & eligible"
              icon={<ShieldCheck size={16} />}
              tone="light"
            />
            <StatTile
              label="Suspended / Rejected"
              value={stats.suspended + stats.rejected}
              sub={`${stats.suspended} suspended · ${stats.rejected} rejected`}
              icon={<Car size={16} />}
              tone="dark"
            />
          </>
        ) : (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {/* Verification Queue preview */}
        <Panel
          title="Driver Verification Queue"
          className="xl:col-span-2"
          action={
            <Link
              href={`${ROUTES.admin.drivers}?status=queue`}
              className="text-xs font-semibold text-brand-700 hover:underline"
            >
              View all drivers →
            </Link>
          }
          padded={false}
        >
          {!queue ? (
            <div className="space-y-2 p-4">
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
            </div>
          ) : queue.length === 0 ? (
            <p className="flex items-center gap-2 p-4 text-sm text-muted">
              <CheckCircle2 size={16} className="text-emerald-600" /> Verification queue is empty
            </p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {queue.map((d) => (
                <li key={d.driverId}>
                  <Link
                    href={ROUTES.admin.driver(d.driverId)}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2/60"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700 font-semibold text-xs">
                      <Car size={16} />
                    </div>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">
                        {d.driverId}
                      </span>
                      <span className="block truncate text-xs text-muted">
                        {d.vehicleMake} {d.vehicleModel} · Plate: {d.vehiclePlate || "N/A"}
                      </span>
                    </span>
                    <DriverStatusBadge status={d.status} />
                    <ArrowRight size={14} className="text-zinc-400" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* Quick Actions card */}
        <Card className="flex flex-col justify-between p-5">
          <div>
            <h3 className="text-base font-bold text-ink">Driver Management</h3>
            <p className="mt-1 text-xs text-muted leading-relaxed">
              View registered driver accounts, verify vehicle details & licenses, approve new drivers, or apply status changes with required audit reasons.
            </p>
          </div>
          <div className="mt-6">
            <Button
              href={ROUTES.admin.drivers}
              variant="primary"
              rightIcon={<ArrowRight size={16} />}
            >
              Go to Driver Accounts
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
