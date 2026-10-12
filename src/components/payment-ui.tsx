import type { Ref } from 'react';
import { ChevronDown, Hash } from 'lucide-react';
import { batches, batchName } from '@/data/batches';
import { WalletBadge, PersonAvatar } from '@/components/wallet-ui';
import { WALLET_TYPES, WALLET_TYPE_META } from '@/lib/wallet-fields';
import type { GatewayFilter } from '@/lib/wallet-fields';
import { Field, iconCls, inputCls } from '@/components/form-ui';
import type { WalletView } from '@/lib/payment-wallets';

/**
 * Presentational pieces for the member-facing payment choice — who the member
 * pays their membership dues to. Like wallet-ui, this file carries no
 * directive and NO hooks: the server /profile page imports
 * PaymentReceiverCard, and client forms import PaymentReceiverPicker — state
 * stays with whichever parent renders them.
 */

const batchLabelOf = (year: string) => {
  const info = batches.find((b) => b.year === year);
  return info ? batchName(info) : `Batch ${year}`;
};

/** Compact "DSM 8th" style label for the receiver <option> rows. */
const shortBatchOf = (year: string) => {
  const info = batches.find((b) => b.year === year);
  return info ? `DSM ${info.batchNo}` : `Batch ${year}`;
};

/** Gateway-filtered receiver dropdown + transaction ID. Submits via the
 *  hidden paymentReceiverId input and the named paymentTransactionId input —
 *  the selects themselves carry no name. React's form auto-reset snaps a
 *  controlled <select> back to its first option on every action response,
 *  so parents attach refs (below) and re-assert the values in their
 *  existing [state] effect — the batchRef pattern. */
export function PaymentReceiverPicker({
  receivers,
  gateway,
  onGatewayChange,
  value,
  onChange,
  memberBatch,
  transactionId,
  onTransactionIdChange,
  error,
  transactionError,
  gatewayRef,
  receiverRef,
}: {
  receivers: WalletView[];
  /** UI-only gateway filter — narrows the receiver dropdown */
  gateway: GatewayFilter;
  onGatewayChange: (gateway: GatewayFilter) => void;
  /** wallet id, or '' to skip */
  value: string;
  onChange: (id: string) => void;
  /** the member's own batch year ('' before they pick one) */
  memberBatch: string;
  /** TrxID from the member's payment receipt ('' = none yet) */
  transactionId: string;
  onTransactionIdChange: (trx: string) => void;
  error?: string;
  transactionError?: string;
  /** re-assert handles for the two selects (the auto-reset fix, see above) */
  gatewayRef?: Ref<HTMLSelectElement>;
  receiverRef?: Ref<HTMLSelectElement>;
}) {
  const filtered =
    gateway === 'all' ? receivers : receivers.filter((r) => r.walletType === gateway);
  // Own-batch receivers first — the instruction says to prefer them. Tiny
  // list, so the sort runs inline on every render (no useMemo: this module
  // must stay hook-free for the server graph that imports the card below).
  const sorted = memberBatch
    ? [...filtered].sort(
        (a, b) => Number(b.batch === memberBatch) - Number(a.batch === memberBatch)
      )
    : filtered;

  const handleGateway = (next: string) => {
    onGatewayChange(next as GatewayFilter);
    // Switching the filter away from the picked receiver's gateway would
    // leave a selected id that's no longer visible — reset to "skip".
    const upcoming = next === 'all' ? receivers : receivers.filter((r) => r.walletType === next);
    if (value && !upcoming.some((r) => r.id === value)) onChange('');
  };

  return (
    <div>
      <input type="hidden" name="paymentReceiverId" value={value} />
      <p className="mb-1.5 text-sm font-medium text-ocean-700 dark:text-ocean-100/80">
        Membership payment
      </p>
      <p className="mb-2.5 text-xs leading-relaxed text-ocean-500 dark:text-ocean-300/70">
        {memberBatch
          ? 'Pay your membership dues to a receiver from your own batch — theirs is marked “Your batch” in the list. You can skip this and choose later from your profile.'
          : 'Pick your batch above, then choose the receiver you’ll pay your membership dues to. You can also skip this for now.'}
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="payment-gateway" label="Payment gateway">
          <div className="group relative">
            <select
              id="payment-gateway"
              ref={gatewayRef}
              value={gateway}
              onChange={(e) => handleGateway(e.target.value)}
              className={`${inputCls()} appearance-none pr-10`}
            >
              <option value="all">All gateways</option>
              {WALLET_TYPES.map((type) => (
                <option key={type} value={type}>
                  {WALLET_TYPE_META[type].label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ocean-400 dark:text-ocean-300" />
          </div>
        </Field>

        <Field id="payment-receiver" label="Payment receiver" error={error}>
          <div className="group relative">
            <select
              id="payment-receiver"
              ref={receiverRef}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              aria-invalid={!!error}
              className={`${inputCls(!!error)} appearance-none pr-10`}
            >
              <option value="">Skip for now — choose later</option>
              {sorted.map((r) => (
                <option key={r.id} value={r.id}>
                  {`${r.name} — ${shortBatchOf(r.batch)} · ${WALLET_TYPE_META[r.walletType].label} ${r.walletNumber}${
                    memberBatch && r.batch === memberBatch ? ' · Your batch' : ''
                  }`}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ocean-400 dark:text-ocean-300" />
          </div>
        </Field>
      </div>

      <div className="mt-4">
        <Field id="payment-transaction-id" label="Transaction ID" optional error={transactionError}>
          <div className="group relative">
            <Hash className={iconCls(!!transactionError)} />
            <input
              id="payment-transaction-id"
              name="paymentTransactionId"
              type="text"
              value={transactionId}
              onChange={(e) => onTransactionIdChange(e.target.value)}
              maxLength={60}
              disabled={value === ''}
              placeholder="e.g. 9F7B2K1QZM"
              aria-invalid={!!transactionError}
              className={`${inputCls(!!transactionError)} disabled:cursor-not-allowed disabled:opacity-60`}
            />
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-ocean-500 dark:text-ocean-300/70">
            {value === ''
              ? 'Already paid? Choose a receiver first, then enter the transaction ID from your receipt — staff can confirm your payment faster.'
              : 'Already paid? Enter the transaction ID from your bKash/Rocket/Nagad receipt so staff can confirm your payment faster.'}
          </p>
        </Field>
      </div>
    </div>
  );
}

/** Read-only receiver summary — the member's profile and the locked edit
 *  variant (once payment is confirmed, the choice is staff-controlled). */
export function PaymentReceiverCard({ receiver }: { receiver: WalletView }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-reef-300/70 bg-reef-50/70 p-3 dark:border-reef-500/40 dark:bg-reef-500/10">
      <PersonAvatar
        photo={receiver.photo}
        name={receiver.name}
        className="h-10 w-10 rounded-xl text-xs ring-2 ring-ocean-100 dark:ring-ocean-800"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ocean-900 dark:text-white">
          {receiver.name}
        </p>
        <p className="truncate text-xs text-ocean-500 dark:text-ocean-300/70">
          {batchLabelOf(receiver.batch)} · {receiver.studentId}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <WalletBadge type={receiver.walletType} />
        <a
          href={`tel:${receiver.walletNumber}`}
          className="text-xs font-semibold text-reef-600 transition-colors hover:text-reef-500 dark:text-reef-300 dark:hover:text-reef-200"
        >
          {receiver.walletNumber}
        </a>
      </div>
    </div>
  );
}
