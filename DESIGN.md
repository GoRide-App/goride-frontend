---
name: GoRide
description: Sri Lanka-first ride-hailing. Taxi-yellow fills on charcoal and white, pill buttons with a round arrow chip.
colors:
  taxi-yellow: "#ffc21a"
  taxi-yellow-light: "#ffd84d"
  taxi-yellow-deep: "#f5b000"
  yellow-wash: "#fff3c4"
  yellow-mist: "#fffbeb"
  yellow-ink: "#7a5300"
  yellow-text: "#a26f00"
  captain-amber: "#f28c00"
  ink: "#111111"
  ink-2: "#2a2a2c"
  charcoal: "#161617"
  charcoal-deep: "#0e0e0f"
  charcoal-raised: "#1f1f21"
  muted: "#6e6e73"
  surface: "#ffffff"
  warm-ground: "#f5f5f3"
  warm-pressed: "#e9e9e6"
  hairline: "#ececea"
  chip-ring: "#dcdcd8"
  scroll-thumb: "#d6d6d2"
  success: "#16a34a"
  warning: "#f59e0b"
  danger: "#e5383b"
  info: "#2563eb"
typography:
  display:
    fontFamily: "Instrument Serif, ui-serif, Georgia, serif"
    fontSize: "clamp(2.6rem, 6vw, 5.5rem)"
    fontWeight: 400
    lineHeight: 1.05
    letterSpacing: "-0.01em"
  display-section:
    fontFamily: "Instrument Serif, ui-serif, Georgia, serif"
    fontSize: "clamp(2.875rem, 6vw, 4.25rem)"
    fontWeight: 400
    lineHeight: 0.98
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Poppins, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2.75rem, 4vw, 3.5rem)"
    fontWeight: 600
    lineHeight: 1.02
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Poppins, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.015em"
  title-sm:
    fontFamily: "Poppins, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "-0.01em"
  stat:
    fontFamily: "Poppins, ui-sans-serif, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-0.02em"
    fontFeature: "\"tnum\""
  body:
    fontFamily: "Poppins, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Poppins, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1
  caption:
    fontFamily: "Poppins, ui-sans-serif, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 500
    lineHeight: 1
rounded:
  chip-mark: "4px"
  field: "16px"
  tile: "16px"
  card: "24px"
  sheet: "28px"
  pill: "9999px"
spacing:
  page-phone: "16px"
  page-desktop: "24px"
  card: "20px"
  tabbar: "104px"
components:
  button-primary:
    backgroundColor: "{colors.taxi-yellow}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    typography: "{typography.label}"
    height: "48px"
    padding: "0 20px"
  button-primary-hover:
    backgroundColor: "{colors.taxi-yellow-light}"
  button-primary-active:
    backgroundColor: "{colors.taxi-yellow-deep}"
  button-dark:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    rounded: "{rounded.pill}"
    height: "48px"
    padding: "0 20px"
  button-dark-hover:
    backgroundColor: "{colors.charcoal-raised}"
  button-secondary:
    backgroundColor: "{colors.warm-ground}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    height: "48px"
    padding: "0 20px"
  button-secondary-hover:
    backgroundColor: "{colors.warm-pressed}"
  arrow-chip:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    rounded: "{rounded.pill}"
    size: "36px"
  card-light:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "{spacing.card}"
  card-dark:
    backgroundColor: "{colors.charcoal}"
    textColor: "{colors.surface}"
    rounded: "{rounded.card}"
    padding: "{spacing.card}"
  card-brand:
    backgroundColor: "{colors.taxi-yellow}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "{spacing.card}"
  input:
    backgroundColor: "{colors.warm-ground}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    height: "56px"
    padding: "0 16px"
  input-focus:
    backgroundColor: "{colors.surface}"
  chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    height: "44px"
    padding: "0 16px"
  chip-selected:
    backgroundColor: "{colors.taxi-yellow}"
    textColor: "{colors.ink}"
  badge-brand:
    backgroundColor: "{colors.yellow-wash}"
    textColor: "{colors.yellow-ink}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
  nav-rail:
    backgroundColor: "{colors.charcoal-deep}"
    textColor: "{colors.surface}"
    width: "248px"
  nav-rail-item-active:
    backgroundColor: "{colors.taxi-yellow}"
    textColor: "{colors.ink}"
    rounded: "{rounded.tile}"
    height: "48px"
  tab-bar:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
    padding: "8px"
  bottom-sheet:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.sheet}"
    padding: "0 20px 20px"
  toast:
    backgroundColor: "{colors.charcoal}"
    textColor: "{colors.surface}"
    rounded: "{rounded.pill}"
    padding: "8px"
---

# Design System: GoRide

## Overview

**Creative North Star: "The Back Seat at Golden Hour"**

