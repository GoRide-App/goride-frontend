"use client";

import * as React from "react";
import { Wallet } from "lucide-react";
import type { PaidOutcome, PaymentStatusView } from "@/types";
import { errorMessage } from "@/lib/api";
import { isPaymentError, paidOutcomeFromStatus, paymentService } from "@/lib/api/payments-live";
import { cardLabel } from "@/lib/card-input";
import { cn, formatDateTime, formatLKR } from "@/lib/utils";
import { CardBrandMark } from "./card-bits";

export type PaidSummaryState =
  | { kind: "loading" }
  | { kind: "paid"; summary: PaidOutcome }
  /** The payment exists but isn't settled yet (Pending, or cash the driver hasn't confirmed). */
  | { kind: "unpaid"; status: PaymentStatusView }
  /** No payment for this trip on the service, or it belongs to someone else. */
  | { kind: "missing"; message: string }
  | { kind: "error"; message: string };

/** Status first (it covers cash too); card payments then add the provider reference from the confirmation. */
async function loadSummary(tripId: string): Promise<PaidSummaryState> {
  try {
    const st = await paymentService.status(tripId);
    if (!st) return { kind: "missing", message: "There's no payment for this trip yet." };
    if (st.status !== "Paid") return { kind: "unpaid", status: st };
    const base = paidOutcomeFromStatus(st);
    if (st.method !== "Card") return { kind: "paid", summary: base };
    const c = (await paymentService.confirmation(tripId).catch(() => null))?.confirmation;
    if (!c) return { kind: "paid", summary: base };
    return {
      kind: "paid",
      summary: { ...base, reference: c.providerReference, paidAt: c.paidAt ?? base.paidAt, cardBrand: c.cardBrand ?? base.cardBrand, cardLast4: c.cardLast4 ?? base.cardLast4 },
    };
  } catch (e) {
    if (isPaymentError(e) && (e.status === 403 || e.status === 404)) return { kind: "missing", message: e.title };
    return { kind: "error", message: errorMessage(e, "Couldn't load this payment.") };
  }
}

/**
 * What was paid for a trip, from goride-payment. `known` (the checkout's own result) skips the
 * fetch when it already has everything to show.
 */
export function usePaidSummary(tripId: string, known?: PaidOutcome | null) {
  const complete = !!known && known.tripId === tripId && (known.method === "Cash" || !!known.reference);
  const [state, setState] = React.useState<PaidSummaryState>({ kind: "loading" });
  const [attempt, setAttempt] = React.useState(0);

  React.useEffect(() => {
    if (complete) return;
    let alive = true;
    loadSummary(tripId).then((s) => {
      if (alive) setState(s);
    });
    return () => {
      alive = false;
    };
  }, [tripId, complete, attempt]);

  const retry = React.useCallback(() => {
    setState({ kind: "loading" });
    setAttempt((n) => n + 1);
  }, []);

  return { state: complete ? ({ kind: "paid", summary: known! } as PaidSummaryState) : state, retry };
}

export function formatPaidAmount(amount: number) {
  return formatLKR(amount, { cents: Math.round(amount * 100) % 100 !== 0 });
}

/** "Visa •••• 4242" or "Cash". */
export function paidWithLabel(s: Pick<PaidOutcome, "method" | "cardBrand" | "cardLast4">) {
  return s.method === "Cash" ? "Cash" : cardLabel(s.cardBrand, s.cardLast4);
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-4 py-2.5">
      <dt className="shrink-0 text-[13px] text-muted">{label}</dt>
      <dd className="min-w-0 text-right text-[13px] font-semibold leading-snug">{children}</dd>
    </div>
  );
}

/**
 * The paid-trip ledger: amount, how it was paid, the provider reference and when. `children`
 * renders under a hairline, e.g. the receipt email line.
 */
export function PaymentSummaryCard({ summary, className, children }: { summary: PaidOutcome; className?: string; children?: React.ReactNode }) {
  const demo = summary.reference?.toLowerCase().startsWith("demo");
  return (
    <div className={cn("rounded-card bg-surface-2 ring-1 ring-line", className)}>
      <dl className="divide-y divide-line px-4">
        <Row label="Amount paid">
          <span className="text-[17px] tracking-[-0.01em] tabular-nums">{formatPaidAmount(summary.amount)}</span>
        </Row>
        <Row label="Paid with">
          {summary.method === "Cash" ? (
            <span className="inline-flex items-center gap-2">
              <Wallet size={16} aria-hidden /> Cash to your driver
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 tabular-nums">
              <CardBrandMark brand={summary.cardBrand} className="h-6 w-9 rounded-md" />
              {paidWithLabel(summary)}
            </span>
          )}
        </Row>
        {summary.reference && (
          <Row label={demo ? "Demo reference" : "PayHere reference"}>
            <span className="break-all font-medium tabular-nums">{summary.reference}</span>
          </Row>
        )}
        {summary.paidAt && (
          <Row label="Paid">
            <span className="font-medium tabular-nums">{formatDateTime(summary.paidAt)}</span>
          </Row>
        )}
      </dl>
      {children && <div className="border-t border-line px-4 py-3.5">{children}</div>}
    </div>
  );
}
