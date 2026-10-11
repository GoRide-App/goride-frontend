"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { BrandPanel } from "@/components/layout/brand-panel";
import { Toaster } from "@/components/ui/toast";

export interface AuthFrameProps {
  children: React.ReactNode;
  tone?: "auth" | "rider" | "driver";
  /**
   * `dark` (default): the Waygo sign-in card, charcoal with white text. Pair
   * form controls with `tone="dark"`. `light`: a white column for forms that
   * were written against the light palette.
   */
  surface?: "dark" | "light";
}

/**
 * AuthFrame: the split screen for sign-in style pages. The brand panel (taxi
 * yellow) takes the left on `lg`, the form card the right. Below `lg` the
 * brand panel drops away and the card fills the screen.
 */
export default function AuthFrame({ children, tone = "auth", surface = "dark" }: AuthFrameProps) {
  const dark = surface === "dark";
  return (
    <div className="flex h-dvh w-full items-stretch overflow-hidden bg-surface-2">
      <aside className="relative hidden min-w-0 flex-1 overflow-hidden lg:flex">
        <BrandPanel tone={tone} />
      </aside>
      <main className={cn("relative flex h-full w-full min-w-0 flex-col overflow-y-auto lg:w-[520px] lg:shrink-0 xl:w-[560px]", dark ? "bg-navy-900 text-white" : "bg-white text-ink")}>
        <Toaster />
        {/* min-h-full (not flex-1) so pages taller than the viewport scroll `main`
            instead of being clipped by an `h-full` root of their own. */}
        <div className="mx-auto flex min-h-full w-full max-w-[440px] flex-col px-5 py-6 sm:px-8 sm:py-10 safe-bottom">{children}</div>
      </main>
    </div>
  );
}
