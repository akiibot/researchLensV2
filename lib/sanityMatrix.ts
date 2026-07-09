import {
  FacultyProfile,
  GapDimension,
  Paper,
  ResearchSanityCriterion,
  ResearchSanityMatrix,
  EvidenceScope,
} from './types';

interface SanityInput {
  ideaText: string;
  papers: Paper[];
  gapMatrix: GapDimension[];
  sourceCounts: Record<string, number>;
  facultyMatches?: FacultyProfile[];
  evidenceScope?: EvidenceScope;
}

const METHOD_TERMS = [
  'survey',
  'interview',
  'experiment',
  'case study',
  'longitudinal',
  'mixed method',
  'machine learning',
  'deep learning',
  'regression',
  'simulation',
  'prototype',
];

const POPULATION_TERMS = [
  'student',
  'patient',
  'teacher',
  'faculty',
  'worker',
  'employee',
  'adult',
  'child',
  'adolescent',
  'university',
  'school',
  'robot',
  'auv',
];

const GEOGRAPHY_TERMS = [
  'bangladesh',
  'india',
  'china',
  'usa',
  'united states',
  'uk',
  'europe',
  'asia',
  'africa',
  'rural',
  'urban',
  'coastal',
  'shallow water',
];

const BROAD_TERMS = [
  'impact',
  'effect',
  'relationship',
  'role',
  'influence',
  'study',
  'analysis',
];

