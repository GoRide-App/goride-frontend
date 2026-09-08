"use client";

import { useParams } from "next/navigation";
import { ROUTES } from "@/lib/constants";
import { useCurrentUser } from "@/components/layout/role-guard";
import { TripDetail } from "@/components/rider/trip-detail";

export default function RiderTripDetailPage() {
  const { id } = useParams<{ id: string }>();
  const user = useCurrentUser()!;
  return <TripDetail tripId={id} perspective="rider" backHref={ROUTES.rider.trips} userId={user.id} />;
}
