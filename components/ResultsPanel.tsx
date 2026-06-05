/**
 * @file ResultsPanel Component
 *
 * Wrapper component that displays the complete analysis results.
 * Composes all result sections in order:
 * 1. Confidence badges
 * 2. Overlap explanation
 * 3. Gap matrix
 * 4. Pivot cards
 * 5. Top related papers
 * 6. Supervisor note
 * 7. Sources searched
 *
 * @component
 */

'use client';

import React, { useState } from 'react';
import { AnalysisResult } from '@/lib/types';
import ConfidenceBadge from './ConfidenceBadge';
import GapMatrix from './GapMatrix';
import PivotCard from './PivotCard';
import PaperCard from './PaperCard';

interface ResultsPanelProps {
  result: AnalysisResult;
  queries?: string[];
}

/**
 * ResultsPanel renders the full analysis results page with all 7 sections.
 */
export default function ResultsPanel({ result, queries }: ResultsPanelProps) {
  const [copied, setCopied] = useState(false);
  const [showQueries, setShowQueries] = useState(false);

  const basisText = `Based on ${result.totalPapersRetrieved} papers from ${
    Object.values(result.sourceCounts).filter((c) => c > 0).length
  } sources`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(result.supervisorNote);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = result.supervisorNote;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Section 1: Confidence Badges */}
      <section>
        <div className="flex flex-col sm:flex-row gap-3">
          <ConfidenceBadge
            label="Overlap Risk"
            value={result.overlapRisk}
            type="risk"
            basisText={basisText}
          />
          <ConfidenceBadge
            label="Evidence Confidence"
            value={result.evidenceConfidence}
            type="confidence"
            basisText={basisText}
          />
          <ConfidenceBadge
            label="Novelty Signal"
            value={result.noveltySignal}
            type="novelty"
            basisText={basisText}
          />
        </div>
      </section>

      {/* Section 2: Overlap Explanation */}
      <section>
        <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
          <span className="text-base">📊</span> Overlap Analysis
        </h3>
        <div className="surface-card p-5">
          <p className="text-sm text-text-secondary leading-relaxed">
            {result.overlapExplanation}
          </p>
        </div>
      </section>

      {/* Section 3: Gap Matrix */}
      <section>
        <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
          <span className="text-base">🔍</span> Four-Dimension Gap Matrix
        </h3>
        <GapMatrix gaps={result.gapMatrix} />
      </section>

      {/* Section 4: Research Pivots */}
      {result.pivots.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
            <span className="text-base">💡</span> Evidence-Backed Research Pivots
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {result.pivots.map((pivot, i) => (
              <PivotCard key={i} pivot={pivot} index={i} />
            ))}
          </div>
        </section>
      )}

      {/* Section 5: Top Related Papers */}
      {result.topRelatedPapers.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
            <span className="text-base">📄</span> Top Related Papers
          </h3>
          <div className="grid grid-cols-1 gap-3">
            {result.topRelatedPapers.map((paper, i) => (
              <PaperCard key={paper.id} paper={paper} rank={i + 1} />
            ))}
          </div>
        </section>
      )}

      {/* Section 6: Supervisor Note */}
      {result.supervisorNote && (
        <section>
          <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
            <span className="text-base">📋</span> Supervisor-Ready Note
          </h3>
          <div className="surface-card p-5">
            <div className="flex items-start justify-between gap-4 mb-3">
              <p className="text-xs text-text-tertiary">
                Ready to paste into your email to your supervisor
              </p>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-bg-secondary border border-border-subtle text-xs font-medium text-accent-base hover:bg-bg-tertiary transition-all cursor-pointer whitespace-nowrap min-h-[44px]"
              >
                {copied ? (
                  <>
                    <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Copied!
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                      <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                    </svg>
                    Copy to clipboard
                  </>
                )}
              </button>
            </div>
            <div className="bg-bg-secondary rounded-lg p-4 border border-border-subtle">
              <p className="text-sm text-text-primary leading-relaxed italic">
                {result.supervisorNote}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Section 7: Sources Searched */}
      <section>
        <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
          <span className="text-base">🔗</span> Sources Searched
        </h3>
        <div className="surface-card p-5">
          <div className="flex flex-wrap gap-4 mb-4">
            {Object.entries(result.sourceCounts).map(([source, count]) => (
              <div key={source} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-accent-base" />
                <span className="text-xs text-text-primary font-medium">
                  {source === 'openalex'
                    ? 'OpenAlex'
                    : source === 'semanticscholar'
                      ? 'Semantic Scholar'
                      : source === 'datacite'
                        ? 'DataCite'
                        : source}
                  :
                </span>
                <span className="text-xs text-text-secondary">{count} results</span>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-status-success" />
              <span className="text-xs text-text-primary font-medium">Total:</span>
              <span className="text-xs text-text-secondary">
                {result.totalPapersRetrieved} unique papers
              </span>
            </div>
          </div>

          {/* Queries used */}
          {queries && queries.length > 0 && (
            <div>
              <button
                onClick={() => setShowQueries(!showQueries)}
                className="text-xs text-accent-base hover:text-accent-hover cursor-pointer mb-2 min-h-[44px]"
              >
                {showQueries ? 'Hide queries' : `Show ${queries.length} queries used`}
              </button>
              {showQueries && (
                <div className="flex flex-wrap gap-1.5 animate-fade-in">
                  {queries.map((q, i) => (
                    <span
                      key={i}
                      className="text-xs px-2 py-1 rounded-md bg-bg-secondary text-text-secondary border border-border-subtle"
                    >
                      {q}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Coverage disclaimer */}
          <p className="text-xs text-text-tertiary mt-4 pt-3 border-t border-border-subtle">
            ResearchLens estimates novelty risk using open academic APIs. It does
            not claim 100% global coverage. Use results as a starting point for
            further investigation.
          </p>
        </div>
      </section>
    </div>
  );
}
