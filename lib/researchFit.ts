import {
  EvidenceScopeDiagnostics,
  FacultyProfile,
  FundingFit,
  GapDimension,
  JournalTarget,
  JournalTargeting,
  Paper,
  ResearchSanityMatrix,
} from './types';
import { OpenAlexSourceMetadata } from './openalexClient';

interface ResearchFitInput {
  ideaText: string;
  papers: Paper[];
  gapMatrix: GapDimension[];
  facultyMatches?: FacultyProfile[];
  sourceMetadata?: Record<string, OpenAlexSourceMetadata | null>;
  sanityMatrix?: ResearchSanityMatrix;
  evidenceScopeDiagnostics?: EvidenceScopeDiagnostics;
}

const FUNDING_SEARCH_LINKS: NonNullable<FundingFit['searchLinks']> = [
  {
    label: 'Grants.gov search',
    url: 'https://www.grants.gov/search-grants',
    purpose: 'Search US federal grant opportunities by topic keyword.',
  },
  {
    label: 'NIH RePORTER',
    url: 'https://reporter.nih.gov/',
    purpose: 'Find funded biomedical, behavioral, and public-health precedents.',
  },
  {
    label: 'CORDIS projects',
    url: 'https://cordis.europa.eu/projects',
    purpose: 'Explore EU-funded research projects and framing patterns.',
  },
  {
    label: 'UKRI Gateway to Research',
    url: 'https://gtr.ukri.org/',
    purpose: 'Browse UK-funded project records and fundable language.',
  },
  {
    label: 'World Bank projects',
    url: 'https://projects.worldbank.org/',
    purpose: 'Find development-oriented project language and funder priorities.',
  },
];

const INTERNAL_ROUTES: NonNullable<FundingFit['internalRoutes']> = [
  {
    label: 'Faculty Directory',
    href: '/faculty',
    purpose: 'Find collaborators or supervisors who strengthen funding fit.',
  },
  {
    label: 'Saved Reports',
    href: '/reports',
    purpose: 'Review saved analyses before preparing funding materials.',
  },
];

const CONNECTOR_SUGGESTIONS: NonNullable<FundingFit['connectorSuggestions']> = [
  {
    name: 'Grants.gov',
    type: 'government',
    purpose: 'Live opportunity search for US federal grants.',
    status: 'future_integration',
  },
  {
    name: 'NIH RePORTER',
    type: 'grant_database',
    purpose: 'Find funded biomedical and behavioral research precedents.',
    status: 'future_integration',
  },
  {
    name: 'CORDIS',
    type: 'grant_database',
    purpose: 'Discover EU-funded project topics and consortium framing.',
    status: 'future_integration',
  },
];

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function lower(text: string): string {
  return text.toLowerCase();
}

function includesAny(text: string, terms: string[]): boolean {
  const value = lower(text);
  return terms.some((term) => value.includes(term));
}

function scoreFromSanity(score?: number, fallback = 50): number {
  return typeof score === 'number' ? score : fallback;
}

function countRecentPapers(papers: Paper[]): number {
  const currentYear = new Date().getFullYear();
  return papers.filter((paper) => paper.year && currentYear - paper.year <= 5).length;
}

function doiCoverage(papers: Paper[]): number {
  if (papers.length === 0) return 0;
  return papers.filter((paper) => Boolean(paper.doi)).length / papers.length;
}

function sourceDiversity(papers: Paper[]): number {
  return new Set(papers.map((paper) => paper.source)).size;
}

function primaryGap(gapMatrix: GapDimension[]): GapDimension | undefined {
  return [...gapMatrix].sort((a, b) => {
    const order = { crowded: 0, moderate: 1, open: 2 };
    return order[a.saturation] - order[b.saturation];
  })[0];
}

