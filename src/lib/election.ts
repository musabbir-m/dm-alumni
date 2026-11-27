import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import type { Require_id } from 'mongoose';
import { connectDB } from '@/lib/db';
import User from '@/lib/models/User';
import Election from '@/lib/models/Election';
import Ballot from '@/lib/models/Ballot';
import VoterRoll from '@/lib/models/VoterRoll';
import {
  GENESIS_PREV_HASH,
  computeBallotHash,
  computeVoterHash,
  hasVotingSecret,
  hashesEqual,
  newReceiptCode,
  receiptCodeHash,
} from '@/lib/voting-crypto';
import {
  RECEIPT_CODE_PATTERN,
  RECEIPT_CODE_MESSAGE,
  normalizeReceiptCode,
} from '@/lib/election-fields';
import type { ElectionStatus } from '@/lib/election-fields';
import type { ElectionDocument } from '@/lib/models/Election';

/**
 * Election core — the committee vote's lifecycle, casting, and integrity
 * machinery. Lives outside the 'use server' boundary (like src/lib/admin.ts)
 * so tsx scripts (scripts/verify-election.ts) exercise the real guards
 * without a request context; the wrappers in src/lib/actions/election.ts
 * resolve the Clerk session to its Mongo actor and delegate here.
 *
 * Security model (see the plan + voting-crypto.ts):
 *   - One vote per member: pre-check + the VoterRoll unique index, inside a
 *     MongoDB transaction that writes the roll entry and the ballot
 *     atomically — the first transaction in this codebase. Neither can land
 *     without the other.
 *   - Secrecy: VoterRoll stores only an HMAC pseudonym; Ballot stores no
 *     identity. The DB can show who voted and it can show ballots, but it
 *     can never link the two.
 *   - Tamper-evidence: ballots form a hash chain (seq-contiguous, each
 *     sealing the previous hash). verifyChain recomputes it — any edit,
 *     deletion, or fabrication breaks verification visibly.
 *   - Residual risks (documented, accepted): a DB admin can still READ
 *     ballot choices; roll/ballot timestamps could in principle be
 *     correlated (only the ordering, never the content); wholesale DB
 *     deletion is detectable only against the externally published
 *     fingerprint.
 */

/** Result shape for lifecycle actions — no form fields, just a message. */
export type ElectionResult = { status: 'ok' } | { status: 'error'; message: string };

/** The error arm alone — read helpers return it beside their payload, so
 *  wrappers can read `.message` after the guard without a cast. */
export type ElectionError = Extract<ElectionResult, { status: 'error' }>;

/** Vote result — field routes the message next to the candidate picker. */
export type VoteResult =
  | { status: 'ok'; receipt: string }
  | { status: 'error'; message: string; field?: 'choice' };

// ─── Serializable views (client props cross the RSC boundary as these) ───

export type CandidateView = {
  id: string;
  /** The candidate's Member id — the admin editor submits it back as the
   *  slate; harmless on member-facing surfaces (it's an internal Mongo id). */
  userId: string;
  name: string;
  studentId: string;
  batch: string;
  photo: string;
};

export type TallyLine = CandidateView & { count: number };

export type ElectionView = {
  id: string;
  title: string;
  description: string;
  /** Effective status (schedule folded in) — what the UI shows everywhere */
  status: ElectionStatus;
  /** Stored status — what lifecycle buttons act on */
  storedStatus: ElectionStatus;
  openAt: string | null;
  closeAt: string | null;
  openedAt: string | null;
  closedAt: string | null;
  publishedAt: string | null;
  /** Chain fingerprint frozen at publish — the member-facing trust artifact */
  publishedHeadHash: string | null;
  publishedBallotCount: number | null;
  publishedRollCount: number | null;
  candidates: CandidateView[];
};

export type TurnoutView = {
  total: number;
  byBatch: { batch: string; count: number }[];
  eligibleTotal: number;
  eligibleByBatch: { batch: string; count: number }[];
  percent: number;
};

