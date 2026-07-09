/**
 * @file Core TypeScript interfaces for ResearchLens.
 * All shared types used across the application are defined here.
 * No runtime code — types only.
 */

/**
 * Represents the student's research idea input.
 * @property text - The research idea in plain language (English or Bangla)
 * @property field - Academic discipline (e.g., "Education", "Computer Science")
 * @property level - Academic level of the student
 * @property language - Detected or selected input language
 */
export interface ResearchIdea {
  text: string;
  field: string;
  level: 'undergraduate' | 'masters' | 'phd';
  language: 'en' | 'bn';
  mode?: AppMode;
  evidenceScope?: EvidenceScope;
}

export type AppMode = 'student' | 'faculty';

export type EvidenceScope =
  | 'balanced'
  | 'strict_local'
  | 'global_first'
  | 'geography_independent'
  | 'compare_local_global';

export interface EvidenceScopeDiagnostics {
  scope: EvidenceScope;
  label: string;
  detectedGeographyTerms: string[];
  top10LocalMatches: number;
  top20LocalMatches: number;
  localEvidenceCount: number;
  globalEvidenceCount: number;
  summary: string;
}

export type PaperAccessType =
  | 'open_pdf'
  | 'open_landing'
  | 'core_download'
  | 'user_uploaded'
  | 'abstract_only'
  | 'paywalled'
  | 'unknown';

export type FullTextStatus = 'available' | 'processing' | 'failed' | 'unavailable';

export type FullTextSource =
  | 'core'
  | 'unpaywall'
  | 'arxiv'
  | 'europepmc'
  | 'user_upload';

export interface PaperAccessInfo {
  accessType: PaperAccessType;
  pdfUrl?: string;
  landingUrl?: string;
  fullTextStatus: FullTextStatus;
  fullTextSource?: FullTextSource;
  fullTextVerifiedAt?: string;
}

/**
 * Represents a single academic paper retrieved from an external API.
 * Every paper shown in the UI must originate from a real API response —
 * the LLM never invents papers.
 *
 * @property id - Internal unique identifier (UUID)
 * @property title - Paper title as returned by the source API
 * @property abstract - Full abstract text (reconstructed from inverted index for OpenAlex)
 * @property year - Publication year
 * @property authors - List of author display names
 * @property doi - Digital Object Identifier, nullable if source doesn't provide one
 * @property url - Landing page or open-access URL
 * @property citationCount - Number of citations as reported by source
 * @property source - Which API this paper was retrieved from
 * @property type - Document type (e.g., "journal-article", "dissertation")
 * @property venue - Journal or conference name, nullable
 * @property similarityScore - Cosine similarity to the student's idea (0–1), set after embedding
 */
export interface Paper {
  id: string;
  title: string;
  abstract: string;
  year: number;
  authors: string[];
  doi: string | null;
  url: string | null;
  citationCount: number;
  source: PaperSource;
  type: string;
  venue: string | null;
  similarityScore?: number;
  accessType?: PaperAccessType;
  pdfUrl?: string;
  landingUrl?: string;
  fullTextStatus?: FullTextStatus;
  fullTextSource?: FullTextSource;
  fullTextVerifiedAt?: string;
  coreId?: string;
  openAlexId?: string;
  semanticScholarId?: string;
  externalIds?: {
    doi?: string;
    openalex?: string;
    semanticScholar?: string;
    orcid?: string;
  };
  referencedWorkIds?: string[];
  relatedWorkIds?: string[];
  citedByApiUrl?: string;
  retrievalFit?: 'strong' | 'partial' | 'weak';
  matchedFacets?: string[];
  missingFacets?: string[];
}

export type EvidenceLineageNodeRole =
  | 'origin'
  | 'foundational'
  | 'neighboring'
  | 'derivative'
  | 'novelty_threat'
  | 'method_source';

export type EvidenceLineageEdgeKind =
  | 'references'
  | 'cited_by'
  | 'related'
  | 'bibliographic_coupling'
  | 'co_citation'
  | 'inferred_similarity';

