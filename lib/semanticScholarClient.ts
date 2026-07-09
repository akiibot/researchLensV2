/**
 * @file Semantic Scholar API Client
 *
 * Retrieves academic papers from Semantic Scholar
 * (https://api.semanticscholar.org/graph/v1/paper/search).
 * Indexes 214M+ papers with citation graph data.
 *
 * Rate limits: Without API key, ~100 req/5min. With key, 1 req/sec.
 * Always adds 1000ms delay between requests.
 *
 * @module semanticScholarClient
 */

import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { Paper } from './types';
import { withRetry } from './retry';

/** Base URL for Semantic Scholar paper search endpoint */
const S2_BASE = 'https://api.semanticscholar.org/graph/v1/paper/search';

/** Fields to request from the Semantic Scholar API */
const S2_FIELDS = [
  'title',
  'abstract',
  'year',
  'authors',
  'citationCount',
  'externalIds',
  'url',
  'venue',
  'publicationTypes',
  'paperId',
].join(',');

/**
 * Delays execution for the specified number of milliseconds.
 *
 * @param ms - Milliseconds to wait
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Searches Semantic Scholar for papers matching the given query.
 *
 * Endpoint: GET /paper/search?query={query}&fields=...&limit=10
 * Adds x-api-key header if SEMANTIC_SCHOLAR_API_KEY env var is set.
 *
 * @param query - Search query string
 * @returns Array of Paper objects from Semantic Scholar
 */
export async function searchSemanticScholar(
  query: string
): Promise<Paper[]> {
  const apiKey = process.env.SEMANTIC_SCHOLAR_API_KEY;

  try {
    const headers: Record<string, string> = {};
    if (apiKey && apiKey !== 'optional' && apiKey !== '') {
      headers['x-api-key'] = apiKey;
    }

    const response = await withRetry(() =>
      axios.get(S2_BASE, {
        params: {
          query,
          fields: S2_FIELDS,
          limit: 10,
        },
        headers,
        timeout: 15000,
      })
    );

    const data = response.data?.data;
    if (!Array.isArray(data)) return [];

    const papers: Paper[] = [];

    for (const paper of data) {
      try {
        const title = paper.title;
        if (!title || typeof title !== 'string') continue;

        const abstract = paper.abstract || '';
        if (!abstract || abstract.length < 20) continue;

        // Extract DOI from externalIds
        const doi: string | null = paper.externalIds?.DOI || null;

        // Extract URL
        const url =
          paper.url ||
          (doi ? `https://doi.org/${doi}` : null);

        // Extract authors
        const authors: string[] = (paper.authors || [])
          .map((a: { name?: string }) => a.name)
          .filter(Boolean) as string[];

        papers.push({
          id: uuidv4(),
          title: title.trim(),
          abstract,
          year: paper.year || 0,
          authors,
          doi,
          url,
          citationCount: paper.citationCount || 0,
          source: 'semanticscholar',
          type: paper.publicationTypes?.[0] || 'unknown',
          venue: paper.venue || null,
          semanticScholarId: paper.paperId || undefined,
          externalIds: {
            doi: doi || undefined,
            semanticScholar: paper.paperId || undefined,
          },
        });
      } catch (parseError) {
        console.warn('Failed to parse Semantic Scholar paper:', parseError);
      }
    }

    return papers;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      // Handle 429 rate limit specifically
      if (error.response?.status === 429) {
        console.warn(
          `Semantic Scholar rate limited for "${query}" — skipping`
        );
      } else {
        console.error(
          `Semantic Scholar search failed for "${query}":`,
          error.response?.status,
          error.message
        );
      }
    } else {
      console.error(`Semantic Scholar search failed for "${query}":`, error);
    }
    return [];
  }
}

/**
 * Searches Semantic Scholar for multiple queries in sequence with rate limiting.
 * Adds 500ms delay between requests to respect rate limits.
 *
 * @param queries - Array of search query strings
 * @returns Flattened array of all Paper results
 */
export async function searchSemanticScholarBatch(
  queries: string[]
): Promise<Paper[]> {
  const allPapers: Paper[] = [];

  for (let i = 0; i < queries.length; i++) {
    const papers = await searchSemanticScholar(queries[i]);
    allPapers.push(...papers);

    // Rate limiting: 1000ms delay between requests to respect 1 req/sec limit
    if (i < queries.length - 1) {
      await delay(1000);
    }
  }

  return allPapers;
}
