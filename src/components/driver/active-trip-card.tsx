"use client";

import * as React from "react";
import { AlertTriangle, Check, Wallet } from "lucide-react";
import type { PaymentStatusView } from "@/types";
import { ON_TRIP_STATUSES, type LiveDriverOffer, type TripStatusAction } from "@/lib/api/live-matching";
import { cardLabel } from "@/lib/card-input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/primitives";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { money } from "./offer-card";

/** Statuses that mean "this driver has an accepted trip on their hands right now". */
export const ACTIVE_OFFER_STATUSES = [...ON_TRIP_STATUSES, "Completed"];

interface Stage {
  status: string;
  headline: string;
  lede: string;
  action: string;
  next: TripStatusAction | null;
}

const STAGES: Stage[] = [
  { status: "Accepted", headline: "Head to the pickup point", lede: "The rider is waiting. Follow the map to the pickup and tap below when you get there.", action: "I've arrived", next: "Arrived" },
  { status: "Arrived", headline: "Waiting at pickup", lede: "Let the rider know you're here. Start the trip once they're in.", action: "Start trip", next: "InProgress" },
  { status: "InProgress", headline: "Trip in progress", lede: "Follow the route to the drop-off and complete the trip when you arrive.", action: "Complete trip", next: "Completed" },
  { status: "Completed", headline: "Trip completed", lede: "Nice work. You stay on this trip until the rider has paid.", action: "Done", next: null },
];

export function stageFor(status: string) {
  const i = STAGES.findIndex((s) => s.status === status);
  const index = Math.max(0, i);
  return { index, stage: STAGES[index] };
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-14 items-center py-2.5">
      <span className="min-w-0">
        <span className="block text-[11px] font-medium leading-none text-muted">{label}</span>
        <span className="mt-1 block truncate text-[15px] font-semibold leading-snug">{value}</span>
      </span>
    </div>
  );
}

function RouteRows({ pickup, dropoff }: { pickup: string; dropoff: string }) {
  return (
    <div className="mt-4 flex items-stretch gap-3 border-t border-line">
      <div className="flex w-3.5 flex-col items-center self-stretch py-[20px]" aria-hidden>
        <span className="h-3 w-3 shrink-0 rounded-full border-[3px] border-ink bg-white" />
        <span className="w-0 flex-1 border-l-2 border-dotted border-ink/35" />
        <span className="h-3.5 w-3.5 shrink-0 rounded-[4px] border-[3px] border-ink bg-brand-400" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col divide-y divide-line">
        <Row label="Pickup" value={pickup} />
        <Row label="Drop-off" value={dropoff} />
      </div>
    </div>
  );
}

/**
 * Where the rider's payment is, once the trip is completed (goride-payment): waiting, cash
 * on its way (the driver confirms it in the footer), or paid — only then can the trip close.
 */
function PaymentState({ payment, fare, error }: { payment: PaymentStatusView | null; fare: number | null | undefined; error?: string | null }) {
  const amount = money(payment?.amount ?? fare) ?? "the fare";
  let chip = "bg-surface-2 text-ink";
  let icon: React.ReactNode = <Spinner className="h-4 w-4" />;
  let title = `Waiting for the rider to pay ${amount}`;
  let detail = "You can go offline or take another ride once it's paid.";
  if (payment?.status === "AwaitingCash") {
    chip = "bg-brand-400 text-ink";
    icon = <Wallet size={17} />;
    title = `Rider is paying cash — ${amount}`;
    detail = "Collect the cash, then tap Cash received.";
  } else if (payment?.status === "Paid") {
    chip = "bg-emerald-50 text-emerald-700";
    icon = <Check size={17} strokeWidth={3} />;
    title = payment.method === "Cash" ? `Paid in cash — ${amount}` : `Paid by ${payment.cardLast4 ? cardLabel(payment.cardBrand, payment.cardLast4) : "card"} — ${amount}`;
    detail = "All settled. Tap Done to finish this trip.";
  }
  return (
    <div className="mt-4 rounded-2xl bg-surface-2 p-3.5">
      <div className="flex items-start gap-3" role="status" aria-live="polite">
        <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", chip)} aria-hidden>
          {icon}
        </span>
        <div className="min-w-0 py-0.5">
          <p className="text-[14px] font-semibold leading-snug text-pretty tabular-nums">{title}</p>
          <p className="mt-0.5 text-[12px] leading-snug text-muted text-pretty">{detail}</p>
        </div>
      </div>
      {error && payment?.status !== "Paid" && (
        <p className="mt-2.5 flex items-start gap-1.5 text-[12px] font-medium leading-snug text-muted">
          <AlertTriangle size={13} className="mt-px shrink-0" aria-hidden /> {error} Checking again…
        </p>
      )}
    </div>
  );
}

