"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, type ButtonVariant } from "./button";
import { fades, springs } from "./motion";
import { InSheetHost, SheetHandle } from "./sheet";
import { useIsPhone } from "./use-media";

/**
 * Dialog: a centred card on desktop; on phones it becomes a bottom sheet with
 * a handle. Dim + blur backdrop, spring entrance, Escape to close, focus moves
 * in on open and back out on close.
 */
export interface DialogProps {
  open: boolean;
  onClose?: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg";
  closeButton?: boolean;
  className?: string;
  /** `fixed` for full-viewport, `absolute` inside the nearest positioned region (default). */
  position?: "absolute" | "fixed";
  /** Optional leading visual (an icon tile) shown above the title. */
  icon?: React.ReactNode;
}

export function Dialog({ open, onClose, title, description, children, footer, size = "sm", closeButton, className, position = "absolute", icon }: DialogProps) {
  const phone = useIsPhone();
  const reduce = useReducedMotion();
  const panelRef = React.useRef<HTMLDivElement>(null);
  const titleId = React.useId();
  const descId = React.useId();

  React.useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => panelRef.current?.focus(), 30);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [open, onClose]);

  const panelMotion = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: fades.fast }
    : phone
      ? { initial: { y: "100%" }, animate: { y: 0 }, exit: { y: "100%", transition: springs.sheetExit }, transition: springs.sheet }
      : { initial: { scale: 0.94, opacity: 0, y: 12 }, animate: { scale: 1, opacity: 1, y: 0 }, exit: { scale: 0.97, opacity: 0, y: 6, transition: fades.exit }, transition: springs.sheet };

  return (
    <InSheetHost>
      <AnimatePresence>
        {open && (
          <motion.div
            className={cn("inset-0 z-50 flex justify-center", position, phone ? "items-end" : "items-center p-5")}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: fades.exit }}
            transition={fades.normal}
          >
            <button type="button" aria-label="Close" tabIndex={-1} className="absolute inset-0 bg-ink/55 backdrop-blur-[3px]" onClick={onClose} />
            <motion.div
              ref={panelRef}
              role="dialog"
              aria-modal
              aria-labelledby={title ? titleId : undefined}
              aria-describedby={description ? descId : undefined}
              tabIndex={-1}
              className={cn(
                "relative w-full bg-white text-ink shadow-float outline-none",
                phone ? "rounded-t-sheet px-5 pb-5 pt-2 safe-bottom" : "rounded-sheet p-6",
                !phone && size === "sm" && "max-w-sm",
                !phone && size === "md" && "max-w-md",
                !phone && size === "lg" && "max-w-2xl",
                className,
              )}
              {...panelMotion}
            >
              {phone && (
                <div className="mb-3 flex justify-center">
                  <SheetHandle />
                </div>
              )}
              {closeButton && (
                <button type="button" onClick={onClose} aria-label="Close" className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-ink">
                  <X size={18} />
                </button>
              )}
              {icon && <div className="mb-4 flex">{icon}</div>}
              {title && (
                <h2 id={titleId} className="pr-8 text-xl font-semibold leading-tight tracking-[-0.015em] text-balance">
                  {title}
                </h2>
              )}
              {description && (
                <p id={descId} className="mt-2 text-sm leading-relaxed text-muted text-pretty">
                  {description}
                </p>
              )}
              {children && <div className="mt-5">{children}</div>}
              {footer && <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:[&>*]:flex-1">{footer}</div>}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </InSheetHost>
  );
}

/** Round icon tile for dialog headers. */
export function DialogIcon({ tone = "brand", children, className }: { tone?: "brand" | "danger" | "info" | "ink"; children: React.ReactNode; className?: string }) {
  const tones = { brand: "bg-brand-100 text-brand-800", danger: "bg-red-50 text-danger", info: "bg-blue-50 text-blue-700", ink: "bg-ink text-white" }[tone];
  return <span className={cn("flex h-12 w-12 items-center justify-center rounded-full [&_svg]:h-6 [&_svg]:w-6", tones, className)}>{children}</span>;
}

/* ------------------------------------------------------------------ */
/* Alert: imperative one-button dialog                                  */
/* ------------------------------------------------------------------ */

export type AlertType = "success" | "failure" | "info" | "warning";

export interface AlertState {
  open: boolean;
  heading: string;
  text: string;
  type: AlertType;
  okLabel?: string;
  onOk?: () => void;
}

export function useAlert() {
  const [alert, setAlert] = React.useState<AlertState>({ open: false, heading: "", text: "", type: "info" });
  const showAlert = React.useCallback((heading: string, text: string, type: AlertType = "info", opts?: { okLabel?: string; onOk?: () => void }) => {
    setAlert({ open: true, heading, text, type, ...opts });
  }, []);
  const hideAlert = React.useCallback(() => setAlert((a) => ({ ...a, open: false })), []);
  return { alert, showAlert, hideAlert };
}

const alertVariant: Record<AlertType, ButtonVariant> = { success: "primary", failure: "danger", info: "dark", warning: "driver" };
const alertIcon: Record<AlertType, React.ReactNode> = {
  success: (
    <DialogIcon tone="brand">
      <CheckCircle2 />
    </DialogIcon>
  ),
  failure: (
    <DialogIcon tone="danger">
      <XCircle />
    </DialogIcon>
  ),
  info: (
    <DialogIcon tone="info">
      <Info />
    </DialogIcon>
  ),
  warning: (
    <DialogIcon tone="brand">
      <AlertTriangle />
    </DialogIcon>
  ),
};

export function AlertDialog({ alert, onClose, position }: { alert: AlertState; onClose: () => void; position?: "absolute" | "fixed" }) {
  return (
    <Dialog
      open={alert.open}
      onClose={onClose}
      icon={alertIcon[alert.type]}
      title={alert.heading}
      description={alert.text}
      position={position}
      footer={
        <Button
          size="lg"
          variant={alertVariant[alert.type]}
          onClick={() => {
            onClose();
            alert.onOk?.();
          }}
        >
          {alert.okLabel ?? "Okay"}
        </Button>
      }
    />
  );
}

/* ------------------------------------------------------------------ */
/* Confirm                                                              */
/* ------------------------------------------------------------------ */

export function ConfirmDialog({ open, onClose, onConfirm, title, description, confirmLabel = "Confirm", cancelLabel = "Go back", destructive, loading, children, position, icon }: { open: boolean; onClose: () => void; onConfirm: () => void; title: React.ReactNode; description?: React.ReactNode; confirmLabel?: string; cancelLabel?: string; destructive?: boolean; loading?: boolean; children?: React.ReactNode; position?: "absolute" | "fixed"; icon?: React.ReactNode }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      position={position}
      icon={icon}
      footer={
        <>
          <Button size="lg" variant="secondary" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button size="lg" variant={destructive ? "danger" : "primary"} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Dialog>
  );
}