export type ChainView = {
  ok: boolean;
  headHash: string;
  ballotCount: number;
  rollCount: number;
  /** Human-readable failure reason when ok === false */
  reason?: string;
};

export type VoteContext =
  | { phase: 'none' }
  | { phase: 'unconfigured'; election: ElectionView }
  | { phase: 'unverified'; election: ElectionView }
  | { phase: 'upcoming'; election: ElectionView }
  | { phase: 'open'; election: ElectionView }
  | { phase: 'voted'; election: ElectionView }
  | { phase: 'closed'; election: ElectionView }
  | { phase: 'published'; election: ElectionView; tally: TallyLine[]; chain: ChainView };

/** What .lean() returns — InferSchemaType plus the _id mongoose injects
 *  (Require_id is exactly what the query .lean() wrapper adds). */
type ElectionLean = Require_id<ElectionDocument>;
type CandidateLean = ElectionDocument['candidates'][number];

// ─── Helpers ─────────────────────────────────────────────────────────────

/**
 * The ONLY place the schedule window is evaluated. Manual lifecycle actions
 * write `status` and always win: a manual close is terminal (published stays
 * published), a manual open outruns a future openAt. A draft whose openAt has
 * arrived is effectively open without anyone clicking; when its closeAt
 * passes it is effectively closed — no cron exists in this app, so the
 * window is computed lazily against the current time on every read/write.
 */
export function effectiveStatus(
  election: { status: string; openAt?: Date | null; closeAt?: Date | null },
  now = new Date()
): ElectionStatus {
  switch (election.status) {
    case 'published':
      return 'published';
    case 'closed':
      return 'closed';
    case 'open':
      return election.closeAt && election.closeAt.getTime() <= now.getTime() ? 'closed' : 'open';
    case 'draft':
      if (election.openAt) {
        if (election.closeAt && election.closeAt.getTime() <= now.getTime()) return 'closed';
        if (election.openAt.getTime() <= now.getTime()) return 'open';
      }
      return 'draft';
    default:
      return 'draft';
  }
}

/** Load the acting member and require one of the given roles. */
async function requireRole(
  actorId: string,
  roles: readonly string[],
  denyMessage: string
): Promise<{ actorId: string; role: string } | ElectionError> {
  await connectDB();
  const actor = await User.findById(actorId).lean();
  if (!actor) return { status: 'error', message: 'Your account was not found.' };
  const role = actor.role ?? 'alumni';
  if (!roles.includes(role)) return { status: 'error', message: denyMessage };
  return { actorId, role };
}

const toCandidateView = (c: CandidateLean): CandidateView => ({
  id: c.id,
  userId: c.userId.toString(),
  name: c.name,
  studentId: c.studentId,
  batch: c.batch,
  photo: c.photo ?? '',
});

function toElectionView(election: ElectionLean): ElectionView {
  return {
    id: election._id.toString(),
    title: election.title,
    description: election.description ?? '',
    status: effectiveStatus(election),
    storedStatus: (election.status as ElectionStatus) ?? 'draft',
    openAt: election.openAt ? election.openAt.toISOString() : null,
    closeAt: election.closeAt ? election.closeAt.toISOString() : null,
    openedAt: election.openedAt ? election.openedAt.toISOString() : null,
    closedAt: election.closedAt ? election.closedAt.toISOString() : null,
    publishedAt: election.publishedAt ? election.publishedAt.toISOString() : null,
    publishedHeadHash: election.publishedHeadHash ?? null,
    publishedBallotCount: election.publishedBallotCount ?? null,
    publishedRollCount: election.publishedRollCount ?? null,
    candidates: (election.candidates ?? []).map(toCandidateView),
  };
}

const newCandidateId = () => randomBytes(8).toString('hex');

// ─── Lifecycle (admin-only) ──────────────────────────────────────────────

/** Create a new draft election. Refuses while any election is effectively
 *  open — one live vote at a time. */
