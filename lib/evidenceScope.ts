import {
  EvidenceScope,
  EvidenceScopeDiagnostics,
  Paper,
} from './types';
import { rankPapers } from './embedder';
import { applyFacetRanking, buildFacetedQueries, buildDriftWarning } from './facetedRetrieval';

const SCOPE_LABELS: Record<EvidenceScope, string> = {
  balanced: 'Balanced',
  strict_local: 'Strict local / geographic',
  global_first: 'Global evidence first',
  geography_independent: 'Geography-independent',
  compare_local_global: 'Compare local vs global',
};

const GEOGRAPHY_TERMS = [
  'bangladesh',
  'dhaka',
  'chittagong',
  'chattogram',
  'sylhet',
  'khulna',
  'rajshahi',
  'barisal',
  'rangpur',
  'mymensingh',
  'south asia',
  'south asian',
  'india',
  'pakistan',
  'nepal',
  'sri lanka',
  'asia',
  'asian',
  'usa',
  'united states',
  'uk',
  'united kingdom',
  'europe',
  'africa',
  'rural',
  'urban',
  'coastal',
  'low-resource',
  'low resource',
  'lmics',
  'lmic',
];

const QUERY_STOPWORDS = new Set([
  'about',
  'among',
  'and',
  'are',
  'based',
  'for',
  'from',
  'how',
  'into',
  'of',
  'on',
  'the',
  'this',
  'using',
  'with',
]);

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function includesTerm(text: string, term: string): boolean {
  return normalize(text).includes(normalize(term));
}

export function extractGeographyTerms(ideaText: string): string[] {
  return GEOGRAPHY_TERMS.filter((term) => includesTerm(ideaText, term));
}

function removeGeographyTerms(ideaText: string, terms: string[]): string {
  return terms
    .reduce(
      (current, term) =>
        current.replace(new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'), ' '),
      ideaText
    )
    .replace(/\s+/g, ' ')
    .trim();
}

function paperText(paper: Paper): string {
  return `${paper.title} ${paper.abstract}`;
}

function extractContentTerms(ideaText: string, geographyTerms: string[]): string[] {
  const withoutGeography = removeGeographyTerms(ideaText, geographyTerms);
  const terms = normalize(withoutGeography)
    .split(/\s+/)
    .filter(
      (term) =>
        (term.length >= 4 || term === 'ai' || term === 'tb') &&
        !QUERY_STOPWORDS.has(term)
    );

  return [...new Set(terms)];
}

function getContentTermCoverage(paper: Paper, contentTerms: string[]): number {
  if (contentTerms.length === 0) return 1;

  const text = normalize(paperText(paper));
  const hits = contentTerms.filter((term) => {
    if (term === 'ai') {
      return text.includes(' ai ') || text.includes('artificial intelligence');
    }
    return text.includes(term);
  }).length;
  return hits / contentTerms.length;
}

function hasGeographyMatch(paper: Paper, terms: string[]): boolean {
  const text = paperText(paper);
  return terms.some((term) => includesTerm(text, term));
}

function scopedScore(
  paper: Paper,
  terms: string[],
  contentTerms: string[],
  scope: EvidenceScope
): number {
  const baseScore = paper.similarityScore || 0;
  if (terms.length === 0) return baseScore;

  const localMatch = hasGeographyMatch(paper, terms);
  const contentCoverage = getContentTermCoverage(paper, contentTerms);
  const stronglyPreservesTopic = contentCoverage >= 0.5;
  const partiallyPreservesTopic = contentCoverage >= 0.35;

  if (scope === 'strict_local') {
    if (localMatch && stronglyPreservesTopic) return baseScore + 0.16;
    if (localMatch && partiallyPreservesTopic) return baseScore + 0.06;
    if (localMatch) return baseScore - 0.06;
    return baseScore - 0.02;
  }

  if (scope === 'balanced') {
    return baseScore + (localMatch && partiallyPreservesTopic ? 0.06 : 0);
  }

  if (scope === 'compare_local_global') {
    return baseScore;
  }

  return baseScore;
}

function buildSummary(
  scope: EvidenceScope,
  terms: string[],
  top10LocalMatches: number,
  localEvidenceCount: number,
  globalEvidenceCount: number
): string {
  if (terms.length === 0) {
    return 'No explicit geography was detected, so geographic filtering did not affect ranking.';
  }

  const termText = terms.join(', ');
  if (scope === 'strict_local') {
    return `Strict local mode prioritized papers that mention ${termText}; ${top10LocalMatches} of the top 10 preserve the geography.`;
  }
  if (scope === 'global_first') {
    return `Global evidence first mode used ${termText} for diagnostics but did not penalize global papers.`;
  }
  if (scope === 'geography_independent') {
    return `Geography-independent mode removed ${termText} from the ranking query so novelty is judged beyond place.`;
  }
  if (scope === 'compare_local_global') {
    return `Compare mode found ${globalEvidenceCount} globally related papers and ${localEvidenceCount} papers that also mention ${termText}.`;
  }
  return `Balanced mode lightly preferred papers mentioning ${termText} without excluding global evidence.`;
}

export function rankPapersWithEvidenceScope(
  papers: Paper[],
  ideaText: string,
  scope: EvidenceScope = 'balanced'
): {
  rankedPapers: Paper[];
  diagnostics: EvidenceScopeDiagnostics;
} {
  const facetDiagnostics = buildFacetedQueries({
    text: ideaText,
    field: '',
    level: 'undergraduate',
    language: 'en',
  });
  const detectedGeographyTerms = [
    ...new Set([
      ...extractGeographyTerms(ideaText),
      ...facetDiagnostics.geography,
    ]),
  ];
  const contentTerms = extractContentTerms(ideaText, detectedGeographyTerms);
  const rankingIdea =
    [
      'global_first',
      'geography_independent',
      'compare_local_global',
    ].includes(scope) && detectedGeographyTerms.length > 0
      ? removeGeographyTerms(ideaText, detectedGeographyTerms)
      : ideaText;

  const baseRankedPapers = rankPapers(papers, rankingIdea || ideaText);
  const scopeRankedPapers = [...baseRankedPapers].sort(
    (a, b) =>
      scopedScore(b, detectedGeographyTerms, contentTerms, scope) -
      scopedScore(a, detectedGeographyTerms, contentTerms, scope)
  );
  const rankedPapers = applyFacetRanking(scopeRankedPapers, facetDiagnostics);
  const driftWarning = buildDriftWarning(rankedPapers);

  const localEvidenceCount = rankedPapers.filter((paper) =>
    hasGeographyMatch(paper, detectedGeographyTerms)
  ).length;
  const globalEvidenceCount = rankedPapers.length;
  const top10LocalMatches = rankedPapers
    .slice(0, 10)
    .filter((paper) => hasGeographyMatch(paper, detectedGeographyTerms)).length;
  const top20LocalMatches = rankedPapers
    .slice(0, 20)
    .filter((paper) => hasGeographyMatch(paper, detectedGeographyTerms)).length;

  return {
    rankedPapers,
    diagnostics: {
      scope,
      label: SCOPE_LABELS[scope],
      detectedGeographyTerms,
      top10LocalMatches,
      top20LocalMatches,
      localEvidenceCount,
      globalEvidenceCount,
      summary: [
        buildSummary(
          scope,
          detectedGeographyTerms,
          top10LocalMatches,
          localEvidenceCount,
          globalEvidenceCount
        ),
        driftWarning,
      ].filter(Boolean).join(' '),
    },
  };
}
