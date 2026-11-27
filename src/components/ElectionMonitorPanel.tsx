'use client';

import { useEffect, useState } from 'react';
import { Loader2, RefreshCw, ShieldAlert, ShieldCheck, Users, Vote } from 'lucide-react';
import { batches } from '@/data/batches';
import { getTurnoutAction, verifyChainAction } from '@/lib/actions/election';
import { ELECTION_STATUS_META } from '@/lib/election-fields';
import type { ChainView, ElectionView, TallyLine, TurnoutView } from '@/lib/election';
import { PersonAvatar } from '@/components/wallet-ui';
import ElectionAdminForm from '@/components/ElectionAdminForm';

/**
 * The dashboard's "Election" tab — live turnout monitoring for every staff
 * viewer (admins + moderators, like the Payments tab: read-only context;
 * only the management card inside is admin-gated). While voting is open this
 * shows TURNOUT ONLY, never tallies — the tally data simply isn't sent from
 * the server while an election is open (computeTally returns null), so
 * running counts can't leak through this panel. Full results render once the
 * election closes.
 *
 * Live updates come from the repo's first data poller: a 10s interval calling
 * two read-only server actions (turnout + chain verification) and rendering
 * their result locally — no page refresh, no re-running the dashboard's
 * queries. The interval clears on unmount, and AdminTabs unmounts panels on
 * every tab switch, so a hidden tab never keeps polling.
 */

const POLL_MS = 10_000;

/** "DSM 8th" — compact label for the per-batch turnout rows. */
const batchShort = (year: string) => {
  const info = batches.find((b) => b.year === year);
  return info ? `DSM ${info.batchNo}` : `Batch ${year}`;
};

