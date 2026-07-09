import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  deduplicatePapers,
  normalizeDoi,
  normalizeTitle,
  titleSimilarity,
} from '../lib/deduplicator';
import type { Paper } from '../lib/types';

function paper(overrides: Partial<Paper> = {}): Paper {
  return {
    id: overrides.id || 'p1',
    title:
      overrides.title ||
      'AI Based Medical Diagnosis for Early Detection of Tuberculosis Using Chest X Ray Images',
    abstract: overrides.abstract || 'Short abstract',
    year: overrides.year || 2026,
    authors: overrides.authors || ['A. Researcher'],
    doi: overrides.doi === undefined ? '10.5281/zenodo.20367993' : overrides.doi,
    url: overrides.url || null,
    citationCount: overrides.citationCount || 0,
    source: overrides.source || 'datacite',
    type: overrides.type || 'text',
    venue: overrides.venue || null,
  };
}

describe('deduplicatePapers', () => {
  it('normalizes DOI URL prefixes', () => {
    assert.equal(
      normalizeDoi('https://doi.org/10.1000/ABC'),
      '10.1000/abc'
    );
  });

  it('normalizes title punctuation and spacing', () => {
    assert.equal(
      normalizeTitle('AI-Based   Medical Diagnosis: Chest X-Ray!'),
      'ai based medical diagnosis chest x ray'
    );
  });

  it('detects highly similar titles', () => {
    assert.ok(
      titleSimilarity(
        'AI Based Medical Diagnosis for Early Detection of Tuberculosis Using Chest X Ray Images',
        'AI-Based Medical Diagnosis for Early Detection of Tuberculosis Using Chest X-Ray Images'
      ) >= 0.92
    );
  });

  it('merges DOI-backed version records with the same normalized title', () => {
    const papers = [
      paper({
        id: 'v1',
        doi: '10.5281/zenodo.20367992',
        abstract: 'Short abstract',
        source: 'datacite',
      }),
      paper({
        id: 'v2',
        doi: '10.5281/zenodo.20367993',
        abstract:
          'A longer abstract with more detail about AI diagnosis, tuberculosis, and chest X ray images.',
        source: 'datacite',
      }),
    ];

    const result = deduplicatePapers(papers);

    assert.equal(result.length, 1);
    assert.equal(result[0].doi, '10.5281/zenodo.20367993');
  });

  it('keeps distinct papers with meaningfully different titles', () => {
    const result = deduplicatePapers([
      paper({
        id: 'tb',
        doi: '10.1000/tb',
        title: 'AI diagnosis of tuberculosis from chest X-rays',
      }),
      paper({
        id: 'covid',
        doi: '10.1000/covid',
        title: 'Clinical outcomes of COVID-19 patients in Bangladesh',
      }),
    ]);

    assert.equal(result.length, 2);
  });
});
