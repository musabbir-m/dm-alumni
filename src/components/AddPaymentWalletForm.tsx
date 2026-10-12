'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import {
  CheckCircle2, ChevronDown, GraduationCap, Loader2, Search, UserRound, Wallet, X,
} from 'lucide-react';
import { batches, batchName } from '@/data/batches';
import { addPaymentWalletAction, fetchBatchMembersAction } from '@/lib/actions/paymentWallets';
import type { MemberOption } from '@/lib/actions/paymentWallets';
import { WALLET_TYPE_META, normalizeWalletNumber } from '@/lib/wallet-fields';
import type { WalletType } from '@/lib/wallet-fields';
import { PersonAvatar, WalletTypePicker } from '@/components/wallet-ui';
import { Field, inputCls, iconCls } from '@/components/form-ui';

/**
 * Step-guided form behind the admin "Add Payment Wallet" tab: pick the
 * member's batch, search/select the member (registered members only — the
 * roster without an account has no profile), choose their mobile-wallet
 * service, and enter the wallet's number. Not a <form action> — the action is
 * called with typed args via useTransition (the AdminUserControls pattern),
 * which also sidesteps React's form auto-reset on controlled selects.
 */
export default function AddPaymentWalletForm() {
  const [batch, setBatch] = useState('');
  const [members, setMembers] = useState<MemberOption[] | null>(null);
  const [membersState, setMembersState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [membersError, setMembersError] = useState('');
  const [person, setPerson] = useState<MemberOption | null>(null);
  const [query, setQuery] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [walletType, setWalletType] = useState<WalletType>('bkash');
  const [number, setNumber] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [numberError, setNumberError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const pickerRef = useRef<HTMLDivElement>(null);

  // Reset in the handler, not an effect — sync setState during effects trips
  // react-hooks/set-state-in-effect, and the fetch below only sets state from
  // async callbacks.
  const chooseBatch = (next: string) => {
    setBatch(next);
    setPerson(null);
    setQuery('');
    setPickerOpen(false);
    setError(null);
    setNumberError(null);
    setSuccess(null);
    setMembers(null);
    setMembersError('');
    setMembersState(next ? 'loading' : 'idle');
  };

  // Load the batch's registered members whenever the batch changes. A stale
  // response for a previous batch can't land — the cleanup flag cancels it.
  useEffect(() => {
    if (!batch) return;
    let cancelled = false;
    fetchBatchMembersAction(batch)
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
  }, [batch]);

  // Close the member dropdown on outside clicks
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

  const choosePerson = (m: MemberOption) => {
    setPerson(m);
    setQuery('');
    setPickerOpen(false);
    setError(null);
    setNumberError(null);
    setSuccess(null);
  };

  const submit = () => {
    setError(null);
    setNumberError(null);
    setSuccess(null);
    if (!person) {
      setError('Select the member who will receive the payments.');
      return;
    }
    const normalized = normalizeWalletNumber(number);
    if (!normalized) {
      setNumberError('Enter a valid Bangladeshi mobile number, e.g. 01XXXXXXXXX.');
      return;
    }
    const chosen = person;
    startTransition(async () => {
      const result = await addPaymentWalletAction({
        userId: chosen.id,
        walletType,
        walletNumber: number,
      });
      if (result.status === 'error') {
        if (result.field === 'walletNumber') setNumberError(result.message);
        else setError(result.message);
        return;
      }
      setSuccess(
        `${chosen.name} now receives payments via ${WALLET_TYPE_META[walletType].label} ${normalized}.`
      );
      // Ready the picker for the next add: same batch stays selected, the
      // just-added member flips to "has wallet" locally (the revalidated page
      // payload confirms it on the next roundtrip).
      setPerson(null);
      setNumber('');
      setMembers(
        (prev) => prev?.map((m) => (m.id === chosen.id ? { ...m, hasWallet: true } : m)) ?? prev
      );
    });
  };

  const canSubmit = !!person && number.trim().length > 0 && !pending;

  return (
    <div className="max-w-xl space-y-5">
      <p className="text-sm text-ocean-600/70 dark:text-ocean-100/70">
        Register a member as a payment receiver — pick their batch, find them in the
        member list, and enter the mobile wallet payments should go to.
      </p>

      {/* 1 — Batch */}
      <Field id="wallet-batch" label="Batch">
        <div className="group relative">
          <GraduationCap className={iconCls()} />
          <select
            id="wallet-batch"
            value={batch}
            onChange={(e) => chooseBatch(e.target.value)}
            className={`${inputCls()} appearance-none pr-10`}
          >
            <option value="">Select a batch…</option>
            {batches.map((b) => (
              <option key={b.year} value={b.year}>
                {batchName(b)}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ocean-400 dark:text-ocean-300" />
        </div>
      </Field>

      {/* 2 — Member */}
      <Field id="wallet-member" label="Member" error={membersState === 'error' ? membersError : undefined}>
        {person ? (
          <div className="flex items-center gap-3 rounded-xl border border-reef-300/70 bg-reef-50/70 p-3 dark:border-reef-500/40 dark:bg-reef-500/10">
            <PersonAvatar photo={person.photo} name={person.name} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ocean-900 dark:text-white">
                {person.name}
              </p>
              <p className="truncate text-xs text-ocean-500 dark:text-ocean-300/70">
                {person.studentId} · {person.email}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPerson(null)}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-ocean-600 transition-colors hover:bg-ocean-100 hover:text-ocean-900 dark:text-ocean-300 dark:hover:bg-ocean-800 dark:hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
              Change
            </button>
          </div>
        ) : (
          <div ref={pickerRef} className="relative">
            <div className="group relative">
              <Search className={iconCls()} />
              <input
                id="wallet-member"
                type="text"
                role="combobox"
                value={query}
                disabled={!batch}
                autoComplete="off"
                placeholder={
                  !batch ? 'Select a batch first' : 'Search by name, Student ID, or email'
                }
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPickerOpen(true);
                }}
                onFocus={() => setPickerOpen(true)}
                onKeyDown={(e) => e.key === 'Escape' && setPickerOpen(false)}
                aria-expanded={pickerOpen}
                aria-controls="wallet-member-list"
                aria-autocomplete="list"
                className={inputCls()}
              />
              {membersState === 'loading' && (
                <Loader2 className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-ocean-400" />
              )}
            </div>

            {pickerOpen && !!batch && membersState !== 'error' && (
              <div
                id="wallet-member-list"
                role="listbox"
                aria-label="Members"
                className="absolute inset-x-0 top-full z-20 mt-2 max-h-64 overflow-y-auto rounded-xl border border-ocean-200 bg-white shadow-xl shadow-ocean-200/40 dark:border-ocean-800 dark:bg-ocean-900 dark:shadow-ocean-950/40"
              >
                {membersState === 'loading' ? (
                  <p className="px-4 py-6 text-center text-sm text-ocean-500 dark:text-ocean-300/70">
                    Loading members…
                  </p>
                ) : !members || members.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-ocean-500 dark:text-ocean-300/70">
                    No registered members in this batch yet.
                  </p>
                ) : filtered.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-ocean-500 dark:text-ocean-300/70">
                    No members match “{query.trim()}”.
                  </p>
                ) : (
                  <ul className="divide-y divide-ocean-100 dark:divide-ocean-800/60">
                    {filtered.map((m) => (
                      <li key={m.id}>
                        {/* onMouseDown so the pick lands before the input's blur */}
                        <div
                          role="option"
                          aria-selected={false}
                          aria-disabled={m.hasWallet}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            if (!m.hasWallet) choosePerson(m);
                          }}
                          className={`flex items-center gap-3 px-4 py-2.5 ${
                            m.hasWallet
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
                          {m.hasWallet && (
                            <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-ocean-400 dark:text-ocean-300/60">
                              Has wallet
                            </span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </Field>

      {/* 3 — Wallet service */}
      <Field id="wallet-type" label="Wallet">
        <WalletTypePicker value={walletType} onChange={setWalletType} disabled={pending} />
      </Field>

      {/* 4 — Number */}
      <Field
        id="wallet-number"
        label="Wallet Number"
        error={numberError ?? undefined}
      >
        <div className="group relative">
          <UserRound className={iconCls(!!numberError)} />
          <input
            id="wallet-number"
            type="tel"
            inputMode="tel"
            value={number}
            disabled={!person}
            autoComplete="off"
            placeholder="01XXXXXXXXX"
            onChange={(e) => setNumber(e.target.value)}
            aria-invalid={!!numberError}
            className={inputCls(!!numberError)}
          />
        </div>
        <p className="mt-1.5 text-xs text-ocean-400 dark:text-ocean-300/60">
          The mobile number of the member&rsquo;s {WALLET_TYPE_META[walletType].label} wallet —
          stored normalized as 01XXXXXXXXX.
        </p>
      </Field>

      {error && (
        <p
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
          role="alert"
        >
          {error}
        </p>
      )}
      {success && (
        <p
          className="flex items-center gap-2 rounded-xl border border-reef-200 bg-reef-50/80 px-4 py-3 text-sm font-medium text-reef-700 dark:border-reef-500/30 dark:bg-reef-500/10 dark:text-reef-300"
          role="status"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {success}
        </p>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={!canSubmit}
        title={!person ? 'Select a member first' : undefined}
        className="group relative inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-ocean-500 to-reef-500 px-6 py-3.5 text-sm font-semibold text-white shadow-xl shadow-ocean-300/40 transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 dark:from-ocean-400 dark:to-reef-500 dark:text-ocean-950 dark:shadow-ocean-950/40"
      >
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Adding wallet…
          </>
        ) : (
          <>
            <span className="relative z-10 inline-flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              Add payment wallet
            </span>
            <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
          </>
        )}
      </button>
    </div>
  );
}
