"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getMe } from "@/lib/api";
import { ROUTES } from "@/lib/routes";
import { ProfileShell, ProfileLinkRow, ProfileSection } from "@/components/profile/profile-shell";
import type { Role, User } from "@/types/auth";

/**
 * Driver profile — FR-AUTH-04 / FR-DRV-01.
 *
 * Same core details as the rider, plus the vehicle, licence and verification
 * status blocks a driver needs before they can go online.
 *
 * STRUCTURE ONLY. What still has to be built:
 *  - replace the getMe() mapping below once /api/me returns id + phone
 *  - guard the route so only a signed-in Driver can open it
 *  - load the vehicle + licence record and make those fields editable
 *  - document upload and the admin verification status badge
 */
export default function DriverProfilePage() {
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
    <ProfileShell user={user} backHref={ROUTES.driver.home}>
      <ProfileSection title="Verification" description="An admin reviews your documents before you can go online">
        {/* TODO: real status (PendingVerification / DocumentReview / Active / Suspended). */}
        <span className="w-fit rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-600">
          Status — not wired up
        </span>
      </ProfileSection>

      <ProfileSection title="Vehicle" description="Shown to riders when you accept a trip">
        {/* TODO: make, model, registration no., colour, vehicle type — editable. */}
        <p className="text-xs text-zinc-500">Vehicle details form goes here.</p>
      </ProfileSection>

      <ProfileSection title="Licence & documents">
        {/* TODO: licence number, expiry date, document uploads. */}
        <p className="text-xs text-zinc-500">Licence fields and document uploads go here.</p>
      </ProfileSection>

      <ProfileSection title="Safety">
        <ProfileLinkRow
          href={`${ROUTES.driver.profile}/emergency-contacts`}
          label="Emergency contacts"
          hint="Up to 3 people"
        />
      </ProfileSection>
    </ProfileShell>
  );
}
