import assert from 'node:assert/strict';
import {
  buildEvidenceLineageGraph,
  classifyLineageRole,
  textSimilarity,
} from '../lib/evidenceLineage';
import { Paper } from '../lib/types';

function paper(overrides: Partial<Paper>): Paper {
  return {
    id: overrides.id || 'p',
    title: overrides.title || 'Origin paper',
    abstract: overrides.abstract || 'Bangla OTP stealing social engineering detection',
    year: overrides.year || 2024,
    authors: [],
    doi: overrides.doi ?? null,
    url: overrides.url ?? null,
    citationCount: overrides.citationCount || 0,
    source: overrides.source || 'openalex',
    type: overrides.type || 'journal-article',
    venue: overrides.venue ?? null,
    ...overrides,
  };
}

const origin = paper({
  title: 'Temporal Risk-Aware Detection of Bangla OTP-Stealing Social Engineering',
  abstract: 'Bangla Banglish OTP stealing mobile financial services detection warnings',
  year: 2025,
});

const older = paper({
  title: 'Social Engineering Attacks in Mobile Financial Services',
  abstract: 'Foundational study of phishing and social engineering in mobile money.',
  year: 2019,
});

const newerClose = paper({
  title: 'Bangla OTP Stealing Detection in Mobile Financial Services',
  abstract: 'Bangla Banglish OTP stealing mobile financial services adaptive warning detection',
  year: 2026,
});

const method = paper({
  title: 'Event Window Modeling Framework for NLP Detection',
  abstract: 'A dataset, method, evaluation framework and model for temporal NLP classification.',
  year: 2022,
});

assert.equal(
  classifyLineageRole(older, 'references', origin, origin.title),
  'foundational'
);

assert.equal(
  classifyLineageRole(newerClose, 'cited_by', origin, origin.title),
  'novelty_threat'
);

assert.equal(
  classifyLineageRole(method, 'related', origin, origin.title),
  'method_source'
);

assert.ok(textSimilarity(origin.title, origin.title) > textSimilarity(origin.title, 'unrelated topic'));

const localPapers = Array.from({ length: 30 }, (_, index) =>
  paper({
    id: `local-${index}`,
    title:
      index % 3 === 0
        ? `Bangla OTP stealing mobile financial services warning study ${index}`
        : `Mobile financial services social engineering detection paper ${index}`,
    abstract:
      'Bangla Banglish OTP stealing mobile financial services detection adaptive warnings and social engineering',
    year: 2020 + (index % 6),
    doi: index === 2 || index === 3 ? '10.1234/duplicate' : `10.1234/local-${index}`,
    citationCount: index * 3,
  })
);

async function main() {
  const graph = await buildEvidenceLineageGraph({
    originPaper: origin,
    thesisIdea: origin.title,
    reportPapers: localPapers,
    maxNodes: 10,
    includeNetworkEdges: true,
    skipExternalLookup: true,
  });

  assert.ok(graph.nodes.length <= 10);
  assert.ok(graph.nodes.filter((node) => node.paper.doi === '10.1234/duplicate').length <= 1);
  assert.ok(graph.edges.some((edge) => edge.kind === 'inferred_similarity'));
  assert.ok((graph.nodeStats?.origin || 0) === 1);
  assert.ok((graph.sourceSummary.local || 0) > 0);

  console.log('evidenceLineage tests passed');
}

void main();
