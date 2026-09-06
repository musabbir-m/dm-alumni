'use client';

import { useCallback, useSyncExternalStore } from 'react';

type Theme = 'light' | 'dark';

const STORAGE_KEY = 'theme';

function readTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch { /* storage unavailable */ }
  // Falls back to whatever the inline script in the root layout applied
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

// Module-level store so every consumer (header, future pages) shares one source of truth
let currentTheme: Theme | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): Theme {
  return currentTheme ?? readTheme();
}

// SSR/hydration snapshot: the real theme is only knowable in the browser, so
// the server and the first client render see null (light-mode toggle) and the
// store syncs right after hydration without a mismatch.
function getServerSnapshot(): Theme | null {
  return null;
}

function applyTheme(theme: Theme) {
  currentTheme = theme;
  document.documentElement.classList.toggle('dark', theme === 'dark');
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch { /* storage unavailable */ }
  listeners.forEach((listener) => listener());
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggle = useCallback(() => {
    applyTheme(getSnapshot() === 'dark' ? 'light' : 'dark');
  }, []);

  return { theme, toggle };
}
