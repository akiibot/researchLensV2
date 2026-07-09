import {
  Paper,
  ResearchIdea,
  RetrievalSource,
  SearchFacetDiagnostics,
} from './types';

type FacetKey =
  | 'problem'
  | 'domain'
  | 'languageContext'
  | 'method'
  | 'intervention'
  | 'geography';

const FACET_PATTERNS: Record<FacetKey, Array<{ label: string; patterns: RegExp[] }>> = {
  problem: [
    { label: 'OTP theft', patterns: [/\botp\b/i, /one[ -]?time password/i] },
    { label: 'smishing', patterns: [/smishing/i, /sms phishing/i] },
    { label: 'phishing', patterns: [/phishing/i, /credential theft/i] },
    { label: 'social engineering', patterns: [/social engineering/i, /scam/i, /fraud/i] },
  ],
  domain: [
    { label: 'mobile financial services', patterns: [/mobile financial services/i, /\bmfs\b/i] },
    { label: 'mobile money', patterns: [/mobile money/i] },
    { label: 'mobile banking', patterns: [/mobile banking/i, /digital banking/i] },
    { label: 'digital payments', patterns: [/digital payment/i, /fintech/i, /payment fraud/i] },
  ],
  languageContext: [
    { label: 'Bangla', patterns: [/bangla/i] },
    { label: 'Banglish', patterns: [/banglish/i, /code[ -]?mixed/i, /code[ -]?mixing/i] },
    { label: 'Bengali', patterns: [/bengali/i] },
    { label: 'low-resource NLP', patterns: [/low[ -]?resource/i] },
  ],
  method: [
    { label: 'NLP', patterns: [/\bnlp\b/i, /natural language processing/i, /text classification/i] },
    { label: 'temporal modeling', patterns: [/temporal/i, /event[ -]?window/i, /time[ -]?aware/i] },
    { label: 'fraud detection', patterns: [/fraud detection/i, /anomaly detection/i] },
    { label: 'hybrid model', patterns: [/hybrid/i, /ensemble/i, /transformer/i, /lstm/i] },
  ],
  intervention: [
    { label: 'adaptive warning', patterns: [/adaptive warning/i, /warning/i, /risk alert/i] },
    { label: 'prevention', patterns: [/prevention/i, /intervention/i, /user education/i] },
  ],
  geography: [
    { label: 'Bangladesh', patterns: [/bangladesh/i, /dhaka/i, /bkash/i, /nagad/i, /rocket/i] },
    { label: 'South Asia', patterns: [/south asia/i, /south asian/i] },
  ],
};

const GENERIC_TERMS = new Set([
  'temporal',
  'risk',
  'aware',
  'detection',
  'prevention',
  'modeling',
  'hybrid',
  'adaptive',
  'using',
  'warnings',
  'warning',
  'outcomes',
  'outcome',
]);

const BIOMEDICAL_TERMS = [
  /health/i,
  /medical/i,
  /clinical/i,
  /patient/i,
  /disease/i,
  /cancer/i,
  /cardiovascular/i,
  /hospital/i,
  /public health/i,
  /biomed/i,
];

