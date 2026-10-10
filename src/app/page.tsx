import { Hero } from "@/components/landing/hero";

/**
 * Landing: one viewport, the back seat at golden hour. The hero crossfades four
 * city scenes behind a car window, with the booking pill in front.
 */
export default function Home() {
  return (
    <main className="min-w-0 overflow-x-clip bg-navy-900">
      <Hero />
    </main>
  );
}
