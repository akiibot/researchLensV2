'use client';

import React from 'react';
import { EvidenceScopeDiagnostics } from '@/lib/types';

interface EvidenceScopePanelProps {
  diagnostics: EvidenceScopeDiagnostics;
}

export default function EvidenceScopePanel({
  diagnostics,
}: EvidenceScopePanelProps) {
  const hasGeography = diagnostics.detectedGeographyTerms.length > 0;

  return (
    <section>
      <h3 className="text-sm font-semibold text-text-primary mb-3">
        Evidence Scope
      </h3>
      <div className="surface-card p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-accent-base font-semibold">
              {diagnostics.label}
            </p>
            <p className="text-sm text-text-secondary leading-relaxed mt-2">
              {diagnostics.summary}
            </p>
          </div>
          <div className="rounded-lg bg-bg-secondary border border-border-subtle px-3 py-2 text-right">
            <p className="text-lg font-semibold text-text-primary">
              {diagnostics.top10LocalMatches}/10
            </p>
            <p className="text-[11px] text-text-tertiary">
              top papers preserve geography
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-lg bg-bg-secondary border border-border-subtle p-3">
            <p className="text-[11px] uppercase tracking-wide text-text-tertiary">
              Detected Terms
            </p>
            <p className="text-sm text-text-primary mt-1">
              {hasGeography
                ? diagnostics.detectedGeographyTerms.join(', ')
                : 'None'}
            </p>
          </div>
          <div className="rounded-lg bg-bg-secondary border border-border-subtle p-3">
            <p className="text-[11px] uppercase tracking-wide text-text-tertiary">
              Local Evidence
            </p>
            <p className="text-sm text-text-primary mt-1">
              {diagnostics.localEvidenceCount} papers
            </p>
          </div>
          <div className="rounded-lg bg-bg-secondary border border-border-subtle p-3">
            <p className="text-[11px] uppercase tracking-wide text-text-tertiary">
              Global Evidence
            </p>
            <p className="text-sm text-text-primary mt-1">
              {diagnostics.globalEvidenceCount} papers
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
