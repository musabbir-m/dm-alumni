'use client';

import { SignIn, SignUp } from '@clerk/nextjs';
import { useTheme } from '@/hooks/useTheme';
import { clerkDarkAppearance, clerkLightAppearance } from '@/lib/clerk-appearance';

/**
 * Clerk's prebuilt components follow the OS prefers-color-scheme by default,
 * but this app uses class-based dark mode with a manual toggle. These
 * wrappers pick the matching appearance from the same theme store the
 * ThemeToggle uses. `theme` is null on the server/first paint (renders light)
 * and syncs right after hydration — the same tradeoff the header toggle
 * accepts.
 */

export function ThemedSignIn() {
  const { theme } = useTheme();
  const appearance = theme === 'dark' ? clerkDarkAppearance : clerkLightAppearance;
  return <SignIn appearance={appearance} />;
}

// `routing="hash"` is required when the card is embedded outside the dedicated
// /sign-up catch-all (e.g. the homepage Connect card). Clerk's default path
// routing assumes the component owns /sign-up; mounted elsewhere it throws a
// configuration error and mis-navigates — the footer "Sign in" link lands back
// on /sign-up with redirect_url=/sign-in. Hash routing keeps the multi-step
// flow (email-code entry etc.) on the URL hash and makes that link a real
// navigation to the configured sign-in URL.
export function ThemedSignUp({ routing = 'path' }: { routing?: 'path' | 'hash' } = {}) {
  const { theme } = useTheme();
  const appearance = theme === 'dark' ? clerkDarkAppearance : clerkLightAppearance;
  if (routing === 'hash') {
    return <SignUp appearance={appearance} routing="hash" />;
  }
  return <SignUp appearance={appearance} />;
}
