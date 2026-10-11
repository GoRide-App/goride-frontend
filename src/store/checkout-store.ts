"use client";

/**
 * The rider's checkout for a completed trip: cards use goride-payment; cash finishes locally.
 *
 *   preparing ──► ready ──► processing ──► paid          (card)
 *       │           └────────────────────► paid         (cash on a live ride, settled with the driver)
 *       └──► prepare_failed (nothing after ~30 s; Retry starts over)
 *
 * Preparing differs by ride: a SIMULATED ride (demo driver, the trip service never saw it)
 * reports its own completion via POST /payments/demo-completions; a LIVE ride's completion
 * is posted by the trip service a moment after the driver completes, so we poll the status
 * until it exists. Cash skips preparation and payment-service calls. Cash on a simulated ride
 * stays in the mock world (ride-store selectPayment).
 *
 * Once paid, the outcome is mirrored into the mock-world trip through the ride store, so the
 * existing PAID states (PaidSheet, history, driver toasts) carry on as before.
 */
import { create } from "zustand";
import type { PaidOutcome, PaymentMethod, PaymentStatusView, SavedCard } from "@/types";
import { errorMessage } from "@/lib/api";
import { isPaymentError, paidOutcomeFromStatus, paymentService } from "@/lib/api/payments-live";
import { sortCards, withCard } from "@/lib/card-input";
import { useRideStore } from "./ride-store";

export type CheckoutStage = "preparing" | "prepare_failed" | "ready" | "processing" | "paid";

const POLL_MS = 1500;
const PREPARE_TIMEOUT_MS = 30_000;

interface CheckoutState {
  tripId: string | null;
  live: boolean;
  finalFare: number;
  stage: CheckoutStage;
  /** The payment service's view of this trip, once it exists. */
  status: PaymentStatusView | null;
  prepareError: string | null;
  /** Demo completions are switched off on the payment service (404): only mock cash works. */
  inAppUnavailable: boolean;
  cards: SavedCard[] | null;
  cardsError: string | null;
  selectedCardId: string | null;
  /** The last decline / validation error from POST /pay, shown next to the card list. */
  payError: { title: string; code?: string; retryable?: boolean; autoRetried?: boolean; attempts?: number } | null;
  autoRetrying: boolean;
  pendingPay: { requestId: string; cardId: string } | null;
  /** CARD_DISABLED: card payments are off for this trip, so cash is the only way left. */
  cardDisabled: boolean;
  /** What was paid; the success state and the receipt read this. */
  result: PaidOutcome | null;

  begin: (input: { tripId: string; live: boolean; finalFare: number; method?: PaymentMethod }) => void;
  /** Stops polling (sheet unmounted) without forgetting where the checkout got to. */
  pause: () => void;
  retryPrepare: () => void;
  loadCards: () => Promise<void>;
  selectCard: (cardId: string) => void;
  /** A card saved from the inline form: add it and pay with it. */
  addCard: (card: SavedCard) => void;
  payByCard: () => Promise<void>;
  /** Live rides only: finish locally with cash, without contacting the payment service. */
  payByCash: () => void;
}

// Bumped on every (re)start or pause so a stale loop notices and stops.
let generation = 0;
let timer: ReturnType<typeof setTimeout> | null = null;
let running = false;
let paymentMutation = 0;

// Preserve the request identity across a reload after a lost response. No card details.
function savedRequest(tripId: string): CheckoutState["pendingPay"] {
  try {
    const saved = JSON.parse(sessionStorage.getItem(`card-pay:${tripId}`) ?? "null");
    return typeof saved?.requestId === "string" && typeof saved?.cardId === "string" ? saved : null;
  } catch { return null; }
}

function rememberRequest(tripId: string, request: CheckoutState["pendingPay"]) {
  try {
    if (request) sessionStorage.setItem(`card-pay:${tripId}`, JSON.stringify(request));
    else sessionStorage.removeItem(`card-pay:${tripId}`);
  } catch { /* In-memory idempotency still works when storage is unavailable. */ }
}

function stopLoops() {
  generation += 1;
  if (timer) clearTimeout(timer);
  timer = null;
  running = false;
}

