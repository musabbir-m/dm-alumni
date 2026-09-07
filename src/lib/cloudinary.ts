import { v2 as cloudinary } from 'cloudinary';

export interface CloudinaryAsset {
  secureUrl: string;
  publicId: string;
  resourceType: 'image' | 'raw' | 'video';
}

let configured = false;

function ensureConfigured() {
  if (configured) return;
  // Lazy on purpose: scripts (tsx) load .env.local after module evaluation,
  // so a module-level read would capture undefined — same reason db.ts reads
  // MONGODB_URI inside connectDB().
  const url = process.env.CLOUDINARY_URL ?? '';
  const match = url.match(/^cloudinary:\/\/([^:@]+):([^@]+)@([^@/?]+)\s*$/);
  if (!match) {
    throw new Error(
      'CLOUDINARY_URL is missing or malformed — expected cloudinary://<api_key>:<api_secret>@<cloud_name>'
    );
  }
  cloudinary.config({
    api_key: match[1],
    api_secret: match[2],
    cloud_name: match[3],
    secure: true,
  });
  configured = true;
}

/**
 * Uploads a buffer and returns the publicly deliverable URL plus the info
 * needed to delete the asset later. `resource_type: 'auto'` lets the same
 * call serve profile photos (jpeg/png/webp) and PDF verification documents.
 */
export async function uploadToCloudinary(
  buffer: Buffer,
  folder: string
): Promise<CloudinaryAsset> {
  ensureConfigured();
  return new Promise<CloudinaryAsset>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'auto' },
      (error, result) => {
        if (error || !result) {
          // Cloudinary reports API errors as plain objects ({message, http_code}),
          // not Error instances — stringify them or they surface as a useless
          // "Cloudinary upload failed".
          reject(
            error instanceof Error
              ? error
              : new Error(`Cloudinary upload failed: ${JSON.stringify(error ?? 'no result')}`)
          );
          return;
        }
        resolve({
          secureUrl: result.secure_url,
          publicId: result.public_id,
          resourceType: result.resource_type as CloudinaryAsset['resourceType'],
        });
      }
    );
    stream.end(buffer);
  });
}

/** Best-effort delete — an orphaned asset is annoying, not fatal. */
export async function destroyCloudinaryAsset(asset: CloudinaryAsset): Promise<void> {
  try {
    ensureConfigured();
    await cloudinary.uploader.destroy(asset.publicId, {
      resource_type: asset.resourceType,
    });
  } catch (err) {
    console.error(`Failed to delete Cloudinary asset ${asset.publicId}:`, err);
  }
}

/** Adds automatic format/quality negotiation to a delivered image URL. */
export function optimizedImageUrl(url: string): string {
  return url.replace('/upload/', '/upload/f_auto,q_auto/');
}

/**
 * Derives the deletable asset (public_id) back out of a stored delivery URL,
 * e.g. `.../image/upload/f_auto,q_auto/v123/dm-alumni/photos/abc.png`
 *    → publicId `dm-alumni/photos/abc`. Returns null for non-Cloudinary URLs
 * (e.g. legacy local paths), so callers can skip deletion.
 */
export function cloudinaryAssetFromUrl(url: string): CloudinaryAsset | null {
  if (!url.startsWith('https://res.cloudinary.com/')) return null;
  const marker = '/upload/';
  const idx = url.indexOf(marker);
  if (idx === -1) return null;

  let rest = url.slice(idx + marker.length);
  // Strip an optional transformation segment and/or version segment:
  // `f_auto,q_auto/v123/…`, `v123/…`, or a bare public id.
  const stripped = rest.match(/^(?:[^/]+\/)?v\d+\//);
  if (stripped) rest = rest.slice(stripped[0].length);

  const publicId = rest.replace(/\.[a-z0-9]+$/i, '');
  if (!publicId) return null;
  return { secureUrl: url, publicId, resourceType: 'image' };
}
