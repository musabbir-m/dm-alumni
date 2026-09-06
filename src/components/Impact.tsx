'use client';

import { useEffect, useRef, useState } from 'react';
import { LifeBuoy, Building2, GraduationCap, Microscope, TrendingUp } from 'lucide-react';

const stats = [
  { icon: LifeBuoy, value: 1200, suffix: '+', label: 'Relief missions supported' },
  { icon: Building2, value: 48, suffix: '', label: 'Partner organizations' },
  { icon: GraduationCap, value: 379, suffix: '', label: 'Alumni network members' },
  { icon: Microscope, value: 65, suffix: '', label: 'Research publications' },
];

function CountUp({ end, suffix }: { end: number; suffix: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !started.current) {
          started.current = true;
          const duration = 1800;
          const start = performance.now();
          const tick = (now: number) => {
            const progress = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(Math.floor(eased * end));
            if (progress < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.4 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [end]);

  return (
    <span ref={ref}>
      {count}
      {suffix}
    </span>
  );
}

export default function Impact() {
  return (
    <section id="impact" className="relative overflow-hidden bg-gradient-to-br from-ocean-900 via-ocean-800 to-reef-900 py-24 sm:py-32">
      {/* Animated aurora orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute right-0 top-0 h-[400px] w-[400px] rounded-full bg-reef-400/10 blur-[120px] animate-aurora" />
        <div className="absolute left-0 bottom-0 h-[400px] w-[400px] rounded-full bg-ocean-400/10 blur-[120px] animate-aurora-slow" />
      </div>
      <div className="absolute inset-0 bg-grid-dark opacity-30" />

      <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
        <div className="mx-auto max-w-2xl text-center reveal">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-1.5 text-xs font-semibold tracking-wide text-white backdrop-blur-md">
            <TrendingUp className="h-3.5 w-3.5 text-reef-300" />
            Our Impact
          </span>
          <h2 className="mt-5 font-display text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl lg:text-5xl text-balance">
            Measured in lives reached,{' '}
            <span className="bg-gradient-to-r from-reef-300 to-ocean-300 bg-clip-text text-transparent">
              not just hours logged
            </span>
          </h2>
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat, i) => (
            <div
              key={stat.label}
              className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-8 text-center backdrop-blur-md reveal transition-all duration-300 hover:bg-white/10 hover:border-white/20 hover:-translate-y-1"
              style={{ transitionDelay: `${i * 80}ms` }}
            >
              {/* Hover glow */}
              <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-reef-400/0 blur-2xl transition-all duration-500 group-hover:bg-reef-400/15" />

              <span className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-white/20 to-white/5 ring-1 ring-white/20 transition-transform group-hover:scale-110 group-hover:rotate-3">
                <stat.icon className="h-7 w-7 text-white" strokeWidth={1.7} />
              </span>
              <p className="relative mt-5 font-display text-4xl font-extrabold text-white">
                <CountUp end={stat.value} suffix={stat.suffix} />
              </p>
              <p className="relative mt-2 text-sm leading-snug text-ocean-100/60">
                {stat.label}
              </p>

              {/* Bottom sweep line */}
              <div className="absolute -bottom-px left-1/2 h-px w-0 -translate-x-1/2 bg-gradient-to-r from-transparent via-reef-300 to-transparent transition-all duration-700 group-hover:w-full" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
