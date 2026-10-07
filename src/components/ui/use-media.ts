"use client";

import * as React from "react";

/**
 * Subscribe to a media query. SSR-safe: returns `fallback` on the server and
 * on the first client render, so markup never mismatches.
 */
export function useMediaQuery(query: string, fallback = false) {
  const subscribe = React.useCallback(
    (onChange: () => void) => {
      if (typeof window === "undefined") return () => {};
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    [query],
  );
  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => fallback,
  );
}

/** Below the `md` breakpoint: floating tab bar, bottom sheets, full-bleed map. */
export function useIsMobile() {
  return useMediaQuery("(max-width: 767px)");
}

/** Below `sm`: dialogs become bottom sheets. */
export function useIsPhone() {
  return useMediaQuery("(max-width: 639px)");
}
