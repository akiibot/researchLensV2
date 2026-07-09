import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildThesisMindmap } from '../lib/thesisMindmap';
import type {
  EvidenceScopeDiagnostics,
  GapDimension,
  Paper,
  Pivot,
  ResearchSanityMatrix,
} from '../lib/types';

function paper(overrides: Partial<Paper> = {}): Paper {
  return {
    id: overrides.id || 'p1',
    title: overrides.title || 'AI diagnosis of tuberculosis from chest X-rays',
    abstract:
      overrides.abstract ||
      'Artificial intelligence diagnosis of tuberculosis from chest X-ray images.',
    year: overrides.year || 2024,
    authors: overrides.authors || ['A. Researcher'],
    doi: overrides.doi === undefined ? '10.1000/test' : overrides.doi,
    url: overrides.url || 'https://doi.org/10.1000/test',
    citationCount: overrides.citationCount || 4,
    source: overrides.source || 'pubmed',
    type: overrides.type || 'journal-article',
    venue: overrides.venue || 'Test Journal',
    similarityScore: overrides.similarityScore ?? 0.42,
  };
}

const gapMatrix: GapDimension[] = [
  {
    dimension: 'topic',
    saturation: 'crowded',
    paperCount: 18,
    evidence: 'Many papers match the topic.',
  },
  {
    dimension: 'method',
    saturation: 'moderate',
    paperCount: 8,
    evidence: 'Several papers use AI methods.',
  },
  {
    dimension: 'population',
    saturation: 'open',
    paperCount: 2,
    evidence: 'Few papers specify the population.',
  },
  {
    dimension: 'geography',
    saturation: 'open',
    paperCount: 1,
    evidence: 'Few papers mention Bangladesh.',
  },
];

const pivots: Pivot[] = [
  {
    title: 'Local validation pivot',
    description: 'Validate an AI chest X-ray workflow in Bangladeshi clinics.',
    rationale: 'Targets the geography gap.',
    targetGap: 'geography',
  },
];

const sanityMatrix: ResearchSanityMatrix = {
  noveltyPotential: {
    score: 80,
    level: 'strong',
    rationale: 'Open geography and population dimensions.',
  },
  evidenceStrength: {
    score: 76,
    level: 'strong',
    rationale: 'Many DOI-backed records from several sources.',
  },
  feasibility: {
    score: 50,
    level: 'weak',
    rationale: 'Population and clinical setting need sharpening.',
  },
  supervisorFit: {
    score: 0,
    level: 'weak',
    rationale: 'No faculty matches provided.',
  },
  claimRisk: {
    score: 72,
    level: 'high-risk',
    rationale: 'Global AI chest X-ray diagnosis is crowded.',
  },
  overallScore: 62,
  verdict: 'Promising but needs narrowing',
  reasons: ['Global evidence is crowded.'],
  recommendedActions: ['Avoid global novelty claims.'],
};

const evidenceScopeDiagnostics: EvidenceScopeDiagnostics = {
  scope: 'compare_local_global',
  label: 'Compare local vs global',
  detectedGeographyTerms: ['bangladesh'],
  top10LocalMatches: 1,
  top20LocalMatches: 3,
  localEvidenceCount: 3,
  globalEvidenceCount: 90,
  summary: 'Global evidence is strong but local evidence is sparse.',
};

describe('buildThesisMindmap', () => {
  it('builds all expected branches from a normal result', () => {
    const mindmap = buildThesisMindmap({
      ideaText: 'AI diagnosis of tuberculosis using chest X-rays in Bangladesh',
      rankedPapers: [paper()],
      gapMatrix,
      pivots,
      sanityMatrix,
      evidenceScopeDiagnostics,
      sourceCounts: { pubmed: 1, openalex: 1 },
    });

    assert.equal(mindmap.branches.length, 7);
    assert.deepEqual(
      mindmap.branches.map((branch) => branch.kind),
      ['topic', 'method', 'population', 'geography', 'evidence', 'risk', 'pivots']
    );
  });

  it('marks crowded and open statuses from the gap matrix', () => {
    const mindmap = buildThesisMindmap({
      ideaText: 'test idea',
      rankedPapers: [paper()],
      gapMatrix,
      pivots,
      sourceCounts: {},
    });

    const topicNode = mindmap.branches
      .find((branch) => branch.kind === 'topic')
      ?.nodes.find((node) => node.id === 'topic-saturation');
    const populationNode = mindmap.branches
      .find((branch) => branch.kind === 'population')
      ?.nodes.find((node) => node.id === 'population-saturation');

    assert.equal(topicNode?.status, 'crowded');
    assert.equal(populationNode?.status, 'open');
  });

  it('adds geography local-global diagnostics when available', () => {
    const mindmap = buildThesisMindmap({
      ideaText: 'test idea',
      rankedPapers: [paper()],
      gapMatrix,
      pivots,
      evidenceScopeDiagnostics,
      sourceCounts: {},
    });

    const geographyBranch = mindmap.branches.find(
      (branch) => branch.kind === 'geography'
    );

    assert.ok(
      geographyBranch?.nodes.some((node) => node.id === 'geography-scope')
    );
    assert.ok(
      geographyBranch?.nodes.some((node) => node.id === 'geography-global-evidence')
    );
  });

  it('adds risk nodes from sanity matrix recommended actions', () => {
    const mindmap = buildThesisMindmap({
      ideaText: 'test idea',
      rankedPapers: [paper()],
      gapMatrix,
      pivots,
      sanityMatrix,
      sourceCounts: {},
    });

    const riskBranch = mindmap.branches.find((branch) => branch.kind === 'risk');
    assert.ok(riskBranch?.nodes.some((node) => node.id === 'risk-claim'));
    assert.ok(riskBranch?.nodes.some((node) => node.id === 'risk-action-0'));
    assert.ok(mindmap.warnings.length > 0);
  });

  it('adds pivot nodes with correct pivot indexes', () => {
    const mindmap = buildThesisMindmap({
      ideaText: 'test idea',
      rankedPapers: [paper()],
      gapMatrix,
      pivots,
      sourceCounts: {},
    });

    const pivotNode = mindmap.branches
      .find((branch) => branch.kind === 'pivots')
      ?.nodes.find((node) => node.id === 'pivot-0');

    assert.equal(pivotNode?.pivotIndex, 0);
    assert.equal(pivotNode?.action, 'explore_pivot');
  });

  it('handles missing optional fields without crashing', () => {
    const mindmap = buildThesisMindmap({
      ideaText: 'short test idea',
      rankedPapers: [],
      gapMatrix: [],
      pivots: [],
      sourceCounts: {},
    });

    assert.equal(mindmap.center, 'short test idea');
    assert.equal(mindmap.branches.length, 7);
  });
});
