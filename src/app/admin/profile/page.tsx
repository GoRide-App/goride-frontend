"use client";

import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth/session";
import type { User } from "@/types";
import { AppShell } from "@/components/layout/app-shell";
import {
  NotificationPrefsSection,
  ProfileScreen,
  ProfileSectionTitle,
} from "@/components/profile/profile-screen";
import { ScreenError, ScreenLoader } from "@/components/dashboard/screen-loader";
import { errorMessage, identity } from "@/lib/auth/identity-store";
import { getMe } from "@/lib/api";
import { identityLoginUrl, normalizeRole, ROUTES } from "@/lib/constants";
import { Badge, Card } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
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
  const router = useRouter();
  const hydrated = useAuthStore((state) => state.hydrated);
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hydrated) return;

    const sessionUser = useAuthStore.getState().session?.user;

    if (!sessionUser) {
      window.location.replace(identityLoginUrl(ROUTES.admin.profile));
      return;
    }

    getMe()
      .then((me) => {
        const currentUser =
          me ??
          (sessionUser
            ? {
                userId: sessionUser.id,
                name: sessionUser.name,
                email: sessionUser.email,
                phone: sessionUser.phone ?? null,
                roles: [sessionUser.role],
              }
            : null);

        const normalizedRoles = (currentUser?.roles ?? []).map((value) =>
          normalizeRole(value),
        );
        if (!currentUser || !normalizedRoles.includes("Admin")) {
          router.replace(ROUTES.dashboard);
          return;
        }

        return identity
          .getByEmail(currentUser.email, currentUser.name, "Admin")
          .then((profile) => {
            if (normalizeRole(profile.role) !== "Admin") {
              router.replace(ROUTES.dashboard);
              return;
            }
            setUser({ ...profile, phone: currentUser.phone ?? null });
          });
      })
      .catch((e) =>
        setError(errorMessage(e, "Unable to load your admin profile.")),
      )
      .finally(() => setLoading(false));
  }, [router, hydrated]);

  if (loading) return <ScreenLoader label="Loading your profile…" />;
  if (error)
    return (
      <ScreenError
        title="Couldn't load your profile"
        message={error}
        action={
          <Button href={ROUTES.dashboard} variant="dark">
            Back to dashboard
          </Button>
        }
      />
    );
  if (!user) return null;

  return (
    <AppShell
      user={{ role: "Admin", name: user.name, email: user.email }}
      className="max-w-[720px]"
    >
      <ProfileScreen
        user={user}
        tone="admin"
        title="Admin profile"
        allowDeactivate={false}
        phoneOnly
      >
        <section aria-labelledby="profile-access-title">
          <ProfileSectionTitle id="profile-access-title">Access</ProfileSectionTitle>
          <Card padded={false} className="divide-y divide-line">
            <div className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold leading-snug">
                  Platform administrator
                </p>
                <p className="mt-0.5 text-[13px] leading-snug text-muted">
                  Provisioned {formatDate(user.createdAt)}
                </p>
              </div>
              <Badge tone="ink" dot size="md">
                Full access
              </Badge>
            </div>
            <ul className="flex flex-col gap-2.5 p-4">
              {PERMISSIONS.map((p) => (
                <li
                  key={p}
                  className="flex items-start gap-2.5 text-[13px] leading-snug text-ink-2"
                >
                  <CheckCircle2
                    size={16}
                    className="mt-px shrink-0 text-brand-700"
                    aria-hidden
                  />
                  {p}
                </li>
              ))}
            </ul>
            <p className="p-4 text-[12px] leading-relaxed text-muted text-pretty">
              Every action taken from this account is written to the audit log
              with your admin ID.
            </p>
          </Card>
        </section>

        <NotificationPrefsSection user={user} />
      </ProfileScreen>
    </AppShell>
  );
}
