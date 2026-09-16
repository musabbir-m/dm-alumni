'use client';

import { useState } from 'react';
import { Search, Briefcase, Mail, Phone, X } from 'lucide-react';
import { LinkedinIcon } from '@/components/BrandIcons';
import { inputCls, iconCls } from '@/components/form-ui';
import type { DirectoryMember } from '@/lib/directory';

/**
 * Search box + alumni card grid for one batch (/alumni/[year]). The batch
 * banner and the "no verified members yet" empty state live on the page —
 * this component only owns client-side name filtering of the member list.
 */
export default function AlumniDirectory({ members }: { members: DirectoryMember[] }) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const visible = q ? members.filter((m) => m.name.toLowerCase().includes(q)) : members;

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="group relative w-full sm:max-w-sm">
          <Search className={iconCls()} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search members by name"
            placeholder="Search by name"
            className={inputCls()}
          />
        </div>
        {q && (
          <p className="text-xs font-medium text-ocean-500 dark:text-ocean-300/70">
            Showing {visible.length} of {members.length}{' '}
            {members.length === 1 ? 'member' : 'members'}
          </p>
        )}
      </div>

      {visible.length === 0 ? (
        <div className="mt-8 flex flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-ocean-200 px-6 py-14 text-center dark:border-ocean-800">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-ocean-100/70 text-ocean-500 dark:bg-ocean-800/60 dark:text-ocean-300">
            <Search className="h-6 w-6" />
          </span>
          <p className="text-sm font-medium text-ocean-700 dark:text-ocean-200">
            No members match &ldquo;{query.trim()}&rdquo;
          </p>
          <button
            type="button"
            onClick={() => setQuery('')}
            className="inline-flex items-center gap-1.5 rounded-xl border border-ocean-200 bg-white/60 px-3.5 py-2 text-xs font-semibold text-ocean-700 transition-all hover:border-ocean-300 hover:text-ocean-900 dark:border-ocean-700/50 dark:bg-ocean-800/40 dark:text-ocean-200 dark:hover:border-ocean-600 dark:hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
            Clear search
          </button>
        </div>
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((member) => (
            <article
              key={member.id}
              className="group relative overflow-hidden rounded-3xl border border-ocean-200/60 bg-white p-6 shadow-lg shadow-ocean-200/20 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-reef-200/30 dark:border-ocean-800/60 dark:bg-ocean-950/60 dark:shadow-ocean-950/30 dark:hover:shadow-ocean-950/50"
            >
              {/* Top accent on hover — family resemblance with the Batches cards */}
              <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-ocean-500 to-reef-500 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

              <div className="flex items-start justify-between gap-3">
                {member.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={member.photo}
                    alt={member.name}
                    className="h-16 w-16 shrink-0 rounded-2xl object-cover ring-2 ring-ocean-100 dark:ring-ocean-800"
                  />
                ) : (
                  <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-ocean-100/70 text-lg font-bold text-ocean-600 dark:bg-ocean-800/60 dark:text-ocean-200">
                    {member.initials}
                  </span>
                )}
                {member.linkedinUrl && (
                  <a
                    href={member.linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${member.name} on LinkedIn`}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-ocean-200 text-ocean-500 transition-all hover:border-reef-400/60 hover:text-reef-500 dark:border-ocean-800 dark:text-ocean-300 dark:hover:border-reef-400/50 dark:hover:text-reef-300"
                  >
                    <LinkedinIcon className="h-4 w-4" />
                  </a>
                )}
              </div>

              <h3 className="mt-4 font-display text-lg font-semibold tracking-tight text-ocean-900 dark:text-white">
                {member.name}
                {member.isSelf && (
                  <span className="ml-2 align-middle text-xs font-semibold text-reef-600 dark:text-reef-300">
                    (you)
                  </span>
                )}
              </h3>

              {member.profession && (
                <p className="mt-1 flex items-center gap-1.5 text-sm text-reef-600 dark:text-reef-300">
                  <Briefcase className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{member.profession}</span>
                </p>
              )}

              <div className="mt-4 space-y-2 border-t border-ocean-100 pt-4 dark:border-ocean-800/60">
                <a
                  href={`mailto:${member.email}`}
                  className="flex items-center gap-2 text-sm text-ocean-600 transition-colors hover:text-ocean-900 dark:text-ocean-200/70 dark:hover:text-white"
                >
                  <Mail className="h-3.5 w-3.5 shrink-0 text-ocean-400 dark:text-ocean-300/50" />
                  <span className="truncate">{member.email}</span>
                </a>
                <a
                  href={`tel:${member.phone.replace(/[\s()-]/g, '')}`}
                  className="flex items-center gap-2 text-sm text-ocean-600 transition-colors hover:text-ocean-900 dark:text-ocean-200/70 dark:hover:text-white"
                >
                  <Phone className="h-3.5 w-3.5 shrink-0 text-ocean-400 dark:text-ocean-300/50" />
                  <span className="truncate">{member.phone}</span>
                </a>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
