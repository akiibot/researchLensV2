'use client';

import React from 'react';
import { AnalysisResult, FundingFit, JournalTargeting } from '@/lib/types';
import { copyToClipboard } from '@/lib/clipboard';
import Button from '@/components/ui/Button';
import FundingFitPanel from './FundingFitPanel';
import JournalTargetingPanel from './JournalTargetingPanel';

interface ResearchFitPanelProps {
  result: AnalysisResult;
}

type FitTab = 'funding' | 'publication';

function readinessTone(readiness?: FundingFit['readiness']) {
  if (readiness === 'high') return 'border-status-success/30 bg-status-success-bg text-status-success';
  if (readiness === 'low') return 'border-status-error/30 bg-status-error-bg text-status-error';
  return 'border-status-warning/30 bg-status-warning-bg text-status-warning';
}

function strongestPublicationFit(publicationFit?: JournalTargeting): string {
  const first = publicationFit?.targets?.[0];
  if (!first) return 'No verified outlet target yet';
  return `${first.outletName} (${first.fitScore}/100)`;
}

function buildFundingSummary(fundingFit?: FundingFit): string {
  if (!fundingFit) return 'No funding fit is available for this report yet.';
  return [
    `Funding readiness: ${fundingFit.readiness} (${fundingFit.score}/100).`,
    `Best framing: ${fundingFit.grantReadyFraming}`,
    fundingFit.biggestBlocker ? `Biggest blocker: ${fundingFit.biggestBlocker}` : '',
    fundingFit.nextBestAction ? `Next action: ${fundingFit.nextBestAction}` : '',
    '',
    'Specific aims:',
    ...fundingFit.specificAims.map((aim, index) => `${index + 1}. ${aim}`),
    '',
    `Mini grant abstract: ${fundingFit.miniGrantAbstract}`,
  ]
    .filter(Boolean)
    .join('\n');
}

function buildPublicationSummary(publicationFit?: JournalTargeting): string {
  if (!publicationFit || publicationFit.targets.length === 0) {
    return 'No publication targets are available because retrieved venue metadata is limited.';
  }

  return [
    `Recommended route: ${publicationFit.recommendedRoute || 'Not determined'}`,
    publicationFit.biggestBlocker ? `Biggest blocker: ${publicationFit.biggestBlocker}` : '',
    publicationFit.nextBestAction ? `Next action: ${publicationFit.nextBestAction}` : '',
    '',
    'Target outlets:',
    ...publicationFit.targets.slice(0, 5).map((target, index) =>
      `${index + 1}. ${target.outletName} - ${target.fitScore}/100 fit; ${target.evidenceStrength} evidence; ${target.metadataNote}`
    ),
  ]
    .filter(Boolean)
    .join('\n');
}

