'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import {
  CheckCircle2, ChevronDown, GraduationCap, Loader2, Lock, Plus, Search,
  Trash2, X, Zap,
} from 'lucide-react';
import { batches, batchName } from '@/data/batches';
import {
  createElectionAction,
  closeElectionAction,
  fetchVerifiedMembersAction,
  openElectionAction,
  publishResultsAction,
  updateElectionConfigAction,
} from '@/lib/actions/election';
import type { CandidateMemberOption } from '@/lib/actions/election';
import type { ElectionView } from '@/lib/election';
import { PersonAvatar } from '@/components/wallet-ui';
import { Field, inputCls, iconCls } from '@/components/form-ui';

/**
 * The admin-only management card inside the Election tab (rendered under the
 * read-only monitoring). Not a <form action> — every mutation goes through
 * the direct-typed-args actions via useTransition (the AdminUserControls
 * pattern), and the successful revalidatePath('/admin') roundtrip refreshes
 * this panel's props in place, so no local success state needs mirroring.
 * Lifecycle states: draft → editor + Open; open → Close (inline confirm);
 * closed → Publish (inline confirm — results go live for everyone);
 * published → nothing left to manage.
 */

/** datetime-local (browser-local) ↔ ISO conversions for the schedule fields. */
const isoToLocalInput = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const localInputToIso = (v: string) => (v ? new Date(v).toISOString() : null);

/** A candidate being added in the editor (id is minted server-side on save). */
type SlateEntry = { userId: string; name: string; studentId: string; batch: string; photo: string };

export default function ElectionAdminForm({ election }: { election: ElectionView | null }) {
  // ─── No election yet: create one ─────────────────────────────────────
  if (!election) return <CreateElectionCard />;

  // ─── Lifecycle (open / closed) — no config editing once voting runs ──
  // The key matters: without it, React reconciles the close card into the
  // publish card after the close revalidation and PRESERVES its `armed`
  // state — so the publish confirm renders already-armed ("Yes, publish
  // now" with no first click), defeating the two-click confirm (a real
  // bug the e2e caught). Remounting per mode starts each phase disarmed.
  if (election.status === 'open')
    return <LifecycleCard key="close" election={election} mode="close" />;
  if (election.status === 'closed')
    return <LifecycleCard key="publish" election={election} mode="publish" />;
  if (election.status === 'published') return null;

  return <ConfigEditor election={election} />;
}

// ─── Create ───────────────────────────────────────────────────────────────

function CreateElectionCard() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    setError(null);
    if (!title.trim()) {
      setError('Give the election a title.');
      return;
    }
    startTransition(async () => {
      const result = await createElectionAction({ title, description });
      if (result.status === 'error') setError(result.message);
      // Success: revalidation ships the fresh election as props — local
      // fields are dead state the remounted editor re-initializes from.
    });
  };

  return (
    <div className="rounded-2xl border border-ocean-100 bg-white/50 p-5 dark:border-ocean-800/60 dark:bg-ocean-950/40">
      <p className="text-sm font-semibold text-ocean-900 dark:text-white">Create an election</p>
      <p className="mt-1 text-xs leading-relaxed text-ocean-500 dark:text-ocean-300/70">
        Set up the committee election — it stays a draft (invisible to members) until you open it.
      </p>
      <div className="mt-4 space-y-4">
        <Field id="new-election-title" label="Title">
          <input
            id="new-election-title"
            type="text"
            maxLength={120}
            value={title}
            disabled={pending}
            placeholder="e.g. Executive Committee Election 2026"
            onChange={(e) => setTitle(e.target.value)}
            className={inputCls()}
          />
        </Field>
        <Field id="new-election-description" label="Description" optional>
          <textarea
            id="new-election-description"
            rows={3}
            maxLength={600}
            value={description}
            disabled={pending}
            placeholder="What members are voting on — shown on the ballot."
            onChange={(e) => setDescription(e.target.value)}
            className={`${inputCls()} min-h-0 resize-y`}
          />
        </Field>
        {error && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300" role="alert">
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-ocean-500 to-reef-500 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-ocean-300/40 transition-all hover:brightness-110 disabled:opacity-60 dark:from-ocean-400 dark:to-reef-500 dark:text-ocean-950 dark:shadow-ocean-950/40"
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          Create election
        </button>
      </div>
    </div>
  );
}

