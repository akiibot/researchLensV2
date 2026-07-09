'use client';

import React, { useMemo, useState } from 'react';
import {
  AnalysisResult,
  GapDimension,
  Pivot,
  Paper,
  ResearchSanityCriterion,
  SearchFacetDiagnostics,
  ThesisMindmapBranch,
  ThesisMindmapNode,
} from '@/lib/types';
import EvidenceScopePanel from './EvidenceScopePanel';
import FacultyCard from './FacultyCard';
import PaperCard from './PaperCard';
import PivotCard from './PivotCard';
import ResearchFitPanel from './ResearchFitPanel';
import ThesisMindmapPanel, { ResearchTool } from './ThesisMindmapPanel';

interface ResultsPanelProps {
  result: AnalysisResult;
  queries?: string[];
  onExplorePivot?: (pivot: Pivot) => void;
  onExploreMindmapNode?: (
    node: ThesisMindmapNode,
    branch: ThesisMindmapBranch
  ) => void;
}

type ResultTool =
  | 'canvas'
  | 'evidence'
  | 'pivots'
  | 'researchFit'
  | 'reader'
  | 'copilot'
  | 'lineage'
  | 'diagnostics'
  | 'export';

type DensityLevel = 'beginner' | 'guided' | 'advanced';

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

const GAP_HELP: Record<GapDimension['dimension'], string> = {
  topic: 'Is the main topic already crowded?',
  method: 'Is there room for a stronger method?',
  population: 'Can the target group be clearer?',
  geography: 'Does location create a useful angle?',
};

const TOOL_CONFIG: Array<{
  id: ResultTool;
  label: string;
  shortLabel: string;
  icon: string;
  purpose: string;
  action: string;
}> = [
  {
    id: 'canvas',
    label: 'Canvas',
    shortLabel: 'Canvas',
    icon: 'Map',
    purpose: 'Turn the report into movable thesis building blocks.',
    action: 'Open the visual map when you want to organize topic, method, risks, and pivots.',
  },
  {
    id: 'evidence',
    label: 'Evidence',
    shortLabel: 'Evidence',
    icon: 'Papers',
    purpose: 'Check the papers behind the verdict.',
    action: 'Use this before making strong novelty claims.',
  },
  {
    id: 'pivots',
    label: 'Pivots',
    shortLabel: 'Pivots',
    icon: 'Moves',
    purpose: 'Find stronger thesis directions from the gaps.',
    action: 'Use this when the current topic is promising but too broad.',
  },
  {
    id: 'researchFit',
    label: 'Research Fit',
    shortLabel: 'Fit',
    icon: 'Fit',
    purpose: 'Check funding readiness and publication route.',
    action: 'Use this to turn the topic into grant, journal, or conference decisions.',
  },
  {
    id: 'reader',
    label: 'Reader',
    shortLabel: 'Reader',
    icon: 'Read',
    purpose: 'Inspect full-text access and read open papers.',
    action: 'Use this when a paper needs manual verification.',
  },
  {
    id: 'copilot',
    label: 'Copilot',
    shortLabel: 'Copilot',
    icon: 'Ask',
    purpose: 'Ask thesis questions using the current report context.',
    action: 'Use this to prepare supervisor questions or explain a selected card.',
  },
  {
    id: 'lineage',
    label: 'Lineage',
    shortLabel: 'Lineage',
    icon: 'Graph',
    purpose: 'See prior works, derivative works, and novelty threats around a paper.',
    action: 'Use this to understand whether one paper sits inside a bigger research cluster.',
  },
  {
    id: 'diagnostics',
    label: 'Diagnostics',
    shortLabel: 'Audit',
    icon: 'Audit',
    purpose: 'Inspect retrieval, source coverage, and technical trust signals.',
    action: 'Use this when results look off or you need to explain search limitations.',
  },
  {
    id: 'export',
    label: 'Export',
    shortLabel: 'Export',
    icon: 'Copy',
    purpose: 'Copy supervisor-ready notes and report assets.',
    action: 'Use this when you are ready to send or save the topic direction.',
  },
];

function getSourceDisplayName(source: string): string {
  return SOURCE_NAMES[source] || source;
}

function scoreValue(criterion?: ResearchSanityCriterion): string {
  if (!criterion) return '--';
  return (criterion.score / 10).toFixed(1);
}

function scoreLevel(score?: number, risk = false): string {
  if (score === undefined) return 'Unknown';
  if (risk) {
    if (score >= 70) return 'High';
    if (score >= 45) return 'Moderate';
    return 'Low';
  }
  if (score >= 75) return 'Strong';
  if (score >= 55) return 'Moderate';
  return 'Weak';
}

function saturationImpact(saturation: GapDimension['saturation']): string {
  if (saturation === 'crowded') return 'High';
  if (saturation === 'moderate') return 'Medium';
  return 'Open';
}

