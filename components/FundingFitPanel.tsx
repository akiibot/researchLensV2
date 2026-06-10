'use client';

import React from 'react';
import Link from 'next/link';
import { FundingFit } from '@/lib/types';

interface FundingFitPanelProps {
  fundingFit: FundingFit;
}

function readinessClasses(readiness: FundingFit['readiness']) {
  if (readiness === 'high') {
    return 'text-status-success bg-status-success-bg/30 border-status-success/20';
  }
  if (readiness === 'low') {
    return 'text-status-error bg-status-error-bg/30 border-status-error/20';
  }
  return 'text-status-warning bg-status-warning-bg/30 border-status-warning/20';
}

function budgetLabel(scale: FundingFit['budgetScale']) {
  if (scale === 'major_grant') return 'Major grant';
  if (scale === 'external_seed') return 'External seed';
  return 'Small internal';
}

export default function FundingFitPanel({ fundingFit }: FundingFitPanelProps) {
  const [copiedDraft, setCopiedDraft] = React.useState<string | null>(null);

  const copyDraft = async (title: string, body: string) => {
    await navigator.clipboard.writeText(body);
    setCopiedDraft(title);
    setTimeout(() => setCopiedDraft(null), 1600);
  };

  return (
    <section>
      <h3 className="text-sm font-semibold text-text-primary mb-3">
        Grant / Funding Fit
      </h3>
      <div className="surface-card p-5 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-accent-base font-semibold">
              Funding readiness
            </p>
            <p className="text-sm text-text-secondary mt-1">
              {fundingFit.grantReadyFraming}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`text-xs font-bold uppercase px-3 py-1.5 rounded-lg border ${readinessClasses(
                fundingFit.readiness
              )}`}
            >
              {fundingFit.readiness}
            </span>
            <span className="text-xs font-mono px-3 py-1.5 rounded-lg bg-bg-secondary border border-border-subtle text-text-secondary">
              {fundingFit.score}/100
            </span>
            <span className="text-xs px-3 py-1.5 rounded-lg bg-bg-secondary border border-border-subtle text-text-secondary">
              {budgetLabel(fundingFit.budgetScale)}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ListBlock title="Best angles" items={fundingFit.bestAngles} />
          <ListBlock title="Funder categories" items={fundingFit.funderCategories} />
          <ListBlock title="Weaknesses to fix" items={fundingFit.weaknesses} />
        </div>

        {((fundingFit.searchLinks && fundingFit.searchLinks.length > 0) ||
          (fundingFit.internalRoutes && fundingFit.internalRoutes.length > 0)) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {fundingFit.searchLinks && fundingFit.searchLinks.length > 0 && (
              <div className="bg-bg-secondary rounded-lg p-4 border border-border-subtle">
                <p className="text-xs uppercase tracking-wide text-accent-base font-semibold mb-3">
                  Funding search links
                </p>
                <div className="space-y-3">
                  {fundingFit.searchLinks.map((link) => (
                    <a
                      key={`${link.label}-${link.url}`}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block rounded-lg border border-border-subtle bg-bg-tertiary p-3 hover:border-accent-base/40 transition-colors"
                    >
                      <p className="text-sm font-medium text-text-primary">
                        {link.label}
                      </p>
                      <p className="text-xs text-text-secondary mt-1">
                        {link.purpose}
                      </p>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {fundingFit.internalRoutes && fundingFit.internalRoutes.length > 0 && (
              <div className="bg-bg-secondary rounded-lg p-4 border border-border-subtle">
                <p className="text-xs uppercase tracking-wide text-accent-base font-semibold mb-3">
                  ResearchLens routes
                </p>
                <div className="space-y-3">
                  {fundingFit.internalRoutes.map((route) => (
                    <Link
                      key={`${route.label}-${route.href}`}
                      href={route.href}
                      className="block rounded-lg border border-border-subtle bg-bg-tertiary p-3 hover:border-accent-base/40 transition-colors"
                    >
                      <p className="text-sm font-medium text-text-primary">
                        {route.label}
                      </p>
                      <p className="text-xs text-text-secondary mt-1">
                        {route.purpose}
                      </p>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {fundingFit.connectorSuggestions &&
          fundingFit.connectorSuggestions.length > 0 && (
            <div className="bg-bg-secondary rounded-lg p-4 border border-border-subtle">
              <p className="text-xs uppercase tracking-wide text-accent-base font-semibold mb-3">
                Possible connectors
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {fundingFit.connectorSuggestions.map((connector) => (
                  <div
                    key={`${connector.name}-${connector.type}`}
                    className="rounded-lg border border-border-subtle bg-bg-tertiary p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium text-text-primary">
                        {connector.name}
                      </p>
                      <span className="text-[10px] uppercase px-2 py-1 rounded-md bg-accent-base/10 text-accent-text border border-accent-base/20">
                        {connector.status === 'available_now'
                          ? 'available'
                          : 'future'}
                      </span>
                    </div>
                    <p className="text-xs text-text-tertiary mt-1">
                      {connector.type.replace('_', ' ')}
                    </p>
                    <p className="text-xs text-text-secondary mt-2">
                      {connector.purpose}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-bg-secondary rounded-lg p-4 border border-border-subtle">
            <p className="text-xs uppercase tracking-wide text-accent-base font-semibold mb-2">
              Specific aims
            </p>
            <ol className="space-y-2">
              {fundingFit.specificAims.map((aim, index) => (
                <li key={aim} className="text-xs text-text-secondary">
                  Aim {index + 1}: {aim}
                </li>
              ))}
            </ol>
          </div>
          <ListBlock
            title="Collaborator profiles"
            items={fundingFit.collaboratorProfiles}
          />
        </div>

        {fundingFit.outreachDrafts && fundingFit.outreachDrafts.length > 0 && (
          <div className="bg-bg-secondary rounded-lg p-4 border border-border-subtle">
            <p className="text-xs uppercase tracking-wide text-accent-base font-semibold mb-3">
              Funding outreach drafts
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {fundingFit.outreachDrafts.map((draft) => (
                <div
                  key={draft.title}
                  className="rounded-lg border border-border-subtle bg-bg-tertiary p-3"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <p className="text-sm font-medium text-text-primary">
                        {draft.title}
                      </p>
                      <p className="text-xs text-text-tertiary">
                        {draft.recipientType.replace('_', ' ')}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyDraft(draft.title, draft.body)}
                      className="text-xs text-accent-base hover:text-accent-hover cursor-pointer"
                    >
                      {copiedDraft === draft.title ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <p className="text-xs text-text-secondary leading-relaxed whitespace-pre-line">
                    {draft.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {fundingFit.impactStatement && (
          <div className="bg-bg-secondary rounded-lg p-4 border border-border-subtle">
            <p className="text-xs uppercase tracking-wide text-accent-base font-semibold mb-2">
              Impact statement
            </p>
            <p className="text-sm text-text-secondary leading-relaxed">
              {fundingFit.impactStatement}
            </p>
          </div>
        )}

        {fundingFit.miniGrantAbstract && (
          <div className="bg-bg-secondary rounded-lg p-4 border border-border-subtle">
            <p className="text-xs uppercase tracking-wide text-accent-base font-semibold mb-2">
              Mini grant abstract
            </p>
            <p className="text-sm text-text-primary leading-relaxed">
              {fundingFit.miniGrantAbstract}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="bg-bg-secondary rounded-lg p-4 border border-border-subtle">
      <p className="text-xs uppercase tracking-wide text-accent-base font-semibold mb-2">
        {title}
      </p>
      {items.length > 0 ? (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item} className="text-xs text-text-secondary">
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-text-tertiary">No items generated.</p>
      )}
    </div>
  );
}