export async function createElection(
  actorId: string,
  { title, description }: { title: string; description?: string }
): Promise<ElectionResult> {
  const guard = await requireRole(actorId, ['admin'], 'Only admins can manage the election.');
  if ('status' in guard) return guard;

  try {
    const all = await Election.find().lean();
    if (all.some((e) => effectiveStatus(e) === 'open')) {
      return { status: 'error', message: 'Another election is already open — close or publish it first.' };
    }
    await Election.create({
      title: title.trim(),
      description: (description ?? '').trim(),
      status: 'draft',
      candidates: [],
    });
    return { status: 'ok' };
  } catch (err) {
    console.error('createElection failed:', err);
    return { status: 'error', message: 'Something went wrong while creating the election. Please try again.' };
  }
}

/**
 * Rewrite a draft election's whole config — title/description, schedule
 * window, and the candidate slate. Candidates are keyed by their Member
 * (userId): an existing slate member keeps their public candidate id (so
 * ballots can't accidentally transfer), everyone else gets a fresh id;
 * identity snapshots are always refreshed from the User record. Locked once
 * the election is effectively open — the slate can't change mid-vote.
 */
export async function updateElectionConfig(
  actorId: string,
  {
    electionId,
    title,
    description,
    candidateUserIds,
    openAt,
    closeAt,
  }: {
    electionId: string;
    title: string;
    description?: string;
    candidateUserIds: string[];
    openAt: string | null;
    closeAt: string | null;
  }
): Promise<ElectionResult> {
  const guard = await requireRole(actorId, ['admin'], 'Only admins can manage the election.');
  if ('status' in guard) return guard;

  try {
    const election = await Election.findById(electionId);
    if (!election) return { status: 'error', message: 'That election no longer exists.' };
    if (effectiveStatus(election) !== 'draft') {
      return { status: 'error', message: 'The election has already started — its configuration is locked.' };
    }

    const cleanTitle = title.trim();
    if (!cleanTitle) return { status: 'error', message: 'Give the election a title.' };

    // Distinct members only — duplicates are a client-side mistake
    const userIds = [...new Set(candidateUserIds.map((id) => id.trim()).filter(Boolean))];
    const members = await User.find({ _id: { $in: userIds } }).lean();
    if (members.length !== userIds.length) {
      return { status: 'error', message: 'One of the chosen members no longer exists.' };
    }
    const memberById = new Map(members.map((m) => [m._id.toString(), m]));

    // Preserve candidate ids for members already on the slate
    const existingByUserId = new Map(
      (election.candidates ?? []).map((c) => [c.userId.toString(), c])
    );
    // Plain objects are fine at runtime (mongoose casts them into the
    // subdocuments); the schema type declares a DocumentArray, so the
    // assignment needs the cast.
    election.candidates = userIds.map((userId) => {
      const m = memberById.get(userId)!;
      const existing = existingByUserId.get(userId);
      return {
        id: existing?.id ?? newCandidateId(),
        userId: m._id,
        name: m.name,
        studentId: m.studentId,
        batch: m.batch,
        photo: m.photo ?? '',
      };
    }) as unknown as ElectionDocument['candidates'];

    election.title = cleanTitle;
    election.description = (description ?? '').trim();
    const open = openAt ? new Date(openAt) : null;
    const close = closeAt ? new Date(closeAt) : null;
    if (open && close && close.getTime() <= open.getTime()) {
      return { status: 'error', message: 'The close time must be after the open time.' };
    }
    election.openAt = open;
    election.closeAt = close;

    await election.save();
    return { status: 'ok' };
  } catch (err) {
    console.error('updateElectionConfig failed:', err);
    return { status: 'error', message: 'Something went wrong while saving the election. Please try again.' };
  }
}

/** Manually open voting — outruns a future openAt. Needs ≥2 candidates and
 *  no other effectively-open election. */
