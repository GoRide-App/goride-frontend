"use client";

import { ROUTES } from "@/lib/constants";
import { useCurrentUser } from "@/components/layout/role-guard";
import { ProfileScreen } from "@/components/profile/profile-forms";

export default function RiderProfilePage() {
  const user = useCurrentUser()!;
  return <ProfileScreen user={user} backHref={ROUTES.rider.home} tone="rider" />;
}
