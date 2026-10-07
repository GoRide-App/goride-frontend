"use client";

import * as React from "react";
import { create } from "zustand";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, Bell, Check, Info, X, XCircle } from "lucide-react";
import { cn, uid } from "@/lib/utils";
import { fades, springs } from "./motion";

export type ToastTone = "success" | "error" | "info" | "warning" | "notification";

export interface Toast {
  id: string;
  title: string;
  description?: string;
  tone: ToastTone;
  durationMs: number;
  action?: { label: string; onClick: () => void };
}

interface ToastStore {
  toasts: Toast[];
  push: (t: Omit<Toast, "id" | "durationMs" | "tone"> & { tone?: ToastTone; durationMs?: number }) => string;
  dismiss: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  push: (t) => {
    const id = uid("toast");
    const toast: Toast = { id, tone: "info", durationMs: 4200, ...t };
    set((s) => ({ toasts: [...s.toasts.slice(-3), toast] }));
    return id;
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = {
  success: (title: string, description?: string) => useToastStore.getState().push({ title, description, tone: "success" }),
  error: (title: string, description?: string) => useToastStore.getState().push({ title, description, tone: "error", durationMs: 5500 }),
  info: (title: string, description?: string) => useToastStore.getState().push({ title, description, tone: "info" }),
  warning: (title: string, description?: string) => useToastStore.getState().push({ title, description, tone: "warning" }),
  notify: (title: string, description?: string, action?: Toast["action"]) => useToastStore.getState().push({ title, description, tone: "notification", durationMs: 6000, action }),
  dismiss: (id: string) => useToastStore.getState().dismiss(id),
};

/** Icon chip: yellow for good news, red for errors, quiet for info. */
const chip: Record<ToastTone, { surface: string; icon: React.ReactNode }> = {
  success: { surface: "bg-brand-400 text-ink", icon: <Check size={16} strokeWidth={3} /> },
  notification: { surface: "bg-brand-400 text-ink", icon: <Bell size={15} strokeWidth={2.5} /> },
  info: { surface: "bg-white/12 text-white", icon: <Info size={16} strokeWidth={2.5} /> },
  warning: { surface: "bg-warning text-ink", icon: <AlertTriangle size={15} strokeWidth={2.5} /> },
  error: { surface: "bg-danger text-white", icon: <XCircle size={16} strokeWidth={2.5} /> },
};

function ToastItem({ t }: { t: Toast }) {
  const dismiss = useToastStore((s) => s.dismiss);
  const reduce = useReducedMotion();
  React.useEffect(() => {
    const id = setTimeout(() => dismiss(t.id), t.durationMs);
    return () => clearTimeout(id);
  }, [t, dismiss]);
  const c = chip[t.tone];
  return (
    <motion.div
      layout
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: -14, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.97, transition: fades.exit }}
      transition={reduce ? fades.fast : springs.snappy}
      className={cn("pointer-events-auto flex w-full items-center gap-3 bg-navy-900 py-2 pl-2 pr-2 text-white shadow-float", t.description || t.action ? "rounded-[22px]" : "rounded-full")}
      role={t.tone === "error" ? "alert" : "status"}
    >
      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center self-start rounded-full", c.surface)}>{c.icon}</span>
      <div className="min-w-0 flex-1 py-1">
        <p className="text-[13px] font-semibold leading-snug">{t.title}</p>
        {t.description && <p className="mt-0.5 text-xs leading-snug text-white/70 text-pretty">{t.description}</p>}
        {t.action && (
          <button
            type="button"
            onClick={() => {
              t.action?.onClick();
              dismiss(t.id);
            }}
            className="mt-1.5 text-xs font-semibold text-brand-300 hover:text-brand-200"
          >
            {t.action.label}
          </button>
        )}
      </div>
      <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss" className="flex h-8 w-8 shrink-0 items-center justify-center self-start rounded-full text-white/55 transition-colors hover:bg-white/10 hover:text-white">
        <X size={14} strokeWidth={2.5} />
      </button>
    </motion.div>
  );
}

/** Mount once per shell. `absolute` inside a region, `fixed` to the viewport. */
export function Toaster({ position = "absolute" }: { position?: "absolute" | "fixed" }) {
  const toasts = useToastStore((s) => s.toasts);
  return (
    // `fixed` sits below the shell header (top-16) and hugs the right edge on
    // wider screens; on phones it spans the width.
    <div className={cn("pointer-events-none z-[60] flex flex-col gap-2 p-3", position, position === "fixed" ? "inset-x-0 top-14 sm:inset-x-auto sm:right-2 sm:top-16 sm:w-full sm:max-w-sm" : "inset-x-0 top-0")}>
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <ToastItem key={t.id} t={t} />
        ))}
      </AnimatePresence>
    </div>
  );
}
