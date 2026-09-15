'use server';

import { auth } from '@clerk/nextjs/server';
import { revalidatePath } from 'next/cache';
import { connectDB } from '@/lib/db';
import User from '@/lib/models/User';
import { setUserRole, setUserVerification } from '@/lib/admin';
import type { AdminResult, ManagedRole, ManagedStatus } from '@/lib/admin';

/**
 * Thin auth wrappers around the admin core (src/lib/admin.ts). Resolve the
 * Clerk session to its Mongo actor and delegate; revalidatePath re-renders
 * /admin in the same roundtrip so the list (and its ?q=&batch=&status=
 * filters) refresh without any client-side navigation.
 */

/** Clerk session → Mongo actor id, or the error to surface instead. */
async function resolveActorId(): Promise<{ actorId: string } | AdminResult> {
  const { userId } = await auth();
  if (!userId) {
    return { status: 'error', message: 'Your session has expired. Please sign in again.' };
  }

  await connectDB();
  const actor = await User.findOne({ clerkId: userId }).lean();
  if (!actor) {
    // Unreachable through the UI (requireAdmin gates the page) — but actions
    // are callable directly, so guard anyway; the core re-checks admin-ness.
    return { status: 'error', message: 'Your account was not found.' };
  }
  return { actorId: actor._id.toString() };
}

export async function updateUserRoleAction(
  targetId: string,
  role: ManagedRole
): Promise<AdminResult> {
  const resolved = await resolveActorId();
  if ('status' in resolved) return resolved;

  const result = await setUserRole(resolved.actorId, targetId, role);
  if (result.status === 'ok') revalidatePath('/admin');
  return result;
}

export async function updateUserVerificationAction(
  targetId: string,
  status: ManagedStatus
): Promise<AdminResult> {
  const resolved = await resolveActorId();
  if ('status' in resolved) return resolved;

  const result = await setUserVerification(resolved.actorId, targetId, status);
  if (result.status === 'ok') revalidatePath('/admin');
  return result;
}
