"use client";

import { CarFront, Mail, Phone, ShieldAlert } from "lucide-react";
import type { Role } from "@/types";
import type { MeResponse } from "@/lib/api";
import { profileForRole } from "@/lib/constants";
import { Badge, Card, ListRow } from "@/components/ui/primitives";

/**
 * The facts we actually have about the signed-in account (from `getMe()`),
 * each row leading somewhere useful. No invented stats.
 */
export function AccountCard({ user, role }: { user: MeResponse; role: Role }) {
  const profile = profileForRole(role);
  return (
    <section aria-labelledby="account-card-title">
      <h2 id="account-card-title" className="mb-3 text-[15px] font-semibold tracking-[-0.01em]">
        Your account
      </h2>
      <Card padded={false} className="divide-y divide-line p-2">
        <ListRow icon={<Mail />} title="Email" description={user.email} />
        <ListRow
          icon={<Phone />}
          title="Mobile number"
          description={user.phone ?? "Not added yet. Drivers and our safety team use it to reach you."}
          href={profile}
          badge={!user.phone ? <Badge tone="brand">Add</Badge> : undefined}
        />
        {role === "Rider" && <ListRow icon={<ShieldAlert />} title="Emergency contacts" description="Alerted with your live location when you hold SOS" href={profile} />}
        {role === "Driver" && <ListRow icon={<CarFront />} title="Vehicle & licence" description="Keep your documents current to stay verified" href={profile} />}
      </Card>
    </section>
  );
}
