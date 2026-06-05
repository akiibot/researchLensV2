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
import { AnalysisResult, ResearchIdea } from '@/lib/types';

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

      setResult(JSON.parse(storedResult));
      if (storedQueries) {
        setQueries(JSON.parse(storedQueries));
      }
      if (storedIdea) {
        setIdea(JSON.parse(storedIdea));
      }
    } catch {
      router.push('/');
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  const handleRefine = () => {
    router.push('/?refine=true');
  };

  if (isLoading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-slate-400">Loading results...</p>
        </div>
      </div>
    );
  }

  if (!result) {
    return null; // Redirecting...
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      {/* Page header */}
      <div className="mb-8 animate-fade-in">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400" />
          <span className="text-xs text-emerald-400 font-medium uppercase tracking-wide">
            Analysis Complete
          </span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">
          Your Research Gap Report
        </h2>
        <p className="text-sm text-slate-400">
          Based on {result.totalPapersRetrieved} real papers from{' '}
          {Object.values(result.sourceCounts).filter((c) => c > 0).length} academic sources
        </p>
      </div>

      {/* Bangla Translation Notice */}
      {idea?.language === 'bn' && (
        <div className="mb-6 p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-slate-300 animate-slide-up flex gap-3 items-start">
          <span className="text-lg">📢</span>
          <div>
            <p className="text-sm font-semibold text-indigo-300 mb-0.5">Translated from Bangla</p>
            <p className="text-xs text-slate-400">
              Your research idea was detected in Bangla and translated to English for academic database search and analysis.
            </p>
            <div className="mt-2 bg-slate-900/50 rounded-lg p-2.5 border border-slate-800 text-xs italic font-serif">
              "{idea.text}"
            </div>
          </div>
        </div>
      )}

      {/* Results panel */}
      <ResultsPanel result={result} queries={queries} />

      {/* Refine button */}
      <div className="mt-10 text-center animate-fade-in">
        <button
          onClick={handleRefine}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-sm font-medium text-slate-300 hover:text-white hover:border-indigo-500/30 hover:bg-indigo-500/5 transition-all cursor-pointer"
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
