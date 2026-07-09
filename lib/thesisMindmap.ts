import {
  EvidenceScopeDiagnostics,
  GapDimension,
  Paper,
  Pivot,
  ResearchSanityCriterion,
  ResearchSanityMatrix,
  ThesisMindmap,
  ThesisMindmapBranch,
  ThesisMindmapNode,
  ThesisMindmapNodeStatus,
} from './types';

interface BuildThesisMindmapInput {
  ideaText: string;
  rankedPapers: Paper[];
  gapMatrix: GapDimension[];
  pivots: Pivot[];
  sanityMatrix?: ResearchSanityMatrix;
  evidenceScopeDiagnostics?: EvidenceScopeDiagnostics;
  sourceCounts: Record<string, number>;
}

const DIMENSION_LABELS: Record<GapDimension['dimension'], string> = {
  topic: 'Core topic',
  method: 'Method angle',
  population: 'Population focus',
  geography: 'Geography/context',
};

function statusFromGap(saturation: GapDimension['saturation']): ThesisMindmapNodeStatus {
  return saturation;
}

function statusFromCriterion(
  criterion: ResearchSanityCriterion | undefined,
  risk = false
): ThesisMindmapNodeStatus {
  if (!criterion) return 'neutral';
  if (risk) {
    if (criterion.score >= 60) return 'risk';
    if (criterion.score >= 35) return 'moderate';
    return 'strong';
  }
  if (criterion.score >= 75) return 'strong';
  if (criterion.score >= 55) return 'moderate';
  return 'weak';
}

function getGap(
  gapMatrix: GapDimension[],
  dimension: GapDimension['dimension']
): GapDimension {
  return (
    gapMatrix.find((gap) => gap.dimension === dimension) || {
      dimension,
      saturation: 'moderate',
      paperCount: 0,
      evidence: 'No gap evidence was computed for this dimension.',
    }
  );
}

