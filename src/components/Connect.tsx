import Link from 'next/link';
import { ArrowRight, CheckCircle2 } from 'lucide-react';

// The right column used to hold a demo form that faked a successful
// registration — the real (roster-gated) flow lives at /register, so it is
// just a CTA now. No interactivity left: this renders on the server.
export default function Connect() {
  return (
    <section id="connect" className="relative overflow-hidden bg-gradient-to-b from-white via-ocean-50/30 to-ocean-50/40 py-24 dark:from-ocean-900 dark:via-ocean-950 dark:to-ocean-950 sm:py-32">
      <div className="absolute inset-0 bg-dots opacity-30 dark:hidden" />
      <div className="absolute -right-20 top-10 hidden h-96 w-96 rounded-full bg-ocean-100/40 blur-[100px] animate-pulse-slow dark:block dark:bg-reef-600/10" />
      <div className="absolute -left-20 bottom-10 hidden h-96 w-96 rounded-full bg-reef-100/30 blur-[100px] animate-pulse-slow dark:block dark:bg-sand-500/10" style={{ animationDelay: '2s' }} />

      <div className="relative mx-auto max-w-6xl px-5 sm:px-8">
        <div className="overflow-hidden rounded-3xl border border-ocean-200/50 bg-white/60 shadow-2xl shadow-ocean-200/20 backdrop-blur-md reveal dark:border-ocean-800/60 dark:bg-gradient-to-br dark:from-ocean-900/80 dark:to-ocean-950/80 dark:shadow-ocean-950/40 dark:backdrop-blur-xl">
          <div className="grid lg:grid-cols-2">
            {/* Left: invitation */}
            <div className="relative flex flex-col justify-between overflow-hidden bg-gradient-to-br from-ocean-700 via-ocean-600 to-reef-600 p-8 dark:from-ocean-900 dark:via-ocean-800 dark:to-reef-900 sm:p-12">
              {/* Decorative orbs */}
              <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-reef-300/15 blur-[80px] animate-aurora" />
                <div className="absolute -left-10 bottom-0 h-40 w-40 rounded-full bg-ocean-300/15 blur-[80px] animate-aurora-slow" />
              </div>
              <div className="absolute inset-0 bg-grid-dark opacity-15" />

              <div className="relative">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-semibold tracking-wide text-white backdrop-blur-md">
                  Join the Network
                </span>
                <h2 className="mt-5 font-display text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl text-balance">
                  Reconnect with your cohort.{' '}
                  <span className="bg-gradient-to-r from-reef-200 to-ocean-200 bg-clip-text text-transparent">
                    Build the next wave of resilience.
                  </span>
                </h2>
                <p className="mt-4 text-base leading-relaxed text-ocean-50/80">
                  Whether you graduated in the first batch or the latest, the
                  Alumni Association is your home base. Sign up to access mentorship
                  opportunities, job boards, events, and a community that understands
                  the work you do.
                </p>
              </div>

              <ul className="relative mt-8 space-y-3">
                {[
                  'Mentorship matching across cohorts',
                  'Exclusive job and fellowship board',
                  'Quarterly newsletter with field updates',
                  'Voting rights at the annual general meeting',
                ].map((perk, i) => (
                  <li
                    key={perk}
                    className="flex items-center gap-3 text-sm text-white/90 animate-fade-up"
                    style={{ animationDelay: `${0.3 + i * 0.1}s`, animationFillMode: 'both' }}
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-reef-300/20 ring-1 ring-reef-300/40">
                      <CheckCircle2 className="h-3.5 w-3.5 text-reef-200" strokeWidth={2.5} />
                    </span>
                    {perk}
                  </li>
                ))}
              </ul>
            </div>

            {/* Right: registration CTA */}
            <div className="relative flex flex-col items-center justify-center p-8 text-center dark:border-t dark:border-ocean-800/60 dark:bg-ocean-950/40 sm:p-12 lg:border-l lg:border-t-0 lg:dark:border-l">
              <Link
                href="/register"
                className="group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-ocean-500 to-reef-500 px-8 py-4 text-sm font-semibold text-white shadow-xl shadow-ocean-300/40 transition-all hover:brightness-110 dark:from-ocean-400 dark:to-reef-500 dark:text-ocean-950 dark:shadow-ocean-950/40"
              >
                <span className="relative z-10">Register Now</span>
                <ArrowRight className="relative z-10 h-4 w-4 transition-transform group-hover:translate-x-1" />
                <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
              </Link>
              <p className="mt-4 max-w-xs text-sm text-ocean-600/70 dark:text-ocean-100/70">
                Registration uses your department Student ID — your batch
                moderator verifies each new member.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