export async function openElection(actorId: string, electionId: string): Promise<ElectionResult> {
  const guard = await requireRole(actorId, ['admin'], 'Only admins can manage the election.');
  if ('status' in guard) return guard;

  try {
    const election = await Election.findById(electionId);
    if (!election) return { status: 'error', message: 'That election no longer exists.' };
    const effective = effectiveStatus(election);
    if (effective === 'open') return { status: 'ok' };
    if (effective !== 'draft') {
      return { status: 'error', message: 'Only a draft election can be opened.' };
    }
    if ((election.candidates ?? []).length < 2) {
      return { status: 'error', message: 'Add at least two candidates before opening the vote.' };
    }
    const others = await Election.find({ _id: { $ne: election._id } }).lean();
    if (others.some((e) => effectiveStatus(e) === 'open')) {
      return { status: 'error', message: 'Another election is already open — close or publish it first.' };
    }

    election.status = 'open';
    election.openedAt = new Date();
    await election.save();
    return { status: 'ok' };
  } catch (err) {
    console.error('openElection failed:', err);
    return { status: 'error', message: 'Something went wrong while opening the election. Please try again.' };
  }
}

/** Manually close voting — terminal: a manual close wins over the schedule
 *  and can't be re-opened (re-opening would break the vote's finality story). */
export async function closeElection(actorId: string, electionId: string): Promise<ElectionResult> {
  const guard = await requireRole(actorId, ['admin'], 'Only admins can manage the election.');
  if ('status' in guard) return guard;

  try {
    const election = await Election.findById(electionId);
    if (!election) return { status: 'error', message: 'That election no longer exists.' };
    const effective = effectiveStatus(election);
    if (effective === 'closed') return { status: 'ok' };
    if (effective !== 'open') {
      return { status: 'error', message: 'Only an open election can be closed.' };
    }

    election.status = 'closed';
    election.closedAt = new Date();
    await election.save();
    return { status: 'ok' };
  } catch (err) {
    console.error('closeElection failed:', err);
    return { status: 'error', message: 'Something went wrong while closing the election. Please try again.' };
  }
}

/** Publish results — stamps the chain fingerprint so members can confirm
 *  the ledger never changed afterwards. Refuses on a broken chain. */
export async function publishResults(actorId: string, electionId: string): Promise<ElectionResult> {
  const guard = await requireRole(actorId, ['admin'], 'Only admins can manage the election.');
  if ('status' in guard) return guard;

  try {
    const election = await Election.findById(electionId);
    if (!election) return { status: 'error', message: 'That election no longer exists.' };
    if (election.status === 'published') return { status: 'ok' };
    const effective = effectiveStatus(election);
    if (effective !== 'closed') {
      return { status: 'error', message: 'Close the election before publishing results.' };
    }

    const chain = await verifyChain(election._id.toString());
    if (!chain.ok) {
      return {
        status: 'error',
        message: `The ballot chain failed verification (${chain.reason ?? 'unknown error'}) — audit the ballots before publishing.`,
      };
    }

    election.status = 'published';
    election.publishedAt = new Date();
    election.publishedHeadHash = chain.headHash;
    election.publishedBallotCount = chain.ballotCount;
    election.publishedRollCount = chain.rollCount;
    await election.save();
    return { status: 'ok' };
  } catch (err) {
    console.error('publishResults failed:', err);
    return { status: 'error', message: 'Something went wrong while publishing. Please try again.' };
  }
}

// ─── Casting a vote ───────────────────────────────────────────────────────

/**
 * Cast one anonymous ballot. Guard chain: member exists → verified → the
 * election is effectively open → they're not on the roll → the choice is a
 * real candidate. Then the atomic write: inside ONE MongoDB transaction,
 * append the roll entry (who voted — as a pseudonym) and the chained ballot
 * (what was voted — no identity). Two members voting concurrently both win;
 * the loser of the chain-head race is retried once; a second vote from the
 * same member hits the roll's unique index and is rejected for good.
 */
