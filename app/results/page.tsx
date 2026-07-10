/**
 * @file Results Page
 *
 * Displays the complete research gap analysis results.
 * Reads analysis data from sessionStorage (set by the input page
 * after pipeline completion).
 *
 * If no data is found, redirects to the home page.
 *
 * @page /results
 */

'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ResultsPanel from '@/components/ResultsPanel';
import {
  AnalysisResult,
  Pivot,
  PivotExplorationContext,
  ResearchIdea,
  ThesisMindmapBranch,
  ThesisMindmapNode,
} from '@/lib/types';

/**
 * ResultsPage renders the full analysis results display.
 * Reads data from sessionStorage and renders the ResultsPanel.
 */
export default function ResultsPage() {
  const router = useRouter();
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [queries, setQueries] = useState<string[]>([]);
  const [idea, setIdea] = useState<ResearchIdea | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    try {
      const storedResult = sessionStorage.getItem('researchlens_result');
      const storedQueries = sessionStorage.getItem('researchlens_queries');
      const storedIdea = sessionStorage.getItem('researchlens_idea_data');

      if (!storedResult) {
        queueMicrotask(() => {
          setSessionExpired(true);
          setIsLoading(false);
        });
        return;
      }

      const parsedResult = JSON.parse(storedResult);
      const parsedQueries = storedQueries ? JSON.parse(storedQueries) : [];
      const parsedIdea = storedIdea ? JSON.parse(storedIdea) : null;

      queueMicrotask(() => {
        setResult(parsedResult);
        setQueries(parsedQueries);
        if (parsedIdea) {
          setIdea(parsedIdea);
        }
        setIsLoading(false);
      });
    } catch {
      queueMicrotask(() => {
        setSessionExpired(true);
        setIsLoading(false);
      });
    }
  }, [router]);

  const handleRefine = () => {
    router.push('/?refine=true');
  };

  const handleExplorePivot = (pivot: Pivot) => {
    if (!idea) return;

    const pivotIdea = `${pivot.title}: ${pivot.description}`;
    const pivotContext: PivotExplorationContext = {
      pivotTitle: pivot.title,
      targetGap: pivot.targetGap,
      previousIdeaText: idea.text,
    };

    sessionStorage.setItem('researchlens_idea', pivotIdea);
    sessionStorage.setItem(
      'researchlens_idea_data',
      JSON.stringify({
        ...idea,
        text: pivotIdea,
      })
    );
    sessionStorage.setItem(
      'researchlens_pivot_context',
      JSON.stringify(pivotContext)
    );

    router.push('/?refine=true&fromPivot=true');
  };

  const handleExploreMindmapNode = (
    node: ThesisMindmapNode,
    branch: ThesisMindmapBranch
  ) => {
    if (!idea) return;

    const targetGap =
      branch.kind === 'topic' ||
      branch.kind === 'method' ||
      branch.kind === 'population' ||
      branch.kind === 'geography'
        ? branch.kind
        : 'topic';
    const cardIdea = `${node.label}: ${node.description}`;
    const pivotContext: PivotExplorationContext = {
      pivotTitle: node.label,
      targetGap,
      previousIdeaText: idea.text,
    };

    sessionStorage.setItem('researchlens_idea', cardIdea);
    sessionStorage.setItem(
      'researchlens_idea_data',
      JSON.stringify({
        ...idea,
        text: cardIdea,
        evidenceScope: 'balanced',
      })
    );
    sessionStorage.setItem(
      'researchlens_pivot_context',
      JSON.stringify(pivotContext)
    );

    router.push('/?refine=true&fromPivot=true');
  };

  if (isLoading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-accent-base border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-text-tertiary">Loading results...</p>
        </div>
      </div>
    );
  }

  if (sessionExpired || !result) {
    return (
      <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <p className="text-xs uppercase tracking-wide text-accent-base font-semibold mb-2">
          No report to show
        </p>
        <h2 className="text-2xl font-bold text-text-primary mb-3">
          Your session doesn&apos;t have a saved report
        </h2>
        <p className="text-sm text-text-secondary mb-6">
          This can happen if the tab was refreshed, the link was opened in a new tab, or your
          previous session expired. Start a new search to generate a fresh report.
        </p>
        <button
          onClick={() => router.push('/')}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-accent-base text-sm font-semibold text-white hover:bg-accent-hover transition-all cursor-pointer"
        >
          Start a new search
        </button>
      </div>
    );
  }

  return (
    <div className="results-app-shell min-h-dvh w-full px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      {/* Bangla Translation Notice */}
      {idea?.language === 'bn' && (
        <div className="mb-6 p-4 rounded-xl bg-accent-base/10 border border-accent-base/20 text-text-secondary animate-slide-up flex gap-3 items-start">
          <div>
            <p className="text-sm font-semibold text-accent-text mb-0.5">Translated from Bangla</p>
            <p className="text-xs text-text-tertiary">
              Your research idea was detected in Bangla and translated to English for academic database search and analysis.
            </p>
            <div className="mt-2 bg-bg-secondary rounded-lg p-2.5 border border-border-subtle text-xs italic font-serif">
              &quot;{idea.text}&quot;
            </div>
          </div>
        </div>
      )}

      {/* Results panel */}
      <ResultsPanel
        result={result}
        queries={queries}
        mode={idea?.mode}
        onRefine={handleRefine}
        onExplorePivot={idea ? handleExplorePivot : undefined}
        onExploreMindmapNode={idea ? handleExploreMindmapNode : undefined}
      />

      {/* Refine / new search buttons */}
      <div className="mt-10 flex flex-wrap items-center justify-center gap-3 animate-fade-in">
        <button
          onClick={handleRefine}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-bg-secondary border border-border-subtle text-sm font-medium text-text-secondary hover:text-text-primary hover:border-accent-base/40 hover:bg-accent-base/10 transition-all cursor-pointer token-focus"
        >
          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
              clipRule="evenodd"
            />
          </svg>
          Refine Your Idea
        </button>
        <button
          onClick={() => router.push('/')}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-border-subtle text-sm font-medium text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary transition-all cursor-pointer token-focus"
        >
          Start a New Search
        </button>
      </div>
    </div>
  );
}
