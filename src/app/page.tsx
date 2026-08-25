import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Car, MapPin, ShieldCheck, Wallet } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ROUTES } from "@/lib/constants";

const FEATURES = [
  { icon: Wallet, title: "Upfront fares", body: "See the price in LKR before you book — card or cash, no surprises." },
  { icon: MapPin, title: "Live tracking", body: "Follow your driver on the map with position updates under 5 seconds." },
  { icon: ShieldCheck, title: "Safety built in", body: "SOS, emergency contacts and verified drivers on every trip." },
];

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col bg-navy-950 text-white">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-6">
        <Logo variant="white" height={30} priority />
        <nav className="flex items-center gap-2">
          <Link
            href={ROUTES.login}
            className="rounded-lg px-4 py-2.5 text-sm font-semibold text-white/80 transition-colors hover:text-white"
          >
            Sign in
          </Link>
          <Link
            href={ROUTES.signup}
            className="rounded-lg bg-brand-400 px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-brand-300"
          >
            Sign up
          </Link>
        </nav>
      </header>

      <main className="relative mx-auto w-full max-w-6xl flex-1 px-5">
        <Image
          src="/illustrations/map.png"
          alt=""
          fill
          sizes="100vw"
          className="pointer-events-none select-none object-cover opacity-[0.08] blur-[2px] mix-blend-screen"
          priority
        />
        <div className="pointer-events-none absolute -right-40 top-0 h-[520px] w-[520px] rounded-full bg-brand-400/20 blur-3xl" />

        <div className="relative grid items-center gap-12 py-12 lg:grid-cols-2 lg:py-20">
          <div>
            <span className="inline-flex rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white/70">
              Sri Lanka
            </span>
            <h1 className="mt-5 text-4xl font-bold leading-[1.1] tracking-tight text-balance lg:text-6xl">
              Your ride, on your terms.
            </h1>
            <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-white/70">
              One honest trip lifecycle: registration → matching → tracking → payment → rating. One rider, one driver,
              one trip — never two drivers on one ride, never a payment charged twice.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href={ROUTES.signup}
                className="inline-flex items-center gap-2 rounded-xl bg-brand-400 px-5 py-3.5 text-[15px] font-semibold text-ink transition-colors hover:bg-brand-300"
              >
                Create an account
                <ArrowRight size={18} />
              </Link>
              <Link
                href={`${ROUTES.signup}?role=Driver`}
                className="inline-flex items-center gap-2 rounded-xl bg-driver-500 px-5 py-3.5 text-[15px] font-semibold text-white transition-colors hover:bg-driver-400"
              >
                <Car size={18} />
                Drive with GoRide
              </Link>
            </div>

            <p className="mt-4 text-xs text-white/50">
              Already with us?{" "}
              <Link href={ROUTES.login} className="font-semibold text-white underline-offset-2 hover:underline">
                Sign in
              </Link>{" "}
              — demo accounts are on the login page.
            </p>
          </div>

          <ul className="flex flex-col gap-3">
            {FEATURES.map((f) => (
              <li key={f.title} className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur-sm">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-400/15 text-brand-300">
                  <f.icon size={18} />
                </span>
                <span>
                  <span className="block text-sm font-semibold">{f.title}</span>
                  <span className="mt-1 block text-xs leading-relaxed text-white/60">{f.body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </main>

      <footer className="relative mx-auto w-full max-w-6xl px-5 py-8 text-[11px] text-white/40">
        SE3022 · Case Study Project — four microservices, one gateway, one honest trip.
      </footer>
    </div>
  );
}
