'use client';

import React, { useEffect, useMemo, useState } from 'react';
import FacultyCard from '@/components/FacultyCard';
import { FacultyProfile, FacultyShortlistItem } from '@/lib/types';
import { ownerIdHeaders } from '@/lib/ownerToken';

type SortMode = 'citations' | 'works' | 'name';

const PAGE_SIZE = 20;

export default function FacultyDirectoryPage() {
  const [query, setQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('citations');
  const [faculty, setFaculty] = useState<FacultyProfile[]>([]);
  const [shortlist, setShortlist] = useState<FacultyShortlistItem[]>([]);
  const [configured, setConfigured] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    const controller = new AbortController();

    Promise.all([
      fetch('/api/faculty/directory', { signal: controller.signal }).then((r) =>
        r.json()
      ),
      fetch('/api/faculty/shortlist', {
        signal: controller.signal,
        headers: ownerIdHeaders(),
      }).then((r) => r.json()),
    ])
      .then(([directoryData, shortlistData]) => {
        setFaculty(directoryData.faculty || []);
        setShortlist(shortlistData.items || []);
        setConfigured(directoryData.configured !== false);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setFaculty([]);
          setShortlist([]);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, []);

  const visibleFaculty = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = normalizedQuery
      ? faculty.filter((profile) => {
          const haystack = [
            profile.name,
            profile.institution || '',
            profile.country || '',
            ...profile.topics,
          ]
            .join(' ')
            .toLowerCase();
          return haystack.includes(normalizedQuery);
        })
      : faculty;

    return [...filtered].sort((a, b) => {
      if (sortMode === 'name') return a.name.localeCompare(b.name);
      if (sortMode === 'works') return b.worksCount - a.worksCount;
      return b.citedByCount - a.citedByCount;
    });
  }, [faculty, query, sortMode]);

  // Reset pagination when the filters change, following React's guidance
  // for adjusting state during render instead of in a separate effect.
  const [prevFilters, setPrevFilters] = useState({ query, sortMode });
  if (prevFilters.query !== query || prevFilters.sortMode !== sortMode) {
    setPrevFilters({ query, sortMode });
    setVisibleCount(PAGE_SIZE);
  }

  const pagedFaculty = visibleFaculty.slice(0, visibleCount);
  const hasMore = visibleCount < visibleFaculty.length;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <div className="mb-8">
        <p className="text-xs uppercase tracking-wide text-accent-base font-semibold mb-2">
          Faculty Directory
        </p>
        <h2 className="text-2xl sm:text-3xl font-bold text-text-primary">
          Browse researchers, supervisors, and collaborators
        </h2>
        <p className="text-sm text-text-secondary mt-2 max-w-2xl">
          Profiles are populated from topic searches and OpenAlex metadata, then
          persisted to Supabase.
        </p>
      </div>

      <div className="surface-card p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_220px] gap-4">
          <div>
            <label
              htmlFor="faculty-search"
              className="block text-sm font-medium text-text-secondary mb-2"
            >
              Search by name, institution, country, or topic
            </label>
            <input
              id="faculty-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search faculty directory..."
              className="w-full bg-bg-tertiary border border-border-subtle rounded-xl px-4 py-3 text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent-base/50"
            />
          </div>
          <div>
            <label
              htmlFor="faculty-sort"
              className="block text-sm font-medium text-text-secondary mb-2"
            >
              Sort
            </label>
            <select
              id="faculty-sort"
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value as SortMode)}
              className="w-full bg-bg-tertiary border border-border-subtle rounded-xl px-4 py-3 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-base/50"
            >
              <option value="citations">Citation signal</option>
              <option value="works">Works count</option>
              <option value="name">Name</option>
            </select>
          </div>
        </div>
      </div>

      {!configured && (
        <div className="surface-card p-5 mb-6 border-status-warning/30">
          <p className="text-sm font-semibold text-status-warning">
            Supabase is not configured yet.
          </p>
          <p className="text-xs text-text-secondary mt-1">
            Add Supabase env vars and run migrations to enable persistence.
          </p>
        </div>
      )}

      {shortlist.length > 0 && (
        <section className="mb-8">
          <h3 className="text-sm font-semibold text-text-primary mb-3">
            Saved shortlist
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {shortlist.slice(0, 4).map((item) => (
              <FacultyCard
                key={item.id}
                faculty={item.faculty}
                showOutreach
                reportId={item.reportId}
              />
            ))}
          </div>
        </section>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="skeleton h-52" />
          <div className="skeleton h-52" />
        </div>
      ) : visibleFaculty.length > 0 ? (
        <>
          <p className="text-xs text-text-tertiary mb-3">
            Showing {pagedFaculty.length} of {visibleFaculty.length}{' '}
            {visibleFaculty.length === 1 ? 'profile' : 'profiles'}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pagedFaculty.map((profile) => (
              <FacultyCard
                key={profile.openAlexAuthorId || profile.id}
                faculty={profile}
                showOutreach
              />
            ))}
          </div>
          {hasMore && (
            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
                className="min-h-[44px] rounded-xl border border-border-subtle px-5 text-sm font-medium text-text-secondary hover:border-accent-base/40 hover:bg-accent-base/10 hover:text-text-primary transition-all cursor-pointer"
              >
                Load more
              </button>
            </div>
          )}
        </>
      ) : faculty.length > 0 ? (
        <div className="surface-card p-8 text-center">
          <p className="text-sm text-text-secondary">
            No profiles match &quot;{query}&quot;. Try a different name, institution, or topic.
          </p>
          <button
            type="button"
            onClick={() => setQuery('')}
            className="mt-3 text-sm font-medium text-accent-base hover:text-accent-hover cursor-pointer"
          >
            Clear search
          </button>
        </div>
      ) : (
        <div className="surface-card p-8 text-center">
          <p className="text-sm text-text-secondary">
            No faculty profiles found yet. Run a topic search in Faculty Mode to
            populate the directory.
          </p>
        </div>
      )}
    </div>
  );
}
