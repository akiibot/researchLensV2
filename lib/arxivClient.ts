/**
 * @file arXiv API Client
 *
 * Retrieves preprints from arXiv's public Atom API.
 * arXiv is useful for recent CS, AI, physics, math, statistics, and engineering work
 * that may not yet appear in journal indexes.
 */

import axios from 'axios';
import { load } from 'cheerio';
import { v4 as uuidv4 } from 'uuid';
import { Paper } from './types';

const ARXIV_BASE = 'https://export.arxiv.org/api/query';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export async function searchArxiv(query: string): Promise<Paper[]> {
  try {
    const response = await axios.get(ARXIV_BASE, {
      params: {
        search_query: `all:${query}`,
        start: 0,
        max_results: 8,
        sortBy: 'relevance',
        sortOrder: 'descending',
      },
      timeout: 8000,
      responseType: 'text',
    });

    const $ = load(response.data, { xmlMode: true });
    const papers: Paper[] = [];

    $('entry').each((_, entry) => {
      try {
        const node = $(entry);
        const title = normalizeText(node.children('title').text());
        const abstract = normalizeText(node.children('summary').text());
        if (!title || abstract.length < 20) return;

        const authors = node
          .children('author')
          .map((__, author) => normalizeText($(author).children('name').text()))
          .get()
          .filter(Boolean);

        const published = node.children('published').text();
        const year = published ? Number(published.slice(0, 4)) || 0 : 0;
        const idUrl = normalizeText(node.children('id').text()) || null;
        const arxivId = idUrl?.match(/arxiv\.org\/abs\/([^?#]+)/i)?.[1];
        const pdfUrl = arxivId ? `https://arxiv.org/pdf/${arxivId}.pdf` : undefined;
        const doi = normalizeText(node.find('arxiv\\:doi, doi').first().text()) || null;
        const categories = node
          .children('category')
          .map((__, category) => $(category).attr('term'))
          .get()
          .filter(Boolean);

        papers.push({
          id: uuidv4(),
          title,
          abstract,
          year,
          authors,
          doi,
          url: doi ? `https://doi.org/${doi}` : idUrl,
          citationCount: 0,
          source: 'arxiv',
          type: 'preprint',
          venue: categories.length > 0 ? `arXiv ${categories[0]}` : 'arXiv',
          accessType: 'open_pdf',
          pdfUrl,
          landingUrl: idUrl || undefined,
          fullTextStatus: pdfUrl ? 'available' : 'unavailable',
          fullTextSource: pdfUrl ? 'arxiv' : undefined,
          fullTextVerifiedAt: pdfUrl ? new Date().toISOString() : undefined,
        });
      } catch (parseError) {
        console.warn('Failed to parse arXiv entry:', parseError);
      }
    });

    return papers;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(`arXiv search failed for "${query}":`, error.response?.status, error.message);
    } else {
      console.error(`arXiv search failed for "${query}":`, error);
    }
    return [];
  }
}

export async function searchArxivBatch(queries: string[]): Promise<Paper[]> {
  const allPapers: Paper[] = [];
  const querySubset = queries.slice(0, 2);

  for (let i = 0; i < querySubset.length; i++) {
    allPapers.push(...(await searchArxiv(querySubset[i])));
    if (i < querySubset.length - 1) await delay(3000);
  }

  return allPapers;
}
