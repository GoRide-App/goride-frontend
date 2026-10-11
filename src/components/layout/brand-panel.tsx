"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { MapPin, ShieldCheck, Timer, Wallet } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { fades } from "@/components/ui/motion";

const panelCopy = {
  rider: {
    headline: "Where to, today?",
    body: "Plan your route, see the fare in LKR before you book, and follow your driver live from pickup to drop-off.",
    points: [
      { icon: Wallet, label: "Upfront fares in LKR, no surprises" },
      { icon: Timer, label: "Three matching rounds in under 30 seconds" },
      { icon: ShieldCheck, label: "SOS and emergency contacts, one tap away" },
    ],
  },
  driver: {
    headline: "Your hours. Your earnings.",
    body: "Go online when you want, accept the rides you choose, and see earnings the moment a trip is paid.",
    points: [
      { icon: Timer, label: "Requests pushed instantly, 20 s to respond" },
      { icon: Wallet, label: "Card or cash, you confirm cash yourself" },
      { icon: ShieldCheck, label: "Verified riders, SOS for you too" },
    ],
  },
  auth: {
    headline: "Your ride, on your terms.",
    body: "One honest trip lifecycle: plan, see the fare, match, ride, pay, rate. One rider, one driver, one trip, never a double charge.",
    points: [
      { icon: MapPin, label: "Live GPS tracking under 5 seconds" },
      { icon: Wallet, label: "Card with retry, cash with driver confirmation" },
      { icon: ShieldCheck, label: "Verified drivers, audited admin actions" },
    ],
  },
};

/** The yellow side of the auth split: wordmark, headline, three product facts, the fleet. */
export function BrandPanel({ tone = "auth" }: { tone?: "rider" | "driver" | "auth" }) {
  const copy = panelCopy[tone];
  const reduce = useReducedMotion();
  const rise = (delay: number) => ({
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { ...fades.normal, delay },
  });
  return (
    <div className="relative flex h-full w-full flex-col justify-between overflow-hidden bg-brand-400 p-10 text-ink lg:p-14">
      {/* soft sun behind the fleet */}
      <div className="pointer-events-none absolute -bottom-40 right-[-10%] h-[520px] w-[520px] rounded-full bg-white/30 blur-3xl" />

      <div className="relative flex items-center justify-between">
        <Logo variant="dark" height={32} />
      </div>

      <div className="relative max-w-xl">
        <motion.h2 {...rise(0)} className="text-[44px] font-semibold leading-[1.02] tracking-[-0.03em] text-balance lg:text-[56px]">
          {copy.headline}
        </motion.h2>
        <motion.p {...rise(0.06)} className="mt-5 max-w-md text-[15px] leading-relaxed text-ink/70 text-pretty">
          {copy.body}
        </motion.p>
        <ul className="mt-8 flex flex-col gap-3">
          {copy.points.map((p, i) => (
            <motion.li key={p.label} {...rise(0.12 + i * 0.05)} className="flex items-center gap-3 text-sm font-medium">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-brand-400">
                <p.icon size={16} strokeWidth={2.25} />
              </span>
              {p.label}
            </motion.li>
          ))}
        </ul>
      </div>

      <div className="relative flex items-end justify-between gap-6">
        <div className="flex gap-3">
          {[
            { src: "/vehicles/bike.webp", label: "Bike" },
            { src: "/vehicles/tuk.webp", label: "Tuk" },
            { src: "/vehicles/car.png", label: "Car" },
          ].map((v) => (
            <div key={v.label} className="flex w-28 flex-col items-center rounded-card bg-white p-3 shadow-card">
              <Image src={v.src} alt={v.label} width={96} height={64} className="h-14 w-auto object-contain" />
              <span className="mt-1 text-[11px] font-semibold text-ink">{v.label}</span>
            </div>
          ))}
        </div>
        <p className="hidden text-right text-[11px] leading-relaxed text-ink/55 lg:block">
          Four ride types · Upfront LKR fares
          <br />
          SOS on every trip
        </p>
      </div>
    </div>
  );
}
