# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Riders** in Greater Colombo, Sri Lanka, usually on a phone, booking a tuk, bike, car or XL ride. Their job is to get from A to B with a price they know before they commit.
- **Drivers** (the "captains") who go online, receive ride offers, navigate to pickup, run the trip and get paid.
- **Admins** who verify, suspend or reactivate driver accounts and read the audit log.

## Product Purpose

GoRide is a ride-hailing platform built as the SLIIT SE3022 case-study project. It runs one honest trip lifecycle: plan → fare estimate → match → driver en route → arrived → in progress → payment → rating. Success means a rider books and completes a trip without confusion, a driver can work a full shift from the dashboard, and an admin can keep the driver roster trustworthy.

## Positioning

A Sri Lanka-first ride app: fares in LKR shown upfront before booking, the local vehicle mix (tuk-tuk first), card or cash, and SOS plus emergency contacts on every trip. One rider, one driver, one trip, and never a double charge.

## Operating Context

- Next.js 16 / React 19 / Tailwind v4 / framer-motion web app, used mostly on mobile and also on desktop.
- Sign-in is OIDC (Asgardeo) through the goride-identity-auth gateway, proxied same-origin via `next.config.ts` rewrites (`/login`, `/logout`, `/api/*`).
- Microservices: trip-matching (fares, matching, SignalR), location (driver GPS), notification (Firebase push). An in-browser mock world (`NEXT_PUBLIC_API_MODE=mock`, default) simulates trips and drivers for demos.
- Roles: Rider, Driver, Admin. A new account chooses Rider or Driver once at `/onboarding/select-role`.

## Capabilities and Constraints

- Routes that must keep working: `/`, `/dashboard`, `/onboarding/select-role`, `/rider`, `/rider/ride`, `/rider/profile`, `/driver`, `/driver/profile`, `/admin/profile`.
- Rider ride phases: plan, select, review, searching, no_driver, en_route, arrived, in_progress, payment, paid, cancelled. Also pin-drop, stops, cancel reasons, SOS.
- Driver: availability toggle, live location, ride offers, trip actions, vehicle/licence profile.
- Admin: driver list with status changes, audit logs.
- Currency is LKR. The map is Leaflet. Raster tiles must not need an API key (CARTO now returns "API key required").
- Auth, API contracts, stores and mock world are product truth; the redesign changes presentation only.

## Brand Commitments

- Name: **GoRide**. Tagline lineage: "Your ride, on your terms."
- The user explicitly chose the **Waygo reference** look for the redesign: warm taxi-yellow plus charcoal/black, white cards, large rounded pill buttons with a circular arrow chip, bold friendly geometric sans. The previous green brand is retired.
- The landing hero adapts the user-supplied "Lumora" cinematic spec: crossfading background videos with a scene switcher, liquid-glass nav and inputs, a serif display headline, and a bottom stats row. It is re-themed for riding in Colombo with generated GoRide clips.

## Evidence on Hand

- Vehicle images: `public/vehicles/{car.png,bike.webp,tuk.webp}`. Logo SVGs: `public/brand/`.
- Seeded demo data (places, drivers, trips) lives in `src/lib/mock/seed.ts`.
- There are **no real usage numbers, ratings, testimonials or press**. The landing page shows product facts only (e.g., 4 ride types, upfront LKR fares, SOS on every trip, Greater Colombo coverage) and must never invent rider counts or satisfaction scores.

## Product Principles

1. Price before commitment: the fare is visible before a rider requests.
2. One glance tells you the trip state, so every phase has a clear headline and next action.
3. Safety is always one tap away (SOS, emergency contacts, verified drivers).
4. Mobile first: thumb-reachable actions, bottom sheets and bottom navigation.
5. Honest UI: no fake stats, no dead buttons; anything not wired is clearly labelled.

## Accessibility & Inclusion

WCAG 2.2 AA contrast for text (yellow is a fill, never small text on white), 44px touch targets, visible focus, and `prefers-reduced-motion` respected (the hero videos pause or crossfade instantly).
