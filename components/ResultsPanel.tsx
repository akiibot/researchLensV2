'use client';

import React, { useMemo, useState } from 'react';
import {
  AnalysisResult,
  AppMode,
  GapDimension,
  Pivot,
  Paper,
  SearchFacetDiagnostics,
  ThesisMindmapBranch,
  ThesisMindmapNode,
} from '@/lib/types';
import { copyToClipboard } from '@/lib/clipboard';
import { getColorClasses } from './ConfidenceBadge';
import EvidenceScopePanel from './EvidenceScopePanel';
import FacultyCard from './FacultyCard';
import GapMatrix from './GapMatrix';
import PaperCard from './PaperCard';
import PivotCard from './PivotCard';
import ResearchFitPanel from './ResearchFitPanel';
import ResearchSanityPanel from './ResearchSanityPanel';
import ThesisMindmapPanel from './ThesisMindmapPanel';

interface ResultsPanelProps {
  result: AnalysisResult;
  queries?: string[];
  mode?: AppMode;
  onRefine?: () => void;
  onExplorePivot?: (pivot: Pivot) => void;
  onExploreMindmapNode?: (
    node: ThesisMindmapNode,
    branch: ThesisMindmapBranch
  ) => void;
}

type ResultTool =
  | 'report'
  | 'canvas'
  | 'evidence'
  | 'pivots'
  | 'researchFit'
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
    id: 'report',
    label: 'Report',
    shortLabel: 'Report',
    icon: 'Report',
    purpose: 'See the verdict, key signals, and the supervisor-ready packet.',
    action: 'Start here for the overall decision and a copyable summary.',
  },
  {
    id: 'canvas',
    label: 'Canvas',
    shortLabel: 'Canvas',
    icon: 'Canvas',
    purpose: 'Organize the thesis, read papers, ask Copilot, and trace lineage — all in one workspace.',
    action: 'Open the visual map to organize topic, method, risks, and pivots. Includes the paper reader, Copilot chat, and lineage graph.',
  },
  {
    id: 'evidence',
    label: 'Evidence',
    shortLabel: 'Evidence',
    icon: 'Evidence',
    purpose: 'Check the papers behind the verdict.',
    action: 'Use this before making strong novelty claims.',
  },
  {
    id: 'pivots',
    label: 'Pivots',
    shortLabel: 'Pivot',
    icon: 'Pivot',
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
    id: 'export',
    label: 'Export',
    shortLabel: 'Export',
    icon: 'Export',
    purpose: 'Copy supervisor-ready notes and report assets.',
    action: 'Use this when you are ready to send or save the topic direction.',
  },
];

