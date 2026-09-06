'use server';

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { hash } from 'bcryptjs';
import { z } from 'zod';
import { connectDB } from '@/lib/db';
import User from '@/lib/models/User';
import { batches } from '@/data/batches';

const MAX_FILE_MB = 5;
const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
const DOC_TYPES = [...IMAGE_TYPES, 'application/pdf'] as const;

const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

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

async function saveUpload(
  entry: FormDataEntryValue | null,
  allowed: readonly string[],
  folder: 'photos' | 'docs'
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  if (!entry || typeof entry === 'string' || entry.size === 0) return { ok: true, url: '' };

  const ext = EXT_BY_TYPE[entry.type];
  if (!ext || !allowed.includes(entry.type)) {
    return { ok: false, error: 'Unsupported file type' };
  }
  if (entry.size > MAX_FILE_BYTES) {
    return { ok: false, error: `File must be under ${MAX_FILE_MB} MB` };
  }

  const dir = path.join(process.cwd(), 'public', 'uploads', folder);
  await mkdir(dir, { recursive: true });
  const filename = `${randomUUID()}.${ext}`;
  await writeFile(path.join(dir, filename), Buffer.from(await entry.arrayBuffer()));
  return { ok: true, url: `/uploads/${folder}/${filename}` };
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

    const photo = await saveUpload(formData.get('photo'), IMAGE_TYPES, 'photos');
    if (!photo.ok) return { status: 'error', errors: { photo: photo.error } };
    const doc = await saveUpload(formData.get('document'), DOC_TYPES, 'docs');
    if (!doc.ok) return { status: 'error', errors: { doc: doc.error } };

    const passwordHash = await hash(data.password, 12);
    await User.create({
      name: data.name,
      email: data.email,
      phone: data.phone,
      studentId: data.studentId,
      batch: data.batch,
      passwordHash,
      photo: photo.url || null,
      docType: doc.url ? data.docType : null,
      doc: doc.url || null,
      // role/verificationStatus default to 'alumni'/'pending' — a batch
      // moderator flips the status after registration.
    });

    return { status: 'success', name: data.name };
  } catch (err) {
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
