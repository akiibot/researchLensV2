import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import {
  EvidenceLineageEdge,
  EvidenceLineageGraph,
  EvidenceLineageNode,
  EvidenceLineageNodeRole,
  Paper,
} from './types';
import { normalizeOpenAlexWorkId, reconstructAbstract } from './openalexClient';

const OPENALEX_WORKS = 'https://api.openalex.org/works';
const SEMANTIC_SCHOLAR_PAPER = 'https://api.semanticscholar.org/graph/v1/paper';
const MAX_PER_GROUP = 10;
const DEFAULT_MAX_NODES = 35;

export interface EvidenceLineageInput {
  originPaper: Paper;
  thesisIdea?: string;
  reportPapers?: Paper[];
  depth?: 'fast' | 'expanded';
  maxNodes?: number;
  includeNetworkEdges?: boolean;
  skipExternalLookup?: boolean;
}

type Relation = 'references' | 'cited_by' | 'related' | 'local';
type SourceProvider = 'openalex' | 'semantic_scholar' | 'local';

interface OpenAlexWork {
  id?: string;
  title?: string;
  display_name?: string;
  abstract_inverted_index?: Record<string, number[]>;
  publication_year?: number;
  authorships?: Array<{ author?: { display_name?: string } }>;
  doi?: string;
  cited_by_count?: number;
  type?: string;
  primary_location?: {
    landing_page_url?: string;
    source?: { display_name?: string };
  };
  open_access?: { oa_url?: string };
  referenced_works?: string[];
  related_works?: string[];
  cited_by_api_url?: string;
}

interface SemanticScholarPaper {
  paperId?: string;
  title?: string;
  abstract?: string;
  year?: number;
  authors?: Array<{ name?: string }>;
  citationCount?: number;
  externalIds?: { DOI?: string };
  url?: string;
  venue?: string;
  publicationTypes?: string[];
}

function tokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, ' ')
      .split(/\s+/)
      .filter((token) => token.length > 2)
  );
}

export function textSimilarity(a: string, b: string): number {
  const left = tokens(a);
  const right = tokens(b);
  if (!left.size || !right.size) return 0;
  const overlap = [...left].filter((token) => right.has(token)).length;
  return overlap / Math.sqrt(left.size * right.size);
}

