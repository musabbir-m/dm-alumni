import type { Metadata } from 'next';
import Link from 'next/link';
import { Waves, ArrowLeft, UserPlus, ShieldCheck, Users } from 'lucide-react';
import RegisterForm from '@/components/RegisterForm';
import ThemeToggle from '@/components/ThemeToggle';

export const metadata: Metadata = {
  title: 'Register — DM Alumni Association',
  description:
    'Create your DM Alumni Association account — reconnect with your batch, the verified alumni directory, events, and mentorship.',
};

const steps = [
  {
    icon: UserPlus,
    title: 'Create your account',
    desc: 'Fill in your details — it takes less than two minutes.',
  },
  {
    icon: ShieldCheck,
    title: 'Batch verification',
    desc: 'A moderator from your batch confirms you are a genuine graduate.',
  },
  {
    icon: Users,
    title: 'Join the network',
    desc: 'Access the batch directory, events, mentorship, and more.',
  },
];

export default function RegisterPage() {
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

        {/* Card */}
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full overflow-hidden rounded-3xl border border-ocean-200/50 bg-white/60 shadow-2xl shadow-ocean-200/20 backdrop-blur-md dark:border-ocean-800/60 dark:bg-gradient-to-br dark:from-ocean-900/80 dark:to-ocean-950/80 dark:shadow-ocean-950/40 dark:backdrop-blur-xl">
            <div className="grid lg:grid-cols-[2fr_3fr]">
              {/* Left: brand + steps */}
              <div className="relative flex flex-col overflow-hidden bg-gradient-to-br from-ocean-700 via-ocean-600 to-reef-600 p-8 dark:from-ocean-900 dark:via-ocean-800 dark:to-reef-900 sm:p-10 lg:p-12">
                {/* Decorative orbs */}
                <div className="pointer-events-none absolute inset-0 overflow-hidden">
                  <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-reef-300/15 blur-[80px] animate-aurora" />
                  <div className="absolute -left-10 bottom-0 h-40 w-40 rounded-full bg-ocean-300/15 blur-[80px] animate-aurora-slow" />
                </div>
                <div className="absolute inset-0 bg-grid-dark opacity-15" />

                <div className="relative">
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-semibold tracking-wide text-white backdrop-blur-md">
                    Alumni Registration
                  </span>
                  <h1 className="mt-5 font-display text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl text-balance">
                    Join the association.{' '}
                    <span className="bg-gradient-to-r from-reef-200 to-ocean-200 bg-clip-text text-transparent">
                      Claim your place in the network.
                    </span>
                  </h1>
                  <p className="mt-4 text-sm leading-relaxed text-ocean-50/80">
                    One account connects you to every cohort since 2018 — and
                    to the people who shared your classrooms, field drills,
                    and first deployments.
                  </p>
                </div>

                <ul className="relative mt-8 space-y-5">
                  {steps.map((step, i) => (
                    <li key={step.title} className="flex items-start gap-3.5">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20">
                        <step.icon className="h-5 w-5 text-reef-200" strokeWidth={2} />
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-white">
                          <span className="mr-1.5 text-reef-200">{i + 1}.</span>
                          {step.title}
                        </p>
                        <p className="mt-0.5 text-xs leading-relaxed text-ocean-50/70">
                          {step.desc}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Right: form */}
              <div className="relative p-8 dark:border-t dark:border-ocean-800/60 dark:bg-ocean-950/40 sm:p-10 lg:border-l lg:border-t-0 lg:dark:border-l">
                <RegisterForm />
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
