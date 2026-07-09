import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { computeResearchSanityMatrix } from '../lib/sanityMatrix';
import type { FacultyProfile, GapDimension, Paper } from '../lib/types';

function paper(overrides: Partial<Paper> = {}): Paper {
  return {
    id: overrides.id || 'p1',
    title: overrides.title || 'Test paper',
    abstract: overrides.abstract || 'A test abstract.',
    year: overrides.year || 2024,
    authors: overrides.authors || ['A. Researcher'],
    doi: overrides.doi === undefined ? '10.1000/test' : overrides.doi,
    url: overrides.url || 'https://example.test/paper',
    citationCount: overrides.citationCount || 0,
    source: overrides.source || 'openalex',
    type: overrides.type || 'journal-article',
    venue: overrides.venue || 'Test Journal',
    similarityScore: overrides.similarityScore,
  };
}

function faculty(overrides: Partial<FacultyProfile> = {}): FacultyProfile {
  return {
    id: overrides.id || 'f1',
    openAlexAuthorId: overrides.openAlexAuthorId || 'A123',
    name: overrides.name || 'Dr Test',
    institution: overrides.institution || 'Test University',
    country: overrides.country || 'US',
    orcid: overrides.orcid || null,
    worksCount: overrides.worksCount || 20,
    citedByCount: overrides.citedByCount || 100,
    hIndex: overrides.hIndex || 10,
    topics: overrides.topics || ['machine learning'],
    profileUrl: overrides.profileUrl || null,
    worksApiUrl: overrides.worksApiUrl || null,
    relevanceScore: overrides.relevanceScore,
    evidencePapers: overrides.evidencePapers,
  };
}

const mixedGaps: GapDimension[] = [
  { dimension: 'topic', saturation: 'crowded', paperCount: 12, evidence: 'crowded topic' },
  { dimension: 'method', saturation: 'moderate', paperCount: 6, evidence: 'moderate method' },
  { dimension: 'population', saturation: 'open', paperCount: 1, evidence: 'open population' },
  { dimension: 'geography', saturation: 'open', paperCount: 0, evidence: 'open geography' },
];

describe('computeResearchSanityMatrix', () => {
  it('flags high duplicate risk when top-paper similarity is very high', () => {
    const matrix = computeResearchSanityMatrix({
      ideaText: 'impact of technology in education',
      papers: [paper({ similarityScore: 0.92, doi: null })],
      gapMatrix: mixedGaps,
      sourceCounts: { openalex: 1 },
    });

    assert.equal(matrix.claimRisk.level, 'high-risk');
    assert.ok(matrix.claimRisk.score >= 70);
    assert.ok(matrix.overallScore < 60);
  });

  it('keeps evidence weak when paper count and source diversity are low', () => {
    const matrix = computeResearchSanityMatrix({
      ideaText: 'survey of students in Bangladesh using regression for online learning outcomes',
      papers: [paper({ similarityScore: 0.32, doi: null, source: 'openalex' })],
      gapMatrix: mixedGaps,
      sourceCounts: { openalex: 1 },
    });

    assert.equal(matrix.evidenceStrength.level, 'weak');
    assert.ok(matrix.recommendedActions.includes('Broaden or rerun retrieval with more sources enabled.'));
  });

  it('improves evidence with DOI coverage, source diversity, and recent papers', () => {
    const sources: Paper['source'][] = ['openalex', 'semanticscholar', 'datacite', 'pubmed'];
    const papers = Array.from({ length: 32 }, (_, index) =>
      paper({
        id: `p${index}`,
        year: 2024,
        doi: `10.1000/test.${index}`,
        source: sources[index % sources.length],
        similarityScore: 0.28,
      })
    );

    const matrix = computeResearchSanityMatrix({
      ideaText: 'mixed method survey of university students in Bangladesh using regression for online learning outcomes',
      papers,
      gapMatrix: mixedGaps,
      sourceCounts: { openalex: 8, semanticscholar: 8, datacite: 8, pubmed: 8 },
    });

    assert.equal(matrix.evidenceStrength.level, 'strong');
    assert.ok(matrix.evidenceStrength.score >= 75);
  });

  it('improves supervisor fit from multiple strong faculty matches', () => {
    const matrix = computeResearchSanityMatrix({
      ideaText: 'machine learning prototype for patient risk prediction in Bangladesh hospitals',
      papers: [paper({ similarityScore: 0.3 })],
      gapMatrix: mixedGaps,
      sourceCounts: { openalex: 1, pubmed: 1 },
      facultyMatches: [
        faculty({ id: 'f1', relevanceScore: 35, evidencePapers: ['p1'] }),
        faculty({ id: 'f2', relevanceScore: 30, evidencePapers: ['p1'] }),
        faculty({ id: 'f3', relevanceScore: 24, evidencePapers: ['p1'] }),
      ],
    });

    assert.equal(matrix.supervisorFit.level, 'strong');
    assert.ok(matrix.supervisorFit.score >= 75);
  });
});
