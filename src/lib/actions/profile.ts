'use server';

import { auth } from '@/auth';
import { applyProfileUpdate } from '@/lib/profile';
import type { ProfileState } from '@/lib/profile';

export async function updateProfile(
  _prev: ProfileState,
  formData: FormData
): Promise<ProfileState> {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      status: 'error',
      errors: {},
      message: 'Your session has expired. Please sign in again.',
    };
  }
  return applyProfileUpdate(session.user.id, formData);
}
