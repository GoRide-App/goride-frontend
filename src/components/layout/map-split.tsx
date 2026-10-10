"use client";

import * as React from "react";
import { animate, motion, useDragControls, useMotionValue, useReducedMotion, type PanInfo } from "framer-motion";
import { cn } from "@/lib/utils";
import { springs } from "@/components/ui/motion";
import { SheetHandle, SheetHostProvider } from "@/components/ui/sheet";
import { useIsMobile } from "@/components/ui/use-media";

/**
 * MapSplit: the ride-flow layout.
 *
 * Desktop (md+): the live map fills the left, a phone-width white panel sits on
 * the right (460–500px) so the options read like the app's own sheet.
 *
 * Mobile: the map is full-bleed and the panel is a draggable white sheet with a
 * handle. It rests at `peek` (56% of the region) and drags up to `expanded`
 * (92%). Only the transform animates; the sheet is never resized mid-motion.
 *
 * Children can open modal `BottomSheet`s and `Dialog`s freely: both portal to
 * this layout's host element, so they escape the sheet's transform.
 */
export type SheetSnap = "peek" | "full";

export interface MapSplitProps {
  map: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** Mobile: fraction of the region the sheet occupies at rest (0–1, default 0.56). */
  peek?: number;
  /** Mobile: fraction when expanded (default 0.92). */
  expanded?: number;
  /** Controlled snap state (mobile). */
  snap?: SheetSnap;
  onSnapChange?: (snap: SheetSnap) => void;
  /** Desktop panel width: `narrow` (default, phone-like) or `wide` (50/50). */
  panel?: "narrow" | "wide";
  /** Accessible name for the sheet/panel region. */
  ariaLabel?: string;
}

export function MapSplit({ map, children, className, peek = 0.56, expanded = 0.92, snap, onSnapChange, panel = "narrow", ariaLabel = "Trip options" }: MapSplitProps) {
  const mobile = useIsMobile();
  if (mobile) {
    return (
      <MobileSplit map={map} className={className} peek={peek} expanded={expanded} snap={snap} onSnapChange={onSnapChange} ariaLabel={ariaLabel}>
        {children}
      </MobileSplit>
    );
  }
  return (
    <DesktopSplit map={map} className={className} panel={panel} ariaLabel={ariaLabel}>
      {children}
    </DesktopSplit>
  );
}

/* ------------------------------------------------------------------ */
/* Desktop                                                              */
/* ------------------------------------------------------------------ */

