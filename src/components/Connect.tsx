'use client';

import { useState, type FormEvent } from 'react';
import { Mail, User, GraduationCap, Send, CheckCircle2, Loader2, ChevronDown } from 'lucide-react';
import { batches, batchName } from '@/data/batches';

type Status = 'idle' | 'loading' | 'success';

export default function Connect() {
  const [status, setStatus] = useState<Status>('idle');
  const [form, setForm] = useState({
    name: '',
    email: '',
    batch: '',
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setTimeout(() => setStatus('success'), 1200);
  };

  const reset = () => {
    setForm({ name: '', email: '', batch: '' });
    setStatus('idle');
  };

  return (
    <section id="connect" className="relative overflow-hidden bg-gradient-to-b from-white via-ocean-50/30 to-ocean-50/40 py-24 dark:from-ocean-900 dark:via-ocean-950 dark:to-ocean-950 sm:py-32">
      <div className="absolute inset-0 bg-dots opacity-30 dark:hidden" />
      <div className="absolute -right-20 top-10 hidden h-96 w-96 rounded-full bg-ocean-100/40 blur-[100px] animate-pulse-slow dark:block dark:bg-reef-600/10" />
      <div className="absolute -left-20 bottom-10 hidden h-96 w-96 rounded-full bg-reef-100/30 blur-[100px] animate-pulse-slow dark:block dark:bg-sand-500/10" style={{ animationDelay: '2s' }} />

      <div className="relative mx-auto max-w-6xl px-5 sm:px-8">
        <div className="overflow-hidden rounded-3xl border border-ocean-200/50 bg-white/60 shadow-2xl shadow-ocean-200/20 backdrop-blur-md reveal dark:border-ocean-800/60 dark:bg-gradient-to-br dark:from-ocean-900/80 dark:to-ocean-950/80 dark:shadow-ocean-950/40 dark:backdrop-blur-xl">
          <div className="grid lg:grid-cols-2">
            {/* Left: invitation */}
            <div className="relative flex flex-col justify-between overflow-hidden bg-gradient-to-br from-ocean-700 via-ocean-600 to-reef-600 p-8 dark:from-ocean-900 dark:via-ocean-800 dark:to-reef-900 sm:p-12">
              {/* Decorative orbs */}
              <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-reef-300/15 blur-[80px] animate-aurora" />
                <div className="absolute -left-10 bottom-0 h-40 w-40 rounded-full bg-ocean-300/15 blur-[80px] animate-aurora-slow" />
              </div>
              <div className="absolute inset-0 bg-grid-dark opacity-15" />

              <div className="relative">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-semibold tracking-wide text-white backdrop-blur-md">
                  Join the Network
                </span>
                <h2 className="mt-5 font-display text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl text-balance">
                  Reconnect with your cohort.{' '}
                  <span className="bg-gradient-to-r from-reef-200 to-ocean-200 bg-clip-text text-transparent">
                    Build the next wave of resilience.
                  </span>
                </h2>
                <p className="mt-4 text-base leading-relaxed text-ocean-50/80">
                  Whether you graduated in the first batch or the latest, the
                  Alumni Association is your home base. Sign up to access mentorship
                  opportunities, job boards, events, and a community that understands
                  the work you do.
                </p>
              </div>

              <ul className="relative mt-8 space-y-3">
                {[
                  'Mentorship matching across cohorts',
                  'Exclusive job and fellowship board',
                  'Quarterly newsletter with field updates',
                  'Voting rights at the annual general meeting',
                ].map((perk, i) => (
                  <li
                    key={perk}
                    className="flex items-center gap-3 text-sm text-white/90 animate-fade-up"
                    style={{ animationDelay: `${0.3 + i * 0.1}s`, animationFillMode: 'both' }}
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-reef-300/20 ring-1 ring-reef-300/40">
                      <CheckCircle2 className="h-3.5 w-3.5 text-reef-200" strokeWidth={2.5} />
                    </span>
                    {perk}
                  </li>
                ))}
              </ul>
            </div>

            {/* Right: form */}
            <div className="relative p-8 dark:border-t dark:border-ocean-800/60 dark:bg-ocean-950/40 sm:p-12 lg:border-l lg:border-t-0 lg:dark:border-l">
              {status === 'success' ? (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <span className="flex h-16 w-16 items-center justify-center rounded-full bg-reef-50 ring-1 ring-reef-300 animate-fade-up dark:bg-reef-500/20 dark:ring-reef-500/30">
                    <CheckCircle2 className="h-8 w-8 text-reef-600 dark:text-reef-300" strokeWidth={2} />
                  </span>
                  <h3 className="mt-5 font-display text-2xl font-bold text-ocean-900 animate-fade-up dark:text-white" style={{ animationDelay: '0.1s', animationFillMode: 'both' }}>
                    Welcome aboard!
                  </h3>
                  <p className="mt-2 max-w-xs text-sm text-ocean-600/70 animate-fade-up dark:text-ocean-100/70" style={{ animationDelay: '0.2s', animationFillMode: 'both' }}>
                    Your registration has been received. Check your inbox for a
                    confirmation and next steps.
                  </p>
                  <button
                    onClick={reset}
                    className="mt-6 text-sm font-semibold text-reef-600 transition-colors hover:text-reef-500 dark:text-reef-300 dark:hover:text-reef-200"
                  >
                    Register another member
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-ocean-700 dark:text-ocean-100/80">
                      Full Name
                    </label>
                    <div className="group relative">
                      <User className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ocean-400 transition-colors group-focus-within:text-reef-500 dark:text-ocean-300 dark:group-focus-within:text-reef-300" />
                      <input
                        id="name"
                        type="text"
                        required
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        placeholder="Jordan Rivera"
                        className="w-full rounded-xl border border-ocean-200 bg-white/60 py-3 pl-10 pr-4 text-sm text-ocean-900 placeholder-ocean-300 transition-all focus:border-reef-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-reef-400/20 dark:border-ocean-800/80 dark:bg-ocean-950/60 dark:text-white dark:placeholder-ocean-300/40 dark:focus:border-reef-500/60 dark:focus:bg-ocean-950 dark:focus:ring-reef-500/20"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-ocean-700 dark:text-ocean-100/80">
                      Email Address
                    </label>
                    <div className="group relative">
                      <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ocean-400 transition-colors group-focus-within:text-reef-500 dark:text-ocean-300 dark:group-focus-within:text-reef-300" />
                      <input
                        id="email"
                        type="email"
                        required
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        placeholder="jordan.rivera@email.com"
                        className="w-full rounded-xl border border-ocean-200 bg-white/60 py-3 pl-10 pr-4 text-sm text-ocean-900 placeholder-ocean-300 transition-all focus:border-reef-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-reef-400/20 dark:border-ocean-800/80 dark:bg-ocean-950/60 dark:text-white dark:placeholder-ocean-300/40 dark:focus:border-reef-500/60 dark:focus:bg-ocean-950 dark:focus:ring-reef-500/20"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="batch" className="mb-1.5 block text-sm font-medium text-ocean-700 dark:text-ocean-100/80">
                      Graduating Batch
                    </label>
                    <div className="group relative">
                      <GraduationCap className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ocean-400 transition-colors group-focus-within:text-reef-500 dark:text-ocean-300 dark:group-focus-within:text-reef-300" />
                      <select
                        id="batch"
                        required
                        value={form.batch}
                        onChange={(e) => setForm({ ...form, batch: e.target.value })}
                        className="w-full appearance-none rounded-xl border border-ocean-200 bg-white/60 py-3 pl-10 pr-10 text-sm text-ocean-900 transition-all focus:border-reef-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-reef-400/20 dark:border-ocean-800/80 dark:bg-ocean-950/60 dark:text-white dark:focus:border-reef-500/60 dark:focus:bg-ocean-950 dark:focus:ring-reef-500/20"
                      >
                        <option value="" disabled>
                          Select your cohort
                        </option>
                        {batches.map((b) => (
                          <option key={b.year} value={b.year}>
                            {batchName(b)}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ocean-400 pointer-events-none" />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={status === 'loading'}
                    className="group relative inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-ocean-500 to-reef-500 px-6 py-3.5 text-sm font-semibold text-white shadow-xl shadow-ocean-300/40 transition-all hover:brightness-110 disabled:opacity-70 dark:from-ocean-400 dark:to-reef-500 dark:text-ocean-950 dark:shadow-ocean-950/40"
                  >
                    {status === 'loading' ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <span className="relative z-10">Submit Registration</span>
                        <Send className="relative z-10 h-4 w-4 transition-transform group-hover:translate-x-1" />
                        <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                      </>
                    )}
                  </button>
                  <p className="text-center text-xs text-ocean-400 dark:text-ocean-300/40">
                    By registering, you agree to the association&apos;s code of conduct.
                  </p>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
