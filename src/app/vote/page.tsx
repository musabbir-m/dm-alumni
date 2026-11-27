import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowLeft, ArrowRight, CalendarClock, CheckCircle2, Clock, Fingerprint,
  ShieldAlert, ShieldCheck, Vote, XCircle,
} from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { getVotingContext } from '@/lib/election';
import type { TallyLine } from '@/lib/election';
import { batches } from '@/data/batches';
import BrandLogo from '@/components/BrandLogo';
import ThemeToggle from '@/components/ThemeToggle';
import BallotForm from '@/components/BallotForm';
import VerifyReceiptForm from '@/components/VerifyReceiptForm';
import { PersonAvatar } from '@/components/wallet-ui';

export const metadata: Metadata = {
  title: 'Committee Election — DM Alumni Association',
  description: 'Cast your vote in the DM Alumni Association committee election.',
};

/** "DSM 8th (Session 2018-19)" — compact batch label on candidate rows. */
const batchLabelOf = (year: string) => {
  const info = batches.find((b) => b.year === year);
  return info ? `DSM ${info.batchNo} (Session ${info.session})` : `Batch ${year}`;
};

const formatWhen = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

export default async function VotePage() {
  const user = await requireUser();
  const context = await getVotingContext(user._id.toString());

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-ocean-50 via-white to-reef-50 dark:from-ocean-950 dark:via-ocean-900 dark:to-reef-950">
      {/* Animated aurora orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 top-1/4 h-[500px] w-[500px] rounded-full bg-ocean-300/25 blur-[120px] animate-aurora dark:bg-ocean-500/15" />
        <div className="absolute -right-20 top-10 h-[400px] w-[400px] rounded-full bg-reef-300/20 blur-[100px] animate-aurora-slow dark:bg-reef-500/15" />
      </div>
      <div className="absolute inset-0 bg-grid opacity-40 dark:opacity-30" />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-4xl flex-col px-5 py-6 sm:px-8">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <BrandLogo />
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link
              href="/profile"
              className="inline-flex items-center gap-1.5 rounded-xl border border-ocean-200/60 bg-white/60 px-3.5 py-2 text-xs font-semibold text-ocean-700 backdrop-blur-md transition-all hover:border-ocean-300 hover:text-ocean-900 dark:border-ocean-700/50 dark:bg-ocean-800/40 dark:text-ocean-200 dark:hover:border-ocean-600 dark:hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to profile
            </Link>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full overflow-hidden rounded-3xl border border-ocean-200/50 bg-white/60 shadow-2xl shadow-ocean-200/20 backdrop-blur-md dark:border-ocean-800/60 dark:bg-gradient-to-br dark:from-ocean-900/80 dark:to-ocean-950/80 dark:shadow-ocean-950/40 dark:backdrop-blur-xl">
            <div className="p-8 sm:p-10">
              <h1 className="flex items-center gap-2.5 font-display text-2xl font-bold tracking-tight text-ocean-900 dark:text-white">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-ocean-500 to-reef-500 text-white dark:from-ocean-400 dark:to-reef-500 dark:text-ocean-950">
                  <Vote className="h-4.5 w-4.5" />
                </span>
                Committee election
              </h1>

              {context.phase === 'none' && (
                <Notice
                  icon={Clock}
                  tone="neutral"
                  title="No election right now"
                  body="There's no committee election running at the moment. When the next one opens, you'll be able to cast your ballot right here."
                />
              )}

              {context.phase === 'unconfigured' && (
                <Notice
                  icon={ShieldAlert}
                  tone="warn"
                  title={context.election.title}
                  body="The election is set up, but the voting system isn't fully configured yet. The association staff have been notified — please check back shortly."
                />
              )}

              {context.phase === 'unverified' && (
                <>
                  <Notice
                    icon={XCircle}
                    tone="warn"
                    title="Your membership isn't verified yet"
                    body={`“${context.election.title}” is underway, but only verified members can vote. A staff member reviews your details — you'll be able to cast your ballot once you're verified.`}
                  />
                  <div className="mt-6">
                    <BackToProfile />
                  </div>
                </>
              )}

              {context.phase === 'upcoming' && (
                <Notice
                  icon={CalendarClock}
                  tone="neutral"
                  title={context.election.title}
                  body={
                    context.election.openAt
                      ? `Voting opens ${formatWhen(context.election.openAt)}${context.election.closeAt ? ` and closes ${formatWhen(context.election.closeAt)}` : ''}. You'll be able to cast your ballot right here — the candidates will be announced on the ballot.`
                      : 'The election is being prepared. Voting opens as soon as the association staff start it — check back here then.'
                  }
                />
              )}

              {context.phase === 'open' && (
                <div className="mt-6">
                  <BallotForm
                    electionId={context.election.id}
                    title={context.election.title}
                    description={context.election.description}
                    candidates={context.election.candidates}
                    closesAt={context.election.closeAt}
                  />
                </div>
              )}

              {context.phase === 'voted' && (
                <>
                  <Notice
                    icon={CheckCircle2}
                    tone="good"
                    title="You've cast your ballot"
                    body={`Your vote in “${context.election.title}” is recorded anonymously and can never be changed. Enter your receipt code below any time to confirm your ballot is in the box.`}
                  />
                  <div className="mt-6 rounded-2xl border border-ocean-100 bg-white/50 p-5 dark:border-ocean-800/60 dark:bg-ocean-950/40">
                    <VerifyReceiptForm electionId={context.election.id} />
                  </div>
                </>
              )}

              {context.phase === 'closed' && (
                <>
                  <Notice
                    icon={Clock}
                    tone="neutral"
                    title="Voting has closed"
                    body={`Ballots for “${context.election.title}” are in the box and being tallied. Results will appear here as soon as the association publishes them.`}
                  />
                  <div className="mt-6 rounded-2xl border border-ocean-100 bg-white/50 p-5 dark:border-ocean-800/60 dark:bg-ocean-950/40">
                    <VerifyReceiptForm electionId={context.election.id} />
                  </div>
                </>
              )}

              {context.phase === 'published' && (
                <PublishedResults
                  title={context.election.title}
                  tally={context.tally}
                  chainOk={context.chain.ok}
                  headHash={context.election.publishedHeadHash ?? context.chain.headHash}
                  ballotCount={context.election.publishedBallotCount ?? context.chain.ballotCount}
                  rollCount={context.election.publishedRollCount ?? context.chain.rollCount}
                  electionId={context.election.id}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

// ─── Small presentational helpers (server-safe) ──────────────────────────

function Notice({
  icon: Icon,
  tone,
  title,
  body,
}: {
  icon: typeof Clock;
  tone: 'neutral' | 'good' | 'warn';
  title: string;
  body: string;
}) {
  const tones = {
    neutral: 'border-ocean-200 bg-ocean-50/80 text-ocean-800 dark:border-ocean-700/50 dark:bg-ocean-900/60 dark:text-ocean-100',
    good: 'border-reef-200 bg-reef-50/80 text-reef-800 dark:border-reef-500/30 dark:bg-reef-500/10 dark:text-reef-200',
    warn: 'border-amber-200 bg-amber-50/80 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200',
  } as const;
  return (
    <div className={`mt-6 flex items-start gap-3 rounded-xl border px-4 py-3.5 text-sm leading-relaxed ${tones[tone]}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div>
        <p className="font-semibold">{title}</p>
        <p className="mt-1">{body}</p>
      </div>
    </div>
  );
}

function BackToProfile() {
  return (
    <Link
      href="/profile"
      className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-ocean-500 to-reef-500 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-ocean-300/40 transition-all hover:brightness-110 dark:from-ocean-400 dark:to-reef-500 dark:text-ocean-950 dark:shadow-ocean-950/40"
    >
      View my profile
      <ArrowRight className="h-3.5 w-3.5" />
    </Link>
  );
}

/** The published-results view — tallies, winner, and the trust fingerprint. */
function PublishedResults({
  title,
  tally,
  chainOk,
  headHash,
  ballotCount,
  rollCount,
  electionId,
}: {
  title: string;
  tally: TallyLine[];
  chainOk: boolean;
  headHash: string;
  ballotCount: number;
  rollCount: number;
  electionId: string;
}) {
  const total = tally.reduce((n, l) => n + l.count, 0);
  const top = Math.max(1, ...tally.map((l) => l.count));
  const maxCount = tally.length ? Math.max(...tally.map((l) => l.count)) : 0;
  const winners = tally.filter((l) => l.count === maxCount && maxCount > 0);
  const uniqueWinner = winners.length === 1 ? winners[0] : null;

  return (
    <div className="mt-6 space-y-6">
      <div>
        <h2 className="font-display text-lg font-bold tracking-tight text-ocean-900 dark:text-white">
          Results — {title}
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-ocean-600 dark:text-ocean-200">
          {ballotCount} ballot{ballotCount === 1 ? '' : 's'} were cast by {rollCount} verified
          member{rollCount === 1 ? '' : 's'}.
        </p>
      </div>

      <div className={`flex items-start gap-3 rounded-xl border px-4 py-3.5 text-sm leading-relaxed ${
        chainOk
          ? 'border-reef-200 bg-reef-50/80 text-reef-800 dark:border-reef-500/30 dark:bg-reef-500/10 dark:text-reef-200'
          : 'border-red-200 bg-red-50/80 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300'
      }`} role="status">
        {chainOk ? (
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        ) : (
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        )}
        <p>
          {chainOk
            ? 'Every ballot matched its cryptographic seal — the recorded votes were never modified.'
            : 'The ballot chain failed verification — the recorded votes may have been modified after casting. Contact the association staff.'}
        </p>
      </div>

      {total > 0 ? (
        <div className="space-y-3">
          {tally.map((line) => (
            <div
              key={line.id}
              className={`overflow-hidden rounded-2xl border ${
                uniqueWinner?.id === line.id
                  ? 'border-reef-300 bg-reef-50/70 dark:border-reef-500/40 dark:bg-reef-500/10'
                  : 'border-ocean-100 bg-white/50 dark:border-ocean-800/60 dark:bg-ocean-950/40'
              }`}
            >
              <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                <PersonAvatar photo={line.photo} name={line.name} className="h-10 w-10 rounded-xl text-xs ring-2 ring-ocean-100 dark:ring-ocean-800" />
                <div className="min-w-0 flex-1">
                  <p className="flex min-w-0 items-center gap-2 text-sm font-semibold text-ocean-900 dark:text-white">
                    <span className="truncate">{line.name}</span>
                    {uniqueWinner?.id === line.id && (
                      <span className="shrink-0 rounded-full bg-gradient-to-r from-ocean-500 to-reef-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white dark:from-ocean-400 dark:to-reef-500 dark:text-ocean-950">
                        Elected
                      </span>
                    )}
                  </p>
                  <p className="truncate text-xs text-ocean-500 dark:text-ocean-300/70">
                    {line.studentId} · {batchLabelOf(line.batch)}
                  </p>
                </div>
                <p className="font-display text-lg font-bold text-ocean-900 dark:text-white">
                  {line.count}{' '}
                  <span className="text-xs font-medium text-ocean-400 dark:text-ocean-300/60">
                    vote{line.count === 1 ? '' : 's'}
                  </span>
                </p>
              </div>
              <div
                className="h-1.5 bg-gradient-to-r from-ocean-400 to-reef-500 dark:from-ocean-400 dark:to-reef-500"
                style={{ width: `${Math.round((line.count / top) * 100)}%` }}
                aria-hidden
              />
            </div>
          ))}
          {winners.length > 1 && (
            <p className="text-center text-xs font-medium text-amber-600 dark:text-amber-300">
              It&rsquo;s a tie at {maxCount} vote{maxCount === 1 ? '' : 's'} — the association will
              decide the outcome per its constitution.
            </p>
          )}
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-ocean-200 px-6 py-8 text-center text-sm text-ocean-500 dark:border-ocean-800 dark:text-ocean-300/70">
          No ballots were cast in this election.
        </p>
      )}

      {/* Trust fingerprint — frozen at publish; screenshot to compare later */}
      <div className="rounded-2xl border border-ocean-100 bg-white/50 p-5 dark:border-ocean-800/60 dark:bg-ocean-950/40">
        <p className="flex items-center gap-2 text-sm font-semibold text-ocean-900 dark:text-white">
          <Fingerprint className="h-4 w-4 text-ocean-500 dark:text-ocean-300" />
          Verification fingerprint
        </p>
        <p className="mt-2 break-all font-mono text-xs font-semibold text-ocean-700 dark:text-ocean-200" title={headHash}>
          {headHash}
        </p>
        <p className="mt-2 text-xs leading-relaxed text-ocean-500 dark:text-ocean-300/70">
          This seal was stamped when the results were published. If it ever changes, the
          recorded ballots changed after publication — compare your screenshot of this page.
        </p>
      </div>

      <div className="rounded-2xl border border-ocean-100 bg-white/50 p-5 dark:border-ocean-800/60 dark:bg-ocean-950/40">
        <VerifyReceiptForm electionId={electionId} />
      </div>
    </div>
  );
}