export async function castVote(
  actorId: string,
  electionId: string,
  choice: string
): Promise<VoteResult> {
  if (!hasVotingSecret()) {
    return { status: 'error', message: 'Voting is not configured — contact the association staff.' };
  }

  let actor;
  try {
    await connectDB();
    actor = await User.findById(actorId).lean();
  } catch (err) {
    console.error('castVote load failed:', err);
    return { status: 'error', message: 'Something went wrong while casting your vote. Please try again.' };
  }
  if (!actor) return { status: 'error', message: 'Your account was not found.' };
  if ((actor.verificationStatus ?? 'pending') !== 'verified') {
    return {
      status: 'error',
      message: 'Your membership is not verified yet — only verified members can vote.',
    };
  }

  const election = await Election.findById(electionId).lean();
  if (!election) return { status: 'error', message: 'That election no longer exists.' };
  if (effectiveStatus(election) !== 'open') {
    return { status: 'error', message: 'Voting is not open for this election.' };
  }

  const candidateIds = (election.candidates ?? []).map((c) => c.id);
  if (!choice || !candidateIds.includes(choice)) {
    return { status: 'error', field: 'choice', message: 'Pick a candidate before casting your ballot.' };
  }

  const electionIdStr = election._id.toString();
  const userIdStr = actor._id.toString();
  const voterHash = computeVoterHash(electionIdStr, userIdStr);

  // Pre-check the roll (the unique index is the real backstop for a
  // concurrent double-submit, this just gives the common case a clean error)
  if (await VoterRoll.exists({ electionId: election._id, voterHash })) {
    return { status: 'error', message: 'You have already cast your ballot in this election.' };
  }

  // Receipt: generated here, shown once by the caller, only its hash stored.
  const receipt = newReceiptCode();
  const receiptHash = receiptCodeHash(normalizeReceiptCode(receipt));

  /** One full transaction attempt: read head, append roll + chained ballot.
   *  Every operation MUST carry the session or it lands outside the
   *  transaction — the atomicity guarantee would silently vanish. */
  const attempt = () =>
    mongoose.connection.transaction(async (session) => {
      const head = await Ballot.findOne({ electionId: election._id })
        .sort({ seq: -1 })
        .session(session);
      const seq = (head?.seq ?? 0) + 1;
      const prevHash = head?.hash ?? GENESIS_PREV_HASH;
      const hash = computeBallotHash(prevHash, {
        electionId: electionIdStr,
        seq,
        choice,
        receiptHash,
      });

      await VoterRoll.create(
        [{ electionId: election._id, voterHash, batch: actor.batch }],
        { session }
      );
      await Ballot.create(
        [{ electionId: election._id, seq, prevHash, hash, receiptHash, choice }],
        { session }
      );
      return hash;
    });

  try {
    await attempt();
    return { status: 'ok', receipt };
  } catch (err) {
    // Triage the unique-index aborts — the transaction guarantees neither
    // the roll entry nor the ballot survived.
    const keyPattern = (err as { keyPattern?: Record<string, number> }).keyPattern;
    if (keyPattern && ('voterHash' in keyPattern || 'receiptHash' in keyPattern)) {
      return { status: 'error', message: 'You have already cast your ballot in this election.' };
    }
    if (keyPattern && 'seq' in keyPattern) {
      // Lost the chain-head race to a concurrent vote — one retry
      try {
        await attempt();
        return { status: 'ok', receipt };
      } catch (retryErr) {
        const retryPattern = (retryErr as { keyPattern?: Record<string, number> }).keyPattern;
        if (retryPattern && ('voterHash' in retryPattern || 'receiptHash' in retryPattern)) {
          return { status: 'error', message: 'You have already cast your ballot in this election.' };
        }
        console.error('castVote retry failed:', retryErr);
        return { status: 'error', message: 'Something went wrong while casting your vote. Please try again.' };
      }
    }
    // Standalone (non-replica-set) MongoDB rejects sessions — Atlas is fine
    if (/replica set/i.test(String((err as Error).message))) {
      return {
        status: 'error',
        message: 'The database does not support secure voting right now — contact the association staff.',
      };
    }
    console.error('castVote failed:', err);
    return { status: 'error', message: 'Something went wrong while casting your vote. Please try again.' };
  }
}

// ─── Reads ───────────────────────────────────────────────────────────────

/** Latest election as a serializable view — the dashboard panel's seed data. */
export async function getLatestElectionView(): Promise<ElectionView | null> {
  await connectDB();
  const election = await Election.findOne().sort({ createdAt: -1 }).lean();
  return election ? toElectionView(election) : null;
}

