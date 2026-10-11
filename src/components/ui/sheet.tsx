"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion, type PanInfo } from "framer-motion";
import { ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { fades, springs } from "./motion";

/* ------------------------------------------------------------------ */
/* Sheet host: where absolutely-positioned sheets/dialogs should land   */
/* ------------------------------------------------------------------ */

/**
 * Layouts that transform their content (the draggable map sheet) provide a
 * host element so overlays escape the transform and cover the whole region.
 * Overlays fall back to their nearest `relative` ancestor when no host exists.
 */
const SheetHostContext = React.createContext<HTMLElement | null>(null);
export const SheetHostProvider = SheetHostContext.Provider;
export function useSheetHost() {
  return React.useContext(SheetHostContext);
}

/** Render `node` into the sheet host when one exists. */
export function InSheetHost({ children }: { children: React.ReactNode }) {
  const host = useSheetHost();
  if (host) return createPortal(children, host);
  return <>{children}</>;
}

/* ------------------------------------------------------------------ */
/* BottomSheet                                                          */
/* ------------------------------------------------------------------ */

export interface BottomSheetProps {
  open: boolean;
  onClose?: () => void;
  children: React.ReactNode;
  className?: string;
  /** Dim backdrop behind the sheet (modal feel). */
  backdrop?: boolean;
  /** Drag handle (default) or a collapse chevron. */
  handle?: boolean | "chevron";
  /** Allow swipe-down / backdrop tap to dismiss. */
  dismissible?: boolean;
  /** Max height of the sheet (CSS value). */
  maxHeight?: string;
  ariaLabel?: string;
  /** Reports the rendered sheet height (px) so siblings can sit above it. */
  onHeightChange?: (h: number) => void;
  /** `absolute` inside the nearest positioned region (default) or `fixed` to the viewport. */
  position?: "absolute" | "fixed";
}

export function BottomSheet({ open, onClose, children, className, backdrop = false, handle = true, dismissible = true, maxHeight = "88%", ariaLabel, onHeightChange, position = "absolute" }: BottomSheetProps) {
  const ref = React.useRef<HTMLElement | null>(null);
  const reduce = useReducedMotion();

  React.useEffect(() => {
    if (!open) {
      onHeightChange?.(0);
      return;
    }
    const el = ref.current;
    if (!el || !onHeightChange) return;
    const ro = new ResizeObserver(() => onHeightChange(el.getBoundingClientRect().height));
    ro.observe(el);
    return () => ro.disconnect();
  }, [open, onHeightChange]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (!dismissible || !onClose) return;
    if (info.offset.y > 90 || info.velocity.y > 600) onClose();
  };

  const sheetMotion = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: fades.fast }
    : { initial: { y: "100%" }, animate: { y: 0 }, exit: { y: "100%", transition: springs.sheetExit }, transition: springs.sheet };

  return (
    <InSheetHost>
      <AnimatePresence>
        {open && (
          <>
            {backdrop && (
              <motion.button
                type="button"
                aria-label="Close"
                className={cn("inset-0 z-40 bg-ink/45 backdrop-blur-[2px]", position)}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={fades.normal}
                onClick={dismissible ? onClose : undefined}
              />
            )}
            <motion.section
              ref={ref}
              role="dialog"
              aria-modal={backdrop || undefined}
              aria-label={ariaLabel}
              className={cn(
                // inset-x-0 + mx-auto keeps the sheet full-width in a narrow column
                // and centred (never edge-to-edge) inside a wide desktop region.
                "inset-x-0 bottom-0 z-40 mx-auto flex w-full max-w-[640px] flex-col overflow-hidden rounded-t-sheet bg-white shadow-sheet",
                position,
                className,
              )}
              style={{ maxHeight }}
              {...sheetMotion}
              drag={dismissible && handle && !reduce ? "y" : false}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.5 }}
              onDragEnd={onDragEnd}
            >
              {handle && (
                <button
                  type="button"
                  aria-label={dismissible ? "Collapse" : "Sheet"}
                  onClick={dismissible ? onClose : undefined}
                  className="flex w-full cursor-grab touch-none items-center justify-center pb-1 pt-3 active:cursor-grabbing"
                >
                  {handle === "chevron" ? <ChevronDown strokeWidth={2.5} className="text-muted" /> : <SheetHandle />}
                </button>
              )}
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5 safe-bottom">{children}</div>
            </motion.section>
          </>
        )}
      </AnimatePresence>
    </InSheetHost>
  );
}

/** The grab handle pill. */
export function SheetHandle({ className }: { className?: string }) {
  return <span aria-hidden className={cn("block h-[5px] w-10 rounded-full bg-ink/15", className)} />;
}

/** Title row for sheet content: heading, optional description, optional close. */
export function SheetHeader({ title, description, onClose, action, className }: { title: React.ReactNode; description?: React.ReactNode; onClose?: () => void; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("mb-4 flex items-start justify-between gap-3 pt-1", className)}>
      <div className="min-w-0">
        <h2 className="text-xl font-semibold leading-tight tracking-[-0.015em] text-balance">{title}</h2>
        {description && <p className="mt-1 text-[13px] leading-snug text-muted text-pretty">{description}</p>}
      </div>
      {action}
      {onClose && (
        <button type="button" onClick={onClose} aria-label="Close" className="-mr-2 -mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-ink">
          <X size={18} />
        </button>
      )}
    </div>
  );
}

/** A sheet that's always visible (docked), e.g. a persistent options panel. */
export function DockedPanel({ children, className, position = "bottom" }: { children: React.ReactNode; className?: string; position?: "top" | "bottom" }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { y: position === "bottom" ? 40 : -40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={reduce ? fades.fast : springs.sheet}
      className={cn(
        "absolute inset-x-0 z-30 mx-auto w-full max-w-[640px] bg-white",
        position === "bottom" ? "bottom-0 rounded-t-sheet px-5 pb-5 pt-3 shadow-sheet safe-bottom" : "top-0 rounded-b-sheet px-5 pb-5 pt-5 shadow-card",
        className,
      )}
    >
      {children}
    </motion.div>
  );
}
