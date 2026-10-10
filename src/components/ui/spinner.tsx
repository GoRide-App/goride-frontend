import { cn } from "@/lib/utils";

/** Ring spinner as an inline SVG so it inherits currentColor. */
export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn("h-5 w-5 animate-spin text-current", className)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9.5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray="42 150" strokeDashoffset="-16" />
    </svg>
  );
}

/**
 * The GoRide pin (the "o" of the wordmark) as an inline SVG. `fill` defaults to
 * taxi yellow; pass `className="text-ink"` with `fill="currentColor"` to recolour.
 */
export function PinMark({ size = 40, className, fill = "#FFC21A" }: { size?: number; className?: string; fill?: string }) {
  return (
    <svg width={size} height={size} viewBox="-171 -671 980 980" className={className} aria-hidden="true">
      <g transform="scale(1,-1)">
        <path
          d="M318.5,-279.3 L581.8,191.9 A301.6,301.6 0 1,1 55.2,191.9 Z M439.1,339.0 A120.6,120.6 0 1,0 197.9,339.0 A120.6,120.6 0 1,0 439.1,339.0 Z"
          fill={fill}
          fillRule="evenodd"
        />
      </g>
    </svg>
  );
}

/**
 * Branded full-screen loader: the yellow pin bobs over a soft pulsing halo.
 * Calm by design; respects prefers-reduced-motion via the global rule.
 */
export function FullScreenLoader({ label = "Loading…", className }: { label?: string; className?: string }) {
  return (
    <div className={cn("flex h-full min-h-[50dvh] w-full flex-col items-center justify-center gap-5", className)} role="status" aria-live="polite">
      <div className="relative flex h-20 w-20 items-center justify-center">
        <span className="absolute inset-0 rounded-full bg-brand-400/40 animate-pin-pulse" />
        <span className="absolute inset-3 rounded-full bg-brand-400/30 [animation-delay:0.6s] animate-pin-pulse" />
        <span className="relative animate-pin-bob">
          <PinMark size={40} />
          <span className="absolute left-1/2 top-[52%] h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-ink" />
        </span>
      </div>
      <p className="text-sm font-medium text-muted">{label}</p>
    </div>
  );
}
