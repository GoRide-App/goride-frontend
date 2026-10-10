"use client";

import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { IdentityLink } from "@/components/auth/identity-link";
import { cn } from "@/lib/utils";

/**
 * The Waygo pill: a rounded-full CTA whose trailing edge carries a round
 * arrow chip. Yellow is the primary; white and ink are the two quieter tones.
 * Every pill is an IdentityLink because every landing CTA ends at OIDC login.
 */
const TONES = {
  yellow:
    "bg-brand-400 text-ink hover:bg-brand-300 [&_.chip]:bg-ink [&_.chip]:text-brand-400 focus-visible:outline-white",
  white:
    "bg-white text-ink hover:bg-brand-50 [&_.chip]:bg-ink [&_.chip]:text-white focus-visible:outline-white",
  ink: "bg-ink text-white hover:bg-navy-800 [&_.chip]:bg-brand-400 [&_.chip]:text-ink focus-visible:outline-ink",
} as const;

const SIZES = {
  sm: "py-1 pl-4 pr-1 text-sm [&_.chip]:size-9",
  md: "py-1.5 pl-5 pr-1.5 text-[15px] [&_.chip]:size-10",
  lg: "py-2 pl-6 pr-2 text-base [&_.chip]:size-11",
} as const;

export function PillLink({
  href,
  children,
  tone = "yellow",
  size = "md",
  className,
}: {
  href: string;
  children: ReactNode;
  tone?: keyof typeof TONES;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  return (
    <IdentityLink
      href={href}
      className={cn(
        "group inline-flex shrink-0 items-center gap-3 rounded-full font-semibold whitespace-nowrap transition-[background-color,transform] duration-200 ease-out active:scale-[0.97] focus-visible:outline-[2.5px] focus-visible:outline-offset-[3px]",
        TONES[tone],
        SIZES[size],
        className,
      )}
    >
      <span>{children}</span>
      <span
        aria-hidden="true"
        className="chip grid place-items-center rounded-full transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-0.5"
      >
        <ArrowRight size={18} strokeWidth={2.25} />
      </span>
    </IdentityLink>
  );
}
