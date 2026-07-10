'use client';

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import SearchForm from '@/components/SearchForm';
import LoadingSteps from '@/components/LoadingSteps';
import {
  AnalysisResult,
  AppMode,
  EvidenceScope,
  FacultyProfile,
  GapDimension,
  Paper,
  PivotExplorationContext,
  ResearchIdea,
  RetrievalDepth,
  RetrievalSource,
} from '@/lib/types';
import { rankPapersWithEvidenceScope } from '@/lib/evidenceScope';
import { analyzeGaps } from '@/lib/gapAnalyzer';
import { computeResearchSanityMatrix } from '@/lib/sanityMatrix';
import { buildThesisMindmap } from '@/lib/thesisMindmap';
import { ownerIdHeaders } from '@/lib/ownerToken';
import { getFundingConnectorUrl } from '@/lib/fundingConnectors';

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
  const [initialIdeaData, setInitialIdeaData] = useState<ResearchIdea | null>(
    null
  );
  const [selectedMode, setSelectedMode] = useState<AppMode>('student');
  const [pivotContext, setPivotContext] =
    useState<PivotExplorationContext | null>(null);

  useEffect(() => {
    if (searchParams.get('refine') !== 'true') return;

    try {
      const stored = sessionStorage.getItem('researchlens_idea');
      const storedIdeaData = sessionStorage.getItem('researchlens_idea_data');
      const storedPivotContext = sessionStorage.getItem(
        'researchlens_pivot_context'
      );
      if (stored) {
        queueMicrotask(() => setInitialIdea(stored));
      }
      if (searchParams.get('fromPivot') === 'true' && storedPivotContext) {
        const parsedPivotContext = JSON.parse(
          storedPivotContext
        ) as PivotExplorationContext;
        queueMicrotask(() => setPivotContext(parsedPivotContext));
      } else {
        queueMicrotask(() => setPivotContext(null));
      }
      if (storedIdeaData) {
        const parsed = JSON.parse(storedIdeaData) as ResearchIdea;
        queueMicrotask(() => setInitialIdeaData(parsed));
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
      evidenceScope: EvidenceScope;
      retrievalDepth: RetrievalDepth;
      enabledSources: RetrievalSource[];
    }) => {
      setPageState('loading');
      setErrorMessage('');

      const idea: ResearchIdea = {
        text: data.text,
        field: data.field,
        level: data.level,
        language: data.language,
        mode: data.mode,
        evidenceScope: data.evidenceScope,
      };

      try {
        sessionStorage.setItem('researchlens_idea', data.text);

        const retrieveResponse = await fetch('/api/retrieve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            idea,
            retrieval: {
              depth: data.retrievalDepth,
              enabledSources: data.enabledSources,
            },
          }),
        });

        if (!retrieveResponse.ok) {
          const error = await retrieveResponse.json();
          throw new Error(error.error || 'Failed to retrieve papers');
        }

        const { papers, sourceCounts, queries, searchDiagnostics, demoData } =
          await retrieveResponse.json();

        if (!papers || papers.length === 0) {
          throw new Error(
            'No papers found for this idea. Try rephrasing or broadening it.'
          );
        }

        const { rankedPapers, diagnostics: evidenceScopeDiagnostics } =
          rankPapersWithEvidenceScope(
            papers,
            data.text,
            data.evidenceScope
          );
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

        const sanityMatrix = computeResearchSanityMatrix({
          ideaText: data.text,
          papers: rankedPapers,
          gapMatrix,
          sourceCounts,
          facultyMatches,
          evidenceScope: data.evidenceScope,
        });

        const analyzeResponse = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            idea,
            papers: rankedPapers.slice(0, 20),
            gapMatrix,
            facultyMatches,
            sanityMatrix,
            evidenceScopeDiagnostics,
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
          analysisResult.sanityMatrix = sanityMatrix;
          analysisResult.evidenceScopeDiagnostics = evidenceScopeDiagnostics;
          analysisResult.searchDiagnostics = searchDiagnostics;
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
                  url: getFundingConnectorUrl('Grants.gov'),
                  purpose: 'Search US federal funding opportunities by keyword.',
                },
                {
                  label: 'CORDIS projects',
                  url: getFundingConnectorUrl('CORDIS'),
                  purpose: 'Review EU-funded project examples and framing.',
                },
                {
                  label: 'World Bank projects',
                  url: getFundingConnectorUrl('World Bank Projects'),
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
            sanityMatrix,
            evidenceScopeDiagnostics,
            searchDiagnostics,
            analysisDegraded: true,
          };
        }

        if (demoData) {
          analysisResult.demoData = true;
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
        analysisResult.thesisMindmap = buildThesisMindmap({
          ideaText: data.text,
          rankedPapers,
          gapMatrix,
          pivots: analysisResult.pivots,
          sanityMatrix,
          evidenceScopeDiagnostics,
          sourceCounts,
        });

        const trySetSessionStorage = (key: string, value: string): boolean => {
          try {
            sessionStorage.setItem(key, value);
            return true;
          } catch {
            return false;
          }
        };

        let storedResult = trySetSessionStorage(
          'researchlens_result',
          JSON.stringify(analysisResult)
        );

        if (!storedResult) {
          // Likely a sessionStorage QuotaExceededError on a large `full`
          // depth report. Retry with the bulkiest, least essential field
          // dropped rather than losing the whole report.
          const slimResult: AnalysisResult = {
            ...analysisResult,
            thesisMindmap: undefined,
            storageTruncated: true,
          };
          storedResult = trySetSessionStorage(
            'researchlens_result',
            JSON.stringify(slimResult)
          );
          if (storedResult) {
            analysisResult = slimResult;
          }
        }

        if (!storedResult) {
          throw new Error(
            'Your report was generated successfully, but it was too large to store in this browser tab. Try a smaller retrieval depth (Fast or Balanced) and search again.'
          );
        }

        sessionStorage.setItem('researchlens_queries', JSON.stringify(queries));
        sessionStorage.setItem('researchlens_idea_data', JSON.stringify(idea));

        try {
          const saveResponse = await fetch('/api/reports', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...ownerIdHeaders() },
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

  return (
    <div
      className="relative w-full overflow-hidden"
      style={
        pageState !== 'loading'
          ? { backgroundImage: 'linear-gradient(242deg, oklch(31.7% 0.072 283.7) 0%, #000 100%)' }
          : undefined
      }
    >
      {(pageState === 'idle' || pageState === 'error') && (
        <div
          className="pointer-events-none absolute inset-0 hidden overflow-hidden lg:block"
          aria-hidden="true"
        >
          <div
            className="absolute h-[550px] w-[850px] opacity-60"
            style={{ left: '-240px', top: '-120px', transform: 'rotate(86deg)' }}
          >
            <Image
              src="/images/hero-swirl.jpg"
              alt=""
              fill
              sizes="850px"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black" />
          </div>
          <div
            className="absolute h-[650px] w-[900px] opacity-50"
            style={{ right: '-280px', top: '-160px', transform: 'rotate(-104deg)' }}
          >
            <Image
              src="/images/hero-swirl.jpg"
              alt=""
              fill
              sizes="900px"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-bl from-transparent to-accent-base/20" />
          </div>
        </div>
      )}

      <div className="relative z-10 flex min-h-[80vh] flex-col items-center justify-center px-4 py-12">
        {pageState === 'loading' && (
          <div className="animate-fade-in">
            <LoadingSteps />
          </div>
        )}

        {(pageState === 'idle' || pageState === 'error') && (
          <div className="w-full max-w-6xl">
            {pageState === 'error' && (
              <div className="mb-6 animate-slide-up">
                <div className="mx-auto max-w-2xl rounded-xl border border-status-error bg-status-error-bg px-4 py-3 lg:mx-0">
                  <p className="text-sm font-medium text-status-error">
                    Analysis failed
                  </p>
                  <p className="mt-0.5 text-xs text-status-error">{errorMessage}</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-[1fr_1.15fr] lg:gap-16">
              <div className="animate-fade-in text-center lg:text-left">
                <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border-subtle bg-bg-secondary px-4 py-1.5">
                  <div className="h-1.5 w-1.5 rounded-full bg-status-success" />
                  <span className="text-xs font-medium text-text-secondary">
                    Research guidance for students and faculty
                  </span>
                </div>
                <h2 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
                  {selectedMode === 'faculty' ? 'Find the right' : 'Find your'}{' '}
                  <span className="text-accent-base">
                    {selectedMode === 'faculty' ? 'research fit' : 'research gap'}
                  </span>
                </h2>
                <p className="mx-auto mb-2 max-w-xl text-base text-text-secondary sm:text-lg lg:mx-0">
                  {selectedMode === 'faculty'
                    ? 'Describe a topic. ResearchLens reviews the evidence, novelty signals, and related researchers.'
                    : 'Describe your thesis idea. ResearchLens searches academic databases, identifies overlap, suggests pivots, and finds potential supervisors.'}
                </p>
                <p className="mx-auto max-w-md text-xs text-text-tertiary lg:mx-0">
                  Every paper shown comes from real API responses; no invented citations.
                </p>
              </div>

              <div className="w-full animate-slide-up" style={{ animationDelay: '0.2s' }}>
                <SearchForm
                  onSubmit={handleSubmit}
                  isLoading={false}
                  initialIdea={initialIdea}
                  initialIdeaData={initialIdeaData || undefined}
                  mode={selectedMode}
                  onModeChange={setSelectedMode}
                  pivotContext={pivotContext}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
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
