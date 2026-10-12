'use client';

import { useMemo, useState, useTransition } from 'react';
import { CheckCircle2, Loader2, Pencil, Wallet, X } from 'lucide-react';
import { batches, batchName } from '@/data/batches';
import { updatePaymentWalletAction } from '@/lib/actions/paymentWallets';
import type { WalletView } from '@/lib/payment-wallets';
import { normalizeWalletNumber } from '@/lib/wallet-fields';
import type { WalletType } from '@/lib/wallet-fields';
import { PersonAvatar, WalletBadge, WalletTypePicker } from '@/components/wallet-ui';
import { inputCls, iconCls } from '@/components/form-ui';

/**
 * The admin "Payment Wallets" tab — who currently receives member payments,
 * grouped by batch. Editing swaps a card for an inline editor (wallet service
 * + number; the receiver is locked identity) and saves through the action,
 * whose revalidatePath('/admin') ships fresh props for this panel. Every save
 * bumps the record's updatedAt, shown as an "Edited" note next to "Added".
 */

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

type Editing = { id: string; walletType: WalletType; walletNumber: string };

export default function PaymentWalletsPanel({ wallets }: { wallets: WalletView[] }) {
  const [editing, setEditing] = useState<Editing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [numberError, setNumberError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const groups = useMemo(() => {
    const map = new Map<string, WalletView[]>();
    for (const w of wallets) {
      const list = map.get(w.batch);
      if (list) list.push(w);
      else map.set(w.batch, [w]);
    }
    return [...map.entries()];
  }, [wallets]);

  const startEdit = (w: WalletView) => {
    setError(null);
    setNumberError(null);
    setEditing({ id: w.id, walletType: w.walletType, walletNumber: w.walletNumber });
  };

  const saveEdit = () => {
    if (!editing) return;
    setError(null);
    setNumberError(null);
    if (!normalizeWalletNumber(editing.walletNumber)) {
      setNumberError('Enter a valid Bangladeshi mobile number, e.g. 01XXXXXXXXX.');
      return;
    }
    startTransition(async () => {
      const result = await updatePaymentWalletAction({
        walletId: editing.id,
        walletType: editing.walletType,
        walletNumber: editing.walletNumber,
      });
      if (result.status === 'error') {
        if (result.field === 'walletNumber') setNumberError(result.message);
        else setError(result.message);
        return;
      }
      setEditing(null); // fresh props arrive via revalidatePath
    });
  };

  if (wallets.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-ocean-200 px-6 py-12 text-center dark:border-ocean-800">
        <Wallet className="h-8 w-8 text-ocean-300 dark:text-ocean-600" />
        <p className="text-sm font-medium text-ocean-700 dark:text-ocean-200">
          No payment wallets yet.
        </p>
        <p className="max-w-sm text-xs text-ocean-500 dark:text-ocean-300/70">
          Use the <span className="font-semibold">Add Payment Wallet</span> tab to choose who
          receives member payments for a batch.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map(([batchYear, list]) => {
        const info = batches.find((b) => b.year === batchYear);
        return (
          <section key={batchYear}>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ocean-900 dark:text-white">
              {info ? batchName(info) : `Batch ${batchYear}`}
              <span className="rounded-full bg-ocean-100 px-2 py-0.5 text-[10px] font-bold text-ocean-600 dark:bg-ocean-800 dark:text-ocean-300">
                {list.length}
              </span>
            </h3>
            <ul className="space-y-3">
              {list.map((w) =>
                editing?.id === w.id ? (
                  <li
                    key={w.id}
                    className="rounded-2xl border border-reef-300/70 bg-reef-50/50 p-4 dark:border-reef-500/40 dark:bg-reef-500/5"
                  >
                    <div className="flex items-center gap-3">
                      <PersonAvatar photo={w.photo} name={w.name} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-ocean-900 dark:text-white">
                          {w.name}
                        </p>
                        <p className="truncate text-xs text-ocean-500 dark:text-ocean-300/70">
                          {w.studentId} · receiver can&rsquo;t be changed
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 space-y-3">
                      <div>
                        <p className="mb-1.5 text-sm font-medium text-ocean-700 dark:text-ocean-100/80">
                          Wallet
                        </p>
                        <WalletTypePicker
                          value={editing.walletType}
                          onChange={(t) => setEditing((e) => (e ? { ...e, walletType: t } : e))}
                          disabled={pending}
                        />
                      </div>
                      <div>
                        <label
                          htmlFor={`wallet-num-${w.id}`}
                          className="mb-1.5 block text-sm font-medium text-ocean-700 dark:text-ocean-100/80"
                        >
                          Wallet Number
                        </label>
                        <div className="group relative">
                          <Wallet className={iconCls(!!numberError)} />
                          <input
                            id={`wallet-num-${w.id}`}
                            type="tel"
                            inputMode="tel"
                            value={editing.walletNumber}
                            disabled={pending}
                            placeholder="01XXXXXXXXX"
                            onChange={(e) =>
                              setEditing((ed) =>
                                ed ? { ...ed, walletNumber: e.target.value } : ed
                              )
                            }
                            aria-invalid={!!numberError}
                            className={inputCls(!!numberError)}
                          />
                        </div>
                        {numberError && (
                          <p
                            className="mt-1.5 text-xs font-medium text-red-500 dark:text-red-400"
                            role="alert"
                          >
                            {numberError}
                          </p>
                        )}
                      </div>
                      {error && (
                        <p
                          className="text-xs font-medium text-red-500 dark:text-red-400"
                          role="alert"
                        >
                          {error}
                        </p>
                      )}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={saveEdit}
                          disabled={pending}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-ocean-500 to-reef-500 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-ocean-300/40 transition-all hover:brightness-110 disabled:opacity-60 dark:from-ocean-400 dark:to-reef-500 dark:text-ocean-950 dark:shadow-ocean-950/40"
                        >
                          {pending ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          )}
                          Save changes
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditing(null)}
                          disabled={pending}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-ocean-200/70 bg-white/60 px-4 py-2 text-xs font-semibold text-ocean-700 transition-all hover:border-ocean-300 disabled:opacity-60 dark:border-ocean-700/50 dark:bg-ocean-800/40 dark:text-ocean-200"
                        >
                          <X className="h-3.5 w-3.5" />
                          Cancel
                        </button>
                      </div>
                    </div>
                  </li>
                ) : (
                  <li
                    key={w.id}
                    className="flex flex-wrap items-center gap-3 rounded-2xl border border-ocean-100 bg-white/50 px-4 py-3.5 dark:border-ocean-800/60 dark:bg-ocean-950/40"
                  >
                    <PersonAvatar photo={w.photo} name={w.name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ocean-900 dark:text-white">
                        {w.name}
                      </p>
                      <p className="truncate text-xs text-ocean-500 dark:text-ocean-300/70">
                        {w.studentId}
                      </p>
                    </div>
                    <div className="flex min-w-0 flex-col items-start gap-1 sm:items-end">
                      <div className="flex flex-wrap items-center gap-2">
                        <WalletBadge type={w.walletType} />
                        <a
                          href={`tel:${w.walletNumber}`}
                          className="font-mono text-sm font-semibold text-ocean-900 transition-colors hover:text-reef-600 dark:text-white dark:hover:text-reef-300"
                        >
                          {w.walletNumber}
                        </a>
                      </div>
                      <p className="text-[11px] text-ocean-400 dark:text-ocean-300/60">
                        Added {formatDate(w.createdAt)}
                        {w.edited && (
                          <span className="ml-1.5 font-medium text-ocean-500 dark:text-ocean-300">
                            · Edited {formatDate(w.updatedAt)}
                          </span>
                        )}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => startEdit(w)}
                      disabled={pending}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-ocean-200/70 bg-white/60 px-3 py-1.5 text-xs font-semibold text-ocean-700 transition-all hover:border-ocean-300 hover:text-ocean-900 disabled:opacity-60 dark:border-ocean-700/50 dark:bg-ocean-800/40 dark:text-ocean-200 dark:hover:border-ocean-600 dark:hover:text-white"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </button>
                  </li>
                )
              )}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
