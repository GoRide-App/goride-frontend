"use client";

/**
 * The rider's checkout for a completed trip, backed by the real goride-payment service.
 *
 *   preparing ──► ready ──► processing ──► paid          (card)
 *       │           └────► awaiting_cash ──► paid       (cash on a live ride; the driver confirms)
 *       └──► prepare_failed (nothing after ~30 s; Retry starts over)
 *
 * Preparing differs by ride: a SIMULATED ride (demo driver, the trip service never saw it)
 * reports its own completion via POST /payments/demo-completions; a LIVE ride's completion
 * is posted by the trip service a moment after the driver completes, so we poll the status
 * until it exists. Cash on a simulated ride stays in the mock world (ride-store selectPayment).
 *
 * Once paid, the outcome is mirrored into the mock-world trip through the ride store, so the
 * existing PAID states (PaidSheet, history, driver toasts) carry on as before.
 */
import { create } from "zustand";
import type { PaidOutcome, PaymentStatusView, SavedCard } from "@/types";
import { errorMessage } from "@/lib/api";
import { isPaymentError, paidOutcomeFromStatus, paymentService } from "@/lib/api/payments-live";
import { sortCards, withCard } from "@/lib/card-input";
import { useRideStore } from "./ride-store";

export type CheckoutStage = "preparing" | "prepare_failed" | "ready" | "processing" | "awaiting_cash" | "paid";

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
  payError: { title: string; code?: string } | null;
  /** CARD_DISABLED: card payments are off for this trip, so cash is the only way left. */
  cardDisabled: boolean;
  cashBusy: boolean;
  cashError: string | null;
  /** What was paid; the success state and the receipt read this. */
  result: PaidOutcome | null;

  begin: (input: { tripId: string; live: boolean; finalFare: number }) => void;
  /** Stops polling (sheet unmounted) without forgetting where the checkout got to. */
  pause: () => void;
  retryPrepare: () => void;
  loadCards: () => Promise<void>;
  selectCard: (cardId: string) => void;
  /** A card saved from the inline form: add it and pay with it. */
  addCard: (card: SavedCard) => void;
  payByCard: () => Promise<void>;
  /** Live rides only: tell the payment service the rider pays cash, then wait for the driver. */
  payByCash: () => Promise<void>;
}

// Bumped on every (re)start or pause so a stale loop notices and stops.
let generation = 0;
let timer: ReturnType<typeof setTimeout> | null = null;
let running = false;

function stopLoops() {
  generation += 1;
  if (timer) clearTimeout(timer);
  timer = null;
  running = false;
}

