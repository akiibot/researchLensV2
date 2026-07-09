'use client';

import { ResearchSanityCriterion, ResearchSanityMatrix } from '@/lib/types';

interface ResearchSanityPanelProps {
  matrix: ResearchSanityMatrix;
}

const CRITERIA: Array<{
  key: keyof Pick<
    ResearchSanityMatrix,
    | 'noveltyPotential'
    | 'evidenceStrength'
    | 'feasibility'
    | 'supervisorFit'
    | 'claimRisk'
  >;
  label: string;
  risk?: boolean;
}> = [
  { key: 'noveltyPotential', label: 'Novelty' },
  { key: 'evidenceStrength', label: 'Evidence' },
  { key: 'feasibility', label: 'Feasibility' },
  { key: 'supervisorFit', label: 'Supervisor Fit' },
  { key: 'claimRisk', label: 'Claim Risk', risk: true },
];

function scoreColor(criterion: ResearchSanityCriterion, risk = false): string {
  if (risk) {
    if (criterion.score >= 70) return 'text-status-error';
    if (criterion.score >= 45) return 'text-status-warning';
    return 'text-status-success';
  }

  if (criterion.score >= 75) return 'text-status-success';
  if (criterion.score >= 55) return 'text-status-warning';
  return 'text-status-error';
}

export default function ResearchSanityPanel({
  matrix,
}: ResearchSanityPanelProps) {
  return (
    <section>
      <div className="flex items-center justify-between gap-4 mb-3">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">
            Research Sanity Check
          </h3>
          <p className="text-xs text-text-tertiary mt-1">
            Deterministic quality-control scores for novelty claims and thesis feasibility.
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-text-primary">
            {matrix.overallScore}
          </p>
          <p className="text-xs text-text-tertiary">overall</p>
        </div>
      </div>

      <div className="surface-card p-5 space-y-5">
        <div className="rounded-lg border border-border-subtle bg-bg-secondary px-4 py-3">
          <p className="text-sm font-semibold text-text-primary">
            {matrix.verdict}
          </p>
          <p className="text-xs text-text-tertiary mt-1">
            Scores are advisory. Use them to decide whether to proceed, narrow,
            rerun retrieval, or explore another pivot.
          </p>
          {matrix.fullTextCoverage && (
            <p className="mt-2 inline-flex rounded-md border border-accent-base/30 bg-accent-base/15 px-2 py-1 text-xs text-accent-text">
              Full-text coverage: {matrix.fullTextCoverage.label}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {CRITERIA.map(({ key, label, risk }) => {
            const criterion = matrix[key];
            return (
              <div
                key={key}
                className="rounded-lg border border-border-subtle bg-bg-secondary p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-xs font-medium text-text-secondary">
                    {label}
                  </p>
                  <p className={`text-lg font-bold ${scoreColor(criterion, risk)}`}>
                    {criterion.score}
                  </p>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-bg-tertiary overflow-hidden">
                  <div
                    className="h-full rounded-full bg-accent-base"
                    style={{ width: `${criterion.score}%` }}
                  />
                </div>
                <p className="text-xs text-text-tertiary mt-2 leading-relaxed">
                  {criterion.rationale}
                </p>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-accent-base font-semibold mb-2">
              Why this verdict
            </p>
            <ul className="space-y-2">
              {matrix.reasons.map((reason) => (
                <li key={reason} className="text-xs text-text-secondary">
                  {reason}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-accent-base font-semibold mb-2">
              Recommended actions
            </p>
            <ul className="space-y-2">
              {matrix.recommendedActions.map((action) => (
                <li key={action} className="text-xs text-text-secondary">
                  {action}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
