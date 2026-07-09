'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  EvidenceScopeDiagnostics,
  EvidenceLineageGraph,
  EvidenceLineageNode,
  Paper,
  PaperFullTextResult,
  Pivot,
  ResearchSanityMatrix,
  SearchFacetDiagnostics,
  ThesisMindmap,
  ThesisMindmapBranch,
  ThesisMindmapNode,
  ThesisMindmapNodeStatus,
} from '@/lib/types';
import { accessLabel, accessTone, canReadPaper } from '@/lib/paperAccessLabels';
import ThesisMindmapFlow from './ThesisMindmapFlow';
import PaperLineageFlow from './PaperLineageFlow';

interface ThesisMindmapPanelProps {
  mindmap: ThesisMindmap;
  pivots: Pivot[];
  papers?: Paper[];
  sanityMatrix?: ResearchSanityMatrix;
  evidenceScopeDiagnostics?: EvidenceScopeDiagnostics;
  searchDiagnostics?: SearchFacetDiagnostics;
  supervisorNote?: string;
  queries?: string[];
  onExplorePivot?: (pivot: Pivot) => void;
  onExploreNode?: (node: ThesisMindmapNode, branch: ThesisMindmapBranch) => void;
  initialTool?: ResearchTool;
  workspaceRequestKey?: number;
}

type Selection =
  | { type: 'center' }
  | { type: 'branch'; branchId: string }
  | { type: 'node'; branchId: string; nodeId: string };

export type ResearchTool =
  | 'notes'
  | 'publications'
  | 'lineage'
  | 'studyGuides'
  | 'methodologies'
  | 'assets';
type ChatMessage = { role: 'user' | 'assistant'; content: string };
type CanvasMode = 'mindmap' | 'lineage';

const RESEARCH_TOOLS: Array<{
  id: ResearchTool;
  label: string;
  icon: string;
}> = [
  { id: 'notes', label: 'Notes', icon: '□' },
  { id: 'publications', label: 'Publications', icon: '▤' },
  { id: 'lineage', label: 'Lineage', icon: 'L' },
  { id: 'studyGuides', label: 'Study Guides', icon: '◇' },
  { id: 'methodologies', label: 'Methodologies', icon: '△' },
  { id: 'assets', label: 'Assets', icon: '▱' },
];

const STATUS_STYLES: Record<ThesisMindmapNodeStatus, string> = {
  crowded: 'bg-status-error-bg text-status-error border-status-error/30',
  moderate: 'bg-status-warning-bg text-status-warning border-status-warning/30',
  open: 'bg-status-success-bg text-status-success border-status-success/30',
  strong: 'bg-status-success-bg text-status-success border-status-success/30',
  weak: 'bg-status-error-bg text-status-error border-status-error/30',
  risk: 'bg-status-error-bg text-status-error border-status-error/30',
  neutral: 'bg-bg-tertiary text-text-secondary border-border-subtle',
};

function formatStatus(status: ThesisMindmapNodeStatus): string {
  return status.replace('_', ' ');
}

function paperScore(paper: Paper): number {
  return paper.similarityScore ?? Math.min(1, paper.citationCount / 250);
}

function selectedPaperSet(
  papers: Paper[],
  selectedNode: { branch: ThesisMindmapBranch; node: ThesisMindmapNode } | null
) {
  if (!selectedNode?.node.supportingPaperIds?.length) return papers.slice(0, 6);
  const ids = new Set(selectedNode.node.supportingPaperIds);
  const matched = papers.filter((paper) => ids.has(paper.id));
  return matched.length > 0 ? matched.slice(0, 6) : papers.slice(0, 6);
}

function lineagePaperKey(paper: Paper) {
  return (
    paper.doi ||
    paper.openAlexId ||
    paper.semanticScholarId ||
    paper.externalIds?.openalex ||
    paper.externalIds?.semanticScholar ||
    paper.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 120)
  );
}

function buildLineageDefense(graph: EvidenceLineageGraph | null, thesisIdea: string) {
  if (!graph) return '';
  const byRole = (role: EvidenceLineageNode['role']) =>
    graph.nodes
      .filter((node) => node.role === role)
      .sort((a, b) => (b.threatScore || 0) - (a.threatScore || 0));
  const prior = byRole('foundational')[0]?.paper.title;
  const derivative = byRole('derivative')[0]?.paper.title;
  const threat = byRole('novelty_threat')[0]?.paper.title;
  const method = byRole('method_source')[0]?.paper.title;
  const pieces = [
    `ResearchLens started the lineage map from "${graph.originTitle}" to inspect where the thesis sits in the paper network.`,
    prior ? `A foundational paper to mention is "${prior}".` : null,
    derivative ? `A newer derivative work to compare against is "${derivative}".` : null,
    threat ? `The strongest novelty threat found is "${threat}".` : null,
    method ? `A useful method source is "${method}".` : null,
    `The defensible angle should keep the thesis focused on: ${thesisIdea}`,
  ].filter(Boolean);
  return pieces.join(' ');
}

function ResearchToolRail({
  activeTool,
  onToolChange,
  compact = false,
}: {
  activeTool: ResearchTool;
  onToolChange: (tool: ResearchTool) => void;
  compact?: boolean;
}) {
  return (
    <div
      className={`flex border-border-subtle bg-bg-secondary/45 ${
        compact
          ? 'h-full w-[88px] flex-col border-l'
          : 'w-[136px] shrink-0 flex-col border-r'
      }`}
    >
      {RESEARCH_TOOLS.map((tool) => (
        <button
          key={tool.id}
          type="button"
          onClick={() => onToolChange(tool.id)}
          className={`flex min-h-[72px] flex-col items-center justify-center gap-2 border-b border-border-subtle px-2 text-xs transition-colors ${
            activeTool === tool.id
              ? 'bg-accent-base/18 text-text-primary'
              : 'text-text-secondary hover:bg-bg-tertiary hover:text-text-primary'
          }`}
          title={tool.label}
        >
          <span className="text-lg text-accent-text">{tool.icon}</span>
          <span className={compact ? 'text-[11px]' : 'text-xs'}>
            {tool.label}
          </span>
        </button>
      ))}
    </div>
  );
}

function SelectedContextCard({
  title,
  description,
  badge,
}: {
  title: string;
  description: string;
  badge: string;
}) {
  return (
    <div className="rounded-xl border border-border-subtle bg-bg-tertiary/60 p-4">
      <p className="text-xs uppercase tracking-wide text-text-tertiary">
        Selected card
      </p>
      <div className="mt-2 flex items-start justify-between gap-3">
        <h4 className="text-base font-semibold text-text-primary">{title}</h4>
        <span className="shrink-0 rounded-md border border-accent-base/30 bg-accent-base/20 px-2 py-0.5 text-[11px] capitalize text-accent-text">
          {badge}
        </span>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-text-secondary">
        {description}
      </p>
    </div>
  );
}

