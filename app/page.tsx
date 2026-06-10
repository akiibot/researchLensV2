'use client';

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import SearchForm from '@/components/SearchForm';
import LoadingSteps from '@/components/LoadingSteps';
import {
  AnalysisResult,
  AppMode,
  FacultyProfile,
  GapDimension,
  Paper,
  ResearchIdea,
} from '@/lib/types';
import { rankPapers } from '@/lib/embedder';
import { analyzeGaps } from '@/lib/gapAnalyzer';

type PageState = 'idle' | 'loading' | 'error';

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

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pageState, setPageState] = useState<PageState>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [initialIdea, setInitialIdea] = useState('');
  const [selectedMode, setSelectedMode] = useState<AppMode | null>(null);

  useEffect(() => {
    if (searchParams.get('refine') !== 'true') return;

    try {
      const stored = sessionStorage.getItem('researchlens_idea');
      const storedIdeaData = sessionStorage.getItem('researchlens_idea_data');
      if (stored) {
        queueMicrotask(() => setInitialIdea(stored));
      }
      if (storedIdeaData) {
        const parsed = JSON.parse(storedIdeaData) as ResearchIdea;
        if (parsed.mode) {
          queueMicrotask(() => setSelectedMode(parsed.mode || 'student'));
        }
      }
    } catch {
      // sessionStorage unavailable
    }
  }, [searchParams]);

  const handleSubmit = useCallback(
    async (data: {
      text: string;
      field: string;
      level: 'undergraduate' | 'masters' | 'phd';
      language: 'en' | 'bn';
      mode: AppMode;
    }) => {
      setPageState('loading');
      setErrorMessage('');

      const idea: ResearchIdea = {
        text: data.text,
        field: data.field,
        level: data.level,
        language: data.language,
        mode: data.mode,
      };

      try {
        sessionStorage.setItem('researchlens_idea', data.text);

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
            'No papers found for this idea. Try rephrasing or broadening it.'
          );
        }

        const rankedPapers: Paper[] = rankPapers(papers, data.text);
        const gapMatrix: GapDimension[] = analyzeGaps(rankedPapers, data.text);

        let facultyMatches: FacultyProfile[] = [];
        try {
          const facultyResponse = await fetch('/api/faculty/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              idea,
              papers: rankedPapers.slice(0, 12),
              queries,
            }),
          });

          if (facultyResponse.ok) {
            const facultyData = await facultyResponse.json();
            facultyMatches = facultyData.faculty || [];
          }
        } catch (facultyError) {
          console.warn('Faculty search failed:', facultyError);
        }

        const analyzeResponse = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            idea,
            papers: rankedPapers.slice(0, 20),
            gapMatrix,
            facultyMatches,
          }),
        });

        let analysisResult: AnalysisResult;

        if (analyzeResponse.ok) {
          analysisResult = await analyzeResponse.json();
          analysisResult.topRelatedPapers = rankedPapers.slice(0, 3);
          analysisResult.totalPapersRetrieved = papers.length;
          analysisResult.sourceCounts = sourceCounts;
          analysisResult.gapMatrix = gapMatrix;
          analysisResult.facultyMatches = facultyMatches;
        } else {
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
              'AI analysis unavailable. The gap matrix was computed from keyword analysis.',
            topRelatedPapers: rankedPapers.slice(0, 3),
            gapMatrix,
            pivots: [],
            supervisorNote:
              'AI-generated note unavailable. Review the gap matrix for overlap assessment.',
            fundingFit: {
              readiness: 'medium',
              score: 50,
              bestAngles: [
                'Internal university seed funding',
                'Pilot thesis funding',
                'Department research support',
              ],
              funderCategories: [
                'University internal research grants',
                'Departmental thesis support funds',
                'Small seed grants',
              ],
              searchLinks: [
                {
                  label: 'Grants.gov search',
                  url: 'https://www.grants.gov/search-grants',
                  purpose: 'Search US federal funding opportunities by keyword.',
                },
                {
                  label: 'CORDIS projects',
                  url: 'https://cordis.europa.eu/projects',
                  purpose: 'Review EU-funded project examples and framing.',
                },
                {
                  label: 'World Bank projects',
                  url: 'https://projects.worldbank.org/',
                  purpose: 'Explore development-oriented funding themes.',
                },
              ],
              internalRoutes: [
                {
                  label: 'Faculty Directory',
                  href: '/faculty',
                  purpose: 'Find collaborators or supervisors who strengthen funding fit.',
                },
                {
                  label: 'Saved Reports',
                  href: '/reports',
                  purpose: 'Review saved analyses before preparing funding materials.',
                },
              ],
              connectorSuggestions: [
                {
                  name: 'Grants.gov',
                  type: 'government',
                  purpose: 'Live opportunity search for US federal grants.',
                  status: 'future_integration',
                },
                {
                  name: 'NIH RePORTER',
                  type: 'grant_database',
                  purpose: 'Find funded biomedical and behavioral research precedents.',
                  status: 'future_integration',
                },
                {
                  name: 'CORDIS',
                  type: 'grant_database',
                  purpose: 'Discover EU-funded project topics and consortium framing.',
                  status: 'future_integration',
                },
              ],
              grantReadyFraming:
                'The idea may be fundable as a small pilot once the outcome, method, and implementation context are narrowed.',
              weaknesses: [
                'AI analysis was unavailable.',
                'The measurable outcome needs sharper definition.',
              ],
              collaboratorProfiles: [
                'Subject-matter supervisor',
                'Methods or statistics advisor',
              ],
              outreachDrafts: [
                {
                  title: 'Funding office inquiry',
                  recipientType: 'funding_office',
                  body: 'Hello, I am preparing a small research pilot and would appreciate guidance on internal funding opportunities that support early-stage thesis or student research. Could you advise which internal schemes or deadlines may be appropriate?',
                },
                {
                  title: 'Potential collaborator note',
                  recipientType: 'potential_collaborator',
                  body: 'Dear Professor, I am developing a small pilot study and noticed that your expertise may align with the topic and methodology. I would value a brief conversation about whether the framing is feasible and whether there are collaboration or supervision pathways I should consider.',
                },
              ],
              miniGrantAbstract:
                'This pilot project will refine the research idea into a feasible, evidence-informed study. It will compare the proposed topic against existing literature, identify a defensible gap, and prepare a focused design suitable for supervisor review.',
              specificAims: [
                'Identify the closest related studies.',
                'Refine the method, population, and context.',
                'Prepare a supervisor-ready pilot proposal.',
              ],
              impactStatement:
                'The project can improve early thesis quality and reduce duplicated research effort.',
              budgetScale: 'small_internal',
            },
            totalPapersRetrieved: papers.length,
            sourceCounts,
            facultyMatches,
          };
        }

        analysisResult.credibilityReasons = buildCredibilityReasons(
          rankedPapers,
          sourceCounts
        );
        analysisResult.modelStatus = {
          reasoningModel:
            process.env.NEXT_PUBLIC_GEMINI_REASONING_LABEL ||
            'Gemini reasoning model',
          summaryModel:
            process.env.NEXT_PUBLIC_GEMINI_SUMMARY_LABEL ||
            'Gemini Flash summary model',
          note: 'Deep reasoning is used for gap analysis. Flash-class models are used for summaries and outreach drafts.',
        };

        sessionStorage.setItem(
          'researchlens_result',
          JSON.stringify(analysisResult)
        );
        sessionStorage.setItem('researchlens_queries', JSON.stringify(queries));
        sessionStorage.setItem('researchlens_idea_data', JSON.stringify(idea));

        try {
          const saveResponse = await fetch('/api/reports', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idea, result: analysisResult, queries }),
          });

          if (saveResponse.ok) {
            const saved = await saveResponse.json();
            if (saved.id) {
              analysisResult.savedReportId = saved.id;
              sessionStorage.setItem(
                'researchlens_result',
                JSON.stringify(analysisResult)
              );
            }
          }
        } catch (saveError) {
          console.warn('Report save failed:', saveError);
        }

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

  if ((pageState === 'idle' || pageState === 'error') && !selectedMode) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 py-12">
        <div className="text-center mb-8 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-bg-secondary border border-border-subtle mb-6">
            <div className="w-1.5 h-1.5 rounded-full bg-status-success" />
            <span className="text-xs text-text-secondary font-medium">
              Research guidance for students and faculty
            </span>
          </div>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-4">
            Choose your workflow
          </h2>
          <p className="text-base sm:text-lg text-text-secondary max-w-xl mx-auto">
            Validate a thesis idea, find potential supervisors, or review a
            topic as faculty.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-3xl">
          <WorkflowButton
            label="Student"
            title="Validate my topic and find supervisors"
            description="Check overlap risk, identify gap dimensions, get pivots, find potential supervisors, and prepare an outreach note."
            onClick={() => setSelectedMode('student')}
          />
          <WorkflowButton
            label="Faculty"
            title="Review a topic and explore related researchers"
            description="Evaluate evidence quality, inspect novelty signals, and discover related researchers or collaborators."
            onClick={() => setSelectedMode('faculty')}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 py-12">
      {(pageState === 'idle' || pageState === 'error') && (
        <div className="text-center mb-10 animate-fade-in">
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-4">
            {selectedMode === 'faculty' ? 'Find the right' : 'Find your'}{' '}
            <span className="text-accent-base">
              {selectedMode === 'faculty' ? 'research fit' : 'research gap'}
            </span>
          </h2>
          <p className="text-base sm:text-lg text-text-secondary max-w-xl mx-auto mb-2">
            {selectedMode === 'faculty'
              ? 'Describe a topic. ResearchLens reviews the evidence, novelty signals, and related researchers.'
              : 'Describe your thesis idea. ResearchLens searches academic databases, identifies overlap, suggests pivots, and finds potential supervisors.'}
          </p>
          <p className="text-xs text-text-tertiary max-w-md mx-auto">
            Every paper shown comes from real API responses; no invented citations.
          </p>
          <button
            type="button"
            onClick={() => setSelectedMode(null)}
            className="mt-4 text-xs text-accent-base hover:text-accent-hover cursor-pointer min-h-[44px]"
          >
            Change workflow
          </button>
        </div>
      )}

      {pageState === 'error' && (
        <div className="w-full max-w-2xl mb-6 animate-slide-up">
          <div className="bg-status-error-bg border border-status-error rounded-xl px-4 py-3">
            <p className="text-sm text-status-error font-medium">
              Analysis failed
            </p>
            <p className="text-xs text-status-error mt-0.5">{errorMessage}</p>
          </div>
        </div>
      )}

      {(pageState === 'idle' || pageState === 'error') && selectedMode && (
        <div className="w-full animate-slide-up" style={{ animationDelay: '0.2s' }}>
          <SearchForm
            onSubmit={handleSubmit}
            isLoading={false}
            initialIdea={initialIdea}
            mode={selectedMode}
          />
        </div>
      )}

      {pageState === 'loading' && (
        <div className="animate-fade-in">
          <LoadingSteps />
        </div>
      )}
    </div>
  );
}

function WorkflowButton({
  label,
  title,
  description,
  onClick,
}: {
  label: string;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="surface-card surface-card-hover p-6 text-left min-h-[180px] cursor-pointer"
    >
      <p className="text-xs uppercase tracking-wide text-accent-base font-semibold mb-3">
        {label}
      </p>
      <h3 className="text-xl font-bold text-text-primary mb-2">{title}</h3>
      <p className="text-sm text-text-secondary">{description}</p>
    </button>
  );
}

function buildCredibilityReasons(
  papers: Paper[],
  sourceCounts: Record<string, number>
): string[] {
  const sourceTotal = Object.values(sourceCounts).filter((count) => count > 0).length;
  const doiCount = papers.filter((paper) => paper.doi).length;
  const recentCount = papers.filter(
    (paper) => paper.year && paper.year >= new Date().getFullYear() - 5
  ).length;

  return [
    `${papers.length} unique papers were retrieved and ranked.`,
    `${sourceTotal} scholarly source${sourceTotal === 1 ? '' : 's'} contributed results.`,
    `${doiCount} retrieved paper${doiCount === 1 ? '' : 's'} include DOI links.`,
    `${recentCount} paper${recentCount === 1 ? '' : 's'} were published in the last five years.`,
  ];
}