/** Everything /vote needs to render one member's state, server-decided. */
export async function getVotingContext(userId: string): Promise<VoteContext> {
  await connectDB();
  const election = await Election.findOne().sort({ createdAt: -1 }).lean();
  if (!election) return { phase: 'none' };

  const view = toElectionView(election);
  if (!hasVotingSecret()) return { phase: 'unconfigured', election: view };

  const status = effectiveStatus(election);
  if (status === 'published') {
    // Status is published, so computeTally's closed/published gate passes —
    // the ?? [] only satisfies the type checker.
    const tally = (await computeTally(election)) ?? [];
    const chain = await verifyChain(view.id);
    return { phase: 'published', election: view, tally, chain };
  }

  const actor = await User.findById(userId).lean();
  if (!actor || (actor.verificationStatus ?? 'pending') !== 'verified') {
    return { phase: 'unverified', election: view };
  }
  if (status === 'draft') return { phase: 'upcoming', election: view };
  if (status === 'closed') return { phase: 'closed', election: view };

  const voterHash = computeVoterHash(view.id, actor._id.toString());
  const voted = await VoterRoll.exists({ electionId: election._id, voterHash });
  return voted ? { phase: 'voted', election: view } : { phase: 'open', election: view };
}

/** Turnout — votes cast (total + per batch) beside the eligible-member
 *  baseline. Safe during voting: it never touches ballot contents. */
export async function computeTurnout(electionId: string): Promise<TurnoutView> {
  const [total, byBatch, eligibleTotal, eligibleByBatch] = await Promise.all([
    VoterRoll.countDocuments({ electionId }),
    VoterRoll.aggregate<{ _id: string; count: number }>([
      { $match: { electionId: new mongoose.Types.ObjectId(electionId) } },
      { $group: { _id: '$batch', count: { $sum: 1 } } },
    ]),
    User.countDocuments({ verificationStatus: 'verified' }),
    User.aggregate<{ _id: string; count: number }>([
      { $match: { verificationStatus: 'verified' } },
      { $group: { _id: '$batch', count: { $sum: 1 } } },
    ]),
  ]);
  return {
    total,
    byBatch: byBatch.map((r) => ({ batch: r._id, count: r.count })).sort((a, b) => a.batch.localeCompare(b.batch)),
    eligibleTotal,
    eligibleByBatch: eligibleByBatch
      .map((r) => ({ batch: r._id, count: r.count }))
      .sort((a, b) => a.batch.localeCompare(b.batch)),
    percent: eligibleTotal > 0 ? Math.round((total / eligibleTotal) * 100) : 0,
  };
}

/** Staff-guarded turnout read (the dashboard poller's action target). */
export async function getTurnout(
  actorId: string,
  electionId: string
): Promise<TurnoutView | ElectionError> {
  const guard = await requireRole(
    actorId,
    ['admin', 'moderator'],
    'Only staff can monitor the election.'
  );
  if ('status' in guard) return guard;
  return computeTurnout(electionId);
}

/** Per-candidate counts. THE no-leak guarantee lives here: it runs only for
 *  effectively closed/published elections and returns null otherwise — no
 *  code path can read live tallies while voting is open. */
