/**
 * @file LLM Gap Analysis API Route
 *
 * POST /api/analyze
 *
 * Accepts a ResearchIdea, retrieved papers, gap matrix, and optional faculty
 * matches. Returns audience-specific research guidance grounded only in the
 * provided papers and faculty metadata.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  AnalyzeRequest,
  AnalysisResult,
  ApiError,
  EvidenceScopeDiagnostics,
  FacultyProfile,
  FundingFit,
  GapDimension,
  JournalTarget,
  JournalTargeting,
  Paper,
  ResearchSanityMatrix,
  UseCaseScenario,
} from '@/lib/types';
import { generateGeminiText, hasGeminiCredentials } from '@/lib/geminiClient';
import {
  OpenAlexSourceMetadata,
  searchOpenAlexSourcesBatch,
} from '@/lib/openalexClient';
import { searchDoajJournals } from '@/lib/doajClient';
import {
  computeFundingFit,
  computePublicationFit,
  mergeFundingFit,
  mergePublicationFit,
} from '@/lib/researchFit';

function buildSystemPrompt(): string {
  return `You are ResearchLens, an AI research coach for thesis students and faculty supervisors.
You ONLY reason about papers and faculty profiles that are explicitly provided.
You NEVER invent paper titles, authors, faculty names, institutions, emails, or citations.
You produce practical guidance for two audiences: students and faculty/supervisors.
Return only a valid JSON object matching the requested schema.`;
}

function buildUserPrompt(
  ideaText: string,
  field: string,
  level: string,
  papers: Paper[],
  gapMatrix: GapDimension[],
  facultyMatches: FacultyProfile[] = [],
  sourceMetadata: Record<string, OpenAlexSourceMetadata | null> = {},
  sanityMatrix?: ResearchSanityMatrix,
  evidenceScopeDiagnostics?: EvidenceScopeDiagnostics
): string {
  const paperList = papers
    .slice(0, 20)
    .map(
      (p, i) =>
        `${i + 1}. "${p.title}" (${p.year || 'n.d.'}) - ${(p.abstract || '').slice(0, 220)}... DOI: ${p.doi || 'N/A'}`
    )
    .join('\n');

  const venueEvidence = buildVenueEvidenceSummary(papers, sourceMetadata);

  const facultyList =
    facultyMatches.length > 0
      ? facultyMatches
          .slice(0, 8)
          .map(
            (f, i) =>
              `${i + 1}. ${f.name} - ${f.institution || 'Institution unknown'}, ${f.country || 'country unknown'}; topics: ${(f.topics || []).slice(0, 6).join(', ') || 'N/A'}; evidence: ${(f.evidencePapers || []).slice(0, 3).join(' | ') || 'N/A'}`
          )
          .join('\n')
      : 'No faculty matches were provided.';

  return `## Student Research Idea
${ideaText}

## Field
${field}

## Academic Level
${level}

## Retrieved Papers
${paperList}

## Journal / Conference Venue Evidence
${venueEvidence}

## Pre-computed Gap Matrix
${JSON.stringify(gapMatrix, null, 2)}

## Deterministic Research Sanity Matrix
${sanityMatrix ? JSON.stringify(sanityMatrix, null, 2) : 'Not provided.'}

## Evidence Scope / Geography Handling
${evidenceScopeDiagnostics ? JSON.stringify(evidenceScopeDiagnostics, null, 2) : 'Balanced scope; no explicit diagnostics provided.'}

## Candidate Faculty / Supervisors
${facultyList}

## Task
Analyze the idea and return exactly this JSON shape:
{
  "overlapRisk": "high" or "medium" or "low",
  "evidenceConfidence": "high" or "medium" or "low",
  "noveltySignal": "strong" or "moderate" or "weak",
  "overlapExplanation": "2-3 sentences citing specific paper titles from the list",
  "studentSummary": "plain-language thesis guidance for the student",
  "facultySummary": "formal evidence-first summary for a supervisor/faculty member",
  "pivots": [
    {
      "title": "Short pivot title",
      "description": "Specific reformulated research direction",
      "rationale": "Why this fills a gap, citing specific papers above",
      "targetGap": "topic" or "method" or "population" or "geography"
    }
  ],
  "supervisorNote": "3-4 sentence formal note ready to email to an advisor",
  "recommendedUseCases": [
    {
      "title": "Short scenario title",
      "audience": "student" or "faculty" or "both",
      "description": "What this report should be used for",
      "suggestedAction": "Specific next action"
    }
  ],
  "fundingFit": {
    "readiness": "high" or "medium" or "low",
    "score": 0-100,
    "bestAngles": ["fundable angle"],
    "funderCategories": ["type of funder or grant program"],
    "searchLinks": [
      {
        "label": "link label",
        "url": "safe public URL for searching or learning more",
        "purpose": "why this link is useful"
      }
    ],
    "internalRoutes": [
      {
        "label": "ResearchLens route label",
        "href": "/faculty or /reports",
        "purpose": "how to use this route"
      }
    ],
    "connectorSuggestions": [
      {
        "name": "connector or source name",
        "type": "grant_database" or "university" or "foundation" or "government" or "research_index",
        "purpose": "what it would add",
        "status": "available_now" or "future_integration"
      }
    ],
    "grantReadyFraming": "fundable reframing of the idea",
    "weaknesses": ["issue to fix before applying"],
    "collaboratorProfiles": ["type of collaborator needed"],
    "outreachDrafts": [
      {
        "title": "draft title",
        "recipientType": "funding_office" or "potential_collaborator" or "supervisor" or "program_officer",
        "body": "concise outreach message"
      }
    ],
    "miniGrantAbstract": "150-220 word internal grant abstract",
    "specificAims": ["specific aim"],
    "impactStatement": "clear practical or scholarly impact claim",
    "budgetScale": "small_internal" or "external_seed" or "major_grant"
  },
  "journalTargeting": {
    "targets": [
      {
        "outletName": "Journal or conference name from the venue evidence",
        "outletType": "journal" or "conference" or "unknown",
        "fitScore": 0-100,
        "evidenceStrength": "strong" or "moderate" or "weak",
        "scopeMatch": "Why this outlet fits the proposed publishable work",
        "articleTypeFit": "Likely article type fit such as empirical article, short report, review, conference paper, or unknown",
        "openAccessStatus": "open" or "hybrid" or "closed" or "unknown",
        "similarAcceptedPapers": [
          {
            "title": "Exact title from Retrieved Papers",
            "year": 2024,
            "doi": "DOI or null",
            "url": "URL or null",
            "venue": "venue name or null"
          }
        ],
        "citationStyle": "Verified citation style, or Not verified",
        "submissionChecklist": ["Verified checklist item, or Not verified - check author guidelines"],
        "verificationUrl": "https URL for the outlet or null",
        "metadataNote": "What is verified vs not verified"
      }
    ],
    "notes": ["Short caveat about metadata limits"]
  },
  "limitations": ["Specific limitation of the evidence or coverage"],
  "nextActions": ["Specific next step"]
}

Rules:
- Return exactly 3 pivots.
- Return exactly 3 recommendedUseCases.
- Return 3-6 journalTargeting.targets.
- journalTargeting must rank outlets by scope fit and available evidence, not prestige.
- Prefer outlets that appear in Journal / Conference Venue Evidence and have similarAcceptedPapers from Retrieved Papers.
- Use evidenceStrength "strong" when similar papers are in the same venue, "moderate" for close field/scope match, and "weak" only for broad discipline fit.
- Do not invent outlets, APCs, impact factors, acceptance rates, deadlines, citation styles, or submission checklist items.
- If citation style or checklist is not explicitly known from the provided evidence, use "Not verified" and include a checklist item saying "Not verified - check author guidelines".
- openAccessStatus must be "open" only when the venue evidence says OpenAlex reports open access; otherwise use "unknown" unless the evidence explicitly supports another value.
- verificationUrl must be a real https URL from the venue evidence or null.
- Return 2-4 limitations and 3-5 nextActions.
- Use the Deterministic Research Sanity Matrix as a guardrail. Do not contradict it or overstate novelty when claimRisk is high or evidenceStrength is weak.
- Respect the Evidence Scope / Geography Handling section. If scope is global_first or geography_independent, do not reject an idea only because local papers are sparse. If scope is strict_local, treat missing local evidence as a major limitation. If scope is compare_local_global, distinguish global saturation from local underexploration.
- fundingFit should focus on realistic grant/internal funding framing, not invented live grant calls.
- Return 3-5 bestAngles, 3-5 funderCategories, 3-5 searchLinks, 3-5 connectorSuggestions, 2-4 weaknesses, 2-4 collaboratorProfiles, 2-3 outreachDrafts, and exactly 3 specificAims.
- searchLinks must be real public routes such as Grants.gov search, CORDIS, NIH RePORTER, UKRI Gateway to Research, World Bank Projects, university grant pages, or foundation program pages. Do not invent URLs.
- internalRoutes should only use existing ResearchLens routes: "/", "/faculty", "/reports".
- outreachDrafts should be concise, professional, and not invent private emails or named program officers.
- All 3 pivots must target different gap dimensions when possible.
- Pivots must name a concrete country, population, method, mechanism, or setting.
- supervisorNote must cite at least 2 real paper titles from the provided list.
- studentSummary should be encouraging, direct, and easy to understand.
- facultySummary should be concise, formal, and evidence-first.
- Do not include markdown fences, preamble, or commentary.`;
}

function parseLLMResponse(text: string): Record<string, unknown> | null {
  try {
    return JSON.parse(text);
  } catch {
    const cleaned = text
      .replace(/^```json?\s*\n?/i, '')
      .replace(/\n?```\s*$/i, '')
      .trim();

    try {
      return JSON.parse(cleaned);
    } catch {
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;

      try {
        return JSON.parse(jsonMatch[0]);
      } catch {
        return null;
      }
    }
  }
}

function createFallbackResult(
  ideaText: string,
  papers: Paper[],
  gapMatrix: GapDimension[],
  facultyMatches: FacultyProfile[] = [],
  sourceMetadata: Record<string, OpenAlexSourceMetadata | null> = {},
  sanityMatrix?: ResearchSanityMatrix,
  evidenceScopeDiagnostics?: EvidenceScopeDiagnostics
): AnalysisResult {
  const crowdedCount = gapMatrix.filter((g) => g.saturation === 'crowded').length;
  const overlapRisk =
    crowdedCount >= 3 ? 'high' : crowdedCount >= 2 ? 'medium' : 'low';

  return {
    overlapRisk,
    evidenceConfidence: papers.length >= 30 ? 'high' : papers.length >= 15 ? 'medium' : 'low',
    noveltySignal: crowdedCount >= 3 ? 'weak' : crowdedCount >= 2 ? 'moderate' : 'strong',
    overlapExplanation:
      'AI reasoning is currently unavailable. The matrix was computed from retrieved paper metadata and keyword coverage.',
    studentSummary:
      'The retrieved literature is available, but AI summarization is unavailable. Start by reading the top related papers and refining the idea around the most open gap dimension.',
    facultySummary:
      'AI-generated synthesis is unavailable. Current evidence is limited to ranked papers and the keyword-based gap matrix.',
    recommendedUseCases: [
      {
        title: 'Proposal refinement',
        audience: 'student',
        description: 'Use the report to narrow the thesis scope.',
        suggestedAction: 'Compare the idea with the top three related papers.',
      },
      {
        title: 'Supervisor discussion',
        audience: 'faculty',
        description: 'Use the matrix as a starting point for feedback.',
        suggestedAction: 'Ask whether the open dimensions are defensible research gaps.',
      },
      {
        title: 'Reading list seed',
        audience: 'both',
        description: 'Use the retrieved papers as initial literature.',
        suggestedAction: 'Follow citations from the most similar papers.',
      },
    ],
    limitations: [
      'AI reasoning is unavailable.',
      'Coverage depends on open scholarly metadata APIs.',
    ],
    nextActions: [
      'Read the top related papers.',
      'Refine the topic around an open gap dimension.',
      'Validate the direction with a supervisor.',
    ],
    fundingFit: computeFundingFit({
      ideaText,
      papers,
      gapMatrix,
      facultyMatches,
      sourceMetadata,
      sanityMatrix,
      evidenceScopeDiagnostics,
    }),
    journalTargeting: computePublicationFit({
      ideaText,
      papers,
      gapMatrix,
      facultyMatches,
      sourceMetadata,
      sanityMatrix,
      evidenceScopeDiagnostics,
    }),
    topRelatedPapers: papers.slice(0, 3),
    gapMatrix,
    pivots: [],
    supervisorNote:
      'AI-generated supervisor note is unavailable. Please review the retrieved papers and gap matrix to prepare a manual advisor note.',
    facultyMatches,
    sanityMatrix,
    evidenceScopeDiagnostics,
    totalPapersRetrieved: papers.length,
    sourceCounts: {},
  };
}

function parseUseCases(value: unknown): UseCaseScenario[] {
  if (!Array.isArray(value)) return [];

  return value.slice(0, 3).map((u: Record<string, unknown>) => ({
    title: String(u.title || 'Use case'),
    audience: (['student', 'faculty', 'both'].includes(String(u.audience))
      ? String(u.audience)
      : 'both') as 'student' | 'faculty' | 'both',
    description: String(u.description || ''),
    suggestedAction: String(u.suggestedAction || ''),
  }));
}

function parseFundingFit(value: unknown): FundingFit | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const raw = value as Record<string, unknown>;
  const readiness = ['high', 'medium', 'low'].includes(String(raw.readiness))
    ? (String(raw.readiness) as 'high' | 'medium' | 'low')
    : 'medium';
  const budgetScale = [
    'small_internal',
    'external_seed',
    'major_grant',
  ].includes(String(raw.budgetScale))
    ? (String(raw.budgetScale) as
        | 'small_internal'
        | 'external_seed'
        | 'major_grant')
    : 'small_internal';

  return {
    readiness,
    score: Math.max(0, Math.min(100, Number(raw.score || 50))),
    bestAngles: Array.isArray(raw.bestAngles)
      ? raw.bestAngles.slice(0, 5).map(String)
      : [],
    funderCategories: Array.isArray(raw.funderCategories)
      ? raw.funderCategories.slice(0, 5).map(String)
      : [],
    searchLinks: Array.isArray(raw.searchLinks)
      ? raw.searchLinks.slice(0, 5).map((link: Record<string, unknown>) => ({
          label: String(link.label || 'Funding link'),
          url: String(link.url || ''),
          purpose: String(link.purpose || ''),
        })).filter((link) => link.url.startsWith('https://'))
      : [],
    internalRoutes: Array.isArray(raw.internalRoutes)
      ? raw.internalRoutes.slice(0, 4).map((route: Record<string, unknown>) => ({
          label: String(route.label || 'ResearchLens route'),
          href: ['/', '/faculty', '/reports'].includes(String(route.href))
            ? String(route.href)
            : '/',
          purpose: String(route.purpose || ''),
        }))
      : [],
    connectorSuggestions: Array.isArray(raw.connectorSuggestions)
      ? raw.connectorSuggestions
          .slice(0, 5)
          .map((connector: Record<string, unknown>) => ({
            name: String(connector.name || 'Connector'),
            type: ([
              'grant_database',
              'university',
              'foundation',
              'government',
              'research_index',
            ].includes(String(connector.type))
              ? String(connector.type)
              : 'grant_database') as
              | 'grant_database'
              | 'university'
              | 'foundation'
              | 'government'
              | 'research_index',
            purpose: String(connector.purpose || ''),
            status: (['available_now', 'future_integration'].includes(
              String(connector.status)
            )
              ? String(connector.status)
              : 'future_integration') as 'available_now' | 'future_integration',
          }))
      : [],
    grantReadyFraming: String(raw.grantReadyFraming || ''),
    weaknesses: Array.isArray(raw.weaknesses)
      ? raw.weaknesses.slice(0, 4).map(String)
      : [],
    collaboratorProfiles: Array.isArray(raw.collaboratorProfiles)
      ? raw.collaboratorProfiles.slice(0, 4).map(String)
      : [],
    outreachDrafts: Array.isArray(raw.outreachDrafts)
      ? raw.outreachDrafts
          .slice(0, 3)
          .map((draft: Record<string, unknown>) => ({
            title: String(draft.title || 'Outreach draft'),
            recipientType: ([
              'funding_office',
              'potential_collaborator',
              'supervisor',
              'program_officer',
            ].includes(String(draft.recipientType))
              ? String(draft.recipientType)
              : 'funding_office') as
              | 'funding_office'
              | 'potential_collaborator'
              | 'supervisor'
              | 'program_officer',
            body: String(draft.body || ''),
          }))
      : [],
    miniGrantAbstract: String(raw.miniGrantAbstract || ''),
    specificAims: Array.isArray(raw.specificAims)
      ? raw.specificAims.slice(0, 3).map(String)
      : [],
    impactStatement: String(raw.impactStatement || ''),
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

function buildVenueEvidenceSummary(
  papers: Paper[],
  sourceMetadata: Record<string, OpenAlexSourceMetadata | null>
): string {
  const venueNames = getTopVenueNames(papers);
  if (venueNames.length === 0) {
    return 'No venues were available in the retrieved paper metadata.';
  }

  return venueNames
    .map((venue) => {
      const venuePapers = papers.filter((paper) => paper.venue === venue).slice(0, 3);
      const metadata = sourceMetadata[venue];
      const openAccess =
        metadata?.isOpenAccess === true
          ? 'OpenAlex reports open access'
          : 'Open access not verified';
      const outletType = metadata?.type || 'unknown';
      const verificationUrl = metadata?.homepageUrl || 'N/A';
      const similarPapers = venuePapers
        .map(
          (paper) =>
            `"${paper.title}" (${paper.year || 'n.d.'}; DOI: ${paper.doi || 'N/A'})`
        )
        .join(' | ');

      return `- ${venue}: type=${outletType}; OA=${openAccess}; publisher=${metadata?.publisher || 'N/A'}; url=${verificationUrl}; similar papers=${similarPapers}`;
    })
    .join('\n');
}

async function searchVenueMetadata(
  venues: string[]
): Promise<Record<string, OpenAlexSourceMetadata | null>> {
  const sourceMetadata = await searchOpenAlexSourcesBatch(venues);

  const missingVenues = venues.filter((venue) => !sourceMetadata[venue]);
  const doajEntries = await Promise.all(
    missingVenues.slice(0, 5).map(async (venue) => {
      const journals = await searchDoajJournals(venue);
      const journal = journals[0];
      if (!journal) return [venue, null] as const;

      return [
        venue,
        {
          displayName: journal.title,
          type: 'journal',
          isOpenAccess: true,
          issn: journal.issns[0] || null,
          homepageUrl: journal.url,
          publisher: journal.publisher,
          worksCount: 0,
          citedByCount: 0,
        } satisfies OpenAlexSourceMetadata,
      ] as const;
    })
  );

  for (const [venue, metadata] of doajEntries) {
    if (metadata) {
      sourceMetadata[venue] = metadata;
    }
  }

  return sourceMetadata;
}

function createJournalTargetingFallback(
  papers: Paper[],
  sourceMetadata: Record<string, OpenAlexSourceMetadata | null> = {}
): JournalTargeting | undefined {
  const venueNames = getTopVenueNames(papers).slice(0, 5);
  if (venueNames.length === 0) return undefined;

  return {
    targets: venueNames.map((venue, index) => {
      const venuePapers = papers.filter((paper) => paper.venue === venue).slice(0, 3);
      const metadata = sourceMetadata[venue];
      const outletType =
        metadata?.type === 'journal' || metadata?.type === 'conference'
          ? metadata.type
          : 'unknown';

      return {
        outletName: metadata?.displayName || venue,
        outletType,
        fitScore: Math.max(45, 88 - index * 8),
        evidenceStrength: 'strong' as const,
        scopeMatch:
          'This outlet appears in the retrieved corpus for similar accepted work. Review the outlet scope before submission.',
        articleTypeFit:
          venuePapers[0]?.type === 'proceedings-article'
            ? 'Conference paper fit should be verified from author guidelines.'
            : 'Empirical article fit should be verified from author guidelines.',
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
          metadata?.homepageUrl || metadata?.isOpenAccess === true
            ? 'Outlet name and limited OpenAlex metadata were verified; submission requirements were not verified.'
            : 'Outlet name comes from retrieved paper metadata; submission requirements were not verified.',
      };
    }),
    notes: [
      'Targets are grounded in retrieved paper venues and limited OpenAlex source metadata.',
      'Citation style, APCs, deadlines, and submission checklist items require manual verification.',
    ],
  };
}

function parseJournalTargeting(
  value: unknown,
  papers: Paper[],
  sourceMetadata: Record<string, OpenAlexSourceMetadata | null>
): JournalTargeting | undefined {
  if (!value || typeof value !== 'object') {
    return createJournalTargetingFallback(papers, sourceMetadata);
  }

  const raw = value as Record<string, unknown>;
  if (!Array.isArray(raw.targets)) {
    return createJournalTargetingFallback(papers, sourceMetadata);
  }

  const knownPaperTitles = new Set(papers.map((paper) => paper.title));
  const targets = raw.targets
    .slice(0, 6)
    .map((target: Record<string, unknown>) => {
      const outletName = String(target.outletName || '').trim();
      if (!outletName) return null;

      const metadata = sourceMetadata[outletName];
      const similarAcceptedPapers = Array.isArray(target.similarAcceptedPapers)
        ? target.similarAcceptedPapers
            .slice(0, 4)
            .map((paper: Record<string, unknown>) => {
              const title = String(paper.title || '');
              const sourcePaper = papers.find((p) => p.title === title);
              if (!sourcePaper && !knownPaperTitles.has(title)) return null;

              return {
                title: sourcePaper?.title || title,
                year: sourcePaper?.year || Number(paper.year || 0),
                doi: sourcePaper?.doi || (paper.doi ? String(paper.doi) : null),
                url: sourcePaper?.url || (paper.url ? String(paper.url) : null),
                venue: sourcePaper?.venue || (paper.venue ? String(paper.venue) : null),
              };
            })
            .filter((paper): paper is NonNullable<typeof paper> => Boolean(paper))
        : [];

      const outletType = ['journal', 'conference', 'unknown'].includes(
        String(target.outletType)
      )
        ? (String(target.outletType) as 'journal' | 'conference' | 'unknown')
        : metadata?.type === 'journal' || metadata?.type === 'conference'
          ? metadata.type
          : 'unknown';

      const evidenceStrength = ['strong', 'moderate', 'weak'].includes(
        String(target.evidenceStrength)
      )
        ? (String(target.evidenceStrength) as 'strong' | 'moderate' | 'weak')
        : similarAcceptedPapers.length > 0
          ? 'strong'
          : 'weak';

      const requestedOa = String(target.openAccessStatus);
      const openAccessStatus: JournalTarget['openAccessStatus'] =
        metadata?.isOpenAccess === true
          ? 'open'
          : ['hybrid', 'closed', 'unknown'].includes(requestedOa)
            ? (requestedOa as JournalTarget['openAccessStatus'])
            : 'unknown';

      const verificationUrl = String(target.verificationUrl || '');

      return {
        outletName,
        outletType,
        fitScore: Math.max(0, Math.min(100, Number(target.fitScore || 50))),
        evidenceStrength,
        scopeMatch: String(target.scopeMatch || ''),
        articleTypeFit: String(target.articleTypeFit || 'Not verified'),
        openAccessStatus,
        similarAcceptedPapers,
        citationStyle: String(target.citationStyle || 'Not verified'),
        submissionChecklist:
          Array.isArray(target.submissionChecklist) &&
          target.submissionChecklist.length > 0
            ? target.submissionChecklist.slice(0, 6).map(String)
            : ['Not verified - check author guidelines'],
        verificationUrl: verificationUrl.startsWith('https://')
          ? verificationUrl
          : metadata?.homepageUrl || null,
        metadataNote: String(
          target.metadataNote ||
            'Limited metadata available; verify all submission requirements manually.'
        ),
      };
    })
    .filter((target): target is NonNullable<typeof target> => Boolean(target));

  if (targets.length === 0) {
    return createJournalTargetingFallback(papers, sourceMetadata);
  }

  return {
    targets,
    notes: Array.isArray(raw.notes)
      ? raw.notes.slice(0, 4).map(String)
      : [
          'Targets are grounded in retrieved paper venues and limited OpenAlex source metadata.',
          'Verify author guidelines before submission.',
        ],
  };
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<AnalysisResult | ApiError>> {
  try {
    const body: AnalyzeRequest = await request.json();
    const {
      idea,
      papers,
      gapMatrix,
      facultyMatches = [],
      sanityMatrix,
      evidenceScopeDiagnostics,
    } = body;

    if (!idea?.text || !papers?.length) {
      return NextResponse.json(
        { error: 'Research idea and papers are required', code: 'MISSING_INPUT' },
        { status: 400 }
      );
    }

    const sourceMetadata = await searchVenueMetadata(getTopVenueNames(papers));
    const deterministicFundingFit = computeFundingFit({
      ideaText: idea.text,
      papers,
      gapMatrix,
      facultyMatches,
      sourceMetadata,
      sanityMatrix,
      evidenceScopeDiagnostics,
    });
    const deterministicPublicationFit = computePublicationFit({
      ideaText: idea.text,
      papers,
      gapMatrix,
      facultyMatches,
      sourceMetadata,
      sanityMatrix,
      evidenceScopeDiagnostics,
    });

    if (!hasGeminiCredentials()) {
      console.warn('[analyze] No Gemini credentials set; returning deterministic fallback analysis result');
      return NextResponse.json(
        createFallbackResult(
          idea.text,
          papers,
          gapMatrix,
          facultyMatches,
          sourceMetadata,
          sanityMatrix,
          evidenceScopeDiagnostics
        )
      );
    }

    try {
      const responseText = await generateGeminiText({
        prompt: buildUserPrompt(
          idea.text,
          idea.field,
          idea.level,
          papers,
          gapMatrix,
          facultyMatches,
          sourceMetadata,
          sanityMatrix,
          evidenceScopeDiagnostics
        ),
        systemInstruction: buildSystemPrompt(),
        purpose: 'reasoning',
      });

      const parsed = responseText ? parseLLMResponse(responseText) : null;
      if (!parsed) {
        const fallback = createFallbackResult(
          idea.text,
          papers,
          gapMatrix,
          facultyMatches,
          sourceMetadata,
          sanityMatrix,
          evidenceScopeDiagnostics
        );
        return NextResponse.json(fallback);
      }

      const pivots = Array.isArray(parsed.pivots)
        ? parsed.pivots.slice(0, 3).map((p: Record<string, unknown>) => ({
            title: String(p.title || 'Untitled Pivot'),
            description: String(p.description || ''),
            rationale: String(p.rationale || ''),
            targetGap: (['topic', 'method', 'population', 'geography'].includes(
              String(p.targetGap)
            )
              ? String(p.targetGap)
              : 'topic') as 'topic' | 'method' | 'population' | 'geography',
          }))
        : [];

      const result: AnalysisResult = {
        overlapRisk: (['high', 'medium', 'low'].includes(String(parsed.overlapRisk))
          ? String(parsed.overlapRisk)
          : 'medium') as 'high' | 'medium' | 'low',
        evidenceConfidence: (['high', 'medium', 'low'].includes(
          String(parsed.evidenceConfidence)
        )
          ? String(parsed.evidenceConfidence)
          : 'medium') as 'high' | 'medium' | 'low',
        noveltySignal: (['strong', 'moderate', 'weak'].includes(
          String(parsed.noveltySignal)
        )
          ? String(parsed.noveltySignal)
          : 'moderate') as 'strong' | 'moderate' | 'weak',
        overlapExplanation: String(
          parsed.overlapExplanation || 'Analysis completed but explanation unavailable.'
        ),
        studentSummary: String(parsed.studentSummary || ''),
        facultySummary: String(parsed.facultySummary || ''),
        recommendedUseCases: parseUseCases(parsed.recommendedUseCases),
        fundingFit: mergeFundingFit(
          deterministicFundingFit,
          parseFundingFit(parsed.fundingFit)
        ),
        journalTargeting: mergePublicationFit(
          deterministicPublicationFit,
          parseJournalTargeting(parsed.journalTargeting, papers, sourceMetadata)
        ),
        limitations: Array.isArray(parsed.limitations)
          ? parsed.limitations.slice(0, 4).map(String)
          : [],
        nextActions: Array.isArray(parsed.nextActions)
          ? parsed.nextActions.slice(0, 5).map(String)
          : [],
        topRelatedPapers: papers.slice(0, 3),
        gapMatrix,
        pivots,
        supervisorNote: String(
          parsed.supervisorNote || 'Supervisor note generation failed.'
        ),
        facultyMatches,
        sanityMatrix,
        evidenceScopeDiagnostics,
        totalPapersRetrieved: papers.length,
        sourceCounts: {},
      };

      return NextResponse.json(result);
    } catch (llmError) {
      console.error('[analyze] Gemini API call failed:', llmError);
      return NextResponse.json(
        createFallbackResult(
          idea.text,
          papers,
          gapMatrix,
          facultyMatches,
          sourceMetadata,
          sanityMatrix,
          evidenceScopeDiagnostics
        )
      );
    }
  } catch (error) {
    console.error('[analyze] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze research gap', code: 'ANALYSIS_ERROR' },
      { status: 500 }
    );
  }
}