GoRide is a taxi-yellow world: warm yellow is a fill you can press, charcoal is the frame you sit inside, and white cards on a warm grey ground carry everything you read. The landing is a single cinematic viewport with no scroll (Colombo footage behind a car-window frame, liquid-glass pills, an Instrument Serif headline with one yellow italic word); every signed-in screen is the same world in operating mode, map-first, with a charcoal rail on desktop and a floating white tab bar on phones.

Density is relaxed and thumb-led. Controls are big (48-56px), corners are generous (16-28px), and every action is a pill. The single recurring signature is the round arrow chip riding the trailing edge of a pill button, and the single recurring motif is the route: a ringed pickup, a dotted connector and a square yellow destination, echoed by the ink-and-yellow route line on the map.

Depth is soft and long: warm-tinted ambient shadows lift white cards off the warm ground; dark surfaces sit flat. The previous green brand is retired.

**Key Characteristics:**
- Taxi yellow as a fill colour for the one primary action per screen, selected states and active nav.
- Charcoal panels (rail, dark cards, toasts, sign-in) against white cards on warm grey.
- Pills everywhere: buttons, chips, badges, segmented controls, the booking input.
- The round arrow chip at the trailing edge of primary pills.
- Poppins for everything you touch; Instrument Serif only for the landing headline and menu, and the onboarding headline.
- Pickup-ring / dotted-rail / yellow-square route mark as the recurring motif.

## Colors

A warm two-voice palette: taxi yellow and charcoal, with white and warm greys doing the reading work.

### Primary
- **Taxi Yellow** (taxi-yellow): the brand fill. Primary buttons, selected chips and segments, active rail item and active tab tile, avatar initials ground, the destination square of the route mark, brand cards and the go-online card when online. Hover lightens to **Taxi Yellow Light**, press deepens to **Taxi Yellow Deep**.
- **Yellow Wash / Yellow Mist** (yellow-wash, yellow-mist): tinted grounds for brand badges and empty-state halos (wash); the hover tint on the white landing pills and Sign in (mist).
- **Yellow Ink / Yellow Text** (yellow-ink, yellow-text): the only yellows allowed as text on light grounds (brand badge text, required-field asterisk).

### Secondary
- **Captain Amber** (captain-amber): the driver accent, same family pushed warmer. Fill only, always with ink text: the driver button, driver stat tiles and the driver availability switch, so the captain's surfaces read as GoRide but distinct from the rider's.

### Neutral
- **Ink** (ink): all body text on light, the dark pill button, the arrow chip, the pickup ring and map route casing, the focus outline.
- **Charcoal / Charcoal Deep / Charcoal Raised** (charcoal, charcoal-deep, charcoal-raised): dark cards, toasts, fare summaries and the landing page ground (charcoal); the desktop rail and car-window frame (charcoal-deep); dark-button hover (charcoal-raised).
- **Ink 2** (ink-2): secondary text inside neutral badges.
- **Muted** (muted): descriptions, hints, inactive tab labels, field labels over values.
- **Surface** (surface): cards, sheets, dialogs, headers, the tab bar.
- **Warm Ground** (warm-ground): the app background, input fills, secondary buttons, hover rows.
- **Warm Pressed** (warm-pressed): pressed states, the map's loading ground, skeleton highlight.
- **Hairline** (hairline): dividers between route rows, header borders, list separators.
- **Chip Ring** (chip-ring): the 1px inset ring that outlines unselected chips.
- **Scroll Thumb** (scroll-thumb): the thin scrollbar thumb on a transparent track.

### Semantic
- **Success, Warning, Danger, Info** (success, warning, danger, info): status dots and tinted badges. Danger also fills the SOS control and the SOS map marker.

### Named Rules
**The Yellow Is a Fill Rule.** Taxi yellow and captain amber are surfaces, never small text on white. Text on yellow or amber is ink; yellow text on light grounds uses yellow-text or yellow-ink only. On charcoal, yellow may be text or icon colour (rail role badge, ETA unit label, chip icons).

**The One Yellow Action Rule.** Each screen carries one yellow primary action; everything else is dark, white, secondary grey or ghost.

## Typography

**Display Font:** Instrument Serif (with ui-serif, Georgia)
**Body Font:** Poppins (with ui-sans-serif, system-ui, Segoe UI)

**Character:** A soft editorial serif for the few moments that persuade, a friendly geometric sans for everything that operates. The serif never appears on a control.

