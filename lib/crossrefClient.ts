/**
 * @file Crossref API Client
 *
 * Verifies DOIs and retrieves metadata from Crossref (https://api.crossref.org).
 * Used primarily for DOI validation and metadata normalization — not as a
 * bulk search source (OpenAlex already indexes Crossref DOIs).
 *
 * GOTCHA: Always include `mailto=your@email.com` as a query parameter
 * for polite pool access. Without it, requests may be throttled.
 * Crossref abstracts can contain HTML — tags are stripped.
 *
 * @module crossrefClient
 */

import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { Paper } from './types';
import { withRetry } from './retry';

/** Base URL for Crossref works endpoint */
const CROSSREF_BASE = 'https://api.crossref.org/works';

/**
 * Strips HTML tags from a string.
 * Used to clean Crossref abstracts which may contain JATS XML markup.
 *
 * @param html - String potentially containing HTML tags
 * @returns Plain text string with tags removed
 */
function stripHtml(html: string): string {
  return html
    .replace(/<jats:[^>]+>/g, '')
    .replace(/<\/jats:[^>]+>/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

/**
 * Verifies a single DOI against Crossref and returns enriched metadata.
 * Used to validate that a DOI is real and to retrieve authoritative metadata.
 *
 * Endpoint: GET /works/{doi}?mailto={email}
 *
 * @param doi - The DOI string to verify (without URL prefix)
 * @returns Paper object if found, null if DOI is invalid or request fails
 */
export async function verifyDoi(doi: string): Promise<Paper | null> {
  const email = process.env.OPENALEX_EMAIL || 'team@researchlens.com';

  try {
    const response = await withRetry(() =>
      axios.get(`${CROSSREF_BASE}/${encodeURIComponent(doi)}`, {
        params: { mailto: email },
        timeout: 10000,
      })
    );

    const item = response.data?.message;
    if (!item) return null;

    const title = item.title?.[0];
    if (!title) return null;

    // Extract abstract — strip HTML/JATS tags
    const abstract = item.abstract ? stripHtml(item.abstract) : '';

    // Extract year from published-print or published-online
    const year =
      item['published-print']?.['date-parts']?.[0]?.[0] ||
      item['published-online']?.['date-parts']?.[0]?.[0] ||
      item.created?.['date-parts']?.[0]?.[0] ||
      0;

    // Extract authors
    const authors: string[] = (item.author || [])
      .map(
        (a: { given?: string; family?: string }) =>
          [a.given, a.family].filter(Boolean).join(' ')
      )
      .filter(Boolean) as string[];

    return {
      id: uuidv4(),
      title: title.trim(),
      abstract,
      year,
      authors,
      doi: item.DOI || doi,
      url: item.URL || `https://doi.org/${doi}`,
      citationCount: item['is-referenced-by-count'] || 0,
      source: 'crossref',
      type: item.type || 'unknown',
      venue: item['container-title']?.[0] || null,
    };
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      // DOI not found — not an error, just invalid
      return null;
    }
    console.warn(`Crossref DOI verification failed for "${doi}":`, error);
    return null;
  }
}

/**
 * Searches Crossref for papers matching a query.
 * Used as a supplemental source, primarily for DOI verification.
 *
 * Endpoint: GET /works?query={query}&rows=10&mailto={email}
 *
 * @param query - Search query string
 * @returns Array of Paper objects from Crossref
 */
export async function searchCrossref(query: string): Promise<Paper[]> {
  const email = process.env.OPENALEX_EMAIL || 'team@researchlens.com';

  try {
    const response = await withRetry(() =>
      axios.get(CROSSREF_BASE, {
        params: {
          query,
          rows: 10,
          mailto: email,
        },
        timeout: 15000,
      })
    );

    const items = response.data?.message?.items;
    if (!Array.isArray(items)) return [];

    const papers: Paper[] = [];

    for (const item of items) {
      try {
        const title = item.title?.[0];
        if (!title || typeof title !== 'string') continue;

        const abstract = item.abstract ? stripHtml(item.abstract) : '';

        const year =
          item['published-print']?.['date-parts']?.[0]?.[0] ||
          item['published-online']?.['date-parts']?.[0]?.[0] ||
          item.created?.['date-parts']?.[0]?.[0] ||
          0;

        const authors: string[] = (item.author || [])
          .map(
            (a: { given?: string; family?: string }) =>
              [a.given, a.family].filter(Boolean).join(' ')
          )
          .filter(Boolean) as string[];

        papers.push({
          id: uuidv4(),
          title: title.trim(),
          abstract,
          year,
          authors,
          doi: item.DOI || null,
          url: item.URL || (item.DOI ? `https://doi.org/${item.DOI}` : null),
          citationCount: item['is-referenced-by-count'] || 0,
          source: 'crossref',
          type: item.type || 'unknown',
          venue: item['container-title']?.[0] || null,
        });
      } catch (parseError) {
        console.warn('Failed to parse Crossref work:', parseError);
      }
    }

    return papers;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(
        `Crossref search failed for "${query}":`,
        error.response?.status,
        error.message
      );
    } else {
      console.error(`Crossref search failed for "${query}":`, error);
    }
    return [];
  }
}
