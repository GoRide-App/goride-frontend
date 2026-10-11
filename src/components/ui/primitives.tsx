"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ChevronRight, Star } from "lucide-react";
import { cn, initials } from "@/lib/utils";
import { useInShell, useShellHeader } from "@/components/layout/shell-header";
import { springs } from "./motion";

/* ------------------------------------------------------------------ */
/* Avatar: initials on taxi yellow                                      */
/* ------------------------------------------------------------------ */

export function Avatar({ name, src, size = "md", className, tone }: { name: string; src?: string | null; size?: "xs" | "sm" | "md" | "lg" | "xl"; className?: string; tone?: string }) {
  const dims = { xs: "h-7 w-7 text-[10px]", sm: "h-9 w-9 text-xs", md: "h-11 w-11 text-sm", lg: "h-16 w-16 text-xl", xl: "h-24 w-24 text-3xl" }[size];
  return (
    <span className={cn("inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full font-semibold tracking-tight", dims, tone ?? "bg-brand-400 text-ink", className)} aria-hidden>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        initials(name)
      )}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Badge / status pill                                                  */
/* ------------------------------------------------------------------ */

export type Tone = "neutral" | "brand" | "info" | "warning" | "danger" | "success" | "driver" | "ink";

const toneClasses: Record<Tone, string> = {
  neutral: "bg-surface-2 text-ink-2",
  brand: "bg-brand-100 text-brand-800",
  info: "bg-blue-50 text-blue-700",
  warning: "bg-amber-50 text-amber-800",
  danger: "bg-red-50 text-red-700",
  success: "bg-emerald-50 text-emerald-700",
  driver: "bg-orange-50 text-orange-800",
  ink: "bg-ink text-white",
};

const dotClasses: Record<Tone, string> = {
  neutral: "bg-muted",
  brand: "bg-brand-500",
  info: "bg-info",
  warning: "bg-warning",
  danger: "bg-danger",
  success: "bg-success",
  driver: "bg-driver-500",
  ink: "bg-brand-400",
};

