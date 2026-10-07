"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowChip } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ActionTone = "brand" | "light" | "dark";

const surfaces: Record<ActionTone, string> = {
  brand: "bg-brand-400 text-ink shadow-[0_14px_32px_-18px_rgba(255,194,26,0.95)] hover:bg-brand-300 focus-visible:outline-ink",
  light: "bg-white text-ink shadow-card hover:shadow-float",
  dark: "bg-navy-900 text-white hover:bg-navy-800 focus-visible:outline-brand-400",
};
const tiles: Record<ActionTone, string> = {
  brand: "bg-ink text-brand-400",
  light: "bg-surface-2 text-ink",
  dark: "bg-white/10 text-brand-300",
};
const quiet: Record<ActionTone, string> = { brand: "text-ink/70", light: "text-muted", dark: "text-white/60" };
const chipTone = { brand: "ink", light: "ink", dark: "brand" } as const;

/**
 * A big tappable action: icon tile, title, one line of description and the
 * round arrow chip at the right end (the Waygo "Get started" gesture, as a card).
 */
export function ActionCard({ href, onClick, icon, title, description, tone = "light", className }: { href?: string; onClick?: () => void; icon: React.ReactNode; title: string; description: string; tone?: ActionTone; className?: string }) {
  const cls = cn(
    "group flex min-h-[108px] w-full items-center gap-4 rounded-card p-5 text-left",
    "transition-[transform,box-shadow,background-color] duration-200 ease-(--ease-spring) active:scale-[0.99] md:p-6",
    surfaces[tone],
    className,
  );
  const inner = (
    <>
      <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl [&_svg]:h-[22px] [&_svg]:w-[22px]", tiles[tone])}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[17px] font-semibold leading-snug tracking-[-0.01em]">{title}</span>
        <span className={cn("mt-0.5 block text-[13px] leading-snug text-pretty", quiet[tone])}>{description}</span>
      </span>
      <ArrowChip tone={chipTone[tone]} className="transition-transform duration-200 ease-(--ease-spring) group-hover:translate-x-0.5" />
    </>
  );
  if (href)
    return (
      <Link href={href} className={cls}>
        {inner}
      </Link>
    );
  return (
    <button type="button" onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}
