import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { resolvePaperAccess } from '../lib/paperAccess';
import type { Paper } from '../lib/types';

function paper(overrides: Partial<Paper> = {}): Paper {
  return {
    id: overrides.id || 'p1',
    title: overrides.title || 'Test paper',
    abstract: overrides.abstract || 'A test abstract with enough content to count as metadata.',
    year: overrides.year || 2024,
    authors: overrides.authors || ['A. Researcher'],
    doi: overrides.doi === undefined ? '10.1000/test' : overrides.doi,
    url: overrides.url === undefined ? 'https://doi.org/10.1000/test' : overrides.url,
    citationCount: overrides.citationCount || 0,
    source: overrides.source || 'openalex',
    type: overrides.type || 'journal-article',
    venue: overrides.venue || 'Test Journal',
    ...overrides,
  };
}

describe('resolvePaperAccess', () => {
  it('prefers an existing direct PDF URL', () => {
    const access = resolvePaperAccess(
      paper({
        pdfUrl: 'https://example.test/paper.pdf',
        landingUrl: 'https://example.test/paper',
      })
    );

    assert.equal(access.accessType, 'open_pdf');
    assert.equal(access.fullTextStatus, 'available');
    assert.equal(access.pdfUrl, 'https://example.test/paper.pdf');
  });

  it('marks CORE records with identifiers as official CORE-download candidates', () => {
    const access = resolvePaperAccess(
      paper({
        source: 'core',
        id: 'core:12345',
        coreId: '12345',
        url: 'https://core.ac.uk/works/12345',
      })
    );

    assert.equal(access.accessType, 'core_download');
    assert.equal(access.fullTextSource, 'core');
    assert.equal(access.fullTextStatus, 'available');
  });

  it('derives arXiv PDF URLs from arXiv landing pages', () => {
    const access = resolvePaperAccess(
      paper({
        source: 'arxiv',
        doi: null,
        url: 'https://arxiv.org/abs/2401.12345',
      })
    );

    assert.equal(access.accessType, 'open_pdf');
    assert.equal(access.pdfUrl, 'https://arxiv.org/pdf/2401.12345.pdf');
    assert.equal(access.fullTextSource, 'arxiv');
  });

  it('falls back to open landing pages when only DOI or URL access exists', () => {
    const access = resolvePaperAccess(
      paper({
        doi: '10.1000/landing',
        url: 'https://doi.org/10.1000/landing',
      })
    );

    assert.equal(access.accessType, 'open_landing');
    assert.equal(access.fullTextStatus, 'unavailable');
  });

  it('uses abstract-only when no URL exists but metadata is available', () => {
    const access = resolvePaperAccess(
      paper({
        doi: null,
        url: null,
      })
    );

    assert.equal(access.accessType, 'abstract_only');
    assert.equal(access.fullTextStatus, 'unavailable');
  });
});
