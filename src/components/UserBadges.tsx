import { Clock, CheckCircle2, XCircle, ShieldCheck } from 'lucide-react';
import type { Role, VerificationStatus } from '@/lib/models/User';

/**
 * Shared badge maps + pills for verification status and role. Server-safe
 * (no 'use client') — lucide icons render in both trees. The profile page's
 * gradient-header role pill stays inline there; this RoleBadge is the
 * card-background variant used in lists.
 */

export const STATUS_STYLES: Record<
  VerificationStatus,
  { icon: typeof Clock; label: string; cls: string }
> = {
  verified: {
    icon: CheckCircle2,
    label: 'Verified',
    cls: 'bg-reef-50 text-reef-700 ring-reef-300 dark:bg-reef-500/10 dark:text-reef-300 dark:ring-reef-500/30',
  },
  pending: {
    icon: Clock,
    label: 'Pending verification',
    cls: 'bg-amber-50 text-amber-700 ring-amber-300 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30',
  },
  rejected: {
    icon: XCircle,
    label: 'Verification rejected',
    cls: 'bg-red-50 text-red-700 ring-red-300 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/30',
  },
};

export const ROLE_LABELS: Record<Role, string> = {
  alumni: 'Alumni',
  moderator: 'Batch Moderator',
  admin: 'Admin',
};

export function StatusBadge({ status }: { status: VerificationStatus }) {
  const { icon: Icon, label, cls } = STATUS_STYLES[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 ${cls}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

/** Card-background role pill — renders nothing for plain alumni. */
export function RoleBadge({ role }: { role: Role }) {
  if (role === 'alumni') return null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-ocean-100/70 px-3 py-1 text-xs font-semibold text-ocean-700 ring-1 ring-ocean-300/60 dark:bg-ocean-800/60 dark:text-ocean-200 dark:ring-ocean-600/50">
      <ShieldCheck className="h-3.5 w-3.5" />
      {ROLE_LABELS[role]}
    </span>
  );
}
