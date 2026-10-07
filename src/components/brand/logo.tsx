import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * GoRide wordmark: Poppins Bold with the "o" as a taxi-yellow map pin.
 * Rendered from static, path-based SVGs in /brand. `variant="green"` is kept
 * for compatibility and points at the retired green file.
 */
export function Logo({ variant = "dark", className, height = 28, priority }: { variant?: "dark" | "white" | "green"; className?: string; height?: number; priority?: boolean }) {
  const src = variant === "white" ? "/brand/logo-goride-white.svg" : variant === "green" ? "/brand/logo-goride-green.svg" : "/brand/logo-goride.svg";
  const width = Math.round(height * (3721 / 1069));
  return <Image src={src} alt="GoRide" width={width} height={height} priority={priority} className={cn("h-auto select-none", className)} style={{ height, width }} />;
}

/** The yellow pin on its own (transparent background). */
export function LogoMark({ className, size = 32 }: { className?: string; size?: number }) {
  return <Image src="/brand/icon-goride.svg" alt="" width={size} height={size} className={cn("select-none", className)} />;
}

/** The app tile: charcoal pin on a yellow rounded square. */
export function AppIcon({ className, size = 40 }: { className?: string; size?: number }) {
  return <Image src="/brand/app-icon.svg" alt="GoRide" width={size} height={size} className={cn("select-none rounded-[22%]", className)} />;
}
