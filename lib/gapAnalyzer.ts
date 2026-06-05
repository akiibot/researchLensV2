/**
 * @file Four-Dimension Gap Matrix Classifier
 *
 * Classifies a retrieved corpus of papers across four dimensions:
 *   1. Topic   — what the papers study
 *   2. Method  — how they study it (survey, experiment, qualitative, etc.)
 *   3. Population — who they study (students, age groups, demographics)
 *   4. Geography — where the study was conducted
 *
 * Each dimension produces a saturation level:
 *   - crowded (>60% share dominant category)
 *   - moderate (30–60%)
 *   - open (<30%)
 *
 * @module gapAnalyzer
 */

import { Paper, GapDimension } from './types';

/* ────────────────────────── Keyword Dictionaries ────────────────────────── */

/**
 * Method indicators: maps method category to detection keywords.
 * Checked against paper abstracts and titles (case-insensitive).
 */
const METHOD_INDICATORS: Record<string, string[]> = {
  'survey/quantitative': [
    'survey', 'questionnaire', 'cross-sectional', 'likert', 'likert scale',
    'regression', 'correlation', 'quantitative', 'statistical analysis',
    'self-report', 'structural equation', 'SEM', 'ANOVA', 'chi-square',
    'descriptive statistics', 'convenience sampling', 'random sampling',
    'scale development', 'factor analysis', 'path analysis',
  ],
  'qualitative': [
    'interview', 'focus group', 'ethnography', 'thematic analysis',
    'grounded theory', 'qualitative', 'phenomenology', 'narrative',
    'case study', 'content analysis', 'discourse analysis',
    'observation', 'participant observation', 'field study',
    'interpretive', 'hermeneutic',
  ],
  'experimental': [
    'RCT', 'randomized controlled trial', 'experiment', 'randomized',
    'control group', 'quasi-experiment', 'pretest-posttest',
    'experimental design', 'treatment group', 'intervention',
    'placebo', 'double-blind', 'single-blind', 'pre-post',
    'between-subjects', 'within-subjects', 'factorial design',
  ],
  'longitudinal': [
    'longitudinal', 'panel data', 'follow-up', 'cohort',
    'prospective', 'time series', 'repeated measures', 'wave',
    'multi-wave', 'diary study', 'experience sampling',
  ],
  'mixed methods': [
    'mixed method', 'mixed-method', 'sequential explanatory',
    'convergent design', 'triangulation', 'embedded design',
    'multiphase', 'concurrent', 'mixed methodology',
  ],
  'meta-analysis/review': [
    'meta-analysis', 'systematic review', 'literature review',
    'scoping review', 'bibliometric', 'meta-regression',
    'narrative review', 'integrative review',
  ],
  'computational': [
    'machine learning', 'deep learning', 'neural network',
    'natural language processing', 'NLP', 'classification',
    'clustering', 'sentiment analysis', 'text mining',
    'data mining', 'algorithm', 'computational',
  ],
};

/**
 * Population indicators: maps population category to detection keywords.
 */
const POPULATION_INDICATORS: Record<string, string[]> = {
  'undergraduate students': [
    'undergraduate', 'undergrad', 'college student', 'university student',
    'bachelor', 'first-year', 'freshman', 'sophomore',
  ],
  'graduate students': [
    'graduate student', 'postgraduate', 'master student', 'masters student',
    'PhD student', 'doctoral student', 'research student',
  ],
  'high school': [
    'high school', 'secondary school', 'adolescent', 'teenager',
    'secondary education', 'grade 9', 'grade 10', 'grade 11', 'grade 12',
  ],
  'K-12 / children': [
    'elementary', 'primary school', 'K-12', 'child', 'children',
    'kindergarten', 'middle school', 'youth', 'young learner',
  ],
  'teachers / faculty': [
    'teacher', 'faculty', 'instructor', 'professor', 'educator',
    'teaching staff', 'academic staff', 'school teacher',
  ],
  'employees / workers': [
    'employee', 'worker', 'staff', 'workforce', 'personnel',
    'professional', 'manager', 'executive', 'workplace',
  ],
  'healthcare': [
    'patient', 'nurse', 'physician', 'clinician', 'healthcare worker',
    'medical student', 'hospital', 'caregiver', 'health professional',
  ],
  'general population': [
    'general population', 'adult', 'community sample', 'population-based',
    'national sample', 'representative sample',
  ],
};

/**
 * Geography indicators: country names and regional terms.
 * Checked against paper abstracts and titles.
 */
