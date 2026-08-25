"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getMe } from "@/lib/api";
import { ROUTES } from "@/lib/routes";
import { ProfileShell, ProfileSection } from "@/components/profile/profile-shell";
import type { Role, User } from "@/types/auth";

/**
 * Admin profile — the operator's own account page (not the admin dashboard).
 *
 * There was no admin profile screen in the old build, so this follows the same
 * shape as the rider/driver ones with the account-security blocks an operator
 * needs instead of the ride-related sections.
 *
 * STRUCTURE ONLY. What still has to be built:
 *  - replace the getMe() mapping below once /api/me returns id + phone
 *  - guard the route so only a signed-in Admin can open it
 *  - permissions list, active sessions and the personal audit trail
 *  - hide/replace the deactivate block — an admin shouldn't self-deactivate
 */
export default function AdminProfilePage() {
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
    <ProfileShell user={user} backHref={ROUTES.admin.home} title="Admin account">
      <ProfileSection title="Access" description="What this admin account is allowed to do">
        {/* TODO: list the granted permissions once the roles endpoint is ready. */}
        <p className="text-xs text-zinc-500">Permissions list goes here.</p>
      </ProfileSection>

      <ProfileSection title="Security">
        {/* TODO: change password, two-factor, active sessions / sign out everywhere. */}
        <p className="text-xs text-zinc-500">Password, 2FA and active sessions go here.</p>
      </ProfileSection>

      <ProfileSection title="My activity" description="Recent actions taken from this account">
        {/* TODO: pull this admin's slice of the audit log. */}
        <p className="text-xs text-zinc-500">Audit trail goes here.</p>
      </ProfileSection>
    </ProfileShell>
  );
}
