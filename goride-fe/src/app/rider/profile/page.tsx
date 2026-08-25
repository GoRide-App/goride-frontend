"use client";

import { RoleGuard, useCurrentUser } from "@/components/layout/role-guard";
import { AppShell } from "@/components/layout/app-shell";
import { EmergencyContactsSection, NotificationPrefsSection, ProfileScreen } from "@/components/profile/profile-screen";

/** Rider profile — FR-AUTH-04 / FR-AUTH-05 / FR-AUTH-07. */
export default function RiderProfilePage() {
  return (
    <RoleGuard role="Rider">
      <RiderProfile />
    </RoleGuard>
  );
}

function RiderProfile() {
  const user = useCurrentUser()!;
  return (
    <AppShell user={user} className="max-w-3xl px-0 sm:px-4">
      <div className="overflow-hidden rounded-xl border border-zinc-200/80 bg-white shadow-card">
        <ProfileScreen user={user} tone="rider" title="Rider profile">
          <EmergencyContactsSection user={user} />
          <NotificationPrefsSection user={user} />
        </ProfileScreen>
      </div>
    </AppShell>
  );
}
