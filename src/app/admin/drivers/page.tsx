"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import type { DriverStatus } from "@/types";
import { getAdminDrivers, type DriverAccountAdminDto } from "@/lib/api";
import { ROUTES, VEHICLE_IMAGES } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { useSetAdminHeader } from "@/components/admin/admin-shell";
import {
  DataTable,
  DriverStatusBadge,
  FilterChips,
  SearchBox,
} from "@/components/admin/admin-bits";

type Filter = "all" | "queue" | DriverStatus;

export default function AdminDriversPage() {
  return (
    <React.Suspense fallback={<p className="p-4 text-sm text-muted">Loading driver accounts…</p>}>
      <DriversTable />
    </React.Suspense>
  );
}

function DriversTable() {
  const router = useRouter();
  const search = useSearchParams();
  const [drivers, setDrivers] = React.useState<DriverAccountAdminDto[] | null>(null);
  const [filter, setFilter] = React.useState<Filter>(
    (search.get("status") as Filter) ?? "all",
  );
  const [q, setQ] = React.useState("");
  useSetAdminHeader(
    "Driver Accounts",
    "Verification queue, account status and admin enforcement actions",
  );

  React.useEffect(() => {
    let alive = true;
    const load = () =>
      getAdminDrivers()
        .then((d) => alive && setDrivers(d))
        .catch(() => {});
    load();
    const id = setInterval(load, 8000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const counts = React.useMemo(() => {
    const c: Record<string, number> = { all: drivers?.length ?? 0, queue: 0 };
    drivers?.forEach((d) => {
      c[d.status] = (c[d.status] ?? 0) + 1;
      if (
        d.status === "PendingVerification" ||
        d.status === "DocumentReview"
      ) {
        c.queue += 1;
      }
    });
    return c;
  }, [drivers]);

  const rows = React.useMemo(() => {
    if (!drivers) return null;
    let list = drivers;
    if (filter === "queue") {
      list = list.filter(
        (d) =>
          d.status === "PendingVerification" || d.status === "DocumentReview",
      );
    } else if (filter !== "all") {
      list = list.filter((d) => d.status === filter);
    }

    if (q.trim()) {
      const s = q.toLowerCase();
      list = list.filter(
        (d) =>
          d.driverId.toLowerCase().includes(s) ||
          d.vehiclePlate.toLowerCase().includes(s) ||
          d.vehicleMake.toLowerCase().includes(s) ||
          d.vehicleModel.toLowerCase().includes(s) ||
          d.licenseNumber.toLowerCase().includes(s),
      );
    }

    const order: DriverStatus[] = [
      "DocumentReview",
      "PendingVerification",
      "Active",
      "Suspended",
      "Rejected",
      "Deactivated",
      "Offline",
    ];
    return [...list].sort(
      (a, b) =>
        order.indexOf(a.status) - order.indexOf(b.status) ||
        a.vehiclePlate.localeCompare(b.vehiclePlate),
    );
  }, [drivers, filter, q]);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <FilterChips
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All", count: counts.all },
            { value: "queue", label: "Verification queue", count: counts.queue },
            { value: "Active", label: "Active", count: counts.Active ?? 0 },
            {
              value: "PendingVerification",
              label: "Pending Verification",
              count: counts.PendingVerification ?? 0,
            },
            {
              value: "Suspended",
              label: "Suspended",
              count: counts.Suspended ?? 0,
            },
            {
              value: "Rejected",
              label: "Rejected",
              count: counts.Rejected ?? 0,
            },
            {
              value: "Deactivated",
              label: "Deactivated",
              count: counts.Deactivated ?? 0,
            },
          ]}
        />
        <SearchBox
          value={q}
          onChange={setQ}
          placeholder="Search Driver ID, plate, license…"
          className="md:w-72"
        />
      </div>

      <DataTable<DriverAccountAdminDto>
        rows={rows}
        rowKey={(d) => d.driverId}
        onRowClick={(d) => router.push(ROUTES.admin.driver(d.driverId))}
        empty="No driver accounts match this filter."
        columns={[
          {
            key: "driver",
            header: "Driver Account / ID",
            cell: (d) => (
              <div className="min-w-0">
                <p className="truncate font-semibold text-ink">
                  {d.driverId}
                </p>
                <p className="truncate text-xs text-muted">
                  Registered {formatDate(d.createdAt)}
                </p>
              </div>
            ),
          },
          {
            key: "vehicle",
            header: "Vehicle Details",
            cell: (d) => (
              <div className="flex items-center gap-2">
                <Image
                  src={VEHICLE_IMAGES[d.vehicleTypeCode] ?? "/vehicles/car.png"}
                  alt=""
                  width={36}
                  height={24}
                  className="h-6 w-9 object-contain mix-blend-multiply"
                />
                <div>
                  <p className="font-semibold">{d.vehiclePlate || "—"}</p>
                  <p className="text-xs text-muted">
                    {d.vehicleMake} {d.vehicleModel} ({d.vehicleTypeCode})
                  </p>
                </div>
              </div>
            ),
          },
          {
            key: "license",
            header: "License Info",
            cell: (d) => (
              <div>
                <p className="font-medium text-xs text-ink">
                  {d.licenseNumber || "—"}
                </p>
                <p className="text-[11px] text-muted">
                  Expires {formatDate(d.licenseExpiry)}
                </p>
              </div>
            ),
          },
          {
            key: "status",
            header: "Account State",
            cell: (d) => <DriverStatusBadge status={d.status} />,
          },
          {
            key: "reason",
            header: "Latest Action Reason",
            cell: (d) => (
              <p className="max-w-xs truncate text-xs text-muted" title={d.statusReason ?? ""}>
                {d.statusReason ? d.statusReason : <span className="italic">None recorded</span>}
              </p>
            ),
          },
          {
            key: "actions",
            header: "",
            cell: (d) => (
              <span className="text-xs font-semibold text-brand-700 hover:underline">
                View & Action →
              </span>
            ),
          },
        ]}
      />
    </div>
  );
}
