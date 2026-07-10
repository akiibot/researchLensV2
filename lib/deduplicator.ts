/**
 * @file Paper Deduplicator
 *
 * Deduplicates papers retrieved from multiple academic APIs.
 *
 * Strategy:
 * 1. Primary key: DOI, normalized by lowercasing and stripping DOI URL prefixes
 * 2. Secondary key: exact normalized title
 * 3. Fallback: high title similarity using Jaccard token overlap
 * 4. When duplicates are found, keep the record with richer scholarly metadata
 *
 * Title matching applies to DOI-backed papers too. This catches repository
 * version records that have identical titles but distinct version DOIs.
 */

import { v4 as uuidv4 } from 'uuid';
import { Paper } from './types';

/**
 * Normalizes a DOI string for consistent comparison.
 */
export function normalizeDoi(doi: string | null): string | null {
  if (!doi || doi.trim() === '') return null;
  return doi
    .toLowerCase()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, '')
    .trim();
}

/**
 * Normalizes a title to a stable key for duplicate detection.
 */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/&amp;/g, 'and')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenizeTitle(title: string): Set<string> {
  return new Set(
    normalizeTitle(title)
      .split(/\s+/)
      .filter((word) => word.length > 1)
  );
}

function jaccardSimilarity(tokensA: Set<string>, tokensB: Set<string>): number {
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
 * Computes Jaccard similarity between two title strings.
 */
export function titleSimilarity(titleA: string, titleB: string): number {
  return jaccardSimilarity(tokenizeTitle(titleA), tokenizeTitle(titleB));
}

function sourcePriority(source: Paper['source']): number {
  const priorities: Record<Paper['source'], number> = {
    pubmed: 7,
    openalex: 6,
    semanticscholar: 5,
    arxiv: 4,
    europepmc: 4,
    datacite: 3,
    core: 2,
    crossref: 1,
  };

  return priorities[source] || 0;
}

function metadataScore(paper: Paper): number {
  const abstractScore = Math.min(paper.abstract.length, 2000) / 100;
  const hasFullText = Boolean(paper.pdfUrl) || paper.fullTextStatus === 'available';

  return (
    abstractScore +
    (paper.doi ? 20 : 0) +
    (paper.url ? 5 : 0) +
    (paper.venue ? 5 : 0) +
    (hasFullText ? 25 : 0) +
    Math.min(paper.citationCount, 500) / 25 +
    sourcePriority(paper.source)
  );
}

function selectBetter(existing: Paper, candidate: Paper): Paper {
  const winner =
    metadataScore(candidate) > metadataScore(existing)
      ? { ...candidate, id: existing.id }
      : existing;
  const loser = winner === existing ? candidate : existing;

  // Even when the winner has richer metadata overall, don't let a real,
  // working full-text link get thrown away just because the other record
  // scored higher on citations/DOI/etc.
  if (!winner.pdfUrl && loser.pdfUrl) {
    return {
      ...winner,
      pdfUrl: loser.pdfUrl,
      accessType: loser.accessType ?? winner.accessType,
      fullTextStatus: loser.fullTextStatus ?? winner.fullTextStatus,
      fullTextSource: loser.fullTextSource ?? winner.fullTextSource,
      fullTextVerifiedAt: loser.fullTextVerifiedAt ?? winner.fullTextVerifiedAt,
    };
  }

  return winner;
}

function isTitleDuplicateByTokens(
  normalizedA: string,
  normalizedB: string,
  tokensA: Set<string>,
  tokensB: Set<string>
): boolean {
  if (!normalizedA || !normalizedB) return false;
  if (normalizedA === normalizedB) return true;

  return jaccardSimilarity(tokensA, tokensB) >= 0.92;
}

function registerIndexes(
  paper: Paper,
  index: number,
  doiToIndex: Map<string, number>,
  titleToIndex: Map<string, number>
) {
  const normalizedDoi = normalizeDoi(paper.doi);
  const normalizedTitle = normalizeTitle(paper.title);
  if (normalizedDoi) doiToIndex.set(normalizedDoi, index);
  if (normalizedTitle) titleToIndex.set(normalizedTitle, index);
}

/**
 * Deduplicates an array of papers from multiple sources.
 */
export function deduplicatePapers(papers: Paper[]): Paper[] {
  const deduplicated: Paper[] = [];
  const doiToIndex = new Map<string, number>();
  const titleToIndex = new Map<string, number>();
  // Memoized per-accepted-paper tokenization, so the O(n) fallback scan
  // never re-tokenizes an already-accepted title from scratch.
  const dedupedNormalizedTitles: string[] = [];
  const dedupedTokenSets: Set<string>[] = [];

  for (const paper of papers) {
    const normalizedDoi = normalizeDoi(paper.doi);
    const normalizedTitle = normalizeTitle(paper.title);
    const tokens = tokenizeTitle(paper.title);

    let duplicateIndex =
      normalizedDoi && doiToIndex.has(normalizedDoi)
        ? doiToIndex.get(normalizedDoi)
        : undefined;

    if (duplicateIndex === undefined && normalizedTitle) {
      duplicateIndex = titleToIndex.get(normalizedTitle);
    }

    if (duplicateIndex === undefined) {
      for (let i = 0; i < deduplicated.length; i++) {
        if (
          isTitleDuplicateByTokens(
            normalizedTitle,
            dedupedNormalizedTitles[i],
            tokens,
            dedupedTokenSets[i]
          )
        ) {
          duplicateIndex = i;
          break;
        }
      }
    }

    if (duplicateIndex !== undefined) {
      deduplicated[duplicateIndex] = selectBetter(
        deduplicated[duplicateIndex],
        paper
      );
      dedupedNormalizedTitles[duplicateIndex] = normalizeTitle(
        deduplicated[duplicateIndex].title
      );
      dedupedTokenSets[duplicateIndex] = tokenizeTitle(
        deduplicated[duplicateIndex].title
      );
      registerIndexes(
        deduplicated[duplicateIndex],
        duplicateIndex,
        doiToIndex,
        titleToIndex
      );
      registerIndexes(paper, duplicateIndex, doiToIndex, titleToIndex);
      continue;
    }

    const index = deduplicated.length;
    deduplicated.push({ ...paper, id: uuidv4() });
    dedupedNormalizedTitles[index] = normalizedTitle;
    dedupedTokenSets[index] = tokens;
    registerIndexes(paper, index, doiToIndex, titleToIndex);
  }

  return deduplicated;
}