function getSourceDisplayName(source: string): string {
  return SOURCE_NAMES[source] || source;
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

function DecisionSignalCell({
  label,
  value,
  type,
}: {
  label: string;
  value: string;
  type: 'risk' | 'confidence' | 'novelty';
}) {
  const colors = getColorClasses(type, value);
  return (
    <div className={`${colors.bg} p-4`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
        {label}
      </p>
      <p className={`mt-2 text-2xl font-bold uppercase tracking-wide ${colors.text}`}>
        {value}
      </p>
    </div>
  );
}

function ToolIcon({ icon }: { icon: string }) {
  const className = 'h-5 w-5 text-white';

  if (icon === 'Regenerate') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 12a9 9 0 0 1 15.2-6.5" />
        <path d="M18 2v4h-4" />
        <path d="M21 12a9 9 0 0 1-15.2 6.5" />
        <path d="M6 22v-4h4" />
      </svg>
    );
  }

  if (icon === 'Report') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M7 3h7.8L20 8.2V18a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3Zm7 1.8V9h4.2L14 4.8ZM8 12.2a1 1 0 1 0 0 2h8a1 1 0 1 0 0-2H8Zm0 4a1 1 0 1 0 0 2h5.5a1 1 0 1 0 0-2H8Z" />
      </svg>
    );
  }

  if (icon === 'Canvas') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <rect x="3" y="6" width="18" height="12" rx="3" />
        <rect x="6" y="9" width="3" height="2" rx=".7" fill="#17132b" />
        <rect x="10.5" y="9" width="7.5" height="2" rx=".7" fill="#17132b" />
        <rect x="6" y="13" width="12" height="2" rx=".7" fill="#17132b" />
      </svg>
    );
  }

  if (icon === 'Evidence') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="10" cy="10" r="5.5" fill="currentColor" stroke="none" />
        <path d="m14.5 14.5 5 5" />
      </svg>
    );
  }

  if (icon === 'Pivot') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 3a7 7 0 0 0-4 12.74V19a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-3.26A7 7 0 0 0 12 3Z" />
      </svg>
    );
  }

  if (icon === 'Fit') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <rect x="4" y="4" width="16" height="16" rx="4" />
        <rect x="7" y="13" width="2.4" height="4" rx="1" fill="#17132b" />
        <rect x="10.8" y="9" width="2.4" height="8" rx="1" fill="#17132b" />
        <rect x="14.6" y="6.5" width="2.4" height="10.5" rx="1" fill="#17132b" />
      </svg>
    );
  }

  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 4v6H4" />
      <path d="M16 20v-6h4" />
      <path d="M4 10a8 8 0 0 1 14-4" />
      <path d="M20 14a8 8 0 0 1-14 4" />
    </svg>
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
  onRefine,
  density,
}: {
  activeTool: ResultTool | null;
  onSelectTool: (tool: ResultTool) => void;
  onRefine?: () => void;
  density: DensityLevel;
}) {
  return (
    <section className="group/rail relative z-30 w-full lg:fixed lg:left-0 lg:top-0 lg:z-[70] lg:h-dvh lg:w-[68px]">
      <div className="overflow-hidden rounded-3xl border border-border-subtle bg-bg-secondary p-3 shadow-2xl shadow-black/20 transition-all duration-300 ease-out lg:h-dvh lg:w-[68px] lg:rounded-l-none lg:rounded-r-[28px] lg:border-l-0 lg:hover:w-[220px]">
        <div className="mb-7 flex min-w-[190px] items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#493f82] text-3xl font-black leading-none text-white">
            <span className="-mt-1 font-serif">r</span>
          </div>
          <div className="overflow-hidden whitespace-nowrap opacity-0 transition-opacity duration-200 group-hover/rail:opacity-100">
            <p className="text-base font-medium text-white">
              Research <span className="text-[#8878ff]">Lens</span>
            </p>
            <p className="sr-only text-xs capitalize text-text-tertiary">{density} view</p>
          </div>
        </div>

        {onRefine && (
          <button
            type="button"
            onClick={onRefine}
            className="mb-2 flex min-h-[44px] min-w-[190px] items-center gap-4 rounded-xl px-2 text-left text-text-secondary transition-colors hover:bg-accent-muted hover:text-white"
            title="Re-Generate"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center">
              <ToolIcon icon="Regenerate" />
            </span>
            <span className="whitespace-nowrap text-sm opacity-0 transition-opacity duration-200 group-hover/rail:opacity-100">
              Re-Generate
            </span>
          </button>
        )}

        <nav className="flex gap-2 overflow-x-auto lg:min-w-[190px] lg:flex-col lg:overflow-visible">
        {TOOL_CONFIG.map((tool) => (
          <button
            key={tool.id}
            type="button"
            onClick={() => onSelectTool(tool.id)}
            title={tool.purpose}
            aria-current={activeTool === tool.id ? 'true' : undefined}
            className={`flex min-h-[44px] shrink-0 items-center gap-4 rounded-none px-2 text-left transition-colors lg:w-full ${
              activeTool === tool.id
                ? 'bg-accent-muted text-white'
                : 'text-text-secondary hover:bg-accent-muted hover:text-white'
            }`}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center">
              <ToolIcon icon={tool.icon} />
            </span>
            <span className="whitespace-nowrap text-sm opacity-0 transition-opacity duration-200 group-hover/rail:opacity-100">
              {tool.shortLabel}
            </span>
          </button>
        ))}
      </nav>
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
  mode,
}: {
  packetText: string;
  copied: boolean;
  onCopy: () => void;
  topPapers: Paper[];
  supervisorQuestions: string[];
  verdict: string;
  nextAction: string;
  risks: GapDimension[];
  mode?: AppMode;
}) {
  const isFaculty = mode === 'faculty';
  return (
    <section className="surface-card p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-accent-base font-semibold">
            {isFaculty ? 'Evidence-based review packet' : 'Supervisor-ready approval packet'}
          </p>
          <h3 className="mt-1 text-xl font-semibold text-text-primary">
            {isFaculty ? 'Formal summary for review' : 'What to show your supervisor'}
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-text-secondary">
            {isFaculty
              ? 'A concise, evidence-first packet: verdict, risks, and supporting papers.'
              : 'A compact approval draft: verdict, next move, risks, evidence, and questions.'}
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
            {isFaculty ? 'Follow-up questions' : 'Ask supervisor'}
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
  mode,
  packetText,
  copied,
  onCopyPacket,
  topAction,
  onExplorePivot,
  onExploreMindmapNode,
  onSelectTool,
}: {
  activeTool: ResultTool | null;
  result: AnalysisResult;
  queries?: string[];
  topGaps: GapDimension[];
  mode?: AppMode;
  packetText: string;
  copied: boolean;
  onCopyPacket: () => void;
  topAction: string;
  onExplorePivot?: (pivot: Pivot) => void;
  onExploreMindmapNode?: (
    node: ThesisMindmapNode,
    branch: ThesisMindmapBranch
  ) => void;
  onSelectTool: (tool: ResultTool) => void;
}) {
  if (!activeTool) return null;

  const sanity = result.sanityMatrix;
  const sourceCount = Object.values(result.sourceCounts).filter((count) => count > 0).length;

  if (activeTool === 'report') {
    return (
      <div className="space-y-5">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-status-success" />
            <span className="text-xs font-medium uppercase tracking-wide text-status-success">
              Analysis Complete
            </span>
          </div>
          <h2 className="mb-2 text-2xl font-bold text-text-primary sm:text-3xl">
            Your Research Gap Report
          </h2>
          <p className="text-sm text-text-tertiary">
            Based on {result.totalPapersRetrieved} real papers from {sourceCount} academic
            source{sourceCount === 1 ? '' : 's'}
          </p>
        </div>

        <section className="surface-card p-5">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_520px] xl:items-center">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-xs uppercase tracking-wide text-accent-base font-semibold">
                  Decision hub
                </p>
                {mode && (
                  <span className="rounded-full border border-border-subtle bg-bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-text-secondary">
                    {mode === 'faculty' ? 'Faculty workflow' : 'Student workflow'}
                  </span>
                )}
              </div>
              <h3 className="mt-2 text-2xl font-semibold text-text-primary">
                {sanity?.verdict || `${result.noveltySignal} novelty signal`}
              </h3>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-text-secondary">
                {topAction}
              </p>
              {(mode === 'faculty' ? result.facultySummary : result.studentSummary) && (
                <p className="mt-3 max-w-3xl text-sm leading-relaxed text-text-primary">
                  {mode === 'faculty' ? result.facultySummary : result.studentSummary}
                </p>
              )}
              <p className="mt-3 text-xs text-text-tertiary">
                Based on {result.totalPapersRetrieved} papers from {sourceCount}{' '}
                academic source{sourceCount === 1 ? '' : 's'}.
              </p>
            </div>
            <div className="grid grid-cols-1 divide-y divide-border-subtle overflow-hidden rounded-xl border border-border-subtle sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              <DecisionSignalCell label="Overlap Risk" value={result.overlapRisk} type="risk" />
              <DecisionSignalCell
                label="Evidence Confidence"
                value={result.evidenceConfidence}
                type="confidence"
              />
              <DecisionSignalCell
                label="Novelty Signal"
                value={result.noveltySignal}
                type="novelty"
              />
            </div>
          </div>
        </section>

        {result.sanityMatrix && <ResearchSanityPanel matrix={result.sanityMatrix} />}

        <SectionShell
          title="Key Gaps"
          helper="The gaps ResearchLens thinks matter most for thesis narrowing. Click a gap to see the supporting evidence."
        >
          <GapMatrix gaps={topGaps} />
        </SectionShell>
      </div>
    );
  }

  if (activeTool === 'canvas') {
    return result.thesisMindmap ? (
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
        initialTool="notes"
      />
    ) : (
      <p className="surface-card p-5 text-sm text-text-secondary">
        This report does not include a mindmap yet.
      </p>
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

        {result.sanityMatrix && <ResearchSanityPanel matrix={result.sanityMatrix} />}

        <SectionShell
          title="Key Gaps"
          helper="The gaps ResearchLens thinks matter most for thesis narrowing. Click a gap to see the supporting evidence."
        >
          <GapMatrix gaps={topGaps} />
        </SectionShell>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <ApprovalPacketCard
        packetText={packetText}
        copied={copied}
        onCopy={onCopyPacket}
        topPapers={result.topRelatedPapers.slice(0, 3)}
        supervisorQuestions={buildSupervisorQuestions(topGaps)}
        verdict={sanity?.verdict || `${result.noveltySignal} novelty signal`}
        nextAction={topAction}
        risks={topGaps}
        mode={mode}
      />

      {result.supervisorNote && (
        <SectionShell title={mode === 'faculty' ? 'Reviewer Note' : 'Supervisor Note'}>
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
  mode,
  onRefine,
  onExplorePivot,
  onExploreMindmapNode,
}: ResultsPanelProps) {
  // Default to the Report tab (verdict, decision signals, approval packet)
  // rather than a blank state, so it's the first thing a user sees.
  const [activeTool, setActiveTool] = useState<ResultTool | null>('report');
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
      const meaningfulActions = [
        'evidence',
        'diagnostics',
        'canvas',
        'pivots',
        'researchFit',
      ].filter((id) => next[id] && next[id] > 0).length;
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
    window.requestAnimationFrame(() => {
      document.getElementById('researchlens-tool-panel')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  };

  const handleCopyPacket = async () => {
    await copyToClipboard(packetText);
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
      {result.demoData && (
        <div
          role="alert"
          className="rounded-lg border border-amber-400/60 bg-amber-400/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200"
        >
          <span className="font-semibold">Demo data.</span> This report was generated from a
          static sample paper set, not a live search of your actual idea. Results below are for
          demonstration only.
        </div>
      )}
      {result.storageTruncated && (
        <div
          role="alert"
          className="rounded-lg border border-amber-400/60 bg-amber-400/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200"
        >
          <span className="font-semibold">Report partially trimmed.</span> This report was too
          large to store in full — the interactive research map was dropped to fit. Everything
          else below is complete.
        </div>
      )}
      {result.analysisDegraded && !result.demoData && (
        <div
          role="alert"
          className="rounded-lg border border-amber-400/60 bg-amber-400/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200"
        >
          <span className="font-semibold">AI analysis unavailable.</span> The papers below were
          retrieved and ranked normally, but the summaries, pivots, and funding-fit sections use a
          generic fallback template rather than a tailored AI-generated analysis.
        </div>
      )}
      <div className="grid gap-5 lg:block lg:pl-[236px]">
        <ToolDock
          activeTool={activeTool}
          onSelectTool={selectTool}
          onRefine={onRefine}
          density={densityLevel}
        />

        <main className="min-w-0 space-y-5">
          {densityLevel !== 'advanced' && <BeginnerPathCard />}

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
              mode={mode}
              packetText={packetText}
              copied={copied}
              onCopyPacket={handleCopyPacket}
              topAction={topAction}
              onExplorePivot={onExplorePivot}
              onExploreMindmapNode={onExploreMindmapNode}
              onSelectTool={selectTool}
            />
          </div>
        </main>
      </div>
    </div>
  );
}
