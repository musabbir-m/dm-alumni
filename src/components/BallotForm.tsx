'use client';

import { useActionState, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, Loader2, ShieldCheck, Vote, X } from 'lucide-react';
import { batches } from '@/data/batches';
import { castVoteAction } from '@/lib/actions/election';
import type { CastVoteState } from '@/lib/actions/election';
import type { CandidateView } from '@/lib/election';
import { PersonAvatar } from '@/components/wallet-ui';

/**
 * The member-facing ballot — every candidate as a selectable panel, one pick,
 * one submission. The pick rides a hidden `choice` input (the docType pattern:
 * interactive React state submits through a named hidden input), and the
 * submit opens a confirmation modal before the ballot is final — a vote can
 * never be changed once cast, so the last click deserves a summary review.
 *
 * The modal renders through a portal: this page's card carries backdrop-blur,
 * and an ancestor with backdrop-filter becomes the containing block for
 * position:fixed descendants (the PaymentInfoButton gotcha) — an in-card
 * fixed overlay would size and clip against the card, not the viewport. The
 * portal only mounts after a click, so SSR never sees it.
 */

/** "DSM 8th (Session 2018-19)" — compact label for candidate cards. */
const batchLabelOf = (year: string) => {
  const info = batches.find((b) => b.year === year);
  return info ? `DSM ${info.batchNo} (Session ${info.session})` : `Batch ${year}`;
};

const FORM_ID = 'ballot-form';

