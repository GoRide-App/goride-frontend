import { cn } from "@/lib/utils";

/**
 * The back-seat window. Everything outside the glass opening is the door
 * frame, painted by one huge box-shadow spread so it fits any viewport. The
 * opening is a rear-door window: three modest corners and one big sweep at
 * the top trailing edge where the pillar curves in. A vignette keeps the hero
 * copy legible over moving footage; the whole frame ride-bobs, and reduced
 * motion stills it via globals.css.
 */
const OPENING =
  "absolute inset-x-[2.5%] top-[8%] bottom-[8%] rounded-[clamp(20px,2.5vw,36px)] rounded-tr-[clamp(96px,16vw,240px)]";

export function CarWindow({ light }: { light: boolean }) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[1] overflow-hidden">
      <div className="absolute inset-0 motion-safe:animate-ride-bob">
        {/* door frame: the spread paints every pixel outside the opening */}
        <div className={cn(OPENING, "shadow-[0_0_0_200vmax_#0e0e0f]")} />
        {/* vignette so white copy survives bright patches of footage */}
        <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_45%,transparent_38%,rgba(0,0,0,0.5)_100%)]" />
        {/* light-scene haze: a soft centre lift so charcoal copy reads on bright footage */}
        <div
          className={cn(
            "absolute inset-0 bg-[radial-gradient(62%_58%_at_50%_50%,rgba(255,255,255,0.3),transparent_72%)] transition-opacity duration-700",
            light ? "opacity-100" : "opacity-0",
          )}
        />
      </div>
    </div>
  );
}