### Hierarchy
- **Display** (400, 2.6rem to 5.5rem, 1.05): the landing hero headline, two lines, with exactly one italic word in taxi yellow (deepened to yellow #d69500 over bright footage).
- **Display Section** (400, 46px to 68px, 0.98, -0.02em): the onboarding role-select headline. The landing's mobile menu links use the same face at 2rem.
- **Headline** (600, 44-56px, 1.02, -0.03em): sans display moments inside the app: the auth brand panel and dashboard welcome greeting.
- **Title** (600, 20px, -0.015em): sheet and dialog headers; shell headers run at 17px.
- **Title Small** (600, 15px, -0.01em): section titles, list-row titles, route values, empty-state titles.
- **Stat** (600, 28px, tabular): stat tiles, fares, ETAs (22px in the ETA tile).
- **Body** (400, 15px, relaxed): paragraphs; sub-copy caps at about 30-36rem.
- **Label** (600, 13px): field labels, section actions, button text at small sizes (buttons run 13/14/15px by size).
- **Caption** (500, 11px): labels above route values, tab labels, attribution.

### Named Rules
**The Serif Stays Outside Rule.** Instrument Serif appears only on the landing (headline and mobile menu links) and the onboarding headline. Signed-in operating screens are Poppins only.

**The Numbers Hold Still Rule.** Fares, ETAs, counts and ratings are tabular so live values never shift layout.

## Layout

Signed-in screens use one shell. From 768px a charcoal rail sits on the left (84px icon-only, 248px labelled from 1024px) beside a white 64px header; content scrolls in a centred column capped at 1100px with 24px padding. On phones the header is a 56px white bar (or floating white pills over a map), and a floating white tab bar sits 16px from each edge and at least 12px above the safe area; content reserves 104px below for it.

Rider and driver ride screens are map-split: full-bleed map with a right-hand panel on desktop and a draggable bottom sheet (max 88% height, capped at 640px wide) on phones. Cards pad 20px; lists stack with 6-12px gaps; section titles sit 28px above their content.

The landing is one viewport and nothing else: a 100svh hero (min 640px tall) on a charcoal page ground, with no sections below and no scroll. Top bar with the wordmark left and the nav pill right; a centred column with the headline, a one-line sub, the booking pill and the scene switcher; a facts row along the bottom edge split by pipes.

Scrollbars are thin (6px) with a warm-grey thumb on a transparent track; horizontal chip rows hide theirs.

## Elevation & Depth

A hybrid: light surfaces lift with soft, long, ink-tinted shadows; dark surfaces sit flat and separate by tone. Shadows are never hard or offset. Yellow surfaces may carry a warm yellow glow instead of a grey shadow.

### Shadow Vocabulary
- **Card** (`0 1px 2px rgb(17 17 17 / 0.04), 0 12px 32px -16px rgb(17 17 17 / 0.14)`): resting white cards, chips, white buttons.
- **Float** (`0 18px 40px -12px rgb(17 17 17 / 0.28)`): tab bar, dialogs, toasts, floating map controls, interactive-card hover.
- **Sheet** (`0 -16px 48px -16px rgb(17 17 17 / 0.22)`): bottom sheets and docked panels, cast upward.
- **Glow** (`0 10px 30px -8px rgb(255 194 26 / 0.55)`): yellow surfaces that are "on" (go-online card when online, the selected role card in onboarding).
- **Press** (`inset 0 2px 6px rgb(17 17 17 / 0.14)`): pressed surfaces.
- **Rail** (`inset -1px 0 0 rgb(255 255 255 / 0.06)`): the rail's inner edge.

### Named Rules
**The Dark Is Flat Rule.** Charcoal surfaces take no drop shadow; their contrast with the ground is the depth.

**The Liquid Glass Rule.** Liquid glass (near-clear fill, 4px blur, a 1.4px gradient hairline) belongs on photographic or dark grounds only. Over bright footage it gains a milky white fill (42%) so charcoal copy keeps contrast.

## Shapes

Everything is rounded and nothing is sharp. Interactive elements are full pills (buttons, chips, badges, segmented controls, booking input, landing nav). Containers step up by size: 16px for fields, icon tiles, list rows and rail items; 24px for cards and the tab bar; 28px for sheets and dialogs. The active tab is a 14px rounded square. The only small radius is the 4-5px destination square in the route mark. The landing's car-window opening repeats the language at scale: three modest corners (20-36px) and one wide top-right sweep (96-240px), framed in charcoal-deep. Borders are rare: hairline dividers and 1px ink/line rings on route cards; outline buttons use a 2px inset ink ring.

## Components

### Buttons
Big, soft and confident pills that compress slightly when pressed.
- **Shape:** full pill; heights 40 / 48 / 56px (sm / md / lg), full-width by default.
- **Primary:** taxi yellow with ink text, semibold, -0.01em tracking.
- **Hover / Focus / Active:** hover lightens, active deepens and scales to 0.97 on the spring curve (200ms); focus shows a 2.5px ink outline offset 2px (yellow on the dark button).
- **Arrow chip:** an optional round chip (28 / 36 / 44px) sits 6px inside the trailing edge carrying a bold arrow: ink chip on yellow, white and grey buttons; yellow chip on the dark button; white chip on danger. On landing pills the chip nudges 2px right on hover.
- **Other variants:** dark (ink), secondary (warm ground), white (with card shadow), outline (2px inset ink ring), ghost, danger (red).

### Chips
- **Style:** 44px (36px small) pills, semibold; unselected are white with a 1px inset chip-ring outline and no shadow.
- **State:** selected turns taxi yellow with a small yellow glow. Rows scroll horizontally with gentle snap and no visible scrollbar.

### Segmented Control
A warm-ground pill track with 4px inset; the selected segment is a yellow pill that slides between options on the snappy spring.

### Cards / Containers
- **Corner Style:** 24px.
- **Background:** white (light), charcoal (dark), taxi yellow (brand), warm ground (muted).
- **Shadow Strategy:** card shadow on light only; interactive cards rise to float on hover and press to 0.99.
- **Internal Padding:** 20px.
- **Stat tiles:** label top-left, a 36px round icon chip top-right, a 28px tabular value below.

### Inputs / Fields
- **Style:** 56px tall, warm-ground fill, no stroke, 16px radius, 15px text; label 13px semibold above.
- **Focus:** fill turns white with a 2px ink ring. On dark grounds the field is 7% white with a faint ring and focuses to a yellow ring.
- **Error:** 12px danger text below, announced as an alert.

### Navigation
- **Desktop rail:** charcoal-deep, logo top, role badge (yellow pill, uppercase 10px, 0.12em tracking), 48px items with 16px radius; inactive is 65% white, active is a yellow tile with ink text and heavier icon stroke; account card at the foot.
- **Phone tab bar:** floating white 24px-radius bar with float shadow; active tab gets a 44px yellow rounded square behind the icon that glides between tabs; labels are 11px semibold, muted when inactive.
- **Landing nav:** a liquid-glass pill holding two sign-in destinations, "Book a ride" and "Drive with GoRide", ending in a solid white "Sign in" pill. On phones a round glass button opens a full-screen dimmed menu listing the same two links in Instrument Serif (2rem), with a white "Sign in" pill at the bottom.

### Bottom Sheet
White, 28px top corners, upward sheet shadow, a 40x5px ink/15 handle, springs in and out (stiffness 420). Headers are 20px semibold titles with a muted 13px description and a 40px round close button.

### Route Mark (signature)
A vertical rail: a 12px white dot ringed 3px in ink for pickup, a dotted 2px ink/35 connector (dashed while planning), small ink dots for stops, and a 14px yellow square ringed in ink for the destination. In route cards each stop is a caption label over a 15px semibold value, rows split by hairlines. On the map the same grammar holds: a white pickup puck ringed in ink, ink route lines with a thin yellow core, yellow driver pucks, a red SOS marker; tiles are Esri light grey.

### SOS Control
The ride screen's floating SOS: a 56px danger-red disc with a 4px white ring and float shadow, carrying a siren icon, with a small white "SOS" chip (10px bold, danger text) beneath. It is held for 1.2s to send (Enter or Space too); while held the disc shows HOLD and a progress ring, and when armed it pulses and the chip reads SENT.

### Toasts
Charcoal pills (22px radius when they carry a description) with a 36px round tonal icon chip and float shadow.

## Do's and Don'ts

### Do:
- **Do** put ink text on captain amber, exactly as on taxi yellow.
- **Do** give each screen exactly one taxi-yellow primary action, with ink text and, where it leads somewhere, the round arrow chip.
- **Do** set white cards (24px radius, card shadow) on the warm-ground background; reserve charcoal for frames (rail, toasts, summaries, dark cards).
- **Do** use pills for every interactive element and 16 / 24 / 28px radii for containers by size.
- **Do** use the pickup ring, dotted rail and yellow destination square whenever a route is shown.
- **Do** keep fares, ETAs and counts tabular, and fares in LKR.
- **Do** move with springs for touched things (snappy 480/34) and short ease-out fades (180-240ms) for appearing things; fall back to opacity only under reduced motion.
- **Do** use the 2.5px ink focus outline (yellow or white on dark grounds).

### Don't:
- **Don't** set small text in taxi yellow on white or light grounds; use yellow-text or yellow-ink.
- **Don't** use Instrument Serif in signed-in operating screens or on any control.
- **Don't** put liquid glass on plain light surfaces; it belongs over footage or dark grounds.
- **Don't** use hard or offset shadows; depth is soft, long and ink-tinted, or a yellow glow on yellow.
- **Don't** drop a shadow under charcoal surfaces.
- **Don't** bring back the retired green brand.
