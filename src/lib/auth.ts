import { auth, currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { connectDB } from '@/lib/db';
import User from '@/lib/models/User';

/**
 * Auth guards shared by pages and actions. Clerk owns credentials; MongoDB
 * stays the source of truth for role/verificationStatus/profile — these
 * helpers resolve the Clerk session to its Mongo record.
 *
 * Plain server module on purpose (NOT 'use server') so it can export types.
 */

/**
 * Resolve the Mongo record for a Clerk userId, attempting a lazy link by
 * verified email on miss (migrates accounts created before Clerk, e.g. the
 * seeded admin). Returns null when the user still needs /register — either
 * they haven't completed it, or their email isn't verified/linkable yet.
 */
async function findOrLinkUser(userId: string) {
  await connectDB();
  const direct = await User.findOne({ clerkId: userId }).lean();
  if (direct) return direct;

  // Miss path — costs one Backend API call (rate-limited), so only taken on
  // the first visit after sign-up or for pre-Clerk records. `auth()` above
  // reads claims only and is cheap.
  const cu = await currentUser();
  const primary = cu?.primaryEmailAddress;
  if (!primary || primary.verification?.status !== 'verified') return null;

  const email = primary.emailAddress.toLowerCase();
  // { clerkId: null } matches both null and missing, and never clobbers a
  // record another Clerk user has already claimed.
  return User.findOneAndUpdate(
    { email, clerkId: null },
    { $set: { clerkId: userId } },
    { returnDocument: 'after' }
  ).lean();
}

/** Page guard: redirects to /sign-in (signed out) or /register (incomplete). */
export async function requireUser() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');
  const user = await findOrLinkUser(userId);
  if (!user) redirect('/register');
  return user;
}

/** Nullable variant for pages that allow both states (e.g. /register). */
export async function getSessionUser() {
  const { userId } = await auth();
  if (!userId) return null;
  return findOrLinkUser(userId);
}

export type SessionUser = Awaited<ReturnType<typeof getSessionUser>>;
