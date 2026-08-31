"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { create } from "zustand";
import {
  Bell,
  Car,
  LayoutDashboard,
  LogOut,
  Menu,
  UserCheck,
  X,
} from "lucide-react";
import { logout } from "@/lib/auth/actions";
import { ROUTES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand/logo";
import { Avatar } from "@/components/ui/primitives";
import { Toaster } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/dialog";

interface AdminHeaderState {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  set: (h: {
    title?: string;
    description?: string;
    actions?: React.ReactNode;
  }) => void;
}

export const useAdminHeader = create<AdminHeaderState>((set) => ({
  set: (h) => set(h),
}));

/** Call from a page to set the shell header. */
export function useSetAdminHeader(
  title: string,
  description?: string,
  actions?: React.ReactNode,
) {
  const set = useAdminHeader((s) => s.set);
  React.useEffect(() => {
    set({ title, description, actions });
    return () =>
      set({ title: undefined, description: undefined, actions: undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description]);
}

const NAV = [
  {
    href: ROUTES.admin.home,
    label: "Dashboard",
    icon: LayoutDashboard,
    exact: true,
  },
  { href: ROUTES.admin.drivers, label: "Driver Accounts", icon: Car },
  { href: ROUTES.admin.profile, label: "Admin Profile", icon: UserCheck },
];

export function AdminShell({
  user,
  children,
}: {
  user: { name: string; email: string };
  children: React.ReactNode;
}) {
  const { title, description, actions } = useAdminHeader();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [confirmLogout, setConfirmLogout] = React.useState(false);

  const nav = (
    <nav className="flex flex-1 flex-col gap-1 px-3">
      {NAV.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            className={cn(
              "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-white/10 text-white"
                : "text-white/65 hover:bg-white/5 hover:text-white",
            )}
          >
            {active && (
              <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-brand-400" />
            )}
            <item.icon
              size={18}
              className={cn(
                active ? "text-brand-300" : "text-white/60 group-hover:text-white",
              )}
            />
            <span className="flex-1">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="flex h-dvh w-full bg-zinc-50 text-ink">
      <Toaster position="fixed" />

      {/* sidebar (desktop) */}
      <aside className="hidden w-64 shrink-0 flex-col bg-navy-950 py-5 lg:flex">
        <div className="mb-6 flex items-center justify-between px-6">
          <Logo variant="white" height={24} />
          <span className="rounded-md bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white/70">
            Admin
          </span>
        </div>
        {nav}
        <div className="mt-auto px-3">
          <div className="flex items-center gap-3 rounded-xl bg-white/5 p-3">
            <Avatar name={user.name} size="sm" tone="bg-brand-400 text-ink" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">
                {user.name}
              </p>
              <p className="truncate text-[11px] text-white/60">{user.email}</p>
            </div>
            <button
              type="button"
              aria-label="Log out"
              onClick={() => setConfirmLogout(true)}
              className="rounded-lg p-1.5 text-white/60 hover:bg-white/10 hover:text-white"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* mobile drawer */}
      <AnimatePresence>
        {open && (
          <>
            <motion.button
              type="button"
              aria-label="Close menu"
              className="fixed inset-0 z-40 bg-black/40 lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />
            <motion.aside
              className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-navy-950 py-5 lg:hidden"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 38 }}
            >
              <div className="mb-6 flex items-center justify-between px-5">
                <Logo variant="white" height={22} />
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="rounded-lg p-1.5 text-white/70 hover:bg-white/10"
                >
                  <X size={18} />
                </button>
              </div>
              {nav}
              <div className="mt-auto px-3">
                <button
                  type="button"
                  onClick={() => setConfirmLogout(true)}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-white/70 hover:bg-white/5 hover:text-white"
                >
                  <LogOut size={16} /> Log out
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* main content */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-zinc-200 bg-white px-4 lg:px-6">
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setOpen(true)}
            className="rounded-lg p-2 hover:bg-surface-2 lg:hidden"
          >
            <Menu size={20} />
          </button>
          <div className="min-w-0 flex-1">
            {title && (
              <h1 className="truncate text-[15px] font-semibold leading-tight">
                {title}
              </h1>
            )}
            {description && (
              <p className="truncate text-xs text-muted">{description}</p>
            )}
          </div>
          {actions}
          <button
            type="button"
            aria-label="Notifications"
            onClick={() => router.push(ROUTES.admin.drivers)}
            className="relative rounded-lg p-2 hover:bg-surface-2"
          >
            <Bell size={18} />
          </button>
          <span className="hidden h-6 w-px bg-zinc-200 sm:block" />
          <div className="hidden items-center gap-2 sm:flex">
            <Avatar name={user.name} size="xs" tone="bg-navy-900 text-white" />
            <span className="text-xs font-semibold">{user.name}</span>
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto scrollbar-visible">
          <div className="mx-auto w-full max-w-[1400px] p-4 lg:p-6">
            {children}
          </div>
        </main>
      </div>

      <ConfirmDialog
        open={confirmLogout}
        onClose={() => setConfirmLogout(false)}
        title="Log out of the admin console?"
        confirmLabel="Log out"
        destructive
        position="fixed"
        onConfirm={async () => {
          await logout();
          router.replace(ROUTES.home);
        }}
      />
    </div>
  );
}
