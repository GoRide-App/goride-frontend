"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { MapPin } from "lucide-react";
import { identityLoginUrl } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { CarWindow } from "./car-window";
import { LandingNav } from "./landing-nav";
import { PillLink } from "./pill-link";
import { SCENES } from "./scenes";

const CROSSFADE_MS = 1000;
const AUTO_ADVANCE_MS = 8000;

const FACTS = ["4 ride types", "Fares in LKR, upfront", "SOS on every trip", "Verified drivers"];

/** On a bright scene the near-clear glass gets a milky fill so charcoal copy keeps its contrast. */
const LIGHT_GLASS = { backgroundColor: "rgba(255,255,255,0.42)" } as const;

/** Entrance choreography: badge → headline lines → sub → booking pill → switcher, once. */
const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.11, delayChildren: 0.2 } },
};
const rise = {
  hidden: { opacity: 0, y: 18, filter: "blur(10px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.9, ease: [0.22, 1, 0.36, 1] as const },
  },
};

export function Hero() {
  const reduced = useReducedMotion() ?? false;
  const [active, setActive] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [userPicked, setUserPicked] = useState(false);
  const activeRef = useRef(0);
  const transitioningRef = useRef(false);
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const videos = useRef<(HTMLVideoElement | null)[]>([]);

  const go = useCallback((index: number, byUser: boolean) => {
    if (byUser) setUserPicked(true);
    if (transitioningRef.current || index === activeRef.current) return;
    transitioningRef.current = true;
    setIsTransitioning(true);
    activeRef.current = index;
    setActive(index);
    if (fadeTimer.current) clearTimeout(fadeTimer.current);
    fadeTimer.current = setTimeout(() => {
      transitioningRef.current = false;
      setIsTransitioning(false);
    }, CROSSFADE_MS);
  }, []);

  useEffect(
    () => () => {
      if (fadeTimer.current) clearTimeout(fadeTimer.current);
    },
    [],
  );

  // Auto-advance until the visitor picks a scene; never under reduced motion.
  useEffect(() => {
    if (userPicked || reduced) return;
    const id = setInterval(() => go((activeRef.current + 1) % SCENES.length, false), AUTO_ADVANCE_MS);
    return () => clearInterval(id);
  }, [userPicked, reduced, go]);

  // Only the active clip and the one queued next play; everything else (and hidden tabs) pauses.
  useEffect(() => {
    const sync = () => {
      const hidden = document.visibilityState === "hidden";
      videos.current.forEach((video, index) => {
        if (!video) return;
        const warm = index === active || index === (active + 1) % SCENES.length;
        if (warm && !reduced && !hidden) {
          if (video.preload !== "auto") video.preload = "auto";
          video.muted = true;
          const playing = video.play();
          if (playing) playing.catch(() => undefined);
        } else if (!video.paused) {
          video.pause();
        }
      });
    };
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, [active, reduced]);

  const scene = SCENES[active];
  const light = scene.tone === "light";

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    window.location.assign(identityLoginUrl("/rider"));
  };

  return (
    <section
      id="top"
      aria-labelledby="hero-title"
      className="relative h-[100svh] min-h-[640px] w-full overflow-hidden bg-black"
    >
      {/* z-0: four looping scenes, crossfaded by opacity */}
      <div className="absolute inset-0" aria-hidden="true">
        {SCENES.map((item, index) => (
          <video
            key={item.id}
            ref={(el) => {
              videos.current[index] = el;
            }}
            className={cn(
              "absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ease-in-out",
              index === active ? "opacity-100" : "opacity-0",
            )}
            src={item.src}
            poster={item.poster}
            muted
            loop
            playsInline
            autoPlay={index === 0 && !reduced}
            preload={index === 0 ? "auto" : "metadata"}
            disablePictureInPicture
            disableRemotePlayback
            tabIndex={-1}
          />
        ))}
      </div>

      {/* z-1: the back-seat window */}
      <CarWindow light={light} />

      {/* z-2: content */}
      <div
        className={cn(
          "relative z-[2] flex h-full flex-col transition-colors duration-700",
          light ? "text-ink" : "text-white",
        )}
      >
        <LandingNav />

        <motion.div
          variants={stagger}
          initial={reduced ? false : "hidden"}
          animate="show"
          className="flex flex-1 flex-col items-center justify-center px-5 text-center"
        >
          <h1
            id="hero-title"
            className="max-w-4xl font-display text-[2.6rem] leading-[1.05] tracking-[-0.01em] text-balance sm:text-6xl md:text-7xl lg:text-[5.5rem]"
          >
            <motion.span variants={rise} className="block">
              Your city,
            </motion.span>
            <motion.span variants={rise} className="block">
              on your{" "}
              <em
                className={cn(
                  "italic transition-colors duration-700",
                  light ? "text-brand-600" : "text-brand-400",
                )}
              >
                terms.
              </em>
            </motion.span>
          </h1>

          <motion.p
            variants={rise}
            className="mt-5 max-w-2xl text-[15px] leading-relaxed opacity-85 [text-wrap:pretty] sm:text-base"
          >
            Tuk, bike, car or van — see your fare in rupees before you book.
          </motion.p>

          <motion.form
            variants={rise}
            onSubmit={onSubmit}
            role="search"
            aria-label="Start a booking"
            style={light ? LIGHT_GLASS : undefined}
            className={cn(
              "liquid-glass mt-8 flex w-full max-w-[340px] items-center gap-2 rounded-full p-1.5 pl-4 transition-[background-color,box-shadow] duration-700 focus-within:outline-2 focus-within:outline-offset-[3px] focus-within:outline-current/70 sm:max-w-md",
              light && "shadow-[0_14px_40px_-18px_rgba(17,17,17,0.35)]",
            )}
          >
            <label htmlFor="where-to" className="sr-only">
              Where to?
            </label>
            <MapPin size={18} aria-hidden="true" className="shrink-0 opacity-75" />
            <input
              id="where-to"
              name="to"
              type="text"
              autoComplete="off"
              enterKeyHint="go"
              placeholder="Where to?"
              className="min-w-0 flex-1 bg-transparent py-2 text-[15px] placeholder:text-current placeholder:opacity-70 focus-visible:outline-none sm:text-base"
            />
            <PillLink href={identityLoginUrl("/rider")} size="sm">
              Book a ride
            </PillLink>
          </motion.form>

          <motion.div
            variants={rise}
            role="group"
            aria-label="Background scene"
            data-transitioning={isTransitioning || undefined}
            className="mt-8 flex flex-wrap items-center justify-center gap-x-1 text-xs font-medium data-[transitioning]:cursor-wait sm:text-sm"
          >
            {SCENES.map((item, index) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={index === active}
                onClick={() => go(index, true)}
                className={cn(
                  "relative min-h-11 px-3 py-2 transition-opacity duration-300 after:absolute after:inset-x-3 after:bottom-1.5 after:h-0.5 after:rounded-full after:bg-current after:transition-opacity after:duration-300 focus-visible:outline-[2.5px] focus-visible:outline-offset-[-2px] focus-visible:outline-current",
                  index === active ? "opacity-100 after:opacity-100" : "opacity-50 after:opacity-0 hover:opacity-80",
                )}
              >
                {item.label}
              </button>
            ))}
          </motion.div>
        </motion.div>

        <ul
          aria-label="Product facts"
          className="grid grid-cols-2 gap-x-6 gap-y-1 px-5 pb-5 text-center text-xs text-white/75 [text-shadow:0_1px_10px_rgba(0,0,0,0.5)] sm:flex sm:flex-wrap sm:items-center sm:justify-center sm:gap-x-3 sm:pb-6 sm:text-sm"
        >
          {FACTS.map((fact, index) => (
            <li key={fact} className="flex items-center justify-center gap-3">
              {index > 0 && (
                <span aria-hidden="true" className="hidden text-white/30 sm:inline">
                  |
                </span>
              )}
              {fact}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
