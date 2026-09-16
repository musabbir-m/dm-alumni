import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  Waves, ArrowLeft, Search, ChevronDown, Users, Clock, CheckCircle2, XCircle, ShieldCheck,
} from 'lucide-react';
import { requireStaff } from '@/lib/auth';
import User, { VERIFICATION_STATUSES } from '@/lib/models/User';
import type { Role, VerificationStatus } from '@/lib/models/User';
import { batches, batchName } from '@/data/batches';
import ThemeToggle from '@/components/ThemeToggle';
import AdminUserControls from '@/components/AdminUserControls';
import { StatusBadge, RoleBadge, STATUS_STYLES } from '@/components/UserBadges';
import { inputCls, iconCls } from '@/components/form-ui';

export const metadata: Metadata = {
  title: 'Member Management — DM Alumni Association',
  description: 'Staff dashboard — manage members, roles, and verification.',
};

/** Shared grid template for the list header and every row. */
const ROW_COLS =
  'md:grid-cols-[minmax(0,2.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.35fr)_minmax(0,1.1fr)_minmax(0,auto)]';

/** List cell — stacks with a tiny uppercase label on mobile, plain on md+. */
function Cell({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={`min-w-0 ${className}`}>
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-ocean-400 dark:text-ocean-300/50 md:hidden">
        {label}
      </span>
      {children}
    </div>
  );
}

// $regex needs manual escaping — the search box is free-form user input
const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