function normalizeDoi(doi: string | null | undefined): string | undefined {
  return doi
    ?.replace(/^https?:\/\/(dx\.)?doi\.org\//i, '')
    .trim()
    .toLowerCase();
}

function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

function nodeKey(paper: Paper): string {
  return (
    normalizeDoi(paper.doi) ||
    paper.openAlexId ||
    paper.externalIds?.openalex ||
    paper.semanticScholarId ||
    paper.externalIds?.semanticScholar ||
    normalizeTitle(paper.title).slice(0, 140)
  );
}

function roleExplanation(role: EvidenceLineageNodeRole, relation: Relation): string {
  if (role === 'foundational') return 'Older cited work that may anchor the field or method.';
  if (role === 'derivative') return 'Newer citing work that may show how the area evolved.';
  if (role === 'novelty_threat') return 'Close topical neighbor that may overlap the proposed contribution.';
  if (role === 'method_source') return 'Likely useful for method, measurement, or study design choices.';
  if (relation === 'related') return 'Citation-network neighbor near the origin paper.';
  return 'Nearby paper from the current ResearchLens result set.';
}

export function classifyLineageRole(
  paper: Paper,
  relation: Relation,
  originPaper: Paper,
  thesisIdea = ''
): EvidenceLineageNodeRole {
  const similarity = textSimilarity(thesisIdea || originPaper.title, `${paper.title} ${paper.abstract}`);
  const methodSignals = /(method|model|framework|dataset|measurement|evaluation|experiment|survey|interview|nlp|classification|detection|regression|benchmark|metric|window)/i;

  if (
    relation !== 'references' &&
    ((relation === 'cited_by' && similarity >= 0.2) || similarity >= 0.28)
  ) {
    return 'novelty_threat';
  }
  if (methodSignals.test(`${paper.title} ${paper.abstract}`)) return 'method_source';
  if (relation === 'references' || (originPaper.year && paper.year && paper.year < originPaper.year)) {
    return 'foundational';
  }
  if (relation === 'cited_by' || (originPaper.year && paper.year && paper.year > originPaper.year)) {
    return 'derivative';
  }
  return 'neighboring';
}

function threatScore(paper: Paper, originPaper: Paper, thesisIdea: string): number {
  const similarity = textSimilarity(thesisIdea || originPaper.title, `${paper.title} ${paper.abstract}`);
  const recency = paper.year ? Math.max(0, Math.min(1, (paper.year - 2018) / 8)) : 0.25;
  const citationSignal = Math.min(1, Math.log10((paper.citationCount || 0) + 1) / 3);
  return Number((similarity * 0.62 + recency * 0.22 + citationSignal * 0.16).toFixed(3));
}

function paperToNode(
  paper: Paper,
  role: EvidenceLineageNodeRole,
  thesisIdea: string,
  originPaper: Paper,
  sourceProvider: SourceProvider,
  explanation?: string
): EvidenceLineageNode {
  return {
    id: nodeKey(paper),
    paper,
    role,
    similarityToIdea: Number(textSimilarity(thesisIdea, `${paper.title} ${paper.abstract}`).toFixed(3)),
    explanation: explanation || roleExplanation(role, 'local'),
    sourceProvider,
    threatScore: threatScore(paper, originPaper, thesisIdea),
  };
}

function openAlexWorkToPaper(work: OpenAlexWork): Paper | null {
  const title = work.title || work.display_name;
  if (!title) return null;
  const abstract = reconstructAbstract(work.abstract_inverted_index) || '';
  let doi: string | null = work.doi || null;
  if (doi) doi = doi.replace(/^https?:\/\/(dx\.)?doi\.org\//i, '').trim();
  const url =
    work.primary_location?.landing_page_url ||
    work.open_access?.oa_url ||
    (doi ? `https://doi.org/${doi}` : work.id || null);

  return {
    id: uuidv4(),
    title: title.trim(),
    abstract,
    year: work.publication_year || 0,
    authors: (work.authorships || [])
      .map((authorship) => authorship.author?.display_name)
      .filter(Boolean) as string[],
    doi,
    url,
    citationCount: work.cited_by_count || 0,
    source: 'openalex',
    type: work.type || 'unknown',
    venue: work.primary_location?.source?.display_name || null,
    openAlexId: normalizeOpenAlexWorkId(work.id),
    externalIds: {
      doi: doi || undefined,
      openalex: work.id,
    },
    referencedWorkIds: Array.isArray(work.referenced_works)
      ? (work.referenced_works
          .map((id) => normalizeOpenAlexWorkId(id))
          .filter(Boolean) as string[])
      : undefined,
    relatedWorkIds: Array.isArray(work.related_works)
      ? (work.related_works
          .map((id) => normalizeOpenAlexWorkId(id))
          .filter(Boolean) as string[])
      : undefined,
    citedByApiUrl: work.cited_by_api_url,
  };
}

function semanticScholarToPaper(paper: SemanticScholarPaper): Paper | null {
  if (!paper.title) return null;
  const doi = paper.externalIds?.DOI || null;
  return {
    id: uuidv4(),
    title: paper.title.trim(),
    abstract: paper.abstract || '',
    year: paper.year || 0,
    authors: (paper.authors || []).map((author) => author.name).filter(Boolean) as string[],
    doi,
    url: paper.url || (doi ? `https://doi.org/${doi}` : null),
    citationCount: paper.citationCount || 0,
    source: 'semanticscholar',
    type: paper.publicationTypes?.[0] || 'unknown',
    venue: paper.venue || null,
    semanticScholarId: paper.paperId,
    externalIds: {
      doi: doi || undefined,
      semanticScholar: paper.paperId,
    },
  };
}

async function resolveOpenAlexOrigin(origin: Paper): Promise<OpenAlexWork | null> {
  const email = process.env.OPENALEX_EMAIL || 'team@researchlens.com';
  const openAlexId = origin.openAlexId || origin.externalIds?.openalex;
  if (openAlexId) {
    const id = normalizeOpenAlexWorkId(openAlexId);
    const response = await axios.get(`${OPENALEX_WORKS}/${id}`, {
      params: { mailto: email },
      timeout: 12000,
    });
    return response.data || null;
  }

  if (origin.doi) {
    const response = await axios.get(OPENALEX_WORKS, {
      params: {
        filter: `doi:${normalizeDoi(origin.doi)}`,
        'per-page': 1,
        mailto: email,
      },
      timeout: 12000,
    });
    return response.data?.results?.[0] || null;
  }

  const response = await axios.get(OPENALEX_WORKS, {
    params: {
      search: origin.title,
      'per-page': 1,
      mailto: email,
    },
    timeout: 12000,
  });
  return response.data?.results?.[0] || null;
}

async function fetchOpenAlexWorks(ids: string[], limit = MAX_PER_GROUP): Promise<Paper[]> {
  const papers: Paper[] = [];
  for (const id of ids.slice(0, limit)) {
    try {
      const response = await axios.get(`${OPENALEX_WORKS}/${normalizeOpenAlexWorkId(id)}`, {
        params: { mailto: process.env.OPENALEX_EMAIL || 'team@researchlens.com' },
        timeout: 12000,
      });
      const paper = openAlexWorkToPaper(response.data);
      if (paper) papers.push(paper);
    } catch {
      // Partial graphs are acceptable; callers surface aggregate warnings.
    }
  }
  return papers;
}

async function fetchOpenAlexCitedBy(url: string, limit = MAX_PER_GROUP): Promise<Paper[]> {
  const response = await axios.get(url, {
    params: {
      'per-page': limit,
      sort: 'publication_year:desc',
      mailto: process.env.OPENALEX_EMAIL || 'team@researchlens.com',
    },
    timeout: 12000,
  });
  return (response.data?.results || [])
    .map((work: OpenAlexWork) => openAlexWorkToPaper(work))
    .filter(Boolean) as Paper[];
}

async function fetchSemanticScholarFallback(origin: Paper): Promise<{
  references: Paper[];
  citations: Paper[];
}> {
  const id = origin.semanticScholarId || (origin.doi ? `DOI:${origin.doi}` : undefined);
  if (!id) return { references: [], citations: [] };
  const headers: Record<string, string> = {};
  if (process.env.SEMANTIC_SCHOLAR_API_KEY) {
    headers['x-api-key'] = process.env.SEMANTIC_SCHOLAR_API_KEY;
  }

  const fields = [
    'references.paperId,references.title,references.abstract,references.year,references.authors,references.citationCount,references.externalIds,references.url,references.venue,references.publicationTypes',
    'citations.paperId,citations.title,citations.abstract,citations.year,citations.authors,citations.citationCount,citations.externalIds,citations.url,citations.venue,citations.publicationTypes',
  ].join(',');

  const response = await axios.get(`${SEMANTIC_SCHOLAR_PAPER}/${encodeURIComponent(id)}`, {
    params: { fields },
    headers,
    timeout: 15000,
  });

  return {
    references: (response.data?.references || [])
      .slice(0, MAX_PER_GROUP)
      .map((paper: SemanticScholarPaper) => semanticScholarToPaper(paper))
      .filter(Boolean) as Paper[],
    citations: (response.data?.citations || [])
      .slice(0, MAX_PER_GROUP)
      .map((paper: SemanticScholarPaper) => semanticScholarToPaper(paper))
      .filter(Boolean) as Paper[],
  };
}

function addLineageEdge(
  graph: EvidenceLineageGraph,
  edge: Omit<EvidenceLineageEdge, 'id'>
) {
  if (edge.source === edge.target) return;
  const id = `${edge.source}-${edge.target}-${edge.kind}`;
  if (graph.edges.some((candidate) => candidate.id === id)) return;
  graph.edges.push({ ...edge, id });
}

function addPaperNode(
  graph: EvidenceLineageGraph,
  paper: Paper,
  relation: Relation,
  originNodeId: string,
  thesisIdea: string,
  originPaper: Paper,
  sourceProvider: SourceProvider
) {
  const key = nodeKey(paper);
  if (graph.nodes.some((node) => node.id === key)) return;
  const role = classifyLineageRole(paper, relation, originPaper, thesisIdea);
  graph.nodes.push(
    paperToNode(paper, role, thesisIdea, originPaper, sourceProvider, roleExplanation(role, relation))
  );
  addLineageEdge(graph, {
    source: originNodeId,
    target: key,
    kind: relation === 'local' ? 'inferred_similarity' : relation,
    strength: relation === 'local' ? textSimilarity(thesisIdea, `${paper.title} ${paper.abstract}`) : 0.75,
    explanation:
      relation === 'local'
        ? 'Inferred from current ResearchLens semantic result proximity.'
        : `Citation graph relation: ${relation.replace('_', ' ')}.`,
    yearDelta: paper.year && originPaper.year ? paper.year - originPaper.year : undefined,
    sourceProvider,
  });
}

function buildBaseGraph(
  originPaper: Paper,
  thesisIdea: string,
  depth: 'fast' | 'expanded'
): EvidenceLineageGraph {
  const originNode = paperToNode(originPaper, 'origin', thesisIdea, originPaper, 'local', 'Selected origin paper.');
  return {
    originPaperId: originNode.id,
    originTitle: originPaper.title,
    nodes: [originNode],
    edges: [],
    warnings: [],
    generatedAt: new Date().toISOString(),
    depth,
    origin: {
      id: originNode.id,
      title: originPaper.title,
      year: originPaper.year || undefined,
      doi: originPaper.doi,
    },
    nodeStats: {},
    edgeStats: {},
    sourceSummary: { openAlex: 0, semanticScholar: 0, local: 0 },
  };
}

function addLocalFallback(
  graph: EvidenceLineageGraph,
  originPaper: Paper,
  thesisIdea: string,
  reportPapers: Paper[],
  maxLocal = MAX_PER_GROUP
) {
  const candidates = reportPapers
    .filter((paper) => nodeKey(paper) !== nodeKey(originPaper))
    .sort((a, b) => {
      const left = textSimilarity(thesisIdea, `${a.title} ${a.abstract}`);
      const right = textSimilarity(thesisIdea, `${b.title} ${b.abstract}`);
      return right - left;
    })
    .slice(0, maxLocal);
  candidates.forEach((paper) =>
    addPaperNode(graph, paper, 'local', graph.originPaperId, thesisIdea, originPaper, 'local')
  );
  graph.sourceSummary.local += candidates.length;
}

function rolePriority(role: EvidenceLineageNodeRole): number {
  return {
    origin: 0,
    novelty_threat: 1,
    foundational: 2,
    derivative: 3,
    method_source: 4,
    neighboring: 5,
  }[role];
}

function rankNode(node: EvidenceLineageNode): number {
  if (node.role === 'origin') return Number.POSITIVE_INFINITY;
  const citations = Math.min(1, Math.log10((node.paper.citationCount || 0) + 1) / 3);
  const recency = node.paper.year ? Math.max(0, Math.min(1, (node.paper.year - 2018) / 8)) : 0.2;
  const threat = node.threatScore || 0;
  const methodBoost = node.role === 'method_source' ? 0.14 : 0;
  const roleBoost = node.role === 'novelty_threat' ? 0.28 : node.role === 'foundational' ? 0.12 : 0;
  return node.similarityToIdea * 0.4 + citations * 0.2 + recency * 0.12 + threat * 0.18 + methodBoost + roleBoost;
}

function capGraph(graph: EvidenceLineageGraph, maxNodes: number) {
  const roleCaps: Record<EvidenceLineageNodeRole, number> = {
    origin: 1,
    foundational: 8,
    derivative: 8,
    neighboring: 8,
    novelty_threat: 6,
    method_source: 5,
  };
  const capped: EvidenceLineageNode[] = [];

  (Object.keys(roleCaps) as EvidenceLineageNodeRole[]).forEach((role) => {
    const nodes = graph.nodes
      .filter((node) => node.role === role)
      .sort((a, b) => rankNode(b) - rankNode(a))
      .slice(0, roleCaps[role]);
    capped.push(...nodes);
  });

  const selected = capped
    .sort((a, b) => rolePriority(a.role) - rolePriority(b.role) || rankNode(b) - rankNode(a))
    .slice(0, Math.max(1, maxNodes));
  const selectedIds = new Set(selected.map((node) => node.id));
  graph.nodes = selected;
  graph.edges = graph.edges.filter(
    (edge) => selectedIds.has(edge.source) && selectedIds.has(edge.target)
  );
}

function addNetworkEdges(graph: EvidenceLineageGraph) {
  const nodes = graph.nodes.filter((node) => node.role !== 'origin');
  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      const left = nodes[i];
      const right = nodes[j];
      const leftRefs = new Set(left.paper.referencedWorkIds || []);
      const rightRefs = new Set(right.paper.referencedWorkIds || []);
      const sharedReferences = [...leftRefs].filter((id) => rightRefs.has(id)).length;
      const semanticStrength = textSimilarity(
        `${left.paper.title} ${left.paper.abstract}`,
        `${right.paper.title} ${right.paper.abstract}`
      );

      if (sharedReferences >= 2) {
        addLineageEdge(graph, {
          source: left.id,
          target: right.id,
          kind: 'bibliographic_coupling',
          strength: Math.min(0.95, 0.45 + sharedReferences / 10),
          explanation: `${sharedReferences} shared reference signals connect these papers.`,
          sharedReferences,
          yearDelta: left.paper.year && right.paper.year ? right.paper.year - left.paper.year : undefined,
          sourceProvider: left.sourceProvider || right.sourceProvider || 'openalex',
        });
      } else if (semanticStrength >= 0.32) {
        addLineageEdge(graph, {
          source: left.id,
          target: right.id,
          kind: left.role === right.role ? 'co_citation' : 'inferred_similarity',
          strength: Number(Math.min(0.88, semanticStrength).toFixed(3)),
          explanation:
            left.role === right.role
              ? 'Papers sit in the same lineage group and share strong topical language.'
              : 'ResearchLens inferred a close topical relationship from title and abstract overlap.',
          sourceProvider: 'local',
        });
      }
    }
  }
}

