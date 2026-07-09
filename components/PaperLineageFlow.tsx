'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Edge,
  Handle,
  MarkerType,
  Node,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  EvidenceLineageEdgeKind,
  EvidenceLineageGraph,
  EvidenceLineageNode,
  EvidenceLineageNodeRole,
} from '@/lib/types';

type LineageViewportCommand = { id: number; type: 'fit' | 'reset' };

interface PaperLineageFlowProps {
  graph: EvidenceLineageGraph | null;
  loading?: boolean;
  error?: string | null;
  selectedNodeId?: string;
  onSelectNode: (node: EvidenceLineageNode) => void;
  onBuildGraph: () => void;
  viewportCommand?: LineageViewportCommand;
}

interface LineageNodeData extends Record<string, unknown> {
  node: EvidenceLineageNode;
  selected?: boolean;
  onSelectNode: (node: EvidenceLineageNode) => void;
}

const ROLE_LABELS: Record<EvidenceLineageNodeRole, string> = {
  origin: 'Origin',
  foundational: 'Prior work',
  derivative: 'Derivative',
  neighboring: 'Neighbor',
  novelty_threat: 'Novelty threat',
  method_source: 'Method source',
};

const ROLE_COLORS: Record<EvidenceLineageNodeRole, string> = {
  origin: '#8b5cf6',
  foundational: '#38bdf8',
  derivative: '#22c55e',
  neighboring: '#14b8a6',
  novelty_threat: '#f97316',
  method_source: '#f59e0b',
};

const EDGE_LABELS: Record<EvidenceLineageEdgeKind, string> = {
  references: 'references',
  cited_by: 'cited by',
  related: 'related',
  bibliographic_coupling: 'shared refs',
  co_citation: 'co-citation',
  inferred_similarity: 'similarity',
};

const ROLE_POSITIONS: Record<EvidenceLineageNodeRole, { x: number; y: number; step: number }> = {
  origin: { x: 620, y: 330, step: 0 },
  foundational: { x: 90, y: 160, step: 126 },
  derivative: { x: 1120, y: 160, step: 126 },
  neighboring: { x: 520, y: 96, step: 118 },
  novelty_threat: { x: 860, y: 104, step: 118 },
  method_source: { x: 560, y: 565, step: 118 },
};

const ROLE_LIMITS: Record<EvidenceLineageNodeRole, number> = {
  origin: 1,
  foundational: 5,
  derivative: 5,
  neighboring: 4,
  novelty_threat: 4,
  method_source: 5,
};

const ROLE_LANE_LABELS: Array<{
  role: EvidenceLineageNodeRole;
  label: string;
  helper: string;
  className: string;
}> = [
  {
    role: 'foundational',
    label: 'Prior works',
    helper: 'older anchors',
    className: 'left-[90px] top-[112px]',
  },
  {
    role: 'neighboring',
    label: 'Nearby papers',
    helper: 'similar context',
    className: 'left-[520px] top-[48px]',
  },
  {
    role: 'novelty_threat',
    label: 'Novelty threats',
    helper: 'closest risks',
    className: 'left-[860px] top-[48px]',
  },
  {
    role: 'derivative',
    label: 'Derivative works',
    helper: 'newer branches',
    className: 'left-[1120px] top-[112px]',
  },
  {
    role: 'method_source',
    label: 'Method sources',
    helper: 'tools and models',
    className: 'left-[560px] top-[520px]',
  },
];

function shortText(text: string, limit: number) {
  if (text.length <= limit) return text;
  return `${text.slice(0, limit - 3).trim()}...`;
}

