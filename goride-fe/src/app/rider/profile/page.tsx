"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getMe } from "@/lib/api";
import { ROUTES } from "@/lib/routes";
import { ProfileShell, ProfileLinkRow, ProfileSection } from "@/components/profile/profile-shell";
import type { Role, User } from "@/types/auth";

/**
 * Rider profile — FR-AUTH-04.
 *
 * STRUCTURE ONLY. What still has to be built:
 *  - replace the getMe() mapping below once /api/me returns id + phone
 *  - guard the route so only a signed-in Rider can open it
 *  - the emergency contacts and notification sub-pages
 *  - saved places / payment method sections
 */
export default function RiderProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMe()
      .then((me) => {
        if (!me) {
          router.push(ROUTES.home);
          return;
        }
        // TODO: drop this mapping when the API returns the full user object.
        setUser({ id: "", name: me.name, email: me.email, roles: me.roles as Role[] });
      })
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) return <p className="p-6 text-sm text-zinc-500">Loading…</p>;
  if (!user) return null;

  return (
    <ProfileShell user={user} backHref={ROUTES.rider.home}>
      <ProfileSection title="Safety" description="Who we alert if you trigger SOS during a trip">
        <ProfileLinkRow
          href={`${ROUTES.rider.profile}/emergency-contacts`}
          label="Emergency contacts"
          hint="Up to 3 people"
        />
      </ProfileSection>

      <ProfileSection title="Preferences">
        <ProfileLinkRow
          href={`${ROUTES.rider.profile}/notifications`}
          label="Notifications"
          hint="Push, email and SMS"
        />
        {/* TODO: saved places (home / work) and default payment method. */}
      </ProfileSection>
    </ProfileShell>
  );
}
