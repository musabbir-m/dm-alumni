import { Users, Calendar, ArrowUpRight } from 'lucide-react';
import { batches } from '@/data/batches';

export default function Batches() {
  return (
    <section id="batches" className="relative overflow-hidden bg-gradient-to-b from-ocean-50/40 via-white to-white py-24 dark:from-ocean-950 dark:via-ocean-900 dark:to-ocean-900 sm:py-32">
      <div className="absolute inset-0 bg-dots opacity-30 dark:hidden" />
      <div className="absolute -right-32 top-40 hidden h-96 w-96 rounded-full bg-reef-100/30 blur-[100px] animate-pulse-slow dark:block dark:bg-ocean-500/10" />

      <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
        <div className="mx-auto max-w-2xl text-center reveal">
          <span className="inline-flex items-center gap-2 rounded-full border border-ocean-200/60 bg-white/60 px-4 py-1.5 text-xs font-semibold tracking-wide text-ocean-700 backdrop-blur-sm dark:border-sand-700/40 dark:bg-sand-900/20 dark:text-sand-300">
            Our Cohorts
          </span>
          <h2 className="mt-5 font-display text-3xl font-bold leading-tight tracking-tight text-ocean-900 dark:text-white sm:text-4xl lg:text-5xl text-balance">
            Six batches,{' '}
            <span className="text-gradient">one unbroken current</span>
          </h2>
          <p className="mt-4 text-base leading-relaxed text-ocean-600/70 dark:text-ocean-100/70">
            Each cohort carries its own character and collective memory — but
            all share the same foundation of service and solidarity.
          </p>
        </div>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {batches.map((batch, i) => (
            <article
              key={batch.year}
              className="group relative overflow-hidden rounded-3xl border border-ocean-200/60 bg-white shadow-lg shadow-ocean-200/20 transition-all duration-300 hover:shadow-2xl hover:shadow-reef-200/30 hover:-translate-y-2 reveal dark:border-ocean-800/60 dark:bg-ocean-950/60 dark:shadow-ocean-950/30 dark:hover:shadow-ocean-950/50"
              style={{ transitionDelay: `${i * 60}ms` }}
            >
              <div className="relative aspect-[4/3] overflow-hidden">
                <img
                  src={batch.image}
                  alt={`Batch of ${batch.year}`}
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-ocean-950/85 via-ocean-950/20 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-br from-ocean-500/0 to-reef-500/0 transition-opacity duration-500 group-hover:from-ocean-500/10 group-hover:to-reef-500/10" />

                <span className="absolute left-4 top-4 rounded-lg bg-white/80 px-3 py-1 font-display text-sm font-bold text-ocean-800 backdrop-blur-md dark:bg-ocean-950/60 dark:text-white">
                  {batch.year}
                </span>
                <span className="absolute right-4 top-4 rounded-lg bg-reef-500/90 px-3 py-1 text-xs font-semibold text-white backdrop-blur-md dark:bg-reef-500/80">
                  {batch.label}
                </span>

                {/* Hover arrow */}
                <div className="absolute bottom-4 right-4 flex h-9 w-9 translate-y-12 items-center justify-center rounded-full bg-white/90 text-ocean-700 opacity-0 backdrop-blur-md transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 dark:bg-ocean-950/60 dark:text-ocean-100">
                  <ArrowUpRight className="h-4 w-4" />
                </div>
              </div>

              <div className="relative p-6">
                {/* Top accent */}
                <div className="absolute left-0 top-0 h-0.5 w-0 bg-gradient-to-r from-ocean-500 to-reef-500 transition-all duration-500 group-hover:w-full" />

                <p className="font-display text-lg font-semibold italic text-reef-600 dark:text-reef-200">
                  &ldquo;{batch.motto}&rdquo;
                </p>
                <div className="mt-4 flex items-center justify-between border-t border-ocean-100 pt-4 dark:border-ocean-800/60">
                  <span className="inline-flex items-center gap-1.5 text-sm text-ocean-600 dark:text-ocean-200/70">
                    <Users className="h-4 w-4 text-reef-500 dark:text-reef-400" />
                    {batch.count} alumni
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-xs text-ocean-400 dark:text-ocean-300/50">
                    <Calendar className="h-3.5 w-3.5" />
                    Class of {batch.year}
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
