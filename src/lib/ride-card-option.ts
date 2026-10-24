import type { SavedCard } from "@/types";

type RideCardOption =
  | { kind: "loading" }
  | { kind: "fallback" }
  | { kind: "add" }
  | { kind: "saved"; card: SavedCard };

/** Only a successful empty response means the rider needs to add a card. */
export function rideCardOption(cards: SavedCard[] | null, error: string | null, loading = false): RideCardOption {
  if (loading) return { kind: "loading" };
  if (error) return { kind: "fallback" };
  if (!cards) return { kind: "loading" };
  // The checkout loader sorts default first, then newest; retain that preference.
  const card = cards.find((c) => c.isDefault) ?? cards[0];
  return card ? { kind: "saved", card } : { kind: "add" };
}