export default function BallotForm({
  electionId,
  title,
  description,
  candidates,
  closesAt,
}: {
  electionId: string;
  title: string;
  description: string;
  candidates: CandidateView[];
  closesAt: string | null;
}) {
  const [state, formAction, isPending] = useActionState<CastVoteState, FormData>(
    castVoteAction,
    { status: 'idle' }
  );
  const [choice, setChoice] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  const chosen = candidates.find((c) => c.id === choice) ?? null;
  const serverChoiceError =
    state.status === 'error' && state.errors.choice ? state.errors.choice : null;
  const formError =
    state.status === 'error' && state.message ? state.message : null;

  // ─── Success: the receipt is shown exactly once, here ────────────────
  if (state.status === 'success') {
    const code = state.receipt;
    const formatted = `${code.slice(0, 5)}-${code.slice(5)}`;
    return (
      <div className="rounded-2xl border border-reef-300/70 bg-reef-50/70 p-6 text-center dark:border-reef-500/40 dark:bg-reef-500/10">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-ocean-500 to-reef-500 text-white dark:from-ocean-400 dark:to-reef-500 dark:text-ocean-950">
          <CheckCircle2 className="h-7 w-7" />
        </span>
        <h3 className="mt-4 font-display text-lg font-bold text-ocean-900 dark:text-white">
          Your ballot is cast
        </h3>
        <p className="mt-1 text-sm leading-relaxed text-ocean-600 dark:text-ocean-200">
          Your vote is recorded anonymously and can never be changed. Keep this
          receipt code — it&rsquo;s the only way to confirm your ballot later:
        </p>
        <p className="mt-4 select-all font-mono text-2xl font-bold tracking-widest text-ocean-900 dark:text-white">
          {formatted}
        </p>
        <p className="mt-4 text-xs leading-relaxed text-ocean-500 dark:text-ocean-300/70">
          Write it down or screenshot this page now — the code is never shown
          again. Enter it below or on this page any time to confirm your ballot
          is in the box.
        </p>
      </div>
    );
  }

  return (
    <form id={FORM_ID} action={formAction} className="space-y-5">
      <input type="hidden" name="electionId" value={electionId} />
      <input type="hidden" name="choice" value={choice} />

      <div>
        <h2 className="font-display text-lg font-bold tracking-tight text-ocean-900 dark:text-white">
          {title}
        </h2>
        {description && (
          <p className="mt-1.5 text-sm leading-relaxed text-ocean-600 dark:text-ocean-200">
            {description}
          </p>
        )}
        <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-ocean-400 dark:text-ocean-300/60">
          <ShieldCheck className="h-3.5 w-3.5" />
          One vote per member · your ballot is anonymous and final
          {closesAt ? ` · voting closes ${formatClosesAt(closesAt)}` : ''}
        </p>
      </div>

      {/* Candidate panels — one pick */}
      <div role="radiogroup" aria-label="Candidates" className="grid gap-3">
        {candidates.map((c) => {
          const selected = choice === c.id;
          return (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={isPending}
              onClick={() => setChoice(c.id)}
              className={`flex items-center gap-4 rounded-2xl border p-4 text-left transition-all disabled:opacity-60 ${
                selected
                  ? 'border-reef-500 bg-reef-50/70 ring-2 ring-reef-400/25 dark:border-reef-500/60 dark:bg-reef-500/10'
                  : 'border-ocean-200 bg-white/50 hover:border-ocean-300 dark:border-ocean-800 dark:bg-ocean-950/40 dark:hover:border-ocean-700'
              }`}
            >
              <PersonAvatar
                photo={c.photo}
                name={c.name}
                className="h-12 w-12 rounded-xl text-sm ring-2 ring-ocean-100 dark:ring-ocean-800"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ocean-900 dark:text-white">
                  {c.name}
                </p>
                <p className="truncate text-xs text-ocean-500 dark:text-ocean-300/70">
                  {c.studentId} · {batchLabelOf(c.batch)}
                </p>
              </div>
              <span
                aria-hidden
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                  selected
                    ? 'border-reef-500 bg-reef-500'
                    : 'border-ocean-300 dark:border-ocean-600'
                }`}
              >
                {selected && <span className="h-1.5 w-1.5 rounded-full bg-white dark:bg-ocean-950" />}
              </span>
            </button>
          );
        })}
      </div>

      {(serverChoiceError || formError) && (
        <p
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
          role="alert"
        >
          {serverChoiceError ?? formError}
        </p>
      )}

      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          if (!choice) return; // the confirm modal explains an empty pick below
          setConfirmOpen(true);
        }}
        className={`group relative inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl px-6 py-3.5 text-sm font-semibold transition-all ${
          choice
            ? 'bg-gradient-to-r from-ocean-500 to-reef-500 text-white shadow-xl shadow-ocean-300/40 hover:brightness-110 dark:from-ocean-400 dark:to-reef-500 dark:text-ocean-950 dark:shadow-ocean-950/40'
            : 'cursor-not-allowed bg-ocean-100 text-ocean-400 dark:bg-ocean-800/60 dark:text-ocean-300/50'
        }`}
      >
        <span className="relative z-10 inline-flex items-center gap-2">
          <Vote className="h-4 w-4" />
          {choice ? 'Review your ballot' : 'Pick a candidate to continue'}
        </span>
      </button>
      {!choice && (
        <p className="text-center text-xs text-ocean-400 dark:text-ocean-300/60">
          Choose a candidate panel above, then review and cast your ballot.
        </p>
      )}

      {/* ─── Confirmation modal — the finality gate ─── */}
      {confirmOpen &&
        chosen &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex animate-modal-fade items-end justify-center bg-ocean-950/60 p-4 backdrop-blur-sm sm:items-center"
            onClick={() => !isPending && setConfirmOpen(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Confirm your ballot"
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md animate-modal-in rounded-2xl border border-ocean-100 bg-white p-5 shadow-2xl shadow-ocean-900/20 dark:border-ocean-800 dark:bg-ocean-900"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-display text-base font-bold text-ocean-900 dark:text-white">
                    Confirm your ballot
                  </h3>
                  <p className="mt-0.5 text-xs font-medium text-ocean-500 dark:text-ocean-300/70">
                    This is your one and only vote
                  </p>
                </div>
                <button
                  type="button"
                  autoFocus
                  onClick={() => !isPending && setConfirmOpen(false)}
                  aria-label="Cancel casting the ballot"
                  disabled={isPending}
                  className="rounded-lg p-1.5 text-ocean-400 transition-colors hover:bg-ocean-100/70 hover:text-ocean-700 disabled:opacity-50 dark:text-ocean-300/60 dark:hover:bg-ocean-800/60 dark:hover:text-white"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>

              <div className="mt-4 flex items-center gap-3 rounded-xl border border-reef-300/70 bg-reef-50/70 p-3 dark:border-reef-500/40 dark:bg-reef-500/10">
                <PersonAvatar
                  photo={chosen.photo}
                  name={chosen.name}
                  className="h-10 w-10 rounded-xl text-xs ring-2 ring-ocean-100 dark:ring-ocean-800"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ocean-900 dark:text-white">
                    {chosen.name}
                  </p>
                  <p className="truncate text-xs text-ocean-500 dark:text-ocean-300/70">
                    {chosen.studentId} · {batchLabelOf(chosen.batch)}
                  </p>
                </div>
              </div>

              <p className="mt-4 text-xs leading-relaxed text-ocean-500 dark:text-ocean-300/70">
                Once you cast it, this ballot is final — it can never be
                changed or recast. Nobody, not even the staff, can see who you
                voted for.
              </p>

              {formError && (
                <p
                  className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
                  role="alert"
                >
                  {formError}
                </p>
              )}

              <div className="mt-5 flex items-center gap-2">
                <button
                  type="submit"
                  form={FORM_ID}
                  disabled={isPending}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-ocean-500 to-reef-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-ocean-300/40 transition-all hover:brightness-110 disabled:opacity-60 dark:from-ocean-400 dark:to-reef-500 dark:text-ocean-950 dark:shadow-ocean-950/40"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Casting your ballot…
                    </>
                  ) : (
                    <>
                      <Vote className="h-4 w-4" />
                      Cast my vote
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => !isPending && setConfirmOpen(false)}
                  disabled={isPending}
                  className="rounded-xl border border-ocean-200/70 bg-white/60 px-4 py-2.5 text-sm font-semibold text-ocean-700 transition-all hover:border-ocean-300 disabled:opacity-60 dark:border-ocean-700/50 dark:bg-ocean-800/40 dark:text-ocean-200"
                >
                  Go back
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </form>
  );
}

/** Friendly local close time — "30 Nov 2026, 10:00 PM". */
function formatClosesAt(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
