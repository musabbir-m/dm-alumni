'use server';

import { hash } from 'bcryptjs';
import { z } from 'zod';
import { connectDB } from '@/lib/db';
import User from '@/lib/models/User';
import { batches } from '@/data/batches';
import { destroyCloudinaryAsset, optimizedImageUrl } from '@/lib/cloudinary';
import type { CloudinaryAsset } from '@/lib/cloudinary';
import {
  DOC_FOLDER,
  DOC_TYPES,
  IMAGE_TYPES,
  PHOTO_FOLDER,
  saveUpload,
} from '@/lib/uploads';

export type RegisterState =
  | { status: 'idle' }
  | { status: 'error'; errors: Record<string, string>; message?: string }
  | { status: 'success'; name: string };

const registerSchema = z
  .object({
    name: z.string().trim().min(1, 'Full name is required'),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .refine((v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'Enter a valid email address'),
    phone: z.string().trim().regex(/^\+?[\d\s()-]{10,17}$/, 'Enter a valid phone number'),
    studentId: z.string().trim().min(1, 'Student ID is required'),
    batch: z.string().refine((v) => batches.some((b) => b.year === v), 'Select your batch'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
    docType: z.enum(['certificate', 'card']),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

function zodFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0]?.toString();
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}

export async function register(
  _prev: RegisterState,
  formData: FormData
): Promise<RegisterState> {
  const parsed = registerSchema.safeParse({
    name: formData.get('name') ?? '',
    email: formData.get('email') ?? '',
    phone: formData.get('phone') ?? '',
    studentId: formData.get('studentId') ?? '',
    batch: formData.get('batch') ?? '',
    password: formData.get('password') ?? '',
    confirmPassword: formData.get('confirmPassword') ?? '',
    docType: formData.get('docType') ?? 'certificate',
  });
  if (!parsed.success) {
    return { status: 'error', errors: zodFieldErrors(parsed.error) };
  }
  const data = parsed.data;

  // Track successful uploads so a later failure can destroy them instead of
  // leaving orphaned assets in the Cloudinary account.
  const uploaded: CloudinaryAsset[] = [];

  try {
    await connectDB();

    const existing = await User.findOne({
      $or: [{ email: data.email }, { studentId: data.studentId }],
    }).lean();
    if (existing) {
      const errors: Record<string, string> = {};
      if (existing.email === data.email) errors.email = 'An account with this email already exists';
      if (existing.studentId === data.studentId)
        errors.studentId = 'An account with this Student ID already exists';
      return { status: 'error', errors };
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

    const passwordHash = await hash(data.password, 12);
    await User.create({
      name: data.name,
      email: data.email,
      phone: data.phone,
      studentId: data.studentId,
      batch: data.batch,
      passwordHash,
      // MongoDB stores only the delivered Cloudinary URLs.
      photo: photo.asset ? optimizedImageUrl(photo.asset.secureUrl) : null,
      docType: doc.asset ? data.docType : null,
      doc: doc.asset ? doc.asset.secureUrl : null,
      // role/verificationStatus default to 'alumni'/'pending' — a batch
      // moderator flips the status after registration.
    });

    return { status: 'success', name: data.name };
  } catch (err) {
    if (uploaded.length) await Promise.all(uploaded.map(destroyCloudinaryAsset));

    // Duplicate-key race (unique indexes) despite the pre-check above
    if ((err as { code?: number })?.code === 11000) {
      return {
        status: 'error',
        errors: { email: 'An account with this email or Student ID already exists' },
      };
    }
    console.error('register action failed:', err);
    return {
      status: 'error',
      errors: {},
      message: 'Something went wrong while creating your account. Please try again.',
    };
  }
}
