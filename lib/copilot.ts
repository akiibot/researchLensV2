import {
  EvidenceScopeDiagnostics,
  Paper,
  PaperFullTextResult,
  Pivot,
  ResearchSanityMatrix,
  SearchFacetDiagnostics,
  ThesisMindmap,
} from './types';
import { accessLabel } from './paperAccessLabels';

export interface CopilotChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface CopilotSelectedCard {
  title: string;
  description: string;
  badge: string;
  selectionType: 'center' | 'branch' | 'node';
  branchKind?: string;
  nodeStatus?: string;
}

export interface CopilotChatRequest {
  message: string;
  selectedCard: CopilotSelectedCard;
  selectedNote?: string;
  mindmap: ThesisMindmap;
  papers: Paper[];
  selectedPapers?: Paper[];
  sanityMatrix?: ResearchSanityMatrix;
  evidenceScopeDiagnostics?: EvidenceScopeDiagnostics;
  searchDiagnostics?: SearchFacetDiagnostics;
  pivots?: Pivot[];
  supervisorNote?: string;
  queries?: string[];
  chatHistory?: CopilotChatMessage[];
  fullTextResult?: PaperFullTextResult | null;
}

function truncate(value: string | undefined | null, max = 700): string {
  if (!value) return '';
  return value.length > max ? `${value.slice(0, max)}...` : value;
}

function compactPaper(paper: Paper, index: number): string {
  const matchedFacets =
    paper.matchedFacets && paper.matchedFacets.length > 0
      ? paper.matchedFacets.join(', ')
      : 'none recorded';

  return `${index + 1}. "${paper.title}" (${paper.year || 'n.d.'})
Source: ${paper.source}; access: ${accessLabel(paper.accessType)}; full text: ${paper.fullTextStatus || 'unknown'}; DOI: ${paper.doi || 'N/A'}
Retrieval fit: ${paper.retrievalFit || 'not labeled'}; matched facets: ${matchedFacets}
Abstract: ${truncate(paper.abstract, 450)}`;
}

function evidenceBoundary(input: CopilotChatRequest): string {
  if (input.fullTextResult?.status === 'available') {
    return `A full-text extraction is available for "${input.fullTextResult.title || input.fullTextResult.paperId}". Use wording like "available extracted text indicates" for that paper.`;
  }

  const readableCount = input.papers.filter(
    (paper) => paper.fullTextStatus === 'available'
  ).length;

  if (readableCount > 0) {
    return `${readableCount} provided paper record(s) are marked as readable full text, but no extracted text was attached to this chat turn. Do not claim to have read full text unless extracted text is provided.`;
  }

  return 'The provided evidence is abstract/metadata only. Use wording like "the abstract suggests" and say when full text is not available.';
}

export function buildCopilotSystemPrompt(): string {
  return `You are ResearchLens Copilot, a thesis-workspace assistant.
You answer only from the provided ResearchLens context.
Never invent paper titles, authors, datasets, methods, citations, URLs, supervisors, or findings.
Always start from the selected mindmap card.
Distinguish evidence levels:
- If extracted full text is provided, say "available extracted text indicates".
- If only abstracts/metadata are provided, say "the abstract suggests" or "metadata suggests".
- If evidence is missing, say ResearchLens does not have that evidence yet.
For novelty questions, use sanity matrix, closest papers, and retrieval diagnostics.
For method questions, produce variables, population/context, data source, method, and feasibility risks.
For supervisor questions, produce short paste-ready questions.
Keep answers concise, practical, and thesis-focused.`;
}

