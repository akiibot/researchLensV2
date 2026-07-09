import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { computeFundingFit, computePublicationFit } from '../lib/researchFit';
import type { FacultyProfile, GapDimension, Paper } from '../lib/types';
import type { OpenAlexSourceMetadata } from '../lib/openalexClient';

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
    venue: overrides.venue === undefined ? 'Test Journal' : overrides.venue,
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

const gaps: GapDimension[] = [
  { dimension: 'topic', saturation: 'moderate', paperCount: 8, evidence: 'moderate topic' },
  { dimension: 'method', saturation: 'open', paperCount: 1, evidence: 'open method' },
  { dimension: 'population', saturation: 'open', paperCount: 1, evidence: 'open population' },
  { dimension: 'geography', saturation: 'open', paperCount: 0, evidence: 'open geography' },
];

describe('research fit builders', () => {
  it('scores vague funding ideas lower than method/context/impact-explicit ideas', () => {
    const weak = computeFundingFit({
      ideaText: 'AI and students',
      papers: [paper({ doi: null, source: 'openalex', similarityScore: 0.2 })],
      gapMatrix: gaps,
    });

    const strongPapers = Array.from({ length: 30 }, (_, index) =>
      paper({
        id: `p${index}`,
        year: 2024,
        source: index % 2 === 0 ? 'openalex' : 'semanticscholar',
        similarityScore: 0.42,
      })
    );
    const strong = computeFundingFit({
      ideaText:
        'NLP prototype for detection and prevention of mobile financial fraud warnings among university students in Bangladesh',
      papers: strongPapers,
      gapMatrix: gaps,
      facultyMatches: [faculty({ id: 'f1' }), faculty({ id: 'f2' })],
    });

    assert.ok(strong.score > weak.score);
    assert.ok(weak.weaknesses.some((item) => item.toLowerCase().includes('method')));
    assert.ok(strong.bestAngles.length > 0);
  });

  it('ranks publication targets from retrieved venue evidence and metadata', () => {
    const papers = [
      paper({ id: 'a', venue: 'Strong Journal', similarityScore: 0.8, year: 2025 }),
      paper({ id: 'b', venue: 'Strong Journal', similarityScore: 0.7, year: 2024 }),
      paper({ id: 'c', venue: 'Weak Journal', similarityScore: 0.2, year: 2015, doi: null }),
    ];
    const sourceMetadata: Record<string, OpenAlexSourceMetadata> = {
      'Strong Journal': {
        displayName: 'Strong Journal',
        type: 'journal',
        isOpenAccess: true,
        issn: '1234-5678',
        homepageUrl: 'https://example.test/strong',
        publisher: 'Example Publisher',
        worksCount: 1000,
        citedByCount: 5000,
      },
      'Weak Journal': {
        displayName: 'Weak Journal',
        type: 'journal',
        isOpenAccess: null,
        issn: null,
        homepageUrl: null,
        publisher: null,
        worksCount: 0,
        citedByCount: 0,
      },
    };

    const fit = computePublicationFit({
      ideaText: 'survey study of students in Bangladesh',
      papers,
      gapMatrix: gaps,
      sourceMetadata,
    });

    assert.equal(fit?.targets[0].outletName, 'Strong Journal');
    assert.equal(fit?.targets[0].openAccessStatus, 'open');
    assert.ok((fit?.targets[0].fitScore || 0) > (fit?.targets[1].fitScore || 0));
  });

  it('does not invent publication outlets when venue metadata is absent', () => {
    const fit = computePublicationFit({
      ideaText: 'student thesis topic',
      papers: [paper({ venue: null })],
      gapMatrix: gaps,
      sourceMetadata: {},
    });

    assert.equal(fit?.targets.length, 0);
    assert.ok(fit?.notes.some((note) => note.includes('did not invent')));
  });

  it('handles missing OpenAlex or DOAJ metadata without crashing', () => {
    const fit = computePublicationFit({
      ideaText: 'machine learning system evaluation',
      papers: [paper({ venue: 'Metadata Limited Journal', similarityScore: 0.5 })],
      gapMatrix: gaps,
      sourceMetadata: {},
    });

    assert.equal(fit?.targets[0].outletName, 'Metadata Limited Journal');
    assert.equal(fit?.targets[0].verificationUrl, null);
    assert.ok(fit?.targets[0].metadataNote.includes('retrieved paper metadata'));
  });
});
