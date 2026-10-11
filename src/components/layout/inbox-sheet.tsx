"use client";

import * as React from "react";
import { Bell, CheckCheck } from "lucide-react";
import type { AppNotification } from "@/types";
import { api } from "@/lib/api";
import { cn, timeAgo } from "@/lib/utils";
import { BottomSheet, SheetHeader } from "@/components/ui/sheet";
import { EmptyState, Skeleton } from "@/components/ui/primitives";

export function InboxSheet({ open, onClose, userId }: { open: boolean; onClose: () => void; userId: string }) {
  const [items, setItems] = React.useState<AppNotification[] | null>(null);
  React.useEffect(() => {
    if (!open) return;
    let alive = true;
    api.users
      .listNotifications(userId)
      .then((n) => alive && setItems(n))
      .catch(() => alive && setItems([]));
    return () => {
      alive = false;
    };
  }, [open, userId]);

  const markAll = async () => {
    if (!items) return;
    await Promise.all(items.filter((n) => !n.read).map((n) => api.users.markNotificationRead(n.id)));
    setItems(items.map((n) => ({ ...n, read: true })));
  };

  const unread = items?.filter((n) => !n.read).length ?? 0;

  return (
    <BottomSheet open={open} onClose={onClose} backdrop maxHeight="80%" ariaLabel="Inbox">
      <SheetHeader
        title="Inbox"
        description={items ? (unread ? `${unread} unread` : "You're all caught up") : undefined}
        action={
          unread > 0 ? (
            <button type="button" onClick={markAll} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-surface-2 px-3 text-xs font-semibold text-ink transition-colors hover:bg-surface-3">
              <CheckCheck size={14} /> Mark all read
            </button>
          ) : undefined
        }
      />
      {!items ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[72px] rounded-2xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={<Bell />} title="No notifications yet" description="Ride updates, payment confirmations and account messages will show up here." compact />
      ) : (
        <ul className="divide-y divide-line">
          {items.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => {
                  if (!n.read) {
                    api.users.markNotificationRead(n.id);
                    setItems((prev) => prev?.map((x) => (x.id === n.id ? { ...x, read: true } : x)) ?? prev);
                  }
                }}
                className="flex w-full items-start gap-3 py-3.5 text-left transition-colors hover:bg-surface-2/60 -mx-2 px-2 rounded-2xl"
              >
                <span className={cn("mt-2 h-2 w-2 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-brand-400")} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className={cn("truncate text-[15px] leading-snug", n.read ? "font-medium text-ink-2" : "font-semibold text-ink")}>{n.title}</span>
                    <span className="shrink-0 text-[11px] tabular-nums text-muted">{timeAgo(n.sentAt)}</span>
                  </span>
                  <span className="mt-0.5 block text-[13px] leading-snug text-muted text-pretty">{n.message}</span>
                  <span className="mt-1.5 inline-block rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">{n.channel}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </BottomSheet>
  );
}
