"use client";

import * as React from "react";
import { AlertTriangle, Mail, MailCheck, MailX, RefreshCw } from "lucide-react";
import type { ReceiptView } from "@/types";
import { errorMessage } from "@/lib/api";
import { isPaymentError, paymentService } from "@/lib/api/payments-live";
import { cn, formatDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

const POLL_MS = 2000;
/** Right after paying the receipt row may not exist yet (409 RECEIPT_NOT_AVAILABLE); wait this many polls. */
const NOT_READY_POLLS = 8;
const IN_FLIGHT: ReceiptView["status"][] = ["Pending", "Sending", "Retry"];

/** Whole seconds until `target` (epoch ms), ticking once a second while there is time left. */
function useSecondsUntil(target: number | null) {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (target == null) return;
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [target]);
  return target == null ? 0 : Math.max(0, Math.ceil((target - now) / 1000));
}

/**
 * The emailed receipt for a paid trip (GET /payments/{tripId}/receipt). Polls while it is
 * being sent, and stops on Sent / Failed / NoEmail. `resend` asks for it again, honouring
 * the service's cooldown (429 RECEIPT_RESEND_TOO_SOON carries retryAfterSeconds).
 */
export function useReceipt(tripId: string) {
  const [receipt, setReceipt] = React.useState<ReceiptView | null>(null);
  const [error, setError] = React.useState<{ title: string; code?: string } | null>(null);
  const [resending, setResending] = React.useState(false);
  const [resendError, setResendError] = React.useState<{ title: string; code?: string; until: number | null } | null>(null);
  const [round, setRound] = React.useState(0);

  React.useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let notReady = 0;
    const poll = async () => {
      try {
        const r = await paymentService.receipt(tripId);
        if (!alive) return;
        setReceipt(r);
        setError(null);
        if (IN_FLIGHT.includes(r.status)) timer = setTimeout(poll, POLL_MS);
      } catch (e) {
        if (!alive) return;
        if (isPaymentError(e, "RECEIPT_NOT_AVAILABLE") && notReady++ < NOT_READY_POLLS) {
          timer = setTimeout(poll, POLL_MS);
          return;
        }
        setError({ title: errorMessage(e, "Couldn't check your receipt."), code: isPaymentError(e) ? e.code : undefined });
      }
    };
    timer = setTimeout(poll, 0);
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [tripId, round]);

  const resend = async () => {
    setResending(true);
    setResendError(null);
    try {
      setReceipt(await paymentService.resendReceipt(tripId));
      setRound((n) => n + 1); // watch the new send through
    } catch (e) {
      const wait = isPaymentError(e) ? e.retryAfterSeconds : undefined;
      setResendError({ title: errorMessage(e, "Couldn't resend the receipt."), code: isPaymentError(e) ? e.code : undefined, until: wait ? Date.now() + wait * 1000 : null });
    } finally {
      setResending(false);
    }
  };

  const reload = () => {
    setError(null);
    setRound((n) => n + 1);
  };

  return { receipt, error, resending, resendError, resend, reload };
}

/**
 * One line about the emailed receipt: sending, sent to the masked address, no email on the
 * account, or failed with Resend. `detailed` (the receipt page) also offers Resend once sent
 * and says how many resends are left.
 */
export function ReceiptStatus({ tripId, detailed, className }: { tripId: string; detailed?: boolean; className?: string }) {
  const { receipt, error, resending, resendError, resend, reload } = useReceipt(tripId);
  const cooldownUntil = resendError?.until ?? (receipt?.resendAvailableAt ? Date.parse(receipt.resendAvailableAt) : null);
  const secondsLeft = useSecondsUntil(cooldownUntil);

  const status = receipt?.status;
  const resendable =
    !!receipt &&
    (status === "Failed" || (detailed && status === "Sent")) &&
    receipt.resendsLeft > 0 &&
    resendError?.code !== "RECEIPT_RESEND_LIMIT" &&
    (receipt.canResend || cooldownUntil != null);

  let icon: React.ReactNode = <Spinner className="h-4 w-4" />;
  let tone = "bg-white text-ink";
  let title = "Checking your email receipt…";
  let detail: React.ReactNode = null;

  if (error) {
    const notYet = error.code === "RECEIPT_NOT_AVAILABLE";
    icon = notYet ? <Mail size={17} /> : <AlertTriangle size={17} />;
    title = notYet ? "Receipt on its way" : "Couldn't check your receipt";
    detail = notYet ? "We email it once the payment is confirmed." : error.title;
  } else if (status === "Pending" || status === "Sending") {
    title = "Emailing your receipt…";
    detail = receipt?.recipient ? `To ${receipt.recipient}` : null;
  } else if (status === "Retry") {
    title = "Retrying your receipt email…";
    detail = "The first try didn't go through, so we're sending it again.";
  } else if (status === "Sent") {
    icon = <MailCheck size={17} />;
    tone = "bg-emerald-50 text-emerald-700";
    title = receipt?.recipient ? `Receipt sent to ${receipt.recipient}` : "Receipt sent";
    detail = receipt?.sentAt ? `Sent ${formatDateTime(receipt.sentAt)}` : null;
  } else if (status === "Failed") {
    icon = <MailX size={17} />;
    tone = "bg-red-50 text-danger";
    title = "We couldn't email your receipt";
    detail = receipt?.recipient ? `Sending to ${receipt.recipient} failed. Try sending it again.` : "Try sending it again.";
  } else if (status === "NoEmail") {
    icon = <MailX size={17} />;
    tone = "bg-surface-3 text-muted";
    title = "No receipt emailed";
    detail = "There was no verified email on your account when you paid.";
  }

  const live = !error && (!receipt || (status && IN_FLIGHT.includes(status)));

  return (
    <div className={cn("flex items-start gap-3", className)}>
      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", tone)} aria-hidden>
        {icon}
      </span>
      <div className="min-w-0 flex-1 py-0.5" role="status" aria-live="polite" aria-busy={live || undefined}>
        <p className="text-[13px] font-semibold leading-snug text-pretty">{title}</p>
        {detail && <p className="mt-0.5 text-[12px] leading-snug text-muted text-pretty">{detail}</p>}
        {resendError && (
          <p className="mt-1 text-[12px] font-medium leading-snug text-danger text-pretty">
            {resendError.title}
            {resendError.code === "RECEIPT_RESEND_TOO_SOON" && secondsLeft > 0 ? ` (${secondsLeft}s)` : ""}
          </p>
        )}
        {detailed && receipt && (status === "Sent" || status === "Failed") && (
          <p className="mt-1 text-[12px] leading-snug text-muted tabular-nums">
            {receipt.resendsLeft > 0 ? `${receipt.resendsLeft} resend${receipt.resendsLeft === 1 ? "" : "s"} left` : "No resends left for this trip"}
          </p>
        )}
      </div>
      {resendable ? (
        <Button size="sm" variant="secondary" full={false} className="shrink-0 tabular-nums" loading={resending} loadingText="Sending…" disabled={secondsLeft > 0} onClick={resend}>
          {secondsLeft > 0 ? `Resend in ${secondsLeft}s` : "Resend"}
        </Button>
      ) : error && error.code !== "RECEIPT_NOT_AVAILABLE" ? (
        <Button size="sm" variant="secondary" full={false} className="shrink-0" leftIcon={<RefreshCw size={14} />} onClick={reload}>
          Retry
        </Button>
      ) : null}
    </div>
  );
}
