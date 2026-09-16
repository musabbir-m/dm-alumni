'use server';

import { auth, currentUser } from '@clerk/nextjs/server';
import { z } from 'zod';
import { connectDB } from '@/lib/db';
import User from '@/lib/models/User';
import { batches } from '@/data/batches';
import {
  cloudinaryAssetFromUrl,
  destroyCloudinaryAsset,
  optimizedImageUrl,
} from '@/lib/cloudinary';
import type { CloudinaryAsset } from '@/lib/cloudinary';
import {
  DOC_FOLDER,
  DOC_TYPES,
  IMAGE_TYPES,
  PHOTO_FOLDER,
  saveUpload,
} from '@/lib/uploads';
import { linkedinUrlSchema, professionSchema } from '@/lib/profile-fields';

/**
 * Step 2 of registration: the Clerk account (email + password + name) already
 * exists — this action creates/links the Mongo record with the alumni
 * details. Identity never comes from the form.
 */
export type CompleteProfileState =
  | { status: 'idle' }
  | { status: 'error'; errors: Record<string, string>; message?: string }
  | { status: 'success'; name: string };

const completeProfileSchema = z.object({
  phone: z.string().trim().regex(/^\+?[\d\s()-]{10,17}$/, 'Enter a valid phone number'),
  studentId: z.string().trim().min(1, 'Student ID is required'),
  batch: z.string().refine((v) => batches.some((b) => b.year === v), 'Select your batch'),
  profession: professionSchema,
  linkedinUrl: linkedinUrlSchema,
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

export async function completeProfile(
  _prev: CompleteProfileState,
  formData: FormData
): Promise<CompleteProfileState> {
  const { userId } = await auth();
  if (!userId) {
    return {
      status: 'error',
      errors: {},
      message: 'Your session has expired. Please sign in again.',
    };
  }

  const parsed = completeProfileSchema.safeParse({
    phone: formData.get('phone') ?? '',
    studentId: formData.get('studentId') ?? '',
    batch: formData.get('batch') ?? '',
    profession: formData.get('profession') ?? '',
    linkedinUrl: formData.get('linkedinUrl') ?? '',
    docType: formData.get('docType') ?? 'certificate',
  });
  if (!parsed.success) {
    return { status: 'error', errors: zodFieldErrors(parsed.error) };
  }
  const data = parsed.data;

  // Track successful uploads so a later failure can destroy them instead of
  // leaving orphaned assets in the Cloudinary account. `superseded` are the
  // legacy assets a successful save replaces — destroyed after the save.
  const uploaded: CloudinaryAsset[] = [];
  const superseded: CloudinaryAsset[] = [];

  try {
    // Email + name come from Clerk; the email must be verified so the
    // lazy-email-link in src/lib/auth.ts stays trustworthy.
    const cu = await currentUser();
    const primary = cu?.primaryEmailAddress;
    if (!primary || primary.verification?.status !== 'verified') {
      return {
        status: 'error',
        errors: {},
        message:
          'Verify your email before completing your profile — check your inbox for the code from the sign-up step, then try again.',
      };
    }
    const email = primary.emailAddress.toLowerCase();
    const name =
      [cu?.firstName, cu?.lastName].filter(Boolean).join(' ') || email.split('@')[0];

    await connectDB();

    if (await User.exists({ clerkId: userId })) {
      return {
        status: 'error',
        errors: {},
        message: 'Your profile is already complete — head to your profile instead.',
      };
    }

    if (await User.exists({ studentId: data.studentId })) {
      return {
        status: 'error',
        errors: { studentId: 'An account with this Student ID already exists' },
      };
    }

    const existingEmail = await User.findOne({ email }).lean();
    if (existingEmail?.clerkId) {
      // Another Clerk account already claimed the record for this email —
      // only reachable if the Clerk email changed after linking.
      return {
        status: 'error',
        errors: {},
        message:
          'An account with this email already exists. Please contact the association for help.',
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

    if (existingEmail) {
      // Pre-Clerk record whose verified email matches — claim it and fill in
      // the alumni details (this is how seeded/legacy accounts migrate).
      // Legacy Cloudinary assets being replaced are destroyed only after the
      // save succeeds (a failed save keeps them in place).
      if (photo.asset && existingEmail.photo) {
        const old = cloudinaryAssetFromUrl(existingEmail.photo);
        if (old) superseded.push(old);
      }
      if (doc.asset && existingEmail.doc) {
        const old = cloudinaryAssetFromUrl(existingEmail.doc);
        if (old) superseded.push(old);
      }
      const saved = await User.findOneAndUpdate(
        { _id: existingEmail._id, clerkId: null },
        {
          $set: {
            clerkId: userId,
            name,
            phone: data.phone,
            studentId: data.studentId,
            batch: data.batch,
            profession: data.profession,
            linkedinUrl: data.linkedinUrl,
            photo: photo.asset ? optimizedImageUrl(photo.asset.secureUrl) : existingEmail.photo,
            docType: doc.asset ? data.docType : existingEmail.docType,
            doc: doc.asset ? doc.asset.secureUrl : existingEmail.doc,
          },
        },
        { new: true }
      ).lean();
      if (!saved) throw new Error('Legacy record was claimed by another account mid-flight');
    } else {
      await User.create({
        clerkId: userId,
        name,
        email,
        phone: data.phone,
        studentId: data.studentId,
        batch: data.batch,
        profession: data.profession,
        linkedinUrl: data.linkedinUrl,
        // MongoDB stores only the delivered Cloudinary URLs.
        photo: photo.asset ? optimizedImageUrl(photo.asset.secureUrl) : null,
        docType: doc.asset ? data.docType : null,
        doc: doc.asset ? doc.asset.secureUrl : null,
        // role/verificationStatus default to 'alumni'/'pending' — a batch
        // moderator flips the status after registration.
      });
    }

    // Legacy assets replaced above were superseded, not orphaned — drop them.
    await Promise.all(superseded.map(destroyCloudinaryAsset));

    return { status: 'success', name };
  } catch (err) {
    if (uploaded.length) await Promise.all(uploaded.map(destroyCloudinaryAsset));

    // Duplicate-key race (unique indexes) despite the pre-checks above
    if ((err as { code?: number })?.code === 11000) {
      return {
        status: 'error',
        errors: { studentId: 'An account with this Student ID already exists' },
      };
    }
    console.error('completeProfile action failed:', err);
    return {
      status: 'error',
      errors: {},
      message: 'Something went wrong while saving your profile. Please try again.',
    };
  }
}
