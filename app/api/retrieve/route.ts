/**
 * @file Paper Retrieval API Route
 *
 * POST /api/retrieve
 *
 * Accepts a ResearchIdea, expands it into search queries, fires queries
 * against OpenAlex + Semantic Scholar + PubMed + DataCite + arXiv + Europe PMC + CORE in parallel using
 * Promise.allSettled (so one source failing doesn't block others),
 * deduplicates results by DOI/title, and returns the combined corpus.
 *
 * All API calls happen server-side — no API keys are exposed to the client.
 *
 * @module api/retrieve
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  ResearchIdea,
  RetrievalResponse,
  ApiError,
  Paper,
  RetrievalDepth,
  RetrievalSource,
} from '@/lib/types';
import { expandQueries } from '@/lib/queryExpansion';
import { searchOpenAlexBatch } from '@/lib/openalexClient';
import { searchSemanticScholarBatch } from '@/lib/semanticScholarClient';
import { searchDataCiteBatch } from '@/lib/dataciteClient';
import { searchArxivBatch } from '@/lib/arxivClient';
import { searchEuropePmcBatch } from '@/lib/europePmcClient';
import { searchCoreBatch } from '@/lib/coreClient';
import { searchPubMedBatch } from '@/lib/pubmedClient';
import { enrichPapersWithUnpaywall } from '@/lib/unpaywallClient';
import { applyAccessInfo } from '@/lib/paperAccess';
import {
  buildDriftWarning,
  buildFacetedQueries,
  shouldSkipBiomedicalSources,
} from '@/lib/facetedRetrieval';
import { deduplicatePapers } from '@/lib/deduplicator';
import { MOCK_PAPERS } from '@/lib/mockData';
import { hasGeminiCredentials } from '@/lib/geminiClient';

const ALL_RETRIEVAL_SOURCES: RetrievalSource[] = [
  'openalex',
  'semanticscholar',
  'datacite',
  'arxiv',
  'europepmc',
  'core',
  'pubmed',
];

function parseEnabledSources(value: unknown): Set<RetrievalSource> {
  if (!Array.isArray(value)) {
    return new Set(ALL_RETRIEVAL_SOURCES);
  }

  const allowed = new Set<RetrievalSource>(ALL_RETRIEVAL_SOURCES);
  const selected = value.filter((source): source is RetrievalSource =>
    allowed.has(source as RetrievalSource)
  );

  return new Set(selected.length > 0 ? selected : ALL_RETRIEVAL_SOURCES);
}

function emptySourceCounts(): Record<RetrievalSource, number> {
  return {
    openalex: 0,
    semanticscholar: 0,
    datacite: 0,
    arxiv: 0,
    europepmc: 0,
    core: 0,
    pubmed: 0,
  };
}

function parseRetrievalDepth(value: unknown): RetrievalDepth {
  return ['fast', 'balanced', 'full', 'custom'].includes(String(value))
    ? (String(value) as RetrievalDepth)
    : 'full';
}

function selectQueriesForDepth(
  queries: string[],
  depth: RetrievalDepth
): string[] {
  if (depth === 'fast') return queries.slice(0, 4);
  if (depth === 'balanced') return queries.slice(0, 6);
  return queries;
}

function getUnpaywallLimit(depth: RetrievalDepth): number {
  if (depth === 'fast') return 0;
  if (depth === 'balanced') return 10;
  return 25;
}

/**
 * Handles POST requests for paper retrieval.
 *
 * Pipeline:
 * 1. Validate input
 * 2. Expand research idea into 5–8 search queries
 * 3. Fire all source queries in parallel (Promise.allSettled)
 * 4. Collect results and count per source
 * 5. Deduplicate by DOI / title similarity
 * 6. Return combined corpus
 *
 * @param request - Next.js request containing { idea: ResearchIdea }
 * @returns JSON response with deduplicated papers, source counts, and queries
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<RetrievalResponse | ApiError>> {
  try {
    const body = await request.json();
    const idea: ResearchIdea = body.idea;
    const retrievalDepth = parseRetrievalDepth(body.retrieval?.depth || body.retrievalDepth);
    const enabledSources = parseEnabledSources(body.retrieval?.enabledSources || body.sources);

    // Validate input
    if (!idea?.text || idea.text.trim().length === 0) {
      return NextResponse.json(
        { error: 'Research idea text is required', code: 'MISSING_IDEA' },
        { status: 400 }
      );
    }

    if (idea.text.trim().length < 10) {
      return NextResponse.json(
        {
          error: 'Please provide a more detailed research idea (at least 10 characters)',
          code: 'IDEA_TOO_SHORT',
        },
        { status: 400 }
      );
    }

    console.log(`[retrieve] Starting retrieval for: "${idea.text.slice(0, 80)}..."`);

    // Check for demo/fallback mode
    if (!hasGeminiCredentials()) {
      console.log('[retrieve] No GOOGLE_API_KEY set — returning mock papers');
      const mockQueries = [
        'social media exam anxiety',
        'social networking sites test anxiety',
        'smartphone distraction university learning',
        'student mental health assessment distress',
        'academic performance screen time correlation'
      ];
      const sourceCounts = {
        openalex: MOCK_PAPERS.filter(p => p.source === 'openalex').length,
        semanticscholar: MOCK_PAPERS.filter(p => p.source === 'semanticscholar').length,
        datacite: MOCK_PAPERS.filter(p => p.source === 'datacite').length,
        arxiv: 0,
        europepmc: 0,
        core: 0,
        pubmed: 0,
      };
      return NextResponse.json({
        papers: MOCK_PAPERS,
        sourceCounts,
        queries: mockQueries,
        searchDiagnostics: {
          problem: [],
          domain: [],
          languageContext: [],
          method: [],
          intervention: [],
          geography: [],
          generatedQueries: mockQueries,
          skippedSources: [],
        },
      });
    }

    // Step 1: Expand into search queries
    const queries = await expandQueries(idea);
    const searchDiagnostics = buildFacetedQueries(idea, queries);
    if (shouldSkipBiomedicalSources(idea)) {
      enabledSources.delete('pubmed');
      enabledSources.delete('europepmc');
    }
    const retrievalQueries = selectQueriesForDepth(queries, retrievalDepth);
    console.log(`[retrieve] Expanded into ${queries.length} queries:`, queries);

    // Step 2: Fire all source queries in parallel
    const [
      openAlexResult,
      semanticScholarResult,
      dataCiteResult,
      arxivResult,
      europePmcResult,
      coreResult,
      pubMedResult,
    ] =
      await Promise.allSettled([
        enabledSources.has('openalex') ? searchOpenAlexBatch(retrievalQueries) : Promise.resolve([]),
        enabledSources.has('semanticscholar')
          ? searchSemanticScholarBatch(retrievalQueries)
          : Promise.resolve([]),
        enabledSources.has('datacite') ? searchDataCiteBatch(retrievalQueries) : Promise.resolve([]),
        enabledSources.has('arxiv') ? searchArxivBatch(retrievalQueries) : Promise.resolve([]),
        enabledSources.has('europepmc') ? searchEuropePmcBatch(retrievalQueries) : Promise.resolve([]),
        enabledSources.has('core') ? searchCoreBatch(retrievalQueries) : Promise.resolve([]),
        enabledSources.has('pubmed') ? searchPubMedBatch(retrievalQueries) : Promise.resolve([]),
      ]);

    // Step 3: Collect results and track source counts
    const sourceCounts = emptySourceCounts();

    const allPapers: Paper[] = [];
    const warnings: string[] = [];

    const collectResult = (
      sourceKey: RetrievalSource,
      sourceLabel: string,
      result: PromiseSettledResult<Paper[]>
    ) => {
      if (result.status === 'fulfilled') {
        allPapers.push(...result.value);
        sourceCounts[sourceKey] = result.value.length;
        console.log(`[retrieve] ${sourceLabel} returned ${result.value.length} papers`);
      } else {
        warnings.push(`${sourceLabel} search failed`);
        console.error(`[retrieve] ${sourceLabel} failed:`, result.reason);
      }
    };

    collectResult('openalex', 'OpenAlex', openAlexResult);
    collectResult('semanticscholar', 'Semantic Scholar', semanticScholarResult);
    collectResult('datacite', 'DataCite', dataCiteResult);
    collectResult('arxiv', 'arXiv', arxivResult);
    collectResult('europepmc', 'Europe PMC', europePmcResult);
    collectResult('core', 'CORE', coreResult);
    collectResult('pubmed', 'PubMed', pubMedResult);

    // Check if ALL sources failed
    if (allPapers.length === 0) {
      return NextResponse.json(
        {
          error:
            'All paper sources failed to return results. Please try again in a few moments.',
          code: 'ALL_SOURCES_FAILED',
        },
        { status: 503 }
      );
    }

    // Step 4: Deduplicate
    const deduplicated = await enrichPapersWithUnpaywall(
      deduplicatePapers(allPapers),
      getUnpaywallLimit(retrievalDepth)
    );
    const accessResolved = deduplicated.map(applyAccessInfo);
    searchDiagnostics.driftWarning = buildDriftWarning(accessResolved);
    console.log(
      `[retrieve] Deduplicated: ${allPapers.length} to ${accessResolved.length} papers`
    );

    // Return results
    return NextResponse.json({
      papers: accessResolved,
      sourceCounts,
      queries,
      searchDiagnostics,
    });
  } catch (error) {
    console.error('[retrieve] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve papers', code: 'RETRIEVAL_ERROR' },
      { status: 500 }
    );
  }
}
