/**
 * @file Europe PMC API Client
 *
 * Retrieves biomedical and life-science literature from Europe PMC.
 * This source broadens coverage for medicine, biology, public health,
 * agriculture, and grant-linked research.
 */

import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { Paper } from './types';
import { withRetry } from './retry';

const EUROPE_PMC_BASE = 'https://www.ebi.ac.uk/europepmc/webservices/rest/search';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function firstFullTextUrl(result: Record<string, unknown>): string | null {
  const fullTextUrlList = result.fullTextUrlList as
    | { fullTextUrl?: Array<{ url?: string }> }
    | undefined;
  return fullTextUrlList?.fullTextUrl?.find((item) => item.url)?.url || null;
}

function firstPdfUrl(result: Record<string, unknown>): string | null {
  const fullTextUrlList = result.fullTextUrlList as
    | { fullTextUrl?: Array<{ url?: string; documentStyle?: string; availability?: string }> }
    | undefined;
  const urls = fullTextUrlList?.fullTextUrl || [];
  const pdf = urls.find(
    (item) =>
      item.url &&
      (item.documentStyle?.toLowerCase() === 'pdf' ||
        item.url.toLowerCase().includes('.pdf') ||
        item.url.toLowerCase().includes('/pdf'))
  );
  return pdf?.url || null;
}

export async function searchEuropePmc(query: string): Promise<Paper[]> {
  try {
    const response = await withRetry(() =>
      axios.get(EUROPE_PMC_BASE, {
        params: {
          query,
          format: 'json',
          pageSize: 10,
          sort: 'relevance',
        },
        timeout: 15000,
      })
    );

    const results = response.data?.resultList?.result;
    if (!Array.isArray(results)) return [];

    const papers: Paper[] = [];

    for (const result of results) {
      try {
        const title = result.title;
        const abstract = result.abstractText || '';
        if (!title || typeof title !== 'string' || abstract.length < 20) continue;

        const doi = result.doi || null;
        const pmid = result.pmid || null;
        const pmcid = result.pmcid || null;
        const pdfUrl = firstPdfUrl(result);
        const url =
          pdfUrl ||
          firstFullTextUrl(result) ||
          (doi ? `https://doi.org/${doi}` : null) ||
          (pmcid ? `https://europepmc.org/article/PMC/${pmcid}` : null) ||
          (pmid ? `https://europepmc.org/article/MED/${pmid}` : null);

        const authors =
          typeof result.authorString === 'string'
            ? result.authorString
                .split(',')
                .map((author: string) => author.trim())
                .filter(Boolean)
            : [];

        papers.push({
          id: uuidv4(),
          title: title.trim(),
          abstract: String(abstract),
          year: Number(result.pubYear) || 0,
          authors,
          doi,
          url,
          citationCount: Number(result.citedByCount) || 0,
          source: 'europepmc',
          type: result.pubType || result.source || 'journal-article',
          venue: result.journalTitle || null,
          accessType: pdfUrl ? 'open_pdf' : firstFullTextUrl(result) ? 'open_landing' : 'abstract_only',
          pdfUrl: pdfUrl || undefined,
          landingUrl: url || undefined,
          fullTextStatus: pdfUrl ? 'available' : 'unavailable',
          fullTextSource: pdfUrl ? 'europepmc' : undefined,
          fullTextVerifiedAt: pdfUrl ? new Date().toISOString() : undefined,
        });
      } catch (parseError) {
        console.warn('Failed to parse Europe PMC result:', parseError);
      }
    }

    return papers;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(
        `Europe PMC search failed for "${query}":`,
        error.response?.status,
        error.message
      );
    } else {
      console.error(`Europe PMC search failed for "${query}":`, error);
    }
    return [];
  }
}

export async function searchEuropePmcBatch(queries: string[]): Promise<Paper[]> {
  const allPapers: Paper[] = [];
  const querySubset = queries.slice(0, 4);

  for (let i = 0; i < querySubset.length; i++) {
    allPapers.push(...(await searchEuropePmc(querySubset[i])));
    if (i < querySubset.length - 1) await delay(300);
  }

  return allPapers;
}
