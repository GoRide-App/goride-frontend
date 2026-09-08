"use client";

import * as React from "react";
import type { Trip } from "@/types";
import { api } from "@/lib/api";
import { ROUTES } from "@/lib/constants";
import { useCurrentUser } from "@/components/layout/role-guard";
import { TopBar } from "@/components/ui/primitives";
import { GroupedTripList } from "@/components/rider/trip-list";

export default function RiderTripsPage() {
  const user = useCurrentUser()!;
  const [trips, setTrips] = React.useState<Trip[] | null>(null);
  React.useEffect(() => {
    api.trips.list({ riderId: user.id }).then(setTrips).catch(() => setTrips([]));
  }, [user.id]);
  return (
    <>
      <TopBar back={ROUTES.rider.home} title="Ride history" subtitle={trips ? `${trips.length} trips` : undefined} />
      <div className="mx-auto w-full max-w-[760px]">
        <GroupedTripList trips={trips} hrefFor={ROUTES.rider.trip} />
      </div>
    </>
  );
}