export async function computeTally(election: ElectionLean): Promise<TallyLine[] | null> {
  if (effectiveStatus(election) !== 'closed' && effectiveStatus(election) !== 'published') {
    return null;
  }
  const electionId = election._id;
  const counts = await Ballot.aggregate<{ _id: string; count: number }>([
    { $match: { electionId } },
    { $group: { _id: '$choice', count: { $sum: 1 } } },
  ]);
  const countByChoice = new Map(counts.map((r) => [r._id, r.count]));
  const lines = (election.candidates ?? []).map((c) => ({
    ...toCandidateView(c),
    count: countByChoice.get(c.id) ?? 0,
  }));
  // Ballots for a candidate no longer on the slate (can't happen through the
  // UI — config locks at open) still surface, honestly labeled
  const known = new Set((election.candidates ?? []).map((c) => c.id));
  for (const r of counts) {
    if (!known.has(r._id)) {
      lines.push({ id: r._id, userId: '', name: 'Unlisted candidate', studentId: '', batch: '', photo: '', count: r.count });
    }
  }
  return lines.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** Page-facing tally load — the page guards staff; computeTally re-checks the
 *  status gate, so an open election still returns null here. */
export async function getTally(electionId: string): Promise<TallyLine[] | null> {
  const election = await Election.findById(electionId).lean();
  if (!election) return null;
  return computeTally(election);
}

/**
 * Walk the whole chain and recompute every link: seq contiguity from 1,
 * prevHash linkage, each ballot's HMAC over its canonical payload, and the
 * roll-vs-ballot count cross-check. Returns the head hash + counts for the
 * publish fingerprint. Any DB-level edit, deletion, or fabrication of a
 * ballot breaks this — visibly, not preventably (see the threat model at the
 * top of this file).
 */
export async function verifyChain(electionId: string): Promise<ChainView> {
  if (!hasVotingSecret()) {
    return {
      ok: false,
      headHash: '',
      ballotCount: 0,
      rollCount: 0,
      reason: 'VOTING_SECRET is not configured — the chain cannot be verified.',
    };
  }
  await connectDB();
  const ballots = await Ballot.find({ electionId }).sort({ seq: 1 }).lean();
  const rollCount = await VoterRoll.countDocuments({ electionId });
  const electionIdStr = ballots[0]
    ? ballots[0].electionId.toString()
    : new mongoose.Types.ObjectId(electionId).toString();

  let prevHash = GENESIS_PREV_HASH;
  for (let i = 0; i < ballots.length; i++) {
    const b = ballots[i];
    if (b.seq !== i + 1) {
      return {
        ok: false,
        headHash: prevHash,
        ballotCount: ballots.length,
        rollCount,
        reason: `sequence gap — ballot ${i + 1} is missing (found seq ${b.seq})`,
      };
    }
    if (b.prevHash !== prevHash) {
      return {
        ok: false,
        headHash: prevHash,
        ballotCount: ballots.length,
        rollCount,
        reason: `broken link at ballot ${b.seq} — the chain was cut or reordered`,
      };
    }
    const recomputed = computeBallotHash(b.prevHash, {
      electionId: electionIdStr,
      seq: b.seq,
      choice: b.choice,
      receiptHash: b.receiptHash,
    });
    if (!hashesEqual(recomputed, b.hash)) {
      return {
        ok: false,
        headHash: prevHash,
        ballotCount: ballots.length,
        rollCount,
        reason: `ballot ${b.seq} does not match its sealed hash — it was modified`,
      };
    }
    prevHash = b.hash;
  }
  if (rollCount !== ballots.length) {
    return {
      ok: false,
      headHash: prevHash,
      ballotCount: ballots.length,
      rollCount,
      reason: `the poll book and the ballot box disagree (${rollCount} voters vs ${ballots.length} ballots)`,
    };
  }
  return { ok: true, headHash: prevHash, ballotCount: ballots.length, rollCount };
}

/** Receipt inclusion check — proves to the code's owner that their ballot is
 *  in the box, and shows them (only them) what it recorded. */
export async function verifyReceipt(
  electionId: string,
  rawCode: string
): Promise<{ status: 'ok'; candidateName: string } | { status: 'error'; message: string }> {
  const code = normalizeReceiptCode(rawCode);
  if (!RECEIPT_CODE_PATTERN.test(code)) {
    return { status: 'error', message: RECEIPT_CODE_MESSAGE };
  }
  await connectDB();
  const ballot = await Ballot.findOne({
    electionId,
    receiptHash: receiptCodeHash(code),
  }).lean();
  if (!ballot) {
    return { status: 'error', message: 'No ballot found with that receipt code — check it and try again.' };
  }
  const election = await Election.findById(electionId).lean();
  const candidate = election?.candidates?.find((c) => c.id === ballot.choice);
  return { status: 'ok', candidateName: candidate?.name ?? 'Unlisted candidate' };
}
