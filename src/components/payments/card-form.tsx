"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronDown, FlaskConical, RefreshCw } from "lucide-react";
import type { SavedCard, TestCard, TestCardBehaviour } from "@/types";
import { isPaymentError, paymentService } from "@/lib/api/payments-live";
import { errorMessage } from "@/lib/api";
import {
  CARD_FIELD_FOR_CODE,
  type CardFieldErrors,
  detectBrand,
  digitsOnly,
  formatCardNumber,
  formatExpiryInput,
  parseExpiry,
  validateCard,
} from "@/lib/card-input";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input, Toggle } from "@/components/ui/field";
import { easeOut, fades } from "@/components/ui/motion";
import { Badge, type Tone } from "@/components/ui/primitives";
import { Spinner } from "@/components/ui/spinner";
import { InlineAlert } from "@/components/rider/ride-bits";
import { CardBrandMark } from "./card-bits";

/* ------------------------------------------------------------------ */
/* Demo test cards: the only numbers the payment service accepts        */
/* ------------------------------------------------------------------ */

const BEHAVIOUR: Record<TestCardBehaviour, { label: string; tone: Tone }> = {
  Succeeds: { label: "Succeeds", tone: "success" },
  Declined: { label: "Declined", tone: "danger" },
  InsufficientFunds: { label: "No funds", tone: "warning" },
  ExpiredCard: { label: "Expired", tone: "warning" },
  IncorrectCvc: { label: "Wrong CVC", tone: "warning" },
  ProcessingError: { label: "Error", tone: "warning" },
};

// The list never changes while the app is open, so fetch it once per page load.
let testCardsRequest: Promise<TestCard[]> | null = null;
function loadTestCards() {
  testCardsRequest ??= paymentService.cards.testCards().catch((e) => {
    testCardsRequest = null;
    throw e;
  });
  return testCardsRequest;
}

