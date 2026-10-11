"use client";

import * as React from "react";
import type { SavedCard } from "@/types";
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
import { Input } from "@/components/ui/field";
import { InlineAlert } from "@/components/rider/ride-bits";
import { CardBrandMark } from "./card-bits";

/**
 * Saves a demo card with the payment service. Formats as the rider types, checks the number
 * (Luhn), expiry and CVC before sending, and puts the service's own CARD_* errors on the
 * field they belong to. Used in the rider profile and inline in the payment sheet.
 */
export function AddCardForm({
  onSaved,
  onCancel,
  submitLabel = "Save card",
  title = "Add a card",
  disabled,
  className,
}: {
  onSaved: (card: SavedCard) => void;
  onCancel?: () => void;
  submitLabel?: string;
  title?: string | null;
  disabled?: boolean;
  className?: string;
}) {
  const [number, setNumber] = React.useState("");
  const [expiry, setExpiry] = React.useState("");
  const [cvc, setCvc] = React.useState("");
  const [name, setName] = React.useState("");
  const [errors, setErrors] = React.useState<CardFieldErrors>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const brand = detectBrand(number);
  const locked = disabled || saving;

  const clear = (field: keyof CardFieldErrors) => {
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
    if (formError) setFormError(null);
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
        makeDefault: true,
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
      <p className="text-[13px] leading-snug text-muted">Save one test card to your account. Test payments do not move real money.</p>
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
          type="password"
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
