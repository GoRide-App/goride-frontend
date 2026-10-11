"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Spinner } from "./spinner";

/**
 * Buttons are pills. `primary` (and its alias `brand`) is the one yellow
 * action per screen; `dark` is the charcoal pill; `secondary`/`white` are the
 * quiet surfaces; `outline` and `ghost` are text-weight; `danger` is red.
 * `driver` keeps the captain's amber. `arrow` adds the Waygo chip on the right.
 */
export type ButtonVariant = "primary" | "brand" | "dark" | "driver" | "danger" | "secondary" | "outline" | "ghost" | "white";
export type ButtonSize = "sm" | "md" | "lg" | "icon" | "icon-sm" | "icon-lg";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-brand-400 text-ink hover:bg-brand-300 active:bg-brand-500",
  brand: "bg-brand-400 text-ink hover:bg-brand-300 active:bg-brand-500",
  dark: "bg-ink text-white hover:bg-navy-800 active:bg-navy-950 focus-visible:outline-brand-400",
  // ink on amber: white on #f28c00 is only ~2.5:1
  driver: "bg-driver-500 text-ink hover:bg-driver-400 active:bg-driver-600",
  danger: "bg-danger text-white hover:bg-[#ef4b4e] active:bg-[#c92d30]",
  secondary: "bg-surface-2 text-ink hover:bg-surface-3 active:bg-[#dededa]",
  outline: "bg-transparent text-ink ring-2 ring-inset ring-ink hover:bg-surface-2 active:bg-surface-3",
  ghost: "bg-transparent text-ink hover:bg-surface-2 active:bg-surface-3",
  white: "bg-white text-ink shadow-card hover:bg-surface-2 active:bg-surface-3",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-10 px-4 text-[13px] gap-1.5",
  md: "h-12 px-5 text-sm gap-2",
  lg: "h-14 px-6 text-[15px] gap-2.5",
  icon: "h-11 w-11",
  "icon-sm": "h-9 w-9",
  "icon-lg": "h-14 w-14",
};

/** Arrow chip size per button size (chip sits 6px inside the pill edge). */
const chipSize: Record<ButtonSize, "sm" | "md" | "lg"> = { sm: "sm", md: "md", lg: "lg", icon: "md", "icon-sm": "sm", "icon-lg": "lg" };
const chipPad: Record<ButtonSize, string> = { sm: "pr-11 pl-5", md: "pr-14 pl-6", lg: "pr-16 pl-7", icon: "", "icon-sm": "", "icon-lg": "" };

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  loadingText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  href?: string;
  /** Stretch to the container width (default true, like before). */
  full?: boolean;
  /** Waygo "Get started" chip: a round arrow at the right end of the pill. */
  arrow?: boolean;
  /** Replace the arrow glyph inside the chip (e.g. a `Check`). */
  arrowIcon?: React.ReactNode;
}

const base =
  "relative inline-flex select-none items-center justify-center rounded-full font-semibold tracking-[-0.01em] " +
  "transition-[transform,background-color,color,box-shadow,opacity] duration-200 ease-(--ease-spring) " +
  "active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 " +
  "[&_svg]:shrink-0";

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", loading, loadingText, leftIcon, rightIcon, href, full = true, arrow, arrowIcon, children, disabled, type = "button", ...props },
  ref,
) {
  const isIcon = size.startsWith("icon");
  const classes = cn(base, variants[variant], sizes[size], full && !isIcon && "w-full", arrow && !isIcon && chipPad[size], className);

  const chip = arrow && !isIcon ? (
    <span className="absolute right-1.5 top-1/2 -translate-y-1/2">
      <ArrowChip size={chipSize[size]} tone={chipToneFor(variant)} icon={arrowIcon} />
    </span>
  ) : null;

  if (href && !disabled && !loading) {
    return (
      <Link href={href} className={classes}>
        {leftIcon}
        {children}
        {rightIcon}
        {chip}
      </Link>
    );
  }

  return (
    <button ref={ref} type={type} className={classes} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
      {loading ? (
        <>
          <Spinner className={cn("h-4 w-4", isIcon && "h-5 w-5")} />
          {!isIcon && (loadingText ?? children)}
        </>
      ) : (
        <>
          {leftIcon}
          {children}
          {rightIcon}
          {chip}
        </>
      )}
    </button>
  );
});

function chipToneFor(variant: ButtonVariant): ArrowChipTone {
  switch (variant) {
    case "dark":
      return "brand";
    case "danger":
      return "white";
    default:
      return "ink";
  }
}

/* ------------------------------------------------------------------ */
/* ArrowChip: the black circular arrow from the Waygo buttons           */
/* ------------------------------------------------------------------ */

export type ArrowChipTone = "ink" | "brand" | "white";

const chipTones: Record<ArrowChipTone, string> = {
  ink: "bg-ink text-white",
  brand: "bg-brand-400 text-ink",
  white: "bg-white text-ink",
};
const chipDims = { sm: "h-7 w-7 [&_svg]:h-3.5 [&_svg]:w-3.5", md: "h-9 w-9 [&_svg]:h-4 [&_svg]:w-4", lg: "h-11 w-11 [&_svg]:h-[18px] [&_svg]:w-[18px]" };

export function ArrowChip({ size = "md", tone = "ink", icon, className }: { size?: "sm" | "md" | "lg"; tone?: ArrowChipTone; icon?: React.ReactNode; className?: string }) {
  return (
    <span aria-hidden className={cn("inline-flex shrink-0 items-center justify-center rounded-full", chipTones[tone], chipDims[size], className)}>
      {icon ?? <ArrowRight strokeWidth={2.5} />}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* IconButton: round, 44px, labelled                                     */
/* ------------------------------------------------------------------ */

export function IconButton({ className, label, size = "icon", variant = "white", ...props }: ButtonProps & { label: string }) {
  return <Button size={size} variant={variant} aria-label={label} title={label} className={cn("shrink-0", className)} {...props} />;
}
