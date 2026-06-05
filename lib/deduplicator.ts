/**
 * @file Paper Deduplicator
 *
 * Deduplicates papers retrieved from multiple academic APIs.
 *
 * Strategy:
 * 1. Primary key: DOI (lowercase, normalized — strips URL prefixes)
 * 2. Fallback: title similarity using Jaccard token overlap (>0.85 = duplicate)
 * 3. When duplicates found, keeps the record with the richer abstract (longer string)
 *
 * @module deduplicator
 */

import { v4 as uuidv4 } from 'uuid';
import { Paper } from './types';

/**
 * Normalizes a DOI string for consistent comparison.
 * Strips common URL prefixes (https://doi.org/, http://dx.doi.org/)
 * and lowercases the identifier.
 *
 * @param doi - Raw DOI string (may include URL prefix)
 * @returns Normalized lowercase DOI, or null if input is null/empty
 */
export function normalizeDoi(doi: string | null): string | null {
  if (!doi || doi.trim() === '') return null;
  return doi
    .toLowerCase()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, '')
    .trim();
}

/**
 * Tokenizes a title string for comparison.
 * Lowercases, removes punctuation, splits on whitespace, and filters empties.
 *
 * @param title - Title string to tokenize
 * @returns Set of lowercase word tokens
 */
function tokenizeTitle(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 1)
  );
}

/**
 * Computes Jaccard similarity between two title strings.
 * Tokenizes by whitespace, lowercases, and computes |intersection| / |union|.
 *
 * @param titleA - First title
 * @param titleB - Second title
 * @returns Jaccard similarity score between 0 and 1
 */
export function titleSimilarity(titleA: string, titleB: string): number {
  const tokensA = tokenizeTitle(titleA);
  const tokensB = tokenizeTitle(titleB);

  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let intersectionSize = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) {
      intersectionSize++;
    }
  }

  const unionSize = tokensA.size + tokensB.size - intersectionSize;
  if (unionSize === 0) return 0;

  return intersectionSize / unionSize;
}

/**
 * Selects the "better" paper from two duplicates.
 * Prefers the record with the richer (longer) abstract. On tie,
 * prefers the one with more metadata (citation count, DOI, etc.).
 *
 * @param existing - The paper already in the deduplicated set
 * @param candidate - The new candidate paper
 * @returns The paper to keep
 */
function selectBetter(existing: Paper, candidate: Paper): Paper {
  // Prefer longer abstract
  if (candidate.abstract.length > existing.abstract.length) {
    return { ...candidate, id: existing.id };
  }
  // On tie, prefer the one with a DOI
  if (!existing.doi && candidate.doi) {
    return { ...candidate, id: existing.id };
  }
  // On tie, prefer higher citation count
  if (candidate.citationCount > existing.citationCount) {
    return { ...candidate, id: existing.id };
  }
  return existing;
}

/**
 * Deduplicates an array of papers from multiple sources.
 *
 * Two-pass strategy:
 * 1. First pass: Group by normalized DOI
 * 2. Second pass: For papers without DOI, check title similarity
 *    against all existing papers (Jaccard > 0.85 = duplicate)
 *
 * When merging duplicates, keeps the record with the richer abstract.
 *
 * @param papers - Array of papers potentially containing duplicates
 * @returns Deduplicated array of papers with new UUIDs
 */
export function deduplicatePapers(papers: Paper[]): Paper[] {
  const doiMap = new Map<string, Paper>();
  const noDoi: Paper[] = [];

  // Pass 1: Group by normalized DOI
  for (const paper of papers) {
    const normalizedDoi = normalizeDoi(paper.doi);

    if (normalizedDoi) {
      const existing = doiMap.get(normalizedDoi);
      if (existing) {
        doiMap.set(normalizedDoi, selectBetter(existing, paper));
      } else {
        doiMap.set(normalizedDoi, { ...paper, id: uuidv4() });
      }
    } else {
      noDoi.push(paper);
    }
  }

  // Pass 2: For papers without DOI, check title similarity
  const deduplicated = Array.from(doiMap.values());

  for (const paper of noDoi) {
    let isDuplicate = false;

    for (let i = 0; i < deduplicated.length; i++) {
      const similarity = titleSimilarity(paper.title, deduplicated[i].title);
      if (similarity > 0.85) {
        // Found a duplicate — keep the better one
        deduplicated[i] = selectBetter(deduplicated[i], paper);
        isDuplicate = true;
        break;
      }
    }

    if (!isDuplicate) {
      deduplicated.push({ ...paper, id: uuidv4() });
    }
  }

  return deduplicated;
}
