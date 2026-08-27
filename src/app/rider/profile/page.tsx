"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@/types";
import { AppShell } from "@/components/layout/app-shell";
import {
  EmergencyContactsSection,
  NotificationPrefsSection,
  ProfileScreen,
} from "@/components/profile/profile-screen";
import { errorMessage, identity } from "@/lib/auth/identity-store";
import { getMe } from "@/lib/api";

/** Rider profile — FR-AUTH-04 / FR-AUTH-05 / FR-AUTH-07. */
export default function RiderProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMe()
      .then((me) => {
        if (!me || !me.roles.includes("Rider")) {
          router.replace("/");
          return;
        }
        return identity
          .getByEmail(me.email, me.name, "Rider")
          .then((profile) => {
            if (profile.role !== "Rider") {
              router.replace("/");
              return;
            }
            setUser(profile);
          });
      })
      .catch((e) =>
        setError(errorMessage(e, "Unable to load your rider profile.")),
      )
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) return <p>Loading...</p>;
  if (error) return <p>{error}</p>;
  if (!user) return null;

  return (
    <AppShell
      user={{ role: "Rider", name: user.name, email: user.email }}
      className="max-w-3xl px-0 sm:px-4"
    >
      <div className="overflow-hidden rounded-xl border border-zinc-200/80 bg-white shadow-card">
        <ProfileScreen user={user} tone="rider" title="Rider profile" phoneOnly>
          <EmergencyContactsSection user={user} />
          <NotificationPrefsSection user={user} />
        </ProfileScreen>
      </div>
    </AppShell>
  );
}
