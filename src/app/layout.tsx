import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

/** Poppins (the UI typeface), self-hosted so builds never depend on Google Fonts being reachable. */
const poppins = localFont({
  variable: "--font-poppins",
  display: "swap",
  src: [
    { path: "../fonts/Poppins-300.woff2", weight: "300", style: "normal" },
    { path: "../fonts/Poppins-400.woff2", weight: "400", style: "normal" },
    { path: "../fonts/Poppins-500.woff2", weight: "500", style: "normal" },
    { path: "../fonts/Poppins-600.woff2", weight: "600", style: "normal" },
    { path: "../fonts/Poppins-700.woff2", weight: "700", style: "normal" },
    { path: "../fonts/Poppins-800.woff2", weight: "800", style: "normal" },
  ],
});

/** Instrument Serif: the landing hero's display face (Lumora spec), self-hosted for the same reason. */
const instrument = localFont({
  variable: "--font-instrument",
  display: "swap",
  src: [
    { path: "../fonts/InstrumentSerif-Regular.woff2", weight: "400", style: "normal" },
    { path: "../fonts/InstrumentSerif-Italic.woff2", weight: "400", style: "italic" },
  ],
});

export const metadata: Metadata = {
  title: { default: "GoRide — Your ride, on your terms", template: "%s · GoRide" },
  description:
    "GoRide is a modular, event-driven ride-hailing platform for Sri Lanka: upfront fares, live tracking, card or cash, and SOS safety built in.",
  applicationName: "GoRide",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#ffc21a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${poppins.variable} ${instrument.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
