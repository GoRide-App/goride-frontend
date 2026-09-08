"use client";

import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { RoleGuard, useCurrentUser } from "@/components/layout/role-guard";

export default function RiderLayout({ children }: { children: ReactNode }) {
  return (
    <RoleGuard role="Rider">
      <RiderFrame>{children}</RiderFrame>
    </RoleGuard>
  );
}

function RiderFrame({ children }: { children: ReactNode }) {
  const user = useCurrentUser()!;
  return <AppShell user={user}>{children}</AppShell>;
}
