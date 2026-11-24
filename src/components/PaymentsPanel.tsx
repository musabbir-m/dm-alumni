'use client';

import { useState } from 'react';
import { Banknote } from 'lucide-react';
import { batches, batchName } from '@/data/batches';
import { PersonAvatar, WalletBadge } from '@/components/wallet-ui';
import { PaymentStatusBadge } from '@/components/UserBadges';
import type { PaymentStatus } from '@/lib/models/User';
import type { WalletType } from '@/lib/wallet-fields';

/**
 * The staff dashboard's "Payments" tab — who pays their membership dues to
 * whom. Receiver names render as a pill switcher (client state like
 * AdminTabs, not routes — a click swaps the group below with no roundtrip);
 * the selected receiver's members list beneath, pending first so the
 * confirmation queue tops the group, each pill carrying its pending count.
 * Wallet MANAGEMENT stays on the admin-only tabs — this panel is the same
 * read-only lens moderators already get on the Members rows (they confirm
 * dues). All data arrives pre-sorted from the server page as plain props.
 */

/** Receiver display snapshot — the wallet's identity fields, no bookkeeping. */
export type PaymentsReceiver = {
  id: string;
  name: string;
  studentId: string;
  batch: string;
  photo: string;
  walletType: WalletType;
  walletNumber: string;
};

/** One member under a receiver — everything the "who paid whom" list shows. */
export type PaymentsMember = {
  id: string;
  name: string;
  email: string;
  studentId: string;
  batch: string;
  photo: string;
  payment: PaymentStatus;
  /** TrxID the member submitted as payment evidence ('' = none) */
  trxId: string;
};

export type PaymentsGroup = {
  receiver: PaymentsReceiver;
  /** Pending first (the queue), then paid, then unpaid; name breaks ties */
  members: PaymentsMember[];
};

const batchFull = (year: string) => {
  const info = batches.find((b) => b.year === year);
  return info ? batchName(info) : `Batch ${year}`;
};

const batchShort = (year: string) => {
  const info = batches.find((b) => b.year === year);
  return info ? `DSM ${info.batchNo} (${info.session})` : year;
};

const plural = (n: number) => (n === 1 ? 'member' : 'members');

/** Member row — shared by the receiver groups and the unresolved list. */
function MemberRow({ member }: { member: PaymentsMember }) {
  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
      <PersonAvatar
        photo={member.photo}
        name={member.name}
        className="h-9 w-9 rounded-xl text-[11px] ring-2 ring-ocean-100 dark:ring-ocean-800"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ocean-900 dark:text-white">
          {member.name}
        </p>
        <p className="truncate text-xs text-ocean-500 dark:text-ocean-300/70">
          {member.email}
        </p>
        <p className="truncate text-xs text-ocean-400 dark:text-ocean-300/50">
          {member.studentId} · {batchShort(member.batch)}
        </p>
      </div>
      <div className="flex min-w-0 flex-col items-start gap-1 sm:items-end">
        <PaymentStatusBadge status={member.payment} />
        {member.trxId && (
          <p
            className="max-w-[10rem] truncate font-mono text-[10px] font-medium text-ocean-400 dark:text-ocean-300/60"
            title={`Transaction ID ${member.trxId}`}
          >
            TrxID {member.trxId}
          </p>
        )}
      </div>
    </li>
  );
}

/** The selected receiver's card: identity header, status summary, members. */
function ReceiverGroup({ group }: { group: PaymentsGroup }) {
  const { receiver, members } = group;
  const pending = members.filter((m) => m.payment === 'pending').length;
  const paid = members.filter((m) => m.payment === 'paid').length;
  const unpaid = members.filter((m) => m.payment === 'unpaid').length;

  return (
    <section className="overflow-hidden rounded-2xl border border-ocean-100 bg-white/50 dark:border-ocean-800/60 dark:bg-ocean-950/40">
      <div className="flex flex-wrap items-center gap-3 border-b border-ocean-100 px-4 py-3.5 dark:border-ocean-800/60 sm:px-5">
        <PersonAvatar photo={receiver.photo} name={receiver.name} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ocean-900 dark:text-white">
            {receiver.name}
          </p>
          <p
            className="truncate text-xs text-ocean-500 dark:text-ocean-300/70"
            title={`${batchFull(receiver.batch)} · ${receiver.studentId}`}
          >
            {batchFull(receiver.batch)} · {receiver.studentId}
          </p>
        </div>
        <div className="flex min-w-0 flex-col items-start gap-1 sm:items-end">
          <WalletBadge type={receiver.walletType} />
          <a
            href={`tel:${receiver.walletNumber}`}
            className="font-mono text-sm font-semibold text-ocean-900 transition-colors hover:text-reef-600 dark:text-white dark:hover:text-reef-300"
          >
            {receiver.walletNumber}
          </a>
        </div>
      </div>

      <p className="border-b border-ocean-100 px-4 py-2 text-xs dark:border-ocean-800/60 sm:px-5">
        <span className="font-semibold text-ocean-700 dark:text-ocean-100/80">
          {members.length} {plural(members.length)}
        </span>
        {pending > 0 && (
          <span className="ml-2 font-medium text-amber-600 dark:text-amber-300">
            {pending} pending
          </span>
        )}
        {paid > 0 && (
          <span className="ml-2 font-medium text-reef-600 dark:text-reef-300">
            {paid} paid
          </span>
        )}
        {unpaid > 0 && (
          <span className="ml-2 font-medium text-ocean-500 dark:text-ocean-300/70">
            {unpaid} unpaid
          </span>
        )}
      </p>

      {members.length > 0 ? (
        <ul className="divide-y divide-ocean-100 dark:divide-ocean-800/60">
          {members.map((m) => (
            <MemberRow key={m.id} member={m} />
          ))}
        </ul>
      ) : (
        <p className="px-4 py-5 text-center text-xs text-ocean-400 dark:text-ocean-300/60 sm:px-5">
          No members have chosen this receiver yet.
        </p>
      )}
    </section>
  );
}