const GEOGRAPHY_INDICATORS: Record<string, string[]> = {
  'United States': ['united states', 'USA', 'U.S.', 'american', 'US-based'],
  'United Kingdom': ['united kingdom', 'UK', 'british', 'england', 'scotland', 'wales'],
  'China': ['china', 'chinese', 'beijing', 'shanghai'],
  'India': ['india', 'indian'],
  'Bangladesh': ['bangladesh', 'bangladeshi', 'dhaka', 'chittagong'],
  'Pakistan': ['pakistan', 'pakistani'],
  'Indonesia': ['indonesia', 'indonesian', 'jakarta'],
  'Malaysia': ['malaysia', 'malaysian'],
  'Turkey': ['turkey', 'turkish', 'türkiye'],
  'Iran': ['iran', 'iranian', 'tehran'],
  'Saudi Arabia': ['saudi arabia', 'saudi', 'riyadh'],
  'Egypt': ['egypt', 'egyptian', 'cairo'],
  'Nigeria': ['nigeria', 'nigerian', 'lagos'],
  'South Africa': ['south africa', 'south african'],
  'Kenya': ['kenya', 'kenyan', 'nairobi'],
  'Ghana': ['ghana', 'ghanaian'],
  'Ethiopia': ['ethiopia', 'ethiopian'],
  'Brazil': ['brazil', 'brazilian', 'são paulo'],
  'Mexico': ['mexico', 'mexican'],
  'Colombia': ['colombia', 'colombian'],
  'Argentina': ['argentina', 'argentinian'],
  'Germany': ['germany', 'german'],
  'France': ['france', 'french'],
  'Spain': ['spain', 'spanish'],
  'Italy': ['italy', 'italian'],
  'Netherlands': ['netherlands', 'dutch'],
  'Sweden': ['sweden', 'swedish'],
  'Norway': ['norway', 'norwegian'],
  'Finland': ['finland', 'finnish'],
  'Australia': ['australia', 'australian'],
  'Canada': ['canada', 'canadian'],
  'Japan': ['japan', 'japanese'],
  'South Korea': ['south korea', 'korean', 'seoul'],
  'Taiwan': ['taiwan', 'taiwanese'],
  'Thailand': ['thailand', 'thai', 'bangkok'],
  'Vietnam': ['vietnam', 'vietnamese'],
  'Philippines': ['philippines', 'filipino'],
  'Singapore': ['singapore', 'singaporean'],
  'Jordan': ['jordan', 'jordanian'],
  'Lebanon': ['lebanon', 'lebanese'],
  'UAE': ['UAE', 'united arab emirates', 'dubai', 'abu dhabi'],
  'Qatar': ['qatar', 'qatari'],
  'Sri Lanka': ['sri lanka', 'sri lankan'],
  'Nepal': ['nepal', 'nepalese', 'nepali'],
  // Regional terms
  'South Asia': ['south asia', 'south asian'],
  'Southeast Asia': ['southeast asia', 'ASEAN'],
  'East Asia': ['east asia', 'east asian'],
  'Middle East / MENA': ['middle east', 'MENA', 'arab world', 'gulf region'],
  'Sub-Saharan Africa': ['sub-saharan africa', 'sub-saharan'],
  'Latin America': ['latin america', 'latin american'],
  'European Union': ['european union', 'EU countries', 'europe'],
  'North America': ['north america', 'north american'],
};

/* ────────────────────────── Classification Logic ────────────────────────── */

/**
 * Counts how many papers match keywords for a given dimension.
 * Returns a map of category → count of papers mentioning it.
 *
 * @param papers - Array of papers to classify
 * @param indicators - Keyword dictionary for the dimension
 * @returns Map of category name → paper count
 */
function classifyDimension(
  papers: Paper[],
  indicators: Record<string, string[]>
): Map<string, number> {
  const counts = new Map<string, number>();

  for (const [category, keywords] of Object.entries(indicators)) {
    let count = 0;
    for (const paper of papers) {
      const text = `${paper.title} ${paper.abstract}`.toLowerCase();
      const matches = keywords.some((kw) => text.includes(kw.toLowerCase()));
      if (matches) count++;
    }
    counts.set(category, count);
  }

  return counts;
}

/**
 * Determines saturation level based on the dominant category's share.
 *
 * @param dominantCount - Number of papers in the most common category
 * @param totalPapers - Total number of papers analyzed
 * @returns Saturation level
 */
function getSaturation(
  dominantCount: number,
  totalPapers: number
): 'crowded' | 'moderate' | 'open' {
  if (totalPapers === 0) return 'open';
  const ratio = dominantCount / totalPapers;
  if (ratio > 0.6) return 'crowded';
  if (ratio >= 0.3) return 'moderate';
  return 'open';
}

/**
 * Finds the dominant category and generates an evidence string.
 *
 * @param counts - Map of category → paper count
 * @param totalPapers - Total papers analyzed
 * @param dimensionLabel - Human-readable dimension name
 * @returns Object with dominant category name, count, and evidence string
 */
