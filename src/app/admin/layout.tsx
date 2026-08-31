"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth/session";
import { getMe, MeResponse } from "@/lib/api";
import { identityLoginUrl, normalizeRole, ROUTES } from "@/lib/constants";
import { AdminShell } from "@/components/admin/admin-shell";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const hydrated = useAuthStore((state) => state.hydrated);
  const [user, setUser] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hydrated) return;

    getMe()
      .then((me) => {
        if (!me) {
          window.location.href = identityLoginUrl("/admin");
          return;
        }

        const normalizedRoles = me.roles.map((r) => normalizeRole(r));
        if (!normalizedRoles.includes("Admin")) {
          router.replace(ROUTES.dashboard);
          return;
        }

        setUser(me);
      })
      .catch(() => {
        router.replace(ROUTES.dashboard);
      })
      .finally(() => setLoading(false));
  }, [router, hydrated]);

  if (loading) return <div className="p-8 text-sm font-semibold">Loading admin console…</div>;
  if (!user) return null;

  return <AdminShell user={{ name: user.name, email: user.email }}>{children}</AdminShell>;
}
