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

  useEffect(() => {
    try {
      const storedResult = sessionStorage.getItem('researchlens_result');
      const storedQueries = sessionStorage.getItem('researchlens_queries');
      const storedIdea = sessionStorage.getItem('researchlens_idea_data');

      if (!storedResult) {
        router.push('/');
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
      router.push('/');
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

  if (!result) {
    return null; // Redirecting...
  }

  return (
    <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/* Page header */}
      <div className="mb-8 animate-fade-in">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-2 h-2 rounded-full bg-status-success" />
          <span className="text-xs text-status-success font-medium uppercase tracking-wide">
            Analysis Complete
          </span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold text-text-primary mb-2">
          Your Research Gap Report
        </h2>
        <p className="text-sm text-text-tertiary">
          Based on {result.totalPapersRetrieved} real papers from{' '}
          {Object.values(result.sourceCounts).filter((c) => c > 0).length} academic sources
        </p>
      </div>

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
        onExplorePivot={idea ? handleExplorePivot : undefined}
        onExploreMindmapNode={idea ? handleExploreMindmapNode : undefined}
      />

      {/* Refine button */}
      <div className="mt-10 text-center animate-fade-in">
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
      </div>
    </div>
  );
}