/**
 * The trip this driver is on right now, backed by the real trip-matching
 * service: headline for the stage, a four-step progress bar, the route and
 * the fare, then the rider's payment once completed. The stage action itself
 * lives in the panel footer (ActiveTripAction).
 */
export function ActiveTripCard({ offer, error, payment, paymentError }: { offer: LiveDriverOffer; error?: string | null; payment?: PaymentStatusView | null; paymentError?: string | null }) {
  const { index, stage } = stageFor(offer.status);
  const done = offer.status === "Completed";
  const paid = payment?.status === "Paid";
  const fare = money(payment?.amount ?? offer.fare);
  return (
    <section aria-label="Current trip" className="rounded-card bg-white p-5 shadow-card ring-1 ring-line">
      <div className="flex items-center justify-between gap-3">
        <Badge tone={done ? (paid ? "success" : "warning") : "brand"} dot size="md">
          {done ? (paid ? "Paid" : "Awaiting payment") : "On a trip"}
        </Badge>
        {fare && <span className="text-[17px] font-semibold tabular-nums tracking-[-0.01em]">{fare}</span>}
      </div>
      <h2 className="mt-4 text-[24px] font-semibold leading-[1.1] tracking-[-0.02em] text-balance">{stage.headline}</h2>
      <p className="mt-1.5 text-[13px] leading-relaxed text-muted text-pretty">{stage.lede}</p>
      <ol className="mt-4 flex gap-1.5" aria-label={`Step ${index + 1} of ${STAGES.length}: ${stage.headline}`}>
        {STAGES.map((s, i) => (
          <li key={s.status} aria-current={i === index ? "step" : undefined} className={cn("h-1.5 flex-1 rounded-full transition-colors duration-300", i <= index ? "bg-brand-400" : "bg-surface-3")} />
        ))}
      </ol>
      <RouteRows pickup={offer.pickupLocation ?? "Pickup point"} dropoff={offer.dropoffLocation ?? "Destination"} />
      {done && <PaymentState payment={payment ?? null} fare={offer.fare} error={paymentError} />}
      {error && (
        <p role="alert" className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-[13px] font-medium text-red-700">
          {error}
        </p>
      )}
    </section>
  );
}

/**
 * The one action for the current stage; pinned in the panel footer. Once completed it is
 * "Cash received" while the rider pays cash, and "Done" only after the payment is in.
 */
export function ActiveTripAction({
  offer,
  busy,
  confirming,
  payment,
  confirmingCash,
  onAdvance,
  onConfirmCash,
  onDone,
}: {
  offer: LiveDriverOffer;
  busy: boolean;
  /** The accept is still being confirmed by the trip service. */
  confirming?: boolean;
  payment?: PaymentStatusView | null;
  confirmingCash?: boolean;
  onAdvance: (action: TripStatusAction) => void;
  onConfirmCash: () => void;
  onDone: () => void;
}) {
  const { stage } = stageFor(offer.status);
  const next = stage.next;
  if (!next) {
    if (payment?.status === "AwaitingCash")
      return (
        <Button size="lg" variant="primary" arrow arrowIcon={<Check strokeWidth={3} />} loading={confirmingCash} loadingText="Confirming cash…" onClick={onConfirmCash}>
          Cash received · {money(payment.amount)}
        </Button>
      );
    const paid = payment?.status === "Paid";
    return (
      <Button size="lg" variant="dark" loading={!paid} loadingText="Waiting for payment…" onClick={onDone}>
        Done
      </Button>
    );
  }
  return (
    <Button size="lg" variant="primary" arrow loading={busy || confirming} loadingText={confirming ? "Confirming ride…" : undefined} onClick={() => onAdvance(next)}>
      {stage.action}
    </Button>
  );
}