function finalizeStats(graph: EvidenceLineageGraph) {
  graph.nodeStats = graph.nodes.reduce<NonNullable<EvidenceLineageGraph['nodeStats']>>(
    (stats, node) => {
      stats[node.role] = (stats[node.role] || 0) + 1;
      return stats;
    },
    {}
  );
  graph.edgeStats = graph.edges.reduce<NonNullable<EvidenceLineageGraph['edgeStats']>>(
    (stats, edge) => {
      stats[edge.kind] = (stats[edge.kind] || 0) + 1;
      return stats;
    },
    {}
  );
}

export async function buildEvidenceLineageGraph(
  input: EvidenceLineageInput
): Promise<EvidenceLineageGraph> {
  const thesisIdea = input.thesisIdea || input.originPaper.title;
  const depth = input.depth || 'fast';
  const maxNodes = Math.max(8, Math.min(input.maxNodes || DEFAULT_MAX_NODES, depth === 'expanded' ? 45 : 35));
  const graph = buildBaseGraph(input.originPaper, thesisIdea, depth);

  if (!input.skipExternalLookup) {
    try {
      const originWork = await resolveOpenAlexOrigin(input.originPaper);
      const originFromOpenAlex = originWork ? openAlexWorkToPaper(originWork) : null;
      const originPaper = originFromOpenAlex || input.originPaper;
      const groupLimit = depth === 'expanded' ? MAX_PER_GROUP + 4 : MAX_PER_GROUP;
      const references = await fetchOpenAlexWorks(originPaper.referencedWorkIds || [], groupLimit);
      const related = await fetchOpenAlexWorks(originPaper.relatedWorkIds || [], groupLimit);
      const citedBy = originPaper.citedByApiUrl
        ? await fetchOpenAlexCitedBy(originPaper.citedByApiUrl, groupLimit)
        : [];

      references.forEach((paper) =>
        addPaperNode(graph, paper, 'references', graph.originPaperId, thesisIdea, originPaper, 'openalex')
      );
      related.forEach((paper) =>
        addPaperNode(graph, paper, 'related', graph.originPaperId, thesisIdea, originPaper, 'openalex')
      );
      citedBy.forEach((paper) =>
        addPaperNode(graph, paper, 'cited_by', graph.originPaperId, thesisIdea, originPaper, 'openalex')
      );
      graph.sourceSummary.openAlex += references.length + related.length + citedBy.length;
    } catch {
      graph.warnings.push('OpenAlex citation graph lookup was unavailable or incomplete.');
    }
  }

  if (!input.skipExternalLookup && graph.nodes.length < 5) {
    try {
      const fallback = await fetchSemanticScholarFallback(input.originPaper);
      fallback.references.forEach((paper) =>
        addPaperNode(
          graph,
          paper,
          'references',
          graph.originPaperId,
          thesisIdea,
          input.originPaper,
          'semantic_scholar'
        )
      );
      fallback.citations.forEach((paper) =>
        addPaperNode(
          graph,
          paper,
          'cited_by',
          graph.originPaperId,
          thesisIdea,
          input.originPaper,
          'semantic_scholar'
        )
      );
      graph.sourceSummary.semanticScholar += fallback.references.length + fallback.citations.length;
    } catch {
      graph.warnings.push('Semantic Scholar citation fallback was unavailable or incomplete.');
    }
  }

  if (input.reportPapers?.length) {
    addLocalFallback(
      graph,
      input.originPaper,
      thesisIdea,
      input.reportPapers,
      depth === 'expanded' ? MAX_PER_GROUP + 6 : MAX_PER_GROUP
    );
  }

  if (input.includeNetworkEdges !== false) {
    addNetworkEdges(graph);
  }
  capGraph(graph, maxNodes);
  finalizeStats(graph);

  if (graph.nodes.length === 1) {
    graph.warnings.push('No citation-neighbor papers could be resolved for this origin.');
  }

  return graph;
}
