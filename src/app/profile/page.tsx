import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Waves, ArrowLeft, Mail, Phone, IdCard, GraduationCap,
  Clock, CheckCircle2, XCircle, ShieldCheck, FileText, Pencil,
} from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { batches } from '@/data/batches';
import ThemeToggle from '@/components/ThemeToggle';
import LogoutButton from '@/components/LogoutButton';
import type { Role, VerificationStatus } from '@/lib/models/User';

export const metadata: Metadata = {
  title: 'My Profile — DM Alumni Association',
  description: 'Your DM Alumni Association profile and membership details.',
};

const STATUS_STYLES: Record<VerificationStatus, { icon: typeof Clock; label: string; cls: string }> = {
  verified: {
    icon: CheckCircle2,
    label: 'Verified',
    cls: 'bg-reef-50 text-reef-700 ring-reef-300 dark:bg-reef-500/10 dark:text-reef-300 dark:ring-reef-500/30',
  },
  pending: {
    icon: Clock,
    label: 'Pending verification',
    cls: 'bg-amber-50 text-amber-700 ring-amber-300 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30',
  },
  rejected: {
    icon: XCircle,
    label: 'Verification rejected',
    cls: 'bg-red-50 text-red-700 ring-red-300 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/30',
  },
};

const ROLE_LABELS: Record<Role, string> = {
  alumni: 'Alumni',
  moderator: 'Batch Moderator',
  admin: 'Admin',
};

