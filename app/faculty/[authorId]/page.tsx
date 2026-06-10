'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import FacultyCard from '@/components/FacultyCard';
import { FacultyProfile } from '@/lib/types';

export default function FacultyProfilePage({
  params,
}: {
  params: Promise<{ authorId: string }>;
}) {
  const [authorId, setAuthorId] = useState('');
  const [profile, setProfile] = useState<FacultyProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    params.then((value) => setAuthorId(value.authorId));
  }, [params]);

  useEffect(() => {
    if (!authorId) return;

    fetch(`/api/faculty/directory?authorId=${encodeURIComponent(authorId)}`)
      .then((response) => response.json())
      .then((data) => {
        const profiles: FacultyProfile[] = data.faculty || [];
        setProfile(profiles[0] || null);
      })
      .finally(() => setIsLoading(false));
  }, [authorId]);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <div className="mb-6">
        <Link
          href="/faculty"
          className="text-xs text-accent-base hover:text-accent-hover"
        >
          Back to faculty directory
        </Link>
      </div>

      {isLoading ? (
        <div className="skeleton h-72" />
      ) : profile ? (
        <div className="space-y-6">
          <FacultyCard faculty={profile} showOutreach={false} />
          <div className="surface-card p-5">
            <h3 className="text-sm font-semibold text-text-primary mb-3">
              ResearchLens fit evidence
            </h3>
            {profile.matchReasons && profile.matchReasons.length > 0 ? (
              <ul className="space-y-2">
                {profile.matchReasons.map((reason) => (
                  <li key={reason} className="text-sm text-text-secondary">
                    {reason}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-text-secondary">
                No detailed match reasons are available yet. Run a faculty
                search for this topic to enrich the profile.
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="surface-card p-8 text-center">
          <p className="text-sm text-text-secondary">
            This faculty profile has not been saved to ResearchLens yet.
          </p>
        </div>
      )}
    </div>
  );
}
