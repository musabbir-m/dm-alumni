import { z } from 'zod';
import { connectDB } from '@/lib/db';
import User from '@/lib/models/User';
import { batches } from '@/data/batches';
import { destroyCloudinaryAsset, cloudinaryAssetFromUrl, optimizedImageUrl } from '@/lib/cloudinary';
import { DOC_FOLDER, DOC_TYPES, IMAGE_TYPES, PHOTO_FOLDER, saveUpload } from '@/lib/uploads';
import type { CloudinaryAsset } from '@/lib/cloudinary';

export type ProfileState =
  | { status: 'idle' }
  | { status: 'error'; errors: Record<string, string>; message?: string }
  | { status: 'success' };

const updateSchema = z.object({
  name: z.string().trim().min(1, 'Full name is required'),
  phone: z.string().trim().regex(/^\+?[\d\s()-]{10,17}$/, 'Enter a valid phone number'),
  batch: z.string().refine((v) => batches.some((b) => b.year === v), 'Select your batch'),
  docType: z.enum(['certificate', 'card']),
});

function zodFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0]?.toString();
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}

/**
 * Applies a profile update for an authenticated user. Email and Student ID
 * are identity fields and are deliberately not accepted here. File entries
 * are optional — absent means "keep the current photo/document".
 *
 * Lives outside the 'use server' action so scripts can exercise it directly;
 * the action wrapper handles the session check.
 */
export async function applyProfileUpdate(
  userId: string,
  formData: FormData
): Promise<ProfileState> {
  const parsed = updateSchema.safeParse({
    name: formData.get('name') ?? '',
    phone: formData.get('phone') ?? '',
    batch: formData.get('batch') ?? '',
    docType: formData.get('docType') ?? 'certificate',
  });
  if (!parsed.success) {
    return { status: 'error', errors: zodFieldErrors(parsed.error) };
  }
  const data = parsed.data;

  const uploaded: CloudinaryAsset[] = [];
  try {
    await connectDB();
    const user = await User.findById(userId);
    if (!user) {
      return { status: 'error', errors: {}, message: 'Account not found.' };
    }

    // Verified accounts may no longer replace the document a moderator
    // verified against — only the photo stays editable. Checked before any
    // upload so a blocked attempt causes no Cloudinary churn. Absent/empty
    // entries mean "keep current" (same semantics as saveUpload).
    const docEntry = formData.get('document');
    const hasNewDoc = docEntry instanceof File && docEntry.size > 0;
    if (user.verificationStatus === 'verified' && hasNewDoc) {
      return {
        status: 'error',
        errors: {
          document:
            'Your account is verified — the verification document can no longer be changed. Contact a moderator if it needs correcting.',
        },
      };
    }

    const photo = await saveUpload(formData.get('photo'), IMAGE_TYPES, PHOTO_FOLDER);
    if (!photo.ok) return { status: 'error', errors: { photo: photo.error } };
    if (photo.asset) uploaded.push(photo.asset);

    const doc = await saveUpload(formData.get('document'), DOC_TYPES, DOC_FOLDER);
    if (!doc.ok) {
      await Promise.all(uploaded.map(destroyCloudinaryAsset));
      return { status: 'error', errors: { doc: doc.error } };
    }
    if (doc.asset) uploaded.push(doc.asset);

    const oldPhotoUrl = user.photo ?? '';
    const oldDocUrl = user.doc ?? '';

    user.name = data.name;
    user.phone = data.phone;
    user.batch = data.batch;
    if (photo.asset) user.photo = optimizedImageUrl(photo.asset.secureUrl);
    if (doc.asset) {
      user.doc = doc.asset.secureUrl;
      user.docType = data.docType;
    }
    // A new document from a not-yet-verified account (e.g. fixing a
    // rejection) re-enters the review queue; text/photo-only edits never
    // touch the status.
    if (doc.asset && user.verificationStatus !== 'verified') {
      user.verificationStatus = 'pending';
    }

    await user.save();

    // Only now that the record points at the new URLs, delete the replaced
    // assets. Legacy non-Cloudinary paths are skipped by cloudinaryAssetFromUrl.
    const replaced = [oldPhotoUrl, oldDocUrl]
      .map(cloudinaryAssetFromUrl)
      .filter((asset): asset is CloudinaryAsset => asset !== null);
    if (replaced.length) await Promise.all(replaced.map(destroyCloudinaryAsset));

    return { status: 'success' };
  } catch (err) {
    // Registration failed after uploads — don't orphan the new assets
    if (uploaded.length) await Promise.all(uploaded.map(destroyCloudinaryAsset));
    console.error('profile update failed:', err);
    return {
      status: 'error',
      errors: {},
      message: 'Something went wrong while saving your profile. Please try again.',
    };
  }
}