const FACET_ALIASES: Record<string, string[]> = {
  'OTP theft': ['otp', 'one time password', 'smishing', 'sms phishing', 'phishing', 'credential theft'],
  smishing: ['smishing', 'sms phishing', 'phishing'],
  phishing: ['phishing', 'smishing', 'credential theft'],
  'social engineering': ['social engineering', 'scam', 'fraud', 'phishing'],
  'mobile financial services': ['mobile financial services', 'mfs', 'mobile money', 'mobile banking', 'digital payment', 'fintech'],
  'mobile money': ['mobile money', 'mobile financial services', 'mfs'],
  'mobile banking': ['mobile banking', 'mobile financial services', 'digital banking'],
  'digital payments': ['digital payment', 'payment fraud', 'fintech', 'mobile payment'],
  Bangla: ['bangla', 'bengali', 'banglish', 'code mixed', 'code mixing'],
  Banglish: ['banglish', 'bangla', 'bengali', 'code mixed', 'code mixing'],
  Bengali: ['bengali', 'bangla', 'banglish'],
  NLP: ['nlp', 'natural language processing', 'text classification', 'language model'],
  'temporal modeling': ['temporal', 'event window', 'time aware', 'time series'],
  'fraud detection': ['fraud detection', 'anomaly detection', 'scam detection', 'phishing detection'],
  'adaptive warning': ['adaptive warning', 'warning', 'risk alert', 'alert'],
  prevention: ['prevention', 'intervention', 'user education', 'warning'],
  Bangladesh: ['bangladesh', 'dhaka', 'bkash', 'nagad', 'rocket'],
  'South Asia': ['south asia', 'south asian', 'bangladesh', 'india', 'pakistan'],
};

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function compactUnique(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const cleaned = value.trim();
    const key = cleaned.toLowerCase();
    if (!cleaned || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function detectFacet(text: string, key: FacetKey): string[] {
  return FACET_PATTERNS[key]
    .filter((entry) => entry.patterns.some((pattern) => pattern.test(text)))
    .map((entry) => entry.label);
}

function inferContextualGeography(
  facets: Pick<
    SearchFacetDiagnostics,
    'domain' | 'languageContext' | 'geography'
  >
): string[] {
  const inferred = [...facets.geography];
  const hasBanglaLanguage = facets.languageContext.some((value) =>
    ['bangla', 'banglish', 'bengali'].includes(value.toLowerCase())
  );
  const hasBangladeshMfsDomain = facets.domain.some((value) =>
    [
      'mobile financial services',
      'mobile money',
      'mobile banking',
      'digital payments',
    ].includes(value.toLowerCase())
  );

  if (hasBanglaLanguage && hasBangladeshMfsDomain && !inferred.includes('Bangladesh')) {
    inferred.push('Bangladesh');
  }

  return inferred;
}

function fallbackFacetTerms(text: string): Pick<
  SearchFacetDiagnostics,
  'problem' | 'domain' | 'languageContext' | 'method' | 'intervention' | 'geography'
> {
  const facets = {
    problem: detectFacet(text, 'problem'),
    domain: detectFacet(text, 'domain'),
    languageContext: detectFacet(text, 'languageContext'),
    method: detectFacet(text, 'method'),
    intervention: detectFacet(text, 'intervention'),
    geography: detectFacet(text, 'geography'),
  };

  return {
    ...facets,
    geography: inferContextualGeography(facets),
  };
}

function hasSecurityRetrievalIntent(
  text: string,
  facets: Pick<
    SearchFacetDiagnostics,
    'problem' | 'domain' | 'languageContext' | 'intervention'
  >
): boolean {
  if (facets.problem.length > 0 || facets.domain.length > 0) return true;
  return /otp|phish|smish|fraud|scam|social engineering|mobile financial|mobile money|\bmfs\b|vishing/i.test(
    text
  );
}

function hasRankingFacets(diagnostics: SearchFacetDiagnostics): boolean {
  return [
    diagnostics.problem,
    diagnostics.domain,
    diagnostics.languageContext,
    diagnostics.geography,
  ].some((values) => values.length > 0);
}

function queryOr(...parts: string[][]): string {
  return parts
    .flat()
    .filter(Boolean)
    .map((part) => (part.includes(' ') ? `"${part}"` : part))
    .join(' ');
}

export function shouldSkipBiomedicalSources(idea: ResearchIdea): boolean {
  const haystack = `${idea.field || ''} ${idea.text || ''}`;
  if (/medicine|medical|health|biology|biomedical|public health/i.test(idea.field || '')) {
    return false;
  }
  return !BIOMEDICAL_TERMS.some((pattern) => pattern.test(haystack));
}

export function buildFacetedQueries(
  idea: ResearchIdea,
  baseQueries: string[] = []
): SearchFacetDiagnostics {
  const facets = fallbackFacetTerms(idea.text);
  const skippedSources = shouldSkipBiomedicalSources(idea)
    ? (['pubmed', 'europepmc'] as RetrievalSource[])
    : [];
  const highValueAnchors = [
    ...facets.problem,
    ...facets.domain,
    ...facets.languageContext,
    ...facets.geography,
  ];

  if (!hasSecurityRetrievalIntent(idea.text, facets)) {
    return {
      ...facets,
      generatedQueries: compactUnique(baseQueries).slice(0, 10),
      skippedSources,
    };
  }

  const coreProblem = facets.problem.length ? facets.problem : ['phishing', 'fraud', 'social engineering'];
  const coreDomain = facets.domain.length ? facets.domain : ['mobile financial services', 'mobile money'];
  const coreLanguage = facets.languageContext.length ? facets.languageContext : ['Bangla', 'Bengali', 'Banglish'];
  const coreMethod = facets.method.length ? facets.method : ['NLP', 'fraud detection'];
  const coreIntervention = facets.intervention.length ? facets.intervention : ['adaptive warning', 'prevention'];
  const coreGeography = facets.geography;

  const generatedQueries = compactUnique([
    queryOr(coreProblem.slice(0, 2), coreDomain.slice(0, 2)),
    queryOr(coreProblem.slice(0, 2), coreLanguage.slice(0, 3)),
    ...(coreGeography.length > 0
      ? [queryOr(coreProblem.slice(0, 2), coreDomain.slice(0, 2), coreGeography.slice(0, 2))]
      : []),
    queryOr(coreDomain.slice(0, 2), ['social engineering', 'OTP']),
    queryOr(coreLanguage.slice(0, 3), ['NLP', 'smishing', 'phishing']),
    queryOr(coreMethod.slice(0, 2), coreProblem.slice(0, 2)),
    queryOr(coreIntervention.slice(0, 2), ['phishing', 'social engineering']),
    ...baseQueries,
  ]).filter((query, index) => {
    if (index < 6) return true;
    const normalized = normalize(query);
    const hasAnchor = highValueAnchors.some((anchor) => normalized.includes(normalize(anchor)));
    const tokens = normalized.split(/\s+/);
    const genericRatio =
      tokens.length > 0 ? tokens.filter((token) => GENERIC_TERMS.has(token)).length / tokens.length : 0;
    return hasAnchor || genericRatio < 0.35;
  });

  return {
    ...facets,
    generatedQueries: generatedQueries.slice(0, 10),
    skippedSources,
  };
}

function paperText(paper: Paper): string {
  return normalize(`${paper.title} ${paper.abstract} ${paper.venue || ''}`);
}

function containsNormalizedPhrase(text: string, phrase: string): boolean {
  return ` ${text} `.includes(` ${normalize(phrase)} `);
}

function matchesAnyFacet(text: string, values: string[]): string[] {
  return values.filter((value) =>
    (FACET_ALIASES[value] || [value]).some((alias) => containsNormalizedPhrase(text, alias))
  );
}

export function scorePaperFacetFit(
  paper: Paper,
  diagnostics: SearchFacetDiagnostics
): {
  fit: 'strong' | 'partial' | 'weak';
  matchedFacets: string[];
  missingFacets: string[];
  score: number;
} {
  const text = paperText(paper);
  const matched: string[] = [];
  const missing: string[] = [];
  const facetValues: Array<[FacetKey, string[]]> = [
    ['problem', diagnostics.problem],
    ['domain', diagnostics.domain],
    ['languageContext', diagnostics.languageContext],
    ['method', diagnostics.method],
    ['intervention', diagnostics.intervention],
    ['geography', diagnostics.geography],
  ];

  for (const [facet, values] of facetValues) {
    if (values.length === 0) continue;
    const hits = matchesAnyFacet(text, values);
    if (hits.length > 0) {
      matched.push(facet);
    } else {
      missing.push(facet);
    }
  }

  const hasProblem = matched.includes('problem');
  const hasDomain = matched.includes('domain');
  const hasLanguage = matched.includes('languageContext');
  const hasMethod = matched.includes('method');
  const hasIntervention = matched.includes('intervention');
  const hasGeography = matched.includes('geography');
  const score =
    (hasProblem ? 35 : 0) +
    (hasDomain ? 25 : 0) +
    (hasLanguage ? 22 : 0) +
    (hasMethod ? 12 : 0) +
    (hasIntervention ? 6 : 0) +
    (hasGeography ? 22 : 0);

  const fit =
    (hasProblem && (hasDomain || hasLanguage)) || (hasDomain && hasLanguage && hasMethod)
      ? 'strong'
      : hasProblem || hasDomain || hasLanguage
        ? 'partial'
        : 'weak';

  return {
    fit,
    matchedFacets: matched,
    missingFacets: missing,
    score,
  };
}

export function applyFacetRanking(
  papers: Paper[],
  diagnostics: SearchFacetDiagnostics
): Paper[] {
  if (!hasRankingFacets(diagnostics)) {
    return papers;
  }

  return [...papers]
    .map((paper) => {
      const facetFit = scorePaperFacetFit(paper, diagnostics);
      const baseScore = paper.similarityScore || 0;
      const fitBoost =
        facetFit.fit === 'strong' ? 0.24 : facetFit.fit === 'partial' ? 0.08 : -0.1;
      const contextualBoost =
        (diagnostics.languageContext.length > 0 && facetFit.matchedFacets.includes('languageContext')
          ? 0.08
          : 0) +
        (diagnostics.geography.length > 0 && facetFit.matchedFacets.includes('geography')
          ? 0.08
          : 0);
      return {
        ...paper,
        retrievalFit: facetFit.fit,
        matchedFacets: facetFit.matchedFacets,
        missingFacets: facetFit.missingFacets,
        similarityScore: Math.max(0, baseScore + fitBoost + contextualBoost + facetFit.score / 500),
      };
    })
    .sort((a, b) => (b.similarityScore || 0) - (a.similarityScore || 0));
}

export function buildDriftWarning(papers: Paper[]): string | undefined {
  if (papers.length === 0) return undefined;
  const weakTopCount = papers.slice(0, 10).filter((paper) => paper.retrievalFit === 'weak').length;
  if (weakTopCount >= 4) {
    return 'Top results are matching generic method/risk terms more than the core problem, domain, or language context.';
  }
  return undefined;
}