function inferArticleRoute(ideaText: string, papers: Paper[]): string {
  if (includesAny(ideaText, ['systematic review', 'literature review', 'scoping review'])) {
    return 'Systematic or scoping review route';
  }
  if (papers.some((paper) => /proceedings|conference/i.test(`${paper.type} ${paper.venue || ''}`))) {
    return 'Conference paper route';
  }
  if (includesAny(ideaText, ['prototype', 'system', 'model', 'algorithm', 'detection'])) {
    return 'Technical empirical paper route';
  }
  if (includesAny(ideaText, ['survey', 'interview', 'case study', 'mixed method'])) {
    return 'Empirical journal article route';
  }
  return 'Thesis-first route, then convert strongest findings into a paper';
}

function methodIsExplicit(ideaText: string): boolean {
  return includesAny(ideaText, [
    'survey',
    'interview',
    'experiment',
    'case study',
    'systematic review',
    'mixed method',
    'nlp',
    'machine learning',
    'model',
    'regression',
    'classification',
    'dataset',
    'prototype',
    'field study',
  ]);
}

function contextIsExplicit(ideaText: string): boolean {
  return includesAny(ideaText, [
    'bangladesh',
    'global',
    'university',
    'student',
    'industry',
    'rural',
    'urban',
    'hospital',
    'school',
    'workplace',
    'mobile financial',
    'banking',
  ]);
}

function impactIsExplicit(ideaText: string): boolean {
  return includesAny(ideaText, [
    'impact',
    'improve',
    'prevention',
    'detection',
    'warning',
    'risk',
    'safety',
    'health',
    'education',
    'productivity',
    'inclusion',
    'access',
    'policy',
  ]);
}

function weaknessList({
  ideaText,
  papers,
  gapMatrix,
  facultyMatches,
  sanityMatrix,
}: ResearchFitInput): string[] {
  const weaknesses: string[] = [];
  const gap = primaryGap(gapMatrix);

  if (!methodIsExplicit(ideaText)) {
    weaknesses.push('Method is not explicit enough for a fundable proposal.');
  }
  if (!contextIsExplicit(ideaText)) {
    weaknesses.push('Population, institution, or geography needs clearer boundaries.');
  }
  if (!impactIsExplicit(ideaText)) {
    weaknesses.push('Practical or scholarly impact needs sharper framing.');
  }
  if (papers.length < 15 || scoreFromSanity(sanityMatrix?.evidenceStrength.score, 45) < 55) {
    weaknesses.push('Evidence base is still thin; read and verify more papers first.');
  }
  if (!facultyMatches || facultyMatches.length === 0) {
    weaknesses.push('No collaborator or supervisor match is attached yet.');
  }
  if (gap?.saturation === 'crowded') {
    weaknesses.push(`The ${gap.dimension} dimension appears crowded and needs narrowing.`);
  }

  return unique(weaknesses).slice(0, 4);
}