function TestCardsHelper({ onPick, disabled }: { onPick: (card: TestCard) => void; disabled?: boolean }) {
  const reduce = useReducedMotion();
  const listId = React.useId();
  const [open, setOpen] = React.useState(false);
  const [cards, setCards] = React.useState<TestCard[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const fetchCards = () => {
    setError(null);
    loadTestCards()
      .then(setCards)
      .catch((e) => setError(errorMessage(e, "Couldn't load the test cards.")));
  };

  const toggle = () => {
    if (!open && !cards) fetchCards();
    setOpen((o) => !o);
  };

  return (
    <div className="rounded-2xl bg-surface-2">
      <button type="button" onClick={toggle} aria-expanded={open} aria-controls={listId} disabled={disabled} className="flex min-h-12 w-full items-center gap-3 px-3.5 py-2.5 text-left disabled:opacity-50">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-ink" aria-hidden>
          <FlaskConical size={16} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-semibold leading-snug">Demo test cards</span>
          <span className="block text-[11px] leading-snug text-muted">Real cards aren&apos;t accepted. Tap one to fill the form.</span>
        </span>
        <ChevronDown size={18} className={cn("shrink-0 text-muted transition-transform duration-200 ease-(--ease-spring)", open && "rotate-180")} aria-hidden />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={listId}
            key="cards"
            initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, height: "auto" }}
            exit={reduce ? { opacity: 0, transition: fades.exit } : { opacity: 0, height: 0, transition: fades.exit }}
            transition={{ duration: 0.22, ease: easeOut }}
            className="overflow-hidden"
          >
            <div className="px-2 pb-2">
              {error ? (
                <div className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2.5">
                  <p className="text-[13px] leading-snug text-danger">{error}</p>
                  <Button size="sm" variant="secondary" full={false} leftIcon={<RefreshCw size={14} />} onClick={fetchCards}>
                    Retry
                  </Button>
                </div>
              ) : !cards ? (
                <p className="flex items-center gap-2 px-2 py-3 text-[13px] text-muted" role="status">
                  <Spinner className="h-4 w-4" /> Loading test cards…
                </p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {cards.map((c) => {
                    const meta = BEHAVIOUR[c.behaviour] ?? { label: c.behaviour, tone: "neutral" as Tone };
                    return (
                      <li key={c.number}>
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => {
                            onPick(c);
                            setOpen(false);
                          }}
                          className="flex w-full items-center gap-3 rounded-xl bg-white px-3 py-2.5 text-left transition-colors duration-150 hover:bg-brand-50 active:bg-brand-100 disabled:opacity-50"
                          aria-label={`Use test card ${formatCardNumber(c.number)}: ${c.description}`}
                        >
                          <CardBrandMark brand={c.brand} className="h-7 w-10" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-semibold leading-snug tabular-nums">{formatCardNumber(c.number)}</span>
                            <span className="block truncate text-[11px] leading-snug text-muted">{c.description}</span>
                          </span>
                          <Badge tone={meta.tone}>{meta.label}</Badge>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Add card form (profile and checkout)                                 */
/* ------------------------------------------------------------------ */

/**
 * Saves a demo card with the payment service. Formats as the rider types, checks the number
 * (Luhn), expiry and CVC before sending, and puts the service's own CARD_* errors on the
 * field they belong to. Used in the rider profile and inline in the payment sheet.
 */
export function AddCardForm({
  onSaved,
  onCancel,
  defaultMakeDefault = false,
  submitLabel = "Save card",
  title = "Add a card",
  disabled,
  className,
}: {
  onSaved: (card: SavedCard) => void;
  onCancel?: () => void;
  /** Pre-ticks "Make default" (e.g. for the rider's first card). */
  defaultMakeDefault?: boolean;
  submitLabel?: string;
  title?: string | null;
  disabled?: boolean;
  className?: string;
}) {
  const [number, setNumber] = React.useState("");
  const [expiry, setExpiry] = React.useState("");
  const [cvc, setCvc] = React.useState("");
  const [name, setName] = React.useState("");
  const [makeDefault, setMakeDefault] = React.useState(defaultMakeDefault);
  const [errors, setErrors] = React.useState<CardFieldErrors>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const brand = detectBrand(number);
  const locked = disabled || saving;

  const clear = (field: keyof CardFieldErrors) => {
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
    if (formError) setFormError(null);
  };

  const fillTestCard = (c: TestCard) => {
    setNumber(formatCardNumber(c.number));
    // Test cards take any future expiry and CVC; fill those too unless the rider already did.
    if (!expiry) setExpiry(`12/${String((new Date().getFullYear() + 3) % 100).padStart(2, "0")}`);
    if (!cvc) setCvc("123");
    setErrors({});
    setFormError(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (locked) return;
    const found = validateCard({ number, expiry, cvc, name });
    setErrors(found);
    setFormError(null);
    if (Object.values(found).some(Boolean)) return;

    const exp = parseExpiry(expiry)!;
    setSaving(true);
    try {
      const card = await paymentService.cards.add({
        number: digitsOnly(number),
        expMonth: exp.month,
        expYear: exp.year,
        cvc,
        ...(name.trim() ? { holderName: name.trim() } : {}),
        makeDefault,
      });
      setNumber("");
      setExpiry("");
      setCvc("");
      setName("");
      setSaving(false);
      onSaved(card);
    } catch (err) {
      setSaving(false);
      const field = isPaymentError(err) && err.code ? CARD_FIELD_FOR_CODE[err.code] : undefined;
      if (field) setErrors({ [field]: errorMessage(err) });
      else setFormError(errorMessage(err, "Couldn't save this card. Please try again."));
    }
  };

  return (
    <form onSubmit={submit} className={cn("flex flex-col gap-3", className)} noValidate aria-label={title ?? "Add a card"}>
      {title && <p className="text-[15px] font-semibold">{title}</p>}
      <TestCardsHelper onPick={fillTestCard} disabled={locked} />
      <Input
        label="Card number"
        placeholder="1234 5678 9012 3456"
        inputMode="numeric"
        autoComplete="cc-number"
        value={number}
        onChange={(e) => {
          setNumber(formatCardNumber(e.target.value));
          clear("number");
        }}
        maxLength={23}
        disabled={locked}
        error={errors.number}
        className={cn("tabular-nums tracking-[0.04em]", brand && "pr-16")}
        rightSlot={brand ? <CardBrandMark brand={brand} className="h-7 w-10" /> : undefined}
      />
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Expiry"
          placeholder="MM/YY"
          inputMode="numeric"
          autoComplete="cc-exp"
          value={expiry}
          onChange={(e) => {
            setExpiry(formatExpiryInput(e.target.value, expiry));
            clear("expiry");
          }}
          maxLength={5}
          disabled={locked}
          error={errors.expiry}
          className="tabular-nums"
        />
        <Input
          label="CVC"
          placeholder="123"
          inputMode="numeric"
          autoComplete="cc-csc"
          pattern="[0-9]*"
          value={cvc}
          onChange={(e) => {
            setCvc(digitsOnly(e.target.value).slice(0, 3));
            clear("cvc");
          }}
          maxLength={3}
          disabled={locked}
          error={errors.cvc}
          className="tabular-nums"
        />
      </div>
      <Input
        label="Name on card (optional)"
        placeholder="As printed on the card"
        autoComplete="cc-name"
        autoCapitalize="words"
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          clear("name");
        }}
        maxLength={26}
        disabled={locked}
        error={errors.name}
      />
      <div className="rounded-2xl bg-surface-2 px-4 py-3">
        <Toggle checked={makeDefault} onChange={setMakeDefault} disabled={locked} label={<span className="text-[13px]">Make this my default card</span>} />
      </div>
      {formError && <InlineAlert>{formError}</InlineAlert>}
      <div className="flex gap-2">
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
        )}
        <Button type="submit" variant="dark" loading={saving} loadingText="Saving card…" disabled={disabled}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
