/**
 * Shared payment-wallet field definitions — imported by both the mongoose
 * model (server) and the admin UI components (client), so it must stay free
 * of server-only imports. Same role as profile-fields.ts.
 */

export const WALLET_TYPES = ['bkash', 'rocket', 'nagad'] as const;
export type WalletType = (typeof WALLET_TYPES)[number];

/** Gateway filter for the member-facing receiver dropdown — one wallet
 *  service, or all of them. UI-only; never persisted. */
export type GatewayFilter = WalletType | 'all';

/** Display metadata per wallet service (BKash pink, Rocket purple, Nagad orange). */
export const WALLET_TYPE_META: Record<
  WalletType,
  { label: string; dot: string; pill: string }
> = {
  bkash: {
    label: 'BKash',
    dot: 'bg-pink-500',
    pill: 'border-pink-200/80 bg-pink-50/80 text-pink-700 dark:border-pink-400/30 dark:bg-pink-500/10 dark:text-pink-300',
  },
  rocket: {
    label: 'Rocket',
    dot: 'bg-purple-500',
    pill: 'border-purple-200/80 bg-purple-50/80 text-purple-700 dark:border-purple-400/30 dark:bg-purple-500/10 dark:text-purple-300',
  },
  nagad: {
    label: 'Nagad',
    dot: 'bg-orange-500',
    pill: 'border-orange-200/80 bg-orange-50/80 text-orange-700 dark:border-orange-400/30 dark:bg-orange-500/10 dark:text-orange-300',
  },
};

/** Runtime guard — wallet types don't survive the server-action boundary as types. */
export function isWalletType(value: unknown): value is WalletType {
  return typeof value === 'string' && (WALLET_TYPES as readonly string[]).includes(value);
}

/**
 * Normalize a Bangladeshi mobile number to 01XXXXXXXXX. All three wallet
 * services use mobile numbers; accepts +880/880/0/no leading prefix and
 * spaces/dashes/parentheses. Returns null when it isn't a valid BD mobile.
 */
export function normalizeWalletNumber(raw: string): string | null {
  const digits = String(raw ?? '').replace(/[\s\-()]/g, '');
  const m = digits.match(/^(?:\+?880)?0?(1[3-9]\d{8})$/);
  return m ? `0${m[1]}` : null;
}

/**
 * Transaction ID (TrxID) a member submits as payment evidence — staff match
 * it against their wallet statement before marking the dues paid. The wallet
 * services issue short alphanumeric codes; inner spaces/dashes are allowed
 * for pasted variants. Validated identically by registration and profile
 * edit, so the pattern lives here between them.
 */
export const TRANSACTION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9\s-]{3,59}$/;
export const TRANSACTION_ID_MESSAGE =
  'Enter a valid transaction ID — 4 to 60 letters or digits from your payment receipt.';
