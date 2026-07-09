import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  applyFacetRanking,
  buildFacetedQueries,
  scorePaperFacetFit,
  shouldSkipBiomedicalSources,
} from '../lib/facetedRetrieval';
import { rankPapersWithEvidenceScope } from '../lib/evidenceScope';
import type { Paper, ResearchIdea } from '../lib/types';

const otpIdea: ResearchIdea = {
  text: 'Temporal Risk-Aware Detection and Prevention of Bangla/Banglish OTP-Stealing Social Engineering in Mobile Financial Services Using Event-Window Modeling, Hybrid NLP, and Adaptive Warnings',
  field: 'Computer Science',
  level: 'undergraduate',
  language: 'en',
};

function paper(overrides: Partial<Paper>): Paper {
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

describe('faceted retrieval planner', () => {
  it('creates anchored queries for the OTP/Bangla/MFS idea', () => {
    const diagnostics = buildFacetedQueries(otpIdea, [
      'temporal risk aware detection',
      'temporal warnings outcomes',
    ]);
    const joinedQueries = diagnostics.generatedQueries.join(' ').toLowerCase();

    assert.match(joinedQueries, /otp|smishing|phishing|social engineering/);
    assert.match(joinedQueries, /mobile financial services|mobile money/);
    assert.match(joinedQueries, /bangla|banglish|bengali/);
    assert.match(joinedQueries, /bangladesh|dhaka|bkash|nagad|rocket/);
    assert.equal(
      diagnostics.generatedQueries.some((query) =>
        query.toLowerCase().includes('temporal risk aware detection')
      ),
      false
    );
  });

  it('skips broad biomedical sources for non-biomedical CS/security ideas', () => {
    assert.equal(shouldSkipBiomedicalSources(otpIdea), true);
  });

  it('does not rewrite unrelated medical ideas into security fraud queries', () => {
    const diagnostics = buildFacetedQueries(
      {
        text: 'Machine learning prediction of diabetes complications in hospital patients using electronic health records',
        field: 'Medicine',
        level: 'undergraduate',
        language: 'en',
      },
      ['machine learning diabetes complications', 'hospital patients electronic health records']
    );
    const joinedQueries = diagnostics.generatedQueries.join(' ').toLowerCase();

    assert.equal(diagnostics.skippedSources.includes('pubmed'), false);
    assert.doesNotMatch(joinedQueries, /otp|phishing|smishing|mobile financial services/);
    assert.match(joinedQueries, /diabetes|hospital|health/);
  });

  it('does not apply weak facet labels to method-only CS topics', () => {
    const diagnostics = buildFacetedQueries(
      {
        text: 'Transformer-based code summarization for Python programming assignments in undergraduate computer science education',
        field: 'Computer Science',
        level: 'undergraduate',
        language: 'en',
      },
      ['transformer code summarization python']
    );
    const ranked = applyFacetRanking(
      [
        paper({
          id: 'code',
          title: 'Neural code summarization with transformer models',
          abstract: 'Transformer models generate summaries for Python source code.',
          similarityScore: 0.2,
        }),
      ],
      diagnostics
    );

    assert.equal(ranked[0].retrievalFit, undefined);
    assert.equal(ranked[0].similarityScore, 0.2);
  });

  it('scores Bangla smishing evidence above generic temporal detection', () => {
    const diagnostics = buildFacetedQueries(otpIdea);
    const banglaSmishing = paper({
      id: 'core',
      title: 'Hybrid machine learning model for detecting Bangla smishing text',
      abstract:
        'This paper studies Bangla and Bengali SMS phishing detection using NLP and text classification.',
    });
    const temporalGeneric = paper({
      id: 'generic',
      title: 'Evidential temporal-aware graph-based social event detection',
      abstract: 'A temporal event detection model for social event streams.',
    });

    const strong = scorePaperFacetFit(banglaSmishing, diagnostics);
    const weak = scorePaperFacetFit(temporalGeneric, diagnostics);

    assert.equal(strong.fit, 'strong');
    assert.equal(weak.fit, 'weak');
    assert.ok(strong.score > weak.score);
  });

  it('treats Bangladesh as both a ranking facet and evidence-scope geography', () => {
    const diagnostics = buildFacetedQueries(otpIdea);
    const bangladeshPaper = paper({
      id: 'bd',
      title: 'Bangladesh mobile financial services OTP fraud and social engineering',
      abstract:
        'A study of bKash and Nagad users facing OTP scams, phishing, and social engineering attacks.',
      similarityScore: 0.1,
    });
    const fit = scorePaperFacetFit(bangladeshPaper, diagnostics);
    const { diagnostics: scopeDiagnostics } = rankPapersWithEvidenceScope(
      [bangladeshPaper],
      otpIdea.text,
      'balanced'
    );

    assert.ok(fit.matchedFacets.includes('geography'));
    assert.ok(scopeDiagnostics.detectedGeographyTerms.includes('Bangladesh'));
    assert.equal(scopeDiagnostics.localEvidenceCount, 1);
    assert.match(scopeDiagnostics.summary, /Bangladesh/i);
  });

  it('does not treat Bangladesh as a Bangla language-context hit by substring', () => {
    const diagnostics = buildFacetedQueries(otpIdea);
    const genericBangladeshMfs = paper({
      id: 'bd-growth',
      title:
        'Machine Learning Approaches for Predicting Mobile Financial Services Growth in Bangladesh',
      abstract:
        'This paper predicts growth in the digital financial ecosystem and does not study local-language messages, OTP theft, or smishing.',
    });
    const fit = scorePaperFacetFit(genericBangladeshMfs, diagnostics);

    assert.ok(fit.matchedFacets.includes('geography'));
    assert.equal(fit.matchedFacets.includes('languageContext'), false);
  });

  it('ranks domain/language fraud papers above generic medical risk papers', () => {
    const diagnostics = buildFacetedQueries(otpIdea);
    const ranked = applyFacetRanking(
      [
        paper({
          id: 'medical',
          title: 'Global burden of cardiovascular risk factors',
          abstract: 'Risk detection and prevention using global temporal data.',
          similarityScore: 0.2,
        }),
        paper({
          id: 'mfs',
          title: 'Mobile money social engineering attacks and OTP fraud prevention',
          abstract:
            'This study examines mobile money fraud, OTP scams, social engineering, and user warning interventions.',
          similarityScore: 0.05,
        }),
      ],
      diagnostics
    );

    assert.equal(ranked[0].id, 'mfs');
    assert.equal(ranked[0].retrievalFit, 'strong');
    assert.equal(ranked[1].retrievalFit, 'weak');
  });

  it('prioritizes local-context fraud evidence over generic fintech security evidence', () => {
    const diagnostics = buildFacetedQueries(otpIdea);
    const ranked = applyFacetRanking(
      [
        paper({
          id: 'generic-fintech',
          title: 'Cybersecurity challenges in the fintech ecosystem',
          abstract:
            'This paper discusses fraud prevention, mobile payment security, and adaptive user warnings across fintech systems.',
          similarityScore: 0.22,
        }),
        paper({
          id: 'bangladesh-fraud',
          title:
            'Cyber Fraud in Bangladesh Digital Financial Ecosystem across Mobile Financial Services and End Users',
          abstract:
            'This paper examines OTP scams, social engineering, and fraud responsibility across Bangladesh MFS providers.',
          similarityScore: 0.16,
        }),
      ],
      diagnostics
    );

    assert.equal(ranked[0].id, 'bangladesh-fraud');
    assert.ok(ranked[0].matchedFacets?.includes('geography'));
  });
});