export const useCheckoutStore = create<CheckoutState>()((set, get) => {
  /** Mirrors the payment into the mock-world trip so the rest of the app sees it as PAID. */
  function finishPaid(outcome: PaidOutcome) {
    if (get().tripId !== outcome.tripId) return;
    stopLoops();
    set({ stage: "paid", result: outcome, payError: null, cashError: null });
    void useRideStore.getState().settlePayment(outcome);
  }

  /** Moves the checkout to wherever the payment service says this trip is. */
  function apply(st: PaymentStatusView) {
    if (get().tripId !== st.tripId) return;
    set({ status: st, prepareError: null });
    if (st.status === "Paid") return finishPaid(paidOutcomeFromStatus(st));
    if (st.status === "AwaitingCash") {
      set({ stage: "awaiting_cash" });
      return pollCash();
    }
    stopLoops();
    set({ stage: "ready" });
    if (!get().cards) void get().loadCards();
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
    set({ stage: "preparing", prepareError: null, inAppUnavailable: false });

    const fail = (message: string, inAppUnavailable = false) => {
      if (token !== generation) return;
      running = false;
      set({ stage: "prepare_failed", prepareError: message, inAppUnavailable });
    };

    const step = async () => {
      if (token !== generation) return;
      try {
        if (!reported) {
          await paymentService.completeDemoTrip(tripId, finalFare);
          reported = true;
        }
        const st = await paymentService.status(tripId);
        if (token !== generation) return;
        if (st) return apply(st);
      } catch (e) {
        if (token !== generation) return;
        if (!live && isPaymentError(e) && e.status === 404)
          return fail("In-app payment isn't switched on for demo rides on the payment service. You can still pay your driver in cash.", true);
        if (isPaymentError(e) && (e.status === 401 || e.status === 403)) return fail(e.title);
        lastError = errorMessage(e);
      }
      if (Date.now() - startedAt > PREPARE_TIMEOUT_MS) {
        return fail(lastError ?? (live ? "Your driver's trip hasn't reached payments yet. Give it a moment, then try again." : "Your payment isn't ready yet. Please try again."));
      }
      timer = setTimeout(step, POLL_MS);
    };
    void step();
  }

  /** Cash on a live ride: the driver confirms from their app, so watch for Paid. */
  function pollCash() {
    const tripId = get().tripId;
    if (!tripId) return;
    stopLoops();
    running = true;
    const token = generation;
    const step = async () => {
      if (token !== generation) return;
      try {
        const st = await paymentService.status(tripId);
        if (token !== generation) return;
        if (st?.status === "Paid") return finishPaid(paidOutcomeFromStatus(st));
        if (st) set({ status: st });
      } catch {
        // A missed poll just means ask again.
      }
      timer = setTimeout(step, POLL_MS);
    };
    timer = setTimeout(step, POLL_MS);
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
    cardDisabled: false,
    cashBusy: false,
    cashError: null,
    result: null,

    begin({ tripId, live, finalFare }) {
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
          cardDisabled: false,
          cashBusy: false,
          cashError: null,
          result: null,
        });
        return prepare();
      }
      // Same trip, sheet back on screen: pick up where it left off.
      if (running) return;
      if (st.stage === "preparing" || st.stage === "prepare_failed") prepare();
      else if (st.stage === "awaiting_cash") pollCash();
      else if (st.stage === "ready" && !st.cards) void get().loadCards();
    },

    pause() {
      stopLoops();
    },

    retryPrepare() {
      prepare();
    },

    async loadCards() {
      set({ cardsError: null });
      try {
        const cards = sortCards(await paymentService.cards.list());
        const current = get().selectedCardId;
        const keep = current && cards.some((c) => c.cardId === current) ? current : null;
        set({ cards, selectedCardId: keep ?? cards.find((c) => c.isDefault)?.cardId ?? cards[0]?.cardId ?? null });
      } catch (e) {
        set({ cardsError: errorMessage(e, "Couldn't load your saved cards.") });
      }
    },

    selectCard(cardId) {
      set({ selectedCardId: cardId, payError: null });
    },

    addCard(card) {
      set({ cards: withCard(get().cards ?? [], card), selectedCardId: card.cardId, payError: null });
    },

    async payByCard() {
      const { tripId, selectedCardId, stage } = get();
      if (!tripId || !selectedCardId || stage !== "ready") return;
      set({ stage: "processing", payError: null });
      try {
        const r = await paymentService.pay(tripId, selectedCardId);
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
        if (get().tripId !== tripId) return;
        const code = isPaymentError(e) ? e.code : undefined;
        set({ stage: "ready", payError: { title: errorMessage(e, "The payment didn't go through. Please try again."), code } });
        if (code === "CARD_NOT_FOUND") void get().loadCards();
        if (code === "CARD_DISABLED") set({ cardDisabled: true });
        // Paid or switched to cash elsewhere (another tab, a retry that did land): resync.
        if (code === "PAYMENT_SETTLED" || code === "PAYMENT_NOT_PENDING") {
          const st = await paymentService.status(tripId).catch(() => null);
          if (st) apply(st);
        }
      }
    },

    async payByCash() {
      const { tripId, stage } = get();
      if (!tripId || stage !== "ready" || get().cashBusy) return;
      set({ cashBusy: true, cashError: null, payError: null });
      try {
        apply(await paymentService.chooseCash(tripId));
      } catch (e) {
        if (get().tripId !== tripId) return;
        set({ cashError: errorMessage(e, "Couldn't switch this trip to cash. Please try again.") });
        if (isPaymentError(e, "PAYMENT_SETTLED", "PAYMENT_NOT_PENDING")) {
          const st = await paymentService.status(tripId).catch(() => null);
          if (st) apply(st);
        }
      } finally {
        set({ cashBusy: false });
      }
    },
  };
});
