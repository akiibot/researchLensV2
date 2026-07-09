import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildCopilotUserPrompt,
  buildLimitedCopilotFallback,
  CopilotChatRequest,
} from '../lib/copilot';
import { POST } from '../app/api/copilot/chat/route';
import type { Paper } from '../lib/types';

function paper(overrides: Partial<Paper> = {}): Paper {
  return {
    id: overrides.id || 'p1',
    title: overrides.title || 'Provided Evidence Paper',
    abstract: overrides.abstract || 'This abstract discusses the selected thesis topic.',
    year: overrides.year || 2025,
    authors: overrides.authors || ['A. Researcher'],
    doi: overrides.doi === undefined ? '10.1000/test' : overrides.doi,
    url: overrides.url || 'https://example.test/paper',
    citationCount: overrides.citationCount || 0,
    source: overrides.source || 'openalex',
    type: overrides.type || 'journal-article',
    venue: overrides.venue || 'Test Journal',
    accessType: overrides.accessType || 'abstract_only',
    fullTextStatus: overrides.fullTextStatus || 'unavailable',
  };
}

function request(overrides: Partial<CopilotChatRequest> = {}): CopilotChatRequest {
  return {
    message: overrides.message || 'Does this threaten my novelty?',
    selectedCard: overrides.selectedCard || {
      title: 'Claim risk',
      description: 'Risk reflects duplicate similarity and thin evidence.',
      badge: 'risk',
      selectionType: 'node',
      branchKind: 'risk',
      nodeStatus: 'strong',
    },
    selectedNote: overrides.selectedNote || 'Ask supervisor about overlap.',
    mindmap: overrides.mindmap || {
      center: 'Bangla OTP social engineering in mobile financial services',
      branches: [],
      warnings: [],
    },
    papers: overrides.papers || [
      paper({
        title: 'Cyber Fraud in Bangladesh Digital Financial Ecosystem',
        abstract:
          'The abstract suggests cyber fraud affects Bangladesh mobile financial services.',
      }),
    ],
    selectedPapers: overrides.selectedPapers,
    sanityMatrix: overrides.sanityMatrix,
    evidenceScopeDiagnostics: overrides.evidenceScopeDiagnostics,
    searchDiagnostics: overrides.searchDiagnostics,
    pivots: overrides.pivots,
    supervisorNote: overrides.supervisorNote,
    queries: overrides.queries,
    chatHistory: overrides.chatHistory,
    fullTextResult: overrides.fullTextResult,
  };
}

describe('Research Copilot grounding', () => {
  it('builds prompts that require abstract-only evidence boundaries', () => {
    const prompt = buildCopilotUserPrompt(request());

    assert.match(prompt, /abstract\/metadata only/i);
    assert.doesNotMatch(prompt, /full paper says/i);
  });

  it('keeps fallback answers tied to provided selected card and papers', () => {
    const input = request();
    const answer = buildLimitedCopilotFallback(input);

    assert.match(answer, /Claim risk/);
    assert.match(answer, /Cyber Fraud in Bangladesh Digital Financial Ecosystem/);
    assert.doesNotMatch(answer, /imaginary/i);
  });

  it('mentions extracted text only when full text is attached', () => {
    const answer = buildLimitedCopilotFallback(
      request({
        fullTextResult: {
          paperId: 'p1',
          status: 'available',
          title: 'Cyber Fraud in Bangladesh Digital Financial Ecosystem',
          access: {
            accessType: 'open_pdf',
            fullTextStatus: 'available',
          },
          text: 'Extracted paper text.',
        },
      })
    );

    assert.match(answer, /available extracted text indicates/i);
  });
});

describe('POST /api/copilot/chat', () => {
  it('returns a validation error for missing message', async () => {
    const response = await POST(
      new Request('http://localhost/api/copilot/chat', {
        method: 'POST',
        body: JSON.stringify({}),
      }) as never
    );
    const json = await response.json();

    assert.equal(response.status, 400);
    assert.equal(json.code, 'MISSING_MESSAGE');
  });

  it('returns limited fallback when AI credentials are not configured', async () => {
    const oldApiKey = process.env.GOOGLE_API_KEY;
    const oldCredentials = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    process.env.GOOGLE_API_KEY = 'your_key_here';
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;

    try {
      const response = await POST(
        new Request('http://localhost/api/copilot/chat', {
          method: 'POST',
          body: JSON.stringify(request()),
        }) as never
      );
      const json = await response.json();

      assert.equal(response.status, 200);
      assert.equal(json.mode, 'fallback');
      assert.match(json.answer, /Limited fallback answer/);
      assert.match(json.answer, /Claim risk/);
      assert.doesNotMatch(json.answer, /full paper says/i);
    } finally {
      if (oldApiKey === undefined) {
        delete process.env.GOOGLE_API_KEY;
      } else {
        process.env.GOOGLE_API_KEY = oldApiKey;
      }
      if (oldCredentials === undefined) {
        delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
      } else {
        process.env.GOOGLE_APPLICATION_CREDENTIALS = oldCredentials;
      }
    }
  });
});
