/**
 * @file DataCite API Client
 *
 * Retrieves thesis and dissertation metadata from DataCite
 * (https://api.datacite.org/dois). DataCite is important for
 * non-journal research objects — many institutional repositories
 * use DataCite DOIs.
 *
 * Filters for resourceTypeGeneral = Dissertation, Text, or Other
 * to focus on thesis-like records.
 *
 * @module dataciteClient
 */

import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { Paper } from './types';
import { withRetry } from './retry';

/** Base URL for DataCite DOIs search endpoint */
const DATACITE_BASE = 'https://api.datacite.org/dois';

/** Resource types to include in search results */
const ALLOWED_TYPES = new Set([
  'Dissertation',
  'Text',
  'Other',
  'Report',
  'Thesis',
]);

/**
 * Delays execution for the specified number of milliseconds.
 *
 * @param ms - Milliseconds to wait
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Searches DataCite for theses/dissertations matching the given query.
 * Filters results to resourceTypeGeneral = Dissertation, Text, or Other.
 *
 * Endpoint: GET /dois?query={query}&page[size]=10&resource-type-id=dissertation,text
 *
 * @param query - Search query string
 * @returns Array of Paper objects from DataCite
 */
export async function searchDataCite(query: string): Promise<Paper[]> {
  try {
    const response = await withRetry(() =>
      axios.get(DATACITE_BASE, {
        params: {
          query,
          'page[size]': 10,
          'resource-type-id': 'dissertation,text',
        },
        timeout: 15000,
      })
    );

    const data = response.data?.data;
    if (!Array.isArray(data)) return [];

    const papers: Paper[] = [];

    for (const item of data) {
      try {
        const attrs = item.attributes;
        if (!attrs) continue;

        // Check resource type
        const resourceType = attrs.types?.resourceTypeGeneral || '';
        if (resourceType && !ALLOWED_TYPES.has(resourceType)) continue;

        // Extract title
        const title = attrs.titles?.[0]?.title;
        if (!title || typeof title !== 'string') continue;

        // Extract description/abstract
        const abstract =
          attrs.descriptions?.find(
            (d: { descriptionType?: string; description?: string }) =>
              d.descriptionType === 'Abstract'
          )?.description ||
          attrs.descriptions?.[0]?.description ||
          '';

        // Extract DOI
        const doi: string = attrs.doi || '';

        // Extract authors
        const authors: string[] = (attrs.creators || [])
          .map(
            (c: { name?: string; givenName?: string; familyName?: string }) =>
              c.name ||
              [c.givenName, c.familyName].filter(Boolean).join(' ')
          )
          .filter(Boolean) as string[];

        papers.push({
          id: uuidv4(),
          title: title.trim(),
          abstract: abstract || '',
          year: attrs.publicationYear || 0,
          authors,
          doi: doi || null,
          url: attrs.url || (doi ? `https://doi.org/${doi}` : null),
          citationCount: attrs.citationCount || 0,
          source: 'datacite',
          type: resourceType || 'dissertation',
          venue: attrs.publisher || null,
        });
      } catch (parseError) {
        console.warn('Failed to parse DataCite record:', parseError);
      }
    }

    return papers;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(
        `DataCite search failed for "${query}":`,
        error.response?.status,
        error.message
      );
    } else {
      console.error(`DataCite search failed for "${query}":`, error);
    }
    return [];
  }
}

/**
 * Searches DataCite for multiple queries in sequence.
 * Uses top 3 queries only (DataCite is a smaller, supplemental source).
 * Adds 300ms delay between requests.
 *
 * @param queries - Array of search query strings
 * @returns Flattened array of all Paper results
 */
export async function searchDataCiteBatch(
  queries: string[]
): Promise<Paper[]> {
  const allPapers: Paper[] = [];

  // Use top 3 queries only — DataCite is supplemental
  const querySubset = queries.slice(0, 3);

  for (let i = 0; i < querySubset.length; i++) {
    const papers = await searchDataCite(querySubset[i]);
    allPapers.push(...papers);

    if (i < querySubset.length - 1) {
      await delay(300);
    }
  }

  return allPapers;
}