// ─── Config editor (effective draft only) ────────────────────────────────

function ConfigEditor({ election }: { election: ElectionView }) {
  const [title, setTitle] = useState(election.title);
  const [description, setDescription] = useState(election.description);
  const [openAt, setOpenAt] = useState(isoToLocalInput(election.openAt));
  const [closeAt, setCloseAt] = useState(isoToLocalInput(election.closeAt));
  const [slate, setSlate] = useState<SlateEntry[]>(
    election.candidates.map((c) => ({
      userId: c.userId,
      name: c.name,
      studentId: c.studentId,
      batch: c.batch,
      photo: c.photo,
    }))
  );
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const hasUnsaved =
    title !== election.title ||
    description !== election.description ||
    openAt !== isoToLocalInput(election.openAt) ||
    closeAt !== isoToLocalInput(election.closeAt) ||
    slate.map((s) => s.userId).join(',') !==
      election.candidates.map((c) => c.userId).join(',');

  const save = () => {
    setError(null);
    setSuccess(null);
    if (!title.trim()) {
      setError('The election needs a title.');
      return;
    }
    if (openAt && closeAt && closeAt <= openAt) {
      setError('The close time must be after the open time.');
      return;
    }
    startTransition(async () => {
      const result = await updateElectionConfigAction({
        electionId: election.id,
        title,
        description,
        candidateUserIds: slate.map((s) => s.userId),
        openAt: localInputToIso(openAt),
        closeAt: localInputToIso(closeAt),
      });
      if (result.status === 'error') {
        setError(result.message);
        return;
      }
      setAddedIds(new Set());
      setSuccess('Election saved.');
    });
  };

  const openNow = () => {
    setError(null);
    startTransition(async () => {
      const result = await openElectionAction(election.id);
      if (result.status === 'error') setError(result.message);
    });
  };

  return (
    <div className="rounded-2xl border border-ocean-100 bg-white/50 p-5 dark:border-ocean-800/60 dark:bg-ocean-950/40">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-ocean-900 dark:text-white">Manage election</p>
        {hasUnsaved && (
          <span className="rounded-full bg-amber-100/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:bg-amber-400/20 dark:text-amber-300">
            Unsaved changes
          </span>
        )}
      </div>

      <div className="mt-4 space-y-4">
        <Field id="election-title" label="Title">
          <input
            id="election-title"
            type="text"
            maxLength={120}
            value={title}
            disabled={pending}
            onChange={(e) => setTitle(e.target.value)}
            className={inputCls()}
          />
        </Field>
        <Field id="election-description" label="Description" optional>
          <textarea
            id="election-description"
            rows={3}
            maxLength={600}
            value={description}
            disabled={pending}
            placeholder="What members are voting on — shown on the ballot."
            onChange={(e) => setDescription(e.target.value)}
            className={`${inputCls()} resize-y`}
          />
        </Field>

        {/* Schedule — optional; manual Open/Close always overrides it */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id="election-open-at" label="Opens at" optional>
            <input
              id="election-open-at"
              type="datetime-local"
              value={openAt}
              disabled={pending}
              onChange={(e) => setOpenAt(e.target.value)}
              className={inputCls()}
            />
          </Field>
          <Field id="election-close-at" label="Closes at" optional>
            <input
              id="election-close-at"
              type="datetime-local"
              value={closeAt}
              disabled={pending}
              onChange={(e) => setCloseAt(e.target.value)}
              className={inputCls()}
            />
          </Field>
        </div>
        <p className="text-xs leading-relaxed text-ocean-400 dark:text-ocean-300/60">
          Optional window — with both set, voting opens and closes by itself at these times
          (your timezone). Manual Open and Close buttons below always win.
        </p>

        {/* Candidate slate */}
        <div>
          <p className="mb-1.5 text-sm font-medium text-ocean-700 dark:text-ocean-100/80">
            Candidates ({slate.length})
          </p>
          {slate.length === 0 ? (
            <p className="rounded-xl border border-dashed border-ocean-200 px-4 py-4 text-center text-xs text-ocean-500 dark:border-ocean-800 dark:text-ocean-300/70">
              No candidates yet — add at least two from the verified member list below.
            </p>
          ) : (
            <ul className="space-y-2">
              {slate.map((c) => (
                <li
                  key={c.userId}
                  className="flex items-center gap-3 rounded-xl border border-ocean-100 bg-white/60 px-3 py-2.5 dark:border-ocean-800/60 dark:bg-ocean-950/40"
                >
                  <PersonAvatar
                    photo={c.photo}
                    name={c.name}
                    className="h-9 w-9 rounded-xl text-[11px] ring-2 ring-ocean-100 dark:ring-ocean-800"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ocean-900 dark:text-white">
                      {c.name}
                    </p>
                    <p className="truncate text-xs text-ocean-500 dark:text-ocean-300/70">
                      {c.studentId} · {batchShortOf(c.batch)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSlate((s) => s.filter((x) => x.userId !== c.userId));
                      setAddedIds((s) => {
                        const next = new Set(s);
                        next.delete(c.userId);
                        return next;
                      });
                    }}
                    disabled={pending}
                    aria-label={`Remove ${c.name} from the slate`}
                    className="shrink-0 rounded-lg p-1.5 text-ocean-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:text-ocean-300/60 dark:hover:bg-red-500/10 dark:hover:text-red-300"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <CandidatePicker
            electionId={election.id}
            addedIds={addedIds}
            onAdd={(m) => {
              setSlate((s) =>
                s.some((x) => x.userId === m.id)
                  ? s
                  : [
                      ...s,
                      { userId: m.id, name: m.name, studentId: m.studentId, batch: m.batch, photo: m.photo },
                    ]
              );
              setAddedIds((s) => new Set(s).add(m.id));
              setError(null);
              setSuccess(null);
            }}
            disabled={pending}
          />
        </div>

        {error && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300" role="alert">
            {error}
          </p>
        )}
        {success && (
          <p className="flex items-center gap-2 rounded-xl border border-reef-200 bg-reef-50/80 px-4 py-3 text-sm font-medium text-reef-700 dark:border-reef-500/30 dark:bg-reef-500/10 dark:text-reef-300" role="status">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {success}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2 border-t border-ocean-100 pt-4 dark:border-ocean-800/60">
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-ocean-500 to-reef-500 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-ocean-300/40 transition-all hover:brightness-110 disabled:opacity-60 dark:from-ocean-400 dark:to-reef-500 dark:text-ocean-950 dark:shadow-ocean-950/40"
          >
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            Save election
          </button>
          <button
            type="button"
            onClick={openNow}
            disabled={pending || hasUnsaved || election.candidates.length < 2}
            title={
              election.candidates.length < 2
                ? 'Add at least two candidates and save first'
                : hasUnsaved
                  ? 'Save your changes first'
                  : 'Opens voting immediately'
            }
            className="inline-flex items-center gap-1.5 rounded-xl border border-ocean-200/70 bg-white/60 px-4 py-2.5 text-xs font-semibold text-ocean-700 transition-all hover:border-ocean-300 disabled:cursor-not-allowed disabled:opacity-60 dark:border-ocean-700/50 dark:bg-ocean-800/40 dark:text-ocean-200 dark:hover:border-ocean-600 dark:hover:text-white"
          >
            <Zap className="h-3.5 w-3.5" />
            Open voting now
          </button>
        </div>
      </div>
    </div>
  );
}

/** "DSM 8th" — compact batch label for slate rows. */
const batchShortOf = (year: string) => {
  const info = batches.find((b) => b.year === year);
  return info ? `DSM ${info.batchNo}` : `Batch ${year}`;
};

// ─── Candidate combobox (the AddPaymentWalletForm picker, verified-only) ──

function CandidatePicker({
  electionId,
  addedIds,
  onAdd,
  disabled,
}: {
  electionId: string;
  addedIds: Set<string>;
  onAdd: (m: CandidateMemberOption) => void;
  disabled: boolean;
}) {
  const [batch, setBatch] = useState('');
  const [members, setMembers] = useState<CandidateMemberOption[] | null>(null);
  const [membersState, setMembersState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [membersError, setMembersError] = useState('');
  const [query, setQuery] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  const chooseBatch = (next: string) => {
    setBatch(next);
    setMembers(null);
    setMembersError('');
    setMembersState(next ? 'loading' : 'idle');
    setPickerOpen(false);
  };

  useEffect(() => {
    if (!batch) return;
    let cancelled = false;
    // 'loading' was set synchronously in chooseBatch (never in the effect —
    // sync setState here trips react-hooks/set-state-in-effect)
    fetchVerifiedMembersAction(batch, electionId)
      .then((res) => {
        if (cancelled) return;
        if (res.ok) {
          setMembers(res.members);
          setMembersState('idle');
        } else {
          setMembersError(res.message);
          setMembersState('error');
        }
      })
      .catch(() => {
        if (cancelled) return;
        setMembersError('Could not load the batch members. Please try again.');
        setMembersState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [batch, electionId]);

  useEffect(() => {
    if (!pickerOpen) return;
    const onDown = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [pickerOpen]);

  const filtered = useMemo(() => {
    if (!members) return [];
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.studentId.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q)
    );
  }, [members, query]);

  return (
    <div className="mt-3">
      <Field
        id="candidate-batch"
        label="Add a candidate"
        error={membersState === 'error' ? membersError : undefined}
      >
        <div className="group relative">
          <GraduationCap className={iconCls()} />
          <select
            id="candidate-batch"
            value={batch}
            disabled={disabled}
            onChange={(e) => chooseBatch(e.target.value)}
            className={`${inputCls()} appearance-none pr-10`}
          >
            <option value="">Pick a batch…</option>
            {batches.map((b) => (
              <option key={b.year} value={b.year}>
                {batchName(b)}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ocean-400 dark:text-ocean-300" />
        </div>
      </Field>

      {!!batch && membersState !== 'error' && (
        <div ref={pickerRef} className="relative">
          <div className="group relative mt-2">
            <Search className={iconCls()} />
            <input
              id="candidate-search"
              type="text"
              role="combobox"
              value={query}
              disabled={disabled}
              autoComplete="off"
              placeholder="Search verified members…"
              onChange={(e) => {
                setQuery(e.target.value);
                setPickerOpen(true);
              }}
              onFocus={() => setPickerOpen(true)}
              onKeyDown={(e) => e.key === 'Escape' && setPickerOpen(false)}
              aria-expanded={pickerOpen}
              aria-controls="candidate-member-list"
              aria-autocomplete="list"
              className={inputCls()}
            />
            {membersState === 'loading' && (
              <Loader2 className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-ocean-400" />
            )}
          </div>

          {pickerOpen && (
            <div
              id="candidate-member-list"
              role="listbox"
              aria-label="Verified members"
              className="absolute inset-x-0 top-full z-20 mt-2 max-h-64 overflow-y-auto rounded-xl border border-ocean-200 bg-white shadow-xl shadow-ocean-200/40 dark:border-ocean-800 dark:bg-ocean-900 dark:shadow-ocean-950/40"
            >
              {!members || members.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-ocean-500 dark:text-ocean-300/70">
                  No verified members in this batch yet.
                </p>
              ) : filtered.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-ocean-500 dark:text-ocean-300/70">
                  No members match “{query.trim()}”.
                </p>
              ) : (
                <ul className="divide-y divide-ocean-100 dark:divide-ocean-800/60">
                  {filtered.map((m) => {
                    const taken = m.isCandidate || addedIds.has(m.id);
                    return (
                      <li key={m.id}>
                        <div
                          role="option"
                          aria-selected={false}
                          aria-disabled={taken}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            if (!taken && !disabled) {
                              onAdd(m);
                              setPickerOpen(false); // the overlay would cover the Save button
                            }
                          }}
                          className={`flex items-center gap-3 px-4 py-2.5 ${
                            taken
                              ? 'cursor-not-allowed opacity-50'
                              : 'cursor-pointer hover:bg-ocean-50 dark:hover:bg-ocean-800/60'
                          }`}
                        >
                          <PersonAvatar
                            photo={m.photo}
                            name={m.name}
                            className="h-8 w-8 rounded-lg text-[10px] ring-1 ring-ocean-100 dark:ring-ocean-800"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-ocean-900 dark:text-white">
                              {m.name}
                            </p>
                            <p className="truncate text-xs text-ocean-500 dark:text-ocean-300/70">
                              {m.studentId} · {m.email}
                            </p>
                          </div>
                          {taken && (
                            <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-ocean-400 dark:text-ocean-300/60">
                              On the slate
                            </span>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Lifecycle cards (Close / Publish — both ask for a second click) ────

function LifecycleCard({ election, mode }: { election: ElectionView; mode: 'close' | 'publish' }) {
  const [armed, setArmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = () => {
    setError(null);
    startTransition(async () => {
      const result =
        mode === 'close'
          ? await closeElectionAction(election.id)
          : await publishResultsAction(election.id);
      if (result.status === 'error') {
        setError(result.message);
        setArmed(false);
      }
      // Success: revalidation flips this card via the fresh props.
    });
  };

  return (
    <div className="rounded-2xl border border-ocean-100 bg-white/50 p-5 dark:border-ocean-800/60 dark:bg-ocean-950/40">
      <p className="text-sm font-semibold text-ocean-900 dark:text-white">Manage election</p>

      {mode === 'close' ? (
        <>
          <p className="mt-1 text-xs leading-relaxed text-ocean-500 dark:text-ocean-300/70">
            Voting is open. Closing it is final — ballots already cast stay cast, but nobody
            else can vote afterwards.
          </p>
          {!armed ? (
            <button
              type="button"
              onClick={() => setArmed(true)}
              disabled={pending}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-ocean-200/70 bg-white/60 px-4 py-2.5 text-xs font-semibold text-ocean-700 transition-all hover:border-ocean-300 disabled:opacity-60 dark:border-ocean-700/50 dark:bg-ocean-800/40 dark:text-ocean-200 dark:hover:border-ocean-600 dark:hover:text-white"
            >
              <Lock className="h-3.5 w-3.5" />
              Close voting
            </button>
          ) : (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 dark:border-amber-500/30 dark:bg-amber-500/10">
              <p className="text-xs font-medium leading-relaxed text-amber-800 dark:text-amber-200">
                Close voting now? Members who haven&rsquo;t voted won&rsquo;t be able to.
              </p>
              <div className="mt-2.5 flex items-center gap-2">
                <button
                  type="button"
                  onClick={run}
                  disabled={pending}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-ocean-500 to-reef-500 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-ocean-300/40 transition-all hover:brightness-110 disabled:opacity-60 dark:from-ocean-400 dark:to-reef-500 dark:text-ocean-950 dark:shadow-ocean-950/40"
                >
                  {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />}
                  Yes, close voting
                </button>
                <button
                  type="button"
                  onClick={() => setArmed(false)}
                  disabled={pending}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-ocean-600 transition-colors hover:text-ocean-900 disabled:opacity-60 dark:text-ocean-300 dark:hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                  Cancel
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <p className="mt-1 text-xs leading-relaxed text-ocean-500 dark:text-ocean-300/70">
            Voting has closed. Publishing makes the tallies live for every member and stamps
            the verification fingerprint — have the results checked first.
          </p>
          {!armed ? (
            <button
              type="button"
              onClick={() => setArmed(true)}
              disabled={pending}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-ocean-500 to-reef-500 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-ocean-300/40 transition-all hover:brightness-110 disabled:opacity-60 dark:from-ocean-400 dark:to-reef-500 dark:text-ocean-950 dark:shadow-ocean-950/40"
            >
              <Zap className="h-3.5 w-3.5" />
              Publish results
            </button>
          ) : (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 dark:border-amber-500/30 dark:bg-amber-500/10">
              <p className="text-xs font-medium leading-relaxed text-amber-800 dark:text-amber-200">
                Publish now? Results appear for every member immediately, and the ballot-chain
                fingerprint is frozen from this moment on.
              </p>
              <div className="mt-2.5 flex items-center gap-2">
                <button
                  type="button"
                  onClick={run}
                  disabled={pending}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-ocean-500 to-reef-500 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-ocean-300/40 transition-all hover:brightness-110 disabled:opacity-60 dark:from-ocean-400 dark:to-reef-500 dark:text-ocean-950 dark:shadow-ocean-950/40"
                >
                  {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                  Yes, publish now
                </button>
                <button
                  type="button"
                  onClick={() => setArmed(false)}
                  disabled={pending}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-ocean-600 transition-colors hover:text-ocean-900 disabled:opacity-60 dark:text-ocean-300 dark:hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                  Cancel
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {error && (
        <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
