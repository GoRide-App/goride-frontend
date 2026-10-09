/**
 * Card entry helpers: formatting as the rider types, the same checks the payment service
 * makes (Luhn, a future expiry, a 3-digit CVC), and display formatting for saved cards.
 * Pre-validating here only saves a round trip; the service still has the final say.
 */
import type { CardBrand } from "@/types";

export function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

/** "4242424242424242" → "4242 4242 4242 4242" (19 digits max). */
export function formatCardNumber(value: string) {
  return digitsOnly(value)
    .slice(0, 19)
    .replace(/(\d{4})(?=\d)/g, "$1 ");
}

export function detectBrand(number: string): CardBrand | null {
  const d = digitsOnly(number);
  if (/^4/.test(d)) return "Visa";
  const two = Number(d.slice(0, 2));
  const four = Number(d.slice(0, 4));
  if ((two >= 51 && two <= 55) || (four >= 2221 && four <= 2720)) return "Mastercard";
  return null;
}

export function luhnValid(number: string) {
  const d = digitsOnly(number);
  if (d.length < 12) return false;
  let sum = 0;
  for (let i = 0; i < d.length; i++) {
    let n = Number(d[d.length - 1 - i]);
    if (i % 2 === 1) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  }
  return sum % 10 === 0;
}

/**
 * Masks the expiry as "MM/YY" while typing. A leading 2–9 becomes "0x"; the slash is added
 * once the month is complete, and dropped again when the rider backspaces over it.
 */
export function formatExpiryInput(next: string, previous: string) {
  let d = digitsOnly(next).slice(0, 4);
  if (d.length === 1 && Number(d) > 1) d = `0${d}`;
  if (d.length < 2) return d;
  const deleting = next.length < previous.length;
  if (d.length === 2) return deleting ? d : `${d}/`;
  return `${d.slice(0, 2)}/${d.slice(2)}`;
}

/** "07/29" → { month: 7, year: 2029 }, or null when it isn't a whole MM/YY. */
export function parseExpiry(value: string): { month: number; year: number } | null {
  const m = /^(\d{2})\/(\d{2})$/.exec(value.trim());
  if (!m) return null;
  return { month: Number(m[1]), year: 2000 + Number(m[2]) };
}

export function isExpired(month: number, year: number, now = new Date()) {
  return year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1);
}

export type CardField = "number" | "expiry" | "cvc" | "name";
export type CardFieldErrors = Partial<Record<CardField, string>>;

export interface CardFormValues {
  number: string;
  expiry: string;
  cvc: string;
  name: string;
}

export function validateCard(v: CardFormValues, now = new Date()): CardFieldErrors {
  const errors: CardFieldErrors = {};
  const digits = digitsOnly(v.number);
  if (!digits) errors.number = "Enter the card number";
  else if (digits.length < 13 || digits.length > 19 || !luhnValid(digits)) errors.number = "That card number doesn't look right";

  const exp = parseExpiry(v.expiry);
  if (!v.expiry.trim()) errors.expiry = "Enter the expiry date";
  else if (!exp || exp.month < 1 || exp.month > 12) errors.expiry = "Use MM/YY";
  else if (isExpired(exp.month, exp.year, now)) errors.expiry = "This card has expired";

  if (!/^\d{3}$/.test(v.cvc)) errors.cvc = "Enter the 3 digits";

  const name = v.name.trim();
  if (name && (name.length < 2 || !/^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ .'-]*$/.test(name))) errors.name = "Use letters only, as printed on the card";
  return errors;
}

/** Server error codes that belong to one field rather than the whole form. */
export const CARD_FIELD_FOR_CODE: Record<string, CardField> = {
  CARD_NUMBER_INVALID: "number",
  CARD_NOT_TEST_CARD: "number",
  CARD_ALREADY_SAVED: "number",
  CARD_EXPIRY_INVALID: "expiry",
  CARD_EXPIRED: "expiry",
  CARD_CVC_INVALID: "cvc",
  CARD_NAME_INVALID: "name",
};

/** "VISA" / "visa" / "Visa" → "Visa"; anything unknown passes through. */
export function brandLabel(brand: string | null | undefined) {
  if (!brand) return "Card";
  const b = brand.toLowerCase();
  if (b === "visa") return "Visa";
  if (b === "mastercard") return "Mastercard";
  return brand;
}

export function formatCardExpiry(month: number, year: number) {
  return `${String(month).padStart(2, "0")}/${String(year % 100).padStart(2, "0")}`;
}

/** "Visa •••• 4242" */
export function cardLabel(brand: string | null | undefined, last4: string | null | undefined) {
  return last4 ? `${brandLabel(brand)} •••• ${last4}` : brandLabel(brand);
}