type AdminUserView = {
  id: string;
  name: string;
  email: string;
  phone: string;
  studentId: string;
  batch: string;
  role: Role;
  status: VerificationStatus;
  photo: string | null;
  initials: string;
  isSelf: boolean;
  /** Viewer may approve/reject this member (admin: everyone; moderator: own batch). */
  canVerify: boolean;
};

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const viewer = await requireStaff();
  const sp = await searchParams;

  // Admins act on every row; moderators only inside their moderated batch
  const viewerRole = (viewer.role ?? 'alumni') as Role;
  const viewerIsAdmin = viewerRole === 'admin';
  const modBatch = viewerRole === 'moderator' ? viewer.moderatorBatch ?? null : null;

  // Defensive parsing — anything malformed degrades to "no filter"
  const q = typeof sp.q === 'string' ? sp.q.trim() : '';
  const batch =
    typeof sp.batch === 'string' && batches.some((b) => b.year === sp.batch) ? sp.batch : '';
  const status =
    typeof sp.status === 'string' && (VERIFICATION_STATUSES as readonly string[]).includes(sp.status)
      ? (sp.status as VerificationStatus)
      : '';

  const filter: Record<string, unknown> = {};
  if (q) {
    const rx = new RegExp(escapeRegExp(q), 'i');
    filter.$or = [{ name: rx }, { phone: rx }];
  }
  if (batch) filter.batch = batch;
  if (status) filter.verificationStatus = status;

  // Counts ignore the filters — the tiles are a global overview; the list is
  // the filtered working set. Newest first = the review queue's natural order.
  const [users, total, pending, verified, rejected, moderators] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).lean(),
    User.countDocuments({}),
    User.countDocuments({ verificationStatus: 'pending' }),
    User.countDocuments({ verificationStatus: 'verified' }),
    User.countDocuments({ verificationStatus: 'rejected' }),
    User.countDocuments({ role: 'moderator' }),
  ]);

  const rows: AdminUserView[] = users.map((u) => ({
    id: u._id.toString(),
    name: u.name,
    email: u.email,
    phone: u.phone,
    studentId: u.studentId,
    batch: u.batch,
    role: (u.role ?? 'alumni') as Role,
    status: (u.verificationStatus ?? 'pending') as VerificationStatus,
    photo: u.photo ?? null,
    initials: u.name
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join(''),
    isSelf: u._id.equals(viewer._id),
    canVerify: viewerIsAdmin || (!!modBatch && u.batch === modBatch),
  }));

  const hasFilter = !!(q || batch || status);
  const modBatchInfo = modBatch ? batches.find((b) => b.year === modBatch) : undefined;
  const subtitle = viewerIsAdmin
    ? 'Every registered member across all batches — promote moderators and decide verifications.'
    : `Every registered member across all batches — you decide verification for ${
        modBatchInfo ? batchName(modBatchInfo) : `batch ${modBatch}`
      }.`;

  const tiles = [
    { label: 'Members', value: total, icon: Users, chip: 'bg-ocean-100/70 text-ocean-600 dark:bg-ocean-800/60 dark:text-ocean-200' },
    { label: 'Pending review', value: pending, icon: Clock, chip: 'bg-amber-100/80 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300' },
    { label: 'Verified', value: verified, icon: CheckCircle2, chip: 'bg-reef-100/80 text-reef-600 dark:bg-reef-500/10 dark:text-reef-300' },
    { label: 'Rejected', value: rejected, icon: XCircle, chip: 'bg-red-100/80 text-red-500 dark:bg-red-500/10 dark:text-red-300' },
    { label: 'Moderators', value: moderators, icon: ShieldCheck, chip: 'bg-ocean-100/70 text-ocean-600 dark:bg-ocean-800/60 dark:text-ocean-200' },
  ];

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
              href="/profile"
              className="inline-flex items-center gap-1.5 rounded-xl border border-ocean-200/60 bg-white/60 px-3.5 py-2 text-xs font-semibold text-ocean-700 backdrop-blur-md transition-all hover:border-ocean-300 hover:text-ocean-900 dark:border-ocean-700/50 dark:bg-ocean-800/40 dark:text-ocean-200 dark:hover:border-ocean-600 dark:hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to profile
            </Link>
          </div>
        </div>

        {/* Dashboard card */}
        <div className="flex flex-1 flex-col py-8">
          <div className="w-full rounded-3xl border border-ocean-200/50 bg-white/60 p-6 shadow-2xl shadow-ocean-200/20 backdrop-blur-md dark:border-ocean-800/60 dark:bg-gradient-to-br dark:from-ocean-900/80 dark:to-ocean-950/80 dark:shadow-ocean-950/40 dark:backdrop-blur-xl sm:p-8">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h1 className="font-display text-2xl font-bold tracking-tight text-ocean-900 dark:text-white sm:text-3xl">
                  Member management
                </h1>
                <p className="mt-1.5 text-sm text-ocean-600/70 dark:text-ocean-100/70">{subtitle}</p>
              </div>
            </div>

            {/* Summary tiles (global — ignore the filters below) */}
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {tiles.map((t) => (
                <div
                  key={t.label}
                  className="flex items-center gap-3 rounded-xl border border-ocean-100 bg-white/50 px-4 py-3 dark:border-ocean-800/60 dark:bg-ocean-950/40"
                >
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${t.chip}`}>
                    <t.icon className="h-4.5 w-4.5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-lg font-bold leading-tight text-ocean-900 dark:text-white">
                      {t.value}
                    </p>
                    <p className="truncate text-[11px] font-medium uppercase tracking-wide text-ocean-400 dark:text-ocean-300/60">
                      {t.label}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Filter bar — plain GET form, zero client JS */}
            <form
              method="get"
              action="/admin"
              className="mt-6 flex flex-col gap-3 rounded-2xl border border-ocean-100 bg-white/50 p-4 dark:border-ocean-800/60 dark:bg-ocean-950/40 lg:flex-row lg:items-center"
            >
              <div className="group relative flex-1 lg:min-w-[220px]">
                <Search className={iconCls()} />
                <input
                  name="q"
                  type="search"
                  defaultValue={q}
                  placeholder="Search by name or phone"
                  aria-label="Search by name or phone"
                  className={inputCls()}
                />
              </div>
              <div className="group relative lg:w-60">
                <select
                  name="batch"
                  defaultValue={batch}
                  aria-label="Filter by batch"
                  className={`${inputCls()} appearance-none pr-10`}
                >
                  <option value="">All batches</option>
                  {batches.map((b) => (
                    <option key={b.year} value={b.year}>
                      {batchName(b)}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ocean-400 dark:text-ocean-300" />
              </div>
              <div className="group relative lg:w-52">
                <select
                  name="status"
                  defaultValue={status}
                  aria-label="Filter by verification status"
                  className={`${inputCls()} appearance-none pr-10`}
                >
                  <option value="">All statuses</option>
                  {VERIFICATION_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_STYLES[s].label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ocean-400 dark:text-ocean-300" />
              </div>
              <div className="flex items-center gap-3 lg:pl-1">
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-ocean-500 to-reef-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-ocean-300/40 transition-all hover:brightness-110 dark:from-ocean-400 dark:to-reef-500 dark:text-ocean-950 dark:shadow-ocean-950/40"
                >
                  Apply
                </button>
                {hasFilter && (
                  <Link
                    href="/admin"
                    className="text-sm font-semibold text-ocean-500 transition-colors hover:text-ocean-700 dark:text-ocean-300 dark:hover:text-ocean-100"
                  >
                    Reset
                  </Link>
                )}
              </div>
            </form>

            <p className="mt-5 text-xs font-medium text-ocean-400 dark:text-ocean-300/60">
              {hasFilter ? `Showing ${rows.length} of ${total} members` : `${total} members total`}
            </p>

            {/* Member list */}
            {rows.length > 0 ? (
              <div className="mt-3 overflow-hidden rounded-2xl border border-ocean-100 bg-white/50 dark:border-ocean-800/60 dark:bg-ocean-950/40">
                <div
                  className={`hidden border-b border-ocean-100 px-6 py-3 md:grid md:items-center md:gap-4 dark:border-ocean-800/60 ${ROW_COLS}`}
                >
                  {['Member', 'Batch', 'Phone', 'Status', 'Role'].map((h) => (
                    <span
                      key={h}
                      className="text-xs font-medium uppercase tracking-wide text-ocean-400 dark:text-ocean-300/60"
                    >
                      {h}
                    </span>
                  ))}
                  <span className="text-right text-xs font-medium uppercase tracking-wide text-ocean-400 dark:text-ocean-300/60">
                    Actions
                  </span>
                </div>
                <ul className="divide-y divide-ocean-100 dark:divide-ocean-800/60">
                  {rows.map((u) => {
                    const batchInfo = batches.find((b) => b.year === u.batch);
                    return (
                      <li
                        key={u.id}
                        className={`grid grid-cols-1 gap-3 px-6 py-4 md:items-center md:gap-4 ${ROW_COLS}`}
                      >
                        <Cell label="Member">
                          <div className="flex min-w-0 items-center gap-3">
                            {u.photo ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={u.photo}
                                alt={u.name}
                                className="h-10 w-10 shrink-0 rounded-xl object-cover ring-2 ring-ocean-100 dark:ring-ocean-800"
                              />
                            ) : (
                              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ocean-100/70 text-xs font-bold text-ocean-600 dark:bg-ocean-800/60 dark:text-ocean-200">
                                {u.initials}
                              </span>
                            )}
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-ocean-900 dark:text-white">
                                {u.name}
                                {u.isSelf && (
                                  <span className="ml-1.5 text-xs font-medium text-reef-600 dark:text-reef-300">
                                    (you)
                                  </span>
                                )}
                              </p>
                              <p className="truncate text-xs text-ocean-500 dark:text-ocean-300/70">
                                {u.email} · {u.studentId}
                              </p>
                            </div>
                          </div>
                        </Cell>

                        <Cell label="Batch">
                          <span className="text-sm text-ocean-700 dark:text-ocean-200">
                            {batchInfo ? `DSM ${batchInfo.batchNo} (${batchInfo.session})` : u.batch}
                          </span>
                        </Cell>

                        <Cell label="Phone">
                          <span className="text-sm text-ocean-700 dark:text-ocean-200">
                            {u.phone}
                          </span>
                        </Cell>

                        <Cell label="Status">
                          <StatusBadge status={u.status} />
                        </Cell>

                        <Cell label="Role">
                          {u.role === 'alumni' ? (
                            <span className="text-xs text-ocean-400 dark:text-ocean-300/50">
                              Alumni
                            </span>
                          ) : (
                            <RoleBadge role={u.role} />
                          )}
                        </Cell>

                        <Cell label="Actions" className="md:justify-self-end">
                          {u.isSelf || u.role === 'admin' ? (
                            <span className="text-xs text-ocean-400 dark:text-ocean-300/50">
                              {u.isSelf ? 'You' : 'Admin'}
                            </span>
                          ) : !u.canVerify ? (
                            <span className="text-xs text-ocean-400 dark:text-ocean-300/50">
                              Outside your batch
                            </span>
                          ) : (
                            <AdminUserControls
                              userId={u.id}
                              role={u.role}
                              status={u.status}
                              canToggleRole={viewerIsAdmin}
                            />
                          )}
                        </Cell>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : (
              <div className="mt-3 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-ocean-200 px-6 py-12 text-center dark:border-ocean-800">
                <Users className="h-8 w-8 text-ocean-300 dark:text-ocean-600" />
                <p className="text-sm font-medium text-ocean-700 dark:text-ocean-200">
                  No members match these filters.
                </p>
                {hasFilter && (
                  <Link
                    href="/admin"
                    className="text-xs font-semibold text-reef-600 transition-colors hover:text-reef-500 dark:text-reef-300 dark:hover:text-reef-200"
                  >
                    Clear filters
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
