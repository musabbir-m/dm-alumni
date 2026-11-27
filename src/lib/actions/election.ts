'use server';

import { auth } from '@clerk/nextjs/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { connectDB } from '@/lib/db';
import User from '@/lib/models/User';
import Election from '@/lib/models/Election';
import { batches } from '@/data/batches';
import {
  castVote,
  createElection,
  updateElectionConfig,
  openElection,
  closeElection,
  publishResults,
  getTurnout,
  verifyChain,
  verifyReceipt,
} from '@/lib/election';
import type { ChainView, ElectionError, ElectionResult, TurnoutView } from '@/lib/election';

/** The resolvers only ever return the error arm of ElectionResult. */
type ActorError = ElectionError;

/**
 * Thin auth wrappers around the election core (src/lib/election.ts) — same
 * shape as actions/admin.ts. Actions are callable directly, so every wrapper
 * re-resolves the Clerk session to its Mongo actor and the core re-authorizes
 * per call. Lifecycle changes revalidate /admin (the dashboard panels) and
 * /vote (every member's ballot state) in the same roundtrip.
 */

// ─── Actor resolution ────────────────────────────────────────────────────

/** Clerk session → Mongo actor id (any member — voting is a member action). */
async function resolveMemberActor(): Promise<{ actorId: string } | ActorError> {
  const { userId } = await auth();
  if (!userId) {
    return { status: 'error', message: 'Your session has expired. Please sign in again.' };
  }
  await connectDB();
  const actor = await User.findOne({ clerkId: userId }).lean();
  if (!actor) return { status: 'error', message: 'Your account was not found.' };
  return { actorId: actor._id.toString() };
}

/** Clerk session → staff actor id (admins + moderators monitor the election). */
async function resolveStaffActor(): Promise<{ actorId: string } | ActorError> {
  const { userId } = await auth();
  if (!userId) {
    return { status: 'error', message: 'Your session has expired. Please sign in again.' };
  }
  await connectDB();
  const actor = await User.findOne({ clerkId: userId }).lean();
  if (!actor) return { status: 'error', message: 'Your account was not found.' };
  const role = actor.role ?? 'alumni';
  if (role !== 'admin' && role !== 'moderator') {
    return { status: 'error', message: 'Only staff can monitor the election.' };
  }
  return { actorId: actor._id.toString() };
}

/** Clerk session → admin actor id (election management is admin-only). */
async function resolveAdminActor(): Promise<{ actorId: string } | ActorError> {
  const { userId } = await auth();
  if (!userId) {
    return { status: 'error', message: 'Your session has expired. Please sign in again.' };
  }
  await connectDB();
  const actor = await User.findOne({ clerkId: userId }).lean();
  if (!actor) return { status: 'error', message: 'Your account was not found.' };
  if (actor.role !== 'admin') {
    return { status: 'error', message: 'Only admins can manage the election.' };
  }
  return { actorId: actor._id.toString() };
}

// ─── Member actions (useActionState + FormData — the ballot is a form) ────

export type CastVoteState =
  | { status: 'idle' }
  | { status: 'error'; errors: Record<string, string>; message?: string }
  | { status: 'success'; receipt: string };

const castVoteSchema = z.object({
  electionId: z.string().min(1),
  choice: z.string().min(1, 'Pick a candidate before casting your ballot.'),
});

export async function castVoteAction(
  _prev: CastVoteState,
  formData: FormData
): Promise<CastVoteState> {
  const resolved = await resolveMemberActor();
  if ('status' in resolved) {
    return { status: 'error', errors: {}, message: resolved.message };
  }

  const parsed = castVoteSchema.safeParse({
    electionId: (formData.get('electionId') ?? '').toString(),
    choice: (formData.get('choice') ?? '').toString(),
  });
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? 'choice');
      if (!errors[key]) errors[key] = issue.message;
    }
    return { status: 'error', errors };
  }

  const result = await castVote(resolved.actorId, parsed.data.electionId, parsed.data.choice);
  if (result.status === 'error') {
    return {
      status: 'error',
      errors: result.field === 'choice' ? { choice: result.message } : {},
      message: result.field === 'choice' ? undefined : result.message,
    };
  }

  // Deliberately NO revalidatePath('/vote') here: the success state renders
  // the one-time receipt code, and revalidating would re-render the page into
  // its "already voted" state in the same roundtrip — unmounting the receipt
  // panel before the voter ever saw their code (a real bug the e2e caught).
  // /vote is a dynamic page, so the next visit renders the voted state anyway.
  return { status: 'success', receipt: result.receipt };
}

export type VerifyReceiptState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'success'; candidateName: string };

