'use client';

import { useEffect, useActionState, useState, useRef, type ChangeEvent } from 'react';
import Link from 'next/link';
import {
  User, Mail, Phone, IdCard, GraduationCap, ImagePlus, Upload, Award,
  CreditCard, FileText, ChevronDown, CheckCircle2, Loader2, ArrowRight, X, Lock,
} from 'lucide-react';
import { batches, batchName } from '@/data/batches';
import { completeProfile } from '@/lib/actions/register';
import type { CompleteProfileState } from '@/lib/actions/register';
import { Field, iconCls, inputCls, MAX_FILE_MB } from '@/components/form-ui';

const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;

type DocType = 'certificate' | 'card';
type Errors = Partial<Record<string, string>>;

const formatSize = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

/**
 * Step 2 of registration — the Clerk account already exists (step 1 was
 * /sign-up), so email and name are locked here and only the alumni details
 * are collected.
 */
export default function CompleteProfileForm({
  clerkName,
  clerkEmail,
}: {
  clerkName: string;
  clerkEmail: string;
}) {
  const [state, formAction, isPending] = useActionState<CompleteProfileState, FormData>(
    completeProfile,
    { status: 'idle' }
  );

  const [form, setForm] = useState({
    phone: '',
    studentId: '',
    batch: '',
  });
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState('');
  const [docType, setDocType] = useState<DocType>('certificate');
  const [doc, setDoc] = useState<File | null>(null);
  // The native inputs are the source of truth on submit — the form action
  // serializes the DOM, so a file must STAY in its input or it never reaches
  // the server. State is only for preview/validation.
  const photoInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  // Local errors cover instant file-selection checks; text-field validation
  // comes back from the server action.
  const [errors, setErrors] = useState<Errors>({});

  const serverErrors = state.status === 'error' ? state.errors : {};

  // Revoke the preview object-URL when it is replaced or on unmount
  useEffect(() => {
    return () => {
      if (photoUrl) URL.revokeObjectURL(photoUrl);
    };
  }, [photoUrl]);

  const update =
    (key: keyof typeof form) =>
    (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setForm((f) => ({ ...f, [key]: e.target.value }));
    };

  const handlePhoto = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      // Drop invalid picks from the input too, so they can't ride along on submit
      e.target.value = '';
      setErrors((p) => ({ ...p, photo: 'Please choose an image file (JPG, PNG…)' }));
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      e.target.value = '';
      setErrors((p) => ({ ...p, photo: `Photo must be under ${MAX_FILE_MB} MB` }));
      return;
    }
    setErrors((p) => ({ ...p, photo: undefined }));
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhotoUrl(URL.createObjectURL(file));
    setPhoto(file);
  };

  const handleDoc = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      e.target.value = '';
      setErrors((p) => ({ ...p, doc: 'Please choose an image or PDF file' }));
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      e.target.value = '';
      setErrors((p) => ({ ...p, doc: `Document must be under ${MAX_FILE_MB} MB` }));
      return;
    }
    setErrors((p) => ({ ...p, doc: undefined }));
    setDoc(file);
  };

  const removePhoto = () => {
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhotoUrl('');
    setPhoto(null);
    if (photoInputRef.current) photoInputRef.current.value = '';
  };

  const removeDoc = () => {
    setDoc(null);
    if (docInputRef.current) docInputRef.current.value = '';
  };

  if (state.status === 'success') {
    const firstName = state.name.trim().split(/\s+/)[0];
    return (
      <div className="flex h-full min-h-[420px] flex-col items-center justify-center text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-reef-50 ring-1 ring-reef-300 animate-fade-up dark:bg-reef-500/20 dark:ring-reef-500/30">
          <CheckCircle2 className="h-8 w-8 text-reef-600 dark:text-reef-300" strokeWidth={2} />
        </span>
        <h2 className="mt-5 font-display text-2xl font-bold text-ocean-900 animate-fade-up dark:text-white" style={{ animationDelay: '0.1s', animationFillMode: 'both' }}>
          Welcome aboard, {firstName}!
        </h2>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-ocean-600/70 animate-fade-up dark:text-ocean-100/70" style={{ animationDelay: '0.2s', animationFillMode: 'both' }}>
          Your profile is complete and awaiting verification. A batch
          moderator will verify your details before your profile appears in
          the directory.
        </p>
        <div className="mt-6">
          <Link
            href="/profile"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-ocean-500 to-reef-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-ocean-300/40 transition-all hover:brightness-110 dark:from-ocean-400 dark:to-reef-500 dark:text-ocean-950 dark:shadow-ocean-950/40"
          >
            Go to your profile
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    );
  }

  const lockedCls = `${inputCls()} read-only:cursor-not-allowed read-only:opacity-70`;

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <div>
        <h2 className="font-display text-2xl font-bold tracking-tight text-ocean-900 dark:text-white">
          Complete your profile
        </h2>
        <p className="mt-1.5 text-sm text-ocean-600/70 dark:text-ocean-100/70">
          Your account is ready — add your alumni details to finish joining
          the network. Fields marked optional can be added later from your
          profile.
        </p>
      </div>

      {/* Locked identity — from the Clerk account created in step 1 */}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="clerkEmail" label="Email">
          <div className="group relative">
            <Mail className={iconCls()} />
            <input
              id="clerkEmail"
              type="email"
              value={clerkEmail}
              readOnly
              autoComplete="off"
              aria-readonly="true"
              className={lockedCls}
            />
            <Lock className="pointer-events-none absolute right-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ocean-300 dark:text-ocean-500" />
          </div>
        </Field>
        <Field id="clerkName" label="Full Name">
          <div className="group relative">
            <User className={iconCls()} />
            <input
              id="clerkName"
              type="text"
              value={clerkName || '—'}
              readOnly
              autoComplete="off"
              aria-readonly="true"
              className={lockedCls}
            />
            <Lock className="pointer-events-none absolute right-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ocean-300 dark:text-ocean-500" />
          </div>
        </Field>
      </div>

      {/* Phone + Student ID */}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="phone" label="Phone" error={serverErrors.phone}>
          <div className="group relative">
            <Phone className={iconCls(!!serverErrors.phone)} />
            <input
              id="phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              value={form.phone}
              onChange={update('phone')}
              placeholder="+880 1X XXXX XXXX"
              aria-invalid={!!serverErrors.phone}
              className={inputCls(!!serverErrors.phone)}
            />
          </div>
        </Field>
        <Field id="studentId" label="Student ID" error={serverErrors.studentId}>
          <div className="group relative">
            <IdCard className={iconCls(!!serverErrors.studentId)} />
            <input
              id="studentId"
              name="studentId"
              type="text"
              value={form.studentId}
              onChange={update('studentId')}
              placeholder="e.g. 1901078"
              aria-invalid={!!serverErrors.studentId}
              className={inputCls(!!serverErrors.studentId)}
            />
          </div>
        </Field>
      </div>

      {/* Batch */}
      <Field id="batch" label="Batch" error={serverErrors.batch}>
        <div className="group relative">
          <GraduationCap className={iconCls(!!serverErrors.batch)} />
          <select
            id="batch"
            name="batch"
            value={form.batch}
            onChange={update('batch')}
            aria-invalid={!!serverErrors.batch}
            className={`${inputCls(!!serverErrors.batch)} appearance-none pr-10`}
          >
            <option value="" disabled>
              Select your batch
            </option>
            {batches.map((b) => (
              <option key={b.year} value={b.year}>
                {batchName(b)}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ocean-400 dark:text-ocean-300" />
        </div>
      </Field>

      {/* Photo upload */}
      <Field id="photo" label="Profile Photo" optional error={errors.photo ?? serverErrors.photo}>
        <div
          className={`flex items-center gap-4 rounded-xl border-2 border-dashed p-3.5 transition-all ${
            photo
              ? 'border-reef-400/70 bg-reef-50/50 dark:border-reef-500/50 dark:bg-reef-500/10'
              : 'border-ocean-200 bg-white/40 dark:border-ocean-800 dark:bg-ocean-950/40'
          }`}
        >
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoUrl}
              alt="Profile preview"
              className="h-14 w-14 shrink-0 rounded-full object-cover ring-2 ring-reef-400/40"
            />
          ) : (
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-ocean-100/70 text-ocean-500 dark:bg-ocean-800/60 dark:text-ocean-300">
              <ImagePlus className="h-6 w-6" />
            </span>
          )}
          <label htmlFor="photo" className="min-w-0 flex-1 cursor-pointer">
            <input
              id="photo"
              name="photo"
              type="file"
              accept="image/*"
              onChange={handlePhoto}
              ref={photoInputRef}
              className="sr-only"
            />
            <span className="block truncate text-sm font-medium text-ocean-800 dark:text-ocean-100">
              {photo ? photo.name : 'Choose a photo'}
            </span>
            <span className="block text-xs text-ocean-400 dark:text-ocean-300/60">
              {photo ? `${formatSize(photo.size)} · click to replace` : `JPG or PNG, up to ${MAX_FILE_MB} MB`}
            </span>
          </label>
          {photo && (
            <button
              type="button"
              aria-label="Remove photo"
              onClick={removePhoto}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ocean-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:text-ocean-300 dark:hover:bg-red-500/10 dark:hover:text-red-400"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </Field>

      {/* Verification document */}
      <Field id="document" label="Verification Document" optional error={errors.doc ?? serverErrors.doc}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                { key: 'certificate', label: 'Graduation Certificate', icon: Award },
                { key: 'card', label: 'Registration Card', icon: CreditCard },
              ] as const
            ).map((opt) => (
              <button
                key={opt.key}
                type="button"
                aria-pressed={docType === opt.key}
                onClick={() => setDocType(opt.key)}
                className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-3 text-left text-sm font-medium transition-all ${
                  docType === opt.key
                    ? 'border-reef-500 bg-reef-50/70 text-ocean-900 ring-2 ring-reef-400/25 dark:border-reef-500/60 dark:bg-reef-500/10 dark:text-white'
                    : 'border-ocean-200 bg-white/50 text-ocean-700 hover:border-ocean-300 dark:border-ocean-800 dark:bg-ocean-950/40 dark:text-ocean-200 dark:hover:border-ocean-700'
                }`}
              >
                <opt.icon
                  className={`h-5 w-5 shrink-0 ${
                    docType === opt.key
                      ? 'text-reef-600 dark:text-reef-300'
                      : 'text-ocean-400 dark:text-ocean-300/60'
                  }`}
                  strokeWidth={2}
                />
                {opt.label}
              </button>
            ))}
          </div>

          <input type="hidden" name="docType" value={docType} />

          <label
            className={`group flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed px-4 py-3.5 transition-all ${
              doc
                ? 'border-reef-400/70 bg-reef-50/50 dark:border-reef-500/50 dark:bg-reef-500/10'
                : 'border-ocean-200 bg-white/40 hover:border-ocean-300 hover:bg-white/70 dark:border-ocean-800 dark:bg-ocean-950/40 dark:hover:border-ocean-700'
            }`}
          >
            <input
              id="document"
              name="document"
              type="file"
              accept="image/*,.pdf"
              onChange={handleDoc}
              ref={docInputRef}
              className="sr-only"
            />
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-ocean-100/70 text-ocean-600 dark:bg-ocean-800/60 dark:text-ocean-200">
              {doc ? <FileText className="h-5 w-5" /> : <Upload className="h-5 w-5" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-ocean-800 dark:text-ocean-100">
                {doc
                  ? doc.name
                  : docType === 'certificate'
                    ? 'Upload graduation certificate'
                    : 'Upload registration card'}
              </span>
              <span className="block text-xs text-ocean-400 dark:text-ocean-300/60">
                {doc ? `${formatSize(doc.size)} · click to replace` : `Image or PDF, up to ${MAX_FILE_MB} MB`}
              </span>
            </span>
            {doc && (
              <span
                role="button"
                tabIndex={0}
                aria-label="Remove document"
                onClick={(e) => {
                  e.preventDefault();
                  removeDoc();
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    removeDoc();
                  }
                }}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ocean-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:text-ocean-300 dark:hover:bg-red-500/10 dark:hover:text-red-400"
              >
                <X className="h-4 w-4" />
              </span>
            )}
          </label>
          <p className="text-xs leading-relaxed text-ocean-400 dark:text-ocean-300/50">
            Choose either document — it helps your batch moderator verify you faster.
          </p>
        </div>
      </Field>

      {state.status === 'error' && state.message && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300" role="alert">
          {state.message}
        </p>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={isPending}
        className="group relative inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-ocean-500 to-reef-500 px-6 py-3.5 text-sm font-semibold text-white shadow-xl shadow-ocean-300/40 transition-all hover:brightness-110 disabled:opacity-70 dark:from-ocean-400 dark:to-reef-500 dark:text-ocean-950 dark:shadow-ocean-950/40"
      >
        {isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Saving your profile…
          </>
        ) : (
          <>
            <span className="relative z-10">Complete registration</span>
            <ArrowRight className="relative z-10 h-4 w-4 transition-transform group-hover:translate-x-1" />
            <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
          </>
        )}
      </button>
      <p className="text-center text-xs text-ocean-400 dark:text-ocean-300/40">
        By registering, you agree to the association&apos;s code of conduct.
      </p>
    </form>
  );
}
