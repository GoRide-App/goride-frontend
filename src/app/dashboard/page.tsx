"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, MapPin } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { StatTile } from "@/components/ui/primitives";
import { ROUTES, identityLoginUrl, normalizeRole } from "@/lib/constants";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getMe, MeResponse } from "@/lib/api";
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
  // Only the rider fare-estimate slice (SCRUM-46/47/48/50/53/54) is live
  // right now -- every signed-in user lands here regardless of role until
  // driver/admin stories are implemented.
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

        <div className="mt-8">
          <Link
            href={ROUTES.rider.home}
            className="flex items-center gap-4 rounded-xl border border-zinc-200/80 bg-white p-5 shadow-card transition hover:border-ink"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-500 text-white">
              <MapPin size={20} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">Book a ride</span>
              <span className="block text-xs text-muted">Pick a start and destination — see vehicle types and the calculated fare.</span>
            </span>
            <ArrowRight size={18} className="shrink-0 text-zinc-400" />
          </Link>
        </div>
      </AppShell>
    </>
  );
}
