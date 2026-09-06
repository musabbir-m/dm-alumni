'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Mail, Lock, Loader2, ArrowRight } from 'lucide-react';
import { Field, iconCls, inputCls } from '@/components/form-ui';

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const next: { email?: string; password?: string } = {};
    if (!email.trim()) next.email = 'Email is required';
    if (!password) next.password = 'Password is required';
    setErrors(next);
    setFormError('');
    if (next.email || next.password) return;

    setLoading(true);
    try {
      const result = await signIn('credentials', {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
      });
      if (!result || result.error) {
        setFormError('Invalid email or password. Please try again.');
        return;
      }
      // Session cookie is now set; carry the fresh session into the new route
      router.push('/profile');
      router.refresh();
    } catch {
      setFormError('Something went wrong while signing in. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <div>
        <h2 className="font-display text-2xl font-bold tracking-tight text-ocean-900 dark:text-white">
          Welcome back
        </h2>
        <p className="mt-1.5 text-sm text-ocean-600/70 dark:text-ocean-100/70">
          Sign in to access your profile and the alumni directory.
        </p>
      </div>

      <Field id="email" label="Email" error={errors.email}>
        <div className="group relative">
          <Mail className={iconCls(!!errors.email)} />
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            aria-invalid={!!errors.email}
            className={inputCls(!!errors.email)}
          />
        </div>
      </Field>

      <Field id="password" label="Password" error={errors.password}>
        <div className="group relative">
          <Lock className={iconCls(!!errors.password)} />
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Your password"
            aria-invalid={!!errors.password}
            className={inputCls(!!errors.password)}
          />
        </div>
      </Field>

      {formError && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300" role="alert">
          {formError}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="group relative inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-ocean-500 to-reef-500 px-6 py-3.5 text-sm font-semibold text-white shadow-xl shadow-ocean-300/40 transition-all hover:brightness-110 disabled:opacity-70 dark:from-ocean-400 dark:to-reef-500 dark:text-ocean-950 dark:shadow-ocean-950/40"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Signing you in…
          </>
        ) : (
          <>
            <span className="relative z-10">Sign in</span>
            <ArrowRight className="relative z-10 h-4 w-4 transition-transform group-hover:translate-x-1" />
            <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
          </>
        )}
      </button>

      <p className="text-center text-sm text-ocean-500 dark:text-ocean-300/70">
        New to the association?{' '}
        <Link
          href="/register"
          className="font-semibold text-reef-600 transition-colors hover:text-reef-500 dark:text-reef-300 dark:hover:text-reef-200"
        >
          Create an account
        </Link>
      </p>
    </form>
  );
}