export default function ElectionMonitorPanel({
  election,
  initialTurnout,
  initialChain,
  initialTally,
  isAdmin,
}: {
  election: ElectionView | null;
  initialTurnout: TurnoutView | null;
  initialChain: ChainView | null;
  /** Server-rendered tallies — null while the election is open (the no-leak gate) */
  initialTally: TallyLine[] | null;
  isAdmin: boolean;
}) {
  const [turnout, setTurnout] = useState<TurnoutView | null>(initialTurnout);
  const [chain, setChain] = useState<ChainView | null>(initialChain);
  const [verifying, setVerifying] = useState(false);

  // Live poll while the election can still move — stops once published.
  const electionId = election?.id;
  const electionStatus = election?.status;
  useEffect(() => {
    if (!electionId || electionStatus === 'published') return;
    let cancelled = false;
    const tick = async () => {
      const [t, c] = await Promise.all([
        getTurnoutAction(electionId),
        verifyChainAction(electionId),
      ]);
      if (cancelled) return;
      if (t.ok) setTurnout(t.turnout);
      if (c.ok) setChain(c.chain);
    };
    tick();
    const interval = setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [electionId, electionStatus]);

  const reverify = async () => {
    if (!election) return;
    setVerifying(true);
    try {
      const c = await verifyChainAction(election.id);
      if (c.ok) setChain(c.chain);
    } finally {
      setVerifying(false);
    }
  };

  if (!election) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-ocean-200 px-6 py-12 text-center dark:border-ocean-800">
          <Vote className="h-8 w-8 text-ocean-300 dark:text-ocean-600" />
          <p className="text-sm font-medium text-ocean-700 dark:text-ocean-200">
            No committee election yet.
          </p>
          <p className="max-w-sm text-xs text-ocean-500 dark:text-ocean-300/70">
            {isAdmin
              ? 'Create one below — configure the candidates, then open voting when everything looks right.'
              : 'When the association sets one up, live turnout appears here during voting and results after it closes.'}
          </p>
        </div>
        {isAdmin && <ElectionAdminForm election={null} />}
      </div>
    );
  }

  const meta = ELECTION_STATUS_META[election.status];
  const showTally = election.status === 'closed' || election.status === 'published';

  return (
    <div className="space-y-6">
      {/* Election header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-display text-base font-bold text-ocean-900 dark:text-white">
            {election.title}
          </h3>
          <p className="mt-0.5 text-xs text-ocean-500 dark:text-ocean-300/70">{meta.note}</p>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${meta.pill}`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              election.status === 'open'
                ? 'animate-glow-pulse bg-amber-500'
                : election.status === 'published'
                  ? 'bg-reef-500'
                  : 'bg-ocean-400'
            }`}
            aria-hidden
          />
          {meta.label}
        </span>
      </div>

      {/* Live turnout — votes cast, never who or what */}
      {turnout && (
        <div className="rounded-2xl border border-ocean-100 bg-white/50 dark:border-ocean-800/60 dark:bg-ocean-950/40">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-ocean-100 px-5 py-4 dark:border-ocean-800/60">
            <div className="flex items-center gap-3.5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-ocean-500 to-reef-500 text-white dark:from-ocean-400 dark:to-reef-500 dark:text-ocean-950">
                <Vote className="h-5 w-5" />
              </span>
              <div>
                <p className="font-display text-2xl font-bold leading-tight text-ocean-900 dark:text-white">
                  {turnout.total}
                  <span className="ml-1.5 text-sm font-medium text-ocean-400 dark:text-ocean-300/60">
                    of {turnout.eligibleTotal} eligible
                  </span>
                </p>
                <p className="text-xs text-ocean-500 dark:text-ocean-300/70">
                  ballots cast · {turnout.percent}% turnout
                  {election.status === 'open' ? ' · refreshing every 10s' : ''}
                </p>
              </div>
            </div>
            <p className="flex items-center gap-1.5 text-xs text-ocean-400 dark:text-ocean-300/60">
              <Users className="h-3.5 w-3.5" />
              Ballots are anonymous — who voted is never linked to a choice.
            </p>
          </div>
          <div className="px-5 py-4">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-ocean-400 dark:text-ocean-300/50">
              Turnout by batch
            </p>
            <div className="space-y-2">
              {turnout.byBatch.length === 0 ? (
                <p className="text-xs text-ocean-400 dark:text-ocean-300/60">
                  No ballots cast yet — the first vote will appear within seconds.
                </p>
              ) : (
                turnout.byBatch.map((row) => {
                  const eligible =
                    turnout.eligibleByBatch.find((e) => e.batch === row.batch)?.count ?? 0;
                  const pct = eligible > 0 ? Math.round((row.count / eligible) * 100) : 0;
                  return (
                    <div key={row.batch} className="flex items-center gap-3">
                      <p className="w-20 shrink-0 text-xs font-medium text-ocean-600 dark:text-ocean-200">
                        {batchShort(row.batch)}
                      </p>
                      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-ocean-100/70 dark:bg-ocean-800/60">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-ocean-500 to-reef-500 transition-all duration-700 dark:from-ocean-400 dark:to-reef-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="w-16 shrink-0 text-right text-xs font-semibold text-ocean-700 dark:text-ocean-200">
                        {row.count}/{eligible}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Chain integrity badge */}
      {chain && (
        <div
          className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-5 py-4 ${
            chain.ok
              ? 'border-reef-200 bg-reef-50/70 dark:border-reef-500/30 dark:bg-reef-500/10'
              : 'border-red-200 bg-red-50/70 dark:border-red-500/30 dark:bg-red-500/10'
          }`}
          role="status"
        >
          <div className="flex min-w-0 items-start gap-3">
            {chain.ok ? (
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-reef-600 dark:text-reef-300" aria-hidden />
            ) : (
              <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-500 dark:text-red-300" aria-hidden />
            )}
            <div className="min-w-0">
              <p
                className={`text-sm font-semibold ${
                  chain.ok
                    ? 'text-reef-700 dark:text-reef-300'
                    : 'text-red-700 dark:text-red-300'
                }`}
              >
                {chain.ok ? 'Ballot chain verified' : 'Ballot chain FAILED verification'}
              </p>
              <p
                className={`mt-0.5 text-xs leading-relaxed ${
                  chain.ok
                    ? 'text-reef-600/80 dark:text-reef-300/70'
                    : 'text-red-600/80 dark:text-red-300/80'
                }`}
              >
                {chain.ok
                  ? `${chain.ballotCount} ballot${chain.ballotCount === 1 ? '' : 's'}, ${chain.rollCount} voter${chain.rollCount === 1 ? '' : 's'} — every seal matches.`
                  : (chain.reason ?? 'The recorded ballots may have been modified after casting.')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={reverify}
            disabled={verifying}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-ocean-200/70 bg-white/60 px-3 py-1.5 text-xs font-semibold text-ocean-700 transition-all hover:border-ocean-300 disabled:opacity-60 dark:border-ocean-700/50 dark:bg-ocean-800/40 dark:text-ocean-200 dark:hover:border-ocean-600 dark:hover:text-white"
          >
            {verifying ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Re-verify
          </button>
        </div>
      )}

      {/* Results — the server only sends these once voting has closed */}
      {showTally && (
        <div>
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-ocean-400 dark:text-ocean-300/50">
            Results by candidate
          </p>
          {initialTally && initialTally.length > 0 ? (
            <div className="space-y-2.5">
              {initialTally.map((line) => {
                const top = Math.max(1, ...initialTally.map((l) => l.count));
                return (
                  <div
                    key={line.id}
                    className="flex items-center gap-3 rounded-2xl border border-ocean-100 bg-white/50 px-4 py-3 dark:border-ocean-800/60 dark:bg-ocean-950/40"
                  >
                    <PersonAvatar
                      photo={line.photo}
                      name={line.name}
                      className="h-9 w-9 rounded-xl text-[11px] ring-2 ring-ocean-100 dark:ring-ocean-800"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ocean-900 dark:text-white">
                        {line.name}
                      </p>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ocean-100/70 dark:bg-ocean-800/60">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-ocean-500 to-reef-500 dark:from-ocean-400 dark:to-reef-500"
                          style={{ width: `${Math.round((line.count / top) * 100)}%` }}
                        />
                      </div>
                    </div>
                    <p className="shrink-0 font-display text-base font-bold text-ocean-900 dark:text-white">
                      {line.count}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-ocean-200 px-6 py-6 text-center text-xs text-ocean-500 dark:border-ocean-800 dark:text-ocean-300/70">
              No ballots were cast in this election.
            </p>
          )}
        </div>
      )}

      {isAdmin && <ElectionAdminForm election={election} />}
    </div>
  );
}