function LineageCard({ data }: { data: LineageNodeData }) {
  const { node, selected, onSelectNode } = data;
  const color = ROLE_COLORS[node.role];
  const isThreat = node.role === 'novelty_threat';
  const isOrigin = node.role === 'origin';
  const citationLabel =
    node.paper.citationCount > 999
      ? '999+ cites'
      : node.paper.citationCount > 0
        ? `${node.paper.citationCount} cites`
        : null;

  return (
    <button
      type="button"
      onClick={() => onSelectNode(node)}
      className={`relative cursor-move rounded-xl border text-left transition-colors focus:outline-none focus:ring-2 focus:ring-accent-base/50 ${
        isOrigin
          ? 'w-[280px] min-h-[118px] px-4 py-3'
          : selected
            ? 'w-[238px] min-h-[118px] px-3.5 py-3'
            : 'w-[210px] min-h-[88px] px-3 py-2.5'
      }`}
      style={{
        borderColor: selected || isOrigin ? color : 'rgba(148, 163, 184, 0.22)',
        background: `linear-gradient(135deg, rgba(15, 23, 42, 0.96), rgba(8, 14, 24, 0.92)), radial-gradient(circle at 8% 0%, ${color}26, transparent 52%)`,
        boxShadow:
          selected || isOrigin
            ? `0 0 0 1px ${color}, 0 16px 34px rgba(0, 0, 0, 0.28)`
            : '0 10px 22px rgba(0, 0, 0, 0.14)',
      }}
    >
      {(['left', 'right', 'top', 'bottom'] as const).map((side) => (
        <React.Fragment key={side}>
          <Handle
            id={`source-${side}`}
            type="source"
            position={
              side === 'left'
                ? Position.Left
                : side === 'right'
                  ? Position.Right
                  : side === 'top'
                    ? Position.Top
                    : Position.Bottom
            }
            className="!h-2 !w-2 !border-0 !bg-transparent"
          />
          <Handle
            id={`target-${side}`}
            type="target"
            position={
              side === 'left'
                ? Position.Left
                : side === 'right'
                  ? Position.Right
                  : side === 'top'
                    ? Position.Top
                    : Position.Bottom
            }
            className="!h-2 !w-2 !border-0 !bg-transparent"
          />
        </React.Fragment>
      ))}
      {isThreat && (
        <span
          className="absolute -inset-1 -z-10 rounded-[16px] opacity-25 blur-md"
          style={{ background: color }}
        />
      )}
      <div className="flex items-start justify-between gap-2">
        <p className={`${isOrigin ? 'text-sm' : 'text-xs'} font-semibold leading-snug text-text-primary`}>
          {shortText(node.paper.title, selected || isOrigin ? 92 : 58)}
        </p>
        {citationLabel && (
          <span
            className="shrink-0 rounded-full border px-2 py-0.5 text-[9px] text-text-secondary"
            style={{
              borderColor: `${color}80`,
              background: `${color}18`,
            }}
          >
            {citationLabel}
          </span>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span
          className="rounded-md border px-1.5 py-0.5 text-[9px] font-medium"
          style={{ borderColor: `${color}66`, background: `${color}22`, color }}
        >
          {ROLE_LABELS[node.role]}
        </span>
        <span className="text-[9px] uppercase tracking-wide text-text-tertiary">
          {node.paper.year || 'n.d.'}
        </span>
        {node.similarityToIdea > 0 && (
          <span className="text-[9px] uppercase tracking-wide text-text-tertiary">
            {Math.round(node.similarityToIdea * 100)}% fit
          </span>
        )}
      </div>
      {(selected || isOrigin) && (
        <p
          className="mt-2 text-[10px] leading-relaxed text-text-tertiary"
          style={{
            display: '-webkit-box',
            WebkitBoxOrient: 'vertical',
            WebkitLineClamp: isOrigin ? 2 : 3,
            overflow: 'hidden',
          }}
        >
          {node.explanation}
        </p>
      )}
    </button>
  );
}

const nodeTypes = {
  lineageCard: LineageCard,
};

function buildLayout(
  graph: EvidenceLineageGraph,
  selectedNodeId: string | undefined,
  roleFilters: Set<EvidenceLineageNodeRole>,
  edgeFilters: Set<EvidenceLineageEdgeKind>,
  onSelectNode: (node: EvidenceLineageNode) => void
) {
  const visibleNodes = graph.nodes.filter(
    (node) => node.role === 'origin' || roleFilters.has(node.role)
  );
  const cappedVisibleNodes = (Object.keys(ROLE_LIMITS) as EvidenceLineageNodeRole[]).flatMap((role) =>
    visibleNodes
      .filter((node) => node.role === role)
      .sort((a, b) => {
        const left = a.role === 'novelty_threat' ? a.threatScore || 0 : a.similarityToIdea;
        const right = b.role === 'novelty_threat' ? b.threatScore || 0 : b.similarityToIdea;
        return right - left || (b.paper.citationCount || 0) - (a.paper.citationCount || 0);
      })
      .slice(0, ROLE_LIMITS[role])
  );
  const visibleNodeIds = new Set(cappedVisibleNodes.map((node) => node.id));
  const roleIndexes = new Map<EvidenceLineageNodeRole, number>();

  const nodes: Node<LineageNodeData>[] = cappedVisibleNodes.map((node) => {
    const roleIndex = roleIndexes.get(node.role) || 0;
    roleIndexes.set(node.role, roleIndex + 1);
    const base = ROLE_POSITIONS[node.role];
    const xOffset =
      node.role === 'origin'
        ? 0
        : node.role === 'neighboring' || node.role === 'novelty_threat'
          ? (roleIndex % 2) * 245
          : 0;
    const yOffset =
      node.role === 'origin'
        ? 0
        : node.role === 'neighboring' || node.role === 'novelty_threat'
          ? Math.floor(roleIndex / 2) * base.step
          : roleIndex * base.step;

    return {
      id: node.id,
      type: 'lineageCard',
      position: {
        x: base.x + xOffset,
        y: base.y + yOffset,
      },
      data: {
        node,
        selected: selectedNodeId === node.id,
        onSelectNode,
      },
      draggable: true,
    };
  });

  const edges: Edge[] = graph.edges
    .filter(
      (edge) =>
        visibleNodeIds.has(edge.source) &&
        visibleNodeIds.has(edge.target) &&
        edgeFilters.has(edge.kind)
    )
    .map((edge) => {
      const color =
        edge.kind === 'references'
          ? '#38bdf8'
          : edge.kind === 'cited_by'
            ? '#22c55e'
            : edge.kind === 'bibliographic_coupling'
              ? '#a78bfa'
              : edge.kind === 'co_citation'
                ? '#f59e0b'
                : edge.kind === 'inferred_similarity'
                  ? '#64748b'
                  : '#14b8a6';
      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: 'smoothstep',
        animated: false,
        style: {
          stroke: color,
          strokeWidth: Math.max(1, Math.min(2.2, edge.strength * 2.2)),
          strokeDasharray:
            edge.kind === 'inferred_similarity'
              ? '3 5'
              : edge.kind === 'related' || edge.kind === 'bibliographic_coupling'
                ? '8 6'
                : undefined,
          opacity: edge.source === graph.originPaperId || edge.target === graph.originPaperId ? 0.62 : 0.32,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color,
          width: 14,
          height: 14,
        },
      } satisfies Edge;
    });

  return { nodes, edges };
}

function LineageViewport({
  graph,
  selectedNodeId,
  onSelectNode,
  viewportCommand,
}: {
  graph: EvidenceLineageGraph;
  selectedNodeId?: string;
  onSelectNode: (node: EvidenceLineageNode) => void;
  viewportCommand?: LineageViewportCommand;
}) {
  const [roleFilters, setRoleFilters] = useState<Set<EvidenceLineageNodeRole>>(
    () => new Set(['foundational', 'derivative', 'neighboring', 'novelty_threat', 'method_source'])
  );
  const [edgeFilters, setEdgeFilters] = useState<Set<EvidenceLineageEdgeKind>>(
    () =>
      new Set([
        'references',
        'cited_by',
        'related',
        'bibliographic_coupling',
        'co_citation',
        'inferred_similarity',
      ])
  );
  const computed = useMemo(
    () => buildLayout(graph, selectedNodeId, roleFilters, edgeFilters, onSelectNode),
    [edgeFilters, graph, onSelectNode, roleFilters, selectedNodeId]
  );
  const { fitView } = useReactFlow<Node<LineageNodeData>>();

  const fitGraph = useCallback(() => {
    fitView({ padding: 0.08, duration: 250 });
  }, [fitView]);

  useEffect(() => {
    if (viewportCommand?.type === 'fit') fitGraph();
    if (viewportCommand?.type === 'reset') fitGraph();
  }, [fitGraph, viewportCommand?.id, viewportCommand?.type]);

  const toggleRole = (role: EvidenceLineageNodeRole) => {
    setRoleFilters((current) => {
      const next = new Set(current);
      if (next.has(role)) next.delete(role);
      else next.add(role);
      return next;
    });
  };

  const toggleEdge = (kind: EvidenceLineageEdgeKind) => {
    setEdgeFilters((current) => {
      const next = new Set(current);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  };

  return (
    <>
      <div className="pointer-events-none absolute inset-0 z-[1]">
        {ROLE_LANE_LABELS.map((lane) => (
          <div
            key={lane.role}
            className={`absolute rounded-lg border border-border-subtle/70 bg-bg-base/25 px-3 py-2 backdrop-blur-sm ${lane.className}`}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wide text-text-secondary">
              {lane.label}
            </p>
            <p className="mt-0.5 text-[9px] uppercase tracking-wide text-text-tertiary">
              {lane.helper}
            </p>
          </div>
        ))}
      </div>
      <div className="absolute left-5 top-[76px] z-10 max-w-[calc(100%-40px)] space-y-2">
        <div className="flex flex-wrap gap-1.5 rounded-xl border border-border-subtle bg-bg-base/80 p-1.5 backdrop-blur">
          {(['foundational', 'derivative', 'neighboring', 'novelty_threat', 'method_source'] as EvidenceLineageNodeRole[]).map((role) => (
            <button
              key={role}
              type="button"
              onClick={() => toggleRole(role)}
              className={`rounded-lg border px-2 py-1 text-[10px] font-medium ${
                roleFilters.has(role)
                  ? 'border-accent-base/50 bg-accent-base/18 text-accent-text'
                  : 'border-border-subtle text-text-tertiary'
              }`}
            >
              {ROLE_LABELS[role]}
            </button>
          ))}
        </div>
        <details className="rounded-xl border border-border-subtle bg-bg-base/80 p-2 text-xs text-text-tertiary backdrop-blur">
          <summary className="cursor-pointer text-text-secondary">Edge filters</summary>
          <div className="mt-2 flex flex-wrap gap-2">
            {(Object.keys(EDGE_LABELS) as EvidenceLineageEdgeKind[]).map((kind) => (
              <button
                key={kind}
                type="button"
                onClick={() => toggleEdge(kind)}
                className={`rounded-md border px-2 py-1 text-[10px] ${
                  edgeFilters.has(kind)
                    ? 'border-border-strong text-text-primary'
                    : 'border-border-subtle text-text-tertiary'
                }`}
              >
                {EDGE_LABELS[kind]}
              </button>
            ))}
          </div>
        </details>
      </div>
      <div className="absolute right-5 top-5 z-10 rounded-xl border border-border-subtle bg-bg-base/80 px-3 py-2 text-xs text-text-tertiary backdrop-blur">
        {graph.nodes.length} papers / {graph.edges.length} links
      </div>
      <ReactFlow
        key={`${graph.generatedAt || graph.originPaperId}-${selectedNodeId || 'none'}-${[...roleFilters].join(',')}-${[...edgeFilters].join(',')}`}
        defaultNodes={computed.nodes}
        defaultEdges={computed.edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.08 }}
        minZoom={0.42}
        maxZoom={1.35}
        nodesDraggable
        nodesConnectable={false}
        elementsSelectable
        panOnScroll
        defaultEdgeOptions={{
          interactionWidth: 18,
        }}
        proOptions={{ hideAttribution: true }}
      />
    </>
  );
}

export default function PaperLineageFlow({
  graph,
  loading,
  error,
  selectedNodeId,
  onSelectNode,
  onBuildGraph,
  viewportCommand,
}: PaperLineageFlowProps) {
  if (loading) {
    return (
      <div className="flex h-full min-h-[520px] items-center justify-center">
        <div className="rounded-2xl border border-border-subtle bg-bg-base/80 p-6 text-center">
          <p className="text-sm font-semibold text-text-primary">Building lineage graph</p>
          <p className="mt-2 max-w-sm text-xs leading-relaxed text-text-tertiary">
            ResearchLens is checking citation-network metadata, then filling gaps from the
            current result set.
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full min-h-[520px] items-center justify-center">
        <div className="max-w-md rounded-2xl border border-status-error/30 bg-status-error-bg p-6 text-center">
          <p className="text-sm font-semibold text-status-error">Lineage graph failed</p>
          <p className="mt-2 text-xs leading-relaxed text-status-error">{error}</p>
          <button
            type="button"
            onClick={onBuildGraph}
            className="mt-4 rounded-lg bg-accent-base px-4 py-2 text-xs font-medium text-white hover:bg-accent-hover"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!graph) {
    return (
      <div className="flex h-full min-h-[520px] items-center justify-center">
        <div className="max-w-lg rounded-2xl border border-border-subtle bg-bg-base/80 p-6 text-center">
          <p className="text-base font-semibold text-text-primary">Build a paper lineage graph</p>
          <p className="mt-2 text-sm leading-relaxed text-text-secondary">
            Start from an origin paper to see prior works, derivative works, close
            neighbors, method sources, and novelty threats in one canvas.
          </p>
          <button
            type="button"
            onClick={onBuildGraph}
            className="mt-5 rounded-lg bg-accent-base px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
          >
            Build lineage graph
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-[520px] bg-[#07111f] bg-[linear-gradient(rgba(148,163,184,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.035)_1px,transparent_1px),radial-gradient(circle_at_50%_44%,rgba(139,92,246,0.10),transparent_30%),radial-gradient(circle_at_20%_30%,rgba(56,189,248,0.07),transparent_32%),linear-gradient(135deg,rgba(7,17,31,1),rgba(2,6,23,1))] bg-[size:32px_32px,32px_32px,auto,auto,auto]">
      <ReactFlowProvider>
        <LineageViewport
          graph={graph}
          selectedNodeId={selectedNodeId}
          onSelectNode={onSelectNode}
          viewportCommand={viewportCommand}
        />
      </ReactFlowProvider>
    </div>
  );
}
