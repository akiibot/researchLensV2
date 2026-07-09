/**
 * @file CORE API Client
 *
 * Retrieves open-access repository records from CORE.
 * Requires CORE_API_KEY. When the key is absent, the client returns no results
 * so local development remains functional without extra secrets.
 */

import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { Paper } from './types';
import { withRetry } from './retry';

const CORE_BASE = 'https://api.core.ac.uk/v3/search/works';
const CORE_API_BASE = 'https://api.core.ac.uk/v3';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getAuthors(work: Record<string, unknown>): string[] {
  const authors = work.authors;
  if (!Array.isArray(authors)) return [];

  return authors
    .map((author) => {
      if (typeof author === 'string') return author;
      if (author && typeof author === 'object' && 'name' in author) {
        return String((author as { name?: string }).name || '');
      }
      return '';
    })
    .map((author) => author.trim())
    .filter(Boolean);
}

function getVenue(work: Record<string, unknown>): string | null {
  const journals = work.journals;
  if (Array.isArray(journals) && journals[0]) {
    const first = journals[0];
    if (typeof first === 'string') return first;
    if (typeof first === 'object' && 'title' in first) {
      return String((first as { title?: string }).title || '') || null;
    }
  }

  return typeof work.publisher === 'string' ? work.publisher : null;
}

function getIdentifier(work: Record<string, unknown>): string | null {
  const id = work.id || work.identifier;
  return id ? String(id) : null;
}

function getPublicUrl(work: Record<string, unknown>, doi: string | null): string | null {
  if (typeof work.downloadUrl === 'string' && work.downloadUrl.startsWith('http')) {
    return work.downloadUrl;
  }

  if (typeof work.sourceFulltextUrls === 'string' && work.sourceFulltextUrls.startsWith('http')) {
    return work.sourceFulltextUrls;
  }

  const sourceFulltextUrls = work.sourceFulltextUrls;
  if (Array.isArray(sourceFulltextUrls)) {
    const publicUrl = sourceFulltextUrls.find(
      (url) => typeof url === 'string' && url.startsWith('http')
    );
    if (publicUrl) return publicUrl;
  }

  return doi ? `https://doi.org/${doi}` : null;
}

function getDownloadUrl(work: Record<string, unknown>): string | null {
  return typeof work.downloadUrl === 'string' && work.downloadUrl.startsWith('http')
    ? work.downloadUrl
    : null;
}

export async function downloadCorePdf(identifier: string): Promise<ArrayBuffer | null> {
  const apiKey = process.env.CORE_API_KEY;
  if (!apiKey || apiKey === 'optional') return null;

  try {
    const response = await axios.get(`${CORE_API_BASE}/outputs/${identifier}/download`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      responseType: 'arraybuffer',
      timeout: 30000,
    });

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(
        `CORE PDF download failed for "${identifier}":`,
        error.response?.status,
        error.message
      );
    } else {
      console.error(`CORE PDF download failed for "${identifier}":`, error);
    }
    return null;
  }
}

export async function searchCore(query: string): Promise<Paper[]> {
  const apiKey = process.env.CORE_API_KEY;
  if (!apiKey || apiKey === 'optional') return [];

  try {
    const response = await withRetry(() =>
      axios.get(CORE_BASE, {
        params: {
          q: query,
          limit: 10,
        },
        headers: {
          Authorization: `Bearer ${apiKey}`,
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
        const abstract = work.abstract || '';
        if (!title || typeof title !== 'string' || abstract.length < 20) continue;

        const doi = work.doi || null;
        const identifier = getIdentifier(work);
        const downloadUrl = getDownloadUrl(work);
        const url = getPublicUrl(work, doi);

        papers.push({
          id: identifier ? `core:${identifier}` : uuidv4(),
          title: title.trim(),
          abstract: String(abstract),
          year: Number(work.yearPublished || work.year) || 0,
          authors: getAuthors(work),
          doi,
          url,
          citationCount: Number(work.citationCount) || 0,
          source: 'core',
          type: work.documentType || work.type || 'repository-work',
          venue: getVenue(work),
          accessType: downloadUrl ? 'core_download' : identifier ? 'core_download' : url ? 'open_landing' : 'abstract_only',
          pdfUrl: downloadUrl || undefined,
          landingUrl: url || undefined,
          fullTextStatus: downloadUrl || identifier ? 'available' : 'unavailable',
          fullTextSource: downloadUrl || identifier ? 'core' : undefined,
          fullTextVerifiedAt: downloadUrl || identifier ? new Date().toISOString() : undefined,
          coreId: identifier || undefined,
        });
      } catch (parseError) {
        console.warn('Failed to parse CORE work:', parseError);
      }
    }

    return papers;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(`CORE search failed for "${query}":`, error.response?.status, error.message);
    } else {
      console.error(`CORE search failed for "${query}":`, error);
    }
    return [];
  }
}

export async function searchCoreBatch(queries: string[]): Promise<Paper[]> {
  const allPapers: Paper[] = [];
  const querySubset = queries.slice(0, 3);

  for (let i = 0; i < querySubset.length; i++) {
    allPapers.push(...(await searchCore(querySubset[i])));
    if (i < querySubset.length - 1) await delay(500);
  }

  return allPapers;
}