export function Badge({ tone = "neutral", children, className, dot, size = "sm" }: { tone?: Tone; children: React.ReactNode; className?: string; dot?: boolean; size?: "sm" | "md" }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-semibold leading-none", size === "md" ? "px-3 py-1.5 text-xs" : "px-2.5 py-1 text-[11px]", toneClasses[tone], className)}>
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full", dotClasses[tone], (tone === "success" || tone === "brand") && "animate-pulse-dot")} />}
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Card                                                                 */
/* ------------------------------------------------------------------ */

export type CardTone = "light" | "dark" | "brand" | "muted";

const cardTones: Record<CardTone, string> = {
  light: "bg-white text-ink shadow-card",
  dark: "bg-navy-900 text-white",
  brand: "bg-brand-400 text-ink",
  muted: "bg-surface-2 text-ink",
};

export function Card({ className, children, padded = true, tone = "light", interactive, ...props }: React.HTMLAttributes<HTMLDivElement> & { padded?: boolean; tone?: CardTone; interactive?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-card",
        cardTones[tone],
        padded && "p-5",
        interactive && "transition-[transform,box-shadow] duration-200 ease-(--ease-spring) hover:shadow-float active:scale-[0.99]",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/** A section heading with an optional action on the right. */
export function SectionTitle({ children, action, className, as: Tag = "h2" }: { children: React.ReactNode; action?: React.ReactNode; className?: string; as?: "h2" | "h3" | "p" }) {
  return (
    <div className={cn("mb-3 mt-7 flex items-baseline justify-between gap-3 first:mt-0", className)}>
      <Tag className="text-[15px] font-semibold tracking-[-0.01em] text-ink">{children}</Tag>
      {action && <span className="text-[13px] font-semibold text-muted [&_a:hover]:text-ink [&_button:hover]:text-ink">{action}</span>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Stat tile                                                            */
/* ------------------------------------------------------------------ */

export function StatTile({ label, value, sub, icon, tone = "light", className, delta }: { label: string; value: React.ReactNode; sub?: React.ReactNode; icon?: React.ReactNode; tone?: "light" | "dark" | "brand" | "driver"; className?: string; delta?: { value: string; up?: boolean } }) {
  const surface = {
    light: "bg-white text-ink shadow-card",
    dark: "bg-navy-900 text-white",
    brand: "bg-brand-400 text-ink",
    driver: "bg-driver-500 text-ink",
  }[tone];
  const quiet = { light: "text-muted", dark: "text-white/60", brand: "text-ink/65", driver: "text-ink/70" }[tone];
  const chip = { light: "bg-surface-2 text-ink", dark: "bg-white/10 text-brand-300", brand: "bg-ink/10 text-ink", driver: "bg-ink/10 text-ink" }[tone];
  const deltaTone = delta?.up === false ? (tone === "light" ? "text-danger" : "text-[#ffb3b4]") : tone === "light" ? "text-success" : tone === "dark" ? "text-brand-300" : "inherit";
  return (
    <div className={cn("flex flex-col rounded-card p-5", surface, className)}>
      <div className="flex items-start justify-between gap-3">
        <p className={cn("text-[13px] font-medium leading-snug", quiet)}>{label}</p>
        {icon && <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full [&_svg]:h-[18px] [&_svg]:w-[18px]", chip)}>{icon}</span>}
      </div>
      <p className="mt-4 text-[28px] font-semibold leading-none tracking-[-0.02em] tabular-nums">{value}</p>
      {(sub || delta) && (
        <p className={cn("mt-2 text-xs leading-snug", quiet)}>
          {delta && <span className={cn("mr-1.5 font-semibold tabular-nums", deltaTone)}>{delta.value}</span>}
          {sub}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Empty state & Skeleton                                               */
/* ------------------------------------------------------------------ */

export function EmptyState({ icon, title, description, action, className, compact }: { icon?: React.ReactNode; title: string; description?: string; action?: React.ReactNode; className?: string; compact?: boolean }) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center", compact ? "gap-3 py-8" : "gap-4 py-14", className)}>
      {icon && (
        <div className="relative flex h-16 w-16 items-center justify-center">
          <span className="absolute inset-0 rounded-full bg-brand-100" />
          <span className="absolute right-0 top-0 h-3.5 w-3.5 rounded-full bg-brand-400 ring-4 ring-white" />
          <span className="relative text-ink [&_svg]:h-6 [&_svg]:w-6">{icon}</span>
        </div>
      )}
      <div>
        <p className="text-[15px] font-semibold tracking-[-0.01em]">{title}</p>
        {description && <p className="mx-auto mt-1 max-w-[30ch] text-[13px] leading-relaxed text-muted text-pretty">{description}</p>}
      </div>
      {action && <div className="mt-1 w-full max-w-[260px]">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-xl", className)} aria-hidden />;
}

export function Divider({ className, label }: { className?: string; label?: string }) {
  if (label)
    return (
      <div className={cn("flex items-center gap-3 text-xs font-medium text-muted", className)} role="separator">
        <span className="h-px flex-1 bg-line" />
        {label}
        <span className="h-px flex-1 bg-line" />
      </div>
    );
  return <div className={cn("h-px w-full bg-line", className)} role="separator" />;
}

/* ------------------------------------------------------------------ */
/* List row (settings, menus)                                           */
/* ------------------------------------------------------------------ */

export function ListRow({ icon, title, description, href, onClick, right, danger, className, badge, iconTone = "muted" }: { icon?: React.ReactNode; title: React.ReactNode; description?: React.ReactNode; href?: string; onClick?: () => void; right?: React.ReactNode; danger?: boolean; className?: string; badge?: React.ReactNode; iconTone?: "muted" | "brand" | "ink" }) {
  const iconSurface = danger ? "bg-red-50 text-danger" : iconTone === "brand" ? "bg-brand-400 text-ink" : iconTone === "ink" ? "bg-ink text-white" : "bg-surface-2 text-ink";
  const inner = (
    <>
      {icon && <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl [&_svg]:h-[18px] [&_svg]:w-[18px]", iconSurface)}>{icon}</span>}
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate text-[15px] font-semibold leading-snug", danger && "text-danger")}>{title}</span>
        {description && <span className="block truncate text-[13px] leading-snug text-muted">{description}</span>}
      </span>
      {badge}
      {right ?? ((href || onClick) && <ChevronRight size={18} className="shrink-0 text-muted" />)}
    </>
  );
  const interactive = "transition-colors duration-150 hover:bg-surface-2 active:bg-surface-3";
  const cls = cn("flex w-full items-center gap-3.5 rounded-2xl px-3 py-3 text-left", className);
  if (href)
    return (
      <Link href={href} className={cn(cls, interactive)}>
        {inner}
      </Link>
    );
  if (onClick)
    return (
      <button type="button" onClick={onClick} className={cn(cls, interactive)}>
        {inner}
      </button>
    );
  return <div className={cls}>{inner}</div>;
}

/* ------------------------------------------------------------------ */
/* Segmented control: the selected segment is a sliding yellow pill     */
/* ------------------------------------------------------------------ */

export function Segmented<T extends string>({ value, onChange, options, className, size = "md", ariaLabel }: { value: T; onChange: (v: T) => void; options: { value: T; label: React.ReactNode }[]; className?: string; size?: "sm" | "md"; ariaLabel?: string }) {
  const id = React.useId();
  const reduce = useReducedMotion();
  return (
    <div className={cn("inline-flex w-full rounded-full bg-surface-2 p-1", className)} role="tablist" aria-label={ariaLabel}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              "relative flex-1 rounded-full font-semibold transition-colors duration-200",
              size === "sm" ? "h-8 px-3 text-xs" : "h-10 px-4 text-sm",
              active ? "text-ink" : "text-muted hover:text-ink",
            )}
          >
            {active && <motion.span layoutId={reduce ? undefined : `seg-${id}`} className="absolute inset-0 rounded-full bg-brand-400 shadow-[0_1px_2px_rgba(17,17,17,0.08)]" transition={springs.snappy} />}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Chips: filter / option pills, yellow when selected                   */
/* ------------------------------------------------------------------ */

export function Chip({ selected, onClick, icon, children, className, size = "md", disabled }: { selected?: boolean; onClick?: () => void; icon?: React.ReactNode; children: React.ReactNode; className?: string; size?: "sm" | "md"; disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full font-semibold transition-[background-color,color,box-shadow,transform] duration-200 ease-(--ease-spring) active:scale-[0.97] disabled:opacity-50 [&_svg]:h-4 [&_svg]:w-4",
        size === "sm" ? "h-9 px-3.5 text-xs" : "h-11 px-4 text-sm",
        // unselected keeps a hairline ring so it reads on white sheets as well as on the grey ground
        selected ? "bg-brand-400 text-ink shadow-[0_6px_14px_-8px_rgba(255,194,26,0.9)]" : "bg-white text-ink ring-1 ring-inset ring-[#dcdcd8] hover:bg-surface-2",
        className,
      )}
    >
      {icon}
      {children}
    </button>
  );
}

/** Horizontal, scroll-snapping row of chips (hides its scrollbar). */
export function ChipRow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("scroll-row -mx-5 gap-2 px-5 py-1", className)}>{children}</div>;
}

/* ------------------------------------------------------------------ */
/* Rating stars                                                         */
/* ------------------------------------------------------------------ */

export function RatingStars({ value, onChange, size = 28, readOnly, className }: { value: number; onChange?: (v: number) => void; size?: number; readOnly?: boolean; className?: string }) {
  const [hover, setHover] = React.useState(0);
  const shown = hover || value;
  return (
    <div className={cn("inline-flex items-center gap-1", className)} role={readOnly ? undefined : "radiogroup"}>
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          disabled={readOnly}
          role={readOnly ? undefined : "radio"}
          aria-checked={value === i}
          aria-label={`${i} star${i > 1 ? "s" : ""}`}
          onMouseEnter={() => !readOnly && setHover(i)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange?.(i)}
          className={cn("rounded-full transition-transform duration-200 ease-(--ease-spring)", !readOnly && "hover:scale-110 active:scale-95")}
        >
          <Star size={size} className={cn("transition-colors duration-150", i <= shown ? "fill-brand-400 text-brand-400" : "fill-surface-3 text-surface-3")} />
        </button>
      ))}
    </div>
  );
}

export function RatingInline({ value, count, className }: { value: number; count?: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-semibold tabular-nums", className)}>
      <Star size={12} className="fill-brand-400 text-brand-400" />
      {value.toFixed(1)}
      {count != null && <span className="font-normal text-muted">({count})</span>}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Top bar (pages outside a shell)                                      */
/* ------------------------------------------------------------------ */

export function TopBar({ title, subtitle, back, right, className, transparent, onBack }: { title?: React.ReactNode; subtitle?: React.ReactNode; back?: boolean | string; right?: React.ReactNode; className?: string; transparent?: boolean; onBack?: () => void }) {
  const router = useRouter();
  const inShell = useInShell();
  const setHeader = useShellHeader((s) => s.set);

  /* Inside a shell the page title belongs in the shell's own header. */
  React.useEffect(() => {
    if (!inShell) return;
    setHeader({
      title: typeof title === "string" ? title : undefined,
      description: typeof subtitle === "string" ? subtitle : undefined,
      backHref: typeof back === "string" ? back : undefined,
      actions: right,
    });
    return () => setHeader({});
  }, [inShell, title, subtitle, back, right, setHeader]);

  const goBack = () => {
    if (onBack) return onBack();
    if (typeof back === "string") return router.push(back);
    router.back();
  };

  if (inShell) return null;

  return (
    <header className={cn("z-20 flex h-16 shrink-0 items-center gap-3 px-4", transparent ? "absolute inset-x-0 top-0" : "bg-white", className)}>
      {back && (
        <button type="button" onClick={goBack} aria-label="Go back" className={cn("flex h-11 w-11 items-center justify-center rounded-full transition-colors", transparent ? "bg-white shadow-float hover:bg-surface-2" : "hover:bg-surface-2")}>
          <ArrowLeft size={20} strokeWidth={2.5} />
        </button>
      )}
      <div className="min-w-0 flex-1">
        {title && <h1 className="truncate text-lg font-semibold leading-tight tracking-[-0.01em]">{title}</h1>}
        {subtitle && <p className="truncate text-xs text-muted">{subtitle}</p>}
      </div>
      {right}
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* Route rail: pickup ring, dotted connector, yellow destination         */
/* ------------------------------------------------------------------ */

export function RouteRail({ className, stops = 0, dashed }: { className?: string; stops?: number; dashed?: boolean }) {
  const connector = cn("w-0 flex-1 border-l-2 border-ink/35", dashed ? "border-dashed" : "border-dotted");
  return (
    <div className={cn("flex flex-col items-center self-stretch py-[20px]", className)} aria-hidden>
      <span className="h-3 w-3 shrink-0 rounded-full border-[3px] border-ink bg-white" />
      <span className={connector} />
      {Array.from({ length: stops }).map((_, i) => (
        <React.Fragment key={i}>
          <span className="h-2 w-2 shrink-0 rounded-full bg-ink" />
          <span className={connector} />
        </React.Fragment>
      ))}
      <span className="h-3.5 w-3.5 shrink-0 rounded-[4px] border-[3px] border-ink bg-brand-400" />
    </div>
  );
}

/**
 * RouteStops: the Waygo pickup/destination card. Each row is a small label over
 * a value; rows are hairline-separated and the rail runs down the left.
 */
export interface RouteStop {
  label?: React.ReactNode;
  value?: React.ReactNode;
  placeholder?: string;
  onClick?: () => void;
  /** Trailing control (locate button, bookmark…). */
  right?: React.ReactNode;
}

export function RouteStops({ items, className, dashed }: { items: RouteStop[]; className?: string; dashed?: boolean }) {
  return (
    <div className={cn("flex items-stretch gap-3 rounded-card bg-white px-4 shadow-card ring-1 ring-line", className)}>
      <RouteRail stops={Math.max(0, items.length - 2)} dashed={dashed} className="w-3.5" />
      <div className="flex min-w-0 flex-1 flex-col divide-y divide-line">
        {items.map((it, i) => {
          const body = (
            <>
              <span className="min-w-0 flex-1">
                {it.label && <span className="block text-[11px] font-medium leading-none text-muted">{it.label}</span>}
                <span className={cn("mt-1 block truncate text-[15px] font-semibold leading-snug", !it.value && "font-medium text-muted")}>{it.value ?? it.placeholder ?? "—"}</span>
              </span>
              {it.right && <span className="shrink-0 text-ink">{it.right}</span>}
            </>
          );
          const cls = "flex min-h-14 w-full items-center gap-3 py-2.5 text-left";
          return it.onClick ? (
            <button key={i} type="button" onClick={it.onClick} className={cn(cls, "transition-colors hover:text-ink")}>
              {body}
            </button>
          ) : (
            <div key={i} className={cls}>
              {body}
            </div>
          );
        })}
      </div>
    </div>
  );
}
