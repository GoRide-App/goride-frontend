"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { IdentityLink } from "@/components/auth/identity-link";
import { identityLoginUrl } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { NAV_LINKS } from "./nav-links";

const EASE = "cubic-bezier(0.4,0,0.2,1)";
const ENTER = `[transition:opacity_500ms_${EASE},transform_500ms_${EASE}]`;

/** Hero nav: wordmark left, glass link pill right; glass hamburger + full-screen menu on mobile. */
export function LandingNav() {
  const [open, setOpen] = useState(false);
  const [entered, setEntered] = useState(false);
  const menuId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => setEntered(true));
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.querySelector<HTMLElement>("a[href]")?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const inPanel = Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>("a[href],button:not([disabled])") ?? [],
      );
      const cycle = [toggleRef.current, ...inPanel].filter((el): el is HTMLElement => Boolean(el));
      if (!cycle.length) return;
      const index = cycle.indexOf(document.activeElement as HTMLElement);
      if (index === -1 || (!event.shiftKey && index === cycle.length - 1)) {
        event.preventDefault();
        cycle[0].focus();
      } else if (event.shiftKey && index === 0) {
        event.preventDefault();
        cycle[cycle.length - 1].focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const toggle = toggleRef.current;
    return () => {
      cancelAnimationFrame(raf);
      setEntered(false);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      toggle?.focus();
    };
  }, [open]);

  return (
    <header className="relative flex items-center justify-between px-4 py-3 text-white [text-shadow:0_1px_10px_rgba(0,0,0,0.45)] sm:px-6 sm:py-4">
      <a
        href="#top"
        aria-label="GoRide home"
        className="inline-flex min-h-11 items-center rounded-md focus-visible:outline-[2.5px] focus-visible:outline-offset-4 focus-visible:outline-white"
      >
        <Logo variant="white" height={26} priority className="drop-shadow-[0_1px_8px_rgba(0,0,0,0.45)]" />
      </a>

      <nav aria-label="Primary" className="liquid-glass hidden items-center gap-0.5 rounded-full p-1 pl-1.5 md:flex">
        {NAV_LINKS.map((link) => (
          <IdentityLink
            key={link.label}
            href={link.href}
            className="rounded-full px-3.5 py-2.5 text-sm text-white/90 transition-colors duration-200 hover:bg-white/10 hover:text-white focus-visible:outline-[2.5px] focus-visible:outline-offset-[-2px] focus-visible:outline-white"
          >
            {link.label}
          </IdentityLink>
        ))}
        <IdentityLink
          href={identityLoginUrl("/dashboard")}
          className="ml-1 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-ink [text-shadow:none] transition-colors duration-200 hover:bg-brand-50 focus-visible:outline-[2.5px] focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          Sign in
        </IdentityLink>
      </nav>

      <button
        ref={toggleRef}
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((value) => !value)}
        className="liquid-glass relative z-[60] grid size-11 place-items-center rounded-full text-white focus-visible:outline-[2.5px] focus-visible:outline-offset-2 focus-visible:outline-white md:hidden"
      >
        <Menu
          size={20}
          aria-hidden="true"
          className={cn(
            "col-start-1 row-start-1 transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
            open ? "rotate-90 scale-75 opacity-0" : "rotate-0 scale-100 opacity-100",
          )}
        />
        <X
          size={20}
          aria-hidden="true"
          className={cn(
            "col-start-1 row-start-1 transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
            open ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-75 opacity-0",
          )}
        />
      </button>

      {open && (
        <div
          ref={panelRef}
          id={menuId}
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          className={cn(
            "fixed inset-0 z-50 flex flex-col bg-black/60 backdrop-blur-sm transition-opacity duration-300 md:hidden",
            entered ? "opacity-100" : "opacity-0",
          )}
        >
          <nav aria-label="Menu" className="flex flex-1 flex-col items-center justify-center gap-7">
            {NAV_LINKS.map((link, index) => (
              <IdentityLink
                key={link.label}
                href={link.href}
                onClick={() => setOpen(false)}
                style={{ transitionDelay: `${100 + index * 50}ms` }}
                className={cn(
                  "font-display text-[2rem] leading-none text-white focus-visible:outline-[2.5px] focus-visible:outline-offset-8 focus-visible:outline-white",
                  ENTER,
                  entered ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
                )}
              >
                {link.label}
              </IdentityLink>
            ))}
          </nav>
          <div
            style={{ transitionDelay: "300ms" }}
            className={cn(
              "flex items-center justify-center gap-3 px-5 pb-[max(env(safe-area-inset-bottom),2rem)]",
              ENTER,
              entered ? "scale-100 opacity-100" : "scale-90 opacity-0",
            )}
          >
            <IdentityLink
              href={identityLoginUrl("/dashboard")}
              className="inline-flex min-h-12 items-center rounded-full bg-white px-5 text-sm font-semibold text-ink transition-colors hover:bg-brand-50 focus-visible:outline-[2.5px] focus-visible:outline-offset-[3px] focus-visible:outline-white"
            >
              Sign in
            </IdentityLink>
          </div>
        </div>
      )}
    </header>
  );
}
