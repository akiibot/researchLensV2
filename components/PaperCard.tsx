/**
 * @file PaperCard Component
 *
 * Displays a single academic paper result with:
 * - Title (bold), Authors (truncated), Year, Venue
 * - Similarity label with color
 * - Abstract preview (expandable)
 * - DOI link: "Open Paper"
 * - Source badge
 *
 * @component
 */

'use client';

import React, { useState } from 'react';
import { Paper } from '@/lib/types';

interface PaperCardProps {
  paper: Paper;
  rank?: number;
}

/** Source badge colors */
const SOURCE_COLORS: Record<string, { bg: string; text: string }> = {
  openalex: { bg: 'bg-bg-secondary', text: 'text-text-secondary' },
  semanticscholar: { bg: 'bg-bg-secondary', text: 'text-text-secondary' },
  datacite: { bg: 'bg-bg-secondary', text: 'text-text-secondary' },
  crossref: { bg: 'bg-bg-secondary', text: 'text-text-secondary' },
};

/** Source display names */
const SOURCE_NAMES: Record<string, string> = {
  openalex: 'OpenAlex',
  semanticscholar: 'Semantic Scholar',
  datacite: 'DataCite',
  crossref: 'Crossref',
};

/**
 * Returns similarity label and color based on score.
 */
function getSimilarityDisplay(score?: number): {
  label: string;
  color: string;
} {
  if (!score && score !== 0) return { label: '', color: '' };
  if (score >= 0.5)
    return { label: 'Very Similar', color: 'text-status-success bg-status-success-bg' };
  if (score >= 0.25)
    return { label: 'Related', color: 'text-status-warning bg-status-warning-bg' };
  return {
    label: 'Tangentially Related',
    color: 'text-text-secondary bg-bg-secondary',
  };
}

/**
 * PaperCard renders a single academic paper with metadata, similarity badge,
 * expandable abstract, and DOI link.
 */
export default function PaperCard({ paper, rank }: PaperCardProps) {
  const [expanded, setExpanded] = useState(false);
  const similarity = getSimilarityDisplay(paper.similarityScore);
  const sourceStyle = SOURCE_COLORS[paper.source] || SOURCE_COLORS.openalex;
  const sourceName = SOURCE_NAMES[paper.source] || paper.source;

  const abstractPreview =
    paper.abstract.length > 200
      ? paper.abstract.slice(0, 200) + '...'
      : paper.abstract;

  const authors =
    paper.authors.length > 3
      ? `${paper.authors.slice(0, 3).join(', ')} et al.`
      : paper.authors.join(', ');

  return (
    <div className="surface-card surface-card-hover p-5 transition-all">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          {rank !== undefined && (
            <span className="text-xs font-bold text-text-primary bg-bg-tertiary px-2 py-0.5 rounded-md">
              #{rank}
            </span>
          )}
          {similarity.label && (
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-md ${similarity.color}`}
            >
              {similarity.label}
            </span>
          )}
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded-md ${sourceStyle.bg} ${sourceStyle.text}`}
          >
            {sourceName}
          </span>
        </div>
        {paper.citationCount > 0 && (
          <span className="text-xs text-text-tertiary whitespace-nowrap">
            {paper.citationCount.toLocaleString()} citations
          </span>
        )}
      </div>

      {/* Title */}
      <h4 className="text-sm font-semibold text-text-primary mb-1.5 leading-snug">
        {paper.title}
      </h4>

      {/* Authors & metadata */}
      <p className="text-xs text-text-secondary mb-2">
        {authors}
        {paper.year ? ` · ${paper.year}` : ''}
        {paper.venue ? ` · ${paper.venue}` : ''}
      </p>

      {/* Abstract */}
      <div className="mb-3">
        <div id={`paper-abstract-${paper.id || rank}`}>
          <p className="text-xs text-text-secondary leading-relaxed">
            {expanded ? paper.abstract : abstractPreview}
          </p>
        </div>
        {paper.abstract.length > 200 && (
          <button
            onClick={() => setExpanded(!expanded)}
            aria-expanded={expanded}
            aria-controls={`paper-abstract-${paper.id || rank}`}
            className="text-xs text-accent-base hover:text-accent-hover mt-1 cursor-pointer min-h-[44px]"
          >
            {expanded ? 'Show less' : 'Show more'}
          </button>
        )}
      </div>

      {/* DOI link */}
      {paper.doi && (
        <a
          href={`https://doi.org/${paper.doi}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open paper: ${paper.title} in a new tab`}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-accent-base hover:text-accent-hover transition-colors min-h-[44px]"
        >
          Open Paper
          <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
            <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
            <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
          </svg>
        </a>
      )}

      {/* Similarity score bar */}
      {paper.similarityScore !== undefined && paper.similarityScore > 0 && (
        <div className="mt-3 pt-3 border-t border-border-subtle">
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-tertiary">Similarity</span>
            <div className="flex-1 h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
              <div
                className="h-full bg-accent-base rounded-full transition-all"
                style={{ width: `${Math.min(paper.similarityScore * 100, 100)}%` }}
              />
            </div>
            <span className="text-xs text-text-secondary font-mono">
              {(paper.similarityScore * 100).toFixed(0)}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