export default async function ProfilePage() {
  const user = await requireUser();

  const status = user.verificationStatus ?? 'pending';
  const role = user.role ?? 'alumni';
  const StatusIcon = STATUS_STYLES[status].icon;
  const batchInfo = batches.find((b) => b.year === user.batch);
  const memberSince = user.createdAt
    ? new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(user.createdAt)
    : null;
  const initials = user.name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  const details = [
    { icon: Mail, label: 'Email', value: user.email },
    { icon: Phone, label: 'Phone', value: user.phone },
    { icon: IdCard, label: 'Student ID', value: user.studentId },
    {
      icon: GraduationCap,
      label: 'Batch',
      value: batchInfo ? `${batchInfo.year} — ${batchInfo.label}` : user.batch,
    },
  ];

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-ocean-50 via-white to-reef-50 dark:from-ocean-950 dark:via-ocean-900 dark:to-reef-950">
      {/* Animated aurora orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 top-1/4 h-[500px] w-[500px] rounded-full bg-ocean-300/25 blur-[120px] animate-aurora dark:bg-ocean-500/15" />
        <div className="absolute -right-20 top-10 h-[400px] w-[400px] rounded-full bg-reef-300/20 blur-[100px] animate-aurora-slow dark:bg-reef-500/15" />
      </div>
      <div className="absolute inset-0 bg-grid opacity-40 dark:opacity-30" />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-4xl flex-col px-5 py-6 sm:px-8">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <Link href="/" className="group flex items-center gap-2.5">
            <span className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-ocean-500 to-reef-500 shadow-lg shadow-ocean-400/40 transition-transform group-hover:scale-105 group-hover:rotate-3">
              <Waves className="h-5 w-5 text-white" strokeWidth={2.2} />
            </span>
            <span className="flex flex-col leading-none">
              <span className="font-display text-base font-bold tracking-tight text-ocean-900 dark:text-white">
                DM Alumni
              </span>
              <span className="text-[11px] font-medium tracking-wide text-ocean-500 dark:text-ocean-300">
                Disaster Management
              </span>
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-xl border border-ocean-200/60 bg-white/60 px-3.5 py-2 text-xs font-semibold text-ocean-700 backdrop-blur-md transition-all hover:border-ocean-300 hover:text-ocean-900 dark:border-ocean-700/50 dark:bg-ocean-800/40 dark:text-ocean-200 dark:hover:border-ocean-600 dark:hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to home
            </Link>
          </div>
        </div>

        {/* Profile card */}
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full overflow-hidden rounded-3xl border border-ocean-200/50 bg-white/60 shadow-2xl shadow-ocean-200/20 backdrop-blur-md dark:border-ocean-800/60 dark:bg-gradient-to-br dark:from-ocean-900/80 dark:to-ocean-950/80 dark:shadow-ocean-950/40 dark:backdrop-blur-xl">
            {/* Identity header */}
            <div className="relative overflow-hidden bg-gradient-to-br from-ocean-700 via-ocean-600 to-reef-600 p-8 dark:from-ocean-900 dark:via-ocean-800 dark:to-reef-900 sm:p-10">
              <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-reef-300/15 blur-[80px] animate-aurora" />
                <div className="absolute -left-10 bottom-0 h-40 w-40 rounded-full bg-ocean-300/15 blur-[80px] animate-aurora-slow" />
              </div>

              <div className="relative flex flex-col items-start gap-5 sm:flex-row sm:items-center">
                {user.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.photo}
                    alt={user.name}
                    className="h-20 w-20 shrink-0 rounded-2xl object-cover ring-4 ring-white/20"
                  />
                ) : (
                  <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-2xl font-bold text-white ring-1 ring-white/25">
                    {initials}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <h1 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
                    {user.name}
                  </h1>
                  <p className="mt-1 text-sm text-ocean-50/80">
                    {ROLE_LABELS[role]}
                    {role === 'moderator' && user.moderatorBatch ? ` — Batch ${user.moderatorBatch}` : ''}
                    {memberSince ? ` · Member since ${memberSince}` : ''}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 ${STATUS_STYLES[status].cls}`}>
                      <StatusIcon className="h-3.5 w-3.5" />
                      {STATUS_STYLES[status].label}
                    </span>
                    {role !== 'alumni' && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-ocean-500/20 px-3 py-1 text-xs font-semibold text-ocean-50 ring-1 ring-ocean-300/30">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        {ROLE_LABELS[role]}
                      </span>
                    )}
                  </div>
                </div>
                <div className="sm:self-start">
                  <LogoutButton
                    className="inline-flex items-center gap-1.5 rounded-xl border border-white/25 bg-white/10 px-3.5 py-2 text-xs font-semibold text-white backdrop-blur-md transition-all hover:border-white/40 hover:bg-white/20"
                    label="Log out"
                  />
                </div>
              </div>
            </div>

            {/* Details */}
            <div className="p-8 sm:p-10">
              {status === 'pending' && (
                <div className="mb-8 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3.5 text-sm leading-relaxed text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                  <Clock className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>
                    A moderator from your batch will review your details soon.
                    Until then, some areas of the network (like the alumni
                    directory) stay hidden.
                  </p>
                </div>
              )}
              {status === 'rejected' && (
                <div className="mb-8 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50/80 px-4 py-3.5 text-sm leading-relaxed text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>
                    Your verification was declined by a batch moderator. Please
                    reach out to the association to update your details.
                  </p>
                </div>
              )}

              <h2 className="font-display text-lg font-bold tracking-tight text-ocean-900 dark:text-white">
                Membership details
              </h2>
              <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                {details.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center gap-3.5 rounded-xl border border-ocean-100 bg-white/50 px-4 py-3.5 dark:border-ocean-800/60 dark:bg-ocean-950/40"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ocean-100/70 text-ocean-600 dark:bg-ocean-800/60 dark:text-ocean-200">
                      <item.icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <dt className="text-xs font-medium uppercase tracking-wide text-ocean-400 dark:text-ocean-300/60">
                        {item.label}
                      </dt>
                      <dd className="truncate text-sm font-semibold text-ocean-900 dark:text-white">
                        {item.value}
                      </dd>
                    </div>
                  </div>
                ))}
              </dl>

              <div className="mt-6 flex flex-col gap-3 border-t border-ocean-100 pt-6 dark:border-ocean-800/60 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2 text-sm text-ocean-500 dark:text-ocean-300/70">
                  <FileText className="h-4 w-4" />
                  {user.doc ? (
                    <a
                      href={user.doc}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-reef-600 transition-colors hover:text-reef-500 dark:text-reef-300 dark:hover:text-reef-200"
                    >
                      View your verification document
                    </a>
                  ) : user.docType ? (
                    'Verification document pending upload'
                  ) : (
                    'No verification document uploaded'
                  )}
                </div>
                <Link
                  href="/profile/edit"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-ocean-500 to-reef-500 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-ocean-300/40 transition-all hover:brightness-110 dark:from-ocean-400 dark:to-reef-500 dark:text-ocean-950 dark:shadow-ocean-950/40"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit profile
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
