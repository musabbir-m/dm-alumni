import { createHash, createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { RECEIPT_CODE_ALPHABET, RECEIPT_CODE_LENGTH } from '@/lib/election-fields';

/**
 * Cryptographic primitives for the election — the only crypto in the app.
 * Two HMAC domains over one VOTING_SECRET keep the pieces from interfering:
 *
 *   - "voter:"  — the roll pseudonym: who voted (one-way; the Member id can
 *                 never be derived back from the stored hash)
 *   - "ballot:" — the tamper-evidence chain: each ballot's hash seals the
 *                 previous ballot's hash plus the ballot payload, so any
 *                 edit/delete/fabrication in MongoDB breaks verification
 *
 * ⚠ VOTING_SECRET must be long, must match across dev and prod (they share
 * the Atlas database), and must NEVER be rotated for a live election —
 * rotation invalidates every existing chain and every voter-hash (the
 * one-vote backstop would allow second votes under the new secret).
 */

/** Minimum sensible length — 32 hex chars = 128 bits of entropy. */
const MIN_SECRET_LENGTH = 32;

/** Reads lazily — module top-level evaluates before .env.local loads (see db.ts). */
export function hasVotingSecret(): boolean {
  return typeof process.env.VOTING_SECRET === 'string' && process.env.VOTING_SECRET.length >= MIN_SECRET_LENGTH;
}

export function getVotingSecret(): string {
  const secret = process.env.VOTING_SECRET;
  if (typeof secret !== 'string' || secret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      'Voting is not configured. Set VOTING_SECRET in the environment (generate one with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"), then restart the server.'
    );
  }
  return secret;
}

const hex = (data: Buffer | string) => createHash('sha256').update(data).digest('hex');

/**
 * Poll-book pseudonym for one member in one election. HMAC (not a plain
 * hash) because the input is guessable — a plain sha256 of a known user id
 * would let anyone confirm who a roll entry belongs to by brute-forcing the
 * member list. The secret makes that enumeration impossible without it.
 */
export function computeVoterHash(electionId: string, userId: string): string {
  return createHmac('sha256', getVotingSecret())
    .update(`voter:${electionId}:${userId}`)
    .digest('hex');
}

/** The chain link before the first ballot — public constant, not secret. */
export const GENESIS_PREV_HASH = 'GENESIS';

/** The ONLY fields sealed into a ballot's hash — adding a field? Hash it in,
 *  or verification will flag honest ballots as tampered. */
export type BallotPayload = {
  electionId: string;
  seq: number;
  choice: string;
  receiptHash: string;
};

/**
 * Canonical JSON — recursive key sort, no insignificant whitespace — so a
 * ballot hashed today byte-matches when the chain is re-verified months
 * later, regardless of field order or JSON.stringify quirks. Object-key order
 * inside plain data is the only freedom; numbers serialize via JSON (integer
 * seq — no float ambiguity).
 */
export function canonicalJSON(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJSON).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJSON(v)}`).join(',')}}`;
}

/** Chain link: seals the previous ballot's hash + this ballot's payload. */
export function computeBallotHash(prevHash: string, payload: BallotPayload): string {
  return createHmac('sha256', getVotingSecret())
    .update(`ballot:${prevHash}:${canonicalJSON(payload)}`)
    .digest('hex');
}

/**
 * Receipt code — plain sha256, deliberately NOT HMAC/secret-dependent: the
 * receipt must keep verifying even if the secret were ever rotated. A DB
 * admin can already read every ballot; the hash only lets the code's owner
 * prove their ballot is in the box.
 */
export function newReceiptCode(): string {
  let code = '';
  for (let i = 0; i < RECEIPT_CODE_LENGTH; i++) {
    code += RECEIPT_CODE_ALPHABET[randomInt(RECEIPT_CODE_ALPHABET.length)];
  }
  return code;
}

/** Uppercase + strip separators — shared with the client, lives in election-fields. */
export { normalizeReceiptCode } from '@/lib/election-fields';

export function receiptCodeHash(normalizedCode: string): string {
  return hex(normalizedCode);
}

/** Constant-time compare with a length guard — timingSafeEqual throws on mismatch. */
export function hashesEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
