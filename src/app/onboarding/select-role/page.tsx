"use client";

import * as React from "react";
import { useState } from "react";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { Car, Check, Lock, User } from "lucide-react";
import { selectRole } from "@/lib/api";
import { useAuthStore } from "@/lib/auth/session";
import { VEHICLE_IMAGES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { fadeOnly, itemVariants, listVariants } from "@/components/ui/motion";

type RoleChoice = "Driver" | "Rider";

const ROLES: { role: RoleChoice; description: string; facts: string[]; image: string; icon: React.ReactNode }[] = [
  {
    role: "Rider",
    description: "Book a tuk, bike, car or XL across Greater Colombo with the fare shown before you confirm.",
    facts: ["Upfront LKR fares", "SOS on every trip"],
    image: VEHICLE_IMAGES.TUK,
    icon: <User size={20} />,
  },
  {
    role: "Driver",
    description: "Go online, take ride requests near you and run trips from the driver console.",
    facts: ["Verified vehicle & licence", "Drive when you choose"],
    image: VEHICLE_IMAGES.BIKE,
    icon: <Car size={20} />,
  },
];

export default function SelectRole() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [choice, setChoice] = useState<RoleChoice | null>(null);
  const email = useAuthStore((s) => s.session?.user.email ?? null);
  const reduce = useReducedMotion();
  const item = reduce ? fadeOnly : itemVariants;

  async function handleSelect(role: "Driver" | "Rider") {
    setSubmitting(true);
    setError(null);
    try {
      await selectRole(role);
      // Force a fresh OIDC round-trip so the new roles claim
      // gets baked into a new token/cookie. Asgardeo's own session
      // is still active, so this is silent - no login prompt shown.
      useAuthStore.getState().setSession(null);
      const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/+$/, "");
      window.location.replace(
        `${apiUrl}/login?prompt=login&returnUrl=${encodeURIComponent(`${window.location.origin}/dashboard`)}`,
      );
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (err) {
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  const continueBar = (
    <div className="flex flex-col gap-3">
      {error && (
        <p role="alert" className="rounded-2xl bg-navy-800 px-4 py-3 text-[13px] font-medium text-[#ffb3b4] ring-1 ring-[#ff8a8c]/35">
          {error}
        </p>
      )}
      <Button
        size="lg"
        variant={choice ? "primary" : "white"}
        arrow={!!choice}
        disabled={!choice}
        loading={submitting}
        loadingText="Setting up your account…"
        onClick={() => choice && handleSelect(choice)}
      >
        {choice ? `Continue as ${choice}` : "Choose a role to continue"}
      </Button>
    </div>
  );

  return (
    <main className="relative min-h-dvh bg-navy-950 text-white">
      <header className="mx-auto flex w-full max-w-[1120px] items-center justify-between px-5 py-5 md:px-10 md:py-7">
        <Logo variant="white" height={26} priority />
        {email && <span className="hidden max-w-[40vw] truncate rounded-full bg-white/[0.07] px-3.5 py-1.5 text-xs font-medium text-white/70 sm:inline-block">{email}</span>}
      </header>

      <motion.div
        variants={listVariants}
        initial="hidden"
        animate="show"
        className="mx-auto grid w-full max-w-[1120px] gap-10 px-5 pb-44 pt-4 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:items-start md:gap-14 md:px-10 md:pb-16 md:pt-10"
      >
        <motion.div variants={item}>
          <h1 className="font-display text-[46px] leading-[0.98] tracking-[-0.02em] text-balance sm:text-[60px] md:text-[68px]">
            Choose how you&apos;ll <em className="text-brand-400">move</em> with GoRide.
          </h1>
          <p className="mt-5 max-w-[46ch] text-[15px] leading-relaxed text-white/65 text-pretty md:text-[17px]">
            Pick Rider to book trips across Greater Colombo, or Driver to go online and take ride requests. You choose once.
          </p>
          <div className="mt-6 flex max-w-[46ch] items-start gap-3 rounded-2xl bg-brand-400/10 p-4 text-[13px] leading-relaxed text-brand-100 ring-1 ring-brand-400/30">
            <Lock size={16} className="mt-0.5 shrink-0 text-brand-300" aria-hidden />
            <p>
              <strong className="font-semibold text-brand-200">This choice is locked.</strong> Your role can&apos;t be changed after you continue, so pick carefully.
            </p>
          </div>
        </motion.div>

        <div className="flex flex-col gap-5">
          <motion.div variants={item} role="radiogroup" aria-label="Choose your role" className="grid gap-4 sm:grid-cols-2">
            {ROLES.map((r) => (
              <RoleCard key={r.role} {...r} selected={choice === r.role} disabled={submitting} onSelect={() => setChoice(r.role)} />
            ))}
          </motion.div>
          <motion.div variants={item} className="hidden md:block">
            {continueBar}
          </motion.div>
        </div>
      </motion.div>

      <div className="fixed inset-x-0 bottom-0 z-20 bg-gradient-to-t from-navy-950 via-navy-950/95 to-navy-950/0 px-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] pt-10 md:hidden">{continueBar}</div>
    </main>
  );
}

function RoleCard({
  role,
  description,
  facts,
  image,
  icon,
  selected,
  disabled,
  onSelect,
}: {
  role: RoleChoice;
  description: string;
  facts: string[];
  image: string;
  icon: React.ReactNode;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "group relative flex min-h-[320px] flex-col overflow-hidden rounded-[28px] p-6 text-left",
        "transition-[background-color,color,box-shadow,transform] duration-300 ease-(--ease-spring) active:scale-[0.99]",
        "focus-visible:outline-brand-400 disabled:cursor-not-allowed disabled:opacity-60",
        selected ? "bg-brand-400 text-ink shadow-glow" : "bg-navy-900 text-white ring-1 ring-white/10 hover:bg-navy-800 hover:ring-white/20",
      )}
    >
      <span className="flex items-center justify-between">
        <span className={cn("flex h-11 w-11 items-center justify-center rounded-full transition-colors duration-300", selected ? "bg-ink text-brand-400" : "bg-white/10 text-white")} aria-hidden>
          {icon}
        </span>
        <span aria-hidden className={cn("flex h-8 w-8 items-center justify-center rounded-full transition-colors duration-200", selected ? "bg-ink text-brand-400" : "ring-2 ring-inset ring-white/25")}>
          {selected && <Check size={16} strokeWidth={3} />}
        </span>
      </span>
      <span className="relative mt-3 flex h-[140px] justify-end sm:h-[160px]" aria-hidden>
        <Image
          src={image}
          alt=""
          width={260}
          height={170}
          className={cn("h-full w-auto object-contain drop-shadow-[0_18px_22px_rgba(0,0,0,0.45)] transition-transform duration-500 ease-(--ease-spring)", selected ? "scale-105" : "group-hover:-translate-x-1")}
        />
      </span>
      <span className="mt-auto block pt-4 text-[28px] font-semibold leading-none tracking-[-0.02em]">{role}</span>
      <span className={cn("mt-2 block text-[14px] leading-relaxed text-pretty", selected ? "text-ink/70" : "text-white/60")}>{description}</span>
      <span className="mt-4 flex flex-wrap gap-2">
        {facts.map((f) => (
          <span key={f} className={cn("rounded-full px-3 py-1 text-[12px] font-semibold", selected ? "bg-ink/10 text-ink" : "bg-white/[0.08] text-white/80")}>
            {f}
          </span>
        ))}
      </span>
    </button>
  );
}
