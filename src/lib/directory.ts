import { connectDB } from '@/lib/db';
import User from '@/lib/models/User';

/**
 * Queries behind the batch directory: the verified-alumni counts on the
 * homepage's Batches section and the per-batch member list on
 * /alumni/[year]. Plain server module (NOT 'use server') so tsx scripts can
 * exercise it directly. Verification gating lives here: only verified
 * members are ever counted or listed.
 */

/** Serializable member card for the directory client component. */
export interface DirectoryMember {
  id: string;
  name: string;
  photo: string | null;
  email: string;
  phone: string;
  profession: string | null;
  linkedinUrl: string | null;
  initials: string;
  isSelf: boolean;
}

/** True when the URL points at linkedin.com or a subdomain (www., bd., …) —
 *  guards hrefs rendered from the DB, which the write path validates but
 *  seeded/manual records could bypass. */
export function isLinkedInUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === 'linkedin.com' || host.endsWith('.linkedin.com');
  } catch {
    return false;
  }
}

/** Verified member count per batch year, e.g. { '2018': 3 }. Throws on DB
 *  failure — callers decide the fallback (the homepage falls back to the
 *  static estimates in src/data/batches.ts). */
export async function getVerifiedBatchCounts(): Promise<Record<string, number>> {
  await connectDB();
  const rows = await User.aggregate<{ _id: string; count: number }>([
    { $match: { verificationStatus: 'verified' } },
    { $group: { _id: '$batch', count: { $sum: 1 } } },
  ]);
  return Object.fromEntries(rows.map((r) => [r._id, r.count]));
}

/** Verified members of one batch, name-sorted and mapped to plain objects
 *  (lean() keeps ObjectId _id, which must not cross into client props). */
export async function getVerifiedBatchAlumni(
  year: string,
  viewerId: string
): Promise<DirectoryMember[]> {
  await connectDB();
  const docs = await User.find({ batch: year, verificationStatus: 'verified' })
    .select('name photo email phone profession linkedinUrl')
    .sort({ name: 1 })
    .lean();
  return docs.map((u) => ({
    id: u._id.toString(),
    name: u.name,
    photo: u.photo ?? null,
    email: u.email,
    phone: u.phone,
    // lean() applies no schema defaults — older docs simply lack the keys
    profession: u.profession ?? null,
    // href reaches the client only when it really points at LinkedIn
    linkedinUrl: isLinkedInUrl(u.linkedinUrl) ? u.linkedinUrl : null,
    initials: u.name
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join(''),
    isSelf: u._id.toString() === viewerId,
  }));
}