export function computeFundingFit(input: ResearchFitInput): FundingFit {
  const {
    ideaText,
    papers,
    facultyMatches = [],
    sanityMatrix,
    evidenceScopeDiagnostics,
  } = input;

  const evidenceScore = scoreFromSanity(sanityMatrix?.evidenceStrength.score, papers.length >= 30 ? 75 : 50);
  const feasibilityScore = scoreFromSanity(sanityMatrix?.feasibility.score, 55);
  const supervisorScore = scoreFromSanity(sanityMatrix?.supervisorFit.score, facultyMatches.length > 0 ? 65 : 45);
  const riskPenalty = scoreFromSanity(sanityMatrix?.claimRisk.score, 50) * 0.22;
  const methodScore = methodIsExplicit(ideaText) ? 80 : 42;
  const contextScore = contextIsExplicit(ideaText) ? 78 : 45;
  const impactScore = impactIsExplicit(ideaText) ? 82 : 50;
  const sourceScore = Math.min(100, sourceDiversity(papers) * 18 + doiCoverage(papers) * 20);
  const recentScore = Math.min(100, countRecentPapers(papers) * 8);
  const localEvidenceBonus = evidenceScopeDiagnostics?.localEvidenceCount
    ? Math.min(8, evidenceScopeDiagnostics.localEvidenceCount)
    : 0;

  const score = clamp(
    evidenceScore * 0.18 +
      feasibilityScore * 0.18 +
      supervisorScore * 0.12 +
      methodScore * 0.14 +
      contextScore * 0.12 +
      impactScore * 0.14 +
      sourceScore * 0.08 +
      recentScore * 0.04 +
      localEvidenceBonus -
      riskPenalty
  );

  const readiness: FundingFit['readiness'] =
    score >= 75 ? 'high' : score >= 52 ? 'medium' : 'low';
  const budgetScale: FundingFit['budgetScale'] =
    score >= 88 && facultyMatches.length >= 3
        ? 'major_grant'
        : score >= 78 && facultyMatches.length >= 2
          ? 'external_seed'
          : 'small_internal';

  const weaknesses = weaknessList(input);
  const blocker =
    weaknesses[0] ||
    (score < 75
      ? 'Proposal needs sharper method, context, or evidence verification.'
      : 'No major blocker detected; verify fit with a supervisor or funding office.');

  const bestAngles = unique([
    impactIsExplicit(ideaText) ? 'Applied impact or intervention pilot' : 'Early-stage thesis pilot study',
    methodIsExplicit(ideaText) ? 'Method validation or prototype study' : 'Proposal development and feasibility study',
    contextIsExplicit(ideaText) ? 'Context-specific evidence gap' : 'Focused scope-refinement grant',
    'Internal university seed funding',
  ]).slice(0, 5);

  const funderCategories = unique([
    'University internal research grants',
    'Departmental thesis support funds',
    'Small seed grants',
    includesAny(ideaText, ['health', 'public health', 'hospital'])
      ? 'Public health research programs'
      : '',
    includesAny(ideaText, ['education', 'student', 'learning'])
      ? 'Education innovation funds'
      : '',
    includesAny(ideaText, ['bangladesh', 'rural', 'financial', 'inclusion'])
      ? 'Development and inclusion-focused funders'
      : '',
  ].filter(Boolean)).slice(0, 5);

  const title = ideaText.trim() || 'this thesis direction';

  return {
    readiness,
    score,
    biggestBlocker: blocker,
    nextBestAction:
      readiness === 'high'
        ? 'Prepare a one-page concept note and confirm eligibility with a funding office.'
        : 'Narrow method, population, and measurable outcome before approaching funders.',
    bestAngles,
    funderCategories,
    searchLinks: FUNDING_SEARCH_LINKS,
    internalRoutes: INTERNAL_ROUTES,
    connectorSuggestions: CONNECTOR_SUGGESTIONS,
    grantReadyFraming:
      readiness === 'high'
        ? 'The idea has enough structure to become a small grant or seed proposal after manual eligibility checks.'
        : 'The idea is best framed as a small internal pilot after the method, population, and measurable outcome are narrowed.',
    weaknesses,
    collaboratorProfiles: unique([
      'Subject-matter supervisor',
      methodIsExplicit(ideaText) ? 'Methods or statistics advisor' : 'Methodology advisor',
      impactIsExplicit(ideaText) ? 'Implementation partner or domain stakeholder' : 'Domain expert who can sharpen impact framing',
      ...(facultyMatches.length > 0 ? ['Matched faculty collaborator from ResearchLens results'] : []),
    ]).slice(0, 4),
    outreachDrafts: [
      {
        title: 'Funding office inquiry',
        recipientType: 'funding_office',
        body:
          'Hello, I am preparing a small research pilot and would appreciate guidance on internal funding opportunities that support early-stage thesis or student research. The project is being refined around a clear research gap, feasible method, and supervisor feedback. Could you advise which internal schemes or deadlines may be appropriate?',
      },
      {
        title: 'Potential collaborator note',
        recipientType: 'potential_collaborator',
        body:
          'Dear Professor, I am developing a small pilot study and noticed that your expertise may align with the topic and methodology. I would value a brief conversation about whether the framing is feasible and whether there are collaboration or supervision pathways I should consider.',
      },
    ],
    miniGrantAbstract: `This pilot project will evaluate ${title}. The study will use the retrieved literature to define a defensible research gap, narrow the target context, and verify whether the proposed method can produce credible evidence within a student thesis timeline. The expected output is a supervisor-reviewed research plan, a focused reading base, and preliminary evidence that can support a larger study or publication route.`,
    specificAims: [
      'Identify the closest existing studies and the most defensible remaining contribution space.',
      'Refine the study population, context, method, and measurable outcome into a feasible pilot design.',
      'Prepare a supervisor-ready concept note with risks, evidence boundaries, and next reading priorities.',
    ],
    impactStatement:
      'The project can reduce duplicated thesis work and help convert a broad research idea into a feasible, evidence-grounded proposal.',
    budgetScale,
  };
}

