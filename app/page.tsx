/**
 * @file Landing & Input Page
 *
 * The main entry point for ResearchLens. Displays:
 * - Hero section with gradient tagline
 * - Research idea input form (SearchForm component)
 * - Loading steps animation during pipeline execution
 *
 * On completion, navigates to /results with data in sessionStorage.
 *
 * @page /
 */

'use client';

import React, { useState, useCallback, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import SearchForm from '@/components/SearchForm';
import LoadingSteps from '@/components/LoadingSteps';
import { ResearchIdea, AnalysisResult, Paper, GapDimension } from '@/lib/types';
import { rankPapers } from '@/lib/embedder';
import { analyzeGaps } from '@/lib/gapAnalyzer';

/** Page states */
type PageState = 'idle' | 'loading' | 'error';

/**
 * Home page wraps HomeContent in a Suspense boundary
 * (required by Next.js for useSearchParams).
 */
export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[80vh]">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <HomeContent />
    </Suspense>
  );
}

/**
 * HomeContent renders the landing + input experience.
 * Manages the pipeline: form submit → retrieve → rank → gap matrix → analyze → navigate.
 */
function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pageState, setPageState] = useState<PageState>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [initialIdea, setInitialIdea] = useState('');

  // Check for refine flow
  useEffect(() => {
    if (searchParams.get('refine') === 'true') {
      try {
        const stored = sessionStorage.getItem('researchlens_idea');
        if (stored) setInitialIdea(stored);
      } catch {
        // sessionStorage unavailable
      }
    }
  }, [searchParams]);

  /**
   * Handles form submission — runs the full pipeline.
   */
  const handleSubmit = useCallback(
    async (data: {
      text: string;
      field: string;
      level: 'undergraduate' | 'masters' | 'phd';
      language: 'en' | 'bn';
    }) => {
      setPageState('loading');
      setErrorMessage('');

      const idea: ResearchIdea = {
        text: data.text,
        field: data.field,
        level: data.level,
        language: data.language,
      };

      try {
        // Store idea for refine flow
        sessionStorage.setItem('researchlens_idea', data.text);

        // Step 1: Retrieve papers from APIs
        const retrieveResponse = await fetch('/api/retrieve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idea }),
        });

        if (!retrieveResponse.ok) {
          const error = await retrieveResponse.json();
          throw new Error(error.error || 'Failed to retrieve papers');
        }

        const { papers, sourceCounts, queries } = await retrieveResponse.json();

        if (!papers || papers.length === 0) {
          throw new Error(
            'No papers found for this research idea. Try rephrasing or broadening your idea.'
          );
        }

        // Step 2: Rank papers by similarity (client-side, lightweight)
        const rankedPapers: Paper[] = rankPapers(papers, data.text);

        // Step 3: Compute gap matrix (client-side)
        const gapMatrix: GapDimension[] = analyzeGaps(rankedPapers, data.text);

        // Step 4: Send to Claude for analysis
        const analyzeResponse = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            idea,
            papers: rankedPapers.slice(0, 20),
            gapMatrix,
          }),
        });

        let analysisResult: AnalysisResult;

        if (analyzeResponse.ok) {
          analysisResult = await analyzeResponse.json();
          // Merge in the full ranked papers and source counts
          analysisResult.topRelatedPapers = rankedPapers.slice(0, 3);
          analysisResult.totalPapersRetrieved = papers.length;
          analysisResult.sourceCounts = sourceCounts;
          analysisResult.gapMatrix = gapMatrix;
        } else {
          // Fallback: use pre-computed data without LLM analysis
          const crowdedCount = gapMatrix.filter(
            (g) => g.saturation === 'crowded'
          ).length;

          analysisResult = {
            overlapRisk:
              crowdedCount >= 3 ? 'high' : crowdedCount >= 2 ? 'medium' : 'low',
            evidenceConfidence:
              papers.length >= 30
                ? 'high'
                : papers.length >= 15
                  ? 'medium'
                  : 'low',
            noveltySignal:
              crowdedCount >= 3
                ? 'weak'
                : crowdedCount >= 2
                  ? 'moderate'
                  : 'strong',
            overlapExplanation:
              'AI analysis unavailable. Gap matrix was computed from keyword analysis.',
            topRelatedPapers: rankedPapers.slice(0, 3),
            gapMatrix,
            pivots: [],
            supervisorNote:
              'AI-generated note unavailable. Review the gap matrix for overlap assessment.',
            totalPapersRetrieved: papers.length,
            sourceCounts,
          };
        }

        // Store results and navigate
        sessionStorage.setItem(
          'researchlens_result',
          JSON.stringify(analysisResult)
        );
        sessionStorage.setItem(
          'researchlens_queries',
          JSON.stringify(queries)
        );
        sessionStorage.setItem(
          'researchlens_idea_data',
          JSON.stringify(idea)
        );

        router.push('/results');
      } catch (error) {
        console.error('Pipeline error:', error);
        setPageState('error');
        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred. Please try again.'
        );
      }
    },
    [router]
  );

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 py-12">
      {/* Hero section — shown when idle or error */}
      {(pageState === 'idle' || pageState === 'error') && (
        <div className="text-center mb-10 animate-fade-in">
          {/* Decorative badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-bg-secondary border border-border-subtle mb-6">
            <div className="w-1.5 h-1.5 rounded-full bg-status-success" />
            <span className="text-xs text-text-secondary font-medium">
              Powered by 250M+ real academic papers
            </span>
          </div>

          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-4">
            Find your{' '}
            <span className="text-accent-base">research gap</span>
          </h2>
          <p className="text-base sm:text-lg text-text-secondary max-w-xl mx-auto mb-2">
            Describe your thesis idea. ResearchLens searches real academic databases,
            identifies overlap, and suggests evidence-backed pivots.
          </p>
          <p className="text-xs text-text-tertiary max-w-md mx-auto">
            Every paper shown comes from real API responses — no hallucinated citations.
          </p>
        </div>
      )}

      {/* Error banner */}
      {pageState === 'error' && (
        <div className="w-full max-w-2xl mb-6 animate-slide-up">
          <div className="bg-status-error-bg border border-status-error rounded-xl px-4 py-3 flex items-start gap-3">
            <svg
              className="w-5 h-5 text-status-error flex-shrink-0 mt-0.5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            <div>
              <p className="text-sm text-status-error font-medium">
                Analysis Failed
              </p>
              <p className="text-xs text-status-error mt-0.5">
                {errorMessage}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Search form — shown when idle or error */}
      {(pageState === 'idle' || pageState === 'error') && (
        <div className="w-full animate-slide-up" style={{ animationDelay: '0.2s' }}>
          <SearchForm
            onSubmit={handleSubmit}
            isLoading={false}
            initialIdea={initialIdea}
          />
        </div>
      )}

      {/* Loading state */}
      {pageState === 'loading' && (
        <div className="animate-fade-in">
          <LoadingSteps />
        </div>
      )}
    </div>
  );
}
