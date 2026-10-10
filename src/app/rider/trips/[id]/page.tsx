"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, Check, Clock3, Home, ReceiptText, RefreshCw, Wallet } from "lucide-react";
import type { Trip } from "@/types";
import { api } from "@/lib/api";
import { ROUTES } from "@/lib/constants";
import { formatDateTime, formatLKR } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { fadeOnly, itemVariants, listVariants } from "@/components/ui/motion";
import { Card, EmptyState, SectionTitle, Skeleton, TopBar } from "@/components/ui/primitives";
import { TripMeta, TripRoute } from "@/components/rider/ride-bits";
import { PaymentSummaryCard, formatPaidAmount, paidWithLabel, usePaidSummary } from "@/components/payments/payment-summary";
import { ReceiptStatus } from "@/components/payments/receipt-status";

/**
 * Trip receipt — reads the payment from goride-payment by trip id, so it works after the
 * ride sheet has been finished (and after a reload). The trip itself (route, driver) is
 * looked up best-effort for context; a receipt never depends on it.
 */
export default function RiderTripReceiptPage() {
  const { id } = useParams<{ id: string }>();
  const tripId = decodeURIComponent(id);
  const reduce = useReducedMotion();
  const item = reduce ? fadeOnly : itemVariants;
  const { state, retry } = usePaidSummary(tripId);
  const [trip, setTrip] = React.useState<Trip | null | undefined>(undefined);

  React.useEffect(() => {
    let alive = true;
    api.trips
      .get(tripId)
      .then((t) => alive && setTrip(t))
      .catch(() => alive && setTrip(null));
    return () => {
      alive = false;
    };
  }, [tripId]);

  const routeLine = trip ? `${trip.pickup.name} → ${trip.destination.name}` : null;
  // Cash on a simulated (demo-driver) ride is settled in this browser only, never on the payment service.
  const localCash = trip?.status === "PAID" && trip.payment?.method === "Cash" && state.kind !== "paid" && state.kind !== "loading" ? trip.payment : null;

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col gap-5 md:gap-6">
      <TopBar back={ROUTES.rider.home} title="Trip receipt" />

      {state.kind === "loading" ? (
        <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading your receipt">
          <Skeleton className="h-44 rounded-card" />
          <Skeleton className="h-56 rounded-card" />
        </div>
      ) : state.kind === "paid" ? (
        <motion.div variants={listVariants} initial="hidden" animate="show" className="flex flex-col gap-5 md:gap-6">
          <motion.section variants={item} aria-label="Payment" className="rounded-card bg-navy-900 p-5 text-white md:p-6">
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-400 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-ink">
                <Check size={12} strokeWidth={3} aria-hidden /> Paid
              </span>
              {state.summary.paidAt && <span className="text-xs tabular-nums text-white/60">{formatDateTime(state.summary.paidAt)}</span>}
            </div>
            <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/60">Amount paid</p>
            <p className="mt-2 text-[40px] font-semibold leading-none tracking-[-0.02em] tabular-nums">{formatPaidAmount(state.summary.amount)}</p>
            <p className="mt-2.5 text-[13px] leading-snug text-white/65 text-pretty">
              Paid by {paidWithLabel(state.summary)}
              {routeLine ? ` · ${routeLine}` : ""}
            </p>
          </motion.section>

          <motion.section variants={item} aria-labelledby="receipt-payment-title">
            <SectionTitle as="h2" className="mt-0">
              <span id="receipt-payment-title">Payment details</span>
            </SectionTitle>
            <PaymentSummaryCard summary={state.summary} className="bg-white shadow-card">
              {state.summary.method === "Card" && <ReceiptStatus tripId={tripId} detailed />}
            </PaymentSummaryCard>
          </motion.section>

          {trip && (
            <motion.section variants={item} aria-labelledby="receipt-trip-title">
              <SectionTitle as="h2" className="mt-0" action={<TripMeta distanceKm={trip.distanceKm} durationMin={trip.durationMin} />}>
                <span id="receipt-trip-title">Trip</span>
              </SectionTitle>
              <TripRoute trip={trip} />
              {trip.driver && (
                <p className="mt-3 px-1 text-[13px] text-muted">
                  Driven by <span className="font-semibold text-ink">{trip.driver.name}</span> · {[trip.driver.vehicleMake, trip.driver.vehicleModel].filter(Boolean).join(" ")} · <span className="tabular-nums">{trip.driver.vehiclePlate}</span>
                </p>
              )}
            </motion.section>
          )}

          <motion.div variants={item}>
            <Button href={ROUTES.rider.home} size="lg" arrow>
              Back to home
            </Button>
          </motion.div>
        </motion.div>
      ) : localCash ? (
        <Card className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-400 text-ink" aria-hidden>
              <Wallet size={20} />
            </span>
            <div className="min-w-0">
              <h2 className="text-[17px] font-semibold leading-tight tracking-[-0.01em]">Paid in cash</h2>
              <p className="mt-1 text-[13px] leading-snug text-muted text-pretty">
                {formatLKR(localCash.finalFare)} to your driver{localCash.processedAt ? ` on ${formatDateTime(localCash.processedAt)}` : ""}
                {localCash.receiptNo ? ` · Receipt ${localCash.receiptNo}` : ""}
              </p>
            </div>
          </div>
          <p className="rounded-2xl bg-surface-2 px-4 py-3 text-[13px] leading-snug text-ink-2 text-pretty">Cash on a demo ride is settled with the driver directly, so there&apos;s no emailed receipt for this trip.</p>
          {trip && <TripRoute trip={trip} compact />}
          <Button href={ROUTES.rider.home} size="lg" arrow>
            Back to home
          </Button>
        </Card>
      ) : (
        <Card>
          <EmptyState
            icon={state.kind === "error" ? <AlertTriangle /> : state.kind === "unpaid" ? <Clock3 /> : <ReceiptText />}
            title={state.kind === "error" ? "Couldn't load this receipt" : state.kind === "unpaid" ? "Not paid yet" : "Receipt not found"}
            description={
              state.kind === "unpaid"
                ? state.status.status === "AwaitingCash"
                  ? `You chose to pay ${formatPaidAmount(state.status.amount)} in cash. The receipt appears once your driver confirms it.`
                  : `${formatPaidAmount(state.status.amount)} is still to be paid for this trip. The receipt appears once it's paid.`
                : state.message
            }
            action={
              <div className="flex flex-col gap-2">
                {state.kind === "error" && (
                  <Button variant="dark" leftIcon={<RefreshCw size={16} />} onClick={retry}>
                    Try again
                  </Button>
                )}
                {state.kind === "unpaid" && (
                  <Button href={ROUTES.rider.ride} variant="dark">
                    Go to your ride
                  </Button>
                )}
                <Button href={ROUTES.rider.home} variant={state.kind === "missing" ? "dark" : "secondary"} leftIcon={<Home size={16} />}>
                  Back to home
                </Button>
              </div>
            }
          />
        </Card>
      )}
    </div>
  );
}
