"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, RotateCcw, Users, X } from "lucide-react";
import {
  type AdminAuditLog,
  type AdminDriverActivity,
  type InternalUser,
  getAdminActivity,
  getAdminAuditLogs,
  getInternalUser,
  updateAdminDriverStatus,
} from "@/lib/api";
import { Button, IconButton } from "@/components/ui/button";
import { ConfirmDialog, DialogIcon } from "@/components/ui/dialog";
import { fades } from "@/components/ui/motion";
import { Chip, ChipRow, EmptyState, Segmented, Skeleton } from "@/components/ui/primitives";
import { BottomSheet, SheetHeader } from "@/components/ui/sheet";
import { useMediaQuery } from "@/components/ui/use-media";
import { AuditTimeline } from "./audit-timeline";
import { DriverDetail } from "./driver-detail";
import { DriverCards, DriverTable } from "./driver-table";
import { DESTRUCTIVE_STATUSES, DRIVER_STATUS_LABELS, statusLabel } from "./driver-status";

type Tab = "drivers" | "audit";
type StatusFilter = number | "all";

function Count({ n }: { n: number }) {
  return <span className="ml-0.5 rounded-full bg-ink/10 px-1.5 py-0.5 text-[11px] font-semibold leading-none tabular-nums">{n}</span>;
}

function RosterSkeleton() {
  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_400px]" aria-busy="true" aria-label="Loading drivers">
      <div className="flex flex-col gap-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-[68px] rounded-card" />
        ))}
      </div>
      <Skeleton className="hidden h-[360px] rounded-card lg:block" />
    </div>
  );
}

/**
 * The admin operations console: driver roster (table on desktop, cards on
 * phones) with status filters and a detail panel, plus the audit timeline.
 * Data flow is unchanged: getAdminActivity → getInternalUser on select →
 * updateAdminDriverStatus after an explicit confirmation; audit logs load the
 * first time the tab opens.
 */