function findDominant(
  counts: Map<string, number>,
  totalPapers: number,
  dimensionLabel: string
): { name: string; count: number; evidence: string } {
  let maxCategory = 'unspecified';
  let maxCount = 0;

  for (const [category, count] of counts) {
    if (count > maxCount) {
      maxCount = count;
      maxCategory = category;
    }
  }

  // Count papers that didn't match any category
  const classifiedPapers = new Set<number>();
  // (simplified — use maxCount as dominant)

  let evidence: string;
  if (maxCount === 0) {
    evidence = `No papers clearly specify ${dimensionLabel.toLowerCase()} — this is an open gap`;
  } else if (maxCount === totalPapers && totalPapers > 0) {
    evidence = `All ${totalPapers} papers relate to ${maxCategory}`;
  } else {
    evidence = `${maxCount} of ${totalPapers} papers focus on ${maxCategory}`;
  }

  return { name: maxCategory, count: maxCount, evidence };
}

/**
 * Analyzes the topic dimension by comparing paper content to the student's idea.
 * Counts papers whose title/abstract significantly overlap with the idea keywords.
 *
 * @param papers - Array of papers to analyze
 * @param ideaText - The student's research idea
 * @returns GapDimension for topic
 */
function analyzeTopic(papers: Paper[], ideaText: string): GapDimension {
  const ideaKeywords = ideaText
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 3);

  if (ideaKeywords.length === 0) {
    return {
      dimension: 'topic',
      saturation: 'open',
      paperCount: 0,
      evidence: 'Unable to extract topic keywords from the research idea',
    };
  }

  // Count papers with significant keyword overlap
  let topicMatchCount = 0;
  for (const paper of papers) {
    const text = `${paper.title} ${paper.abstract}`.toLowerCase();
    const matchedKeywords = ideaKeywords.filter((kw) => text.includes(kw));
    // Consider a match if >= 40% of idea keywords appear in the paper
    if (matchedKeywords.length / ideaKeywords.length >= 0.4) {
      topicMatchCount++;
    }
  }

  const saturation = getSaturation(topicMatchCount, papers.length);
  const evidence =
    topicMatchCount === 0
      ? `No papers closely match this specific topic — the area appears open`
      : `${topicMatchCount} of ${papers.length} papers closely match this topic`;

  return {
    dimension: 'topic',
    saturation,
    paperCount: topicMatchCount,
    evidence,
  };
}

/**
 * Analyzes the retrieved paper corpus and produces a four-dimension gap matrix.
 *
 * For each dimension, scans paper abstracts and titles for indicator keywords,
 * counts how many papers fall into each sub-category, and determines saturation.
 *
 * @param papers - Array of retrieved papers to analyze
 * @param ideaText - The student's research idea for context
 * @returns Array of exactly 4 GapDimension objects
 */
export function analyzeGaps(
  papers: Paper[],
  ideaText: string
): GapDimension[] {
  const totalPapers = papers.length;

  // 1. Topic dimension — keyword overlap with student idea
  const topicDimension = analyzeTopic(papers, ideaText);

  // 2. Method dimension
  const methodCounts = classifyDimension(papers, METHOD_INDICATORS);
  const methodDominant = findDominant(methodCounts, totalPapers, 'method');
  const methodDimension: GapDimension = {
    dimension: 'method',
    saturation: getSaturation(methodDominant.count, totalPapers),
    paperCount: methodDominant.count,
    evidence: methodDominant.evidence,
  };

  // 3. Population dimension
  const popCounts = classifyDimension(papers, POPULATION_INDICATORS);
  const popDominant = findDominant(popCounts, totalPapers, 'population');
  const popDimension: GapDimension = {
    dimension: 'population',
    saturation: getSaturation(popDominant.count, totalPapers),
    paperCount: popDominant.count,
    evidence: popDominant.evidence,
  };

  // 4. Geography dimension
  const geoCounts = classifyDimension(papers, GEOGRAPHY_INDICATORS);
  const geoDominant = findDominant(geoCounts, totalPapers, 'geography');

  // For geography, also count papers with NO geographic mention
  let unspecifiedGeo = 0;
  for (const paper of papers) {
    const text = `${paper.title} ${paper.abstract}`.toLowerCase();
    let hasGeo = false;
    for (const keywords of Object.values(GEOGRAPHY_INDICATORS)) {
      if (keywords.some((kw) => text.includes(kw.toLowerCase()))) {
        hasGeo = true;
        break;
      }
    }
    if (!hasGeo) unspecifiedGeo++;
  }

  const geographyEvidence =
    geoDominant.count === 0
      ? `No papers specify a geographic context — geography is an open gap`
      : unspecifiedGeo > totalPapers * 0.5
        ? `${geoDominant.evidence}; ${unspecifiedGeo} papers do not specify geography`
        : geoDominant.evidence;

  const geoDimension: GapDimension = {
    dimension: 'geography',
    saturation: getSaturation(geoDominant.count, totalPapers),
    paperCount: geoDominant.count,
    evidence: geographyEvidence,
  };

  return [topicDimension, methodDimension, popDimension, geoDimension];
}
