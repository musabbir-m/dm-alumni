import { HeartHandshake, Sparkles, UserRound } from 'lucide-react';
import { batches } from '@/data/batches';
import {
  coreTeam,
  committeeMembers,
  designTeam,
  liaison,
  supporters,
  type Contributor,
} from '@/data/contributors';

/** Card label — "DSM 3rd Batch" */
const shortBatch = (year: string) => {
  const b = batches.find((x) => x.year === year);
  return b ? `DSM ${b.batchNo} Batch` : year;
};

/** Circular portrait — the roster photo, or a shared person-icon placeholder
 *  on the brand gradient until a photo arrives. Caller owns the size via
 *  `className` (the icon scales to half the circle). */
function Avatar({ name, photo, className = '' }: { name: string; photo?: string; className?: string }) {
  if (photo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photo}
        alt={name}
        loading="lazy"
        className={`rounded-full object-cover ring-2 ring-white/70 shadow-md dark:ring-ocean-800 ${className}`}
      />
    );
  }
  return (
    <span
      aria-label={`${name} — photo coming soon`}
      className={`flex items-center justify-center rounded-full bg-gradient-to-br from-ocean-500 to-reef-500 text-white shadow-lg shadow-ocean-300/30 transition-transform duration-300 group-hover:scale-105 dark:from-ocean-400 dark:to-reef-500 dark:text-ocean-950 dark:shadow-ocean-950/40 ${className}`}
    >
      <UserRound className="h-1/2 w-1/2" strokeWidth={1.6} aria-hidden />
    </span>
  );
}

/** Card chrome shared by every person card */
const CARD_CLS =
  'group relative overflow-hidden rounded-2xl border border-ocean-200/60 bg-gradient-to-b from-white to-ocean-50/30 p-6 transition-all duration-300 hover:border-ocean-300 hover:shadow-xl hover:shadow-ocean-200/20 hover:-translate-y-1 dark:border-ocean-800/60 dark:from-ocean-900/40 dark:to-ocean-950/60 dark:hover:border-reef-600/40';

/** Hover glow + bottom accent shared by the same cards */
const CARD_DECOR = (
  <>
    <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-gradient-to-br from-ocean-200/0 to-reef-200/0 blur-2xl transition-all duration-500 group-hover:from-ocean-200/30 group-hover:to-reef-200/30 dark:group-hover:from-reef-500/10 dark:group-hover:to-ocean-500/10" />
    <div className="absolute bottom-0 left-0 h-0.5 w-0 bg-gradient-to-r from-ocean-500 to-reef-500 transition-all duration-500 group-hover:w-full" />
  </>
);

/** One person — circular photo, name, optional role, batch */
function TeamCard({ member, role }: { member: Contributor; role?: string }) {
  return (
    <div className={`${CARD_CLS} reveal`}>
      {CARD_DECOR}
      <div className="relative flex flex-col items-center py-2 text-center">
        <Avatar name={member.name} photo={member.photo} className="h-24 w-24 text-2xl" />
        <h3 className="mt-4 font-display text-lg font-semibold text-ocean-900 dark:text-white">
          {member.name}
        </h3>
        {role && (
          <p className="mt-0.5 text-sm font-semibold text-reef-600 dark:text-reef-300">{role}</p>
        )}
        <p className="mt-1 text-xs font-medium text-ocean-400 dark:text-ocean-300/60">
          {shortBatch(member.batch)}
        </p>
      </div>
    </div>
  );
}

/** Sub-heading + accent dash above each row of cards */
function RowLabel({ children }: { children: string }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className="h-1.5 w-8 rounded-full bg-gradient-to-r from-ocean-500 to-reef-500"
        aria-hidden
      />
      <h3 className="font-display text-lg font-bold tracking-tight text-ocean-800 dark:text-ocean-100">
        {children}
      </h3>
    </div>
  );
}

/**
 * Homepage section above the Footer — "Meet Our Team": the core-team cards,
 * labeled rows for Constitution Drafting Committee and Website Design &
 * Development, the ADMS liaison banner, and the supporters grid. Server
 * component; the roster (with placeholder photos) lives in
 * src/data/contributors.ts.
 */