export interface EvidenceLineageNode {
  id: string;
  paper: Paper;
  role: EvidenceLineageNodeRole;
  similarityToIdea: number;
  explanation: string;
  sourceProvider?: 'openalex' | 'semantic_scholar' | 'local';
  isExpanded?: boolean;
  threatScore?: number;
}

export interface EvidenceLineageEdge {
  id: string;
  source: string;
  target: string;
  kind: EvidenceLineageEdgeKind;
  strength: number;
  explanation: string;
  sharedReferences?: number;
  sharedCitations?: number;
  yearDelta?: number;
  sourceProvider?: 'openalex' | 'semantic_scholar' | 'local';
}

export interface EvidenceLineageGraph {
  originPaperId: string;
  originTitle: string;
  nodes: EvidenceLineageNode[];
  edges: EvidenceLineageEdge[];
  warnings: string[];
  generatedAt?: string;
  depth?: 'fast' | 'expanded';
  origin?: {
    id: string;
    title: string;
    year?: number;
    doi?: string | null;
  };
  nodeStats?: Partial<Record<EvidenceLineageNodeRole, number>>;
  edgeStats?: Partial<Record<EvidenceLineageEdgeKind, number>>;
  sourceSummary: {
    openAlex: number;
    semanticScholar: number;
    local: number;
  };
}

export interface SearchFacetDiagnostics {
  problem: string[];
  domain: string[];
  languageContext: string[];
  method: string[];
  intervention: string[];
  geography: string[];
  generatedQueries: string[];
  skippedSources: RetrievalSource[];
  driftWarning?: string;
}

export type PaperSource =
  | 'openalex'
  | 'semanticscholar'
  | 'crossref'
  | 'datacite'
  | 'arxiv'
  | 'europepmc'
  | 'core'
  | 'pubmed';

export type RetrievalSource =
  | 'openalex'
  | 'semanticscholar'
  | 'datacite'
  | 'arxiv'
  | 'europepmc'
  | 'core'
  | 'pubmed';

export type RetrievalDepth = 'fast' | 'balanced' | 'full' | 'custom';

/**
 * One dimension of the four-dimension gap matrix.
 * Each dimension measures how saturated the existing literature is
 * in that area relative to the student's idea.
 *
 * @property dimension - Which of the four gap dimensions
 * @property saturation - Crowded (>60%), moderate (30–60%), or open (<30%)
 * @property paperCount - Number of papers that clearly fall into this dimension's dominant category
 * @property evidence - Human-readable evidence string, e.g. "38 of 47 papers use survey methodology"
 */
export interface GapDimension {
  dimension: 'topic' | 'method' | 'population' | 'geography';
  saturation: 'crowded' | 'moderate' | 'open';
  paperCount: number;
  evidence: string;
}

/**
 * A single research pivot suggestion — a concrete, evidence-backed
 * alternative research direction that targets an identified gap.
 *
 * @property title - Short descriptive title for the pivot
 * @property description - Specific, concrete reformulated research direction
 * @property rationale - Why this fills a gap, citing specific retrieved papers
 * @property targetGap - Which gap dimension this pivot targets
 */
export interface Pivot {
  title: string;
  description: string;
  rationale: string;
  targetGap: 'topic' | 'method' | 'population' | 'geography';
}

export interface PivotExplorationContext {
  pivotTitle: string;
  targetGap: Pivot['targetGap'];
  previousIdeaText: string;
}

export type SanityLevel = 'strong' | 'moderate' | 'weak' | 'high-risk';

export interface ResearchSanityCriterion {
  score: number;
  level: SanityLevel;
  rationale: string;
}

export interface ResearchSanityMatrix {
  noveltyPotential: ResearchSanityCriterion;
  evidenceStrength: ResearchSanityCriterion;
  feasibility: ResearchSanityCriterion;
  supervisorFit: ResearchSanityCriterion;
  claimRisk: ResearchSanityCriterion;
  overallScore: number;
  verdict:
    | 'Thesis-ready direction'
    | 'Promising but needs narrowing'
    | 'Risky, needs redesign'
    | 'Weak evidence, rerun or broaden search';
  reasons: string[];
  recommendedActions: string[];
  fullTextCoverage?: {
    readableCount: number;
    totalKeyPapers: number;
    label: string;
  };
}

