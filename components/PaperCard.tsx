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
import { accessLabel, accessTone, canReadPaper } from '@/lib/paperAccessLabels';
import Button, { buttonClassNames } from '@/components/ui/Button';

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
  arxiv: { bg: 'bg-bg-secondary', text: 'text-text-secondary' },
  europepmc: { bg: 'bg-bg-secondary', text: 'text-text-secondary' },
  core: { bg: 'bg-bg-secondary', text: 'text-text-secondary' },
  pubmed: { bg: 'bg-bg-secondary', text: 'text-text-secondary' },
};

/** Source display names */
const SOURCE_NAMES: Record<string, string> = {
  openalex: 'OpenAlex',
  semanticscholar: 'Semantic Scholar',
  datacite: 'DataCite',
  crossref: 'Crossref',
  arxiv: 'arXiv',
  europepmc: 'Europe PMC',
  core: 'CORE',
  pubmed: 'PubMed',
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
  const [readerStatus, setReaderStatus] = useState<string>('');
  const similarity = getSimilarityDisplay(paper.similarityScore);
  const sourceStyle = SOURCE_COLORS[paper.source] || SOURCE_COLORS.openalex;
  const sourceName = SOURCE_NAMES[paper.source] || paper.source;
  const readable = canReadPaper(paper);
  const openUrl = paper.landingUrl || paper.url || (paper.doi ? `https://doi.org/${paper.doi}` : null);

  const downloadPdf = async () => {
    setReaderStatus('Preparing PDF...');
    const response = await fetch('/api/papers/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paper }),
    });
    if (!response.ok) {
      setReaderStatus('PDF unavailable');
      return;
    }
    const blob = await response.blob();
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = `${paper.title.replace(/[^\w\s.-]/g, '').slice(0, 90) || 'paper'}.pdf`;
    link.click();
    URL.revokeObjectURL(href);
    setReaderStatus('PDF downloaded');
  };

  const readInResearchLens = async () => {
    setReaderStatus('Reading PDF...');
    const response = await fetch('/api/papers/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paper }),
    });
    const result = await response.json();
    sessionStorage.setItem('researchlens_last_full_text', JSON.stringify(result));
    setReaderStatus(result.status === 'available' ? 'Full text ready in session' : result.message || 'Full text unavailable');
  };

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
          <span
            className={`rounded-md border px-2 py-0.5 text-xs font-medium ${accessTone(paper.accessType)}`}
          >
            {accessLabel(paper.accessType)}
          </span>
          {paper.retrievalFit && (
            <span className="rounded-md border border-border-subtle bg-bg-secondary px-2 py-0.5 text-xs font-medium capitalize text-text-secondary">
              {paper.retrievalFit} retrieval fit
            </span>
          )}
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

      {paper.matchedFacets && paper.matchedFacets.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {paper.matchedFacets.map((facet) => (
            <span
              key={facet}
              className="rounded-md border border-accent-base/25 bg-accent-base/10 px-2 py-0.5 text-[11px] text-accent-text"
            >
              {facet}
            </span>
          ))}
        </div>
      )}

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

      <div className="flex flex-wrap items-center gap-2">
        {openUrl && (
          <a
            href={openUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open paper: ${paper.title} in a new tab`}
            className={buttonClassNames('secondary', 'sm')}
          >
            Open Paper
          </a>
        )}
        {readable && (
          <>
            <Button variant="secondary" size="sm" onClick={downloadPdf}>
              Download PDF
            </Button>
            <Button variant="primary" size="sm" onClick={readInResearchLens}>
              Read in ResearchLens
            </Button>
          </>
        )}
        {!readable && (
          <span className="text-xs text-text-tertiary">
            Upload PDF to read full text.
          </span>
        )}
      </div>
      {readerStatus && (
        <p className="mt-2 text-xs text-text-tertiary">{readerStatus}</p>
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