export function buildCopilotUserPrompt(input: CopilotChatRequest): string {
  const selectedPapers = (input.selectedPapers?.length
    ? input.selectedPapers
    : input.papers
  ).slice(0, 8);
  const history = (input.chatHistory || [])
    .slice(-8)
    .map((message) => `${message.role}: ${message.content}`)
    .join('\n');
  const fullTextSections = input.fullTextResult?.sections
    ? JSON.stringify(input.fullTextResult.sections, null, 2)
    : 'No extracted full-text sections attached.';

  return `## User Question
${input.message}

## Selected Mindmap Card
${JSON.stringify(input.selectedCard, null, 2)}

## Current Note For This Card
${input.selectedNote || 'No note yet.'}

## Thesis / Mindmap Center
${input.mindmap.center}

## Evidence Boundary
${evidenceBoundary(input)}

## Closest / Selected Papers
${selectedPapers.length > 0 ? selectedPapers.map(compactPaper).join('\n\n') : 'No papers were provided.'}

## Sanity Matrix
${input.sanityMatrix ? JSON.stringify(input.sanityMatrix, null, 2) : 'Not provided.'}

## Evidence Scope Diagnostics
${input.evidenceScopeDiagnostics ? JSON.stringify(input.evidenceScopeDiagnostics, null, 2) : 'Not provided.'}

## Search Diagnostics
${input.searchDiagnostics ? JSON.stringify(input.searchDiagnostics, null, 2) : 'Not provided.'}

## Pivots
${input.pivots?.length ? JSON.stringify(input.pivots.slice(0, 5), null, 2) : 'No pivots provided.'}

## Supervisor Note
${input.supervisorNote || 'Not provided.'}

## Generated Queries
${input.queries?.length ? input.queries.slice(0, 10).join('\n') : 'No queries provided.'}

## Extracted Full Text Sections
${truncate(fullTextSections, 2500)}

## Recent Chat History
${history || 'No prior chat in this selected card.'}

## Response Instructions
Answer the user directly. Mention the selected card title. Use only provided paper titles. Do not use markdown tables.`;
}

export function buildLimitedCopilotFallback(input: CopilotChatRequest): string {
  const selectedTitle = input.selectedCard.title || 'selected card';
  const selectedDescription =
    input.selectedCard.description || 'No card description was provided.';
  const closestPapers = (input.selectedPapers?.length
    ? input.selectedPapers
    : input.papers
  )
    .slice(0, 3)
    .map((paper) => `"${paper.title}" (${accessLabel(paper.accessType)})`)
    .join('; ');
  const boundary = evidenceBoundary(input);
  const question = input.message.toLowerCase();

  let guidance =
    `Limited fallback answer for "${selectedTitle}". ${selectedDescription} ${boundary}`;

  if (/method|variable|design|data/i.test(question)) {
    guidance +=
      ' Convert this card into a method by naming the target population/context, measurable outcome, data source, baseline/comparison, and feasibility risk.';
  } else if (/novel|risk|duplicate|claim|threat/i.test(question)) {
    guidance += ` Treat the novelty claim cautiously. ${input.sanityMatrix?.claimRisk?.rationale || 'Check the closest papers before claiming novelty.'}`;
    if (closestPapers) {
      guidance += ` Closest evidence available to inspect: ${closestPapers}.`;
    }
  } else if (/supervisor|question|email/i.test(question)) {
    guidance +=
      ' Supervisor question: "Does this card make my thesis specific and defensible, and which evidence would you expect me to verify before approval?"';
  } else if (/summar|paper|evidence|limitation/i.test(question)) {
    guidance += closestPapers
      ? ` Closest evidence available to inspect: ${closestPapers}.`
      : ' No related papers were provided for this card.';
  } else {
    guidance +=
      ' Ask about evidence, novelty risk, methods, limitations, supervisor questions, or how this card connects to the thesis.';
  }

  return guidance;
}

export function isValidCopilotRequest(value: unknown): value is CopilotChatRequest {
  const candidate = value as Partial<CopilotChatRequest>;
  return Boolean(
    candidate &&
      typeof candidate.message === 'string' &&
      candidate.message.trim() &&
      candidate.selectedCard?.title &&
      candidate.mindmap?.center
  );
}
