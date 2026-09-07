import type { ReactNode } from 'react';

/**
 * Per-file upload cap shared by the client forms. Must match MAX_FILE_MB in
 * src/lib/uploads.ts (the server-side source of truth).
 */
export const MAX_FILE_MB = 5;

/** Shared text-input styling for the auth forms (register, login, …). */
export const inputCls = (hasError?: boolean) =>
  `w-full rounded-xl border py-3 pl-10 pr-4 text-sm text-ocean-900 placeholder-ocean-300 transition-all focus:outline-none focus:ring-2 focus:bg-white dark:bg-ocean-950/60 dark:text-white dark:placeholder-ocean-300/40 dark:focus:bg-ocean-950 ${
    hasError
      ? 'border-red-400 focus:border-red-400 focus:ring-red-400/20 dark:border-red-500/60 dark:focus:border-red-500/60 dark:focus:ring-red-500/20'
      : 'border-ocean-200 bg-white/60 focus:border-reef-500 focus:ring-reef-400/20 dark:border-ocean-800/80 dark:focus:border-reef-500/60 dark:focus:ring-reef-500/20'
  }`;

/** Left-inside icon for inputs wrapped in `group relative`. */
export const iconCls = (hasError?: boolean) =>
  `absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 transition-colors group-focus-within:text-reef-500 ${
    hasError
      ? 'text-red-400 dark:text-red-400'
      : 'text-ocean-400 dark:text-ocean-300 dark:group-focus-within:text-reef-300'
  }`;

export function Field({
  id,
  label,
  optional,
  error,
  children,
}: {
  id: string;
  label: string;
  optional?: boolean;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ocean-700 dark:text-ocean-100/80">
        {label}
        {optional && (
          <span className="ml-1.5 text-xs font-normal text-ocean-400 dark:text-ocean-300/50">
            (optional)
          </span>
        )}
      </label>
      {children}
      {error && (
        <p className="mt-1.5 text-xs font-medium text-red-500 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