export default function Contributors() {
  return (
    <section id="contributors" className="relative overflow-hidden bg-white py-24 dark:bg-ocean-950 sm:py-32">
      <div className="absolute inset-0 bg-dots opacity-40 dark:opacity-20" />
      <div className="absolute -left-40 top-20 h-96 w-96 rounded-full bg-ocean-100/40 blur-[100px] animate-pulse-slow dark:bg-reef-600/10" />
      <div className="absolute -right-40 bottom-20 h-96 w-96 rounded-full bg-reef-100/40 blur-[100px] animate-pulse-slow dark:bg-ocean-500/10" style={{ animationDelay: '2s' }} />

      <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
        {/* Section header */}
        <div className="mx-auto max-w-2xl text-center reveal">
          <span className="inline-flex items-center gap-2 rounded-full border border-reef-300/60 bg-reef-50/80 px-4 py-1.5 text-xs font-semibold tracking-wide text-reef-700 backdrop-blur-sm dark:border-reef-700/40 dark:bg-reef-900/30 dark:text-reef-300">
            <Sparkles className="h-3.5 w-3.5" />
            Our Contributors
          </span>
          <h2 className="mt-5 font-display text-3xl font-bold leading-tight tracking-tight text-ocean-900 dark:text-white sm:text-4xl text-balance">
            Meet <span className="text-gradient">Our Team</span>
          </h2>
          <p className="mt-4 text-base leading-relaxed text-ocean-600/80 dark:text-ocean-100/70">
            From drafting the constitution to designing the logo and this
            website — the alumni who founded, built, and shaped the DM Alumni
            Association.
          </p>
        </div>

        {/* Core team */}
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {coreTeam.map(({ role, member }) => (
            <TeamCard key={role} member={member} role={role} />
          ))}
        </div>

        {/* Constitution Drafting Committee — one row */}
        <div className="mt-12 reveal">
          <RowLabel>Constitution Drafting Committee</RowLabel>
          <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {committeeMembers.map((m) => (
              <TeamCard key={m.name} member={m} />
            ))}
          </div>
        </div>

        {/* Design & Development — one row */}
        <div className="mt-12 reveal">
          <RowLabel>Website Design &amp; Development</RowLabel>
          <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {designTeam.map(({ role, member }) => (
              <TeamCard key={role} member={member} role={role} />
            ))}
          </div>
        </div>

        {/* ADMS liaison */}
        <div className="reveal relative mt-12 overflow-hidden rounded-2xl border border-ocean-200/60 bg-gradient-to-r from-ocean-50 to-reef-50 p-6 dark:border-ocean-800/60 dark:from-ocean-900/60 dark:to-reef-950/40 sm:p-7">
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-reef-300/15 blur-[80px] animate-aurora dark:bg-reef-500/10" />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-ocean-500 to-reef-500 text-white shadow-lg shadow-ocean-300/30 dark:from-ocean-400 dark:to-reef-500 dark:text-ocean-950 dark:shadow-ocean-950/40">
              <HeartHandshake className="h-6 w-6" strokeWidth={1.8} />
            </span>
            <div className="min-w-0 flex-1">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-reef-600 dark:text-reef-300">
                Liaison Committee
              </span>
              <p className="mt-1 font-display text-base font-semibold text-ocean-900 dark:text-white">
                {liaison.organization}
              </p>
              <p className="mt-0.5 text-sm text-ocean-500 dark:text-ocean-300/70">
                {liaison.committee}
              </p>
            </div>
            <div className="flex items-center gap-3.5 rounded-xl border border-ocean-200/60 bg-white/60 px-4 py-3 backdrop-blur-sm dark:border-ocean-800/60 dark:bg-ocean-950/40">
              <Avatar
                name={liaison.lead.name}
                photo={liaison.lead.photo}
                className="h-11 w-11 text-xs"
              />
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-ocean-400 dark:text-ocean-300/60">
                  Led by
                </p>
                <p className="truncate text-sm font-semibold text-ocean-900 dark:text-white">
                  {liaison.lead.name}
                </p>
                <p className="text-[11px] font-medium text-ocean-400 dark:text-ocean-300/60">
                  {shortBatch(liaison.lead.batch)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Supporters */}
        <div className="mt-16 reveal">
          <div className="mx-auto max-w-xl text-center">
            <h3 className="font-display text-xl font-bold tracking-tight text-ocean-900 dark:text-white sm:text-2xl">
              Supported by
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-ocean-600/80 dark:text-ocean-100/70">
              Well-wishers from across the batches who stood behind the
              founding of the association.
            </p>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {supporters.map((s) => (
              <div
                key={s.name}
                className="group flex items-center gap-3 rounded-xl border border-ocean-200/60 bg-white/60 px-3.5 py-3 backdrop-blur-sm transition-all duration-300 hover:border-reef-300 hover:shadow-lg hover:shadow-ocean-200/20 hover:-translate-y-0.5 dark:border-ocean-800/60 dark:bg-ocean-950/40 dark:hover:border-reef-600/40"
              >
                <Avatar name={s.name} photo={s.photo} className="h-10 w-10 shrink-0 text-[11px]" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ocean-900 dark:text-white">
                    {s.name}
                  </p>
                  <p className="text-[11px] font-medium text-ocean-400 dark:text-ocean-300/60">
                    {shortBatch(s.batch)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
