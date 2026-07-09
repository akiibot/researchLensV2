/**
 * @file DOAJ API Client
 *
 * Looks up open-access journal metadata from the Directory of Open Access Journals.
 * Use this for venue verification and journal-targeting enrichment.
 */

import axios from 'axios';

const DOAJ_JOURNALS_BASE = 'https://doaj.org/api/search/journals';

export interface DoajJournalMetadata {
  title: string;
  issns: string[];
  publisher: string | null;
  country: string | null;
  subjects: string[];
  url: string | null;
}

export async function searchDoajJournals(query: string): Promise<DoajJournalMetadata[]> {
  try {
    const response = await axios.get(`${DOAJ_JOURNALS_BASE}/${encodeURIComponent(query)}`, {
      params: {
        pageSize: 5,
      },
      timeout: 10000,
    });

    const results = response.data?.results;
    if (!Array.isArray(results)) return [];

    return results
      .map((result): DoajJournalMetadata | null => {
        const bibjson = result.bibjson;
        if (!bibjson?.title) return null;

        return {
          title: String(bibjson.title),
          issns: Array.isArray(bibjson.identifier)
            ? bibjson.identifier
                .filter((item: { type?: string; id?: string }) => item.type === 'eissn' || item.type === 'pissn')
                .map((item: { id?: string }) => String(item.id || ''))
                .filter(Boolean)
            : [],
          publisher: bibjson.publisher ? String(bibjson.publisher) : null,
          country: bibjson.country ? String(bibjson.country) : null,
          subjects: Array.isArray(bibjson.subject)
            ? bibjson.subject.map((item: { term?: string }) => String(item.term || '')).filter(Boolean)
            : [],
          url: bibjson.link?.find((link: { type?: string; url?: string }) => link.type === 'homepage')?.url || null,
        };
      })
      .filter((item): item is DoajJournalMetadata => Boolean(item));
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.warn(`DOAJ lookup failed for "${query}":`, error.response?.status, error.message);
    } else {
      console.warn(`DOAJ lookup failed for "${query}":`, error);
    }
    return [];
  }
}
