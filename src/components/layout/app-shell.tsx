"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, Home, LayoutDashboard, LogOut, Navigation, UserRound } from "lucide-react";
import type { Role } from "@/types";
import { logout } from "@/lib/auth/actions";
import { ROUTES, homeForRole, profileForRole } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { springs } from "@/components/ui/motion";
import { Avatar, Badge, RatingInline } from "@/components/ui/primitives";
import { PinMark } from "@/components/ui/spinner";
import { Toaster } from "@/components/ui/toast";
import { InShellProvider, useShellHeader } from "./shell-header";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
  exact?: boolean;
}

/** Only routes that exist. The tab bar and the rail share this list. */
const NAV: Record<Role, NavItem[]> = {
  Rider: [
    { href: ROUTES.rider.home, label: "Home", icon: Home, exact: true },
    { href: ROUTES.rider.ride, label: "Ride", icon: Navigation },
    { href: ROUTES.rider.profile, label: "Profile", icon: UserRound },
  ],
  Driver: [
    { href: ROUTES.driver.home, label: "Home", icon: Home, exact: true },
    { href: ROUTES.driver.profile, label: "Profile", icon: UserRound },
  ],
  Admin: [
    { href: ROUTES.dashboard, label: "Dashboard", icon: LayoutDashboard, exact: true },
    { href: ROUTES.admin.profile, label: "Profile", icon: UserRound },
  ],
};

export type AppShellUser = {
  name: string;
  email: string;
  role?: Role;
  id?: string;
  profilePhotoUrl?: string | null;
  rating?: number;
  ratingCount?: number;
};

/**
 * AppShell: the frame for every signed-in screen.
 *
 * md+   : charcoal left rail (icon-only below lg, labelled from lg) with the
 *         yellow-pin logo, role badge, nav (active = yellow) and the account
 *         card; a white header fed by `useSetShellHeader`.
 * phones: compact top bar (floating pills on map pages) and a floating white
 *         tab bar whose active tab is a yellow rounded square. Content gets
 *         `--tabbar-h` so nothing hides under the bar.
 */
