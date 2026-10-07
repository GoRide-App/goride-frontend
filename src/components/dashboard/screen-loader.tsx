"use client";

import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/primitives";
import { FullScreenLoader } from "@/components/ui/spinner";

/**
 * Whole-screen wait, used before the shell knows who is signed in. `inline`
 * sizes it for a scrolling content area instead of the full viewport.
 */
export function ScreenLoader({ label = "Loading…", inline, className }: { label?: string; inline?: boolean; className?: string }) {
  return (
    <div className={cn("flex w-full items-center justify-center bg-surface-2", inline ? "min-h-[60dvh]" : "min-h-dvh", className)}>
      <FullScreenLoader label={label} />
    </div>
  );
}

/** Whole-screen failure with a way back. */
export function ScreenError({ title = "Something went wrong", message, action, inline, className }: { title?: string; message: string; action?: React.ReactNode; inline?: boolean; className?: string }) {
  return (
    <div className={cn("flex w-full items-center justify-center bg-surface-2 px-5", inline ? "min-h-[60dvh]" : "min-h-dvh", className)}>
      <div className="w-full max-w-sm rounded-card bg-white p-6 shadow-card">
        <EmptyState icon={<AlertTriangle />} title={title} description={message} action={action} compact />
      </div>
    </div>
  );
}