function getTopVenueNames(papers: Paper[]): string[] {
  const counts = new Map<string, number>();

  for (const paper of papers) {
    if (!paper.venue) continue;
    counts.set(paper.venue, (counts.get(paper.venue) || 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([venue]) => venue);
}

function venueFitScore(
  venue: string,
  papers: Paper[],
  metadata?: OpenAlexSourceMetadata | null,
  index = 0
): number {
  const venuePapers = papers.filter((paper) => paper.venue === venue);
  const averageSimilarity =
    venuePapers.reduce((sum, paper) => sum + (paper.similarityScore || 0), 0) /
    Math.max(1, venuePapers.length);
  const doiScore = doiCoverage(venuePapers) * 14;
  const recentScore = Math.min(16, countRecentPapers(venuePapers) * 5);
  const metadataScore = metadata ? 8 : 0;
  const oaScore = metadata?.isOpenAccess ? 4 : 0;

  return clamp(
    48 +
      Math.min(18, venuePapers.length * 5) +
      averageSimilarity * 28 +
      doiScore +
      recentScore +
      metadataScore +
      oaScore -
      index * 4
  );
}

function outletTypeFromMetadata(
  metadata?: OpenAlexSourceMetadata | null
): JournalTarget['outletType'] {
  if (metadata?.type === 'journal' || metadata?.type === 'conference') {
    return metadata.type;
  }
  return 'unknown';
}

export function computePublicationFit(input: ResearchFitInput): JournalTargeting | undefined {
  const { ideaText, papers, sourceMetadata = {} } = input;
  const venueNames = getTopVenueNames(papers).slice(0, 6);
  const recommendedRoute = inferArticleRoute(ideaText, papers);

  if (venueNames.length === 0) {
    return {
      targets: [],
      recommendedRoute,
      biggestBlocker: 'Retrieved papers did not include enough venue metadata.',
      nextBestAction: 'Use the top papers as reading targets, then verify possible outlets manually.',
      notes: [
        'No journal or conference targets were generated because retrieved venue metadata was missing.',
        'ResearchLens did not invent outlet names.',
      ],
    };
  }

  const targets = venueNames.map((venue, index): JournalTarget => {
    const venuePapers = papers.filter((paper) => paper.venue === venue).slice(0, 4);
    const metadata = sourceMetadata[venue];
    const fitScore = venueFitScore(venue, papers, metadata, index);
    const evidenceStrength: JournalTarget['evidenceStrength'] =
      venuePapers.length >= 2 && metadata
        ? 'strong'
        : venuePapers.length >= 1
          ? 'moderate'
          : 'weak';
    const outletType = outletTypeFromMetadata(metadata);
    const metadataState = metadata?.homepageUrl
      ? 'verified'
      : metadata
        ? 'partially verified'
        : 'metadata limited';

    return {
      outletName: metadata?.displayName || venue,
      outletType,
      fitScore,
      evidenceStrength,
      scopeMatch:
        venuePapers.length > 0
          ? 'This outlet appears in the retrieved corpus for related work, so it is a plausible target to inspect.'
          : 'This outlet is only weakly supported by retrieved metadata and needs manual verification.',
      articleTypeFit:
        outletType === 'conference'
          ? 'Conference paper route; verify track and paper length in author guidelines.'
          : recommendedRoute,
      openAccessStatus: metadata?.isOpenAccess === true ? 'open' : 'unknown',
      similarAcceptedPapers: venuePapers.map((paper) => ({
        title: paper.title,
        year: paper.year,
        doi: paper.doi,
        url: paper.url,
        venue: paper.venue,
      })),
      citationStyle: 'Not verified',
      submissionChecklist: ['Not verified - check author guidelines'],
      verificationUrl: metadata?.homepageUrl || null,
      metadataNote:
        metadataState === 'verified'
          ? 'Outlet identity and homepage were verified from open metadata; submission requirements were not verified.'
          : metadataState === 'partially verified'
            ? 'Outlet identity was partially verified from open metadata; submission requirements were not verified.'
            : 'Outlet name comes from retrieved paper metadata; submission requirements were not verified.',
    };
  });

  const strongestTarget = targets[0];

  return {
    targets,
    recommendedRoute,
    biggestBlocker:
      strongestTarget.fitScore < 65
        ? 'Venue evidence is weak; read more field-specific papers before choosing a target.'
        : 'Submission rules, APCs, deadlines, and formatting still require manual outlet verification.',
    nextBestAction:
      strongestTarget.fitScore >= 70
        ? `Inspect author guidelines for ${strongestTarget.outletName}.`
        : 'Collect more papers from the target field before selecting an outlet.',
    notes: [
      'Targets are ranked from retrieved paper venues and limited OpenAlex/DOAJ metadata.',
      'ResearchLens does not verify acceptance rates, impact factors, APCs, deadlines, or citation style.',
    ],
  };
}

export function mergeFundingFit(
  deterministic: FundingFit,
  llmFit?: FundingFit
): FundingFit {
  if (!llmFit) return deterministic;

  return {
    ...deterministic,
    grantReadyFraming:
      llmFit.grantReadyFraming || deterministic.grantReadyFraming,
    outreachDrafts:
      llmFit.outreachDrafts && llmFit.outreachDrafts.length > 0
        ? llmFit.outreachDrafts
        : deterministic.outreachDrafts,
    miniGrantAbstract:
      llmFit.miniGrantAbstract || deterministic.miniGrantAbstract,
    specificAims:
      llmFit.specificAims && llmFit.specificAims.length === 3
        ? llmFit.specificAims
        : deterministic.specificAims,
    impactStatement:
      llmFit.impactStatement || deterministic.impactStatement,
    collaboratorProfiles:
      llmFit.collaboratorProfiles && llmFit.collaboratorProfiles.length > 0
        ? llmFit.collaboratorProfiles
        : deterministic.collaboratorProfiles,
  };
}

export function mergePublicationFit(
  deterministic: JournalTargeting | undefined,
  llmFit?: JournalTargeting
): JournalTargeting | undefined {
  if (!deterministic) return llmFit;
  if (!llmFit || llmFit.targets.length === 0) return deterministic;

  const byName = new Map(
    llmFit.targets.map((target) => [target.outletName.toLowerCase(), target])
  );

  return {
    ...deterministic,
    targets: deterministic.targets.map((target) => {
      const llmTarget = byName.get(target.outletName.toLowerCase());
      if (!llmTarget) return target;

      return {
        ...target,
        scopeMatch: llmTarget.scopeMatch || target.scopeMatch,
        articleTypeFit: llmTarget.articleTypeFit || target.articleTypeFit,
        citationStyle: llmTarget.citationStyle || target.citationStyle,
        submissionChecklist:
          llmTarget.submissionChecklist.length > 0
            ? llmTarget.submissionChecklist
            : target.submissionChecklist,
      };
    }),
    notes: unique([...(deterministic.notes || []), ...(llmFit.notes || [])]).slice(0, 4),
  };
}
