---
version: 1
slug: "src-app-page-tsx"
primary_target: "src/app/page.tsx"
related_targets: ["src/app/dashboard/page.tsx","src/app/rider/page.tsx","src/app/driver/page.tsx"]
---

## Scope

Route `/` (src/app/page.tsx + src/components/landing/*). Mode: **Persuade**. Audience: Colombo riders and would-be drivers arriving cold. Action: start a booking ("Where to?" → sign in) or sign up to drive. Proof: product facts only (no invented counts or ratings). Constraints: sign-in links stay `identityLoginUrl(...)` via `IdentityLink`; build path code-led (no image generation available on this machine).

## Direction contract

THESIS: GoRide's landing is the back seat at golden hour — Colombo moving behind glass while the booking pill sits in your hand. It refuses the category default: split hero with a phone mockup, a three-card feature grid and app-store badges.

OWN-WORLD: Taxi-yellow (#FFC21A) fills on charcoal (#111111 / #161617) and white; liquid-glass pills over moving footage; Instrument Serif headline with one yellow italic accent word; Poppins for everything you touch; pill CTAs carrying a black round arrow chip; 24px card radii; one yellow route line (dashed while planning, solid when booked) as the recurring motif.

STORY: The visitor understands GoRide books rides across Greater Colombo with the LKR fare shown upfront; believes it through product facts (4 ride types, upfront LKR fares, SOS on every trip, verified drivers); acts by typing "Where to?" or choosing Drive with GoRide.

FIRST VIEWPORT: Full-bleed stack of four looping city scenes (1000ms crossfade) under a car-window frame overlay that ride-bobs; top bar: GoRide wordmark left, glass nav pill right (How it works · Ride types · Safety · Drive) ending in a solid white "Sign in"; centre column: glass badge, serif headline "Your city, / on your terms." at ~88px desktop / 40px mobile, one-line sub, glass booking pill (Where to? input + yellow "Book a ride" chip); scene switcher row beneath; bottom: facts row split by pipes. Primary action is the booking pill, centred, thumb-reachable on mobile.

FORM: Brief-pinned world (Waygo app look + Lumora cinematic hero) beats the roll. The roll assigned #7 of the grounded list — an evening on Galle Face Green — and binds the open dimension, the scroll's ritual: sections pace golden hour → city lights → night like a walk along the seafront, the yellow route line running as the promenade edge between them. Seed key 133a6ad7.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## App surfaces (Operate) inherit this world

Rider, driver, admin, dashboard, onboarding and profile screens use the same tokens in Operate mode: white cards on #F5F5F3, yellow fills for the one primary action per screen, charcoal sheets and sidebars, bottom tab bar on mobile, map-first rider and driver screens with a draggable bottom sheet on mobile. No serif in the app except the onboarding headline.