function clamp(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function levelForScore(score: number): ResearchSanityCriterion['level'] {
  if (score >= 75) return 'strong';
  if (score >= 55) return 'moderate';
  return 'weak';
}

function riskLevelForScore(score: number): ResearchSanityCriterion['level'] {
  if (score >= 70) return 'high-risk';
  if (score >= 45) return 'moderate';
  return 'strong';
}

function makeCriterion(
  score: number,
  rationale: string,
  risk = false
): ResearchSanityCriterion {
  const normalized = clamp(score);
  return {
    score: normalized,
    level: risk ? riskLevelForScore(normalized) : levelForScore(normalized),
    rationale,
  };
}

function includesAny(text: string, terms: string[]): boolean {
  const normalized = text.toLowerCase();
  return terms.some((term) => normalized.includes(term));
}

function getRecentPaperCount(papers: Paper[]): number {
  const cutoff = new Date().getFullYear() - 5;
  return papers.filter((paper) => paper.year && paper.year >= cutoff).length;
}

function getSourceDiversity(sourceCounts: Record<string, number>): number {
  return Object.values(sourceCounts).filter((count) => count > 0).length;
}

function getTopSimilarity(papers: Paper[]): number {
  return Math.max(...papers.map((paper) => paper.similarityScore || 0), 0);
}

function isFullTextReadable(paper: Paper): boolean {
  return (
    paper.fullTextStatus === 'available' ||
    paper.accessType === 'open_pdf' ||
    paper.accessType === 'core_download' ||
    paper.accessType === 'user_uploaded' ||
    Boolean(paper.pdfUrl)
  );
}

function getOpenModerateGapCount(gapMatrix: GapDimension[]): number {
  return gapMatrix.filter((gap) => gap.saturation !== 'crowded').length;
}

function getContextSignals(ideaText: string) {
  return {
    hasMethod: includesAny(ideaText, METHOD_TERMS),
    hasPopulation: includesAny(ideaText, POPULATION_TERMS),
    hasGeography: includesAny(ideaText, GEOGRAPHY_TERMS),
    isLongEnough: ideaText.trim().split(/\s+/).length >= 10,
    broadTermCount: BROAD_TERMS.filter((term) =>
      ideaText.toLowerCase().includes(term)
    ).length,
  };
}

function getVerdict(score: number): ResearchSanityMatrix['verdict'] {
  if (score >= 80) return 'Thesis-ready direction';
  if (score >= 60) return 'Promising but needs narrowing';
  if (score >= 40) return 'Risky, needs redesign';
  return 'Weak evidence, rerun or broaden search';
}

export function computeResearchSanityMatrix({
  ideaText,
  papers,
  gapMatrix,
  sourceCounts,
  facultyMatches = [],
  evidenceScope = 'balanced',
}: SanityInput): ResearchSanityMatrix {
  const topSimilarity = getTopSimilarity(papers);
  const openModerateGaps = getOpenModerateGapCount(gapMatrix);
  const sourceDiversity = getSourceDiversity(sourceCounts);
  const doiCount = papers.filter((paper) => paper.doi).length;
  const recentCount = getRecentPaperCount(papers);
  const readableCount = papers.filter(isFullTextReadable).length;
  const fullTextRatio = papers.length ? readableCount / papers.length : 0;
  const signals = getContextSignals(ideaText);
  const geographyRequired = ![
    'global_first',
    'geography_independent',
  ].includes(evidenceScope);
  const facultyEvidenceCount = facultyMatches.filter(
    (faculty) => (faculty.evidencePapers?.length || 0) > 0
  ).length;
  const maxFacultyScore = Math.max(
    ...facultyMatches.map((faculty) => faculty.relevanceScore || 0),
    0
  );

  const noveltyScore = clamp(
    40 +
      openModerateGaps * 10 +
      (topSimilarity < 0.35 ? 15 : topSimilarity < 0.6 ? 8 : -18)
  );
  const evidenceScore = clamp(
    Math.min(papers.length, 60) * 0.7 +
      sourceDiversity * 8 +
      (papers.length ? (doiCount / papers.length) * 20 : 0) +
      (papers.length ? (recentCount / papers.length) * 15 : 0) +
      fullTextRatio * 10
  );
  const feasibilityScore = clamp(
    35 +
      (signals.isLongEnough ? 15 : 0) +
      (signals.hasMethod ? 18 : 0) +
      (signals.hasPopulation ? 14 : 0) +
      (geographyRequired && signals.hasGeography ? 10 : 0) -
      signals.broadTermCount * 5
  );
  const supervisorScore = clamp(
    facultyMatches.length * 12 + facultyEvidenceCount * 10 + Math.min(maxFacultyScore, 40)
  );
  const claimRiskScore = clamp(
    (topSimilarity > 0.75 ? 35 : topSimilarity > 0.55 ? 20 : 8) +
      (papers.length < 15 ? 25 : papers.length < 30 ? 12 : 0) +
      (sourceDiversity < 2 ? 18 : sourceDiversity < 3 ? 8 : 0) +
      (!signals.hasMethod ? 10 : 0) +
      (!signals.hasPopulation ? 8 : 0) +
      (geographyRequired && !signals.hasGeography ? 6 : 0)
  );

  const noveltyPotential = makeCriterion(
    noveltyScore,
    `${openModerateGaps} of ${gapMatrix.length} gap dimensions are not crowded; top-paper similarity is ${(topSimilarity * 100).toFixed(0)}%.`
  );
  const evidenceStrength = makeCriterion(
    evidenceScore,
    `${papers.length} papers, ${sourceDiversity} contributing sources, ${doiCount} DOI-backed records, ${recentCount} recent papers, and ${readableCount} readable full-text records.`
  );
  const feasibility = makeCriterion(
    feasibilityScore,
    `Method ${signals.hasMethod ? 'detected' : 'not explicit'}, population ${signals.hasPopulation ? 'detected' : 'not explicit'}, context ${geographyRequired ? (signals.hasGeography ? 'detected' : 'not explicit') : 'not required for selected scope'}.`
  );
  const supervisorFit = makeCriterion(
    supervisorScore,
    `${facultyMatches.length} faculty matches found; ${facultyEvidenceCount} have direct evidence-paper signals.`
  );
  const claimRisk = makeCriterion(
    claimRiskScore,
    `Risk reflects duplicate similarity, evidence volume, source diversity, and missing method/population/context signals.`,
    true
  );

  const overallScore = clamp(
    noveltyPotential.score * 0.25 +
      evidenceStrength.score * 0.25 +
      feasibility.score * 0.2 +
      supervisorFit.score * 0.15 +
      (100 - claimRisk.score) * 0.15
  );

  const reasons = [
    noveltyPotential.rationale,
    evidenceStrength.rationale,
    feasibility.rationale,
    supervisorFit.rationale,
    claimRisk.rationale,
  ].slice(0, 5);

  const recommendedActions: string[] = [];
  if (claimRisk.score >= 60) {
    recommendedActions.push('Read the closest papers before making a novelty claim.');
  }
  if (evidenceStrength.score < 60) {
    recommendedActions.push('Broaden or rerun retrieval with more sources enabled.');
  }
  if (readableCount < Math.min(5, papers.length)) {
    recommendedActions.push('Upload or open the closest papers to verify claims beyond abstracts.');
  }
  if (feasibility.score < 65) {
    recommendedActions.push('Make the method, population, and study context more explicit.');
  }
  if (supervisorFit.score < 55) {
    recommendedActions.push('Explore a pivot or search faculty matches before committing.');
  }
  if (recommendedActions.length === 0) {
    recommendedActions.push('Proceed to supervisor review with the top related papers.');
  }

  return {
    noveltyPotential,
    evidenceStrength,
    feasibility,
    supervisorFit,
    claimRisk,
    overallScore,
    verdict: getVerdict(overallScore),
    reasons,
    recommendedActions: recommendedActions.slice(0, 4),
    fullTextCoverage: {
      readableCount,
      totalKeyPapers: papers.length,
      label: `${readableCount} of ${papers.length} key papers readable`,
    },
  };
}