function DesktopSplit({ map, children, className, panel, ariaLabel }: { map: React.ReactNode; children: React.ReactNode; className?: string; panel: "narrow" | "wide"; ariaLabel: string }) {
  const [host, setHost] = React.useState<HTMLElement | null>(null);
  return (
    <div className={cn("flex h-full w-full overflow-hidden bg-surface-2", className)}>
      <div className="relative min-w-0 flex-1">{map}</div>
      <section
        ref={setHost}
        aria-label={ariaLabel}
        className={cn(
          "relative z-10 flex h-full shrink-0 flex-col overflow-hidden bg-white shadow-[-20px_0_48px_-32px_rgba(17,17,17,0.35)]",
          panel === "wide" ? "w-1/2" : "w-[460px] xl:w-[500px]",
        )}
      >
        <SheetHostProvider value={host}>{children}</SheetHostProvider>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Mobile: full-bleed map + draggable sheet                             */
/* ------------------------------------------------------------------ */

const OVERLAP = 32; // px of map that runs under the sheet's rounded top

function MobileSplit({ map, children, className, peek, expanded, snap, onSnapChange, ariaLabel }: { map: React.ReactNode; children: React.ReactNode; className?: string; peek: number; expanded: number; snap?: SheetSnap; onSnapChange?: (s: SheetSnap) => void; ariaLabel: string }) {
  const [host, setHost] = React.useState<HTMLDivElement | null>(null);
  const [height, setHeight] = React.useState(0);
  const [internalSnap, setInternalSnap] = React.useState<SheetSnap>(snap ?? "peek");
  const current = snap ?? internalSnap;
  const reduce = useReducedMotion();
  const y = useMotionValue(0);
  const controls = useDragControls();
  const entered = React.useRef(false);
  const dragged = React.useRef(false);

  const setSnap = React.useCallback(
    (s: SheetSnap) => {
      setInternalSnap(s);
      onSnapChange?.(s);
    },
    [onSnapChange],
  );

  React.useEffect(() => {
    if (!host) return;
    const ro = new ResizeObserver(([entry]) => setHeight(entry.contentRect.height));
    ro.observe(host);
    return () => ro.disconnect();
  }, [host]);

  const peekY = Math.max(0, Math.round((expanded - peek) * height));
  const target = current === "full" ? 0 : peekY;

  React.useEffect(() => {
    if (!height) return;
    if (!entered.current) {
      entered.current = true;
      y.set(expanded * height); // start fully below the fold
    }
    const ctrl = animate(y, target, reduce ? { duration: 0.01 } : springs.sheet);
    return () => ctrl.stop();
  }, [height, target, expanded, y, reduce]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    dragged.current = Math.abs(info.offset.y) > 6;
    const pos = y.get();
    const fast = Math.abs(info.velocity.y) > 250;
    const goFull = fast ? info.velocity.y < 0 : pos < peekY / 2;
    const next: SheetSnap = goFull ? "full" : "peek";
    if (next === current) animate(y, target, springs.sheet);
    else setSnap(next);
  };

  const toggle = () => {
    if (dragged.current) {
      dragged.current = false;
      return;
    }
    setSnap(current === "full" ? "peek" : "full");
  };

  return (
    <div ref={setHost} className={cn("relative h-full w-full overflow-hidden bg-surface-2", className)}>
      {/* Map: ends just under the sheet's resting edge so overlays and the
          attribution stay visible above it. */}
      <div
        className="absolute inset-x-0 top-0 [--map-attr-offset:32px] [--map-overlap:32px]"
        style={{ height: `calc(${((1 - peek) * 100).toFixed(3)}% + ${OVERLAP}px)` }}
      >
        {map}
      </div>

      <motion.section
        aria-label={ariaLabel}
        className="absolute inset-x-0 bottom-0 z-20 flex flex-col rounded-t-sheet bg-white shadow-sheet will-change-transform"
        style={{ y, height: `${(expanded * 100).toFixed(3)}%` }}
        drag={reduce ? false : "y"}
        dragControls={controls}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: peekY }}
        dragElastic={{ top: 0.04, bottom: 0.18 }}
        dragMomentum={false}
        onDragEnd={onDragEnd}
      >
        <div
          className="flex shrink-0 cursor-grab touch-none select-none justify-center pb-2 pt-3 active:cursor-grabbing"
          onPointerDown={(e) => !reduce && controls.start(e)}
        >
          <button type="button" onClick={toggle} aria-label={current === "full" ? "Collapse panel" : "Expand panel"} aria-expanded={current === "full"} className="flex h-6 w-24 items-center justify-center rounded-full">
            <SheetHandle />
          </button>
        </div>
        <SheetHostProvider value={host}>
          <div
            className="flex min-h-0 flex-1 flex-col"
            style={{ paddingBottom: `calc(${current === "peek" ? peekY : 0}px + var(--tabbar-h, 0px))` }}
          >
            {children}
          </div>
        </SheetHostProvider>
      </motion.section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Panel pieces                                                         */
/* ------------------------------------------------------------------ */

/** Title row for the options column. */
export function PanelHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return <header className={cn("flex shrink-0 items-center gap-3 border-b border-line px-5 py-4", className)}>{children}</header>;
}

/** Scrolling body for the options column, capped at a readable measure. */
export function PanelBody({ children, className, contentClassName }: { children: React.ReactNode; className?: string; contentClassName?: string }) {
  return (
    <div className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain md:scrollbar-visible", className)}>
      <div className={cn("mx-auto w-full max-w-[560px] px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-4 md:pt-5", contentClassName)}>{children}</div>
    </div>
  );
}

/** Pinned footer for the options column (primary CTA lives here). */
export function PanelFooter({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-[560px] shrink-0 border-t border-line bg-white px-5 py-4", className)}>{children}</div>;
}

/** A floating control on top of the map column. On mobile it lifts above the sheet's rounded edge. */
export function MapOverlay({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("absolute z-10 pb-[var(--map-overlap,0px)]", className)}>{children}</div>;
}
