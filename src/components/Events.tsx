import { MapPin, ArrowUpRight, Clock } from 'lucide-react';

const events = [
  {
    month: 'Sep',
    day: '14',
    title: 'Annual Alumni Summit 2026',
    location: 'Coastal Convention Center, Hall A',
    time: '9:00 AM – 5:00 PM',
    tag: 'Flagship Event',
    desc: 'A full-day gathering of all six cohorts — keynote talks, panel discussions, and batch reunions.',
    featured: true,
  },
  {
    month: 'Oct',
    day: '05',
    title: 'Field Response Workshop',
    location: 'Virtual — Online',
    time: '6:00 PM – 8:00 PM',
    tag: 'Workshop',
    desc: 'Hands-on training on rapid assessment techniques led by 2019 cohort field veterans.',
    featured: false,
  },
  {
    month: 'Nov',
    day: '22',
    title: 'Community Resilience Symposium',
    location: 'University Auditorium',
    time: '10:00 AM – 1:00 PM',
    tag: 'Symposium',
    desc: 'Research showcase featuring alumni publications on climate adaptation and urban flood risk.',
    featured: false,
  },
];

export default function Events() {
  return (
    <section id="events" className="relative overflow-hidden bg-white py-24 dark:bg-ocean-950 sm:py-32">
      <div className="absolute -left-32 top-40 h-80 w-80 rounded-full bg-ocean-100/40 blur-[100px] animate-pulse-slow dark:bg-reef-600/10" />
      <div className="absolute -right-32 bottom-20 h-80 w-80 rounded-full bg-reef-100/30 blur-[100px] animate-pulse-slow dark:bg-ocean-500/10" style={{ animationDelay: '2s' }} />
      <div className="absolute inset-0 bg-dots opacity-30 dark:opacity-20" />

      <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end reveal">
          <div className="max-w-xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-clay-300/60 bg-clay-50/80 px-4 py-1.5 text-xs font-semibold tracking-wide text-clay-700 backdrop-blur-sm dark:border-clay-700/40 dark:bg-clay-900/20 dark:text-clay-300">
              Upcoming Events
            </span>
            <h2 className="mt-5 font-display text-3xl font-bold leading-tight tracking-tight text-ocean-900 dark:text-white sm:text-4xl lg:text-5xl text-balance">
              Gather, learn,{' '}
              <span className="text-gradient">and give back</span>
            </h2>
          </div>
          <a
            href="#connect"
            className="group inline-flex items-center gap-1.5 text-sm font-semibold text-reef-600 transition-colors hover:text-reef-500 dark:text-reef-300 dark:hover:text-reef-200"
          >
            View all events
            <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </a>
        </div>

        <div className="mt-12 space-y-4">
          {events.map((event, i) => (
            <article
              key={event.title}
              className={`group relative overflow-hidden rounded-2xl border p-6 transition-all duration-300 hover:-translate-y-0.5 reveal ${
                event.featured
                  ? 'border-ocean-300/60 bg-gradient-to-r from-ocean-50/80 to-reef-50/40 hover:border-ocean-400 hover:shadow-xl hover:shadow-ocean-200/30 dark:border-reef-600/40 dark:from-reef-900/30 dark:to-ocean-900/30 dark:hover:border-reef-500/60 dark:hover:shadow-ocean-950/40'
                  : 'border-ocean-200/60 bg-white hover:border-ocean-300 hover:shadow-lg hover:shadow-ocean-200/20 dark:border-ocean-800/60 dark:bg-ocean-900/30 dark:hover:border-ocean-700/60 dark:hover:shadow-ocean-950/30'
              }`}
              style={{ transitionDelay: `${i * 80}ms` }}
            >
              {/* Left accent bar */}
              <div className={`absolute left-0 top-0 h-full w-1 ${event.featured ? 'bg-gradient-to-b from-ocean-500 to-reef-500' : 'bg-gradient-to-b from-ocean-300 to-reef-300 opacity-0 transition-opacity group-hover:opacity-100'}`} />

              <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                {/* Date badge */}
                <div
                  className={`flex flex-col items-center justify-center rounded-xl px-4 py-3 transition-transform group-hover:scale-105 ${
                    event.featured
                      ? 'bg-gradient-to-br from-ocean-500 to-reef-500 text-white shadow-lg shadow-ocean-300/40 dark:from-reef-500 dark:to-ocean-600 dark:text-ocean-950 dark:shadow-ocean-950/40'
                      : 'bg-ocean-50 text-ocean-700 border border-ocean-200/60 dark:border-ocean-700/50 dark:bg-ocean-800/60 dark:text-ocean-100'
                  }`}
                >
                  <span className="text-xs font-semibold uppercase tracking-wider opacity-80">
                    {event.month}
                  </span>
                  <span className="font-display text-2xl font-bold leading-none">
                    {event.day}
                  </span>
                </div>

                {/* Content */}
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display text-lg font-semibold text-ocean-900 dark:text-white">
                      {event.title}
                    </h3>
                    {event.featured && (
                      <span className="rounded-full bg-reef-500/20 px-2.5 py-0.5 text-[11px] font-semibold text-reef-700 ring-1 ring-reef-400/30 dark:text-reef-300 dark:ring-reef-500/30">
                        {event.tag}
                      </span>
                    )}
                    {!event.featured && (
                      <span className="rounded-full bg-ocean-100 px-2.5 py-0.5 text-[11px] font-semibold text-ocean-600 dark:bg-ocean-800/60 dark:text-ocean-200">
                        {event.tag}
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-ocean-600/70 dark:text-ocean-100/65">
                    {event.desc}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-ocean-500 dark:text-ocean-200/60">
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-reef-500 dark:text-reef-400" />
                      {event.location}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-reef-500 dark:text-reef-400" />
                      {event.time}
                    </span>
                  </div>
                </div>

                {/* CTA */}
                <a
                  href="#connect"
                  className={`group/btn inline-flex shrink-0 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all ${
                    event.featured
                      ? 'bg-gradient-to-r from-ocean-500 to-reef-500 text-white shadow-lg shadow-ocean-300/30 hover:brightness-110 hover:shadow-reef-300/30 dark:from-reef-500 dark:to-ocean-500 dark:text-ocean-950 dark:shadow-ocean-950/40'
                      : 'border-2 border-ocean-300 text-ocean-700 hover:bg-ocean-500 hover:text-white hover:border-ocean-500 dark:border-ocean-700/60 dark:text-white dark:hover:bg-ocean-800/50 dark:hover:border-ocean-700/60'
                  }`}
                >
                  Register
                  <ArrowUpRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5" />
                </a>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