function truncate(value: string, max = 92): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1).trim()}...`;
}

function paperNode(paper: Paper, index: number): ThesisMindmapNode {
  return {
    id: `evidence-paper-${index}`,
    label: truncate(paper.title, 72),
    status: index === 0 ? 'risk' : 'neutral',
    paperCount: paper.doi ? 1 : undefined,
    description: `${paper.year || 'n.d.'} · ${paper.source}${paper.doi ? ' · DOI-backed' : ''}`,
    supportingPaperIds: [paper.id],
    action: 'read_papers',
  };
}

function buildDimensionBranch(
  gapMatrix: GapDimension[],
  dimension: GapDimension['dimension'],
  extraNodes: ThesisMindmapNode[] = []
): ThesisMindmapBranch {
  const gap = getGap(gapMatrix, dimension);
  const label = DIMENSION_LABELS[dimension];

  return {
    id: `${dimension}-branch`,
    label,
    kind: dimension,
    summary: `${label} appears ${gap.saturation} based on retrieved-paper coverage.`,
    nodes: [
      {
        id: `${dimension}-saturation`,
        label: `${label}: ${gap.saturation}`,
        status: statusFromGap(gap.saturation),
        paperCount: gap.paperCount,
        description: gap.evidence,
        action: gap.saturation === 'crowded' ? 'narrow_scope' : undefined,
      },
      ...extraNodes,
    ],
  };
}

function buildGeographyBranch(
  gapMatrix: GapDimension[],
  diagnostics?: EvidenceScopeDiagnostics
): ThesisMindmapBranch {
  const extraNodes: ThesisMindmapNode[] = diagnostics
    ? [
        {
          id: 'geography-scope',
          label: diagnostics.label,
          status:
            diagnostics.localEvidenceCount === 0
              ? 'open'
              : diagnostics.top10LocalMatches >= 5
                ? 'strong'
                : 'moderate',
          paperCount: diagnostics.localEvidenceCount,
          description: diagnostics.summary,
        },
        {
          id: 'geography-global-evidence',
          label: 'Global evidence pool',
          status: diagnostics.globalEvidenceCount >= 30 ? 'strong' : 'moderate',
          paperCount: diagnostics.globalEvidenceCount,
          description: `${diagnostics.globalEvidenceCount} globally related papers were available for comparison.`,
        },
      ]
    : [];

  return buildDimensionBranch(gapMatrix, 'geography', extraNodes);
}

function buildEvidenceBranch(
  rankedPapers: Paper[],
  sourceCounts: Record<string, number>,
  sanityMatrix?: ResearchSanityMatrix
): ThesisMindmapBranch {
  const sourceCount = Object.values(sourceCounts).filter((count) => count > 0).length;
  const doiCount = rankedPapers.filter((paper) => paper.doi).length;
  const topPapers = rankedPapers.slice(0, 3);

  return {
    id: 'evidence-branch',
    label: 'Evidence',
    kind: 'evidence',
    summary: `${rankedPapers.length} papers from ${sourceCount} contributing sources support the evidence view.`,
    nodes: [
      {
        id: 'evidence-strength',
        label: 'Evidence strength',
        status: statusFromCriterion(sanityMatrix?.evidenceStrength),
        paperCount: rankedPapers.length,
        description:
          sanityMatrix?.evidenceStrength.rationale ||
          `${doiCount} DOI-backed records found across ${sourceCount} sources.`,
      },
      {
        id: 'evidence-source-diversity',
        label: 'Source diversity',
        status: sourceCount >= 4 ? 'strong' : sourceCount >= 2 ? 'moderate' : 'weak',
        paperCount: sourceCount,
        description: `${sourceCount} source groups contributed papers to this report.`,
      },
      ...topPapers.map(paperNode),
    ],
  };
}

function buildRiskBranch(
  sanityMatrix?: ResearchSanityMatrix
): ThesisMindmapBranch {
  const riskNodes: ThesisMindmapNode[] = [
    {
      id: 'risk-claim',
      label: 'Claim risk',
      status: statusFromCriterion(sanityMatrix?.claimRisk, true),
      description:
        sanityMatrix?.claimRisk.rationale ||
        'Claim risk could not be scored; review the closest papers manually.',
      action: 'narrow_scope',
    },
    {
      id: 'risk-feasibility',
      label: 'Feasibility',
      status: statusFromCriterion(sanityMatrix?.feasibility),
      description:
        sanityMatrix?.feasibility.rationale ||
        'Method, population, and study context should be made explicit.',
      action: 'narrow_scope',
    },
  ];

  const actionNodes =
    sanityMatrix?.recommendedActions.slice(0, 3).map((action, index) => ({
      id: `risk-action-${index}`,
      label: `Next action ${index + 1}`,
      status: 'neutral' as const,
      description: action,
      action: 'narrow_scope' as const,
    })) || [];

  return {
    id: 'risk-branch',
    label: 'Risk',
    kind: 'risk',
    summary:
      sanityMatrix?.verdict ||
      'Use this branch to check whether the thesis claim needs narrowing.',
    nodes: [...riskNodes, ...actionNodes],
  };
}

function buildPivotBranch(pivots: Pivot[]): ThesisMindmapBranch {
  return {
    id: 'pivots-branch',
    label: 'Pivots',
    kind: 'pivots',
    summary:
      pivots.length > 0
        ? 'These are evidence-backed directions for strengthening the thesis idea.'
        : 'No AI-generated pivots are available for this report.',
    nodes:
      pivots.length > 0
        ? pivots.map((pivot, index) => ({
            id: `pivot-${index}`,
            label: pivot.title,
            status: 'open' as const,
            description: truncate(pivot.description, 140),
            pivotIndex: index,
            action: 'explore_pivot' as const,
          }))
        : [
            {
              id: 'pivot-unavailable',
              label: 'Pivot unavailable',
              status: 'neutral',
              description:
                'Run a full analysis or refine the idea to generate evidence-backed pivots.',
            },
          ],
  };
}

function chooseBestOpportunityNodeId(branches: ThesisMindmapBranch[]): string | undefined {
  const openNode = branches
    .flatMap((branch) => branch.nodes)
    .find((node) => node.status === 'open' && node.action !== 'read_papers');
  return openNode?.id;
}

export function buildThesisMindmap({
  ideaText,
  rankedPapers,
  gapMatrix,
  pivots,
  sanityMatrix,
  evidenceScopeDiagnostics,
  sourceCounts,
}: BuildThesisMindmapInput): ThesisMindmap {
  const topicBranch = buildDimensionBranch(gapMatrix, 'topic', [
    {
      id: 'topic-overlap',
      label: 'Closest overlap',
      status: rankedPapers[0]?.similarityScore && rankedPapers[0].similarityScore > 0.35
        ? 'risk'
        : 'neutral',
      description: rankedPapers[0]
        ? truncate(`Closest paper: ${rankedPapers[0].title}`, 130)
        : 'No top overlap paper was available.',
      supportingPaperIds: rankedPapers[0] ? [rankedPapers[0].id] : undefined,
      action: rankedPapers[0] ? 'read_papers' : undefined,
    },
  ]);

  const branches: ThesisMindmapBranch[] = [
    topicBranch,
    buildDimensionBranch(gapMatrix, 'method'),
    buildDimensionBranch(gapMatrix, 'population'),
    buildGeographyBranch(gapMatrix, evidenceScopeDiagnostics),
    buildEvidenceBranch(rankedPapers, sourceCounts, sanityMatrix),
    buildRiskBranch(sanityMatrix),
    buildPivotBranch(pivots),
  ];

  const warnings = [
    ...(sanityMatrix?.claimRisk.level === 'high-risk'
      ? ['Claim risk is high; avoid strong novelty claims until closest papers are reviewed.']
      : []),
    ...(sanityMatrix?.evidenceStrength.level === 'weak'
      ? ['Evidence strength is weak; broaden retrieval or add source coverage before committing.']
      : []),
    ...(evidenceScopeDiagnostics &&
    evidenceScopeDiagnostics.detectedGeographyTerms.length > 0 &&
    evidenceScopeDiagnostics.localEvidenceCount === 0
      ? ['No local evidence was found for the detected geography terms.']
      : []),
  ];

  return {
    center: truncate(ideaText, 160),
    branches,
    bestOpportunityNodeId: chooseBestOpportunityNodeId(branches),
    warnings,
  };
}
