'use client';

import { useEffect, useActionState, useState, useRef, type ChangeEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  User, Mail, Phone, IdCard, GraduationCap, ImagePlus, Upload, Award,
  CreditCard, FileText, ChevronDown, Loader2, CheckCircle2, X, Lock, ArrowLeft, Briefcase,
} from 'lucide-react';
import { LinkedinIcon } from '@/components/BrandIcons';
import { batches, batchName } from '@/data/batches';
import { updateProfile } from '@/lib/actions/profile';
import type { ProfileState } from '@/lib/profile';
import { Field, iconCls, inputCls, MAX_FILE_MB } from '@/components/form-ui';

const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;

type DocType = 'certificate' | 'card';
type Errors = Partial<Record<string, string>>;

export interface ProfileEditInitial {
  name: string;
  email: string;
  phone: string;
  studentId: string;
  batch: string;
  profession: string; // '' if none
  linkedinUrl: string; // '' if none
  docType: DocType;
  photo: string; // current Cloudinary URL ('' if none)
  doc: string; // current Cloudinary URL ('' if none)
}

const formatSize = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

export default function ProfileEditForm({
  initial,
  docLocked = false,
}: {
  initial: ProfileEditInitial;
  /** verificationStatus === 'verified' — document (and its type) is immutable */
  docLocked?: boolean;
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState<ProfileState, FormData>(updateProfile, {
    status: 'idle',
  });

  const [form, setForm] = useState({
    name: initial.name,
    phone: initial.phone,
    batch: initial.batch,
    profession: initial.profession,
    linkedinUrl: initial.linkedinUrl,
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [objectUrl, setObjectUrl] = useState('');
  const [docType, setDocType] = useState<DocType>(initial.docType);
  const [docFile, setDocFile] = useState<File | null>(null);
  // The native inputs are the source of truth on submit — the form action
  // serializes the DOM, so a file must STAY in its input or it never reaches
  // the server. State is only for preview/validation.
  const photoInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  // Instant file-selection feedback; text-field errors come back from the server.
  const [errors, setErrors] = useState<Errors>({});

  const serverErrors = state.status === 'error' ? state.errors : {};
  const photoPreview = objectUrl || initial.photo;

  // Revoke the preview object-URL when it is replaced or on unmount
  useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);

  // Pull fresh server data into the page behind this form after a save, and
  // drop the just-uploaded file selections so a second "Save" doesn't
  // re-upload (and replace) the same assets. The save result arrives
  // asynchronously, so this cleanup can't live in an event handler — which is
  // why the set-state-in-effect rule is silenced for this effect only.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (state.status !== 'success') return;
    setPhotoFile(null);
    setDocFile(null);
    setObjectUrl(''); // the [objectUrl] effect's cleanup revokes it
    if (photoInputRef.current) photoInputRef.current.value = '';
    if (docInputRef.current) docInputRef.current.value = '';
    router.refresh();
  }, [state, router]);
  /* eslint-enable react-hooks/set-state-in-effect */

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
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    setObjectUrl(URL.createObjectURL(file));
    setPhotoFile(file);
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
    setDocFile(file);
  };

  const removePhotoSelection = () => {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    setObjectUrl('');
    setPhotoFile(null);
    if (photoInputRef.current) photoInputRef.current.value = '';
  };

  const removeDocSelection = () => {
    setDocFile(null);
    if (docInputRef.current) docInputRef.current.value = '';
  };

  const lockedCls = `${inputCls()} read-only:cursor-not-allowed read-only:opacity-70`;

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight text-ocean-900 dark:text-white">
            Edit profile
          </h2>
          <p className="mt-1.5 text-sm text-ocean-600/70 dark:text-ocean-100/70">
            {docLocked
              ? 'Your email and Student ID can’t be changed, and your verification document is locked because your account is verified.'
              : 'Your email and Student ID identify you across the network and can’t be changed.'}
          </p>
        </div>
        <Link
          href="/profile"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-reef-600 transition-colors hover:text-reef-500 dark:text-reef-300 dark:hover:text-reef-200"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to profile
        </Link>
      </div>

      {/* Locked identity fields */}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="email" label="Email">
          <div className="group relative">
            <Mail className={iconCls()} />
            <input
              id="email"
              type="email"
              value={initial.email}
              readOnly
              autoComplete="off"
              className={lockedCls}
            />
            <Lock className="pointer-events-none absolute right-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ocean-300 dark:text-ocean-500" />
          </div>
        </Field>
        <Field id="studentId" label="Student ID">
          <div className="group relative">
            <IdCard className={iconCls()} />
            <input
              id="studentId"
              type="text"
              value={initial.studentId}
              readOnly
              autoComplete="off"
              className={lockedCls}
            />
            <Lock className="pointer-events-none absolute right-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ocean-300 dark:text-ocean-500" />
          </div>
        </Field>
      </div>

      {/* Name */}
      <Field id="name" label="Full Name" error={serverErrors.name}>
        <div className="group relative">
          <User className={iconCls(!!serverErrors.name)} />
          <input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            value={form.name}
            onChange={update('name')}
            placeholder="Your full name"
            aria-invalid={!!serverErrors.name}
            className={inputCls(!!serverErrors.name)}
          />
        </div>
      </Field>

      {/* Phone + Batch */}
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
              {batches.map((b) => (
                <option key={b.year} value={b.year}>
                  {batchName(b)}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ocean-400 dark:text-ocean-300" />
          </div>
        </Field>
      </div>

      {/* Profession + LinkedIn — optional, shown on the batch directory card */}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="profession" label="Profession" optional error={serverErrors.profession}>
          <div className="group relative">
            <Briefcase className={iconCls(!!serverErrors.profession)} />
            <input
              id="profession"
              name="profession"
              type="text"
              value={form.profession}
              onChange={update('profession')}
              placeholder="e.g. Program Officer at BRAC"
              aria-invalid={!!serverErrors.profession}
              className={inputCls(!!serverErrors.profession)}
            />
          </div>
        </Field>
        <Field id="linkedinUrl" label="LinkedIn Profile URL" optional error={serverErrors.linkedinUrl}>
          <div className="group relative">
            <LinkedinIcon className={iconCls(!!serverErrors.linkedinUrl)} />
            <input
              id="linkedinUrl"
              name="linkedinUrl"
              type="url"
              inputMode="url"
              value={form.linkedinUrl}
              onChange={update('linkedinUrl')}
              placeholder="https://www.linkedin.com/in/…"
              aria-invalid={!!serverErrors.linkedinUrl}
              className={inputCls(!!serverErrors.linkedinUrl)}
            />
          </div>
        </Field>
      </div>

      {/* Photo */}
      <Field id="photo" label="Profile Photo" optional error={errors.photo ?? serverErrors.photo}>
        <div
          className={`flex items-center gap-4 rounded-xl border-2 border-dashed p-3.5 transition-all ${
            photoFile
              ? 'border-reef-400/70 bg-reef-50/50 dark:border-reef-500/50 dark:bg-reef-500/10'
              : 'border-ocean-200 bg-white/40 dark:border-ocean-800 dark:bg-ocean-950/40'
          }`}
        >
          {photoPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoPreview}
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
              {photoFile ? photoFile.name : initial.photo ? 'Choose a new photo' : 'Add a photo'}
            </span>
            <span className="block text-xs text-ocean-400 dark:text-ocean-300/60">
              {photoFile
                ? `${formatSize(photoFile.size)} · click to replace`
                : initial.photo
                  ? `Current photo · JPG or PNG, up to ${MAX_FILE_MB} MB`
                  : `JPG or PNG, up to ${MAX_FILE_MB} MB`}
            </span>
          </label>
          {photoFile ? (
            <button
              type="button"
              aria-label="Discard new photo"
              onClick={removePhotoSelection}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ocean-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:text-ocean-300 dark:hover:bg-red-500/10 dark:hover:text-red-400"
            >
              <X className="h-4 w-4" />
            </button>
          ) : (
            <Lock className="hidden h-4 w-4 text-ocean-300 dark:text-ocean-500" aria-hidden />
          )}
        </div>
      </Field>

      {/* Verification document */}
      <Field
        id="document"
        label="Verification Document"
        optional
        error={errors.doc ?? serverErrors.doc ?? serverErrors.document}
      >
        {docLocked ? (
          <div className="space-y-3">
            {/* No file input when locked — the hidden docType keeps zod happy */}
            <input type="hidden" name="docType" value={docType} />
            <div className="flex items-center gap-3 rounded-xl border border-ocean-200 bg-white/40 px-4 py-3.5 dark:border-ocean-800 dark:bg-ocean-950/40">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-ocean-100/70 text-ocean-600 dark:bg-ocean-800/60 dark:text-ocean-200">
                <FileText className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ocean-800 dark:text-ocean-100">
                  {docType === 'certificate' ? 'Graduation certificate' : 'Registration card'}
                </span>
                <span className="block text-xs text-ocean-400 dark:text-ocean-300/60">
                  Locked because your account is verified — your profile photo stays editable.
                </span>
              </span>
              <Lock className="h-4 w-4 shrink-0 text-ocean-300 dark:text-ocean-500" />
            </div>
            {initial.doc && (
              <a
                href={initial.doc}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-reef-600 transition-colors hover:text-reef-500 dark:text-reef-300 dark:hover:text-reef-200"
              >
                <FileText className="h-3.5 w-3.5" />
                View current document
              </a>
            )}
          </div>
        ) : (
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
                docFile
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
                {docFile ? <FileText className="h-5 w-5" /> : <Upload className="h-5 w-5" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ocean-800 dark:text-ocean-100">
                  {docFile
                    ? docFile.name
                    : initial.doc
                      ? 'Upload a replacement document'
                      : docType === 'certificate'
                        ? 'Upload graduation certificate'
                        : 'Upload registration card'}
                </span>
                <span className="block text-xs text-ocean-400 dark:text-ocean-300/60">
                  {docFile
                    ? `${formatSize(docFile.size)} · click to replace`
                    : initial.doc
                      ? 'Current document stays until you upload a new one · image or PDF'
                      : `Image or PDF, up to ${MAX_FILE_MB} MB`}
                </span>
              </span>
              {docFile && (
                <span
                  role="button"
                  tabIndex={0}
                  aria-label="Discard new document"
                  onClick={(e) => {
                    e.preventDefault();
                    removeDocSelection();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      removeDocSelection();
                    }
                  }}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ocean-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:text-ocean-300 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                >
                  <X className="h-4 w-4" />
                </span>
              )}
            </label>
            {initial.doc && !docFile && (
              <a
                href={initial.doc}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-reef-600 transition-colors hover:text-reef-500 dark:text-reef-300 dark:hover:text-reef-200"
              >
                <FileText className="h-3.5 w-3.5" />
                View current document
              </a>
            )}
          </div>
        )}
      </Field>

      {state.status === 'error' && state.message && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300" role="alert">
          {state.message}
        </p>
      )}
      {state.status === 'success' && (
        <p className="flex items-center gap-2 rounded-xl border border-reef-200 bg-reef-50/80 px-4 py-3 text-sm font-medium text-reef-700 dark:border-reef-500/30 dark:bg-reef-500/10 dark:text-reef-300" role="status">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Profile updated successfully.
        </p>
      )}

      {/* Save */}
      <button
        type="submit"
        disabled={isPending}
        className="group relative inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-ocean-500 to-reef-500 px-6 py-3.5 text-sm font-semibold text-white shadow-xl shadow-ocean-300/40 transition-all hover:brightness-110 disabled:opacity-70 dark:from-ocean-400 dark:to-reef-500 dark:text-ocean-950 dark:shadow-ocean-950/40"
      >
        {isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Saving changes…
          </>
        ) : (
          <>
            <span className="relative z-10">Save changes</span>
            <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
          </>
        )}
      </button>
    </form>
  );
}
