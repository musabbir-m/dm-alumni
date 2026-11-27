/**
 * Shared election field definitions — imported by both the mongoose models
 * (server) and the voting/dashboard UI components (client), so it must stay
 * free of server-only imports. Same role as wallet-fields.ts.
 */

export const ELECTION_STATUSES = ['draft', 'open', 'closed', 'published'] as const;
export type ElectionStatus = (typeof ELECTION_STATUSES)[number];

/** Display metadata per lifecycle stage — short pill labels + a one-line note. */
export const ELECTION_STATUS_META: Record<
  ElectionStatus,
  { label: string; note: string; pill: string }
> = {
  draft: {
    label: 'Draft',
    note: 'Being prepared — not visible to members yet.',
    pill: 'border-ocean-200/80 bg-ocean-50/80 text-ocean-700 dark:border-ocean-700/50 dark:bg-ocean-800/60 dark:text-ocean-200',
  },
  open: {
    label: 'Open',
    note: 'Members are casting their ballots right now.',
    pill: 'border-amber-200/80 bg-amber-50/80 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300',
  },
  closed: {
    label: 'Closed',
    note: 'Voting has ended — results can be published.',
    pill: 'border-ocean-200/80 bg-ocean-50/80 text-ocean-700 dark:border-ocean-700/50 dark:bg-ocean-800/60 dark:text-ocean-200',
  },
  published: {
    label: 'Published',
    note: 'Results are live for every member.',
    pill: 'border-reef-200/80 bg-reef-50/80 text-reef-700 dark:border-reef-500/30 dark:bg-reef-500/10 dark:text-reef-300',
  },
};

/** Runtime guard — statuses don't survive the server-action boundary as types. */
export function isElectionStatus(value: unknown): value is ElectionStatus {
  return typeof value === 'string' && (ELECTION_STATUSES as readonly string[]).includes(value);
}

/**
 * Receipt code shown to a voter right after casting. 10 characters from a
 * 30-symbol unambiguous alphabet (no I/L/O/U/0/1) ≈ 49 bits — unguessable in
 * practice, hard to misread when copied by hand. Validated identically by the
 * receipt-verification action, so the pattern lives here — also imported by
 * the client form, which is why it can't live in voting-crypto.ts.
 */
export const RECEIPT_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTVWXYZ23456789';
export const RECEIPT_CODE_LENGTH = 10;
export const RECEIPT_CODE_PATTERN = new RegExp(
  `^[${RECEIPT_CODE_ALPHABET}]{${RECEIPT_CODE_LENGTH}}$`
);
export const RECEIPT_CODE_MESSAGE =
  'Enter the 10-character receipt code you received after voting.';

/** Uppercase + strip the separator the UI shows — "K7QX4-2ZM8P" → "K7QX42ZM8P".
 *  Pure text munging (no crypto) so the client form can normalize as the
 *  member types. */
export function normalizeReceiptCode(raw: string): string {
  return String(raw ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}
