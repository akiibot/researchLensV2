'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { FacultyProfile } from '@/lib/types';

interface FacultyCardProps {
  faculty: FacultyProfile;
  showOutreach?: boolean;
  reportId?: string | null;
}

export default function FacultyCard({
  faculty,
  showOutreach = true,
  reportId = null,
}: FacultyCardProps) {
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  const copyDraft = async () => {
    if (!faculty.outreachDraft) return;
    await navigator.clipboard.writeText(faculty.outreachDraft);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const saveToShortlist = async () => {
    const response = await fetch('/api/faculty/shortlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        openAlexAuthorId: faculty.openAlexAuthorId,
        reportId,
      }),
    });

    if (response.ok) {
      setSaved(true);
    }
  };

  return (
    <article className="surface-card surface-card-hover p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h4 className="text-sm font-semibold text-text-primary">
            {faculty.name}
          </h4>
          <p className="text-xs text-text-secondary mt-1">
            {faculty.institution || 'Institution unavailable'}
            {faculty.country ? `, ${faculty.country}` : ''}
          </p>
        </div>
        {faculty.relevanceScore !== undefined && (
          <span className="text-xs font-mono px-2 py-1 rounded-md bg-accent-base/10 text-accent-text border border-accent-base/20">
            {Math.round(faculty.relevanceScore)} fit
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 mt-4">
        <div className="bg-bg-secondary rounded-lg p-2 border border-border-subtle">
          <p className="text-[10px] uppercase text-text-tertiary">Works</p>
          <p className="text-sm font-semibold text-text-primary">
            {faculty.worksCount.toLocaleString()}
          </p>
        </div>
        <div className="bg-bg-secondary rounded-lg p-2 border border-border-subtle">
          <p className="text-[10px] uppercase text-text-tertiary">Citations</p>
          <p className="text-sm font-semibold text-text-primary">
            {faculty.citedByCount.toLocaleString()}
          </p>
        </div>
        <div className="bg-bg-secondary rounded-lg p-2 border border-border-subtle">
          <p className="text-[10px] uppercase text-text-tertiary">H-index</p>
          <p className="text-sm font-semibold text-text-primary">
            {faculty.hIndex ?? 'N/A'}
          </p>
        </div>
      </div>

      {faculty.topics.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-4">
          {faculty.topics.slice(0, 6).map((topic) => (
            <span
              key={topic}
              className="text-xs px-2 py-1 rounded-md bg-bg-secondary text-text-secondary border border-border-subtle"
            >
              {topic}
            </span>
          ))}
        </div>
      )}

      {faculty.fitSummary && (
        <p className="text-xs text-text-secondary leading-relaxed mt-4">
          {faculty.fitSummary}
        </p>
      )}

      {faculty.matchReasons && faculty.matchReasons.length > 0 && (
        <div className="mt-4 pt-3 border-t border-border-subtle">
          <p className="text-xs font-medium text-text-primary mb-1">
            Why this match
          </p>
          <ul className="space-y-1">
            {faculty.matchReasons.slice(0, 4).map((reason) => (
              <li key={reason} className="text-xs text-text-secondary">
                {reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {faculty.evidencePapers && faculty.evidencePapers.length > 0 && (
        <div className="mt-4 pt-3 border-t border-border-subtle">
          <p className="text-xs font-medium text-text-primary mb-1">
            Evidence signals
          </p>
          <ul className="space-y-1">
            {faculty.evidencePapers.slice(0, 3).map((paper) => (
              <li key={paper} className="text-xs text-text-secondary">
                {paper}
              </li>
            ))}
          </ul>
        </div>
      )}

      {showOutreach && faculty.outreachDraft && (
        <div className="mt-4 bg-bg-secondary rounded-lg p-3 border border-border-subtle">
          <div className="flex items-center justify-between gap-3 mb-2">
            <p className="text-xs font-medium text-text-primary">
              Outreach draft
            </p>
            <button
              onClick={copyDraft}
              className="text-xs text-accent-base hover:text-accent-hover min-h-[44px] cursor-pointer"
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <p className="text-xs text-text-secondary leading-relaxed whitespace-pre-line">
            {faculty.outreachDraft}
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-3 mt-4">
        <button
          type="button"
          onClick={saveToShortlist}
          className="text-xs font-medium text-accent-base hover:text-accent-hover min-h-[44px] inline-flex items-center cursor-pointer"
        >
          {saved ? 'Saved to shortlist' : 'Save to shortlist'}
        </button>
        <Link
          href={`/faculty/${encodeURIComponent(faculty.openAlexAuthorId)}`}
          className="text-xs font-medium text-accent-base hover:text-accent-hover min-h-[44px] inline-flex items-center"
        >
          ResearchLens profile
        </Link>
        {faculty.profileUrl && (
          <a
            href={faculty.profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-accent-base hover:text-accent-hover min-h-[44px] inline-flex items-center"
          >
            Open profile
          </a>
        )}
        {faculty.orcid && (
          <a
            href={faculty.orcid}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-accent-base hover:text-accent-hover min-h-[44px] inline-flex items-center"
          >
            ORCID
          </a>
        )}
      </div>
    </article>
  );
}
