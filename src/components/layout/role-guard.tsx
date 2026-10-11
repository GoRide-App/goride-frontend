"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Role } from "@/types";
import { getMe } from "@/lib/api";
import { useAuthStore } from "@/lib/auth/session";
import { homeForRole, identityLoginUrl } from "@/lib/constants";
import { FullScreenLoader } from "@/components/ui/spinner";
import { FirebaseNotifications } from "@/components/firebase-notifications";

/**
 * RoleGuard — AUTH-08 route guard. Waits for session hydration, bounces
 * anonymous users to /login (with returnTo), and returns users who reach an
 * area their role doesn't permit to their own home.
 */
export function RoleGuard({ role, children }: { role: Role | Role[]; children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const hydrated = useAuthStore((s) => s.hydrated);
  const session = useAuthStore((s) => s.session);
  const roles = Array.isArray(role) ? role : [role];

  const allowed = !!session && roles.includes(session.user.role);

  React.useEffect(() => {
    if (!hydrated) return;
    if (!session) {
      // This tab has no cached session (a new tab, or straight back from
      // sign-in), but the backend's app_session cookie is the real session.
      // Ask the backend first: redirecting straight to /login made Asgardeo's
      // SSO bounce right back here, and the two redirected each other forever.
      // getMe() fills the session store on success, which re-runs this guard.
      // /login isn't a page in this app — the real sign-in lives on the
      // identity-auth backend (OIDC), mirroring proxy.ts's redirect.
      let cancelled = false;
      getMe()
        .then((me) => {
          if (cancelled) return;
          if (!me) window.location.href = identityLoginUrl(pathname);
          // Signed in but no role chosen yet: the dashboard sends them to onboarding.
          else if (me.roles.length === 0) router.replace("/dashboard");
        })
        .catch(() => {
          if (!cancelled) window.location.href = identityLoginUrl(pathname);
        });
      return () => {
        cancelled = true;
      };
    }
    if (!allowed) router.replace(homeForRole(session?.user.role ?? "Rider"));
  }, [hydrated, session, allowed, router, pathname]);

  if (!hydrated || !session || !allowed)
    return <FullScreenLoader label={!hydrated || !session ? "Loading…" : "Redirecting…"} />;
  return (
    <>
      <FirebaseNotifications />
      {children}
    </>
  );
}

/** Redirect signed-in users away from auth pages. */
export function GuestOnly({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const hydrated = useAuthStore((s) => s.hydrated);
  const session = useAuthStore((s) => s.session);
  React.useEffect(() => {
    if (hydrated && session)
      router.replace(homeForRole(session.user.role));
  }, [hydrated, session, router]);
  if (!hydrated) return <FullScreenLoader />;
  if (session) return <FullScreenLoader label="Redirecting…" />;
  return <>{children}</>;
}

export function useCurrentUser() {
  return useAuthStore((s) => s.session?.user ?? null);
}
