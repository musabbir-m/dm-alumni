'use client';

import { useId, useState, type ReactNode } from 'react';

export type AdminTabKey = 'members' | 'payments' | 'elections' | 'wallets' | 'add';

/**
 * Client-side tab switcher for the staff dashboard. The tab panels arrive as
 * server-rendered props (RSC composition — the page renders them, this
 * component only decides which is mounted), so switching tabs costs no server
 * roundtrip and no route change. Members, Payments and Election render for
 * every staff viewer (the Election tab is read-only monitoring — turnout
 * during voting, tallies after close; the management card inside it is
 * admin-gated); the wallet tabs render for admins only. Wallet and election
 * mutations revalidatePath('/admin'), which re-renders the page — panel props
 * refresh while `activeTab` state survives, so the list the admin lands on
 * after an add/edit is always fresh.
 */
export default function AdminTabs({
  isAdmin,
  walletsCount,
  paymentsPending,
  electionTurnout,
  members,
  payments,
  elections,
  wallets,
  addWallet,
}: {
  isAdmin: boolean;
  walletsCount: number;
  /** Members whose dues await confirmation — the Payments tab's badge (hidden at 0) */
  paymentsPending: number;
  /** Live turnout while an election is open — the Election tab's badge (hidden otherwise) */
  electionTurnout?: number;
  members: ReactNode;
  payments: ReactNode;
  elections: ReactNode;
  wallets: ReactNode;
  addWallet: ReactNode;
}) {
  const [activeTab, setActiveTab] = useState<AdminTabKey>('members');
  const id = useId();

  const tabs: { key: AdminTabKey; label: string; count?: number }[] = [
    { key: 'members', label: 'Members' },
    {
      key: 'payments',
      label: 'Payments',
      count: paymentsPending > 0 ? paymentsPending : undefined,
    },
    {
      key: 'elections',
      label: 'Election',
      count:
        electionTurnout !== undefined && electionTurnout > 0 ? electionTurnout : undefined,
    },
    ...(isAdmin
      ? [
          { key: 'wallets' as const, label: 'Payment Wallets', count: walletsCount },
          { key: 'add' as const, label: 'Add Payment Wallet' },
        ]
      : []),
  ];

  return (
    <div className="mt-6">
      <div
        role="tablist"
        aria-label="Dashboard sections"
        className="flex flex-wrap items-center gap-2 border-b border-ocean-100 pb-4 dark:border-ocean-800/60"
      >
        {tabs.map((t) => {
          const active = activeTab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              id={`${id}-tab-${t.key}`}
              aria-selected={active}
              aria-controls={`${id}-panel-${t.key}`}
              onClick={() => setActiveTab(t.key)}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${
                active
                  ? 'bg-gradient-to-r from-ocean-500 to-reef-500 text-white shadow-lg shadow-ocean-300/40 dark:from-ocean-400 dark:to-reef-500 dark:text-ocean-950 dark:shadow-ocean-950/40'
                  : 'border border-ocean-200/60 bg-white/60 text-ocean-700 hover:border-ocean-300 hover:text-ocean-900 dark:border-ocean-700/50 dark:bg-ocean-800/40 dark:text-ocean-200 dark:hover:border-ocean-600 dark:hover:text-white'
              }`}
            >
              {t.label}
              {typeof t.count === 'number' && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${
                    active
                      ? 'bg-white/25 text-white dark:bg-ocean-950/20 dark:text-ocean-950'
                      : 'bg-ocean-100 text-ocean-600 dark:bg-ocean-800 dark:text-ocean-300'
                  }`}
                >
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id={`${id}-panel-${activeTab}`} aria-labelledby={`${id}-tab-${activeTab}`} className="pt-6">
        {activeTab === 'members' && members}
        {activeTab === 'payments' && payments}
        {activeTab === 'elections' && elections}
        {activeTab === 'wallets' && wallets}
        {activeTab === 'add' && addWallet}
      </div>
    </div>
  );
}