function ResearchToolPanel({
  activeTool,
  selectedTitle,
  selectedDescription,
  selectedBadge,
  selectedNote,
  selectionKey,
  onNoteChange,
  mindmap,
  papers,
  sanityMatrix,
  evidenceScopeDiagnostics,
  searchDiagnostics,
  supervisorNote,
  queries,
  pivots,
  selectedNode,
  selectedBranch,
  onPrimaryAction,
  primaryLabel,
  onReadPapers,
  lineageOriginId,
  onLineageOriginChange,
  lineageGraph,
  lineageLoading,
  lineageError,
  selectedLineageNode,
  onLoadLineageGraph,
  onUseLineageNodeAsOrigin,
  onExpandLineageNode,
  onAskCopilotAboutLineage,
}: {
  activeTool: ResearchTool;
  selectedTitle: string;
  selectedDescription: string;
  selectedBadge: string;
  selectedNote: string;
  selectionKey: string;
  onNoteChange: (note: string) => void;
  mindmap: ThesisMindmap;
  papers: Paper[];
  sanityMatrix?: ResearchSanityMatrix;
  evidenceScopeDiagnostics?: EvidenceScopeDiagnostics;
  searchDiagnostics?: SearchFacetDiagnostics;
  supervisorNote?: string;
  queries?: string[];
  pivots: Pivot[];
  selectedNode: { branch: ThesisMindmapBranch; node: ThesisMindmapNode } | null;
  selectedBranch: ThesisMindmapBranch | null;
  onPrimaryAction?: () => void;
  primaryLabel?: string;
  onReadPapers: () => void;
  lineageOriginId: string;
  onLineageOriginChange: (paperId: string) => void;
  lineageGraph: EvidenceLineageGraph | null;
  lineageLoading: boolean;
  lineageError: string | null;
  selectedLineageNode: EvidenceLineageNode | null;
  onLoadLineageGraph: (depth?: 'fast' | 'expanded') => void;
  onUseLineageNodeAsOrigin: (node: EvidenceLineageNode) => void;
  onExpandLineageNode: (node: EvidenceLineageNode) => void;
  onAskCopilotAboutLineage: (node: EvidenceLineageNode) => void;
}) {
  const [paperFilter, setPaperFilter] = useState<
    'closest' | 'strong' | 'recent' | 'doi'
  >('closest');
  const basePapers = selectedPaperSet(papers, selectedNode);
  const displayedPapers = [...basePapers]
    .filter((paper) => {
      if (paperFilter === 'strong') return paperScore(paper) >= 0.45 || paper.citationCount >= 25;
      if (paperFilter === 'recent') return paper.year >= 2021;
      if (paperFilter === 'doi') return Boolean(paper.doi);
      return true;
    })
    .sort((a, b) => paperScore(b) - paperScore(a))
    .slice(0, 5);
  const [selectedReaderPaper, setSelectedReaderPaper] = useState<Paper | null>(
    () => displayedPapers[0] || null
  );
  const [readerResult, setReaderResult] = useState<PaperFullTextResult | null>(null);
  const [readerLoading, setReaderLoading] = useState(false);
  const [chatBySelection, setChatBySelection] = useState<Record<string, ChatMessage[]>>({});
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [lastPrompt, setLastPrompt] = useState('');
  const chatMessages = chatBySelection[selectionKey] || [];
  const lineageOrigin =
    papers.find((paper) => paper.id === lineageOriginId) || papers[0] || null;
  const lineageGroups = {
    noveltyThreats:
      lineageGraph?.nodes.filter((node) => node.role === 'novelty_threat') || [],
    foundational:
      lineageGraph?.nodes.filter((node) => node.role === 'foundational') || [],
    derivative:
      lineageGraph?.nodes.filter((node) => node.role === 'derivative') || [],
    neighboring:
      lineageGraph?.nodes.filter((node) => node.role === 'neighboring') || [],
    methods:
      lineageGraph?.nodes.filter((node) => node.role === 'method_source') || [],
  };

  const appendChatMessages = (messages: ChatMessage[]) => {
    setChatBySelection((current) => ({
      ...current,
      [selectionKey]: [...(current[selectionKey] || []), ...messages],
    }));
  };

  const submitChatPrompt = async (prompt: string) => {
    const trimmed = prompt.trim();
    if (!trimmed || chatLoading) return;
    const nextHistory = [...chatMessages, { role: 'user' as const, content: trimmed }];
    appendChatMessages([{ role: 'user', content: trimmed }]);
    setChatInput('');
    setLastPrompt(trimmed);
    setChatError(null);
    setChatLoading(true);

    try {
      let fullTextResult: PaperFullTextResult | null = readerResult;
      if (!fullTextResult) {
        try {
          const storedFullText = sessionStorage.getItem('researchlens_last_full_text');
          fullTextResult = storedFullText
            ? (JSON.parse(storedFullText) as PaperFullTextResult)
            : null;
        } catch {
          fullTextResult = null;
        }
      }

      const response = await fetch('/api/copilot/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          selectedCard: {
            title: selectedTitle,
            description: selectedDescription,
            badge: selectedBadge,
            selectionType: selectedNode ? 'node' : selectedBranch ? 'branch' : 'center',
            branchKind: selectedBranch?.kind || selectedNode?.branch.kind,
            nodeStatus: selectedNode?.node.status,
          },
          selectedNote,
          mindmap,
          papers,
          selectedPapers: basePapers,
          sanityMatrix,
          evidenceScopeDiagnostics,
          searchDiagnostics,
          pivots,
          supervisorNote,
          queries,
          chatHistory: nextHistory.slice(-8),
          fullTextResult,
        }),
      });
      const result = (await response.json()) as {
        answer?: string;
        mode?: 'ai' | 'fallback';
        warning?: string;
        error?: string;
      };

      if (!response.ok || !result.answer) {
        throw new Error(result.error || 'Copilot could not answer.');
      }

      appendChatMessages([
        {
          role: 'assistant',
          content:
            result.mode === 'fallback' && result.warning
              ? `${result.answer}\n\n${result.warning}`
              : result.answer,
        },
      ]);
    } catch (error) {
      setChatError(
        error instanceof Error ? error.message : 'Copilot could not answer.'
      );
    } finally {
      setChatLoading(false);
    }
  };

  const readPaper = async (paper: Paper) => {
    setSelectedReaderPaper(paper);
    setReaderLoading(true);
    setReaderResult(null);
    try {
      const response = await fetch('/api/papers/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paper }),
      });
      const result = (await response.json()) as PaperFullTextResult;
      setReaderResult(result);
      sessionStorage.setItem('researchlens_last_full_text', JSON.stringify(result));
    } finally {
      setReaderLoading(false);
    }
  };

  const downloadPaper = async (paper: Paper) => {
    const response = await fetch('/api/papers/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paper }),
    });
    if (!response.ok) return;
    const blob = await response.blob();
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = `${paper.title.replace(/[^\w\s.-]/g, '').slice(0, 90) || 'paper'}.pdf`;
    link.click();
    URL.revokeObjectURL(href);
  };

  const uploadPaper = async (file: File) => {
    setReaderLoading(true);
    setReaderResult(null);
    const formData = new FormData();
    formData.set('file', file);
    if (selectedReaderPaper?.id) formData.set('paperId', selectedReaderPaper.id);
    try {
      const response = await fetch('/api/papers/upload', {
        method: 'POST',
        body: formData,
      });
      const result = (await response.json()) as PaperFullTextResult;
      setReaderResult(result);
      sessionStorage.setItem('researchlens_last_full_text', JSON.stringify(result));
    } finally {
      setReaderLoading(false);
    }
  };

  return (
    <aside className="flex h-full min-h-0 w-full flex-col border-l border-border-subtle bg-bg-secondary/35">
      <div className="space-y-4 border-b border-border-subtle p-5">
        <h3 className="text-lg font-semibold text-accent-text">
          {RESEARCH_TOOLS.find((tool) => tool.id === activeTool)?.label}
        </h3>
        <SelectedContextCard
          title={selectedTitle}
          description={selectedDescription}
          badge={selectedBadge}
        />
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
        {activeTool === 'notes' && (
          <div className="space-y-4">
            <label className="grid gap-2">
              <span className="text-sm font-medium text-text-secondary">Notes</span>
              <textarea
                value={selectedNote}
                onChange={(event) => onNoteChange(event.target.value)}
                placeholder="Add notes for this card..."
                rows={8}
                className="w-full rounded-lg border border-border-subtle bg-bg-tertiary/70 px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-base"
              />
            </label>
            <p className="text-xs text-text-tertiary">
              Use this for supervisor comments, thesis decisions, and questions to verify.
            </p>
            <div className="rounded-lg border border-border-subtle bg-bg-tertiary/60 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-text-primary">Research Copilot</p>
                  <p className="mt-1 text-xs text-text-tertiary">
                    Uses this card, thesis idea, notes, top papers, and access status.
                  </p>
                </div>
                <span className="rounded-md border border-border-subtle px-2 py-0.5 text-[11px] text-text-tertiary">
                  Session memory
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {[
                  'Summarize evidence',
                  'Does this threaten my novelty?',
                  'Extract methods',
                  'Find limitations',
                  'Compare with my thesis',
                  'Turn this into supervisor notes',
                ].map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => submitChatPrompt(prompt)}
                    disabled={chatLoading}
                    className="rounded-full border border-border-subtle px-3 py-1 text-[11px] text-text-secondary hover:text-text-primary"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
              <div className="mt-3 max-h-72 space-y-2 overflow-y-auto rounded-md border border-border-subtle bg-bg-secondary/60 p-2">
                {chatMessages.length === 0 ? (
                  <p className="p-2 text-xs text-text-tertiary">
                    Ask about evidence, novelty risk, methods, supervisor questions, or how this card connects to the thesis.
                  </p>
                ) : (
                  chatMessages.map((message, index) => (
                    <div
                      key={`${message.role}-${index}`}
                      className={`rounded-md px-3 py-2 text-xs leading-relaxed ${
                        message.role === 'user'
                          ? 'ml-8 bg-accent-base/20 text-accent-text'
                          : 'mr-8 bg-bg-tertiary text-text-secondary'
                      }`}
                    >
                      {message.content}
                    </div>
                  ))
                )}
                {chatLoading && (
                  <div className="mr-8 rounded-md bg-bg-tertiary px-3 py-2 text-xs leading-relaxed text-text-tertiary">
                    Research Copilot is reading the current card context...
                  </div>
                )}
              </div>
              {chatError && (
                <div className="mt-3 rounded-md border border-status-error/30 bg-status-error-bg px-3 py-2 text-xs text-status-error">
                  <p>{chatError}</p>
                  {lastPrompt && (
                    <button
                      type="button"
                      onClick={() => submitChatPrompt(lastPrompt)}
                      className="mt-2 text-xs font-medium underline"
                    >
                      Retry last question
                    </button>
                  )}
                </div>
              )}
              <form
                className="mt-3 flex gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  submitChatPrompt(chatInput);
                }}
              >
                <input
                  value={chatInput}
                  onChange={(event) => setChatInput(event.target.value)}
                  placeholder="Ask about this card..."
                  disabled={chatLoading}
                  className="min-w-0 flex-1 rounded-lg border border-border-subtle bg-bg-secondary px-3 py-2 text-xs text-text-primary outline-none focus:border-accent-base"
                />
                <button
                  type="submit"
                  disabled={chatLoading || !chatInput.trim()}
                  className="rounded-lg bg-accent-base px-3 text-xs font-medium text-white hover:bg-accent-hover"
                >
                  {chatLoading ? 'Thinking' : 'Ask'}
                </button>
              </form>
            </div>
          </div>
        )}

        {activeTool === 'publications' && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {[
                ['closest', 'Closest overlap'],
                ['strong', 'Strong evidence'],
                ['recent', 'Recent'],
                ['doi', 'DOI-backed'],
              ].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPaperFilter(id as typeof paperFilter)}
                  className={`rounded-full border px-3 py-1 text-xs ${
                    paperFilter === id
                      ? 'border-accent-base bg-accent-base/20 text-accent-text'
                      : 'border-border-subtle text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="space-y-2">
              {displayedPapers.map((paper) => (
                <div
                  key={paper.id}
                  className={`rounded-lg border bg-bg-tertiary/60 p-3 ${
                    selectedReaderPaper?.id === paper.id
                      ? 'border-accent-base/70'
                      : 'border-border-subtle'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium leading-snug text-text-primary">
                      {paper.title}
                    </p>
                    <span className="text-xs text-accent-text">
                      {Math.round(paperScore(paper) * 100)}%
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-text-tertiary">
                    {paper.venue || paper.source} · {paper.year}
                    {paper.doi ? ' · DOI' : ''}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${accessTone(paper.accessType)}`}
                    >
                      {accessLabel(paper.accessType)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedReaderPaper(paper)}
                      className="rounded-md border border-border-subtle px-2 py-1 text-[11px] text-text-secondary hover:text-text-primary"
                    >
                      Select
                    </button>
                    {(paper.landingUrl || paper.url || paper.doi) && (
                      <a
                        href={paper.landingUrl || paper.url || `https://doi.org/${paper.doi}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-md border border-border-subtle px-2 py-1 text-[11px] text-accent-text hover:text-accent-hover"
                      >
                        Open
                      </a>
                    )}
                    {canReadPaper(paper) && (
                      <>
                        <button
                          type="button"
                          onClick={() => readPaper(paper)}
                          className="rounded-md bg-accent-base px-2 py-1 text-[11px] font-medium text-white hover:bg-accent-hover"
                        >
                          Read
                        </button>
                        <button
                          type="button"
                          onClick={() => downloadPaper(paper)}
                          className="rounded-md border border-border-subtle px-2 py-1 text-[11px] text-text-secondary hover:text-text-primary"
                        >
                          Download
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
              {displayedPapers.length === 0 && (
                <p className="rounded-lg border border-border-subtle p-3 text-sm text-text-secondary">
                  No papers match this filter yet.
                </p>
              )}
            </div>
            <div className="rounded-lg border border-border-subtle bg-bg-tertiary/60 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-text-primary">Paper Reader</p>
                  <p className="mt-1 text-xs text-text-tertiary">
                    Reads legal open PDFs or PDFs you upload yourself.
                  </p>
                </div>
                <label className="cursor-pointer rounded-md border border-border-subtle px-2 py-1 text-[11px] text-text-secondary hover:text-text-primary">
                  Upload PDF
                  <input
                    type="file"
                    accept="application/pdf"
                    className="sr-only"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void uploadPaper(file);
                      event.currentTarget.value = '';
                    }}
                  />
                </label>
              </div>
              {selectedReaderPaper && (
                <div className="mt-3 rounded-md border border-border-subtle bg-bg-secondary/70 p-3">
                  <p className="text-xs uppercase tracking-wide text-accent-base">
                    Selected paper
                  </p>
                  <p className="mt-1 text-sm font-medium text-text-primary">
                    {selectedReaderPaper.title}
                  </p>
                  <p className="mt-1 text-xs text-text-tertiary">
                    {canReadPaper(selectedReaderPaper)
                      ? 'Full text can be checked from an open PDF source.'
                      : 'ResearchLens currently has abstract/metadata only. Upload a PDF to read it here.'}
                  </p>
                </div>
              )}
              {readerLoading && (
                <p className="mt-3 text-xs text-text-tertiary">Reading PDF...</p>
              )}
              {readerResult && (
                <div className="mt-3 space-y-3">
                  <p
                    className={`rounded-md border px-3 py-2 text-xs ${
                      readerResult.status === 'available'
                        ? 'border-status-success/30 bg-status-success-bg text-status-success'
                        : 'border-status-warning/30 bg-status-warning-bg text-status-warning'
                    }`}
                  >
                    {readerResult.status === 'available'
                      ? `Full text extracted${readerResult.pageCount ? ` from ${readerResult.pageCount} pages` : ''}.`
                      : readerResult.message || 'Full text unavailable.'}
                  </p>
                  {readerResult.sections &&
                    Object.entries(readerResult.sections)
                      .filter(([, value]) => Boolean(value))
                      .slice(0, 4)
                      .map(([section, value]) => (
                        <details
                          key={section}
                          className="rounded-md border border-border-subtle bg-bg-secondary/70 p-3"
                        >
                          <summary className="cursor-pointer text-xs font-medium capitalize text-text-primary">
                            {section.replace(/([A-Z])/g, ' $1')}
                          </summary>
                          <p className="mt-2 text-xs leading-relaxed text-text-secondary">
                            {String(value).slice(0, 1400)}
                          </p>
                        </details>
                      ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTool === 'lineage' && (
          <div className="space-y-4">
            <div className="rounded-lg border border-border-subtle bg-bg-tertiary/60 p-3">
              <label className="grid gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-text-tertiary">
                  Origin paper
                </span>
                <select
                  value={lineageOrigin?.id || ''}
                  onChange={(event) => {
                    onLineageOriginChange(event.target.value);
                  }}
                  className="rounded-lg border border-border-subtle bg-bg-secondary px-3 py-2 text-xs text-text-primary outline-none focus:border-accent-base"
                >
                  {papers.slice(0, 20).map((paper) => (
                    <option key={paper.id} value={paper.id}>
                      {paper.title.slice(0, 90)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onLoadLineageGraph('fast')}
                  disabled={!lineageOrigin || lineageLoading}
                  className="rounded-lg bg-accent-base px-3 py-2 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-50"
                >
                  {lineageLoading ? 'Building graph' : 'Refresh lineage'}
                </button>
                <button
                  type="button"
                  onClick={() => onLoadLineageGraph('expanded')}
                  disabled={!lineageOrigin || lineageLoading}
                  className="rounded-lg border border-border-subtle px-3 py-2 text-xs font-medium text-text-secondary hover:text-text-primary disabled:opacity-50"
                >
                  Expanded
                </button>
                <p className="text-xs text-text-tertiary">
                  Uses citation-network metadata first, then current result proximity as fallback.
                </p>
              </div>
            </div>

            {selectedLineageNode && (
              <div className="rounded-lg border border-accent-base/35 bg-accent-base/10 p-3">
                <p className="text-xs uppercase tracking-wide text-accent-base">
                  Selected paper
                </p>
                <p className="mt-2 text-sm font-semibold leading-snug text-text-primary">
                  {selectedLineageNode.paper.title}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-text-secondary">
                  {selectedLineageNode.explanation}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onUseLineageNodeAsOrigin(selectedLineageNode)}
                    className="rounded-md border border-border-subtle px-2 py-1 text-[11px] text-text-secondary hover:text-text-primary"
                  >
                    Use as origin
                  </button>
                  <button
                    type="button"
                    onClick={() => onExpandLineageNode(selectedLineageNode)}
                    className="rounded-md border border-border-subtle px-2 py-1 text-[11px] text-text-secondary hover:text-text-primary"
                  >
                    Expand node
                  </button>
                  <button
                    type="button"
                    onClick={() => onAskCopilotAboutLineage(selectedLineageNode)}
                    className="rounded-md border border-border-subtle px-2 py-1 text-[11px] text-text-secondary hover:text-text-primary"
                  >
                    Ask Copilot
                  </button>
                  {(selectedLineageNode.paper.url || selectedLineageNode.paper.doi) && (
                    <a
                      href={
                        selectedLineageNode.paper.url ||
                        `https://doi.org/${selectedLineageNode.paper.doi}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-md border border-border-subtle px-2 py-1 text-[11px] text-accent-text hover:text-accent-hover"
                    >
                      Open paper
                    </a>
                  )}
                  {canReadPaper(selectedLineageNode.paper) && (
                    <button
                      type="button"
                      onClick={() => readPaper(selectedLineageNode.paper)}
                      className="rounded-md bg-accent-base px-2 py-1 text-[11px] font-medium text-white hover:bg-accent-hover"
                    >
                      Read here
                    </button>
                  )}
                </div>
              </div>
            )}

            {lineageError && (
              <div className="rounded-lg border border-status-error/30 bg-status-error-bg p-3 text-xs text-status-error">
                {lineageError}
              </div>
            )}

            {lineageGraph && (
              <div className="space-y-4">
                <div className="rounded-lg border border-border-subtle bg-bg-tertiary/60 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-text-primary">
                        Supervisor defense
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-text-secondary">
                        {buildLineageDefense(lineageGraph, mindmap.center)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        navigator.clipboard?.writeText(
                          buildLineageDefense(lineageGraph, mindmap.center)
                        )
                      }
                      className="shrink-0 rounded-md border border-border-subtle px-2 py-1 text-[11px] text-text-secondary hover:text-text-primary"
                    >
                      Copy
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    ['OpenAlex', lineageGraph.sourceSummary.openAlex],
                    ['Semantic Scholar', lineageGraph.sourceSummary.semanticScholar],
                    ['Local fallback', lineageGraph.sourceSummary.local],
                  ].map(([label, count]) => (
                    <div
                      key={label}
                      className="rounded-lg border border-border-subtle bg-bg-secondary/70 p-3"
                    >
                      <p className="text-[11px] uppercase text-text-tertiary">{label}</p>
                      <p className="mt-1 text-lg font-semibold text-text-primary">{count}</p>
                    </div>
                  ))}
                </div>

                {lineageGraph.warnings.length > 0 && (
                  <div className="space-y-1 rounded-lg border border-status-warning/30 bg-status-warning-bg p-3">
                    {lineageGraph.warnings.map((warning) => (
                      <p key={warning} className="text-xs text-status-warning">
                        {warning}
                      </p>
                    ))}
                  </div>
                )}

                {[
                  ['Novelty threats', lineageGroups.noveltyThreats],
                  ['Prior / foundational works', lineageGroups.foundational],
                  ['Derivative works', lineageGroups.derivative],
                  ['Method sources', lineageGroups.methods],
                  ['Closest neighbors', lineageGroups.neighboring],
                ].map(([label, nodes]) => (
                  <div key={label as string} className="space-y-2">
                    <h4 className="text-sm font-semibold text-text-primary">
                      {label as string}
                    </h4>
                    {(nodes as NonNullable<typeof lineageGraph>['nodes']).length === 0 ? (
                      <p className="rounded-lg border border-border-subtle bg-bg-tertiary/40 p-3 text-xs text-text-tertiary">
                        No papers found in this group yet.
                      </p>
                    ) : (
                      (nodes as NonNullable<typeof lineageGraph>['nodes'])
                        .slice(0, 5)
                        .map((node) => (
                          <div
                            key={node.id}
                            className="rounded-lg border border-border-subtle bg-bg-tertiary/60 p-3"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <p className="text-sm font-medium leading-snug text-text-primary">
                                {node.paper.title}
                              </p>
                              <span className="shrink-0 rounded-md border border-border-subtle px-2 py-0.5 text-[11px] text-text-tertiary">
                                {Math.round(node.similarityToIdea * 100)}%
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-text-tertiary">
                              {node.paper.venue || node.paper.source} · {node.paper.year || 'n.d.'}
                              {node.paper.doi ? ' · DOI' : ''}
                            </p>
                            <p className="mt-2 text-xs leading-relaxed text-text-secondary">
                              {node.explanation}
                            </p>
                            {(node.paper.url || node.paper.doi) && (
                              <a
                                href={node.paper.url || `https://doi.org/${node.paper.doi}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-3 inline-flex rounded-md border border-border-subtle px-2 py-1 text-[11px] text-accent-text hover:text-accent-hover"
                              >
                                Open paper
                              </a>
                            )}
                          </div>
                        ))
                    )}
                  </div>
                ))}

                <div className="rounded-lg border border-border-subtle bg-bg-tertiary/60 p-3">
                  <p className="text-sm font-semibold text-text-primary">Reading route</p>
                  <div className="mt-3 space-y-2">
                    {[
                      ['Foundational', lineageGroups.foundational[0]],
                      ['Method', lineageGroups.methods[0]],
                      ['Novelty threat', lineageGroups.noveltyThreats[0]],
                      ['Derivative', lineageGroups.derivative[0]],
                    ].map(([label, node]) =>
                      node ? (
                        <button
                          key={label as string}
                          type="button"
                          onClick={() => onUseLineageNodeAsOrigin(node as EvidenceLineageNode)}
                          className="block w-full rounded-md border border-border-subtle bg-bg-secondary/70 p-2 text-left text-xs text-text-secondary hover:text-text-primary"
                        >
                          <span className="font-medium text-accent-text">{label as string}: </span>
                          {(node as EvidenceLineageNode).paper.title}
                        </button>
                      ) : null
                    )}
                  </div>
                </div>
              </div>
            )}

            {!lineageGraph && !lineageLoading && !lineageError && (
              <p className="rounded-lg border border-border-subtle bg-bg-tertiary/40 p-3 text-sm text-text-secondary">
                Pick an origin paper to map prior works, derivative works, close neighbors,
                and novelty threats around it.
              </p>
            )}
          </div>
        )}

        {activeTool === 'studyGuides' && (
          <div className="space-y-3 text-sm text-text-secondary">
            <p>
              This card explains one piece of the thesis logic. Treat it as a checkpoint:
              define it clearly, connect it to evidence, then decide whether it strengthens
              or weakens novelty.
            </p>
            <div className="rounded-lg border border-border-subtle bg-bg-tertiary/60 p-3">
              <p className="font-medium text-text-primary">Verify next</p>
              <ul className="mt-2 list-disc space-y-1 pl-4">
                <li>What exact variable, population, or method does this card imply?</li>
                <li>Which papers support or contradict this direction?</li>
                <li>Can this become a measurable thesis objective?</li>
              </ul>
            </div>
            <div className="rounded-lg border border-border-subtle bg-bg-tertiary/60 p-3">
              <p className="font-medium text-text-primary">Supervisor question</p>
              <p className="mt-2">
                “Does this card make the thesis more specific and defensible, or should I
                narrow it further?”
              </p>
            </div>
          </div>
        )}

        {activeTool === 'methodologies' && (
          <div className="space-y-3">
            <div className="rounded-lg border border-border-subtle bg-bg-tertiary/60 p-3 text-sm text-text-secondary">
              <p className="font-medium text-text-primary">Method direction</p>
              <p className="mt-2">
                {selectedBranch?.kind === 'method' || selectedNode?.branch.kind === 'method'
                  ? selectedDescription
                  : 'Use this panel to translate the selected thesis area into method, data, variables, and scope decisions.'}
              </p>
            </div>
            {sanityMatrix?.recommendedActions?.slice(0, 4).map((action) => (
              <div
                key={action}
                className="rounded-lg border border-border-subtle bg-bg-tertiary/60 p-3 text-sm text-text-secondary"
              >
                {action}
              </div>
            ))}
          </div>
        )}

        {activeTool === 'assets' && (
          <div className="space-y-3">
            {supervisorNote && (
              <div className="rounded-lg border border-border-subtle bg-bg-tertiary/60 p-3">
                <p className="text-xs uppercase tracking-wide text-accent-base">
                  Supervisor note
                </p>
                <p className="mt-2 text-sm text-text-secondary">{supervisorNote}</p>
              </div>
            )}
            {pivots.slice(0, 3).map((pivot) => (
              <div
                key={pivot.title}
                className="rounded-lg border border-border-subtle bg-bg-tertiary/60 p-3"
              >
                <p className="text-sm font-medium text-text-primary">{pivot.title}</p>
                <p className="mt-1 text-xs text-text-secondary">{pivot.description}</p>
              </div>
            ))}
            {queries && queries.length > 0 && (
              <div className="rounded-lg border border-border-subtle bg-bg-tertiary/60 p-3">
                <p className="text-xs uppercase tracking-wide text-accent-base">
                  Search queries
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {queries.slice(0, 8).map((query) => (
                    <span
                      key={query}
                      className="rounded-md border border-border-subtle px-2 py-1 text-[11px] text-text-secondary"
                    >
                      {query}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="border-t border-border-subtle p-5">
        <div className="grid grid-cols-2 gap-3">
          {primaryLabel && onPrimaryAction && (
            <button
              type="button"
              onClick={onPrimaryAction}
              className="min-h-[44px] rounded-lg bg-accent-base px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
            >
              {primaryLabel}
            </button>
          )}
          <button
            type="button"
            onClick={onReadPapers}
            className="min-h-[44px] rounded-lg border border-border-subtle px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary"
          >
            Read Papers
          </button>
        </div>
      </div>
    </aside>
  );
}

function persistMindmap(nextMindmap: ThesisMindmap) {
  try {
    const stored = sessionStorage.getItem('researchlens_result');
    if (!stored) return;

    const parsed = JSON.parse(stored);
    sessionStorage.setItem(
      'researchlens_result',
      JSON.stringify({ ...parsed, thesisMindmap: nextMindmap })
    );
  } catch {
    // Editing the mindmap is a UI convenience; storage failures should not break results.
  }
}

export default function ThesisMindmapPanel({
  mindmap,
  pivots,
  papers = [],
  sanityMatrix,
  evidenceScopeDiagnostics,
  searchDiagnostics,
  supervisorNote,
  queries,
  onExplorePivot,
  onExploreNode,
  initialTool = 'notes',
  workspaceRequestKey,
}: ThesisMindmapPanelProps) {
  const [editableMindmap, setEditableMindmap] = useState(mindmap);
  const [openBranches, setOpenBranches] = useState<Set<string>>(
    () => new Set(mindmap.branches.map((branch) => branch.id))
  );
  const [selection, setSelection] = useState<Selection>({ type: 'center' });
  const [notesBySelection, setNotesBySelection] = useState<Record<string, string>>({});
  const [viewMode, setViewMode] = useState<'simple' | 'full'>('full');
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false);
  const [activeTool, setActiveTool] = useState<ResearchTool>(initialTool);
  const [canvasMode, setCanvasMode] = useState<CanvasMode>(
    initialTool === 'lineage' ? 'lineage' : 'mindmap'
  );
  const [toolPanelCollapsed, setToolPanelCollapsed] = useState(false);
  const [viewportCommand, setViewportCommand] = useState<
    { id: number; type: 'fit' | 'reset' } | undefined
  >();
  const [lineageOriginId, setLineageOriginId] = useState<string>(
    () => papers[0]?.id || ''
  );
  const [lineageGraph, setLineageGraph] = useState<EvidenceLineageGraph | null>(null);
  const [lineageLoading, setLineageLoading] = useState(false);
  const [lineageError, setLineageError] = useState<string | null>(null);
  const [selectedLineageNodeId, setSelectedLineageNodeId] = useState<string | undefined>();

  const issueViewportCommand = (type: 'fit' | 'reset') => {
    setViewportCommand({ id: Date.now(), type });
  };

  const lineageOrigin =
    papers.find((paper) => paper.id === lineageOriginId) || papers[0] || null;
  const selectedLineageNode =
    lineageGraph?.nodes.find((node) => node.id === selectedLineageNodeId) ||
    lineageGraph?.nodes.find((node) => node.role === 'origin') ||
    null;

  const changeActiveTool = (tool: ResearchTool) => {
    setActiveTool(tool);
    if (tool === 'lineage') {
      setCanvasMode('lineage');
      setIsWorkspaceOpen(true);
      setToolPanelCollapsed(false);
    }
  };

  const persistLineageGraph = (origin: Paper, graph: EvidenceLineageGraph) => {
    try {
      const stored = sessionStorage.getItem('researchlens_lineage_graphs');
      const parsed = stored ? JSON.parse(stored) : {};
      parsed[lineagePaperKey(origin)] = graph;
      sessionStorage.setItem('researchlens_lineage_graphs', JSON.stringify(parsed));
    } catch {
      // Lineage caching should never block the workspace.
    }
  };

  const readCachedLineageGraph = (origin: Paper): EvidenceLineageGraph | null => {
    try {
      const stored = sessionStorage.getItem('researchlens_lineage_graphs');
      if (!stored) return null;
      const parsed = JSON.parse(stored) as Record<string, EvidenceLineageGraph>;
      return parsed[lineagePaperKey(origin)] || null;
    } catch {
      return null;
    }
  };

  const loadLineageGraph = async (
    depth: 'fast' | 'expanded' = 'fast',
    origin: Paper | null = lineageOrigin,
    mode: 'replace' | 'merge' = 'replace'
  ) => {
    if (!origin || lineageLoading) return;
    setLineageLoading(true);
    setLineageError(null);
    setCanvasMode('lineage');
    setActiveTool('lineage');
    try {
      const cached = depth === 'fast' && mode === 'replace' ? readCachedLineageGraph(origin) : null;
      if (cached) {
        setLineageGraph(cached);
        setSelectedLineageNodeId(cached.originPaperId);
        return;
      }

      const response = await fetch('/api/lineage/paper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originPaper: origin,
          thesisIdea: editableMindmap.center,
          reportPapers: papers,
          depth,
          maxNodes: depth === 'expanded' ? 45 : 35,
          includeNetworkEdges: true,
        }),
      });
      const graph = (await response.json()) as EvidenceLineageGraph & { error?: string };
      if (!response.ok || graph.error) {
        throw new Error(graph.error || 'Unable to build lineage graph.');
      }

      setLineageGraph((current) => {
        if (mode === 'merge' && current) {
          const nodesById = new Map(current.nodes.map((node) => [node.id, node]));
          graph.nodes.forEach((node) => {
            if (!nodesById.has(node.id)) nodesById.set(node.id, node);
          });
          const edgesById = new Map(current.edges.map((edge) => [edge.id, edge]));
          graph.edges.forEach((edge) => {
            if (!edgesById.has(edge.id)) edgesById.set(edge.id, edge);
          });
          return {
            ...current,
            nodes: [...nodesById.values()].slice(0, 45),
            edges: [...edgesById.values()].filter((edge) => {
              const ids = new Set([...nodesById.keys()]);
              return ids.has(edge.source) && ids.has(edge.target);
            }),
            warnings: [...new Set([...current.warnings, ...graph.warnings])],
            sourceSummary: {
              openAlex: current.sourceSummary.openAlex + graph.sourceSummary.openAlex,
              semanticScholar:
                current.sourceSummary.semanticScholar + graph.sourceSummary.semanticScholar,
              local: current.sourceSummary.local + graph.sourceSummary.local,
            },
          };
        }
        persistLineageGraph(origin, graph);
        return graph;
      });
      setSelectedLineageNodeId(graph.originPaperId);
    } catch (error) {
      setLineageError(
        error instanceof Error ? error.message : 'Unable to build lineage graph.'
      );
    } finally {
      setLineageLoading(false);
    }
  };

  const changeLineageOrigin = (paperId: string) => {
    setLineageOriginId(paperId);
    setLineageGraph(null);
    setLineageError(null);
    setSelectedLineageNodeId(undefined);
  };

  const useLineageNodeAsOrigin = (node: EvidenceLineageNode) => {
    setLineageOriginId(node.paper.id);
    void loadLineageGraph('fast', node.paper, 'replace');
  };

  const expandLineageNode = (node: EvidenceLineageNode) => {
    void loadLineageGraph('expanded', node.paper, 'merge');
  };

  const askCopilotAboutLineage = (node: EvidenceLineageNode) => {
    setActiveTool('notes');
    setCanvasMode('lineage');
    setToolPanelCollapsed(false);
    updateSelectedNote(
      `${selectedNote}\nLineage question: How should I defend my thesis against "${node.paper.title}"?`.trim()
    );
  };

  useEffect(() => {
    if (!isWorkspaceOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isWorkspaceOpen]);

  useEffect(() => {
    if (!workspaceRequestKey) return;
    const timeout = window.setTimeout(() => {
      setActiveTool(initialTool);
      setCanvasMode(initialTool === 'lineage' ? 'lineage' : 'mindmap');
      setToolPanelCollapsed(false);
      setIsWorkspaceOpen(true);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [initialTool, workspaceRequestKey]);

  const selectedNode = useMemo(() => {
    if (selection.type !== 'node') return null;
    const branch = editableMindmap.branches.find(
      (candidate) => candidate.id === selection.branchId
    );
    const node = branch?.nodes.find(
      (candidate) => candidate.id === selection.nodeId
    );
    return branch && node ? { branch, node } : null;
  }, [editableMindmap.branches, selection]);

  const selectedBranch = useMemo(() => {
    if (selection.type !== 'branch') return null;
    return (
      editableMindmap.branches.find(
        (candidate) => candidate.id === selection.branchId
      ) || null
    );
  }, [editableMindmap.branches, selection]);

  const selectionKey =
    selection.type === 'center'
      ? 'center'
      : selection.type === 'branch'
        ? `branch-${selection.branchId}`
        : `node-${selection.branchId}-${selection.nodeId}`;
  const selectedNote = notesBySelection[selectionKey] || '';

  const updateSelectedNote = (note: string) => {
    setNotesBySelection((current) => ({ ...current, [selectionKey]: note }));
  };

  const selectedTitle =
    selection.type === 'center'
      ? 'Thesis idea'
      : selectedBranch?.label || selectedNode?.node.label || 'Selected card';
  const selectedDescription =
    selection.type === 'center'
      ? editableMindmap.center
      : selectedBranch?.summary || selectedNode?.node.description || '';
  const selectedBadge =
    selection.type === 'center'
      ? 'core'
      : selectedBranch?.kind || selectedNode?.node.status || 'selected';
  const selectedBranchIdForFlow =
    selection.type === 'branch' ? selection.branchId : undefined;
  const selectedNodeIdForFlow =
    selection.type === 'node' ? selection.nodeId : undefined;

  const updateMindmap = (updater: (current: ThesisMindmap) => ThesisMindmap) => {
    setEditableMindmap((current) => {
      const next = updater(current);
      persistMindmap(next);
      return next;
    });
  };

  const updateCenter = (center: string) => {
    updateMindmap((current) => ({ ...current, center }));
  };

  const updateNode = (
    branchId: string,
    nodeId: string,
    patch: Partial<Pick<ThesisMindmapNode, 'label' | 'description'>>
  ) => {
    updateMindmap((current) => ({
      ...current,
      branches: current.branches.map((branch) =>
        branch.id === branchId
          ? {
              ...branch,
              nodes: branch.nodes.map((node) =>
                node.id === nodeId ? { ...node, ...patch } : node
              ),
            }
          : branch
      ),
    }));
  };

  const updateBranch = (
    branchId: string,
    patch: Partial<Pick<ThesisMindmapBranch, 'label' | 'summary'>>
  ) => {
    updateMindmap((current) => ({
      ...current,
      branches: current.branches.map((branch) =>
        branch.id === branchId ? { ...branch, ...patch } : branch
      ),
    }));
  };

  const exploreBranch = (branch: ThesisMindmapBranch) => {
    onExploreNode?.(
      {
        id: `branch-${branch.id}`,
        label: branch.label,
        status: 'neutral',
        description: branch.summary,
      },
      branch
    );
  };

  const exploreCenter = () => {
    const branch = editableMindmap.branches.find(
      (candidate) => candidate.kind === 'topic'
    );
    if (!branch) return;

    onExploreNode?.(
      {
        id: 'center-idea',
        label: 'Thesis idea',
        status: 'neutral',
        description: editableMindmap.center,
      },
      branch
    );
  };

  const toggleBranch = (branchId: string) => {
    setOpenBranches((current) => {
      const next = new Set(current);
      if (next.has(branchId)) {
        next.delete(branchId);
      } else {
        next.add(branchId);
      }
      return next;
    });
  };

  const scrollToPapers = () => {
    document.getElementById('top-related-papers')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  };

  const selectNode = (node: ThesisMindmapNode, branch: ThesisMindmapBranch) => {
    setSelection({ type: 'node', branchId: branch.id, nodeId: node.id });
  };

  const selectedPivot =
    selectedNode && typeof selectedNode.node.pivotIndex === 'number'
      ? pivots[selectedNode.node.pivotIndex]
      : undefined;
  const primaryLabel =
    selectedPivot && onExplorePivot
      ? 'Explore Pivot'
      : onExploreNode
        ? 'Explore Card'
        : undefined;
  const primaryAction =
    selectedPivot && onExplorePivot
      ? () => onExplorePivot(selectedPivot)
      : selection.type === 'center' && onExploreNode
        ? exploreCenter
        : selection.type === 'branch' && selectedBranch && onExploreNode
          ? () => exploreBranch(selectedBranch)
          : selectedNode && onExploreNode
            ? () => onExploreNode(selectedNode.node, selectedNode.branch)
            : undefined;

  const renderNotesField = () => (
    <label className="grid gap-2">
      <span className="text-sm font-medium text-text-secondary">Notes</span>
      <textarea
        value={selectedNote}
        onChange={(event) => updateSelectedNote(event.target.value)}
        placeholder="Add notes..."
        rows={3}
        className="w-full rounded-lg border border-border-subtle bg-bg-tertiary/70 px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-base"
      />
    </label>
  );

  const renderInspectorActions = ({
    primaryLabel,
    onPrimary,
  }: {
    primaryLabel?: string;
    onPrimary?: () => void;
  }) => (
    <div className="mt-6 flex flex-col gap-3 sm:flex-row xl:flex-col">
      {primaryLabel && onPrimary && (
        <button
          type="button"
          onClick={onPrimary}
          className="min-h-[44px] flex-1 rounded-lg bg-accent-base px-4 py-2 text-sm font-medium text-white shadow-lg shadow-accent-base/20 hover:bg-accent-hover"
        >
          {primaryLabel}
        </button>
      )}
      <button
        type="button"
        onClick={scrollToPapers}
        className="min-h-[44px] flex-1 rounded-lg border border-border-subtle px-4 py-2 text-sm font-medium text-text-secondary hover:border-border-strong hover:text-text-primary"
      >
        Read Papers
      </button>
    </div>
  );

  const renderInspector = () => {
    if (selection.type === 'center') {
      return (
        <div className="h-full p-6">
          <div className="mb-6">
            <p className="text-xs uppercase tracking-wide text-text-tertiary">
              Selected card
            </p>
            <h4 className="mt-3 text-lg font-semibold text-text-primary">
              Thesis idea
            </h4>
          </div>

          <div className="grid gap-4">
            <label className="grid gap-2">
              <span className="text-sm font-medium text-text-secondary">Title</span>
              <input
                value="Thesis idea"
                readOnly
                className="w-full rounded-lg border border-border-subtle bg-bg-tertiary/70 px-3 py-2 text-sm text-text-secondary outline-none"
              />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-medium text-text-secondary">Details</span>
              <textarea
                value={editableMindmap.center}
                onChange={(event) => updateCenter(event.target.value)}
                rows={5}
                className="w-full rounded-lg border border-border-subtle bg-bg-tertiary/70 px-3 py-2 text-sm leading-relaxed text-text-primary outline-none focus:border-accent-base"
              />
            </label>
            <div className="grid gap-2">
              <span className="text-sm font-medium text-text-secondary">Role</span>
              <div className="flex min-h-[42px] items-center rounded-lg border border-border-subtle bg-bg-tertiary/70 px-3 text-sm text-text-primary">
                <span className="mr-2 h-2 w-2 rounded-full bg-accent-base" />
                Core
              </div>
            </div>
            {renderNotesField()}
          </div>

          {renderInspectorActions({
            primaryLabel: onExploreNode ? 'Explore Card' : undefined,
            onPrimary: onExploreNode ? exploreCenter : undefined,
          })}
        </div>
      );
    }

    if (selection.type === 'branch' && selectedBranch) {
      return (
        <div className="h-full p-6">
          <div className="mb-6">
            <p className="text-xs uppercase tracking-wide text-text-tertiary">
              Selected card
            </p>
            <h4 className="mt-3 text-lg font-semibold text-text-primary">
              {selectedBranch.label}
            </h4>
          </div>

          <div className="grid gap-4">
            <label className="grid gap-2">
              <span className="text-sm font-medium text-text-secondary">Title</span>
              <input
                value={selectedBranch.label}
                onChange={(event) =>
                  updateBranch(selectedBranch.id, { label: event.target.value })
                }
                className="w-full rounded-lg border border-border-subtle bg-bg-tertiary/70 px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-base"
              />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-medium text-text-secondary">Details</span>
              <textarea
                value={selectedBranch.summary}
                onChange={(event) =>
                  updateBranch(selectedBranch.id, {
                    summary: event.target.value,
                  })
                }
                rows={5}
                className="w-full rounded-lg border border-border-subtle bg-bg-tertiary/70 px-3 py-2 text-sm leading-relaxed text-text-primary outline-none focus:border-accent-base"
              />
            </label>
            <div className="grid gap-2">
              <span className="text-sm font-medium text-text-secondary">Zone</span>
              <div className="flex min-h-[42px] items-center rounded-lg border border-border-subtle bg-bg-tertiary/70 px-3 text-sm capitalize text-text-primary">
                <span className="mr-2 h-2 w-2 rounded-full bg-accent-base" />
                {selectedBranch.kind}
              </div>
            </div>
            {renderNotesField()}
          </div>

          {renderInspectorActions({
            primaryLabel: onExploreNode ? 'Explore Card' : undefined,
            onPrimary: onExploreNode ? () => exploreBranch(selectedBranch) : undefined,
          })}
        </div>
      );
    }

    if (!selectedNode) return null;

    const pivot =
      typeof selectedNode.node.pivotIndex === 'number'
        ? pivots[selectedNode.node.pivotIndex]
        : undefined;

    const primaryLabel = pivot && onExplorePivot ? 'Explore Pivot' : 'Explore Card';
    const primaryAction =
      pivot && onExplorePivot
        ? () => onExplorePivot(pivot)
        : onExploreNode
          ? () => onExploreNode(selectedNode.node, selectedNode.branch)
          : undefined;

    return (
      <div className="h-full p-6">
        <div className="mb-6">
          <p className="text-xs uppercase tracking-wide text-text-tertiary">
            Selected card
          </p>
          <h4 className="mt-3 text-lg font-semibold text-text-primary">
            {selectedNode.node.label}
          </h4>
        </div>

        <div className="grid gap-4">
          <label className="grid gap-2">
            <span className="text-sm font-medium text-text-secondary">Title</span>
            <input
              value={selectedNode.node.label}
              onChange={(event) =>
                updateNode(selectedNode.branch.id, selectedNode.node.id, {
                  label: event.target.value,
                })
              }
              className="w-full rounded-lg border border-border-subtle bg-bg-tertiary/70 px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-base"
            />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-medium text-text-secondary">Details</span>
            <textarea
              value={selectedNode.node.description}
              onChange={(event) =>
                updateNode(selectedNode.branch.id, selectedNode.node.id, {
                  description: event.target.value,
                })
              }
              rows={5}
              className="w-full rounded-lg border border-border-subtle bg-bg-tertiary/70 px-3 py-2 text-sm leading-relaxed text-text-primary outline-none focus:border-accent-base"
            />
          </label>
          <div className="grid gap-2">
            <span className="text-sm font-medium text-text-secondary">Status</span>
            <div className="flex min-h-[42px] items-center rounded-lg border border-border-subtle bg-bg-tertiary/70 px-3 text-sm text-text-primary">
              <span
                className={`mr-2 h-2 w-2 rounded-full ${
                  selectedNode.node.status === 'open' ||
                  selectedNode.node.status === 'strong'
                    ? 'bg-status-success'
                    : selectedNode.node.status === 'risk' ||
                        selectedNode.node.status === 'weak' ||
                        selectedNode.node.status === 'crowded'
                      ? 'bg-status-error'
                      : 'bg-status-warning'
                }`}
              />
              <span className="capitalize">
                {formatStatus(selectedNode.node.status)}
              </span>
              {typeof selectedNode.node.paperCount === 'number' && (
                <span className="ml-auto text-xs text-text-tertiary">
                  {selectedNode.node.paperCount} paper{' '}
                  {selectedNode.node.paperCount === 1 ? 'signal' : 'signals'}
                </span>
              )}
            </div>
          </div>
          {renderNotesField()}
        </div>

        {renderInspectorActions({
          primaryLabel: primaryAction ? primaryLabel : undefined,
          onPrimary: primaryAction,
        })}
      </div>
    );
  };

  const workspaceOverlay =
    isWorkspaceOpen && typeof document !== 'undefined'
      ? createPortal(
          <div className="fixed inset-0 isolate z-[9999] h-dvh w-screen overflow-hidden bg-[#020617]">
            <div className="grid h-dvh grid-rows-[64px_minmax(0,1fr)] overflow-hidden bg-[#020617]">
              <header className="flex min-h-0 items-center justify-between gap-4 border-b border-border-subtle bg-bg-base px-5">
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-base text-sm font-bold text-white">
                      RL
                    </span>
                    <p className="text-lg font-semibold text-accent-text">
                      Mindmap Workspace
                    </p>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-text-tertiary">
                    ResearchLens Report · {editableMindmap.center}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => issueViewportCommand('fit')}
                    className="min-h-[40px] rounded-lg border border-border-subtle px-3 text-sm text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
                  >
                    Fit
                  </button>
                  <button
                    type="button"
                    onClick={() => issueViewportCommand('reset')}
                    className="min-h-[40px] rounded-lg border border-border-subtle px-3 text-sm text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    onClick={() => setToolPanelCollapsed((current) => !current)}
                    className="min-h-[40px] rounded-lg border border-border-subtle px-3 text-sm text-text-secondary hover:text-text-primary"
                  >
                    {toolPanelCollapsed ? 'Show tools' : 'Hide tools'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsWorkspaceOpen(false)}
                    className="min-h-[40px] rounded-lg border border-accent-base/50 px-4 text-sm font-medium text-accent-text hover:bg-accent-base/15"
                  >
                    Close
                  </button>
                </div>
              </header>

              <div
                className={`grid min-h-0 ${
                  toolPanelCollapsed
                    ? 'grid-cols-[136px_minmax(0,1fr)]'
                    : 'grid-cols-[136px_minmax(0,1fr)] lg:grid-cols-[136px_minmax(0,1fr)_420px]'
                }`}
              >
                <ResearchToolRail
                  activeTool={activeTool}
                  onToolChange={(tool) => {
                    changeActiveTool(tool);
                    setToolPanelCollapsed(false);
                  }}
                />
                <main className="relative isolate min-h-0 min-w-0 overflow-hidden border-r border-border-subtle bg-[#07111f] bg-[radial-gradient(circle_at_50%_40%,rgba(139,92,246,0.10),transparent_30%),linear-gradient(135deg,rgba(7,17,31,1),rgba(2,6,23,1))]">
                  <div className="absolute left-5 top-5 z-20 inline-flex rounded-xl border border-border-subtle bg-bg-base/85 p-1 backdrop-blur">
                    {([
                      ['mindmap', 'Thesis Map'],
                      ['lineage', 'Paper Lineage'],
                    ] as Array<[CanvasMode, string]>).map(([mode, label]) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => {
                          setCanvasMode(mode);
                          if (mode === 'lineage') {
                            setActiveTool('lineage');
                            setToolPanelCollapsed(false);
                          }
                        }}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                          canvasMode === mode
                            ? 'bg-accent-base text-white'
                            : 'text-text-secondary hover:text-text-primary'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {canvasMode === 'lineage' ? (
                    <PaperLineageFlow
                      graph={lineageGraph}
                      loading={lineageLoading}
                      error={lineageError}
                      selectedNodeId={selectedLineageNodeId}
                      onSelectNode={(node) => setSelectedLineageNodeId(node.id)}
                      onBuildGraph={() => void loadLineageGraph('fast')}
                      viewportCommand={viewportCommand}
                    />
                  ) : (
                    <ThesisMindmapFlow
                      mindmap={editableMindmap}
                      pivots={pivots}
                      viewMode={viewMode}
                      onViewModeChange={setViewMode}
                      workspaceMode="fullscreen"
                      selectedCenter={selection.type === 'center'}
                      selectedBranchId={selectedBranchIdForFlow}
                      selectedNodeId={selectedNodeIdForFlow}
                      onExplorePivot={onExplorePivot}
                      onExploreBranch={exploreBranch}
                      onExploreNode={onExploreNode}
                      onSelectBranch={(branch) =>
                        setSelection({ type: 'branch', branchId: branch.id })
                      }
                      onSelectCenter={() => setSelection({ type: 'center' })}
                      onSelectNode={selectNode}
                      onReadPapers={scrollToPapers}
                      viewportCommand={viewportCommand}
                    />
                  )}
                  <div className="absolute bottom-4 left-5 right-5 flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle bg-bg-base/55 px-3 py-3 text-xs text-text-tertiary backdrop-blur">
                    <span>
                      {canvasMode === 'lineage'
                        ? 'Select papers, expand nodes, and defend novelty from the graph.'
                        : 'Drag cards. Select a card. Use tools to build your thesis.'}
                    </span>
                    <div className="flex items-center gap-2">
                      <button className="rounded-md border border-border-subtle px-2 py-1">
                        -
                      </button>
                      <span>100%</span>
                      <button className="rounded-md border border-border-subtle px-2 py-1">
                        +
                      </button>
                    </div>
                  </div>
                </main>
                {!toolPanelCollapsed && (
                  <div className="hidden min-h-0 lg:block">
                    <ResearchToolPanel
                      activeTool={activeTool}
                      selectedTitle={selectedTitle}
                      selectedDescription={selectedDescription}
                      selectedBadge={selectedBadge}
                      selectedNote={selectedNote}
                      selectionKey={selectionKey}
                      onNoteChange={updateSelectedNote}
                      mindmap={editableMindmap}
                      papers={papers}
                      sanityMatrix={sanityMatrix}
                      evidenceScopeDiagnostics={evidenceScopeDiagnostics}
                      searchDiagnostics={searchDiagnostics}
                      supervisorNote={supervisorNote}
                      queries={queries}
                      pivots={pivots}
                      selectedNode={selectedNode}
                      selectedBranch={selectedBranch}
                      onPrimaryAction={primaryAction}
                      primaryLabel={primaryLabel}
                      onReadPapers={scrollToPapers}
                      lineageOriginId={lineageOriginId}
                      onLineageOriginChange={changeLineageOrigin}
                      lineageGraph={lineageGraph}
                      lineageLoading={lineageLoading}
                      lineageError={lineageError}
                      selectedLineageNode={selectedLineageNode}
                      onLoadLineageGraph={(depth) => void loadLineageGraph(depth)}
                      onUseLineageNodeAsOrigin={useLineageNodeAsOrigin}
                      onExpandLineageNode={expandLineageNode}
                      onAskCopilotAboutLineage={askCopilotAboutLineage}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">
            Thesis Mindmap
          </h3>
          <p className="text-xs text-text-tertiary mt-1">
            A curated visual map of the thesis logic. Click any card to inspect,
            edit, or explore it.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setSelection({ type: 'center' })}
          className="self-start rounded-lg border border-border-subtle px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary hover:border-border-strong"
        >
          Edit center idea
        </button>
        <button
          type="button"
          onClick={() => setIsWorkspaceOpen(true)}
          className="self-start rounded-lg border border-accent-base/40 bg-accent-base/15 px-3 py-1.5 text-xs font-medium text-accent-text hover:bg-accent-base/25"
        >
          Expand workspace
        </button>
      </div>

      <div className="surface-card overflow-hidden p-0">
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_88px_380px]">
          <div className="min-w-0 border-b border-border-subtle xl:border-b-0 xl:border-r">
            <ThesisMindmapFlow
              mindmap={editableMindmap}
              pivots={pivots}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              selectedCenter={selection.type === 'center'}
              selectedBranchId={selectedBranchIdForFlow}
              selectedNodeId={selectedNodeIdForFlow}
              onExplorePivot={onExplorePivot}
              onExploreBranch={exploreBranch}
              onExploreNode={onExploreNode}
              onSelectBranch={(branch) =>
                setSelection({ type: 'branch', branchId: branch.id })
              }
              onSelectCenter={() => setSelection({ type: 'center' })}
              onSelectNode={selectNode}
              onReadPapers={scrollToPapers}
            />
            <div className="p-4 lg:hidden">
              <p className="rounded-lg border border-border-subtle bg-bg-secondary p-3 text-xs text-text-secondary">
                The movable visual map is available on wider screens. Use the
                structured branch list below on mobile.
              </p>
            </div>
          </div>
          <div className="hidden xl:block">
            <ResearchToolRail
              activeTool={activeTool}
              onToolChange={changeActiveTool}
              compact
            />
          </div>
          <aside className="bg-bg-secondary/35">{renderInspector()}</aside>
        </div>
      </div>

      {workspaceOverlay}

      {editableMindmap.warnings.length > 0 && (
        <div className="rounded-xl border border-status-warning/30 bg-status-warning-bg/20 p-4">
          <p className="text-xs uppercase tracking-wide text-status-warning font-semibold">
            Map warnings
          </p>
          <div className="mt-2 space-y-1">
            {editableMindmap.warnings.map((warning) => (
              <p key={warning} className="text-xs text-text-secondary">
                {warning}
              </p>
            ))}
          </div>
        </div>
      )}

      <details className="surface-card p-4">
        <summary className="cursor-pointer text-sm font-medium text-text-primary">
          Show structured branch list
          <span className="ml-2 text-xs font-normal text-text-tertiary">
            Useful on small screens or when you want the full text.
          </span>
        </summary>
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
          {editableMindmap.branches.map((branch) => {
            const isOpen = openBranches.has(branch.id);
            return (
              <div
                key={branch.id}
                className="rounded-xl border border-border-subtle bg-bg-secondary overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => toggleBranch(branch.id)}
                  className="w-full min-h-[44px] px-4 py-3 text-left flex items-start justify-between gap-3 hover:bg-bg-tertiary transition-colors cursor-pointer"
                  aria-expanded={isOpen}
                >
                  <span>
                    <span className="block text-sm font-semibold text-text-primary">
                      {branch.label}
                    </span>
                    <span className="block text-xs text-text-tertiary mt-1">
                      {branch.summary}
                    </span>
                  </span>
                  <span className="text-xs text-text-tertiary pt-0.5">
                    {isOpen ? 'Hide' : 'Show'}
                  </span>
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setSelection({ type: 'branch', branchId: branch.id })
                        }
                        className="min-h-[36px] rounded-lg border border-border-subtle bg-bg-tertiary px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary hover:border-border-strong transition-colors cursor-pointer"
                      >
                        Expand Branch
                      </button>
                      {onExploreNode && (
                        <button
                          type="button"
                          onClick={() => exploreBranch(branch)}
                          className="min-h-[36px] rounded-lg bg-accent-base/15 border border-accent-base/40 px-3 py-1.5 text-xs font-medium text-accent-text hover:bg-accent-base/25 transition-colors cursor-pointer"
                        >
                          Explore Card
                        </button>
                      )}
                    </div>
                    {branch.nodes.map((node) => {
                      const pivot =
                        typeof node.pivotIndex === 'number'
                          ? pivots[node.pivotIndex]
                          : undefined;
                      return (
                        <div
                          key={node.id}
                          className={`rounded-lg border p-3 ${
                            node.id === editableMindmap.bestOpportunityNodeId
                              ? 'border-accent-base/40 bg-accent-base/5'
                              : 'border-border-subtle bg-bg-tertiary'
                          }`}
                        >
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <p className="text-sm font-medium text-text-primary">
                              {node.label}
                            </p>
                            <span
                              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${STATUS_STYLES[node.status]}`}
                            >
                              {formatStatus(node.status)}
                            </span>
                            {typeof node.paperCount === 'number' && (
                              <span className="text-[11px] text-text-tertiary">
                                {node.paperCount} paper{' '}
                                {node.paperCount === 1 ? 'signal' : 'signals'}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-text-secondary leading-relaxed">
                            {node.description}
                          </p>

                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => selectNode(node, branch)}
                              className="min-h-[36px] rounded-lg border border-border-subtle bg-bg-secondary px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary hover:border-border-strong transition-colors cursor-pointer"
                            >
                              Expand
                            </button>
                            {node.action === 'read_papers' && (
                              <button
                                type="button"
                                onClick={scrollToPapers}
                                className="min-h-[36px] rounded-lg border border-border-subtle bg-bg-secondary px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary hover:border-border-strong transition-colors cursor-pointer"
                              >
                                Read papers
                              </button>
                            )}
                            {node.action === 'explore_pivot' &&
                            pivot &&
                            onExplorePivot ? (
                              <button
                                type="button"
                                onClick={() => onExplorePivot(pivot)}
                                className="min-h-[36px] rounded-lg bg-accent-base/20 border border-accent-base/40 px-3 py-1.5 text-xs font-medium text-accent-text hover:bg-accent-base/30 transition-colors cursor-pointer"
                              >
                                Explore Pivot
                              </button>
                            ) : (
                              onExploreNode && (
                                <button
                                  type="button"
                                  onClick={() => onExploreNode(node, branch)}
                                  className="min-h-[36px] rounded-lg bg-accent-base/15 border border-accent-base/40 px-3 py-1.5 text-xs font-medium text-accent-text hover:bg-accent-base/25 transition-colors cursor-pointer"
                                >
                                  Explore Card
                                </button>
                              )
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </details>
    </section>
  );
}
