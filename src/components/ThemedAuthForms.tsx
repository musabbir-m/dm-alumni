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

export function ThemedSignUp() {
  const { theme } = useTheme();
  const appearance = theme === 'dark' ? clerkDarkAppearance : clerkLightAppearance;
  return <SignUp appearance={appearance} />;
}
