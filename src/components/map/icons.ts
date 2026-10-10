import L from "leaflet";
import type { VehicleTypeCode } from "@/types";

/**
 * Map markers, drawn in the palette: charcoal for people and places, taxi
 * yellow for the destination and the matched vehicle. Everything is an SVG or
 * CSS shape so it stays crisp at any zoom. Keyframes (`gr-*`) live in
 * globals.css outside @theme so they always exist.
 */
const INK = "#111111";
const YELLOW = "#FFC21A";
const WHITE = "#ffffff";
const SHADOW = "0 2px 8px rgba(17,17,17,.28)";

/** Pickup: white disc with a thick charcoal ring. */
const SETTLE = "animation:gr-pin-settle .45s cubic-bezier(.22,1,.36,1) both";

export const pickupIcon = L.divIcon({
    className: "",
    html: `<div style="width:18px;height:18px;border-radius:9999px;background:${WHITE};border:4px solid ${INK};box-shadow:${SHADOW};${SETTLE}"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
});

/** A teardrop pin, 30×38, anchored at its tip. */
function pinSvg(fill: string, dot: string) {
    return `<svg width="30" height="38" viewBox="0 0 30 38" xmlns="http://www.w3.org/2000/svg" style="display:block;filter:drop-shadow(0 4px 6px rgba(17,17,17,.3))">
    <path d="M15 1C7.3 1 1 7.3 1 15c0 9.6 11.4 20.4 13.2 22.1a1.1 1.1 0 0 0 1.6 0C17.6 35.4 29 24.6 29 15 29 7.3 22.7 1 15 1Z" fill="${fill}" stroke="${INK}" stroke-width="2"/>
    <circle cx="15" cy="15" r="5" fill="${dot}"/>
  </svg>`;
}

/** Destination: yellow pin with a charcoal centre. */
export const destinationIcon = L.divIcon({
    className: "",
    html: `<div style="${SETTLE}">${pinSvg(YELLOW, INK)}</div>`,
    iconSize: [30, 38],
    iconAnchor: [15, 37],
});

/** Intermediate stop: small charcoal dot. */
export const stopIcon = L.divIcon({
    className: "",
    html: `<div style="width:12px;height:12px;border-radius:9999px;background:${INK};border:2px solid ${WHITE};box-shadow:${SHADOW};${SETTLE}"></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
});

/** Rider's own position: charcoal dot, white ring, soft pulse. */
export const userIcon = L.divIcon({
    className: "",
    html: `<div style="position:relative;width:22px;height:22px">
    <span style="position:absolute;inset:-14px;border-radius:9999px;background:rgba(17,17,17,.14);animation:gr-radar 2.4s cubic-bezier(.22,1,.36,1) infinite"></span>
    <span style="position:absolute;inset:0;border-radius:9999px;background:${INK};border:3px solid ${WHITE};box-shadow:0 2px 8px rgba(17,17,17,.35)"></span>
  </div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
});

/** Pickup with yellow radar waves while matching a driver. */
export const searchingIcon = L.divIcon({
    className: "",
    html: `<div style="position:relative;width:18px;height:18px">
    <span style="position:absolute;inset:-72px;border-radius:9999px;background:rgba(255,194,26,.26);animation:gr-radar 2s cubic-bezier(.22,1,.36,1) infinite"></span>
    <span style="position:absolute;inset:-72px;border-radius:9999px;background:rgba(255,194,26,.26);animation:gr-radar 2s cubic-bezier(.22,1,.36,1) .7s infinite"></span>
    <span style="position:absolute;inset:0;border-radius:9999px;background:${WHITE};border:4px solid ${INK};box-shadow:${SHADOW}"></span>
  </div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
});

/* ------------------------------------------------------------------ */
/* Vehicles                                                             */
/* ------------------------------------------------------------------ */

