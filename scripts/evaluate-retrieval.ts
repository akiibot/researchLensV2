import { readFileSync } from 'fs';
import path from 'path';

import { rankPapersWithEvidenceScope } from '../lib/evidenceScope';
import { analyzeGaps } from '../lib/gapAnalyzer';
import { computeResearchSanityMatrix } from '../lib/sanityMatrix';
import type { EvidenceScope, Paper, RetrievalSource } from '../lib/types';

interface EvalCase {
  id: string;
  idea: string;
  field: string;
  scope: EvidenceScope;
  exactTerms: string[];
  geographyTerms: string[];
  geographyExpectation: 'none' | 'strict' | 'compare' | 'preferred';
  notes: string;
}

interface CliOptions {
  caseLimit: number;
  depth: 'fast' | 'balanced' | 'full';
  baseUrl: string;
}

const DEFAULT_SOURCES: RetrievalSource[] = [
  'openalex',
  'semanticscholar',
  'datacite',
  'arxiv',
  'europepmc',
  'core',
  'pubmed',
];

function parseOptions(): CliOptions {
  const args = new Map<string, string>();
  for (const arg of process.argv.slice(2)) {
    const [key, value] = arg.split('=');
    if (key.startsWith('--')) {
      args.set(key.slice(2), value || 'true');
    }
  }

  return {
    caseLimit: Number(args.get('limit') || '8'),
    depth: (args.get('depth') || 'balanced') as CliOptions['depth'],
    baseUrl: args.get('baseUrl') || 'http://localhost:3000',
  };
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function containsTerm(text: string, term: string): boolean {
  return normalize(text).includes(normalize(term));
}

function paperText(paper: Paper): string {
  return `${paper.title} ${paper.abstract}`;
}

function countTopMatches(
  papers: Paper[],
  terms: string[],
  topK: number
): Record<string, number> {
  const top = papers.slice(0, topK);
  return Object.fromEntries(
    terms.map((term) => [
      term,
      top.filter((paper) => containsTerm(paperText(paper), term)).length,
    ])
  );
}

function duplicateTitleCount(papers: Paper[], topK: number): number {
  const counts = new Map<string, number>();
  for (const paper of papers.slice(0, topK)) {
    const key = normalize(paper.title);
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  return [...counts.values()].filter((count) => count > 1).length;
}

function percent(numerator: number, denominator: number): string {
  if (!denominator) return '0%';
  return `${Math.round((numerator / denominator) * 100)}%`;
}

function compactCounts(counts: Record<string, number>): string {
  return Object.entries(counts)
    .map(([key, value]) => `${key}:${value}`)
    .join(', ');
}

async function retrieveCase(
  evalCase: EvalCase,
  options: CliOptions
): Promise<{ papers: Paper[]; sourceCounts: Record<string, number> }> {
  const response = await fetch(`${options.baseUrl}/api/retrieve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      idea: {
        text: evalCase.idea,
        field: evalCase.field,
        level: 'masters',
        language: 'en',
        mode: 'student',
        evidenceScope: evalCase.scope,
      },
      retrieval: {
        depth: options.depth,
        enabledSources: DEFAULT_SOURCES,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${await response.text()}`);
  }

  return response.json();
}

async function run() {
  const options = parseOptions();
  const fixturePath = path.join(
    process.cwd(),
    'tests',
    'fixtures',
    'retrieval-eval-cases.json'
  );
  const cases = (JSON.parse(readFileSync(fixturePath, 'utf8')) as EvalCase[])
    .slice(0, options.caseLimit);

  console.log(
    `Running ${cases.length} retrieval eval cases against ${options.baseUrl} with depth=${options.depth}`
  );

  for (const evalCase of cases) {
    const started = Date.now();
    try {
      const { papers, sourceCounts } = await retrieveCase(evalCase, options);
      const { rankedPapers, diagnostics } = rankPapersWithEvidenceScope(
        papers,
        evalCase.idea,
        evalCase.scope
      );
      const gapMatrix = analyzeGaps(rankedPapers, evalCase.idea);
      const sanityMatrix = computeResearchSanityMatrix({
        ideaText: evalCase.idea,
        papers: rankedPapers,
        gapMatrix,
        sourceCounts,
        evidenceScope: evalCase.scope,
      });

      const exactTop10 = countTopMatches(
        rankedPapers,
        evalCase.exactTerms,
        10
      );
      const geoTop10 = countTopMatches(
        rankedPapers,
        evalCase.geographyTerms,
        10
      );
      const doiCount = papers.filter((paper) => paper.doi).length;
      const sourceCount = Object.values(sourceCounts).filter(
        (count) => count > 0
      ).length;
      const duplicateTop20 = duplicateTitleCount(rankedPapers, 20);

      console.log('\n---');
      console.log(`${evalCase.id}: ${evalCase.idea}`);
      console.log(`scope=${evalCase.scope}; expectation=${evalCase.geographyExpectation}`);
      console.log(
        `papers=${papers.length}; sources=${sourceCount}; doiCoverage=${percent(
          doiCount,
          papers.length
        )}; duplicateTitlesTop20=${duplicateTop20}; latency=${(
          (Date.now() - started) /
          1000
        ).toFixed(1)}s`
      );
      console.log(`sourceCounts=${compactCounts(sourceCounts)}`);
      console.log(`exactTop10=${compactCounts(exactTop10) || 'none'}`);
      console.log(`geoTop10=${compactCounts(geoTop10) || 'none'}`);
      console.log(`scopeDiagnostics=${diagnostics.summary}`);
      console.log(
        `sanity=${sanityMatrix.overallScore} ${sanityMatrix.verdict}; risk=${sanityMatrix.claimRisk.score}; evidence=${sanityMatrix.evidenceStrength.score}`
      );
      console.log(
        `gaps=${gapMatrix
          .map((gap) => `${gap.dimension}:${gap.saturation}`)
          .join(', ')}`
      );
      rankedPapers.slice(0, 3).forEach((paper, index) => {
        console.log(
          `top${index + 1}: ${paper.title} (${paper.year || 'n.d.'}, ${paper.source})`
        );
      });
      console.log(`notes=${evalCase.notes}`);
      console.log('humanJudgment=TODO(good|mixed|bad)');
    } catch (error) {
      console.log('\n---');
      console.log(`${evalCase.id}: FAILED`);
      console.log(error instanceof Error ? error.message : String(error));
    }
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
