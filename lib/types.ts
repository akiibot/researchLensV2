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
  source: 'openalex' | 'semanticscholar' | 'crossref' | 'datacite';
  type: string;
  venue: string | null;
  similarityScore?: number;
}

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
  topRelatedPapers: Paper[];
  gapMatrix: GapDimension[];
  pivots: Pivot[];
  supervisorNote: string;
  totalPapersRetrieved: number;
  sourceCounts: Record<string, number>;
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
}

/**
 * Shape of the request body for the /api/analyze endpoint.
 */
export interface AnalyzeRequest {
  idea: ResearchIdea;
  papers: Paper[];
  gapMatrix: GapDimension[];
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
