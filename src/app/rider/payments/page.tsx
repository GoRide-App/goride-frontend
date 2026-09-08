"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ChevronRight, CreditCard, Receipt, ShieldCheck, Wallet } from "lucide-react";
import type { Payment, Trip } from "@/types";
import { api } from "@/lib/api";
import { ROUTES } from "@/lib/constants";
import { formatDateTime, formatLKR } from "@/lib/utils";
import { useCurrentUser } from "@/components/layout/role-guard";
import { Badge, Card, EmptyState, SectionTitle, Skeleton, TopBar } from "@/components/ui/primitives";

export default function RiderPaymentsPage() {
  const user = useCurrentUser()!;
  const [payments, setPayments] = React.useState<Payment[] | null>(null);
  const [trips, setTrips] = React.useState<Record<string, Trip>>({});

  React.useEffect(() => {
    Promise.all([api.payments.list({ riderId: user.id }), api.trips.list({ riderId: user.id })])
      .then(([p, t]) => {
        setPayments(p);
        setTrips(Object.fromEntries(t.map((x) => [x.id, x])));
      })
      .catch(() => setPayments([]));
  }, [user.id]);

  const total = (payments ?? []).filter((p) => p.status === "Paid").reduce((a, p) => a + p.finalFare, 0);

  return (
    <>
      <TopBar back={ROUTES.rider.home} title="Payments & receipts" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] lg:items-start">
        <div className="lg:sticky lg:top-0">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl bg-ink p-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-white/60">Default payment</p>
              <p className="mt-1 flex items-center gap-2 text-lg font-semibold">
                <CreditCard size={18} /> Visa •••• 4242
              </p>
              <p className="text-[11px] text-white/60">Tokenised with the payment provider · GoRide never stores card numbers</p>
            </div>
            <ShieldCheck className="text-brand-300" />
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3 text-xs">
            <span className="text-white/70">Spent on GoRide</span>
            <span className="font-semibold">{formatLKR(total)}</span>
          </div>
        </motion.div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <Card className="flex items-center gap-3 py-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-2">
              <Wallet size={18} />
            </span>
            <div>
              <p className="text-xs text-muted">Cash</p>
              <p className="text-sm font-semibold">Always available</p>
            </div>
          </Card>
          <Card className="flex items-center gap-3 py-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-2">
              <CreditCard size={18} />
            </span>
            <div>
              <p className="text-xs text-muted">Card retry</p>
              <p className="text-sm font-semibold">1 auto retry</p>
            </div>
          </Card>
        </div>
        </div>

        <div>
        <SectionTitle>Receipts</SectionTitle>
        {!payments ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : payments.length === 0 ? (
          <EmptyState icon={<Receipt size={22} />} title="No receipts yet" description="Receipts are generated as soon as a trip is paid." compact />
        ) : (
          <ul className="space-y-2">
            {payments.map((p, i) => {
              const t = trips[p.tripId];
              return (
                <motion.li key={p.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 8) * 0.04 }}>
                  <Link href={ROUTES.rider.trip(p.tripId)} className="flex items-center gap-3 rounded-xl border border-zinc-200/80 bg-white p-3 shadow-card hover:border-zinc-300">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-2">{p.method === "Card" ? <CreditCard size={18} /> : <Wallet size={18} />}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{t ? `${t.pickup.name} → ${t.destination.name}` : p.tripId}</span>
                      <span className="block text-[11px] text-muted">
                        {formatDateTime(p.processedAt ?? p.createdAt)} · {p.receiptNo ?? "—"}
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="block text-sm font-bold">{formatLKR(p.finalFare)}</span>
                      <Badge tone={p.status === "Paid" ? "success" : p.status === "Failed" ? "danger" : "warning"} className="mt-0.5">
                        {p.status}
                      </Badge>
                    </span>
                    <ChevronRight size={16} className="text-zinc-400" />
                  </Link>
                </motion.li>
              );
            })}
          </ul>
        )}
        </div>
      </div>
    </>
  );
}
