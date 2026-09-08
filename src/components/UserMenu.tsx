'use client';

import Link from 'next/link';
import { useClerk, useUser } from '@clerk/nextjs';
import { LogOut, UserCircle2 } from 'lucide-react';

/**
 * Session-aware header actions. The marketing home page stays statically
 * prerendered — Clerk's useUser() resolves client-side from the session
 * cookie instead of reading auth on the server. While loading (and logged
 * out) it renders the default Join the Network CTA, so anonymous visitors
 * see no layout shift.
 */
export default function UserMenu({
  variant = 'desktop',
  onNavigate,
}: {
  variant?: 'desktop' | 'mobile';
  onNavigate?: () => void;
}) {
  const { isLoaded, isSignedIn, user } = useUser();
  const { signOut } = useClerk();

  // isLoaded is false while the client resolves the session — render the
  // signed-out branch so the header doesn't shift on load.
  const signedIn = isLoaded && isSignedIn && !!user;

  const displayName =
    user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(' ');
  const firstName = user?.firstName ?? displayName?.split(/\s+/)[0];

  const initials = displayName
    ?.split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  if (variant === 'mobile') {
    return signedIn ? (
      <div className="mt-2 flex flex-col gap-1">
        <Link
          href="/profile"
          onClick={onNavigate}
          className="flex items-center gap-2.5 rounded-lg px-4 py-3 text-sm font-medium text-ocean-700 transition-colors hover:bg-ocean-100 hover:text-ocean-900 dark:text-ocean-100/90 dark:hover:bg-white/5 dark:hover:text-white"
        >
          <UserCircle2 className="h-4 w-4" />
          My Profile{firstName ? ` — ${firstName}` : ''}
        </Link>
        <button
          type="button"
          onClick={() => void signOut({ redirectUrl: '/' })}
          className="flex items-center gap-2.5 rounded-lg px-4 py-3 text-left text-sm font-medium text-ocean-700 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-ocean-100/90 dark:hover:bg-red-500/10 dark:hover:text-red-300"
        >
          <LogOut className="h-4 w-4" />
          Log out
        </button>
      </div>
    ) : (
      <div className="mt-2 flex flex-col gap-1">
        <Link
          href="/sign-in"
          onClick={onNavigate}
          className="rounded-lg px-4 py-3 text-sm font-medium text-ocean-700 transition-colors hover:bg-ocean-100 hover:text-ocean-900 dark:text-ocean-100/90 dark:hover:bg-white/5 dark:hover:text-white"
        >
          Login
        </Link>
        <Link
          href="/register"
          onClick={onNavigate}
          className="mt-1 rounded-xl bg-gradient-to-r from-ocean-500 to-reef-500 px-4 py-3 text-center text-sm font-semibold text-white dark:from-ocean-400 dark:to-reef-500 dark:text-ocean-950"
        >
          Join the Network
        </Link>
      </div>
    );
  }

  return signedIn ? (
    <div className="flex items-center gap-2.5">
      <Link
        href="/profile"
        className="group flex items-center gap-2 rounded-xl border border-ocean-200/60 bg-white/60 py-1.5 pl-1.5 pr-3.5 backdrop-blur-md transition-all hover:border-reef-400/60 dark:border-ocean-700/50 dark:bg-ocean-800/40 dark:hover:border-reef-500/40"
        title="My profile"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-ocean-500 to-reef-500 text-[11px] font-bold text-white dark:from-ocean-400 dark:to-reef-500 dark:text-ocean-950">
          {initials || <UserCircle2 className="h-4 w-4" />}
        </span>
        <span className="max-w-[10ch] truncate text-sm font-semibold text-ocean-800 transition-colors group-hover:text-ocean-900 dark:text-ocean-100 dark:group-hover:text-white">
          {firstName ?? 'Profile'}
        </span>
      </Link>
      <button
        type="button"
        onClick={() => void signOut({ redirectUrl: '/' })}
        aria-label="Log out"
        title="Log out"
        className="flex h-9 w-9 items-center justify-center rounded-xl border border-ocean-200/60 bg-white/60 text-ocean-500 backdrop-blur-md transition-all hover:border-red-300 hover:text-red-500 dark:border-ocean-700/50 dark:bg-ocean-800/40 dark:text-ocean-300 dark:hover:border-red-500/40 dark:hover:text-red-300"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  ) : (
    <div className="flex items-center gap-3">
      <Link
        href="/sign-in"
        className="rounded-xl px-3.5 py-2.5 text-sm font-semibold text-ocean-700 transition-colors hover:text-ocean-900 dark:text-ocean-100/80 dark:hover:text-white"
      >
        Login
      </Link>
      <Link
        href="/register"
        className="group relative overflow-hidden rounded-xl bg-gradient-to-r from-ocean-500 to-reef-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-ocean-400/40 transition-all hover:shadow-reef-400/40 hover:brightness-110 dark:from-ocean-400 dark:to-reef-500 dark:text-ocean-950 dark:shadow-ocean-900/40 dark:hover:shadow-reef-500/30"
      >
        <span className="relative z-10">Join the Network</span>
        <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
      </Link>
    </div>
  );
}
