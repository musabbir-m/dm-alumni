'use client';

import { useActionState } from 'react';
import { CheckCircle2, Loader2, SearchCheck } from 'lucide-react';
import { verifyReceiptAction } from '@/lib/actions/election';
import type { VerifyReceiptState } from '@/lib/actions/election';
import { inputCls } from '@/components/form-ui';
import { normalizeReceiptCode, RECEIPT_CODE_LENGTH } from '@/lib/election-fields';

/**
 * Receipt inclusion check — a voter who kept their one-time code confirms
 * their ballot is in the box (and sees what it recorded). The code is
 * normalized as the member types (uppercase, separators stripped); the
 * server re-validates against the same pattern.
 */
export default function VerifyReceiptForm({ electionId }: { electionId: string }) {
  const [state, formAction, isPending] = useActionState<VerifyReceiptState, FormData>(
    verifyReceiptAction,
    { status: 'idle' }
  );

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="electionId" value={electionId} />
      <label
        htmlFor="receipt-code"
        className="mb-1.5 block text-sm font-medium text-ocean-700 dark:text-ocean-100/80"
      >
        Verify a receipt code
      </label>
      <div className="group relative">
        <SearchCheck className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ocean-400 transition-colors group-focus-within:text-ocean-600 dark:text-ocean-300 dark:group-focus-within:text-ocean-100" />
        <input
          id="receipt-code"
          name="receiptCode"
          type="text"
          inputMode="text"
          autoComplete="off"
          maxLength={RECEIPT_CODE_LENGTH + 1}
          placeholder={`${'X'.repeat(5)}-${'X'.repeat(5)}`}
          disabled={isPending}
          onChange={(e) => {
            e.target.value = normalizeReceiptCode(e.target.value);
          }}
          className={`${inputCls(!!(state.status === 'error'))} pl-10 font-mono uppercase tracking-widest`}
        />
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="inline-flex items-center gap-1.5 rounded-xl border border-ocean-200/70 bg-white/60 px-4 py-2 text-xs font-semibold text-ocean-700 transition-all hover:border-ocean-300 hover:text-ocean-900 disabled:opacity-60 dark:border-ocean-700/50 dark:bg-ocean-800/40 dark:text-ocean-200 dark:hover:border-ocean-600 dark:hover:text-white"
      >
        {isPending ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Checking…
          </>
        ) : (
          'Check my ballot'
        )}
      </button>

      {state.status === 'error' && (
        <p className="text-xs font-medium text-red-500 dark:text-red-400" role="alert">
          {state.message}
        </p>
      )}
      {state.status === 'success' && (
        <p
          className="flex items-start gap-2 rounded-xl border border-reef-200 bg-reef-50/80 px-4 py-3 text-sm font-medium text-reef-700 dark:border-reef-500/30 dark:bg-reef-500/10 dark:text-reef-300"
          role="status"
        >
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Confirmed — this ballot is in the box, recording a vote for{' '}
            <span className="font-bold">{state.candidateName}</span>.
          </span>
        </p>
      )}
    </form>
  );
}
