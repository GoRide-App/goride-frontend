"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { FareEstimate, Place, Trip } from "@/types";
import { api, errorMessage } from "@/lib/api/index";

/**
 * Ride planning store — SCRUM-46/47/48/50/53/54 slice only: pickup/
 * destination selection (map, GPS, address search, pin-drop) through
 * vehicle-type + fare display. Nothing beyond selecting a vehicle (trip
 * request, driver matching, tracking, payment, rating, cancel, SOS) is
 * implemented yet, so this store doesn't carry state for any of it.
 */
export type RidePhase = "plan" | "select";

interface RideState {
  pickup: Place | null;
  destination: Place | null;
  uiPhase: RidePhase;
  trip: Trip | null;
  estimates: FareEstimate[];
  selectedVehicleTypeId: string | null;
  busy: boolean;
  error: string | null;

  setPickup: (p: Place | null) => void;
  setDestination: (p: Place | null) => void;
  setSelectedVehicle: (id: string) => void;
  clearError: () => void;

  /** Creates a draft trip and fetches fares for it — the whole SCRUM-54 flow. */
  createDraft: (riderId: string) => Promise<boolean>;
  /** Back to pickup/destination selection. */
  resetPlanning: () => void;
}

export const useRideStore = create<RideState>()(
  persist(
    (set, get) => ({
      pickup: null,
      destination: null,
      uiPhase: "plan",
      trip: null,
      estimates: [],
      selectedVehicleTypeId: null,
      busy: false,
      error: null,

      setPickup: (pickup) => set({ pickup }),
      setDestination: (destination) => set({ destination }),
      setSelectedVehicle: (selectedVehicleTypeId) => {
        // Only TukTuk is bookable in this stage (SCRUM-53/54) -- every
        // other vehicle type is display-only, even though its fare is real.
        const est = get().estimates.find((e) => e.vehicleTypeId === selectedVehicleTypeId);
        if (est && est.available !== false) set({ selectedVehicleTypeId });
      },
      clearError: () => set({ error: null }),

      async createDraft(riderId) {
        const { pickup, destination } = get();
        if (!pickup || !destination) return false;
        set({ busy: true, error: null });
        try {
          const trip = await api.trips.create({ riderId, pickup, destination });
          const estimates = await api.trips.estimate(trip.id);
          const selected = estimates.find((e) => e.available)?.vehicleTypeId ?? null;
          set({ trip, estimates, selectedVehicleTypeId: selected, uiPhase: "select", busy: false });
          return true;
        } catch (e) {
          set({ busy: false, error: errorMessage(e) });
          return false;
        }
      },

      resetPlanning() {
        set({ pickup: null, destination: null, uiPhase: "plan", trip: null, estimates: [], selectedVehicleTypeId: null, error: null });
      },
    }),
    {
      name: "goride.ride",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (s) => ({ pickup: s.pickup, destination: s.destination, selectedVehicleTypeId: s.selectedVehicleTypeId, uiPhase: s.uiPhase }),
    },
  ),
);
