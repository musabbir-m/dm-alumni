import { WALLET_TYPES, WALLET_TYPE_META } from '@/lib/wallet-fields';
import type { WalletType } from '@/lib/wallet-fields';

/**
 * Presentational pieces shared by the admin payment-wallet components
 * (AddPaymentWalletForm, PaymentWalletsPanel). No directive — like form-ui,
 * it's pulled into whichever client graph imports it. State stays with the
 * parents; the picker only reports changes.
 */

/** Brand-colored pill: ● BKash / ● Rocket / ● Nagad */
export function WalletBadge({ type }: { type: WalletType }) {
  const meta = WALLET_TYPE_META[type];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${meta.pill}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} aria-hidden />
      {meta.label}
    </span>
  );
}

/** Three-way toggle for the wallet service (controlled — parent owns value). */
export function WalletTypePicker({
  value,
  onChange,
  disabled = false,
}: {
  value: WalletType;
  onChange: (type: WalletType) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Wallet type">
      {WALLET_TYPES.map((type) => {
        const meta = WALLET_TYPE_META[type];
        const selected = value === type;
        return (
          <button
            key={type}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(type)}
            className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all disabled:opacity-60 ${
              selected
                ? 'border-reef-500 bg-reef-50/70 text-ocean-900 ring-2 ring-reef-400/25 dark:border-reef-500/60 dark:bg-reef-500/10 dark:text-white'
                : 'border-ocean-200 bg-white/50 text-ocean-700 hover:border-ocean-300 dark:border-ocean-800 dark:bg-ocean-950/40 dark:text-ocean-200 dark:hover:border-ocean-700'
            }`}
          >
            <span className={`h-2 w-2 shrink-0 rounded-full ${meta.dot}`} aria-hidden />
            {meta.label}
          </button>
        );
      })}
    </div>
  );
}

/** Member photo or initials disc — the admin list's avatar, reused here. */
export function PersonAvatar({
  photo,
  name,
  className = 'h-10 w-10 rounded-xl text-xs ring-2 ring-ocean-100 dark:ring-ocean-800',
}: {
  photo: string;
  name: string;
  className?: string;
}) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
  if (photo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photo}
        alt={name}
        className={`shrink-0 object-cover ${className}`}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center bg-ocean-100/70 font-bold text-ocean-600 dark:bg-ocean-800/60 dark:text-ocean-200 ${className}`}
    >
      {initials}
    </span>
  );
}
