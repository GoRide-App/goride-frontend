"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, CarFront, Check, MapPin } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { StatTile } from "@/components/ui/primitives";
import { ROUTES, identityLoginUrl, normalizeRole } from "@/lib/constants";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AdminDriverActivity, getAdminActivity, getInternalUser, getMe, InternalUser, MeResponse } from "@/lib/api";
import { useAuthStore } from "@/lib/auth/session";
import { DashboardHistoryGuard } from "@/components/auth/dashboard-history-guard";

export default function DashboardPage() {
  const router = useRouter();
  const hydrated = useAuthStore((state) => state.hydrated);
  const [user, setUser] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hydrated) return;

    getMe()
      .then((me) => {
        if (!me) {
          window.location.replace(identityLoginUrl("/dashboard"));
          return;
        }
        if (me.roles.length === 0) {
          router.push("/onboarding/select-role");
          return;
        }
        setUser(me);
      })
      .finally(() => setLoading(false));
  }, [router, hydrated]);

  if (loading) return <p>Loading...</p>;
  if (!user) return null;

  return <Dashboard user={user} />;
}

function Dashboard({ user }: { user: MeResponse }) {
  const role = user.roles.map(normalizeRole).find(Boolean) ?? "Rider";

  const stats = [
    { label: "Trips taken", value: "—", sub: "Across all vehicle types" },
    { label: "Rating", value: "—", sub: "—" },
    { label: "Member since", value: "—", sub: "Thanks for riding" },
  ];

  return (
    <>
      <DashboardHistoryGuard />
      <AppShell
        user={{
          role,
          name: user.name,
          email: user.email,
        }}
      >
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
          <h1 className="text-2xl font-bold tracking-tight">Hi, {user.name.split(" ")[0]} 👋</h1>
          <p className="mt-1 text-sm text-muted">
            You&apos;re signed in as a <span className="font-semibold text-ink">{role}</span>.
          </p>
        </motion.div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {stats.map((s, i) => (
            <StatTile key={s.label} label={s.label} value={s.value} sub={s.sub} tone={i === 0 ? "dark" : "light"} />
          ))}
        </div>

        {role === "Admin" ? <AdminDriversTab /> : <RiderDashboardLink />}
      </AppShell>
    </>
  );
}

function RiderDashboardLink() {
  return (
    <div className="mt-8">
      <Link href={ROUTES.rider.home} className="flex items-center gap-4 rounded-xl border border-zinc-200/80 bg-white p-5 shadow-card transition hover:border-ink">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-500 text-white"><MapPin size={20} /></span>
        <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">Book a ride</span><span className="block text-xs text-muted">Pick a start and destination — see vehicle types and the calculated fare.</span></span>
        <ArrowRight size={18} className="shrink-0 text-zinc-400" />
      </Link>
    </div>
  );
}

function AdminDriversTab() {
  const [drivers, setDrivers] = useState<AdminDriverActivity[]>([]);
  const [selected, setSelected] = useState<AdminDriverActivity | null>(null);
  const [driverUser, setDriverUser] = useState<InternalUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAdminActivity()
      .then((items) => setDrivers(items))
      .catch(() => setError("Unable to load drivers."))
      .finally(() => setLoading(false));
  }, []);

  const selectDriver = (driver: AdminDriverActivity) => {
    setSelected(driver);
    setDriverUser(null);
    setDetailLoading(true);
    getInternalUser(driver.driverId)
      .then(setDriverUser)
      .catch(() => setError("Unable to load the selected driver details."))
      .finally(() => setDetailLoading(false));
  };

  return (
    <section className="mt-8">
      <div className="mb-4 flex items-center gap-2 border-b border-zinc-200">
        <span className="border-b-2 border-brand-500 px-1 pb-3 text-sm font-semibold text-ink">Drivers</span>
      </div>
      {error && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {loading ? <p className="text-sm text-muted">Loading drivers...</p> : drivers.length === 0 ? <p className="text-sm text-muted">No drivers found.</p> : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,1.1fr)]">
          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-card">
            {drivers.map((driver) => (
              <button key={driver.driverId} type="button" onClick={() => selectDriver(driver)} className={`flex w-full items-center gap-3 border-b border-zinc-100 p-4 text-left transition last:border-0 hover:bg-zinc-50 ${selected?.driverId === driver.driverId ? "bg-brand-50" : ""}`}>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-navy-950 text-brand-300"><CarFront size={18} /></span>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{driver.vehicleMake} {driver.vehicleModel}</span><span className="block text-xs text-muted">{driver.vehiclePlate} · {driver.vehicleTypeCode}</span></span>
                {selected?.driverId === driver.driverId && <Check size={17} className="text-brand-600" />}
              </button>
            ))}
          </div>
          <DriverDetails driver={selected} user={driverUser} loading={detailLoading} />
        </div>
      )}
    </section>
  );
}

function DriverDetails({ driver, user, loading }: { driver: AdminDriverActivity | null; user: InternalUser | null; loading: boolean }) {
  if (!driver) return <div className="flex min-h-48 items-center justify-center rounded-xl border border-dashed border-zinc-300 text-sm text-muted">Select a driver to view details.</div>;
  const details = [
    ["Username", user?.username ?? (loading ? "Loading..." : "Unavailable")], ["Email", user?.email ?? "—"], ["Phone", user?.phone ?? "—"],
    ["Driver ID", driver.driverId], ["Vehicle", `${driver.vehicleMake} ${driver.vehicleModel}`], ["Plate", driver.vehiclePlate],
    ["Vehicle type", driver.vehicleTypeCode], ["License number", driver.licenseNumber], ["License expiry", driver.licenseExpiry], ["Status", String(driver.status)],
    ["Verified at", driver.verifiedAt ?? "Not verified"], ["Created at", driver.createdAt], ["Updated at", driver.updatedAt],
  ];
  return <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-card"><h2 className="text-base font-bold">Driver details</h2><dl className="mt-4 grid gap-3 sm:grid-cols-2">{details.map(([label, value]) => <div key={label}><dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</dt><dd className="mt-0.5 break-words text-sm text-ink">{value}</dd></div>)}</dl></div>;
}
