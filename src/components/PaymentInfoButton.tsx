'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Info, X } from 'lucide-react';
import { PaymentReceiverCard } from '@/components/payment-ui';
import { PaymentStatusBadge } from '@/components/UserBadges';
import type { PaymentStatus } from '@/lib/models/User';
import type { WalletType } from '@/lib/wallet-fields';

/**
 * The Members list's payment-details trigger — a small info icon beside the
 * payment badge that opens a short modal with everything staff need to check
 * a dues payment: status, the receiver (name + wallet number, via the shared
 * read-only receiver card) and the member's submitted TrxID.
 *
 * The dialog renders through a portal on purpose: the dashboard card carries
 * backdrop-blur, and an ancestor with backdrop-filter becomes the containing
 * block for position:fixed descendants — a plain fixed overlay inside the
 * card would size and clip against the card, not the viewport. document.body
 * is only touched after a click, so SSR never sees the portal.
 */

/** Receiver display snapshot — the WalletView fields the card renders,
 *  without the wallet-management bookkeeping (userId/timestamps/edited). */
export type PaymentReceiverInfo = {
  name: string;
  studentId: string;
  batch: string;
  photo: string;
  walletType: WalletType;
  walletNumber: string;
};

export default function PaymentInfoButton({
  memberName,
  status,
  receiver,
  trxId,
}: {
  memberName: string;
  status: PaymentStatus;
  receiver: PaymentReceiverInfo;
  /** TrxID the member submitted as payment evidence ('' = none) */
  trxId: string;
}) {
  const [open, setOpen] = useState(false);

  // Escape closes; the page scroll locks while the dialog is up. Modal state
  // is click-driven, so this effect only ever runs in the browser.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Payment details for ${memberName}`}
        title="Payment details"
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-ocean-400 transition-colors hover:bg-ocean-100/70 hover:text-ocean-700 dark:text-ocean-300/50 dark:hover:bg-ocean-800/60 dark:hover:text-ocean-100"
      >
        <Info className="h-4 w-4" aria-hidden />
      </button>

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex animate-modal-fade items-end justify-center bg-ocean-950/60 p-4 backdrop-blur-sm sm:items-center"
            onClick={() => setOpen(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label={`Payment details — ${memberName}`}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md animate-modal-in rounded-2xl border border-ocean-100 bg-white p-5 shadow-2xl shadow-ocean-900/20 dark:border-ocean-800 dark:bg-ocean-900"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-display text-base font-bold text-ocean-900 dark:text-white">
                    Payment details
                  </h3>
                  <p className="mt-0.5 truncate text-xs font-medium text-ocean-500 dark:text-ocean-300/70">
                    {memberName}
                  </p>
                </div>
                <button
                  type="button"
                  autoFocus
                  onClick={() => setOpen(false)}
                  aria-label="Close payment details"
                  className="rounded-lg p-1.5 text-ocean-400 transition-colors hover:bg-ocean-100/70 hover:text-ocean-700 dark:text-ocean-300/60 dark:hover:bg-ocean-800/60 dark:hover:text-white"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>

              <div className="mt-4 flex items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-ocean-400 dark:text-ocean-300/50">
                  Status
                </span>
                <PaymentStatusBadge status={status} />
              </div>

              <p className="mb-1.5 mt-4 text-[10px] font-semibold uppercase tracking-wide text-ocean-400 dark:text-ocean-300/50">
                Receiver
              </p>
              <PaymentReceiverCard receiver={receiver} />

              {trxId ? (
                <div className="mt-4 rounded-xl border border-ocean-100 bg-ocean-50/70 p-3 dark:border-ocean-800/60 dark:bg-ocean-950/40">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-ocean-400 dark:text-ocean-300/50">
                    Transaction ID
                  </p>
                  <p className="mt-1 break-all font-mono text-sm font-semibold text-ocean-900 dark:text-white">
                    {trxId}
                  </p>
                </div>
              ) : (
                <p className="mt-4 text-xs leading-relaxed text-ocean-500 dark:text-ocean-300/70">
                  No transaction ID submitted yet — the member chose this
                  receiver but hasn&rsquo;t reported a payment.
                </p>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