export default function ResearchFitPanel({ result }: ResearchFitPanelProps) {
  const [activeTab, setActiveTab] = React.useState<FitTab>('funding');
  const [copied, setCopied] = React.useState<string | null>(null);
  const fundingFit = result.fundingFit;
  const publicationFit = result.journalTargeting;

  const copyText = async (label: string, text: string) => {
    await copyToClipboard(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 1600);
  };

  if (!fundingFit && !publicationFit) {
    return (
      <section className="surface-card p-5">
        <p className="text-sm font-semibold text-text-primary">Research Fit</p>
        <p className="mt-2 text-sm text-text-secondary">
          This saved report does not include funding or publication fit data yet.
          Rerun the analysis to generate it.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-5">
      <div className="surface-card p-5">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-wide text-accent-base">
              Research Fit
            </p>
            <h3 className="mt-2 text-xl font-semibold text-text-primary">
              Funding and publication readiness
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-text-secondary">
              This section turns the current thesis report into practical fit
              decisions: whether it is fundable, where it might publish, what is
              verified, and what still needs manual checking.
            </p>
          </div>
          <div className="grid min-w-0 gap-3 sm:grid-cols-3 xl:min-w-[520px]">
            <div className={`rounded-xl border p-4 ${readinessTone(fundingFit?.readiness)}`}>
              <p className="text-xs uppercase tracking-wide opacity-80">Funding</p>
              <p className="mt-1 text-2xl font-semibold">
                {fundingFit ? `${fundingFit.score}` : '--'}
                {fundingFit && <span className="text-sm opacity-70"> /100</span>}
              </p>
              <p className="mt-1 text-xs capitalize">{fundingFit?.readiness || 'Unavailable'}</p>
            </div>
            <div className="rounded-xl border border-border-subtle bg-bg-secondary p-4">
              <p className="text-xs uppercase tracking-wide text-text-tertiary">
                Publication route
              </p>
              <p className="mt-2 text-sm font-semibold text-text-primary">
                {publicationFit?.recommendedRoute || 'Not determined'}
              </p>
            </div>
            <div className="rounded-xl border border-border-subtle bg-bg-secondary p-4">
              <p className="text-xs uppercase tracking-wide text-text-tertiary">
                Best outlet signal
              </p>
              <p className="mt-2 text-sm font-semibold text-text-primary">
                {strongestPublicationFit(publicationFit)}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          <div className="rounded-xl border border-border-subtle bg-bg-secondary/70 p-4">
            <p className="text-xs uppercase tracking-wide text-text-tertiary">
              Biggest blocker
            </p>
            <p className="mt-2 text-sm leading-relaxed text-text-primary">
              {fundingFit?.biggestBlocker ||
                publicationFit?.biggestBlocker ||
                'Manual verification is still needed.'}
            </p>
          </div>
          <div className="rounded-xl border border-border-subtle bg-bg-secondary/70 p-4">
            <p className="text-xs uppercase tracking-wide text-text-tertiary">
              Next best action
            </p>
            <p className="mt-2 text-sm leading-relaxed text-text-primary">
              {fundingFit?.nextBestAction ||
                publicationFit?.nextBestAction ||
                'Verify the strongest venue and funding route manually.'}
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={() => copyText('funding', buildFundingSummary(fundingFit))}
          >
            {copied === 'funding' ? 'Copied funding summary' : 'Copy funding summary'}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              copyText('publication', buildPublicationSummary(publicationFit))
            }
          >
            {copied === 'publication'
              ? 'Copied publication summary'
              : 'Copy publication summary'}
          </Button>
        </div>
      </div>

      <div className="surface-card p-4">
        <div className="mb-4 inline-flex rounded-xl border border-border-subtle bg-bg-secondary p-1">
          {([
            ['funding', 'Funding'],
            ['publication', 'Publication'],
          ] as Array<[FitTab, string]>).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                activeTab === id
                  ? 'bg-accent-base text-white'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {activeTab === 'funding' && (
          <details className="group">
            <summary className="cursor-pointer rounded-lg border border-border-subtle bg-bg-secondary px-4 py-3 text-sm font-semibold text-text-primary">
              Funding details
            </summary>
            <div className="mt-4">
              {fundingFit ? (
                <FundingFitPanel fundingFit={fundingFit} />
              ) : (
                <p className="rounded-lg border border-border-subtle p-4 text-sm text-text-secondary">
                  Funding fit is unavailable for this report.
                </p>
              )}
            </div>
          </details>
        )}

        {activeTab === 'publication' && (
          <details className="group">
            <summary className="cursor-pointer rounded-lg border border-border-subtle bg-bg-secondary px-4 py-3 text-sm font-semibold text-text-primary">
              Publication details
            </summary>
            <div className="mt-4">
              {publicationFit && publicationFit.targets.length > 0 ? (
                <JournalTargetingPanel journalTargeting={publicationFit} />
              ) : (
                <p className="rounded-lg border border-border-subtle p-4 text-sm text-text-secondary">
                  No publication targets were generated because retrieved venue
                  metadata was limited. ResearchLens did not invent outlets.
                </p>
              )}
            </div>
          </details>
        )}
      </div>
    </section>
  );
}