export async function verifyReceiptAction(
  _prev: VerifyReceiptState,
  formData: FormData
): Promise<VerifyReceiptState> {
  const resolved = await resolveMemberActor();
  if ('status' in resolved) {
    return { status: 'error', message: resolved.message };
  }

  const electionId = (formData.get('electionId') ?? '').toString();
  const code = (formData.get('receiptCode') ?? '').toString();
  if (!electionId) return { status: 'error', message: 'No election to check against.' };

  const result = await verifyReceipt(electionId, code);
  if (result.status === 'error') return { status: 'error', message: result.message };
  return { status: 'success', candidateName: result.candidateName };
}

// ─── Staff reads (the live monitor panel's poller) ────────────────────────

export type TurnoutActionResult =
  | { ok: true; turnout: TurnoutView }
  | { ok: false; message: string };

export type ChainActionResult =
  | { ok: true; chain: ChainView }
  | { ok: false; message: string };

export async function getTurnoutAction(electionId: string): Promise<TurnoutActionResult> {
  const resolved = await resolveStaffActor();
  if ('status' in resolved) return { ok: false, message: resolved.message };

  const turnout = await getTurnout(resolved.actorId, electionId);
  if ('status' in turnout) return { ok: false, message: turnout.message };
  return { ok: true, turnout };
}

export async function verifyChainAction(electionId: string): Promise<ChainActionResult> {
  const resolved = await resolveStaffActor();
  if ('status' in resolved) return { ok: false, message: resolved.message };

  const chain = await verifyChain(electionId);
  return { ok: true, chain };
}

// ─── Admin member picker (the candidate combobox) ────────────────────────

/** Person option for the candidate picker. */
export type CandidateMemberOption = {
  id: string;
  name: string;
  studentId: string;
  email: string;
  batch: string;
  photo: string;
  /** Already on this election's slate — the picker shows them disabled */
  isCandidate: boolean;
};

export type CandidatePickerResult =
  | { ok: true; members: CandidateMemberOption[] }
  | { ok: false; message: string };

export async function fetchVerifiedMembersAction(
  batch: string,
  electionId: string
): Promise<CandidatePickerResult> {
  if (!batches.some((b) => b.year === batch)) {
    return { ok: false, message: 'Unknown batch.' };
  }
  const resolved = await resolveAdminActor();
  if ('status' in resolved) return { ok: false, message: resolved.message };

  const [members, election] = await Promise.all([
    User.find({ batch, verificationStatus: 'verified' }).sort({ name: 1 }).lean(),
    Election.findById(electionId).lean(),
  ]);
  const taken = new Set(
    (election?.candidates ?? []).map((c) => c.userId.toString())
  );
  return {
    ok: true,
    members: members.map((m) => ({
      id: m._id.toString(),
      name: m.name,
      studentId: m.studentId,
      email: m.email,
      batch: m.batch,
      photo: m.photo ?? '',
      isCandidate: taken.has(m._id.toString()),
    })),
  };
}

// ─── Admin lifecycle (direct typed args — the admin-action pattern) ──────

export async function createElectionAction(input: {
  title: string;
  description?: string;
}): Promise<ElectionResult> {
  const resolved = await resolveAdminActor();
  if ('status' in resolved) return resolved;

  const result = await createElection(resolved.actorId, input);
  if (result.status === 'ok') {
    revalidatePath('/admin');
    revalidatePath('/vote');
  }
  return result;
}

export async function updateElectionConfigAction(input: {
  electionId: string;
  title: string;
  description?: string;
  candidateUserIds: string[];
  openAt: string | null;
  closeAt: string | null;
}): Promise<ElectionResult> {
  const resolved = await resolveAdminActor();
  if ('status' in resolved) return resolved;

  const result = await updateElectionConfig(resolved.actorId, input);
  if (result.status === 'ok') revalidatePath('/admin');
  return result;
}

export async function openElectionAction(electionId: string): Promise<ElectionResult> {
  const resolved = await resolveAdminActor();
  if ('status' in resolved) return resolved;

  const result = await openElection(resolved.actorId, electionId);
  if (result.status === 'ok') {
    revalidatePath('/admin');
    revalidatePath('/vote');
    revalidatePath('/profile');
  }
  return result;
}

export async function closeElectionAction(electionId: string): Promise<ElectionResult> {
  const resolved = await resolveAdminActor();
  if ('status' in resolved) return resolved;

  const result = await closeElection(resolved.actorId, electionId);
  if (result.status === 'ok') {
    revalidatePath('/admin');
    revalidatePath('/vote');
    revalidatePath('/profile');
  }
  return result;
}

export async function publishResultsAction(electionId: string): Promise<ElectionResult> {
  const resolved = await resolveAdminActor();
  if ('status' in resolved) return resolved;

  const result = await publishResults(resolved.actorId, electionId);
  if (result.status === 'ok') {
    revalidatePath('/admin');
    revalidatePath('/vote');
  }
  return result;
}