export interface PaperFullTextSections {
  abstract?: string;
  introduction?: string;
  methods?: string;
  results?: string;
  discussion?: string;
  limitations?: string;
  futureWork?: string;
  references?: string;
}

export interface PaperFullTextResult {
  paperId: string;
  status: 'available' | 'failed' | 'unavailable';
  access: PaperAccessInfo;
  title?: string;
  text?: string;
  sections?: PaperFullTextSections;
  pageCount?: number;
  message?: string;
}

export type ThesisMindmapBranchKind =
  | 'topic'
  | 'method'
  | 'population'
  | 'geography'
  | 'evidence'
  | 'risk'
  | 'pivots';

export type ThesisMindmapNodeStatus =
  | 'crowded'
  | 'moderate'
  | 'open'
  | 'strong'
  | 'weak'
  | 'risk'
  | 'neutral';

export interface ThesisMindmapNode {
  id: string;
  label: string;
  status: ThesisMindmapNodeStatus;
  paperCount?: number;
  description: string;
  supportingPaperIds?: string[];
  pivotIndex?: number;
  action?: 'explore_pivot' | 'read_papers' | 'narrow_scope';
}

export interface ThesisMindmapBranch {
  id: string;
  label: string;
  kind: ThesisMindmapBranchKind;
  summary: string;
  nodes: ThesisMindmapNode[];
}

export interface ThesisMindmap {
  center: string;
  branches: ThesisMindmapBranch[];
  bestOpportunityNodeId?: string;
  warnings: string[];
}

export interface FacultyProfile {
  id: string;
  openAlexAuthorId: string;
  name: string;
  displayNameAlternatives?: string[];
  institution: string | null;
  country: string | null;
  orcid: string | null;
  worksCount: number;
  citedByCount: number;
  hIndex: number | null;
  topics: string[];
  profileUrl: string | null;
  worksApiUrl: string | null;
  relevanceScore?: number;
  evidencePapers?: string[];
  fitSummary?: string;
  outreachDraft?: string;
  matchReasons?: string[];
  source?: 'openalex' | 'supabase';
}

export interface UseCaseScenario {
  title: string;
  audience: AppMode | 'both';
  description: string;
  suggestedAction: string;
}

export interface FundingFit {
  readiness: 'high' | 'medium' | 'low';
  score: number;
  biggestBlocker?: string;
  nextBestAction?: string;
  bestAngles: string[];
  funderCategories: string[];
  searchLinks?: {
    label: string;
    url: string;
    purpose: string;
  }[];
  internalRoutes?: {
    label: string;
    href: string;
    purpose: string;
  }[];
  connectorSuggestions?: {
    name: string;
    type: 'grant_database' | 'university' | 'foundation' | 'government' | 'research_index';
    purpose: string;
    status: 'available_now' | 'future_integration';
  }[];
  grantReadyFraming: string;
  weaknesses: string[];
  collaboratorProfiles: string[];
  outreachDrafts?: {
    title: string;
    recipientType: 'funding_office' | 'potential_collaborator' | 'supervisor' | 'program_officer';
    body: string;
  }[];
  miniGrantAbstract: string;
  specificAims: string[];
  impactStatement: string;
  budgetScale: 'small_internal' | 'external_seed' | 'major_grant';
}

export interface JournalTargetPaper {
  title: string;
  year: number;
  doi: string | null;
  url: string | null;
  venue: string | null;
}

export interface JournalTarget {
  outletName: string;
  outletType: 'journal' | 'conference' | 'unknown';
  fitScore: number;
  evidenceStrength: 'strong' | 'moderate' | 'weak';
  scopeMatch: string;
  articleTypeFit: string;
  openAccessStatus: 'open' | 'hybrid' | 'closed' | 'unknown';
  similarAcceptedPapers: JournalTargetPaper[];
  citationStyle: string;
  submissionChecklist: string[];
  verificationUrl: string | null;
  metadataNote: string;
}

