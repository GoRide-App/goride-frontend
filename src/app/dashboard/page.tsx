"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { MapPin, Navigation, UserRound } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { DashboardHistoryGuard } from "@/components/auth/dashboard-history-guard";
import { AdminConsole } from "@/components/admin/admin-console";
import { AccountCard } from "@/components/dashboard/account-card";
import { ActionCard } from "@/components/dashboard/action-card";
import { ScreenLoader } from "@/components/dashboard/screen-loader";
import { WelcomeCard } from "@/components/dashboard/welcome-card";
import { Button } from "@/components/ui/button";
import { fadeOnly, itemVariants, listVariants } from "@/components/ui/motion";
import { getMe, type MeResponse } from "@/lib/api";
import { useAuthStore } from "@/lib/auth/session";
import { ROUTES, identityLoginUrl, normalizeRole, profileForRole } from "@/lib/constants";

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

  if (loading) return <ScreenLoader label="Loading your dashboard…" />;
  if (!user) return null;

  return <Dashboard user={user} />;
}

function Dashboard({ user }: { user: MeResponse }) {
  const reduce = useReducedMotion();
  const role = user.roles.map(normalizeRole).find(Boolean) ?? "Rider";
  const firstName = user.name.split(" ")[0];
  const profileHref = profileForRole(role);
  const item = reduce ? fadeOnly : itemVariants;

  return (
    <>
      <DashboardHistoryGuard />
      <AppShell user={{ role, name: user.name, email: user.email }}>
        <motion.div variants={listVariants} initial="hidden" animate="show" className="flex flex-col gap-5 md:gap-6">
          <motion.div variants={item}>
            <WelcomeCard
              role={role}
              name={firstName}
              action={
                role === "Admin" ? (
                  <Button href={profileHref} variant="white" full={false} arrow>
                    Your profile
                  </Button>
                ) : undefined
              }
            />
          </motion.div>

          {role !== "Admin" && (
            <motion.div variants={item} className="grid gap-3 sm:grid-cols-2">
              {role === "Rider" && (
                <ActionCard tone="brand" href={ROUTES.rider.home} icon={<MapPin />} title="Book a ride" description="Pick where you're going and see the fare before you confirm." />
              )}
              {role === "Driver" && (
                <ActionCard tone="brand" href={ROUTES.driver.home} icon={<Navigation />} title="Open the driver console" description="Go online, see your position and take ride requests." />
              )}
              <ActionCard href={profileHref} icon={<UserRound />} title="Your profile" description="Contact details, emergency contacts and account settings." />
            </motion.div>
          )}

          {role !== "Admin" && (
            <motion.div variants={item}>
              <AccountCard user={user} role={role} />
            </motion.div>
          )}

          {role === "Admin" && (
            <motion.div variants={item}>
              <AdminConsole />
            </motion.div>
          )}
        </motion.div>
      </AppShell>
    </>
  );
}
