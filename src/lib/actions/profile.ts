'use server';

import { auth, clerkClient } from '@clerk/nextjs/server';
import { connectDB } from '@/lib/db';
import User from '@/lib/models/User';
import { applyProfileUpdate } from '@/lib/profile';
import type { ProfileState } from '@/lib/profile';

export async function updateProfile(
  _prev: ProfileState,
  formData: FormData
): Promise<ProfileState> {
  const { userId } = await auth();
  if (!userId) {
    return {
      status: 'error',
      errors: {},
      message: 'Your session has expired. Please sign in again.',
    };
  }

  await connectDB();
  const user = await User.findOne({ clerkId: userId }).lean();
  if (!user) {
    return {
      status: 'error',
      errors: {},
      message: 'Complete your profile before editing it.',
    };
  }

  const result = await applyProfileUpdate(user._id.toString(), formData);

  // Best-effort one-way name sync so the header pill (rendered from Clerk's
  // copy of the name) stays fresh. Mongo remains the source of truth — a
  // failed sync is logged and ignored.
  if (result.status === 'success') {
    const [first, ...rest] = (formData.get('name') ?? '').toString().trim().split(/\s+/);
    try {
      await (await clerkClient()).users.updateUser(userId, {
        firstName: first || undefined,
        lastName: rest.length ? rest.join(' ') : undefined,
      });
    } catch (err) {
      console.error('Clerk name sync failed (non-fatal):', err);
    }
  }

  return result;
}
