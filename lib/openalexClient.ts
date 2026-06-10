/**
 * @file OpenAlex API Client
 *
 * Retrieves academic papers from OpenAlex (https://api.openalex.org/works).
 * OpenAlex indexes 250M+ scholarly works with open metadata.
 *
 * GOTCHA: OpenAlex stores abstracts as `abstract_inverted_index` — a dict
 * of {word: [positions]}. The abstract must be reconstructed by sorting
 * positions and joining words. See `reconstructAbstract()`.
 *
 * Uses the OPENALEX_EMAIL env var for polite pool access (higher rate limits).
 * Adds 300ms delay between queries to respect rate limits.
 *
 * @module openalexClient
 */

import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { Paper } from './types';
import { withRetry } from './retry';

/** Base URL for OpenAlex works endpoint */
const OPENALEX_BASE = 'https://api.openalex.org/works';
const OPENALEX_SOURCES_BASE = 'https://api.openalex.org/sources';

export interface OpenAlexSourceMetadata {
  displayName: string;
  type: 'journal' | 'conference' | 'repository' | 'ebook platform' | 'book series' | 'unknown';
  isOpenAccess: boolean | null;
  issn: string | null;
  homepageUrl: string | null;
  publisher: string | null;
  worksCount: number;
  citedByCount: number;
}

/**
 * Reconstructs a human-readable abstract from OpenAlex's inverted index format.
 *
 * OpenAlex stores abstracts as: { "word": [position1, position2, ...], ... }
 * This function sorts all (position, word) pairs by position and joins them.
 *
 * @param invertedIndex - The abstract_inverted_index object from OpenAlex
 * @returns Reconstructed abstract string
 */
export function reconstructAbstract(
  invertedIndex: Record<string, number[]> | null | undefined
): string {
  if (!invertedIndex || typeof invertedIndex !== 'object') return '';

  try {
    return Object.entries(invertedIndex)
      .flatMap(([word, positions]) =>
        (Array.isArray(positions) ? positions : []).map(
          (pos) => [pos, word] as [number, string]
        )
      )
      .sort(([a], [b]) => a - b)
      .map(([, word]) => word)
      .join(' ');
  } catch {
    console.warn('Failed to reconstruct abstract from inverted index');
    return '';
  }
}

/**
 * Delays execution for the specified number of milliseconds.
 * Used to respect API rate limits.
 *
 * @param ms - Milliseconds to wait
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Searches OpenAlex for papers matching the given query.
 *
 * Endpoint: GET /works?search={query}&filter=has_abstract:true&per-page=15&mailto={email}
 *
 * Extracts: id, doi, title, publication_year, type, abstract (reconstructed from
 * inverted index), authorships, cited_by_count, primary_location, open_access.
 *
 * @param query - Search query string
 * @returns Array of Paper objects from OpenAlex
 */
export async function searchOpenAlex(query: string): Promise<Paper[]> {
  const email = process.env.OPENALEX_EMAIL || 'team@researchlens.com';

  try {
    const response = await withRetry(() =>
      axios.get(OPENALEX_BASE, {
        params: {
          search: query,
          filter: 'has_abstract:true',
          'per-page': 15,
          mailto: email,
        },
        timeout: 15000,
      })
    );

    const results = response.data?.results;
    if (!Array.isArray(results)) return [];

    const papers: Paper[] = [];

    for (const work of results) {
      try {
        const title = work.title;
        if (!title || typeof title !== 'string') continue;

        const abstract = reconstructAbstract(work.abstract_inverted_index);
        if (!abstract || abstract.length < 20) continue;

        // Extract DOI — strip URL prefix if present
        let doi: string | null = work.doi || null;
        if (doi) {
          doi = doi
            .replace(/^https?:\/\/(dx\.)?doi\.org\//i, '')
            .trim();
        }

        // Extract URL — prefer landing page, fallback to OA URL
        const url =
          work.primary_location?.landing_page_url ||
          work.open_access?.oa_url ||
          (doi ? `https://doi.org/${doi}` : null);

        // Extract authors
        const authors: string[] = (work.authorships || [])
          .map((a: { author?: { display_name?: string } }) =>
            a.author?.display_name
          )
          .filter(Boolean) as string[];

        papers.push({
          id: uuidv4(),
          title: title.trim(),
          abstract,
          year: work.publication_year || 0,
          authors,
          doi,
          url,
          citationCount: work.cited_by_count || 0,
          source: 'openalex',
          type: work.type || 'unknown',
          venue:
            work.primary_location?.source?.display_name || null,
        });
      } catch (parseError) {
        // Skip individual papers that fail to parse
        console.warn('Failed to parse OpenAlex work:', parseError);
      }
    }

    return papers;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(
        `OpenAlex search failed for "${query}":`,
        error.response?.status,
        error.message
      );
    } else {
      console.error(`OpenAlex search failed for "${query}":`, error);
    }
    return [];
  }
}

/**
 * Searches OpenAlex for multiple queries in sequence with rate limiting.
 * Adds 300ms delay between requests to respect rate limits.
 *
 * @param queries - Array of search query strings
 * @returns Flattened array of all Paper results
 */
export async function searchOpenAlexBatch(
  queries: string[]
): Promise<Paper[]> {
  const allPapers: Paper[] = [];

  for (let i = 0; i < queries.length; i++) {
    const papers = await searchOpenAlex(queries[i]);
    allPapers.push(...papers);

    // Rate limiting: 300ms delay between requests
    if (i < queries.length - 1) {
      await delay(300);
    }
  }

  return allPapers;
}

export async function searchOpenAlexSource(
  venue: string
): Promise<OpenAlexSourceMetadata | null> {
  const email = process.env.OPENALEX_EMAIL || 'team@researchlens.com';

  try {
    const response = await withRetry(() =>
      axios.get(OPENALEX_SOURCES_BASE, {
        params: {
          search: venue,
          'per-page': 1,
          mailto: email,
        },
        timeout: 10000,
      })
    );

    const source = response.data?.results?.[0];
    if (!source?.display_name) return null;

    return {
      displayName: String(source.display_name),
      type: [
        'journal',
        'conference',
        'repository',
        'ebook platform',
        'book series',
      ].includes(String(source.type))
        ? source.type
        : 'unknown',
      isOpenAccess:
        typeof source.is_oa === 'boolean' ? Boolean(source.is_oa) : null,
      issn: source.issn_l || source.issn?.[0] || null,
      homepageUrl: source.homepage_url || null,
      publisher: source.host_organization_name || null,
      worksCount: source.works_count || 0,
      citedByCount: source.cited_by_count || 0,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.warn(
        `OpenAlex source lookup failed for "${venue}":`,
        error.response?.status,
        error.message
      );
    } else {
      console.warn(`OpenAlex source lookup failed for "${venue}":`, error);
    }
    return null;
  }
}

export async function searchOpenAlexSourcesBatch(
  venues: string[]
): Promise<Record<string, OpenAlexSourceMetadata | null>> {
  const uniqueVenues = Array.from(new Set(venues.filter(Boolean))).slice(0, 8);
  const entries: Array<[string, OpenAlexSourceMetadata | null]> = [];

  for (let i = 0; i < uniqueVenues.length; i++) {
    const venue = uniqueVenues[i];
    entries.push([venue, await searchOpenAlexSource(venue)]);

    if (i < uniqueVenues.length - 1) {
      await delay(200);
    }
  }

  return Object.fromEntries(entries);
}
