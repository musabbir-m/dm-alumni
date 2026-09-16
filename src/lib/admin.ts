import type { HydratedDocument } from 'mongoose';
import { connectDB } from '@/lib/db';
import User from '@/lib/models/User';
import type { UserDocument } from '@/lib/models/User';

/**
 * Admin member-management core — role changes and verification decisions.
 * Role changes are admin-only; verification is decided by admins (any
 * member) or by the moderator of the target's batch. Lives outside the
 * 'use server' boundary (like applyProfileUpdate) so tsx scripts can
 * exercise the real guards without a request context. The 'use server'
 * wrappers in src/lib/actions/admin.ts resolve the Clerk session to its
 * Mongo actor and delegate here.
 */

/** Result shape for admin row actions — no form fields, just a message. */
export type AdminResult = { status: 'ok' } | { status: 'error'; message: string };

const MANAGED_ROLES = ['alumni', 'moderator'] as const;
const MANAGED_STATUSES = ['verified', 'rejected'] as const;

export type ManagedRole = (typeof MANAGED_ROLES)[number];
export type ManagedStatus = (typeof MANAGED_STATUSES)[number];

/** Hydrated doc (has .save()) — InferSchemaType alone is the raw shape. */
type UserDoc = HydratedDocument<UserDocument>;

/**
 * Loads the actor/target pair and enforces the checks shared by every
 * mutation: both records must exist, and nobody modifies themselves or
 * another admin (no self-lockout, no editing trusted records). Whether the
 * actor may act at all is decided by each mutation below.
 */
async function loadPair(
  actorId: string,
  targetId: string
): Promise<AdminResult | { actor: UserDoc; target: UserDoc }> {
  await connectDB();
  const actor = await User.findById(actorId);
  if (!actor) return { status: 'error', message: 'Your account was not found.' };

  const target = await User.findById(targetId);
  if (!target) return { status: 'error', message: 'That member no longer exists.' };
  if (target._id.equals(actor._id)) {
    return { status: 'error', message: 'You cannot modify your own account here.' };
  }
  if (target.role === 'admin') {
    return { status: 'error', message: 'Admin accounts cannot be modified from the dashboard.' };
  }

  return { actor, target };
}

/** Promote to moderator (stamps the target's own batch) or demote to alumni.
 * Admin-only — moderators never touch roles. */
export async function setUserRole(
  actorId: string,
  targetId: string,
  role: ManagedRole
): Promise<AdminResult> {
  // Runtime validation — TS types don't survive the server-action boundary
  if (!MANAGED_ROLES.includes(role)) return { status: 'error', message: 'Invalid role.' };

  try {
    const loaded = await loadPair(actorId, targetId);
    if ('status' in loaded) return loaded;
    const { actor, target } = loaded;
    if (actor.role !== 'admin') {
      return { status: 'error', message: 'Only admins can manage member roles.' };
    }

    // Idempotent — a double-click or stale row re-sends the same request
    if (target.role === role) return { status: 'ok' };

    target.role = role;
    target.moderatorBatch = role === 'moderator' ? target.batch : null;
    await target.save();
    return { status: 'ok' };
  } catch (err) {
    console.error('setUserRole failed:', err);
    return { status: 'error', message: 'Something went wrong while updating the role. Please try again.' };
  }
}

/** Approve (verified) or reject a member's verification — admins decide any
 * member, a moderator only members of their moderated batch. Never resets to
 * pending — members re-enter review themselves by uploading a corrected
 * document (see applyProfileUpdate). */
export async function setUserVerification(
  actorId: string,
  targetId: string,
  status: ManagedStatus
): Promise<AdminResult> {
  if (!MANAGED_STATUSES.includes(status)) return { status: 'error', message: 'Invalid status.' };

  try {
    const loaded = await loadPair(actorId, targetId);
    if ('status' in loaded) return loaded;
    const { actor, target } = loaded;

    const canVerify =
      actor.role === 'admin' ||
      (actor.role === 'moderator' &&
        !!actor.moderatorBatch &&
        actor.moderatorBatch === target.batch);
    if (!canVerify) {
      return {
        status: 'error',
        message: "Only an admin or the moderator of this member's batch can decide verification.",
      };
    }

    if (target.verificationStatus === status) return { status: 'ok' };

    target.verificationStatus = status;
    await target.save();
    return { status: 'ok' };
  } catch (err) {
    console.error('setUserVerification failed:', err);
    return {
      status: 'error',
      message: 'Something went wrong while updating the verification. Please try again.',
    };
  }
}
