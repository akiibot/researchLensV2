'use client';

import React, { useState } from 'react';
import { AnalysisResult } from '@/lib/types';
import ConfidenceBadge from './ConfidenceBadge';
import FacultyCard from './FacultyCard';
import FundingFitPanel from './FundingFitPanel';
import GapMatrix from './GapMatrix';
import JournalTargetingPanel from './JournalTargetingPanel';
import PaperCard from './PaperCard';
import PivotCard from './PivotCard';

interface ResultsPanelProps {
  result: AnalysisResult;
  queries?: string[];
}

export default function ResultsPanel({ result, queries }: ResultsPanelProps) {
  const [copied, setCopied] = useState(false);
  const [showQueries, setShowQueries] = useState(false);

  const sourceCount = Object.values(result.sourceCounts).filter((c) => c > 0).length;
  const basisText = `Based on ${result.totalPapersRetrieved} papers from ${sourceCount} sources`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(result.supervisorNote);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
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

      <section>
        <h3 className="text-sm font-semibold text-text-primary mb-3">
          Overlap Analysis
        </h3>
        <div className="surface-card p-5">
          <p className="text-sm text-text-secondary leading-relaxed">
            {result.overlapExplanation}
          </p>
        </div>
      </section>

      {(result.credibilityReasons || result.modelStatus || result.savedReportId) && (
        <section>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {result.credibilityReasons && result.credibilityReasons.length > 0 && (
              <div className="surface-card p-5 md:col-span-2">
                <p className="text-xs uppercase tracking-wide text-accent-base font-semibold mb-3">
                  Credibility signals
                </p>
                <ul className="space-y-2">
                  {result.credibilityReasons.map((reason) => (
                    <li key={reason} className="text-xs text-text-secondary">
                      {reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="surface-card p-5">
              <p className="text-xs uppercase tracking-wide text-accent-base font-semibold mb-3">
                System status
              </p>
              {result.savedReportId && (
                <p className="text-xs text-status-success mb-2">
                  Report saved to Supabase.
                </p>
              )}
              {result.modelStatus && (
                <div className="space-y-1">
                  <p className="text-xs text-text-secondary">
                    Reasoning: {result.modelStatus.reasoningModel}
                  </p>
                  <p className="text-xs text-text-secondary">
                    Summary: {result.modelStatus.summaryModel}
                  </p>
                  <p className="text-xs text-text-tertiary mt-2">
                    {result.modelStatus.note}
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {(result.studentSummary || result.facultySummary) && (
        <section>
          <h3 className="text-sm font-semibold text-text-primary mb-3">
            Audience Views
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {result.studentSummary && (
              <div className="surface-card p-5">
                <p className="text-xs uppercase tracking-wide text-accent-base font-semibold mb-2">
                  Student friendly
                </p>
                <p className="text-sm text-text-secondary leading-relaxed">
                  {result.studentSummary}
                </p>
              </div>
            )}
            {result.facultySummary && (
              <div className="surface-card p-5">
                <p className="text-xs uppercase tracking-wide text-accent-base font-semibold mb-2">
                  Faculty friendly
                </p>
                <p className="text-sm text-text-secondary leading-relaxed">
                  {result.facultySummary}
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      <section>
        <h3 className="text-sm font-semibold text-text-primary mb-3">
          Four-Dimension Gap Matrix
        </h3>
        <GapMatrix gaps={result.gapMatrix} />
      </section>

      {result.pivots.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-text-primary mb-3">
            Evidence-Backed Research Pivots
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {result.pivots.map((pivot, i) => (
              <PivotCard key={i} pivot={pivot} index={i} />
            ))}
          </div>
        </section>
      )}

      {result.topRelatedPapers.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-text-primary mb-3">
            Top Related Papers
          </h3>
          <div className="grid grid-cols-1 gap-3">
            {result.topRelatedPapers.map((paper, i) => (
              <PaperCard key={paper.id} paper={paper} rank={i + 1} />
            ))}
          </div>
        </section>
      )}

      {result.journalTargeting && (
        <JournalTargetingPanel journalTargeting={result.journalTargeting} />
      )}

      {result.fundingFit && <FundingFitPanel fundingFit={result.fundingFit} />}

      {result.facultyMatches && result.facultyMatches.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-text-primary mb-3">
            Potential Supervisors / Researchers
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {result.facultyMatches.slice(0, 6).map((faculty) => (
              <FacultyCard
                key={faculty.openAlexAuthorId || faculty.id}
                faculty={faculty}
                reportId={result.savedReportId || null}
              />
            ))}
          </div>
        </section>
      )}

      {((result.recommendedUseCases && result.recommendedUseCases.length > 0) ||
        (result.nextActions && result.nextActions.length > 0) ||
        (result.limitations && result.limitations.length > 0)) && (
        <section>
          <h3 className="text-sm font-semibold text-text-primary mb-3">
            Use Cases and Next Steps
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {result.recommendedUseCases &&
              result.recommendedUseCases.length > 0 && (
                <div className="surface-card p-5">
                  <p className="text-xs uppercase tracking-wide text-accent-base font-semibold mb-3">
                    Use cases
                  </p>
                  <div className="space-y-3">
                    {result.recommendedUseCases.map((useCase) => (
                      <div key={useCase.title}>
                        <p className="text-sm font-medium text-text-primary">
                          {useCase.title}
                        </p>
                        <p className="text-xs text-text-secondary mt-1">
                          {useCase.description}
                        </p>
                        <p className="text-xs text-accent-text mt-1">
                          {useCase.suggestedAction}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            {result.nextActions && result.nextActions.length > 0 && (
              <div className="surface-card p-5">
                <p className="text-xs uppercase tracking-wide text-accent-base font-semibold mb-3">
                  Next actions
                </p>
                <ul className="space-y-2">
                  {result.nextActions.map((action) => (
                    <li key={action} className="text-xs text-text-secondary">
                      {action}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.limitations && result.limitations.length > 0 && (
              <div className="surface-card p-5">
                <p className="text-xs uppercase tracking-wide text-accent-base font-semibold mb-3">
                  Limitations
                </p>
                <ul className="space-y-2">
                  {result.limitations.map((limitation) => (
                    <li key={limitation} className="text-xs text-text-secondary">
                      {limitation}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      )}

      {result.supervisorNote && (
        <section>
          <h3 className="text-sm font-semibold text-text-primary mb-3">
            Supervisor-Ready Note
          </h3>
          <div className="surface-card p-5">
            <div className="flex items-start justify-between gap-4 mb-3">
              <p className="text-xs text-text-tertiary">
                Ready to paste into your email to your supervisor
              </p>
              <button
                onClick={handleCopy}
                className="px-3 py-1.5 rounded-lg bg-bg-secondary border border-border-subtle text-xs font-medium text-accent-base hover:bg-bg-tertiary transition-all cursor-pointer whitespace-nowrap min-h-[44px]"
              >
                {copied ? 'Copied' : 'Copy to clipboard'}
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

      <section>
        <h3 className="text-sm font-semibold text-text-primary mb-3">
          Sources Searched
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

          <p className="text-xs text-text-tertiary mt-4 pt-3 border-t border-border-subtle">
            ResearchLens estimates novelty risk using open academic APIs. It does
            not claim complete global coverage. Use results as a starting point
            for further investigation.
          </p>
        </div>
      </section>
    </div>
  );
}
