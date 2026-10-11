"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { BedDouble, Clock, GraduationCap, Hospital, Landmark, LocateFixed, MapPin, MapPinned, Plane, ShoppingBag, Signpost, TrainFront, TreePalm, X, type LucideIcon } from "lucide-react";
import type { Place } from "@/types";
import { searchPlaces } from "@/lib/geo/providers";
import { PLACES } from "@/lib/mock/seed";
import { cn, splitAddress } from "@/lib/utils";
import { listVariants } from "@/components/ui/motion";
import { ListRow } from "@/components/ui/primitives";
import { Spinner } from "@/components/ui/spinner";
import { useListItemVariants } from "./ride-bits";

/** Debounced place search with local landmarks as instant results. */
export function usePlaceSearch(query: string, enabled = true) {
  const [state, setState] = React.useState<{ q: string; results: Place[] }>({ q: "", results: [] });
  const q = query.trim();
  React.useEffect(() => {
    if (!enabled || q.length < 2) return;
    let alive = true;
    const t = setTimeout(async () => {
      const r = await searchPlaces(q);
      if (alive) setState({ q, results: r });
    }, 450);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q, enabled]);
  const active = enabled && q.length >= 2;
  return { results: active ? state.results : [], loading: active && state.q !== q };
}

/* ------------------------------------------------------------------ */
/* Place-type icons (derived from the place's own words)                */
/* ------------------------------------------------------------------ */

type PlaceKind = "campus" | "rail" | "air" | "shop" | "health" | "worship" | "park" | "stay" | "road" | "pin";

export function placeKindFor(p: Pick<Place, "name" | "address">): PlaceKind {
  const s = `${p.name} ${p.address}`.toLowerCase();
  if (/campus|university|college|school|institute/.test(s)) return "campus";
  if (/railway|station|train/.test(s)) return "rail";
  if (/airport/.test(s)) return "air";
  if (/mall|plaza|market|shopping|city centre|city center|store/.test(s)) return "shop";
  if (/hospital|clinic/.test(s)) return "health";
  if (/temple|church|kovil|mosque|vihara/.test(s)) return "worship";
  if (/park|green|beach|garden|lake|zoo/.test(s)) return "park";
  if (/hotel|resort/.test(s)) return "stay";
  if (/junction|road|street|lane|mawatha|bus/.test(s)) return "road";
  return "pin";
}

const PLACE_ICONS: Record<PlaceKind, LucideIcon> = {
  campus: GraduationCap,
  rail: TrainFront,
  air: Plane,
  shop: ShoppingBag,
  health: Hospital,
  worship: Landmark,
  park: TreePalm,
  stay: BedDouble,
  road: Signpost,
  pin: MapPin,
};

/** Icon for a place, drawn from its own words (campus, station, mall…). */
export function PlaceIcon({ place, recent, size = 18 }: { place: Pick<Place, "name" | "address">; recent?: boolean; size?: number }) {
  if (recent) return <Clock size={size} />;
  const kind = placeKindFor(place);
  return React.createElement(PLACE_ICONS[kind], { size });
}

export function PlaceRow({ place, onPick, recent, className }: { place: Place; onPick: (p: Place) => void; recent?: boolean; className?: string }) {
  const { primary, secondary } = splitAddress(place.address);
  return <ListRow icon={<PlaceIcon place={place} recent={recent} />} title={place.name} description={secondary || primary} onClick={() => onPick(place)} className={cn("-mx-3", className)} />;
}

/* ------------------------------------------------------------------ */
/* Suggestions: quick actions, then results or recents                  */
/* ------------------------------------------------------------------ */

export function SuggestionList({
  items,
  loading,
  onPick,
  recents,
  onUseCurrent,
  onSetOnMap,
  emptyQuery,
  className,
}: {
  items: Place[];
  loading?: boolean;
  onPick: (p: Place) => void;
  recents?: Place[];
  onUseCurrent?: () => void;
  onSetOnMap?: () => void;
  emptyQuery?: boolean;
  className?: string;
}) {
  const itemVariants = useListItemVariants();
  // Pickup shortcuts stay reachable while typing; they only make sense for the pickup field, which is when they are passed.
  const showQuick = onUseCurrent || onSetOnMap;
  const list = emptyQuery ? (recents ?? []) : items;
  return (
    <div className={cn("flex flex-col", className)}>
      {showQuick && (
        <div className="-mx-3 mb-2 flex flex-col">
          {onUseCurrent && <ListRow icon={<LocateFixed />} iconTone="brand" title="Use my current location" onClick={onUseCurrent} />}
          {onSetOnMap && <ListRow icon={<MapPinned />} iconTone="ink" title="Set pickup on the map" description="Drop a pin exactly where you'll wait" onClick={onSetOnMap} />}
        </div>
      )}
      {emptyQuery && list.length > 0 && <p className="mb-1 mt-2 text-[13px] font-semibold text-muted">Recent</p>}
      {loading && (
        <div className="flex items-center gap-2 px-1 py-3 text-[13px] text-muted" role="status" aria-live="polite">
          <Spinner className="h-4 w-4" /> Searching…
        </div>
      )}
      {!loading && !emptyQuery && items.length === 0 && (
        <p className="px-1 py-6 text-center text-[13px] text-muted text-pretty" role="status">
          No places found. Try a landmark, road or area name.
        </p>
      )}
      <motion.ul key={emptyQuery ? "recents" : "results"} variants={listVariants} initial="hidden" animate="show" className="flex flex-col">
        {list.map((p) => (
          <motion.li key={`${p.name}-${p.lat}-${p.lng}`} variants={itemVariants}>
            <PlaceRow place={p} onPick={onPick} recent={emptyQuery} />
          </motion.li>
        ))}
      </motion.ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Route row input: a small label over a bold value, inside the card    */
/* ------------------------------------------------------------------ */

export function SearchInput({
  value,
  onChange,
  placeholder,
  autoFocus,
  onFocus,
  onClear,
  className,
  inputRef,
  label,
  trailing,
  active,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  autoFocus?: boolean;
  onFocus?: () => void;
  onClear?: () => void;
  className?: string;
  inputRef?: React.Ref<HTMLInputElement>;
  label: string;
  /** Control shown when the field is empty (locate, remove…). */
  trailing?: React.ReactNode;
  /** The row being edited: highlighted even when focus is elsewhere. */
  active?: boolean;
}) {
  const id = React.useId();
  return (
    <div className={cn("group -mx-2 flex min-h-14 items-center gap-2 rounded-xl px-2 py-2.5 transition-colors duration-150", active && "bg-brand-50/70", className)}>
      <div className="min-w-0 flex-1">
        <label htmlFor={id} className={cn("block text-[11px] font-medium leading-none transition-colors duration-150", active ? "text-brand-800" : "text-muted")}>
          {label}
        </label>
        <input
          ref={inputRef}
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={onFocus}
          autoFocus={autoFocus}
          autoComplete="off"
          spellCheck={false}
          placeholder={placeholder}
          className="mt-1 block w-full truncate bg-transparent text-[15px] font-semibold leading-snug text-ink outline-none placeholder:font-medium placeholder:text-muted"
        />
      </div>
      {value && onClear ? (
        <button type="button" aria-label={`Clear ${label.toLowerCase()}`} onClick={onClear} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-ink">
          <X size={16} />
        </button>
      ) : (
        trailing
      )}
    </div>
  );
}

export const RECENT_PLACES: Place[] = [PLACES.find((p) => p.name === "SLIIT Malabe Campus")!, PLACES.find((p) => p.name === "One Galle Face Mall")!, PLACES.find((p) => p.name === "Colombo Fort Railway Station")!];
