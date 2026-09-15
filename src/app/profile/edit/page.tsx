import type { Metadata } from 'next';
import Link from 'next/link';
import { Waves, ArrowLeft } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import ThemeToggle from '@/components/ThemeToggle';
import ProfileEditForm from '@/components/ProfileEditForm';

export const metadata: Metadata = {
  title: 'Edit Profile — DM Alumni Association',
  description: 'Update your DM Alumni Association profile details.',
};

export default async function EditProfilePage() {
  const user = await requireUser();

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-ocean-50 via-white to-reef-50 dark:from-ocean-950 dark:via-ocean-900 dark:to-reef-950">
      {/* Animated aurora orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 top-1/4 h-[500px] w-[500px] rounded-full bg-ocean-300/25 blur-[120px] animate-aurora dark:bg-ocean-500/15" />
        <div className="absolute -right-20 top-10 h-[400px] w-[400px] rounded-full bg-reef-300/20 blur-[100px] animate-aurora-slow dark:bg-reef-500/15" />
      </div>
      <div className="absolute inset-0 bg-grid opacity-40 dark:opacity-30" />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-2xl flex-col px-5 py-6 sm:px-8">
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
              href="/profile"
              className="inline-flex items-center gap-1.5 rounded-xl border border-ocean-200/60 bg-white/60 px-3.5 py-2 text-xs font-semibold text-ocean-700 backdrop-blur-md transition-all hover:border-ocean-300 hover:text-ocean-900 dark:border-ocean-700/50 dark:bg-ocean-800/40 dark:text-ocean-200 dark:hover:border-ocean-600 dark:hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to profile
            </Link>
          </div>
        </div>

        {/* Edit card */}
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full rounded-3xl border border-ocean-200/50 bg-white/60 p-8 shadow-2xl shadow-ocean-200/20 backdrop-blur-md dark:border-ocean-800/60 dark:bg-gradient-to-br dark:from-ocean-900/80 dark:to-ocean-950/80 dark:shadow-ocean-950/40 dark:backdrop-blur-xl sm:p-10">
            <ProfileEditForm
              docLocked={user.verificationStatus === 'verified'}
              initial={{
                name: user.name,
                email: user.email,
                phone: user.phone,
                studentId: user.studentId,
                batch: user.batch,
                docType: user.docType ?? 'certificate',
                photo: user.photo ?? '',
                doc: user.doc ?? '',
              }}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
