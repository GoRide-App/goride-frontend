"use client";

import { ROUTES } from "@/lib/constants";
import { useCurrentUser } from "@/components/layout/role-guard";
import { EmergencyContactsScreen } from "@/components/profile/profile-forms";

export default function RiderEmergencyContactsPage() {
  const user = useCurrentUser()!;
  return <EmergencyContactsScreen user={user} backHref={ROUTES.rider.home} />;
}
