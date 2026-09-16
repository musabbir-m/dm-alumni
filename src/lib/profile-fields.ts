import { z } from 'zod';

/**
 * Zod schemas for the optional directory-profile fields (profession,
 * LinkedIn URL) shared by registration (`src/lib/actions/register.ts`) and
 * profile editing (`src/lib/profile.ts`). Lives in a plain module because
 * 'use server' files may only export async functions.
 */

/** '' / undefined / whitespace → null ("not provided"), else trimmed value */
const emptyToNull = (v: unknown) => {
  const s = typeof v === 'string' ? v.trim() : v;
  return s === '' || s === undefined || s === null ? null : s;
};

/** Optional free-text profession. Output: string | null */
export const professionSchema = z.preprocess(
  emptyToNull,
  z.string().max(100, 'Profession must be 100 characters or fewer').nullable()
);

/** Optional LinkedIn profile URL — any linkedin.com host (www., bd., …).
 *  Output: string | null. Submitting empty clears the stored value. */
export const linkedinUrlSchema = z.preprocess(
  emptyToNull,
  z
    .string()
    .url('Enter a valid URL')
    .refine(
      (v) => {
        try {
          const host = new URL(v).hostname.toLowerCase();
          return host === 'linkedin.com' || host.endsWith('.linkedin.com');
        } catch {
          return false;
        }
      },
      { message: 'Enter a link to your LinkedIn profile (linkedin.com)' }
    )
    .nullable()
);
