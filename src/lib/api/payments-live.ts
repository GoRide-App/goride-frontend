/**
 * Client for the real goride-payment service: the rider's saved demo cards, in-app card
 * checkout and the emailed receipt.
 *
 * Every path is relative (/payments/*) and goes through next.config.ts's rewrite, so the
 * calls are same-origin and the identity service's app_session cookie rides along — the
 * payment service works out the rider (or driver) from it. Errors come back as JSON
 * `{ status, title, code, ... }`: `title` is written for people, `code` is for branching.
 */
import type { DriverPaymentNotification } from "@/lib/driver-payment-notifications";
import { fromPaymentTripIds, toPaymentTripId } from "./payment-trip";
import type {
  NewCardPayload,
  PaidOutcome,
  PaymentConfirmationView,
  PaymentStatusView,
  PayResult,
  ReceiptView,
  SavedCard,
} from "@/types";

/** A failed payment-service call. `message` is the service's `title`, safe to show as is. */
export class PaymentApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    /** Set on 429s that only need a wait (e.g. RECEIPT_RESEND_TOO_SOON). */
    public readonly retryAfterSeconds?: number,
    public readonly retryable?: boolean,
    public readonly autoRetried?: boolean,
    public readonly attempts?: number,
  ) {
    super(message);
    this.name = "PaymentApiError";
  }

  get title() {
    return this.message;
  }
}

/** True when `e` is a payment-service error with one of `codes` (any code when none given). */
export function isPaymentError(e: unknown, ...codes: string[]): e is PaymentApiError {
  return e instanceof PaymentApiError && (codes.length === 0 || (!!e.code && codes.includes(e.code)));
}

function fallbackTitle(status: number) {
  if (status === 401) return "Your session has expired. Sign in again to continue.";
  if (status === 403) return "This payment belongs to another account.";
  if (status === 404) return "We couldn't find that payment.";
  if (status >= 500) return "The payment service isn't responding right now. Please try again.";
  return "Something went wrong with the payment. Please try again.";
}

function parse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function call<T>(path: string, init: { method?: "GET" | "POST" | "DELETE"; body?: unknown } = {}): Promise<T> {
  const hasBody = init.body !== undefined;
  let res: Response;
  try {
    res = await fetch(`/payments${path}`, {
      method: init.method ?? "GET",
      cache: "no-store",
      credentials: "same-origin",
      signal: AbortSignal.timeout(20_000),
      headers: { Accept: "application/json", ...(hasBody ? { "Content-Type": "application/json" } : {}) },
      body: hasBody ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new PaymentApiError("We couldn't reach the payment service. Check your connection and try again.", 0, "NETWORK_ERROR");
  }

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const data = text ? parse(text) : null;

  if (!res.ok) {
    const problem = (data && typeof data === "object" ? data : {}) as {
      title?: unknown; code?: unknown; retryAfterSeconds?: unknown;
      retryable?: unknown; autoRetried?: unknown; attempts?: unknown;
    };
    const header = Number(res.headers.get("Retry-After"));
    const retryAfter = typeof problem.retryAfterSeconds === "number" ? problem.retryAfterSeconds : Number.isFinite(header) && header > 0 ? header : undefined;
    throw new PaymentApiError(
      typeof problem.title === "string" && problem.title ? problem.title : fallbackTitle(res.status),
      res.status,
      typeof problem.code === "string" ? problem.code : undefined,
      retryAfter,
      typeof problem.retryable === "boolean" ? problem.retryable : undefined,
      typeof problem.autoRetried === "boolean" ? problem.autoRetried : undefined,
      typeof problem.attempts === "number" ? problem.attempts : undefined,
    );
  }
  return fromPaymentTripIds(data as T);
}

const trip = (tripId: string) => `/${encodeURIComponent(toPaymentTripId(tripId))}`;

/** A Paid status as the app shows it (the provider reference comes from the confirmation). */
export function paidOutcomeFromStatus(st: PaymentStatusView): PaidOutcome {
  return {
    tripId: st.tripId,
    method: st.method ?? "Card",
    amount: st.amount,
    currency: st.currency,
    cardBrand: st.cardBrand,
    cardLast4: st.cardLast4,
    reference: null,
    paidAt: st.paidAt,
  };
}

export const paymentService = {
  driverNotifications(since: string, after?: number): Promise<{ notifications: DriverPaymentNotification[]; nextCursor: number | null }> {
    const query = new URLSearchParams({ since });
    if (after !== undefined) query.set("after", String(after));
    return call(`/driver/notifications?${query}`);
  },

  cards: {
    async list(): Promise<SavedCard[]> {
      const res = await call<{ cards: SavedCard[] }>("/cards");
      return res?.cards ?? [];
    },
    /** One manually saved card per account. */
    add(card: NewCardPayload): Promise<SavedCard> {
      return call("/cards", { method: "POST", body: card });
    },
    remove(cardId: string): Promise<void> {
      return call(`/cards/${encodeURIComponent(cardId)}`, { method: "DELETE" });
    },
    makeDefault(cardId: string): Promise<SavedCard> {
      return call(`/cards/${encodeURIComponent(cardId)}/default`, { method: "POST", body: {} });
    },
  },

  /**
   * Creates the payable record for a SIMULATED ride (a demo driver the trip
   * service never saw). Idempotent per trip; 404 when the service has demo trips switched off.
   */
  async completeDemoTrip(tripId: string, finalFare: number): Promise<void> {
    await call<unknown>("/demo-completions", { method: "POST", body: { tripId: toPaymentTripId(tripId), finalFare: Math.round(finalFare * 100) / 100 } });
  },

  /** JSON null until the completed trip has reached the payment service. Rider and driver. */
  async status(tripId: string): Promise<PaymentStatusView | null> {
    return (await call<PaymentStatusView | null>(`${trip(tripId)}/status`)) ?? null;
  },

  /** Reuse requestId after an uncertain response; a manual retry after a decline needs a new ID. */
  pay(tripId: string, cardId: string, requestId: string): Promise<PayResult> {
    return call(`${trip(tripId)}/pay`, { method: "POST", body: { cardId, requestId } });
  },

  confirmation(tripId: string): Promise<PaymentConfirmationView> {
    return call(`${trip(tripId)}/confirmation`);
  },

  /** 409 RECEIPT_NOT_AVAILABLE until the trip is paid. */
  receipt(tripId: string): Promise<ReceiptView> {
    return call(`${trip(tripId)}/receipt`);
  },

  /** 429 RECEIPT_RESEND_TOO_SOON (with retryAfterSeconds) / RECEIPT_RESEND_LIMIT; 409 RECEIPT_EMAIL_MISSING / RECEIPT_IN_PROGRESS. */
  resendReceipt(tripId: string): Promise<ReceiptView> {
    return call(`${trip(tripId)}/receipt/resend`, { method: "POST", body: {} });
  },
};
