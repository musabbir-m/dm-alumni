'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { ArrowRight, ChevronLeft, ChevronRight, Users, Waves, Sparkles } from 'lucide-react';
import { batches } from '@/data/batches';

const AUTOPLAY_MS = 4500;

export default function Hero() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const goTo = useCallback((idx: number) => {
    setActive((idx + batches.length) % batches.length);
  }, []);

  const next = useCallback(() => goTo(active + 1), [active, goTo]);
  const prev = useCallback(() => goTo(active - 1), [active, goTo]);

  useEffect(() => {
    if (paused) return;
    timerRef.current = setInterval(() => {
      setActive((p) => (p + 1) % batches.length);
    }, AUTOPLAY_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [paused]);

  return (
    <section
      id="top"
      className="relative min-h-screen w-full overflow-hidden bg-gradient-to-br from-ocean-50 via-white to-reef-50 dark:from-ocean-950 dark:via-ocean-900 dark:to-reef-950"
    >
      {/* Animated aurora orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 top-1/4 h-[500px] w-[500px] rounded-full bg-ocean-300/25 blur-[120px] animate-aurora dark:bg-ocean-500/15" />
        <div className="absolute -right-20 top-10 h-[400px] w-[400px] rounded-full bg-reef-300/20 blur-[100px] animate-aurora-slow dark:bg-reef-500/15" />
        <div className="absolute bottom-0 left-1/3 h-[350px] w-[350px] rounded-full bg-ocean-200/20 blur-[100px] animate-aurora dark:bg-ocean-400/10" style={{ animationDelay: '3s' }} />
      </div>

      {/* Grid overlay */}
      <div className="absolute inset-0 bg-grid opacity-40 dark:opacity-30" />

      {/* Decorative wave SVG at bottom */}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-20">
        <svg
          viewBox="0 0 1440 120"
          fill="none"
          preserveAspectRatio="none"
          className="h-[60px] w-full sm:h-[90px] md:h-[120px]"
        >
          <path
            d="M0 60 C 240 100, 480 20, 720 50 C 960 80, 1200 110, 1440 60 L 1440 120 L 0 120 Z"
            className="fill-[#cff4ff] dark:fill-[#042d40]"
            fillOpacity="0.9"
          />
          <path
            d="M0 80 C 200 50, 500 110, 760 80 C 1020 50, 1240 100, 1440 80 L 1440 120 L 0 120 Z"
            className="fill-[#a4e9ff] dark:fill-[#04302f]"
          />
        </svg>
      </div>

      {/* Content — split layout */}
      <div className="relative z-10 mx-auto flex min-h-screen max-w-7xl flex-col items-center gap-12 px-5 pb-24 pt-28 sm:px-8 lg:flex-row lg:gap-16 lg:pb-32">
        {/* Left: text */}
        <div className="flex-1 max-w-2xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-ocean-200/60 bg-white/60 px-4 py-1.5 backdrop-blur-md animate-fade-in dark:border-ocean-400/30 dark:bg-ocean-500/10">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-reef-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-reef-500 dark:bg-reef-400" />
            </span>
            <span className="text-xs font-semibold tracking-wide text-ocean-700 dark:text-ocean-100">
              Disaster Management Students&apos; Alumni Association
            </span>
          </div>

          <h1 className="font-display text-4xl font-extrabold leading-[1.05] tracking-tightest text-ocean-900 text-balance animate-fade-up dark:text-white sm:text-5xl lg:text-6xl xl:text-7xl">
            Resilience in
            <span className="block text-gradient">
              every wave
            </span>
          </h1>

          <p
            className="mt-6 max-w-xl text-base leading-relaxed text-ocean-700/80 animate-fade-up dark:text-ocean-100/80 sm:text-lg"
            style={{ animationDelay: '0.15s', animationFillMode: 'both' }}
          >
            We are the graduates of Disaster Management — a network of
            responders, researchers, and community leaders building a safer,
            more prepared world, one cohort at a time.
          </p>

          <div
            className="mt-8 flex flex-col gap-3 animate-fade-up sm:flex-row sm:items-center"
            style={{ animationDelay: '0.3s', animationFillMode: 'both' }}
          >
            <Link
              href="/register"
              className="group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-ocean-500 to-reef-500 px-6 py-3.5 text-sm font-semibold text-white shadow-xl shadow-ocean-400/40 transition-all hover:shadow-reef-400/40 hover:brightness-110 dark:from-ocean-400 dark:to-reef-500 dark:text-ocean-950 dark:shadow-ocean-950/50"
            >
              <span className="relative z-10">Become a Member</span>
              <ArrowRight className="relative z-10 h-4 w-4 transition-transform group-hover:translate-x-1" />
              <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
            </Link>
            <a
              href="#about"
              className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-ocean-300 bg-white/60 px-6 py-3.5 text-sm font-semibold text-ocean-700 backdrop-blur-md transition-all hover:bg-white hover:border-ocean-400 hover:shadow-lg hover:shadow-ocean-200/30 dark:border-ocean-300/30 dark:bg-ocean-500/10 dark:text-white dark:hover:border-ocean-300/50 dark:hover:bg-ocean-500/20 dark:hover:shadow-transparent"
            >
              Our Story
            </a>
          </div>

          {/* Stats row */}
          <div
            className="mt-10 flex flex-wrap items-center gap-8 animate-fade-up"
            style={{ animationDelay: '0.4s', animationFillMode: 'both' }}
          >
            {[
              { value: '6', label: 'Cohorts' },
              { value: '379', label: 'Alumni' },
              { value: '24', label: 'Countries' },
            ].map((stat, i) => (
              <div key={stat.label} className="group">
                <p className="font-display text-2xl font-bold text-gradient transition-transform group-hover:scale-110">{stat.value}</p>
                <p className="text-xs font-medium tracking-wide text-ocean-400 dark:text-ocean-300/60">{stat.label}</p>
                {i < 2 && <div className="mt-1 h-0.5 w-0 bg-gradient-to-r from-ocean-400 to-reef-400 transition-all duration-500 group-hover:w-full" />}
              </div>
            ))}
          </div>
        </div>

        {/* Right: batch carousel side panel */}
        <div
          className="w-full max-w-md animate-fade-up lg:w-[44%] lg:max-w-none lg:flex-1"
          style={{ animationDelay: '0.35s', animationFillMode: 'both' }}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          <div className="relative overflow-hidden rounded-3xl border border-white/40 bg-white/30 shadow-2xl shadow-ocean-300/30 backdrop-blur-md dark:border-ocean-300/20 dark:bg-ocean-950/40 dark:shadow-ocean-950/60 dark:backdrop-blur-xl">
            {/* Image stack — crossfade */}
            <div className="relative aspect-[4/5] overflow-hidden sm:aspect-[3/4] lg:aspect-[5/6]">
              {batches.map((batch, i) => (
                <div
                  key={batch.year}
                  className={`absolute inset-0 transition-all duration-[1400ms] ease-out ${
                    i === active ? 'opacity-100 scale-100' : 'opacity-0 scale-105'
                  }`}
                >
                  <img
                    src={batch.image}
                    alt={`Batch of ${batch.year}`}
                    className="h-full w-full object-cover"
                    loading={i === 0 ? 'eager' : 'lazy'}
                  />
                </div>
              ))}

              {/* Gradient overlays on the image */}
              <div className="absolute inset-0 bg-gradient-to-t from-ocean-950/90 via-ocean-950/10 to-ocean-950/20 dark:via-ocean-950/20 dark:to-ocean-950/30" />
              <div className="absolute inset-0 bg-gradient-to-r from-ocean-950/40 via-transparent to-transparent dark:from-ocean-950/50" />

              {/* Top badge */}
              <div className="absolute left-4 top-4 flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-reef-500/90 backdrop-blur-md dark:bg-reef-500/80">
                  <Waves className="h-4 w-4 text-white" strokeWidth={2.2} />
                </span>
                <span className="rounded-lg bg-white/80 px-3 py-1.5 text-xs font-semibold text-ocean-800 backdrop-blur-md dark:bg-ocean-950/50 dark:text-ocean-100">
                  Batch Showcase
                </span>
              </div>

              {/* Active batch info — bottom overlay */}
              <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
                <div key={active} className="animate-fade-in">
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <p className="font-display text-4xl font-extrabold leading-none text-white">
                        {batches[active].year}
                      </p>
                      <p className="mt-1.5 text-sm font-semibold text-reef-300">
                        Batch of {batches[active].label}
                      </p>
                      <p className="mt-0.5 text-xs italic text-ocean-200/90 dark:text-ocean-200/80">
                        &ldquo;{batches[active].motto}&rdquo;
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5 backdrop-blur-md dark:bg-ocean-950/50">
                      <Users className="h-3.5 w-3.5 text-reef-300 dark:text-reef-400" />
                      <span className="text-xs font-semibold text-white">{batches[active].count}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Prev / next controls */}
              <div className="absolute right-4 top-1/2 flex -translate-y-1/2 flex-col gap-2">
                <button
                  onClick={prev}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/30 text-white backdrop-blur-md transition-all hover:bg-reef-500 hover:border-reef-400 hover:scale-110 dark:border-white/15 dark:bg-ocean-950/50 dark:hover:bg-reef-500/60 dark:hover:border-reef-400/50"
                  aria-label="Previous batch"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  onClick={next}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/30 text-white backdrop-blur-md transition-all hover:bg-reef-500 hover:border-reef-400 hover:scale-110 dark:border-white/15 dark:bg-ocean-950/50 dark:hover:bg-reef-500/60 dark:hover:border-reef-400/50"
                  aria-label="Next batch"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>

              {/* Sparkle accent */}
              <div className="absolute right-6 top-20 animate-pulse-slow">
                <Sparkles className="h-5 w-5 text-white/40" />
              </div>
            </div>

            {/* Thumbnail strip below the image */}
            <div className="flex items-center gap-1.5 border-t border-white/30 bg-white/40 p-3 backdrop-blur-md dark:border-ocean-300/20 dark:bg-ocean-950/50">
              {batches.map((batch, i) => (
                <button
                  key={batch.year}
                  onClick={() => goTo(i)}
                  className="group/thumb relative flex-1 overflow-hidden rounded-lg border-2 transition-all duration-300"
                  aria-label={`Go to batch ${batch.year}`}
                >
                  <span
                    className={`block overflow-hidden transition-all duration-300 ${
                      i === active
                        ? 'border-reef-400 opacity-100 ring-2 ring-reef-400/40'
                        : 'border-transparent opacity-50 hover:opacity-90'
                    }`}
                  >
                    <img
                      src={batch.image}
                      alt={batch.year}
                      className="aspect-[5/3] w-full object-cover"
                    />
                  </span>
                </button>
              ))}
            </div>

            {/* Autoplay progress bar */}
            <div className="h-1 w-full bg-ocean-100/50 dark:bg-ocean-900/60">
              <div
                key={active + String(paused)}
                className="h-full bg-gradient-to-r from-ocean-500 to-reef-500"
                style={{
                  width: paused ? '0%' : '100%',
                  transition: paused ? 'none' : `width ${AUTOPLAY_MS}ms linear`,
                }}
              />
            </div>
          </div>

          {/* Cohort counter below panel */}
          <div className="mt-4 flex items-center justify-center gap-2 text-xs text-ocean-500 dark:text-ocean-300/70">
            <span className="font-semibold text-reef-600 dark:text-reef-300">{active + 1}</span>
            <span>/</span>
            <span>{batches.length}</span>
            <span className="ml-1">cohorts</span>
          </div>
        </div>
      </div>
    </section>
  );
}
