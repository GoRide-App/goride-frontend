"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, CreditCard, Trash2 } from "lucide-react";
import type { SavedCard } from "@/types";
import { brandLabel, cardLabel, formatCardExpiry, isExpired } from "@/lib/card-input";
import { cn } from "@/lib/utils";
import { Button, IconButton } from "@/components/ui/button";
import { easeOut, fades } from "@/components/ui/motion";
import { Badge } from "@/components/ui/primitives";

/* ------------------------------------------------------------------ */
/* Brand mark: a card-shaped chip, never a full logo                    */
/* ------------------------------------------------------------------ */

/** Visa as its wordmark on white, Mastercard as its two circles on charcoal, anything else a card glyph. */
export function CardBrandMark({ brand, className }: { brand: string | null | undefined; className?: string }) {
  const b = brandLabel(brand);
  const base = "inline-flex h-8 w-12 shrink-0 items-center justify-center rounded-lg";
  if (b === "Visa")
    return (
      <span className={cn(base, "bg-white ring-1 ring-inset ring-line", className)} aria-hidden>
        <span className="text-[13px] font-extrabold italic leading-none tracking-[-0.03em] text-[#1a1f71]">VISA</span>
      </span>
    );
  if (b === "Mastercard")
    return (
      <span className={cn(base, "bg-navy-900", className)} aria-hidden>
        <span className="h-4 w-4 rounded-full bg-[#eb001b]" />
        <span className="-ml-1.5 h-4 w-4 rounded-full bg-[#f79e1b]/90" />
      </span>
    );
  return (
    <span className={cn(base, "bg-surface-2 text-ink", className)} aria-hidden>
      <CreditCard size={16} />
    </span>
  );
}

function cardMeta(card: SavedCard) {
  return `Expires ${formatCardExpiry(card.expMonth, card.expYear)}${card.holderName ? ` · ${card.holderName}` : ""}`;
}

/** Default first, then newest. */
export function sortCards(cards: SavedCard[]) {
  return [...cards].sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || b.createdAt.localeCompare(a.createdAt));
}

/* ------------------------------------------------------------------ */
/* Picker: which saved card pays (checkout)                             */
/* ------------------------------------------------------------------ */

export function SavedCardPicker({ cards, selectedId, onSelect, disabled, className }: { cards: SavedCard[]; selectedId: string | null; onSelect: (cardId: string) => void; disabled?: boolean; className?: string }) {
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const usable = cards.map((c) => !isExpired(c.expMonth, c.expYear));

  // Arrow keys move between the usable cards, like any radio group.
  const onKey = (e: React.KeyboardEvent, i: number) => {
    const step = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    for (let n = 1; n <= cards.length; n++) {
      const j = (i + step * n + cards.length * n) % cards.length;
      if (usable[j]) {
        onSelect(cards[j].cardId);
        refs.current[j]?.focus();
        return;
      }
    }
  };

  return (
    <div role="radiogroup" aria-label="Saved cards" className={cn("flex flex-col gap-2", className)}>
      {cards.map((card, i) => {
        const checked = card.cardId === selectedId;
        const expired = !usable[i];
        return (
          <button
            key={card.cardId}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked || (!selectedId && i === 0) ? 0 : -1}
            disabled={disabled || expired}
            onClick={() => onSelect(card.cardId)}
            onKeyDown={(e) => onKey(e, i)}
            className={cn(
              "flex min-h-16 w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-left ring-1 transition-[background-color,box-shadow,opacity] duration-200 ease-(--ease-spring)",
              checked ? "bg-brand-50 ring-2 ring-brand-400" : "bg-white ring-line hover:bg-surface-2",
              (disabled || expired) && "cursor-not-allowed",
              expired && "opacity-55",
            )}
          >
            <CardBrandMark brand={card.brand} />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="truncate text-[15px] font-semibold leading-snug tabular-nums">{cardLabel(card.brand, card.last4)}</span>
                {card.isDefault && <Badge tone="brand">Default</Badge>}
                {expired && <Badge tone="danger">Expired</Badge>}
              </span>
              <span className="block truncate text-[13px] leading-snug text-muted tabular-nums">{cardMeta(card)}</span>
            </span>
            <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors duration-200", checked ? "bg-brand-400 text-ink" : "ring-2 ring-inset ring-[#dcdcd8]")} aria-hidden>
              {checked && <Check size={14} strokeWidth={3} />}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Row: one saved card in the profile, with default + inline remove     */
/* ------------------------------------------------------------------ */

export function SavedCardRow({
  card,
  busy,
  onMakeDefault,
  onRemove,
}: {
  card: SavedCard;
  /** "default" or "remove" while that request is in flight for this card. */
  busy: "default" | "remove" | null;
  onMakeDefault: () => void;
  onRemove: () => Promise<boolean>;
}) {
  const reduce = useReducedMotion();
  const [confirming, setConfirming] = React.useState(false);
  const label = cardLabel(card.brand, card.last4);

  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-3">
        <CardBrandMark brand={card.brand} />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2">
            <span className="truncate text-[15px] font-semibold leading-snug tabular-nums">{label}</span>
            {card.isDefault && <Badge tone="brand">Default</Badge>}
            {isExpired(card.expMonth, card.expYear) && <Badge tone="danger">Expired</Badge>}
          </p>
          <p className="truncate text-[13px] leading-snug text-muted tabular-nums">{cardMeta(card)}</p>
          {!card.isDefault && !confirming && (
            <button type="button" onClick={onMakeDefault} disabled={busy !== null} className="mt-1 inline-flex min-h-8 items-center gap-1.5 text-[13px] font-semibold text-brand-800 underline-offset-4 hover:underline disabled:opacity-50">
              {busy === "default" ? "Making default…" : "Make default"}
            </button>
          )}
        </div>
        {!confirming && (
          <IconButton label={`Remove ${label}`} variant="ghost" size="icon-sm" className="text-muted hover:bg-red-50 hover:text-danger" disabled={busy !== null} onClick={() => setConfirming(true)}>
            <Trash2 size={16} />
          </IconButton>
        )}
      </div>

      <AnimatePresence initial={false}>
        {confirming && (
          <motion.div
            key="confirm"
            initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, height: "auto" }}
            exit={reduce ? { opacity: 0, transition: fades.exit } : { opacity: 0, height: 0, transition: fades.exit }}
            transition={{ duration: 0.22, ease: easeOut }}
            className="overflow-hidden"
          >
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl bg-red-50 px-3.5 py-3" role="group" aria-label={`Remove ${label}`}>
              <p className="min-w-0 flex-1 text-[13px] font-medium leading-snug text-red-700 text-pretty">
                Remove this card?{card.isDefault ? " Your next card becomes the default." : ""}
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="white" full={false} onClick={() => setConfirming(false)} disabled={busy === "remove"}>
                  Keep
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  full={false}
                  loading={busy === "remove"}
                  loadingText="Removing…"
                  onClick={async () => {
                    if (!(await onRemove())) setConfirming(false);
                  }}
                >
                  Remove
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