/** Lucide-weight glyphs (24-grid, 2px stroke) so markers match the icon set. */
const GLYPH: Record<string, string> = {
    CAR: '<path d="m21 8-2 2-1.5-3.7A2 2 0 0 0 15.646 5H8.4a2 2 0 0 0-1.903 1.257L5 10 3 8"/><path d="M7 14h.01"/><path d="M17 14h.01"/><rect width="18" height="8" x="3" y="10" rx="2"/><path d="M5 18v2"/><path d="M19 18v2"/>',
    BIKE: '<circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/>',
    TUK: '<path d="M4 16V9.5A2.5 2.5 0 0 1 6.5 7H14l4.5 4.5H20a1 1 0 0 1 1 1V16"/><path d="M6.5 7 7.5 4.5H13"/><path d="M14 7v4.5H4"/><circle cx="7.5" cy="17" r="2"/><circle cx="16.5" cy="17" r="2"/><path d="M9.5 17h5"/>',
};

function glyphFor(code: VehicleTypeCode | string) {
    const key = code === "XL" ? "CAR" : code === "TUKTUK" ? "TUK" : code;
    return GLYPH[key] ?? GLYPH.CAR;
}

export function vehicleGlyphSvg(code: VehicleTypeCode | string, px: number, color = INK) {
    return `<svg width="${px}" height="${px}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${glyphFor(code)}</svg>`;
}

const vehicleIconCache = new Map<string, L.DivIcon>();

/**
 * Vehicle puck. Active (matched driver): yellow circle, white ring, charcoal
 * glyph and a heading tick that rotates with the bearing. Idle: white puck with
 * a yellow ring; `dim` fades it back.
 */
export function vehicleIcon(code: VehicleTypeCode, opts?: { heading?: number; active?: boolean; dim?: boolean }) {
    const heading = Math.round((opts?.heading ?? 0) / 10) * 10;
    const key = `${code}|${heading}|${opts?.active ? 1 : 0}|${opts?.dim ? 1 : 0}`;
    const cached = vehicleIconCache.get(key);
    if (cached) return cached;

    const size = opts?.active ? 44 : 32;
    const glyph = vehicleGlyphSvg(code, Math.round(size * 0.52));
    const surface = opts?.active
        ? `background:${YELLOW};border:3px solid ${WHITE};box-shadow:0 10px 22px -8px rgba(17,17,17,.5)`
        : `background:${WHITE};border:2px solid ${YELLOW};box-shadow:0 3px 10px rgba(17,17,17,.2)`;
    const tick = opts?.active
        ? `<span style="position:absolute;left:50%;top:50%;width:0;height:0;transform:translate(-50%,-50%) rotate(${heading}deg) translateY(-${size / 2 + 1}px);border-left:6px solid transparent;border-right:6px solid transparent;border-bottom:9px solid ${INK}"></span>`
        : "";
    const html = `<div class="goride-vehicle" style="position:relative;width:${size}px;height:${size}px;opacity:${opts?.dim ? 0.65 : 1}">
    <span style="position:absolute;inset:0;border-radius:9999px;display:flex;align-items:center;justify-content:center;${surface}">${glyph}</span>
    ${tick}
  </div>`;
    const icon = L.divIcon({ className: "goride-smooth", html, iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
    vehicleIconCache.set(key, icon);
    return icon;
}

/** SOS incident marker for the admin map. */
export const sosIcon = L.divIcon({
    className: "",
    html: `<div style="position:relative;width:26px;height:26px">
    <span style="position:absolute;inset:-16px;border-radius:9999px;background:rgba(229,56,59,.25);animation:gr-radar 1.6s ease-out infinite"></span>
    <span style="position:absolute;inset:0;border-radius:9999px;background:#e5383b;border:3px solid ${WHITE};box-shadow:0 2px 10px rgba(17,17,17,.35);display:flex;align-items:center;justify-content:center;color:${WHITE};font:700 12px/1 Poppins,sans-serif">!</span>
  </div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
});

/** The pin-drop crosshair markup (shared by MapView). */
export function pinDropHtml() {
    return pinSvg(YELLOW, INK);
}