export function AppShell({ user, variant = "page", className, children }: { user: AppShellUser; variant?: "page" | "split"; className?: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const reduce = useReducedMotion();
  const tabId = React.useId();
  const { title, description, backHref, actions } = useShellHeader();
  const [account, setAccount] = React.useState(false);
  const [confirmLogout, setConfirmLogout] = React.useState(false);
  const [loggingOut, setLoggingOut] = React.useState(false);

  const role = user.role;
  const items = role ? NAV[role] ?? [] : [];
  const homeHref = role ? homeForRole(role) : ROUTES.home;
  const profileHref = role ? profileForRole(role) : undefined;
  const firstName = user.name.split(" ")[0];

  const isActive = (item: NavItem) => (item.exact ? pathname === item.href : pathname.startsWith(item.href));
  const fallbackTitle = items.find((i) => isActive(i))?.label;
  const heading = title ?? fallbackTitle ?? "GoRide";

  const avatarButton = (extra?: string) => (
    <button type="button" onClick={() => setAccount(true)} aria-label="Account" className={cn("flex shrink-0 items-center justify-center rounded-full transition-transform duration-200 ease-(--ease-spring) active:scale-95", extra)}>
      <Avatar name={user.name} src={user.profilePhotoUrl} size="sm" />
    </button>
  );

  const backButton = (floating?: boolean) =>
    backHref ? (
      <Link href={backHref} aria-label="Go back" className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink transition-colors", floating ? "bg-white shadow-float hover:bg-surface-2" : "hover:bg-surface-2")}>
        <ArrowLeft size={20} strokeWidth={2.5} />
      </Link>
    ) : null;

  return (
    <div className={cn("flex h-dvh w-full overflow-hidden bg-surface-2 text-ink", items.length ? "[--tabbar-h:104px] md:[--tabbar-h:0px]" : "[--tabbar-h:0px]")}>
      <Toaster position="fixed" />

      {/* ---------------- Rail (md+) ---------------- */}
      <aside className="relative hidden h-full w-[84px] shrink-0 flex-col bg-navy-950 py-5 text-white shadow-rail md:flex lg:w-[248px]">
        <div className="mb-8 flex items-center justify-between px-5 lg:px-6">
          <Link href={homeHref} aria-label="GoRide home" className="flex items-center rounded-full">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.06] lg:hidden">
              <PinMark size={26} />
            </span>
            <span className="hidden lg:block">
              <Logo variant="white" height={24} />
            </span>
          </Link>
          {role && <span className="hidden rounded-full bg-brand-400 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-ink lg:inline-block">{role}</span>}
        </div>

        <nav aria-label="Primary" className="flex flex-1 flex-col gap-1.5 overflow-y-auto px-4">
          {items.map((item) => {
            const active = isActive(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group flex h-12 items-center justify-center gap-3 rounded-2xl px-3 text-sm font-semibold transition-colors duration-150 lg:justify-start",
                  active ? "bg-brand-400 text-ink" : "text-white/65 hover:bg-white/[0.06] hover:text-white",
                )}
              >
                <item.icon size={20} strokeWidth={active ? 2.4 : 2} className="shrink-0" />
                <span className="hidden lg:inline">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto px-3 lg:px-4">
          <div className="flex items-center justify-center gap-3 rounded-2xl bg-white/[0.06] p-2.5 lg:justify-start lg:p-3">
            <button type="button" onClick={() => setAccount(true)} aria-label="Account" className="rounded-full">
              <Avatar name={user.name} src={user.profilePhotoUrl} size="sm" />
            </button>
            <div className="hidden min-w-0 flex-1 lg:block">
              <p className="truncate text-sm font-semibold text-white">{user.name}</p>
              <p className="truncate text-[11px] text-white/55">{user.email}</p>
            </div>
            <button type="button" aria-label="Log out" onClick={() => setConfirmLogout(true)} className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/60 transition-colors hover:bg-white/10 hover:text-white lg:flex">
              <LogOut size={16} />
            </button>
          </div>
          <button type="button" aria-label="Log out" onClick={() => setConfirmLogout(true)} className="mt-2 flex h-11 w-full items-center justify-center rounded-2xl text-white/60 transition-colors hover:bg-white/[0.06] hover:text-white lg:hidden">
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      {/* ---------------- Main column ---------------- */}
      <div className="relative flex min-w-0 flex-1 flex-col">
        {/* Desktop header */}
        <header className="hidden h-16 shrink-0 items-center gap-3 border-b border-line bg-white px-6 md:flex">
          {backButton()}
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[17px] font-semibold leading-tight tracking-[-0.01em]">{heading}</h1>
            {description && <p className="truncate text-xs text-muted">{description}</p>}
          </div>
          {actions}
          <button type="button" onClick={() => setAccount(true)} className="ml-1 flex items-center gap-2 rounded-full py-1 pl-1 pr-3 transition-colors hover:bg-surface-2">
            <Avatar name={user.name} src={user.profilePhotoUrl} size="sm" />
            <span className="text-sm font-semibold">{firstName}</span>
          </button>
        </header>

        {/* Phone top bar (page variant) */}
        {variant === "page" && (
          <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line bg-white px-3 md:hidden">
            {backButton()}
            <div className={cn("min-w-0 flex-1", !backHref && "pl-1")}>
              <h1 className="truncate text-[17px] font-semibold leading-tight tracking-[-0.01em]">{heading}</h1>
              {description && <p className="truncate text-xs text-muted">{description}</p>}
            </div>
            {actions}
            {avatarButton("h-11 w-11")}
          </header>
        )}

        <InShellProvider value>
          {variant === "split" ? (
            <div className="relative min-h-0 flex-1 overflow-hidden">
              {/* Phone: floating chrome over the map */}
              <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center gap-2 p-3 md:hidden">
                <span className="pointer-events-auto">{backButton(true)}</span>
                {title && (
                  <h1 className="pointer-events-auto min-w-0 truncate rounded-full bg-white/92 px-4 py-2.5 text-sm font-semibold shadow-float backdrop-blur-md">
                    {title}
                  </h1>
                )}
                <span className="pointer-events-auto ml-auto flex items-center gap-2">
                  {actions}
                  {avatarButton("h-11 w-11 bg-white shadow-float ring-2 ring-white")}
                </span>
              </div>
              {children}
            </div>
          ) : (
            <main className="min-h-0 flex-1 overflow-y-auto md:scrollbar-visible">
              <div className={cn("mx-auto w-full max-w-[1100px] p-4 pb-[calc(var(--tabbar-h,0px)+1rem)] md:p-6", className)}>{children}</div>
            </main>
          )}
        </InShellProvider>
      </div>

      {/* ---------------- Phone tab bar ---------------- */}
      {items.length > 0 && (
        <nav aria-label="Primary" className="fixed inset-x-4 z-30 md:hidden" style={{ bottom: "max(env(safe-area-inset-bottom), 12px)" }}>
          <ul className="flex items-stretch rounded-[24px] bg-white p-2 shadow-float ring-1 ring-ink/[0.04]">
            {items.map((item) => {
              const active = isActive(item);
              return (
                <li key={item.href} className="flex-1">
                  <Link href={item.href} aria-current={active ? "page" : undefined} className="relative flex flex-col items-center gap-1 rounded-2xl py-1 text-[11px] font-semibold">
                    <span className="relative flex h-11 w-11 items-center justify-center">
                      {active && <motion.span layoutId={reduce ? undefined : `tab-${tabId}`} className="absolute inset-0 rounded-[14px] bg-brand-400" transition={springs.snappy} />}
                      <item.icon size={22} strokeWidth={active ? 2.4 : 2} className={cn("relative transition-colors duration-150", active ? "text-ink" : "text-muted")} />
                    </span>
                    <span className={cn("transition-colors duration-150", active ? "text-ink" : "text-muted")}>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}

      {/* ---------------- Account ---------------- */}
      <Dialog
        open={account}
        onClose={() => setAccount(false)}
        position="fixed"
        closeButton
        icon={<Avatar name={user.name} src={user.profilePhotoUrl} size="lg" />}
        title={user.name}
        description={user.email}
      >
        <div className="flex flex-wrap items-center gap-2">
          {role && (
            <Badge tone="brand" size="md">
              {role}
            </Badge>
          )}
          {user.rating != null && <RatingInline value={user.rating} count={user.ratingCount} />}
        </div>
        <div className="mt-5 flex flex-col gap-2">
          {profileHref && (
            <Button
              size="lg"
              variant="secondary"
              leftIcon={<UserRound size={18} />}
              onClick={() => {
                setAccount(false);
                router.push(profileHref);
              }}
            >
              View profile
            </Button>
          )}
          <Button
            size="lg"
            variant="outline"
            leftIcon={<LogOut size={18} />}
            onClick={() => {
              setAccount(false);
              setConfirmLogout(true);
            }}
          >
            Log out
          </Button>
        </div>
      </Dialog>

      <ConfirmDialog
        open={confirmLogout}
        onClose={() => setConfirmLogout(false)}
        title="Log out of GoRide?"
        description="You'll need to sign in again to book or accept rides."
        confirmLabel="Log out"
        destructive
        position="fixed"
        loading={loggingOut}
        onConfirm={async () => {
          setLoggingOut(true);
          await logout();
          router.replace(ROUTES.home);
        }}
      />
    </div>
  );
}
