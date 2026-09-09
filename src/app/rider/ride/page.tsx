"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { Place, VehicleType } from "@/types";
import { api } from "@/lib/api";
import { ROUTES } from "@/lib/constants";
import { useCurrentUser } from "@/components/layout/role-guard";
import { useSetShellHeader } from "@/components/layout/shell-header";
import { toast } from "@/components/ui/toast";
import { type ActiveField, PlanPanel, SelectVehicleSheet } from "@/components/rider/ride-phases";
import { useRideStore } from "@/store/ride-store";

const PHASE_TITLE: Record<string, string> = {
  plan: "Find a trip",
  select: "Choose a ride",
};

/**
 * Rider ride page — SCRUM-54 slice only: pickup/destination -> vehicle types
 * + calculated fare. Trip request, driver matching, live tracking, payment
 * and rating aren't implemented yet, so the flow stops at vehicle selection.
 */
export default function RiderRidePage() {
  const user = useCurrentUser()!;
  const router = useRouter();
  const s = useRideStore();

  const [vehicleTypes, setVehicleTypes] = React.useState<VehicleType[]>([]);
  const [activeField, setActiveField] = React.useState<ActiveField>(null);

  useSetShellHeader({ title: PHASE_TITLE[s.uiPhase] ?? "Your ride", description: "Vehicle types and calculated fare" });

  React.useEffect(() => {
    api.trips.vehicleTypes().then(setVehicleTypes).catch(() => {});
  }, []);

  const onPick = (field: Exclude<ActiveField, null>, p: Place) => {
    if (field === "pickup") s.setPickup(p);
    else if (field === "destination") s.setDestination(p);
    setActiveField(null);
  };

  const onSearch = async () => {
    const ok = await s.createDraft(user.id);
    if (!ok && s.error) toast.error("Couldn't calculate fares", s.error);
  };

  return (
    <div className="mx-auto w-full max-w-[620px]">
      {s.uiPhase === "plan" ? (
        <PlanPanel
          pickup={s.pickup}
          destination={s.destination}
          activeField={activeField}
          setActiveField={setActiveField}
          onPick={onPick}
          onSearch={onSearch}
          busy={s.busy}
          error={s.error}
          onBack={() => router.push(ROUTES.rider.home)}
        />
      ) : (
        s.trip && (
          <SelectVehicleSheet
            trip={s.trip}
            vehicleTypes={vehicleTypes}
            estimates={s.estimates}
            selectedId={s.selectedVehicleTypeId}
            onSelect={s.setSelectedVehicle}
            onBack={() => {
              s.resetPlanning();
              setActiveField(null);
            }}
          />
        )
      )}
    </div>
  );
}
