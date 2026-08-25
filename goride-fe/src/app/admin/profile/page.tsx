"use client";

import { CheckCircle2, KeyRound, MonitorSmartphone, ShieldCheck } from "lucide-react";
import { RoleGuard, useCurrentUser } from "@/components/layout/role-guard";
import { AppShell } from "@/components/layout/app-shell";
import { NotificationPrefsSection, ProfileScreen } from "@/components/profile/profile-screen";
import { Badge, Card, ListRow, SectionTitle } from "@/components/ui/primitives";
import { formatDate } from "@/lib/utils";

const PERMISSIONS = [
  "Verify, reject and suspend driver accounts",
  "Respond to SOS alerts and safety incidents",
  "Review complaints and trip disputes",
  "Manage vehicle types and fare multipliers",
  "Read the platform audit log",
];

/**
 * Admin profile — the operator's own account page (not the ops dashboard).
 * Admins are provisioned internally, so there's no self-deactivation here.
 */
export default function AdminProfilePage() {
  return (
    <RoleGuard role="Admin">
      <AdminProfile />
    </RoleGuard>
  );
}

function AdminProfile() {
  const user = useCurrentUser()!;
  return (
    <AppShell user={user} className="max-w-3xl px-0 sm:px-4">
      <div className="overflow-hidden rounded-xl border border-zinc-200/80 bg-white shadow-card">
        <ProfileScreen user={user} tone="admin" title="Admin profile" allowDeactivate={false}>
          <section className="mt-8">
            <SectionTitle>Access</SectionTitle>
            <Card className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">Platform administrator</p>
                  <p className="text-xs text-muted">Provisioned {formatDate(user.createdAt)}</p>
                </div>
                <Badge tone="ink" dot>
                  Full access
                </Badge>
              </div>
              <ul className="flex flex-col gap-2 border-t border-zinc-100 pt-3">
                {PERMISSIONS.map((p) => (
                  <li key={p} className="flex items-start gap-2 text-xs text-zinc-600">
                    <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-brand-500" />
                    {p}
                  </li>
                ))}
              </ul>
            </Card>
          </section>

          <section className="mt-8">
            <SectionTitle>Security</SectionTitle>
            <Card className="divide-y divide-zinc-100 p-0">
              <ListRow
                icon={<KeyRound size={17} />}
                title="Password"
                description="Managed by GoRide ID — change it from the identity provider"
                right={<Badge tone="neutral">GoRide ID</Badge>}
              />
              <ListRow
                icon={<ShieldCheck size={17} />}
                title="Two-factor authentication"
                description="Required for every admin account"
                right={<Badge tone="success">Enabled</Badge>}
              />
              <ListRow
                icon={<MonitorSmartphone size={17} />}
                title="Active sessions"
                description="This browser only"
                right={<Badge tone="neutral">1</Badge>}
              />
            </Card>
            <p className="mt-3 text-[11px] text-muted">
              Every action taken from this account is written to the audit log with your admin ID.
            </p>
          </section>

          <NotificationPrefsSection user={user} />
        </ProfileScreen>
      </div>
    </AppShell>
  );
}
