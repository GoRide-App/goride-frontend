"use client";

import { ROUTES } from "@/lib/constants";
import { useCurrentUser } from "@/components/layout/role-guard";
import { NotificationPrefsScreen } from "@/components/profile/profile-forms";

export default function RiderNotificationsPage() {
  const user = useCurrentUser()!;
  return <NotificationPrefsScreen user={user} backHref={ROUTES.rider.home} />;
}