export default function PaymentsPanel({
  groups,
  unresolved,
  isAdmin,
}: {
  groups: PaymentsGroup[];
  /** Members whose chosen receiver no longer resolves (wallet removed) */
  unresolved: PaymentsMember[];
  isAdmin: boolean;
}) {
  // Client-state selection, AdminTabs-style — a pill click swaps the group
  // below instantly. Falls back to the first receiver when the selection
  // goes stale (its wallet removed between revalidations).
  const [selectedId, setSelectedId] = useState(groups[0]?.receiver.id ?? '');
  const selected = groups.find((g) => g.receiver.id === selectedId) ?? groups[0];

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-ocean-200 px-6 py-12 text-center dark:border-ocean-800">
        <Banknote className="h-8 w-8 text-ocean-300 dark:text-ocean-600" />
        <p className="text-sm font-medium text-ocean-700 dark:text-ocean-200">
          No payment receivers yet.
        </p>
        <p className="max-w-sm text-xs text-ocean-500 dark:text-ocean-300/70">
          {isAdmin
            ? 'Use the Add Payment Wallet tab to choose who receives member payments — members then pick a receiver during registration or from their profile.'
            : 'Once an admin adds payment wallets, members pick a receiver and their dues status will show up here.'}
        </p>
      </div>
    );
  }

  const totalPaying =
    groups.reduce((n, g) => n + g.members.length, 0) + unresolved.length;
  const pendingTotal =
    groups.reduce((n, g) => n + g.members.filter((m) => m.payment === 'pending').length, 0) +
    unresolved.filter((m) => m.payment === 'pending').length;

  return (
    <div>
      <p className="text-sm text-ocean-600/70 dark:text-ocean-100/70">
        Who pays their membership dues to whom — pick a receiver to see the
        members paying them.
      </p>
      <p className="mt-1.5 text-xs font-medium text-ocean-400 dark:text-ocean-300/60">
        {totalPaying} {plural(totalPaying)} chose a receiver
        {pendingTotal > 0 ? ` — ${pendingTotal} awaiting confirmation` : ''}
      </p>

      <div
        role="group"
        aria-label="Payment receiver"
        className="mt-4 flex flex-wrap items-center gap-2 border-b border-ocean-100 pb-4 dark:border-ocean-800/60"
      >
        {groups.map((g) => {
          const active = selected?.receiver.id === g.receiver.id;
          const pending = g.members.filter((m) => m.payment === 'pending').length;
          return (
            <button
              key={g.receiver.id}
              type="button"
              aria-pressed={active}
              onClick={() => setSelectedId(g.receiver.id)}
              title={`${g.receiver.name} · ${batchFull(g.receiver.batch)}`}
              className={`inline-flex max-w-[13rem] items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${
                active
                  ? 'bg-gradient-to-r from-ocean-500 to-reef-500 text-white shadow-lg shadow-ocean-300/40 dark:from-ocean-400 dark:to-reef-500 dark:text-ocean-950 dark:shadow-ocean-950/40'
                  : 'border border-ocean-200/60 bg-white/60 text-ocean-700 hover:border-ocean-300 hover:text-ocean-900 dark:border-ocean-700/50 dark:bg-ocean-800/40 dark:text-ocean-200 dark:hover:border-ocean-600 dark:hover:text-white'
              }`}
            >
              <span className="max-w-[10rem] truncate">{g.receiver.name}</span>
              {pending > 0 && (
                <span
                  title={`${pending} awaiting confirmation`}
                  className="rounded-full bg-amber-100/90 px-1.5 py-0.5 text-[10px] font-bold leading-none text-amber-700 dark:bg-amber-400/20 dark:text-amber-300"
                >
                  {pending}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-5 space-y-4">
        {selected && <ReceiverGroup group={selected} />}

        {unresolved.length > 0 && (
          <section className="rounded-2xl border border-dashed border-amber-300 bg-amber-50/40 dark:border-amber-500/30 dark:bg-amber-500/5">
            <p className="px-4 py-3 text-xs font-semibold text-amber-700 dark:text-amber-300 sm:px-5">
              Chosen receiver no longer exists
            </p>
            <p className="px-4 pb-2 text-xs text-amber-600/80 dark:text-amber-300/70 sm:px-5">
              {unresolved.length} {plural(unresolved.length)} picked a receiver
              that has since been removed — they can pick another from Edit
              profile.
            </p>
            <ul className="divide-y divide-amber-200/60 dark:divide-amber-500/20">
              {unresolved.map((m) => (
                <MemberRow key={m.id} member={m} />
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
