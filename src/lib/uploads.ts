import { uploadToCloudinary, type CloudinaryAsset } from '@/lib/cloudinary';

/**
 * Shared upload validation for registration and profile editing. Lives
 * outside the 'use server' files because those may only export async
 * functions — and so both actions (and scripts) reuse the same rules.
 */
export const MAX_FILE_MB = 5;
export const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;

export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const DOC_TYPES = [...IMAGE_TYPES, 'application/pdf'] as const;

export const PHOTO_FOLDER = 'dm-alumni/photos';
export const DOC_FOLDER = 'dm-alumni/docs';

export type SaveUploadResult =
  | { ok: true; asset: CloudinaryAsset | null }
  | { ok: false; error: string };

/**
 * Validates an optional FormData file entry against the allow-list and size
 * cap, then uploads it to Cloudinary. Absent/empty entries are not an error —
 * the caller keeps the existing value.
 */
export async function saveUpload(
  entry: FormDataEntryValue | null,
  allowed: readonly string[],
  folder: string
): Promise<SaveUploadResult> {
  if (!entry || typeof entry === 'string' || entry.size === 0) {
    return { ok: true, asset: null };
  }
  if (!allowed.includes(entry.type)) {
    return { ok: false, error: 'Unsupported file type' };
  }
  if (entry.size > MAX_FILE_BYTES) {
    return { ok: false, error: `File must be under ${MAX_FILE_MB} MB` };
  }

  const asset = await uploadToCloudinary(Buffer.from(await entry.arrayBuffer()), folder);
  return { ok: true, asset };
}
