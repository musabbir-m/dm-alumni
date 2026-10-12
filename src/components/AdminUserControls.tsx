'use client';

import { useState, useTransition } from 'react';
import {
  ShieldCheck, ArrowDownRight, CheckCircle2, XCircle, Loader2, Banknote, RotateCcw,
} from 'lucide-react';
import {
  updateUserRoleAction,
  updateUserVerificationAction,
  updateUserPaymentAction,
} from '@/lib/actions/admin';
import type { AdminResult } from '@/lib/admin';
import type { Role, VerificationStatus, PaymentStatus } from '@/lib/models/User';

/**
 * Per-row action island for the admin member list. The server renders the
 * row; only these buttons hydrate, so pending/error state stays scoped to
 * one member. On success the action's revalidatePath('/admin') ships fresh
 * props for the whole list — no client-side refresh code needed.
 *
 * Admins get the role toggle plus Approve/Reject; moderators — for whom the
 * page only renders this component on their own batch's rows — get the
 * verification + payment controls only (canToggleRole=false). Payment
 * buttons follow the member-driven flow: "Mark paid" appears only once the
 * member submitted a TrxID (paymentStatus 'pending'), "Reset payment" only
 * while 'paid' — unpaid rows show neither.
 */
export default function AdminUserControls({
  userId,
  role,
  status,
  paymentStatus,
  canToggleRole,
}: {
  userId: string;
  role: Role;
  status: VerificationStatus;
  paymentStatus: PaymentStatus;
  canToggleRole: boolean;
}) {
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState<'role' | 'approve' | 'reject' | 'payment' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = (
    kind: 'role' | 'approve' | 'reject' | 'payment',
    action: () => Promise<AdminResult>
  ) => {
    setError(null);
    setBusy(kind);
    startTransition(async () => {
      const result = await action();
      setBusy(null);
      if (result.status === 'error') setError(result.message);
      // ok → fresh props arrive via revalidatePath
    });
  };

  const pending = busy !== null;

  return (
    <div className="flex flex-col items-start gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        {canToggleRole && (
          <button
            type="button"
            disabled={pending}
            title={role === 'moderator' ? 'Demote to alumni' : 'Promote to moderator'}
            onClick={() =>
              run('role', () =>
                updateUserRoleAction(userId, role === 'moderator' ? 'alumni' : 'moderator')
              )
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-ocean-200/70 bg-white/60 px-3 py-1.5 text-xs font-semibold text-ocean-700 transition-all hover:border-ocean-300 hover:text-ocean-900 disabled:opacity-60 dark:border-ocean-700/50 dark:bg-ocean-800/40 dark:text-ocean-200 dark:hover:border-ocean-600 dark:hover:text-white"
          >
            {busy === 'role' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : role === 'moderator' ? (
              <ArrowDownRight className="h-3.5 w-3.5" />
            ) : (
              <ShieldCheck className="h-3.5 w-3.5" />
            )}
            {role === 'moderator' ? 'Demote' : 'Promote'}
          </button>
        )}

        <button
          type="button"
          disabled={pending || status === 'verified'}
          title={status === 'verified' ? 'Already verified' : undefined}
          onClick={() => run('approve', () => updateUserVerificationAction(userId, 'verified'))}
          className="inline-flex items-center gap-1.5 rounded-lg border border-reef-300/70 bg-reef-50/70 px-3 py-1.5 text-xs font-semibold text-reef-700 transition-all hover:border-reef-400 hover:text-reef-800 disabled:opacity-60 dark:border-reef-500/40 dark:bg-reef-500/10 dark:text-reef-300 dark:hover:border-reef-500/60 dark:hover:text-reef-200"
        >
          {busy === 'approve' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5" />
          )}
          Approve
        </button>

        <button
          type="button"
          disabled={pending || status === 'rejected'}
          title={status === 'rejected' ? 'Already rejected' : undefined}
          onClick={() => run('reject', () => updateUserVerificationAction(userId, 'rejected'))}
          className="inline-flex items-center gap-1.5 rounded-lg border border-red-200/80 bg-red-50/60 px-3 py-1.5 text-xs font-semibold text-red-600 transition-all hover:border-red-300 hover:text-red-700 disabled:opacity-60 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300 dark:hover:border-red-500/50 dark:hover:text-red-200"
        >
          {busy === 'reject' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <XCircle className="h-3.5 w-3.5" />
          )}
          Reject
        </button>

        {paymentStatus === 'pending' && (
          <button
            type="button"
            disabled={pending}
            title="Confirm the member's payment"
            onClick={() => run('payment', () => updateUserPaymentAction(userId, 'paid'))}
            className="inline-flex items-center gap-1.5 rounded-lg border border-reef-300/70 bg-reef-50/70 px-3 py-1.5 text-xs font-semibold text-reef-700 transition-all hover:border-reef-400 hover:text-reef-800 disabled:opacity-60 dark:border-reef-500/40 dark:bg-reef-500/10 dark:text-reef-300 dark:hover:border-reef-500/60 dark:hover:text-reef-200"
          >
            {busy === 'payment' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Banknote className="h-3.5 w-3.5" />
            )}
            Mark paid
          </button>
        )}

        {paymentStatus === 'paid' && (
          <button
            type="button"
            disabled={pending}
            title="Set payment back to pending"
            onClick={() => run('payment', () => updateUserPaymentAction(userId, 'pending'))}
            className="inline-flex items-center gap-1.5 rounded-lg border border-ocean-200/70 bg-white/60 px-3 py-1.5 text-xs font-semibold text-ocean-700 transition-all hover:border-ocean-300 hover:text-ocean-900 disabled:opacity-60 dark:border-ocean-700/50 dark:bg-ocean-800/40 dark:text-ocean-200 dark:hover:border-ocean-600 dark:hover:text-white"
          >
            {busy === 'payment' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RotateCcw className="h-3.5 w-3.5" />
            )}
            Reset payment
          </button>
        )}
      </div>

      {error && (
        <p className="text-xs font-medium text-red-500 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
