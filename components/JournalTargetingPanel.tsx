'use client';

import React from 'react';
import { JournalTarget, JournalTargeting } from '@/lib/types';

interface JournalTargetingPanelProps {
  journalTargeting: JournalTargeting;
}

function evidenceClasses(strength: JournalTarget['evidenceStrength']) {
  if (strength === 'strong') {
    return 'text-status-success bg-status-success-bg/30 border-status-success/20';
  }
  if (strength === 'moderate') {
    return 'text-status-warning bg-status-warning-bg/30 border-status-warning/20';
  }
  return 'text-text-secondary bg-bg-secondary border-border-subtle';
}

function openAccessLabel(status: JournalTarget['openAccessStatus']) {
  if (status === 'open') return 'Open access';
  if (status === 'hybrid') return 'Hybrid OA';
  if (status === 'closed') return 'Closed';
  return 'Not verified';
}

export default function JournalTargetingPanel({
  journalTargeting,
}: JournalTargetingPanelProps) {
  if (!journalTargeting.targets.length) return null;

  return (
    <section>
      <h3 className="text-sm font-semibold text-text-primary mb-3">
        Journal / Conference Targeting
      </h3>
      <div className="surface-card p-5 space-y-5">
        <div>
          <p className="text-xs uppercase tracking-wide text-accent-base font-semibold">
            Publishable work
          </p>
          <p className="text-sm text-text-secondary mt-1">
            Suggested outlets are grounded in retrieved venue evidence and limited
            open metadata. Verify author guidelines before submitting.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {journalTargeting.targets.map((target, index) => (
            <article
              key={`${target.outletName}-${index}`}
              className="bg-bg-secondary rounded-lg p-4 border border-border-subtle"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-text-tertiary">
                    {target.outletType}
                  </p>
                  <h4 className="text-base font-semibold text-text-primary mt-1">
                    {target.outletName}
                  </h4>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="text-xs font-mono px-2.5 py-1 rounded-lg bg-bg-tertiary border border-border-subtle text-text-secondary">
                    {target.fitScore}/100 fit
                  </span>
                  <span
                    className={`text-xs font-bold uppercase px-2.5 py-1 rounded-lg border ${evidenceClasses(
                      target.evidenceStrength
                    )}`}
                  >
                    {target.evidenceStrength}
                  </span>
                  <span className="text-xs px-2.5 py-1 rounded-lg bg-bg-tertiary border border-border-subtle text-text-secondary">
                    {openAccessLabel(target.openAccessStatus)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <InfoBlock title="Scope match" body={target.scopeMatch} />
                <InfoBlock title="Article type fit" body={target.articleTypeFit} />
              </div>

              {target.similarAcceptedPapers.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs uppercase tracking-wide text-accent-base font-semibold mb-2">
                    Similar accepted papers
                  </p>
                  <div className="space-y-2">
                    {target.similarAcceptedPapers.map((paper) => (
                      <div
                        key={`${target.outletName}-${paper.title}`}
                        className="rounded-lg bg-bg-tertiary border border-border-subtle p-3"
                      >
                        <p className="text-sm font-medium text-text-primary leading-snug">
                          {paper.title}
                        </p>
                        <p className="text-xs text-text-secondary mt-1">
                          {paper.year || 'n.d.'}
                          {paper.doi ? ` - DOI: ${paper.doi}` : ''}
                        </p>
                        {paper.url && (
                          <a
                            href={paper.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex text-xs text-accent-base hover:text-accent-hover mt-2 min-h-[32px] items-center"
                          >
                            Open paper
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div className="rounded-lg bg-bg-tertiary border border-border-subtle p-3">
                  <p className="text-xs uppercase tracking-wide text-accent-base font-semibold mb-2">
                    Citation style
                  </p>
                  <p className="text-xs text-text-secondary">
                    {target.citationStyle || 'Not verified'}
                  </p>
                </div>
                <div className="rounded-lg bg-bg-tertiary border border-border-subtle p-3">
                  <p className="text-xs uppercase tracking-wide text-accent-base font-semibold mb-2">
                    Submission checklist
                  </p>
                  <ul className="space-y-1.5">
                    {target.submissionChecklist.map((item) => (
                      <li key={item} className="text-xs text-text-secondary">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4 pt-4 border-t border-border-subtle">
                <p className="text-xs text-text-tertiary">
                  {target.metadataNote}
                </p>
                {target.verificationUrl && (
                  <a
                    href={target.verificationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium text-accent-base hover:text-accent-hover min-h-[32px] inline-flex items-center"
                  >
                    Verify outlet
                  </a>
                )}
              </div>
            </article>
          ))}
        </div>

        {journalTargeting.notes.length > 0 && (
          <div className="bg-bg-secondary rounded-lg p-4 border border-border-subtle">
            <p className="text-xs uppercase tracking-wide text-accent-base font-semibold mb-2">
              Targeting notes
            </p>
            <ul className="space-y-2">
              {journalTargeting.notes.map((note) => (
                <li key={note} className="text-xs text-text-secondary">
                  {note}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

function InfoBlock({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg bg-bg-tertiary border border-border-subtle p-3">
      <p className="text-xs uppercase tracking-wide text-accent-base font-semibold mb-2">
        {title}
      </p>
      <p className="text-xs text-text-secondary leading-relaxed">
        {body || 'Not verified'}
      </p>
    </div>
  );
}
