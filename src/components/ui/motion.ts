import type { Transition, Variants } from "framer-motion";

/**
 * One motion grammar for the whole app.
 *
 * - Springs for things you touch (buttons, sheets, tabs).
 * - Short ease-out fades for things that appear.
 * - Stagger lists at 50ms.
 * Pair with `useReducedMotion()` from framer-motion: when it returns true,
 * use `fadeOnly` instead of a transform-based variant.
 */
export const springs = {
  /** Buttons, chips, tab indicator. */
  snappy: { type: "spring", stiffness: 480, damping: 34, mass: 0.8 } as Transition,
  /** Sheets, dialogs, panels landing. */
  sheet: { type: "spring", stiffness: 420, damping: 36, mass: 0.9 } as Transition,
  /** Sheets leaving: a touch more damping so nothing overshoots off-screen. */
  sheetExit: { type: "spring", stiffness: 420, damping: 40, mass: 0.9 } as Transition,
  /** Cards and larger surfaces. */
  soft: { type: "spring", stiffness: 300, damping: 30 } as Transition,
} as const;

export const easeOut = [0.22, 1, 0.36, 1] as const;

export const fades = {
  fast: { duration: 0.18, ease: easeOut } as Transition,
  normal: { duration: 0.24, ease: easeOut } as Transition,
  exit: { duration: 0.15, ease: "easeOut" } as Transition,
} as const;

/** 50ms between list items, 40ms before the first one. */
export const stagger = {
  list: { staggerChildren: 0.05, delayChildren: 0.04 },
  tight: { staggerChildren: 0.04 },
} as const;

/** Container + item variants for a staggered list entrance. */
export const listVariants: Variants = {
  hidden: {},
  show: { transition: stagger.list },
};

export const itemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: fades.normal },
};

/** Reduced-motion fallback: opacity only, under 200ms. */
export const fadeOnly: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: fades.fast },
};

/** Enter/exit for a surface appearing in place (toasts, popovers, cards). */
export const popIn = {
  initial: { opacity: 0, y: 8, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 4, scale: 0.98, transition: fades.exit },
} as const;
