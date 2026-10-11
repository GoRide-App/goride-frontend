/**
 * Hero background scenes. One config so clips can be swapped without touching
 * the hero. Files live in public/landing/scenes/ (8.5s seamless H.264 loops,
 * no audio, 1280px wide, plus a matching poster JPG); provenance and licences
 * are in public/landing/scenes/CREDITS.md.
 *
 * `tone` drives the hero copy colour: "light" scenes switch the centre column
 * to charcoal so it stays legible over bright footage.
 */
export type SceneTone = "light" | "dark";

export interface Scene {
  id: string;
  /** Scene-switcher label */
  label: string;
  src: string;
  poster: string;
  tone: SceneTone;
  credit: {
    title: string;
    author: string;
    /** Source page URL */
    source: string;
    licence: string;
  };
}

export const SCENES: Scene[] = [
  {
    id: "golden",
    label: "Golden hour",
    src: "/landing/scenes/golden.mp4",
    poster: "/landing/scenes/golden.jpg",
    tone: "dark",
    credit: {
      title: "Serene Sunset Drive in Colombo Port City",
      author: "Kushan Shamika",
      source: "https://www.pexels.com/video/serene-sunset-drive-in-colombo-port-city-29344277/",
      licence: "Pexels License",
    },
  },
  {
    id: "night",
    label: "City lights",
    src: "/landing/scenes/night.mp4",
    poster: "/landing/scenes/night.jpg",
    tone: "dark",
    credit: {
      title: "Riding the Tuk Tuk Public Transportation in Colombo Sri Lanka",
      author: "Oshada Geeth (OGEE)",
      source: "https://www.pexels.com/video/riding-the-tuk-tuk-public-transportation-in-colombo-sri-lanka-3674866/",
      licence: "Pexels License",
    },
  },
  {
    id: "rain",
    label: "Monsoon",
    src: "/landing/scenes/rain.mp4",
    poster: "/landing/scenes/rain.jpg",
    tone: "dark",
    credit: {
      title: "Blurred City Lights Behind Rainy Window",
      author: "Polat Eyyüp Albayrak",
      source: "https://www.pexels.com/video/blurred-city-lights-behind-rainy-window-31042229/",
      licence: "Pexels License",
    },
  },
  {
    id: "morning",
    label: "Morning",
    src: "/landing/scenes/morning.mp4",
    poster: "/landing/scenes/morning.jpg",
    tone: "light",
    credit: {
      title: "Vibrant Tuk-Tuk Ride Through City Streets",
      author: "Mytho Digital",
      source: "https://www.pexels.com/video/vibrant-tuk-tuk-ride-through-city-streets-39209300/",
      licence: "Pexels License",
    },
  },
];