export function AdminConsole() {
  const [activeTab, setActiveTab] = React.useState<Tab>("drivers");
  const [drivers, setDrivers] = React.useState<AdminDriverActivity[]>([]);
  const [auditLogs, setAuditLogs] = React.useState<AdminAuditLog[]>([]);
  const [selected, setSelected] = React.useState<AdminDriverActivity | null>(null);
  const [driverUser, setDriverUser] = React.useState<InternalUser | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadFailed, setLoadFailed] = React.useState(false);
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [statusUpdating, setStatusUpdating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [auditLoading, setAuditLoading] = React.useState(false);
  const [auditLoaded, setAuditLoaded] = React.useState(false);
  const [auditPage, setAuditPage] = React.useState(1);
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");
  const [pendingStatus, setPendingStatus] = React.useState<number | null>(null);
  const desktop = useMediaQuery("(min-width: 1024px)");

  React.useEffect(() => {
    getAdminActivity()
      .then((items) => setDrivers(items))
      .catch(() => {
        setError("Unable to load drivers.");
        setLoadFailed(true);
      })
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => {
    if (activeTab !== "audit" || auditLoaded) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAuditLoading(true);
    getAdminAuditLogs()
      .then((items) => {
        setAuditLogs(items);
        setAuditLoaded(true);
      })
      .catch(() => setError("Unable to load audit logs."))
      .finally(() => setAuditLoading(false));
  }, [activeTab, auditLoaded]);

  /** Same call as the initial load, for the "Try again" button. */
  const retryDrivers = () => {
    setLoading(true);
    setError(null);
    setLoadFailed(false);
    getAdminActivity()
      .then((items) => setDrivers(items))
      .catch(() => {
        setError("Unable to load drivers.");
        setLoadFailed(true);
      })
      .finally(() => setLoading(false));
  };

  const selectDriver = (driver: AdminDriverActivity) => {
    setSelected(driver);
    setDriverUser(null);
    setDetailLoading(true);
    getInternalUser(driver.driverId)
      .then(setDriverUser)
      .catch(() => setError("Unable to load the selected driver details."))
      .finally(() => setDetailLoading(false));
  };

  const updateStatus = async (statusNum: number) => {
    if (!selected || statusNum === selected.status) return;

    setStatusUpdating(true);
    setError(null);
    try {
      await updateAdminDriverStatus(selected.driverId, statusNum);
      setDrivers((current) => current.map((driver) => (driver.driverId === selected.driverId ? { ...driver, status: statusNum } : driver)));
      setSelected((current) => (current ? { ...current, status: statusNum } : current));
    } catch {
      setError("Unable to update the driver status.");
    } finally {
      setStatusUpdating(false);
    }
  };

  const requestStatusChange = (statusNum: number) => {
    if (!selected || statusNum === selected.status) return;
    setPendingStatus(statusNum);
  };

  const confirmStatusChange = async () => {
    if (pendingStatus == null) return;
    await updateStatus(pendingStatus);
    setPendingStatus(null);
  };

  const counts = React.useMemo(() => {
    const map = new Map<number, number>();
    for (const d of drivers) map.set(d.status, (map.get(d.status) ?? 0) + 1);
    return map;
  }, [drivers]);
  const filtered = statusFilter === "all" ? drivers : drivers.filter((d) => d.status === statusFilter);

  const pendingLabel = pendingStatus != null ? statusLabel(pendingStatus) : "";
  const pendingDestructive = pendingStatus != null && DESTRUCTIVE_STATUSES.has(pendingStatus);

  const detail = <DriverDetail driver={selected} user={driverUser} loading={detailLoading} statusUpdating={statusUpdating} onRequestStatusChange={requestStatusChange} />;

  return (
    <section id="admin-console" aria-labelledby="admin-console-title" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="admin-console-title" className="text-[22px] font-semibold leading-tight tracking-[-0.02em]">
            Driver operations
          </h2>
          <p className="mt-1 text-[13px] tabular-nums text-muted">{loading ? "Loading the roster…" : `${drivers.length} ${drivers.length === 1 ? "driver" : "drivers"} on the roster`}</p>
        </div>
        <Segmented
          ariaLabel="Console section"
          size="sm"
          className="w-full sm:w-auto sm:min-w-[280px]"
          value={activeTab}
          onChange={setActiveTab}
          options={[
            { value: "drivers", label: "Drivers" },
            { value: "audit", label: "Audit log" },
          ]}
        />
      </div>

      <AnimatePresence initial={false}>
        {error && (
          <motion.div
            key="error"
            role="alert"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: fades.exit }}
            transition={fades.normal}
            className="flex items-center gap-3 rounded-2xl bg-red-50 py-2 pl-4 pr-2 text-[13px] font-medium text-red-800"
          >
            <AlertTriangle size={16} className="shrink-0" />
            <span className="min-w-0 flex-1">{error}</span>
            <IconButton label="Dismiss" variant="ghost" size="icon-sm" className="text-red-800 hover:bg-red-100" onClick={() => setError(null)}>
              <X size={16} />
            </IconButton>
          </motion.div>
        )}
      </AnimatePresence>

      {activeTab === "audit" ? (
        <AuditTimeline logs={auditLogs} loading={auditLoading} page={auditPage} onPageChange={setAuditPage} />
      ) : loading ? (
        <RosterSkeleton />
      ) : drivers.length === 0 ? (
        <div className="rounded-card bg-white shadow-card ring-1 ring-line">
          <EmptyState
            icon={<Users />}
            title={loadFailed ? "Couldn't load the roster" : "No drivers yet"}
            description={loadFailed ? "Check your connection and try again." : "Drivers appear here once they register a vehicle and licence."}
            action={
              <Button variant="secondary" leftIcon={<RotateCcw size={16} />} onClick={retryDrivers}>
                {loadFailed ? "Try again" : "Refresh"}
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <ChipRow className="-mx-4 px-4 md:-mx-6 md:px-6">
            <Chip size="sm" selected={statusFilter === "all"} onClick={() => setStatusFilter("all")}>
              All <Count n={drivers.length} />
            </Chip>
            {DRIVER_STATUS_LABELS.map((_, n) => {
              const count = counts.get(n);
              if (!count) return null;
              return (
                <Chip key={n} size="sm" selected={statusFilter === n} onClick={() => setStatusFilter(n)}>
                  {statusLabel(n)} <Count n={count} />
                </Chip>
              );
            })}
          </ChipRow>

          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
            <div className="min-w-0">
              {filtered.length === 0 ? (
                <div className="rounded-card bg-white shadow-card ring-1 ring-line">
                  <EmptyState
                    compact
                    title={statusFilter === "all" ? "No drivers" : `No ${statusLabel(statusFilter).toLowerCase()} drivers`}
                    description="Nothing matches this filter right now."
                    action={
                      <Button variant="secondary" size="sm" onClick={() => setStatusFilter("all")}>
                        Show all drivers
                      </Button>
                    }
                  />
                </div>
              ) : (
                <>
                  <DriverTable drivers={filtered} selectedId={selected?.driverId} onSelect={selectDriver} />
                  <DriverCards drivers={filtered} selectedId={selected?.driverId} onSelect={selectDriver} />
                </>
              )}
            </div>
            <aside aria-label="Driver details" className="hidden rounded-card bg-white p-5 shadow-card ring-1 ring-line lg:sticky lg:top-6 lg:block">
              {detail}
            </aside>
          </div>

          <BottomSheet open={!desktop && !!selected} onClose={() => setSelected(null)} position="fixed" backdrop maxHeight="92%" ariaLabel="Driver details">
            <SheetHeader title="Driver details" onClose={() => setSelected(null)} />
            {detail}
          </BottomSheet>
        </>
      )}

      <ConfirmDialog
        open={pendingStatus != null}
        onClose={() => setPendingStatus(null)}
        position="fixed"
        icon={
          <DialogIcon tone={pendingDestructive ? "danger" : "brand"}>
            <AlertTriangle />
          </DialogIcon>
        }
        title={`Change status to ${pendingLabel}?`}
        description={
          selected
            ? `${selected.vehicleMake} ${selected.vehicleModel} (${selected.vehiclePlate}) will be marked ${pendingLabel}. This change is written to the audit log with your admin ID.`
            : undefined
        }
        confirmLabel="Change status"
        destructive={pendingDestructive}
        loading={statusUpdating}
        onConfirm={confirmStatusChange}
      />
    </section>
  );
}
