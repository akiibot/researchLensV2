/**
 * @file PubMed API Client
 *
 * Retrieves biomedical literature from NCBI E-utilities.
 * Uses ESearch to find PMIDs and ESummary to retrieve metadata without requiring
 * an API key. NCBI_API_KEY can be set for higher rate limits.
 */

import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { Paper } from './types';
import { withRetry } from './retry';

const NCBI_ESEARCH = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi';
const NCBI_ESUMMARY = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ncbiParams(extra: Record<string, string | number>) {
  const apiKey = process.env.NCBI_API_KEY;
  return {
    tool: 'researchlens',
    email: process.env.OPENALEX_EMAIL || 'team@researchlens.com',
    ...(apiKey && apiKey !== 'optional' ? { api_key: apiKey } : {}),
    ...extra,
  };
}

function extractDoi(articleIds: Array<{ idtype?: string; value?: string }> | undefined): string | null {
  const doi = articleIds?.find((item) => item.idtype === 'doi')?.value;
  return doi || null;
}

export async function searchPubMed(query: string): Promise<Paper[]> {
  try {
    const searchResponse = await withRetry(() =>
      axios.get(NCBI_ESEARCH, {
        params: ncbiParams({
          db: 'pubmed',
          term: query,
          retmode: 'json',
          retmax: 10,
          sort: 'relevance',
        }),
        timeout: 15000,
      })
    );

    const ids = searchResponse.data?.esearchresult?.idlist;
    if (!Array.isArray(ids) || ids.length === 0) return [];

    const summaryResponse = await withRetry(() =>
      axios.get(NCBI_ESUMMARY, {
        params: ncbiParams({
          db: 'pubmed',
          id: ids.join(','),
          retmode: 'json',
        }),
        timeout: 15000,
      })
    );

    const result = summaryResponse.data?.result;
    if (!result || typeof result !== 'object') return [];

    const papers: Paper[] = [];

    for (const pmid of ids) {
      try {
        const item = result[pmid];
        if (!item?.title || typeof item.title !== 'string') continue;

        const doi = extractDoi(item.articleids);
        const authors: string[] = Array.isArray(item.authors)
          ? item.authors.map((author: { name?: string }) => author.name).filter(Boolean)
          : [];
        const year = Number(String(item.pubdate || '').slice(0, 4)) || 0;
        const url = doi ? `https://doi.org/${doi}` : `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`;

        papers.push({
          id: uuidv4(),
          title: item.title.trim(),
          abstract: item.title.trim(),
          year,
          authors,
          doi,
          url,
          citationCount: 0,
          source: 'pubmed',
          type: Array.isArray(item.pubtype) ? item.pubtype[0] || 'journal-article' : 'journal-article',
          venue: item.fulljournalname || item.source || null,
        });
      } catch (parseError) {
        console.warn('Failed to parse PubMed summary:', parseError);
      }
    }

    return papers;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(`PubMed search failed for "${query}":`, error.response?.status, error.message);
    } else {
      console.error(`PubMed search failed for "${query}":`, error);
    }
    return [];
  }
}

export async function searchPubMedBatch(queries: string[]): Promise<Paper[]> {
  const allPapers: Paper[] = [];
  const querySubset = queries.slice(0, 4);

  for (let i = 0; i < querySubset.length; i++) {
    allPapers.push(...(await searchPubMed(querySubset[i])));
    if (i < querySubset.length - 1) await delay(350);
  }

  return allPapers;
}
