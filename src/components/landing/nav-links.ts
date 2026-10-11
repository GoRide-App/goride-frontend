import { identityLoginUrl } from "@/lib/constants";

/** Real destinations for the hero nav and mobile menu (the landing is a single hero, so no in-page anchors). */
export const NAV_LINKS = [
  { href: identityLoginUrl("/rider"), label: "Book a ride" },
  { href: identityLoginUrl("/dashboard"), label: "Drive with GoRide" },
] as const;