export interface JournalTargeting {
  targets: JournalTarget[];
  notes: string[];
  recommendedRoute?: string;
  biggestBlocker?: string;
  nextBestAction?: string;
}

/**
 * The complete analysis result returned by the /api/analyze endpoint.
 * Combines pre-computed gap matrix data with LLM-generated insights.
 * All citations in the LLM output reference real papers from the retrieved corpus.
 *
 * @property overlapRisk - Overall risk that this idea duplicates existing work
 * @property evidenceConfidence - Confidence in the analysis based on retrieval coverage
 * @property noveltySignal - Signal strength for novelty potential
 * @property overlapExplanation - LLM-generated explanation citing real papers
 * @property topRelatedPapers - Top 3 papers ranked by cosine similarity
 * @property gapMatrix - Four-dimension gap classification
 * @property pivots - Three evidence-backed research pivots
 * @property supervisorNote - Formal academic paragraph ready to paste into an email
 * @property totalPapersRetrieved - Total number of unique papers after deduplication
 * @property sourceCounts - Breakdown of papers per source API
 */
export interface AnalysisResult {
  overlapRisk: 'high' | 'medium' | 'low';
  evidenceConfidence: 'high' | 'medium' | 'low';
  noveltySignal: 'strong' | 'moderate' | 'weak';
  overlapExplanation: string;
  studentSummary?: string;
  facultySummary?: string;
  recommendedUseCases?: UseCaseScenario[];
  limitations?: string[];
  nextActions?: string[];
  fundingFit?: FundingFit;
  journalTargeting?: JournalTargeting;
  topRelatedPapers: Paper[];
  gapMatrix: GapDimension[];
  pivots: Pivot[];
  supervisorNote: string;
  facultyMatches?: FacultyProfile[];
  sanityMatrix?: ResearchSanityMatrix;
  evidenceScopeDiagnostics?: EvidenceScopeDiagnostics;
  searchDiagnostics?: SearchFacetDiagnostics;
  thesisMindmap?: ThesisMindmap;
  credibilityReasons?: string[];
  modelStatus?: {
    reasoningModel: string;
    summaryModel: string;
    note: string;
  };
  savedReportId?: string;
  totalPapersRetrieved: number;
  sourceCounts: Record<string, number>;
}

export interface SavedReport {
  id: string;
  idea: ResearchIdea;
  result: AnalysisResult;
  queries: string[];
  createdAt: string;
}

export interface FacultyShortlistItem {
  id: string;
  faculty: FacultyProfile;
  reportId: string | null;
  note: string | null;
  createdAt: string;
}

/**
 * Shape of the response from the /api/retrieve endpoint.
 *
 * @property papers - Deduplicated papers from all sources
 * @property sourceCounts - How many results came from each source
 * @property queries - The expanded search queries that were used
 */
export interface RetrievalResponse {
  papers: Paper[];
  sourceCounts: Record<string, number>;
  queries: string[];
  searchDiagnostics?: SearchFacetDiagnostics;
}

/**
 * Shape of the request body for the /api/analyze endpoint.
 */
export interface AnalyzeRequest {
  idea: ResearchIdea;
  papers: Paper[];
  gapMatrix: GapDimension[];
  facultyMatches?: FacultyProfile[];
  sanityMatrix?: ResearchSanityMatrix;
  evidenceScopeDiagnostics?: EvidenceScopeDiagnostics;
}

/**
 * Structured error response from API routes.
 *
 * @property error - Human-readable error message
 * @property code - Machine-readable error code for client handling
 */
export interface ApiError {
  error: string;
  code: string;
}

/**
 * Loading step state for the multi-step progress indicator.
 *
 * @property id - Unique step identifier
 * @property label - User-facing description of the step
 * @property status - Current state of the step
 */
export interface LoadingStep {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'complete' | 'error';
}
