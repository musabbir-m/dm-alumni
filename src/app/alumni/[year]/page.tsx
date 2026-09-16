import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Waves, ArrowLeft, Users } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { batches, batchName } from '@/data/batches';
import { getVerifiedBatchAlumni } from '@/lib/directory';
import ThemeToggle from '@/components/ThemeToggle';
import AlumniDirectory from '@/components/AlumniDirectory';

/**
 * Batch directory — verified members of one batch, reachable by clicking a
 * batch card on the homepage. Any signed-in member may browse; only
 * verified members appear as cards (pending/rejected stay hidden).
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ year: string }>;
}): Promise<Metadata> {
  const { year } = await params;
  const batch = batches.find((b) => b.year === year);
  return {
    title: batch
      ? `${batchName(batch)} — DM Alumni Association`
      : 'Batch directory — DM Alumni Association',
    description: batch
      ? `Verified DSM ${batch.batchNo} Batch (Session ${batch.session}) alumni — names, professions, and contact details.`
      : 'Browse verified DM alumni by batch.',
  };
}

export default async function BatchAlumniPage({
  params,
}: {
  params: Promise<{ year: string }>;
}) {
  const viewer = await requireUser();
  const { year } = await params;
  const batch = batches.find((b) => b.year === year);
  if (!batch) notFound();

  const members = await getVerifiedBatchAlumni(year, viewer._id.toString());

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-ocean-50 via-white to-reef-50 dark:from-ocean-950 dark:via-ocean-900 dark:to-reef-950">
      {/* Animated aurora orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 top-1/4 h-[500px] w-[500px] rounded-full bg-ocean-300/25 blur-[120px] animate-aurora dark:bg-ocean-500/15" />
        <div className="absolute -right-20 top-10 h-[400px] w-[400px] rounded-full bg-reef-300/20 blur-[100px] animate-aurora-slow dark:bg-reef-500/15" />
      </div>
      <div className="absolute inset-0 bg-grid opacity-40 dark:opacity-30" />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col px-5 py-6 sm:px-8">
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

        {/* Batch banner */}
        <div className="mt-8 overflow-hidden rounded-3xl border border-ocean-200/50 shadow-2xl shadow-ocean-200/20 dark:border-ocean-800/60 dark:shadow-ocean-950/40">
          <div className="relative aspect-[16/8] sm:aspect-[21/7]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={batch.image}
              alt={`DSM ${batch.batchNo} Batch`}
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-ocean-950/90 via-ocean-950/60 to-ocean-950/20" />
            <div className="absolute inset-0 flex flex-col justify-end p-5 sm:p-8">
              <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-reef-500/90 px-3 py-1 text-xs font-semibold text-white backdrop-blur-md">
                <Users className="h-3.5 w-3.5" />
                {members.length} verified {members.length === 1 ? 'member' : 'members'}
              </span>
              <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                {batch.batchNo} Batch
                <span className="ml-3 align-middle text-base font-semibold text-reef-300 sm:text-lg">
                  Session {batch.session}
                </span>
              </h1>
              <p className="mt-1 text-sm italic text-ocean-200/90">&ldquo;{batch.motto}&rdquo;</p>
            </div>
          </div>
        </div>

        {/* Directory */}
        <section className="mt-10 flex-1 pb-16">
          {members.length > 0 ? (
            <AlumniDirectory members={members} />
          ) : (
            <div className="flex flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-ocean-200 px-6 py-16 text-center dark:border-ocean-800">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-ocean-100/70 text-ocean-500 dark:bg-ocean-800/60 dark:text-ocean-300">
                <Users className="h-7 w-7" />
              </span>
              <p className="font-display text-lg font-semibold text-ocean-900 dark:text-white">
                No verified members yet
              </p>
              <p className="max-w-sm text-sm text-ocean-500 dark:text-ocean-300/70">
                As soon as a moderator verifies the members of this batch,
                their cards appear here.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