function compactFacetList(values: string[]): string {
  return values.length > 0 ? values.join(', ') : 'Not detected';
}

function facetLabel(facet: string): string {
  const labels: Record<string, string> = {
    problem: 'Problem',
    domain: 'Domain',
    languageContext: 'Language',
    method: 'Method',
    intervention: 'Intervention',
    geography: 'Geography',
  };
  return labels[facet] || facet;
}

function metricTone(score?: number, risk = false): string {
  if (score === undefined) return 'border-border-subtle bg-bg-secondary';
  if (risk) {
    if (score >= 70) return 'border-status-error/30 bg-status-error-bg';
    if (score >= 45) return 'border-status-warning/30 bg-status-warning-bg';
    return 'border-status-success/30 bg-status-success-bg';
  }
  if (score >= 75) return 'border-status-success/30 bg-status-success-bg';
  if (score >= 55) return 'border-status-warning/30 bg-status-warning-bg';
  return 'border-status-error/30 bg-status-error-bg';
}

function InfoHint({ text }: { text: string }) {
  return (
    <span
      className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-border-subtle text-[11px] text-text-tertiary"
      title={text}
      aria-label={text}
    >
      ?
    </span>
  );
}

function MetricCard({
  label,
  value,
  caption,
  helper,
  tone,
}: {
  label: string;
  value: string;
  caption: string;
  helper: string;
  tone?: string;
}) {
  return (
    <div className={`rounded-xl border p-4 ${tone || 'border-border-subtle bg-bg-secondary'}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-text-tertiary">
            {label}
          </p>
          <p className="mt-1 text-2xl font-semibold text-text-primary">
            {value}
            {value !== '--' && (
              <span className="text-sm text-text-tertiary"> /10</span>
            )}
          </p>
          <p className="mt-1 text-xs text-text-secondary">{caption}</p>
        </div>
        <InfoHint text={helper} />
      </div>
    </div>
  );
}

function SectionShell({
  title,
  helper,
  children,
}: {
  title: string;
  helper?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
        {helper && <InfoHint text={helper} />}
      </div>
      {children}
    </section>
  );
}

function ToolDock({
  activeTool,
  onSelectTool,
  density,
}: {
  activeTool: ResultTool | null;
  onSelectTool: (tool: ResultTool) => void;
  density: DensityLevel;
}) {
  return (
    <section className="surface-card p-4">
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-accent-base font-semibold">
            Open only what you need
          </p>
          <h3 className="text-lg font-semibold text-text-primary">
            Research toolkit
          </h3>
        </div>
        <p className="text-xs capitalize text-text-tertiary">
          {density} view
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-9">
        {TOOL_CONFIG.map((tool) => (
          <button
            key={tool.id}
            type="button"
            onClick={() => onSelectTool(tool.id)}
            title={tool.purpose}
            className={`min-h-[72px] rounded-xl border px-3 py-3 text-left transition-all ${
              activeTool === tool.id
                ? 'border-accent-base/60 bg-accent-base/15 text-text-primary shadow-lg shadow-accent-base/10'
                : 'border-border-subtle bg-bg-secondary/70 text-text-secondary hover:border-border-strong hover:bg-bg-tertiary hover:text-text-primary'
            }`}
          >
            <span className="block text-[10px] font-semibold uppercase tracking-wide text-accent-text">
              {tool.icon}
            </span>
            <span className="mt-1 block text-sm font-semibold">
              {tool.shortLabel}
            </span>
            <span className="mt-1 block text-[11px] leading-snug text-text-tertiary">
              {tool.purpose}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

function BeginnerPathCard() {
  return (
    <div className="grid gap-2 md:grid-cols-3">
      {[
        ['1', 'Copy packet', 'Use this as your supervisor discussion draft.'],
        ['2', 'Check evidence', 'Read the top papers before claiming novelty.'],
        ['3', 'Choose move', 'Explore a pivot if the current topic is broad.'],
      ].map(([step, title, body]) => (
        <div
          key={step}
          className="rounded-xl border border-border-subtle bg-bg-secondary/70 p-3"
        >
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-base/20 text-xs font-semibold text-accent-text">
              {step}
            </span>
            <p className="text-sm font-semibold text-text-primary">{title}</p>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-text-tertiary">
            {body}
          </p>
        </div>
      ))}
    </div>
  );
}

function MicroDemoCard({
  tool,
  onDismiss,
}: {
  tool: (typeof TOOL_CONFIG)[number];
  onDismiss: () => void;
}) {
  return (
    <div className="rounded-xl border border-accent-base/30 bg-accent-base/10 p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-accent-base font-semibold">
            First time - {tool.label}
          </p>
          <p className="mt-1 text-sm font-semibold text-text-primary">
            {tool.purpose}
          </p>
          <p className="mt-1 text-xs text-text-secondary">{tool.action}</p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="min-h-[40px] rounded-lg border border-border-subtle px-3 text-xs font-medium text-text-secondary hover:text-text-primary"
        >
          Got it
        </button>
      </div>
    </div>
  );
}

function ApprovalPacketCard({
  packetText,
  copied,
  onCopy,
  topPapers,
  supervisorQuestions,
  verdict,
  nextAction,
  risks,
}: {
  packetText: string;
  copied: boolean;
  onCopy: () => void;
  topPapers: Paper[];
  supervisorQuestions: string[];
  verdict: string;
  nextAction: string;
  risks: GapDimension[];
}) {
  return (
    <section className="surface-card p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-accent-base font-semibold">
            Supervisor-ready approval packet
          </p>
          <h3 className="mt-1 text-xl font-semibold text-text-primary">
            What to show your supervisor
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-text-secondary">
            A compact approval draft: verdict, next move, risks, evidence, and
            questions.
          </p>
        </div>
        <button
          type="button"
          onClick={onCopy}
          className="min-h-[44px] rounded-xl bg-accent-base px-4 text-sm font-semibold text-white shadow-lg shadow-accent-base/15 hover:bg-accent-hover"
        >
          {copied ? 'Copied' : 'Copy approval packet'}
        </button>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-[1.1fr_1fr]">
        <div className="rounded-xl border border-border-subtle bg-bg-secondary/70 p-4">
          <p className="text-xs uppercase tracking-wide text-text-tertiary">
            Decision
          </p>
          <p className="mt-2 text-lg font-semibold text-text-primary">
            {verdict}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-text-secondary">
            {nextAction}
          </p>
        </div>
        <div className="rounded-xl border border-border-subtle bg-bg-secondary/70 p-4">
          <p className="text-xs uppercase tracking-wide text-text-tertiary">
            Clarify first
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {risks.slice(0, 3).map((gap) => (
              <span
                key={gap.dimension}
                className="rounded-lg border border-border-subtle bg-bg-tertiary px-3 py-1.5 text-xs capitalize text-text-secondary"
              >
                {gap.dimension}: {saturationImpact(gap.saturation)}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border-subtle bg-bg-secondary/70 p-4">
          <p className="text-xs uppercase tracking-wide text-text-tertiary">
            Read first
          </p>
          <div className="mt-3 space-y-2">
            {topPapers.map((paper, index) => (
              <div key={paper.id} className="text-sm text-text-secondary">
                <span className="text-text-primary">#{index + 1}</span>{' '}
                {paper.title}
                <span className="block text-xs text-text-tertiary">
                  {paper.venue || getSourceDisplayName(paper.source)}{' '}
                  {paper.year ? `- ${paper.year}` : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-border-subtle bg-bg-secondary/70 p-4">
          <p className="text-xs uppercase tracking-wide text-text-tertiary">
            Ask supervisor
          </p>
          <ul className="mt-3 space-y-2">
            {supervisorQuestions.map((question) => (
              <li key={question} className="text-sm text-text-secondary">
                {question}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <details className="mt-4 rounded-xl border border-border-subtle bg-bg-secondary/50 p-4">
        <summary className="cursor-pointer text-sm font-medium text-text-primary">
          Show full copy text
        </summary>
        <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-relaxed text-text-secondary">
          {packetText}
        </pre>
      </details>
    </section>
  );
}

function SearchDiagnosticsPanel({
  diagnostics,
  papers,
  queries,
  geographyTop10,
}: {
  diagnostics: SearchFacetDiagnostics;
  papers: Paper[];
  queries?: string[];
  geographyTop10?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const generatedQueries =
    diagnostics.generatedQueries.length > 0
      ? diagnostics.generatedQueries
      : queries || [];
  const topPapers = papers.slice(0, 5);
  const strongFitCount = topPapers.filter(
    (paper) => paper.retrievalFit === 'strong'
  ).length;
  const contextFacetCount = topPapers.filter((paper) =>
    paper.matchedFacets?.some((facet) =>
      ['languageContext', 'geography'].includes(facet)
    )
  ).length;
  const contextExpected =
    diagnostics.languageContext.length > 0 || diagnostics.geography.length > 0;
  const contextWeak =
    contextExpected &&
    topPapers.length > 0 &&
    contextFacetCount < Math.ceil(topPapers.length / 2);
  const geographyWeak =
    diagnostics.geography.length > 0 &&
    geographyTop10 !== undefined &&
    geographyTop10 < 3;
  const warning =
    diagnostics.driftWarning ||
    (contextWeak
      ? 'Top papers match the broad topic, but too few preserve the language or geography context.'
      : geographyWeak
        ? 'Only a small share of top papers preserve the detected geography. Treat local novelty claims carefully.'
        : undefined);

  return (
    <section className="surface-card p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-accent-base font-semibold">
            Retrieval audit
          </p>
          <h3 className="mt-1 text-lg font-semibold text-text-primary">
            Did ResearchLens understand the idea?
          </h3>
          <p className="mt-1 text-sm text-text-secondary">
            This checks whether the search preserved problem, domain, language,
            method, intervention, and geography.
          </p>
        </div>
        <div className="grid min-w-[260px] grid-cols-2 gap-2">
          <div className="rounded-lg border border-border-subtle bg-bg-secondary p-3">
            <p className="text-[11px] uppercase tracking-wide text-text-tertiary">
              Strong top fits
            </p>
            <p className="mt-1 text-lg font-semibold text-text-primary">
              {strongFitCount}/{topPapers.length || 0}
            </p>
          </div>
          <div className="rounded-lg border border-border-subtle bg-bg-secondary p-3">
            <p className="text-[11px] uppercase tracking-wide text-text-tertiary">
              Context kept
            </p>
            <p className="mt-1 text-lg font-semibold text-text-primary">
              {contextFacetCount}/{topPapers.length || 0}
            </p>
          </div>
        </div>
      </div>

      {warning && (
        <div className="mt-4 rounded-lg border border-status-warning/30 bg-status-warning-bg px-3 py-2 text-xs text-status-warning">
          {warning}
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        {[
          ['Problem', diagnostics.problem],
          ['Domain', diagnostics.domain],
          ['Language', diagnostics.languageContext],
          ['Method', diagnostics.method],
          ['Intervention', diagnostics.intervention],
          ['Geography', diagnostics.geography],
        ].map(([label, values]) => (
          <div
            key={String(label)}
            className="rounded-lg border border-border-subtle bg-bg-secondary p-3"
          >
            <p className="text-[11px] uppercase tracking-wide text-text-tertiary">
              {String(label)}
            </p>
            <p className="mt-1 text-sm text-text-primary">
              {compactFacetList(values as string[])}
            </p>
          </div>
        ))}
      </div>

      {topPapers.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs uppercase tracking-wide text-text-tertiary">
            Why top papers ranked high
          </p>
          <div className="space-y-2">
            {topPapers.slice(0, 3).map((paper, index) => (
              <div
                key={paper.id}
                className="rounded-lg border border-border-subtle bg-bg-secondary p-3"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <p className="text-sm font-medium text-text-primary">
                    #{index + 1} {paper.title}
                  </p>
                  {paper.retrievalFit && (
                    <span className="w-fit rounded-md border border-border-subtle px-2 py-0.5 text-[11px] capitalize text-text-secondary">
                      {paper.retrievalFit} fit
                    </span>
                  )}
                </div>
                <p className="mt-2 text-xs text-text-secondary">
                  Matched:{' '}
                  {paper.matchedFacets && paper.matchedFacets.length > 0
                    ? paper.matchedFacets.map(facetLabel).join(', ')
                    : 'No explicit retrieval facets'}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {generatedQueries.length > 0 && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="min-h-[40px] text-xs text-accent-base hover:text-accent-hover"
          >
            {expanded
              ? 'Hide generated queries'
              : `Show ${generatedQueries.length} generated queries`}
          </button>
          {expanded && (
            <div className="mt-2 flex flex-wrap gap-1.5 animate-fade-in">
              {generatedQueries.map((query, index) => (
                <span
                  key={`${query}-${index}`}
                  className="rounded-md border border-border-subtle bg-bg-secondary px-2 py-1 text-xs text-text-secondary"
                >
                  {query}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function ToolPanel({
  activeTool,
  result,
  queries,
  topGaps,
  packetText,
  copied,
  onCopy,
  onExplorePivot,
  onExploreMindmapNode,
  workspaceRequestKey,
  onSelectTool,
}: {
  activeTool: ResultTool | null;
  result: AnalysisResult;
  queries?: string[];
  topGaps: GapDimension[];
  packetText: string;
  copied: boolean;
  onCopy: () => void;
  onExplorePivot?: (pivot: Pivot) => void;
  onExploreMindmapNode?: (
    node: ThesisMindmapNode,
    branch: ThesisMindmapBranch
  ) => void;
  workspaceRequestKey: number;
  onSelectTool: (tool: ResultTool) => void;
}) {
  if (!activeTool) return null;

  const renderMindmap = (initialTool: ResearchTool) =>
    result.thesisMindmap ? (
      <ThesisMindmapPanel
        mindmap={result.thesisMindmap}
        pivots={result.pivots}
        papers={result.topRelatedPapers}
        sanityMatrix={result.sanityMatrix}
        evidenceScopeDiagnostics={result.evidenceScopeDiagnostics}
        searchDiagnostics={result.searchDiagnostics}
        supervisorNote={result.supervisorNote}
        queries={queries}
        onExplorePivot={onExplorePivot}
        onExploreNode={onExploreMindmapNode}
        initialTool={initialTool}
        workspaceRequestKey={workspaceRequestKey}
      />
    ) : (
      <p className="surface-card p-5 text-sm text-text-secondary">
        This report does not include a mindmap yet.
      </p>
    );

  if (activeTool === 'canvas') return renderMindmap('notes');
  if (activeTool === 'copilot') return renderMindmap('notes');
  if (activeTool === 'lineage') return renderMindmap('lineage');

  if (activeTool === 'reader') {
    return (
      <div className="space-y-5">
        <SectionShell
          title="Paper Reader"
          helper="Open legal paper links, download available PDFs, or read open full text in ResearchLens."
        >
          <div className="grid grid-cols-1 gap-3">
            {result.topRelatedPapers.map((paper, index) => (
              <PaperCard key={paper.id} paper={paper} rank={index + 1} />
            ))}
          </div>
        </SectionShell>
      </div>
    );
  }

  if (activeTool === 'evidence') {
    return (
      <div className="space-y-5">
        {result.evidenceScopeDiagnostics && (
          <EvidenceScopePanel diagnostics={result.evidenceScopeDiagnostics} />
        )}

        <SectionShell
          title="Evidence Stream"
          helper="Papers most related to the idea. Similarity is relevance, not proof of duplication."
        >
          <div className="grid grid-cols-1 gap-3">
            {result.topRelatedPapers.map((paper, index) => (
              <PaperCard key={paper.id} paper={paper} rank={index + 1} />
            ))}
          </div>
        </SectionShell>

        <SectionShell
          title="Overlap Analysis"
          helper="How close the current idea appears to existing work."
        >
          <div className="surface-card p-5">
            <p className="text-sm leading-relaxed text-text-secondary">
              {result.overlapExplanation}
            </p>
          </div>
        </SectionShell>

        {result.journalTargeting && (
          <div className="surface-card p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-text-primary">
                  Publication targeting moved to Research Fit
                </p>
                <p className="mt-1 text-xs text-text-secondary">
                  Use Research Fit for journal, conference, and funding decisions.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onSelectTool('researchFit')}
                className="rounded-lg border border-accent-base/40 px-3 py-2 text-xs font-semibold text-accent-text hover:bg-accent-base/10"
              >
                Open Research Fit
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (activeTool === 'pivots') {
    return (
      <div className="space-y-5">
        <SectionShell
          title="Research Moves"
          helper="Pivots are alternate thesis directions that target gaps in the evidence."
        >
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {result.pivots.map((pivot, index) => (
              <PivotCard
                key={index}
                pivot={pivot}
                index={index}
                onExplorePivot={onExplorePivot}
              />
            ))}
          </div>
        </SectionShell>

        {((result.recommendedUseCases && result.recommendedUseCases.length > 0) ||
          (result.nextActions && result.nextActions.length > 0) ||
          (result.limitations && result.limitations.length > 0)) && (
          <SectionShell title="Use Cases and Next Steps">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {result.recommendedUseCases && result.recommendedUseCases.length > 0 && (
                <div className="surface-card p-5">
                  <p className="mb-3 text-xs uppercase tracking-wide text-accent-base font-semibold">
                    Use cases
                  </p>
                  <div className="space-y-3">
                    {result.recommendedUseCases.map((useCase) => (
                      <div key={useCase.title}>
                        <p className="text-sm font-medium text-text-primary">
                          {useCase.title}
                        </p>
                        <p className="mt-1 text-xs text-text-secondary">
                          {useCase.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {result.nextActions && result.nextActions.length > 0 && (
                <div className="surface-card p-5">
                  <p className="mb-3 text-xs uppercase tracking-wide text-accent-base font-semibold">
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
                  <p className="mb-3 text-xs uppercase tracking-wide text-accent-base font-semibold">
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
          </SectionShell>
        )}

        {result.fundingFit && (
          <div className="surface-card p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-text-primary">
                  Funding fit moved to Research Fit
                </p>
                <p className="mt-1 text-xs text-text-secondary">
                  Use Research Fit for grant readiness, aims, abstracts, and publication route.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onSelectTool('researchFit')}
                className="rounded-lg border border-accent-base/40 px-3 py-2 text-xs font-semibold text-accent-text hover:bg-accent-base/10"
              >
                Open Research Fit
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (activeTool === 'researchFit') {
    return <ResearchFitPanel result={result} />;
  }

  if (activeTool === 'diagnostics') {
    return (
      <div className="space-y-5">
        {result.searchDiagnostics && (
          <SearchDiagnosticsPanel
            diagnostics={result.searchDiagnostics}
            papers={result.topRelatedPapers}
            queries={queries}
            geographyTop10={result.evidenceScopeDiagnostics?.top10LocalMatches}
          />
        )}

        {result.sanityMatrix && (
          <SectionShell
            title="Sanity Scores"
            helper="Quality-control checks. These are advisory, not proof."
          >
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
              <MetricCard
                label="Novelty"
                value={scoreValue(result.sanityMatrix.noveltyPotential)}
                caption={scoreLevel(result.sanityMatrix.noveltyPotential.score)}
                helper={result.sanityMatrix.noveltyPotential.rationale}
              />
              <MetricCard
                label="Evidence"
                value={scoreValue(result.sanityMatrix.evidenceStrength)}
                caption={scoreLevel(result.sanityMatrix.evidenceStrength.score)}
                helper={result.sanityMatrix.evidenceStrength.rationale}
              />
              <MetricCard
                label="Feasibility"
                value={scoreValue(result.sanityMatrix.feasibility)}
                caption={scoreLevel(result.sanityMatrix.feasibility.score)}
                helper={result.sanityMatrix.feasibility.rationale}
              />
              <MetricCard
                label="Supervisor"
                value={scoreValue(result.sanityMatrix.supervisorFit)}
                caption={scoreLevel(result.sanityMatrix.supervisorFit.score)}
                helper={result.sanityMatrix.supervisorFit.rationale}
              />
              <MetricCard
                label="Risk"
                value={scoreValue(result.sanityMatrix.claimRisk)}
                caption={scoreLevel(result.sanityMatrix.claimRisk.score, true)}
                helper={result.sanityMatrix.claimRisk.rationale}
              />
              <MetricCard
                label="Overall"
                value={(result.sanityMatrix.overallScore / 10).toFixed(1)}
                caption="Combined"
                helper="Weighted combined score after subtracting claim risk."
              />
            </div>
          </SectionShell>
        )}

        <SectionShell
          title="Key Gaps"
          helper="The gaps ResearchLens thinks matter most for thesis narrowing."
        >
          <div className="surface-card overflow-hidden">
            <div className="grid grid-cols-[1.1fr_1.5fr_0.7fr_0.8fr] gap-3 border-b border-border-subtle px-4 py-3 text-xs uppercase tracking-wide text-text-tertiary">
              <span>Gap</span>
              <span>Why it matters</span>
              <span>Impact</span>
              <span>Addressability</span>
            </div>
            {topGaps.map((gap) => (
              <div
                key={gap.dimension}
                className="grid grid-cols-1 gap-2 border-b border-border-subtle px-4 py-3 last:border-0 md:grid-cols-[1.1fr_1.5fr_0.7fr_0.8fr] md:gap-3"
              >
                <div>
                  <p className="text-sm font-medium capitalize text-text-primary">
                    {gap.dimension}
                  </p>
                  <p className="text-xs text-text-tertiary md:hidden">
                    {GAP_HELP[gap.dimension]}
                  </p>
                </div>
                <p className="text-sm text-text-secondary">
                  {gap.evidence || GAP_HELP[gap.dimension]}
                </p>
                <p className="text-sm text-text-primary">
                  {saturationImpact(gap.saturation)}
                </p>
                <p className="text-sm text-text-secondary">
                  {gap.saturation === 'open' ? 'High' : 'Medium'}
                </p>
              </div>
            ))}
          </div>
        </SectionShell>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <ApprovalPacketCard
        packetText={packetText}
        copied={copied}
        onCopy={onCopy}
        topPapers={result.topRelatedPapers.slice(0, 3)}
        supervisorQuestions={buildSupervisorQuestions(topGaps)}
        verdict={result.sanityMatrix?.verdict || `${result.noveltySignal} novelty signal`}
        nextAction={
          result.sanityMatrix?.recommendedActions?.[0] ||
          result.nextActions?.[0] ||
          'Narrow the idea into a clearer method, population, or context.'
        }
        risks={topGaps}
      />

      {result.supervisorNote && (
        <SectionShell title="Supervisor Note">
          <div className="surface-card p-5">
            <p className="text-sm italic leading-relaxed text-text-primary">
              {result.supervisorNote}
            </p>
          </div>
        </SectionShell>
      )}

      {result.facultyMatches && result.facultyMatches.length > 0 && (
        <SectionShell title="Potential Supervisors / Researchers">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {result.facultyMatches.slice(0, 6).map((faculty) => (
              <FacultyCard
                key={faculty.openAlexAuthorId || faculty.id}
                faculty={faculty}
                reportId={result.savedReportId || null}
              />
            ))}
          </div>
        </SectionShell>
      )}

      <SectionShell title="Sources and Technical Details">
        <div className="surface-card p-5">
          <div className="mb-4 flex flex-wrap gap-4">
            {Object.entries(result.sourceCounts).map(([source, count]) => (
              <div key={source} className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-accent-base" />
                <span className="text-xs font-medium text-text-primary">
                  {getSourceDisplayName(source)}:
                </span>
                <span className="text-xs text-text-secondary">
                  {count} results
                </span>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-status-success" />
              <span className="text-xs font-medium text-text-primary">
                Total:
              </span>
              <span className="text-xs text-text-secondary">
                {result.totalPapersRetrieved} unique papers
              </span>
            </div>
          </div>
          {queries && queries.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {queries.map((query, index) => (
                <span
                  key={`${query}-${index}`}
                  className="rounded-md border border-border-subtle bg-bg-secondary px-2 py-1 text-xs text-text-secondary"
                >
                  {query}
                </span>
              ))}
            </div>
          )}
          <p className="mt-4 border-t border-border-subtle pt-3 text-xs text-text-tertiary">
            ResearchLens estimates novelty risk using open academic APIs. It does
            not claim complete global coverage. Use results as a starting point
            for further investigation.
          </p>
        </div>
      </SectionShell>
    </div>
  );
}

function buildSupervisorQuestions(topGaps: GapDimension[]): string[] {
  const primaryGap = topGaps[0]?.dimension || 'scope';
  const secondGap = topGaps[1]?.dimension || 'method';
  return [
    `Should I narrow the ${primaryGap} before submitting this as my thesis direction?`,
    `Which ${secondGap} choice would make this more feasible for my level and timeline?`,
    'Which 2-3 papers should I read before finalizing the proposal?',
  ];
}

function buildApprovalPacket({
  result,
  topAction,
  keyReasons,
  topGaps,
}: {
  result: AnalysisResult;
  topAction: string;
  keyReasons: string[];
  topGaps: GapDimension[];
}): string {
  const title =
    result.thesisMindmap?.center ||
    result.studentSummary?.split('.').find(Boolean) ||
    'Current thesis direction';
  const topPapers = result.topRelatedPapers
    .slice(0, 3)
    .map(
      (paper, index) =>
        `${index + 1}. ${paper.title}${paper.year ? ` (${paper.year})` : ''}`
    )
    .join('\n');
  const risks = topGaps
    .slice(0, 3)
    .map((gap) => `- ${gap.dimension}: ${gap.evidence || GAP_HELP[gap.dimension]}`)
    .join('\n');
  const reasons = keyReasons.map((reason) => `- ${reason}`).join('\n');
  const questions = buildSupervisorQuestions(topGaps)
    .map((question) => `- ${question}`)
    .join('\n');

  return [
    `Proposed thesis direction: ${title}`,
    '',
    `ResearchLens verdict: ${
      result.sanityMatrix?.verdict || `${result.noveltySignal} novelty signal`
    }`,
    '',
    `Recommended next step: ${topAction}`,
    '',
    'Why this direction is worth discussing:',
    reasons || '- ResearchLens found enough evidence to begin a supervisor discussion.',
    '',
    'Main risks or gaps to clarify:',
    risks || '- Scope, method, population, or geography still needs review.',
    '',
    'Top papers to read first:',
    topPapers || 'No top papers available yet.',
    '',
    'Questions for supervisor:',
    questions,
  ].join('\n');
}

export default function ResultsPanel({
  result,
  queries,
  onExplorePivot,
  onExploreMindmapNode,
}: ResultsPanelProps) {
  const [activeTool, setActiveTool] = useState<ResultTool | null>(null);
  const [copied, setCopied] = useState(false);
  const [dismissedTutorials, setDismissedTutorials] = useState<Set<ResultTool>>(
    () => {
      if (typeof window === 'undefined') return new Set();
      try {
        const dismissed = window.localStorage.getItem(
          'researchlens_dismissed_tutorials'
        );
        return dismissed
          ? new Set(JSON.parse(dismissed) as ResultTool[])
          : new Set();
      } catch {
        return new Set();
      }
    }
  );
  const [densityLevel, setDensityLevel] = useState<DensityLevel>(() => {
    if (typeof window === 'undefined') return 'beginner';
    try {
      const density = window.localStorage.getItem(
        'researchlens_ui_density'
      ) as DensityLevel | null;
      return density && ['beginner', 'guided', 'advanced'].includes(density)
        ? density
        : 'beginner';
    } catch {
      return 'beginner';
    }
  });
  const [workspaceRequestKey, setWorkspaceRequestKey] = useState(0);

  const sourceCount = Object.values(result.sourceCounts).filter((count) => count > 0).length;
  const sanity = result.sanityMatrix;
  const topAction =
    sanity?.recommendedActions?.[0] ||
    result.nextActions?.[0] ||
    'Narrow the idea into a clearer method, population, or context.';
  const keyReasons = useMemo(
    () =>
      sanity?.reasons?.slice(0, 5) ||
      result.credibilityReasons?.slice(0, 5) ||
      [],
    [result.credibilityReasons, sanity?.reasons]
  );
  const topGaps = useMemo(
    () =>
      [...result.gapMatrix].sort((a, b) => {
        const order = { crowded: 0, moderate: 1, open: 2 };
        return order[a.saturation] - order[b.saturation];
      }),
    [result.gapMatrix]
  );
  const packetText = useMemo(
    () => buildApprovalPacket({ result, topAction, keyReasons, topGaps }),
    [result, topAction, keyReasons, topGaps]
  );
  const selectedTool = activeTool
    ? TOOL_CONFIG.find((tool) => tool.id === activeTool)
    : undefined;

  const persistDismissedTutorials = (next: Set<ResultTool>) => {
    setDismissedTutorials(next);
    try {
      localStorage.setItem(
        'researchlens_dismissed_tutorials',
        JSON.stringify([...next])
      );
    } catch {
      // Optional UI state.
    }
  };

  const recordToolUsage = (tool: ResultTool) => {
    try {
      const stored = localStorage.getItem('researchlens_tool_usage');
      const usage = stored ? (JSON.parse(stored) as Record<string, number>) : {};
      const next = { ...usage, [tool]: (usage[tool] || 0) + 1 };
      localStorage.setItem('researchlens_tool_usage', JSON.stringify(next));
      const meaningfulActions = ['evidence', 'copilot', 'lineage', 'diagnostics', 'canvas'].filter(
        (id) => next[id] && next[id] > 0
      ).length;
      const nextDensity: DensityLevel =
        meaningfulActions >= 4 ? 'advanced' : meaningfulActions >= 2 ? 'guided' : 'beginner';
      setDensityLevel(nextDensity);
      localStorage.setItem('researchlens_ui_density', nextDensity);
    } catch {
      // Optional UI state.
    }
  };

  const selectTool = (tool: ResultTool) => {
    setActiveTool((current) => (current === tool ? null : tool));
    recordToolUsage(tool);
    if (tool === 'copilot' || tool === 'lineage') {
      setWorkspaceRequestKey((current) => current + 1);
    }
    window.requestAnimationFrame(() => {
      document.getElementById('researchlens-tool-panel')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  };

  const handleCopyPacket = async () => {
    try {
      await navigator.clipboard.writeText(packetText);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = packetText;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const dismissTutorial = (tool: ResultTool) => {
    const next = new Set(dismissedTutorials);
    next.add(tool);
    persistDismissedTutorials(next);
  };

  return (
    <div className="animate-fade-in space-y-5">
      <section className="surface-card p-5">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_520px] xl:items-center">
          <div>
            <p className="text-xs uppercase tracking-wide text-accent-base font-semibold">
              Decision hub
            </p>
            <h3 className="mt-2 text-2xl font-semibold text-text-primary">
              {sanity?.verdict || `${result.noveltySignal} novelty signal`}
            </h3>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-text-secondary">
              {topAction}
            </p>
            <p className="mt-3 text-xs text-text-tertiary">
              Based on {result.totalPapersRetrieved} papers from {sourceCount}{' '}
              academic source{sourceCount === 1 ? '' : 's'}.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <MetricCard
              label="Novelty"
              value={scoreValue(sanity?.noveltyPotential)}
              caption={scoreLevel(sanity?.noveltyPotential?.score)}
              helper="Higher means the idea has more room to become distinct from existing work."
              tone={metricTone(sanity?.noveltyPotential?.score)}
            />
            <MetricCard
              label="Evidence"
              value={scoreValue(sanity?.evidenceStrength)}
              caption={scoreLevel(sanity?.evidenceStrength?.score)}
              helper="Higher means retrieved papers give stronger support for this assessment."
              tone={metricTone(sanity?.evidenceStrength?.score)}
            />
            <MetricCard
              label="Risk"
              value={scoreValue(sanity?.claimRisk)}
              caption={scoreLevel(sanity?.claimRisk?.score, true)}
              helper="Higher means the novelty claim needs more caution or narrowing."
              tone={metricTone(sanity?.claimRisk?.score, true)}
            />
          </div>
        </div>
      </section>

      <div className="space-y-5">
        <main className="min-w-0 space-y-5">
          <ApprovalPacketCard
            packetText={packetText}
            copied={copied}
            onCopy={handleCopyPacket}
            topPapers={result.topRelatedPapers.slice(0, 3)}
            supervisorQuestions={buildSupervisorQuestions(topGaps)}
            verdict={sanity?.verdict || `${result.noveltySignal} novelty signal`}
            nextAction={topAction}
            risks={topGaps}
          />

          <ToolDock
            activeTool={activeTool}
            onSelectTool={selectTool}
            density={densityLevel}
          />

          <BeginnerPathCard />

          {selectedTool && !dismissedTutorials.has(selectedTool.id) && (
            <MicroDemoCard
              tool={selectedTool}
              onDismiss={() => dismissTutorial(selectedTool.id)}
            />
          )}

          <div id="researchlens-tool-panel" className="space-y-5">
            <ToolPanel
              activeTool={activeTool}
              result={result}
              queries={queries}
              topGaps={topGaps}
              packetText={packetText}
              copied={copied}
              onCopy={handleCopyPacket}
              onExplorePivot={onExplorePivot}
              onExploreMindmapNode={onExploreMindmapNode}
              workspaceRequestKey={workspaceRequestKey}
              onSelectTool={selectTool}
            />
          </div>
        </main>
      </div>
    </div>
  );
}
