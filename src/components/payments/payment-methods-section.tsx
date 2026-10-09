"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CreditCard, Lock, Plus, RefreshCw } from "lucide-react";
import type { SavedCard } from "@/types";
import { isPaymentError, paymentService } from "@/lib/api/payments-live";
import { errorMessage } from "@/lib/api";
import { cardLabel } from "@/lib/card-input";
import { Button } from "@/components/ui/button";
import { fades } from "@/components/ui/motion";
import { Card, EmptyState, Skeleton } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";
import { ProfileSectionTitle } from "@/components/profile/profile-screen";
import { SavedCardRow, sortCards } from "./card-bits";
import { AddCardForm } from "./card-form";

/** The payment service keeps at most this many cards per rider (409 CARD_LIMIT_REACHED). */
const MAX_CARDS = 5;

/** Merges a saved/updated card into the list, keeping a single default. */
function withCard(cards: SavedCard[], card: SavedCard) {
  const rest = cards.filter((c) => c.cardId !== card.cardId).map((c) => (card.isDefault ? { ...c, isDefault: false } : c));
  return sortCards([...rest, card]);
}

/**
 * Rider profile → Payment methods: the demo cards saved with goride-payment. The default card
 * is preselected at checkout; removing it promotes the newest remaining card (server side).
 */
export function PaymentMethodsSection() {
  const reduce = useReducedMotion();
  const [cards, setCards] = React.useState<SavedCard[] | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [adding, setAdding] = React.useState(false);
  const [pending, setPending] = React.useState<{ cardId: string; kind: "default" | "remove" } | null>(null);
  const [attempt, setAttempt] = React.useState(0);

  React.useEffect(() => {
    let alive = true;
    paymentService.cards
      .list()
      .then((list) => {
        if (!alive) return;
        setCards(sortCards(list));
        setLoadError(null);
      })
      .catch((e) => alive && setLoadError(errorMessage(e, "Couldn't load your saved cards.")));
    return () => {
      alive = false;
    };
  }, [attempt]);

  const reload = () => setAttempt((n) => n + 1);

  const makeDefault = async (card: SavedCard) => {
    setPending({ cardId: card.cardId, kind: "default" });
    try {
      const updated = await paymentService.cards.makeDefault(card.cardId);
      setCards((prev) => withCard(prev ?? [], updated));
      toast.success("Default card updated", `${cardLabel(updated.brand, updated.last4)} is now preselected when you pay.`);
    } catch (e) {
      toast.error("Couldn't change your default card", errorMessage(e));
      if (isPaymentError(e, "CARD_NOT_FOUND")) reload();
    } finally {
      setPending(null);
    }
  };

  const remove = async (card: SavedCard) => {
    setPending({ cardId: card.cardId, kind: "remove" });
    try {
      await paymentService.cards.remove(card.cardId);
      setCards((prev) => prev?.filter((c) => c.cardId !== card.cardId) ?? prev);
      // Removing the default promotes another card on the server; pick that up.
      if (card.isDefault) reload();
      toast.success("Card removed", `${cardLabel(card.brand, card.last4)} is no longer saved.`);
      return true;
    } catch (e) {
      if (isPaymentError(e, "CARD_NOT_FOUND")) {
        reload();
        return true;
      }
      toast.error("Couldn't remove the card", errorMessage(e));
      return false;
    } finally {
      setPending(null);
    }
  };

  const full = (cards?.length ?? 0) >= MAX_CARDS;

  return (
    <section aria-labelledby="profile-payments-title">
      <ProfileSectionTitle
        id="profile-payments-title"
        right={
          cards ? (
            <span className="text-[13px] font-semibold tabular-nums text-muted">
              {cards.length}/{MAX_CARDS}
            </span>
          ) : undefined
        }
      >
        Payment methods
      </ProfileSectionTitle>
      <Card padded={false}>
        <div className="flex items-start gap-3 border-b border-line p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-800" aria-hidden>
            <Lock size={17} />
          </span>
          <p className="text-[13px] leading-relaxed text-ink-2 text-pretty">
            <span className="font-semibold text-ink">Pay for rides in the app.</span> Your default card is picked for you at the end of each trip. GoRide only ever shows the last four digits.
          </p>
        </div>

        {loadError ? (
          <div className="p-4">
            <EmptyState
              icon={<CreditCard size={22} />}
              title="Couldn't load your cards"
              description={loadError}
              compact
              action={
                <Button
                  variant="secondary"
                  leftIcon={<RefreshCw size={16} />}
                  onClick={() => {
                    setLoadError(null);
                    reload();
                  }}
                >
                  Try again
                </Button>
              }
            />
          </div>
        ) : !cards ? (
          <div className="flex flex-col gap-2 p-3" aria-busy="true">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : cards.length === 0 && !adding ? (
          <EmptyState icon={<CreditCard size={22} />} title="No cards saved yet" description="Add a demo card to pay for rides without handling cash." compact />
        ) : (
          <ul className="divide-y divide-line">
            <AnimatePresence initial={false}>
              {cards.map((c) => (
                <motion.li
                  key={c.cardId}
                  layout={!reduce}
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduce ? { opacity: 0, transition: fades.exit } : { opacity: 0, x: -20, transition: fades.exit }}
                  transition={fades.normal}
                >
                  <SavedCardRow card={c} busy={pending?.cardId === c.cardId ? pending.kind : null} onMakeDefault={() => makeDefault(c)} onRemove={() => remove(c)} />
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}

        {cards && !loadError && (
          <div className="border-t border-line p-3">
            {adding ? (
              <AddCardForm
                className="p-1"
                defaultMakeDefault={cards.length === 0}
                onCancel={() => setAdding(false)}
                onSaved={(card) => {
                  setCards((prev) => withCard(prev ?? [], card));
                  setAdding(false);
                  toast.success("Card saved", `${cardLabel(card.brand, card.last4)}${card.isDefault ? " is your default card." : " is ready to use."}`);
                }}
              />
            ) : (
              <Button variant={full ? "secondary" : "dark"} disabled={full} leftIcon={<Plus size={18} />} onClick={() => setAdding(true)}>
                {full ? `Maximum of ${MAX_CARDS} cards saved` : "Add card"}
              </Button>
            )}
          </div>
        )}
      </Card>
    </section>
  );
}
