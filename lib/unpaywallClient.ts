/**
 * @file Unpaywall API Client
 *
 * Enriches DOI-bearing records with legal open-access URLs.
 * This is not a search source; it improves access links for papers found by
 * OpenAlex, Semantic Scholar, PubMed, DataCite, and CORE.
 */

import axios from 'axios';
import { Paper } from './types';
import { normalizeDoi } from './deduplicator';

const UNPAYWALL_BASE = 'https://api.unpaywall.org/v2';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getUnpaywallEmail(): string {
  return process.env.UNPAYWALL_EMAIL || process.env.OPENALEX_EMAIL || 'team@researchlens.com';
}

async function findOpenAccessUrl(doi: string): Promise<{ url: string; isPdf: boolean } | null> {
  try {
    const response = await axios.get(`${UNPAYWALL_BASE}/${encodeURIComponent(doi)}`, {
      params: {
        email: getUnpaywallEmail(),
      },
      timeout: 10000,
    });

    const bestLocation = response.data?.best_oa_location;
    const pdfUrl = bestLocation?.url_for_pdf || null;
    const url = pdfUrl || bestLocation?.url || response.data?.doi_url || null;
    return url ? { url, isPdf: Boolean(pdfUrl) } : null;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status !== 404) {
      console.warn(`Unpaywall lookup failed for "${doi}":`, error.response?.status, error.message);
    }
    return null;
  }
}

export async function enrichPapersWithUnpaywall(
  papers: Paper[],
  maxLookups: number = 25
): Promise<Paper[]> {
  if (maxLookups <= 0) return papers;

  const enriched = [...papers];
  const seenDois = new Map<string, { url: string; isPdf: boolean } | null>();
  const candidates = enriched
    .map((paper, index) => ({ paper, index, doi: normalizeDoi(paper.doi) }))
    .filter((item): item is { paper: Paper; index: number; doi: string } => Boolean(item.doi))
    .slice(0, maxLookups);

  for (let i = 0; i < candidates.length; i++) {
    const { index, doi } = candidates[i];
    if (!seenDois.has(doi)) {
      seenDois.set(doi, await findOpenAccessUrl(doi));
      if (i < candidates.length - 1) await delay(100);
    }

    const openAccess = seenDois.get(doi);
    if (openAccess) {
      enriched[index] = {
        ...enriched[index],
        url: openAccess.url,
        accessType: openAccess.isPdf ? 'open_pdf' : 'open_landing',
        pdfUrl: openAccess.isPdf ? openAccess.url : enriched[index].pdfUrl,
        landingUrl: openAccess.isPdf
          ? enriched[index].landingUrl || enriched[index].url || undefined
          : openAccess.url,
        fullTextStatus: openAccess.isPdf ? 'available' : 'unavailable',
        fullTextSource: openAccess.isPdf ? 'unpaywall' : enriched[index].fullTextSource,
        fullTextVerifiedAt: openAccess.isPdf ? new Date().toISOString() : enriched[index].fullTextVerifiedAt,
      };
    }
  }

  return enriched;
}
