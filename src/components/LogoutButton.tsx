'use client';

import { LogOut, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { signOut } from 'next-auth/react';

export default function LogoutButton({
  className = '',
  label = 'Log out',
}: {
  className?: string;
  label?: string;
}) {
  const [loading, setLoading] = useState(false);

  return (
    <button
      type="button"
      disabled={loading}
      onClick={() => {
        setLoading(true);
        void signOut({ callbackUrl: '/' });
      }}
      className={
        className ||
        'inline-flex items-center gap-1.5 rounded-xl border border-ocean-200/60 bg-white/60 px-3.5 py-2 text-xs font-semibold text-ocean-700 backdrop-blur-md transition-all hover:border-red-300 hover:text-red-600 dark:border-ocean-700/50 dark:bg-ocean-800/40 dark:text-ocean-200 dark:hover:border-red-500/40 dark:hover:text-red-300'
      }
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
      {label}
    </button>
  );
}
