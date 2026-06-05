/**
 * @file Paper Retrieval API Route
 *
 * POST /api/retrieve
 *
 * Accepts a ResearchIdea, expands it into search queries, fires queries
 * against OpenAlex + Semantic Scholar + DataCite in parallel using
 * Promise.allSettled (so one source failing doesn't block others),
 * deduplicates results by DOI/title, and returns the combined corpus.
 *
 * All API calls happen server-side — no API keys are exposed to the client.
 *
 * @module api/retrieve
 */

import { NextRequest, NextResponse } from 'next/server';
import { ResearchIdea, RetrievalResponse, ApiError } from '@/lib/types';
import { expandQueries } from '@/lib/queryExpansion';
import { searchOpenAlexBatch } from '@/lib/openalexClient';
import { searchSemanticScholarBatch } from '@/lib/semanticScholarClient';
import { searchDataCiteBatch } from '@/lib/dataciteClient';
import { deduplicatePapers } from '@/lib/deduplicator';
import { MOCK_PAPERS } from '@/lib/mockData';

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
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey || apiKey === 'your_key_here' || apiKey === '') {
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
      };
      return NextResponse.json({
        papers: MOCK_PAPERS,
        sourceCounts,
        queries: mockQueries,
      });
    }

    // Step 1: Expand into search queries
    const queries = await expandQueries(idea);
    console.log(`[retrieve] Expanded into ${queries.length} queries:`, queries);

    // Step 2: Fire all source queries in parallel
    const [openAlexResult, semanticScholarResult, dataCiteResult] =
      await Promise.allSettled([
        searchOpenAlexBatch(queries),
        searchSemanticScholarBatch(queries),
        searchDataCiteBatch(queries),
      ]);

    // Step 3: Collect results and track source counts
    const sourceCounts: Record<string, number> = {
      openalex: 0,
      semanticscholar: 0,
      datacite: 0,
    };

    const allPapers = [];
    const warnings: string[] = [];

    if (openAlexResult.status === 'fulfilled') {
      allPapers.push(...openAlexResult.value);
      sourceCounts.openalex = openAlexResult.value.length;
      console.log(`[retrieve] OpenAlex returned ${openAlexResult.value.length} papers`);
    } else {
      warnings.push('OpenAlex search failed');
      console.error('[retrieve] OpenAlex failed:', openAlexResult.reason);
    }

    if (semanticScholarResult.status === 'fulfilled') {
      allPapers.push(...semanticScholarResult.value);
      sourceCounts.semanticscholar = semanticScholarResult.value.length;
      console.log(
        `[retrieve] Semantic Scholar returned ${semanticScholarResult.value.length} papers`
      );
    } else {
      warnings.push('Semantic Scholar search failed');
      console.error(
        '[retrieve] Semantic Scholar failed:',
        semanticScholarResult.reason
      );
    }

    if (dataCiteResult.status === 'fulfilled') {
      allPapers.push(...dataCiteResult.value);
      sourceCounts.datacite = dataCiteResult.value.length;
      console.log(`[retrieve] DataCite returned ${dataCiteResult.value.length} papers`);
    } else {
      warnings.push('DataCite search failed');
      console.error('[retrieve] DataCite failed:', dataCiteResult.reason);
    }

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
    const deduplicated = deduplicatePapers(allPapers);
    console.log(
      `[retrieve] Deduplicated: ${allPapers.length} → ${deduplicated.length} papers`
    );

    // Return results
    return NextResponse.json({
      papers: deduplicated,
      sourceCounts,
      queries,
    });
  } catch (error) {
    console.error('[retrieve] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve papers', code: 'RETRIEVAL_ERROR' },
      { status: 500 }
    );
  }
}