export const useCheckoutStore = create<CheckoutState>()((set, get) => {
  let inFlight: string | null = null;

  /** Mirrors the payment into the mock-world trip so the rest of the app sees it as PAID. */
  function finishPaid(outcome: PaidOutcome) {
    if (get().tripId !== outcome.tripId || get().stage === "paid") return;
    stopLoops();
    rememberRequest(outcome.tripId, null);
    set({ stage: "paid", result: outcome, payError: null, prepareError: null, pendingPay: null, autoRetrying: false });
    void useRideStore.getState().settlePayment(outcome);
  }

  /** Moves the checkout to wherever the payment service says this trip is. */
  function apply(st: PaymentStatusView) {
    if (get().tripId !== st.tripId || get().stage === "paid") return;
    set({ status: st, prepareError: null });
    // Choosing cash finishes the rider's checkout; driver confirmation is a separate story.
    if (st.status === "Paid" || st.status === "AwaitingCash") return finishPaid(paidOutcomeFromStatus(st));
    if (st.status === "Pending" && !get().cards) void get().loadCards();
    const own = get().pendingPay;
    // Only the current request can advance its retry indicator. An older status cannot
    // enable Pay, clear a failure, or hide a retry already observed for this request.
    if (inFlight && own?.requestId === inFlight) {
      if (st.requestId === inFlight && st.requestState === "Retrying") set({ autoRetrying: true });
      return;
    }
    if (st.requestState === "Processing" || st.requestState === "Retrying") {
      if (!own) {
        set({ stage: "processing", autoRetrying: st.requestState === "Retrying" });
        return;
      }
      // A lost response/reload can resume the durable request using the same ID.
      set({ stage: "ready", autoRetrying: false });
      return;
    }
    if (st.requestState === "Failed" && (!own || st.requestId === own.requestId)) {
      rememberRequest(st.tripId, null);
      set({ pendingPay: null, autoRetrying: false, payError: {
        title: st.retryable ? "Payment didn't go through. Retry or use another card." : "Your card was declined. Try another card.",
        code: st.lastFailureCode ?? undefined, retryable: st.retryable, autoRetried: st.autoRetried, attempts: st.requestAttempts,
      } });
    }
    set({ stage: "ready" });
  }

  /** Waits (bounded) for the payable record to exist, creating it first for a simulated ride. */
  function prepare() {
    const { tripId, live, finalFare } = get();
    if (!tripId) return;
    stopLoops();
    running = true;
    const token = generation;
    const startedAt = Date.now();
    let reported = live; // a live ride's completion comes from the trip service
    let lastError: string | null = null;
    if (!inFlight) set({ stage: "preparing", prepareError: null, inAppUnavailable: false });

    const fail = (message: string, inAppUnavailable = false) => {
      if (token !== generation) return;
      running = false;
      set({ stage: "prepare_failed", prepareError: message, inAppUnavailable });
    };

    const step = async () => {
      if (token !== generation) return;
      const mutation = paymentMutation;
      try {
        if (!reported) {
          await paymentService.completeDemoTrip(tripId, finalFare);
          reported = true;
        }
        const st = await paymentService.status(tripId);
        if (token !== generation) return;
        if (st) {
          // A poll started before Pay must not reset the processing state and enable Pay again.
          if (mutation === paymentMutation) apply(st);
          if (token !== generation) return;
          timer = setTimeout(step, POLL_MS);
          return;
        }
      } catch (e) {
        if (token !== generation) return;
        if (!live && isPaymentError(e) && e.status === 404)
          return fail("In-app payment isn't switched on for demo rides on the payment service. You can still pay your driver in cash.", true);
        if (isPaymentError(e) && (e.status === 401 || e.status === 403)) return fail(e.title);
        lastError = errorMessage(e);
      }
      if (get().stage === "preparing" && Date.now() - startedAt > PREPARE_TIMEOUT_MS) {
        return fail(lastError ?? (live ? "Your driver's trip hasn't reached payments yet. Give it a moment, then try again." : "Your payment isn't ready yet. Please try again."));
      }
      timer = setTimeout(step, POLL_MS);
    };
    void step();
  }

  return {
    tripId: null,
    live: false,
    finalFare: 0,
    stage: "preparing",
    status: null,
    prepareError: null,
    inAppUnavailable: false,
    cards: null,
    cardsError: null,
    selectedCardId: null,
    payError: null,
    autoRetrying: false,
    pendingPay: null,
    cardDisabled: false,
    result: null,

    begin({ tripId, live, finalFare, method = "Card" }) {
      const st = get();
      if (st.tripId !== tripId) {
        stopLoops();
        set({
          tripId,
          live,
          finalFare,
          stage: "preparing",
          status: null,
          prepareError: null,
          inAppUnavailable: false,
          cards: null,
          cardsError: null,
          selectedCardId: null,
          payError: null,
          autoRetrying: false,
          pendingPay: savedRequest(tripId),
          cardDisabled: false,
          result: null,
        });
      }
      if (get().stage === "paid") return;
      if (get().stage === "processing") {
        if (!running) prepare();
        return;
      }
      if (method === "Cash") {
        stopLoops();
        set({ stage: "ready", prepareError: null });
        return;
      }
      // Same trip, sheet back on screen: pick up where it left off.
      if (running) return;
      set({ cards: null, cardsError: null });
      prepare();
    },

    pause() {
      stopLoops();
    },

    retryPrepare() {
      prepare();
    },

    async loadCards() {
      const tripId = get().tripId;
      set({ cardsError: null });
      try {
        const cards = sortCards(await paymentService.cards.list());
        if (get().tripId !== tripId) return;
        const current = get().selectedCardId;
        const keep = current && cards.some((c) => c.cardId === current) ? current : null;
        set({ cards, selectedCardId: keep ?? cards.find((c) => c.isDefault)?.cardId ?? cards[0]?.cardId ?? null });
      } catch (e) {
        if (get().tripId !== tripId) return;
        set({ cardsError: errorMessage(e, "Couldn't load your saved cards.") });
      }
    },

    selectCard(cardId) {
      if (get().stage === "processing" || get().pendingPay) return;
      set({ selectedCardId: cardId, payError: null });
    },

    addCard(card) {
      if (get().stage === "processing" || get().pendingPay) return;
      set({ cards: withCard(get().cards ?? [], card), selectedCardId: card.cardId, payError: null });
    },

    async payByCard() {
      const { tripId, selectedCardId, stage } = get();
      if (!tripId || (!selectedCardId && !get().pendingPay) || stage !== "ready") return;
      const request = get().pendingPay ?? { requestId: crypto.randomUUID(), cardId: selectedCardId! };
      rememberRequest(tripId, request);
      inFlight = request.requestId;
      paymentMutation += 1;
      set({ stage: "processing", payError: null, autoRetrying: false, pendingPay: request });
      try {
        const r = await paymentService.pay(tripId, request.cardId, request.requestId);
        const c = r.confirmation;
        finishPaid({
          tripId,
          method: "Card",
          amount: c.amount,
          currency: c.currency,
          cardBrand: c.cardBrand,
          cardLast4: c.cardLast4,
          reference: c.providerReference,
          paidAt: c.paidAt,
        });
      } catch (e) {
        if (get().tripId !== tripId || get().stage === "paid") return;
        const code = isPaymentError(e) ? e.code : undefined;
        // The server may have committed even when the browser lost the response.
        // Keep Pay disabled until the authoritative status has been checked.
        const current = await paymentService.status(tripId).catch(() => null);
        if (get().tripId !== tripId || get().stage === "paid") return;
        if (current && (current.status === "Paid" || current.status === "AwaitingCash")) return apply(current);
        const terminal = isPaymentError(e) && (e.attempts !== undefined || [400, 403, 404].includes(e.status));
        if (terminal) rememberRequest(tripId, null);
        set({ stage: "ready", autoRetrying: false, pendingPay: terminal ? null : request, payError: {
          title: terminal ? errorMessage(e, "The payment didn't go through. Please try again.") : "We couldn't confirm the payment. Check payment to safely resume it.",
          code, retryable: isPaymentError(e) ? e.retryable : undefined,
          autoRetried: isPaymentError(e) ? e.autoRetried : undefined, attempts: isPaymentError(e) ? e.attempts : undefined,
        } });
        if (code === "CARD_NOT_FOUND") void get().loadCards();
        if (code === "CARD_DISABLED") set({ cardDisabled: true });
        // Paid or switched to cash elsewhere (another tab, a retry that did land): resync.
        if (code === "PAYMENT_SETTLED" || code === "PAYMENT_NOT_PENDING") {
          const st = await paymentService.status(tripId).catch(() => null);
          if (st) apply(st);
        }
      } finally {
        if (inFlight === request.requestId) inFlight = null;
        paymentMutation += 1;
      }
    },

    payByCash() {
      const { tripId, stage, status, finalFare } = get();
      if (!tripId || stage === "processing" || stage === "paid" || get().pendingPay) return;
      paymentMutation += 1;
      finishPaid({
        tripId,
        method: "Cash",
        amount: status?.amount ?? finalFare,
        currency: status?.currency ?? "LKR",
        cardBrand: null,
        cardLast4: null,
        reference: null,
        paidAt: new Date().toISOString(),
      });
    },
  };
});
