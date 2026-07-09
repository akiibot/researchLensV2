'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  applyNodeChanges,
  Edge,
  Handle,
  Node,
  OnNodeDrag,
  OnNodesChange,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Pivot,
  ThesisMindmap,
  ThesisMindmapBranch,
  ThesisMindmapBranchKind,
  ThesisMindmapNode,
  ThesisMindmapNodeStatus,
} from '@/lib/types';

interface ThesisMindmapFlowProps {
  mindmap: ThesisMindmap;
  pivots: Pivot[];
  viewMode: 'simple' | 'full';
  onExplorePivot?: (pivot: Pivot) => void;
  onExploreBranch?: (branch: ThesisMindmapBranch) => void;
  onExploreNode?: (node: ThesisMindmapNode, branch: ThesisMindmapBranch) => void;
  onSelectBranch?: (branch: ThesisMindmapBranch) => void;
  onSelectCenter?: () => void;
  onSelectNode?: (node: ThesisMindmapNode, branch: ThesisMindmapBranch) => void;
  onReadPapers: () => void;
  onViewModeChange?: (mode: 'simple' | 'full') => void;
  selectedBranchId?: string;
  selectedNodeId?: string;
  selectedCenter?: boolean;
  workspaceMode?: 'compact' | 'fullscreen';
  viewportCommand?: MindmapViewportCommand;
}

type MindmapViewportCommand = { id: number; type: 'fit' | 'reset' };

interface FlowNodeData extends Record<string, unknown> {
  title: string;
  subtitle?: string;
  status?: ThesisMindmapNodeStatus;
  kind?: ThesisMindmapBranchKind | 'center';
  nodeRole: 'center' | 'branch' | 'leaf';
  isSelected?: boolean;
  paperCount?: number;
  isOpportunity?: boolean;
  action?: 'explore_pivot' | 'read_papers' | 'narrow_scope';
  pivotIndex?: number;
  branch?: ThesisMindmapBranch;
  node?: ThesisMindmapNode;
  onExplorePivot?: (pivot: Pivot) => void;
  onExploreBranch?: (branch: ThesisMindmapBranch) => void;
  onExploreNode?: (node: ThesisMindmapNode, branch: ThesisMindmapBranch) => void;
  onSelectBranch?: (branch: ThesisMindmapBranch) => void;
  onSelectCenter?: () => void;
  onSelectNode?: (node: ThesisMindmapNode, branch: ThesisMindmapBranch) => void;
  onReadPapers?: () => void;
  pivots?: Pivot[];
}

type NodeRole = FlowNodeData['nodeRole'];
type EdgeSide = 'left' | 'right' | 'top' | 'bottom';

const HANDLE_POSITIONS: Record<EdgeSide, Position> = {
  left: Position.Left,
  right: Position.Right,
  top: Position.Top,
  bottom: Position.Bottom,
};

const NODE_DIMENSIONS: Record<NodeRole, { width: number; height: number }> = {
  center: { width: 280, height: 106 },
  branch: { width: 230, height: 96 },
  leaf: { width: 190, height: 76 },
};

const SELECTED_NODE_DIMENSIONS: Record<NodeRole, { width: number; height: number }> = {
  center: { width: 320, height: 142 },
  branch: { width: 280, height: 156 },
  leaf: { width: 240, height: 138 },
};

const NODE_COLLISION_GAP = 28;

const ZONE_LABELS: Partial<Record<ThesisMindmapBranchKind, string>> = {
  topic: 'Scope',
  method: 'Method',
  population: 'Population',
  geography: 'Geography',
  evidence: 'Evidence',
  risk: 'Risk',
  pivots: 'Next Moves',
};

const KIND_COLORS: Record<ThesisMindmapBranchKind | 'center', string> = {
  center: '#8b5cf6',
  topic: '#38bdf8',
  method: '#22c55e',
  population: '#f59e0b',
  geography: '#14b8a6',
  evidence: '#6366f1',
  risk: '#ef4444',
  pivots: '#a855f7',
};

const KIND_GLOW: Record<ThesisMindmapBranchKind | 'center', string> = {
  center: 'rgba(139, 92, 246, 0.32)',
  topic: 'rgba(56, 189, 248, 0.18)',
  method: 'rgba(34, 197, 94, 0.16)',
  population: 'rgba(245, 158, 11, 0.18)',
  geography: 'rgba(20, 184, 166, 0.16)',
  evidence: 'rgba(99, 102, 241, 0.18)',
  risk: 'rgba(239, 68, 68, 0.16)',
  pivots: 'rgba(168, 85, 247, 0.18)',
};

const STATUS_LABELS: Record<ThesisMindmapNodeStatus, string> = {
  crowded: 'Crowded',
  moderate: 'Moderate',
  open: 'Open',
  strong: 'Strong',
  weak: 'Weak',
  risk: 'Risk',
  neutral: 'Neutral',
};

const STATUS_CLASSES: Record<ThesisMindmapNodeStatus, string> = {
  crowded: 'border-status-error/40 bg-status-error-bg text-status-error',
  moderate: 'border-status-warning/40 bg-status-warning-bg text-status-warning',
  open: 'border-status-success/40 bg-status-success-bg text-status-success',
  strong: 'border-status-success/40 bg-status-success-bg text-status-success',
  weak: 'border-status-error/40 bg-status-error-bg text-status-error',
  risk: 'border-status-error/40 bg-status-error-bg text-status-error',
  neutral: 'border-border-subtle bg-bg-secondary text-text-secondary',
};

function FlowCard({ data }: { data: FlowNodeData }) {
  const accent = KIND_COLORS[data.kind || 'center'];
  const isCenter = data.nodeRole === 'center';
  const isBranch = data.nodeRole === 'branch';
  const isSelected = Boolean(data.isSelected);
  const statusLabel = data.status
    ? STATUS_LABELS[data.status]
    : isCenter
      ? 'Core'
      : isBranch
        ? data.kind
        : undefined;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => {
        if (data.node && data.branch) {
          data.onSelectNode?.(data.node, data.branch);
        } else if (data.branch) {
          data.onSelectBranch?.(data.branch);
        } else if (data.kind === 'center') {
          data.onSelectCenter?.();
        }
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        if (data.node && data.branch) {
          data.onSelectNode?.(data.node, data.branch);
        } else if (data.branch) {
          data.onSelectBranch?.(data.branch);
        } else if (data.kind === 'center') {
          data.onSelectCenter?.();
        }
      }}
      className={`group cursor-move rounded-lg border px-3 py-2.5 text-left transition-colors ${
        isCenter
          ? isSelected
            ? 'w-[320px] min-h-[130px]'
            : 'w-[280px] min-h-[106px]'
          : isBranch
            ? isSelected
              ? 'w-[280px] min-h-[132px]'
              : 'w-[230px] min-h-[96px]'
            : isSelected
              ? 'w-[240px] min-h-[112px]'
              : 'w-[190px] min-h-[76px]'
      } ${
        isSelected || data.isOpportunity ? 'border-accent-base/80' : 'border-border-subtle'
      } focus:outline-none focus:ring-2 focus:ring-accent-base/50`}
      style={{
        background: `linear-gradient(135deg, rgba(20, 31, 45, 0.96), rgba(10, 19, 31, 0.92)), radial-gradient(circle at 20% 0%, ${KIND_GLOW[data.kind || 'center']}, transparent 55%)`,
        borderColor: isCenter || isSelected ? accent : data.isOpportunity ? accent : 'rgba(148, 163, 184, 0.2)',
        boxShadow: isCenter || isSelected
          ? `0 0 0 1px ${accent}, 0 18px 42px rgba(0, 0, 0, 0.28)`
          : '0 12px 26px rgba(0, 0, 0, 0.16)',
      }}
    >
      {(Object.keys(HANDLE_POSITIONS) as EdgeSide[]).map((side) => (
        <React.Fragment key={side}>
          <Handle
            id={`source-${side}`}
            type="source"
            position={HANDLE_POSITIONS[side]}
            className="!h-2 !w-2 !border-0 !bg-transparent"
          />
          <Handle
            id={`target-${side}`}
            type="target"
            position={HANDLE_POSITIONS[side]}
            className="!h-2 !w-2 !border-0 !bg-transparent"
          />
        </React.Fragment>
      ))}
      <div className={isCenter ? 'text-center' : ''}>
        <p
          className={`${isCenter ? 'text-base' : isBranch ? 'text-sm' : 'text-xs'} font-semibold text-text-primary leading-snug`}
          style={{
            display: '-webkit-box',
            WebkitBoxOrient: 'vertical',
            WebkitLineClamp: isSelected ? 3 : 2,
            overflow: 'hidden',
          }}
        >
          {data.title}
        </p>
        {statusLabel && (
          <span
            className={`mt-2 inline-flex shrink-0 rounded-md border px-2 py-0.5 text-[9px] font-medium capitalize ${
              data.status ? STATUS_CLASSES[data.status] : 'border-accent-base/35 bg-accent-base/20 text-accent-text'
            }`}
          >
            {statusLabel}
          </span>
        )}
      </div>

      {data.subtitle && (
        <p
          className={`${isCenter ? 'mx-auto mt-2 max-w-[260px] text-[11px]' : 'mt-1.5 text-[11px]'} leading-relaxed text-text-tertiary`}
          style={{
            display: '-webkit-box',
            WebkitBoxOrient: 'vertical',
            WebkitLineClamp: isSelected ? 4 : isCenter || isBranch ? 2 : 1,
            overflow: 'hidden',
          }}
        >
          {data.subtitle}
        </p>
      )}

      {!isCenter && (
      <div className="mt-2 flex items-center justify-between gap-2">
        {typeof data.paperCount === 'number' ? (
          <p className="text-[9px] uppercase tracking-wide text-text-tertiary">
            {data.paperCount} paper {data.paperCount === 1 ? 'signal' : 'signals'}
          </p>
        ) : (
          <span />
        )}
        <p className="opacity-0 transition-opacity group-hover:opacity-100 group-focus:opacity-100 text-[9px] uppercase tracking-wide text-accent-base">
          Select
        </p>
      </div>
      )}
    </div>
  );
}

const nodeTypes = {
  mindmapCard: FlowCard,
};

type LayoutPositions = Record<string, { x: number; y: number }>;

const LAYOUT_STORAGE_KEY = 'researchlens_mindmap_layout_v2';
const SIMPLE_LAYOUT_STORAGE_KEY = 'researchlens_mindmap_layout_simple_v1';

type BranchSlot = {
  branch: { x: number; y: number };
  children: Array<{ x: number; y: number }>;
};

const BRANCH_SLOTS: Partial<Record<ThesisMindmapBranchKind, BranchSlot>> = {
  topic: {
    branch: { x: 240, y: 160 },
    children: [
      { x: 32, y: 98 },
      { x: 32, y: 205 },
    ],
  },
  population: {
    branch: { x: 232, y: 382 },
    children: [
      { x: 30, y: 324 },
      { x: 30, y: 432 },
    ],
  },
  method: {
    branch: { x: 500, y: 492 },
    children: [
      { x: 380, y: 602 },
      { x: 575, y: 602 },
    ],
  },
  evidence: {
    branch: { x: 760, y: 160 },
    children: [
      { x: 955, y: 98 },
      { x: 955, y: 205 },
    ],
  },
  risk: {
    branch: { x: 760, y: 382 },
    children: [
      { x: 955, y: 324 },
      { x: 955, y: 432 },
    ],
  },
  pivots: {
    branch: { x: 762, y: 272 },
    children: [{ x: 955, y: 270 }],
  },
  geography: {
    branch: { x: 500, y: 62 },
    children: [{ x: 500, y: -28 }],
  },
};

const SIMPLE_BRANCH_SLOTS: Partial<Record<ThesisMindmapBranchKind, { x: number; y: number }>> = {
  topic: { x: 40, y: 170 },
  population: { x: 40, y: 315 },
  method: { x: 290, y: 430 },
  geography: { x: 290, y: 58 },
  evidence: { x: 565, y: 170 },
  risk: { x: 565, y: 315 },
  pivots: { x: 545, y: 450 },
};

const FALLBACK_SLOTS: BranchSlot[] = [
  { branch: { x: 240, y: 170 }, children: [{ x: 38, y: 165 }] },
  { branch: { x: 795, y: 175 }, children: [{ x: 995, y: 165 }] },
  { branch: { x: 232, y: 395 }, children: [{ x: 30, y: 390 }] },
  { branch: { x: 795, y: 395 }, children: [{ x: 995, y: 390 }] },
  { branch: { x: 510, y: 500 }, children: [{ x: 500, y: 615 }] },
];

function simpleBranchSummary(
  branch: ThesisMindmapBranch,
  topNode?: ThesisMindmapNode
): string {
  if (!topNode) return branch.summary;

  const description = topNode.description.trim();
  if (description) return description;

  const duplicatePrefix = `${branch.label}:`;
  if (topNode.label.toLowerCase().startsWith(duplicatePrefix.toLowerCase())) {
    return topNode.label.slice(duplicatePrefix.length).trim();
  }

  return topNode.label;
}

function nodeCenter(
  position: { x: number; y: number },
  role: NodeRole
): { x: number; y: number } {
  const dimensions = NODE_DIMENSIONS[role];
  return {
    x: position.x + dimensions.width / 2,
    y: position.y + dimensions.height / 2,
  };
}

function nodeFootprint(node: Node<FlowNodeData>) {
  const dimensions = node.data.isSelected
    ? SELECTED_NODE_DIMENSIONS[node.data.nodeRole]
    : NODE_DIMENSIONS[node.data.nodeRole];

  return {
    left: node.position.x,
    right: node.position.x + dimensions.width,
    top: node.position.y,
    bottom: node.position.y + dimensions.height,
    width: dimensions.width,
    height: dimensions.height,
  };
}

function resolveNodeCollisions(nodes: Node<FlowNodeData>[]) {
  const resolved = nodes.map((node) => ({
    ...node,
    position: { ...node.position },
  }));

  for (let pass = 0; pass < 12; pass += 1) {
    let changed = false;

    for (let leftIndex = 0; leftIndex < resolved.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < resolved.length; rightIndex += 1) {
        const leftNode = resolved[leftIndex];
        const rightNode = resolved[rightIndex];
        const leftBox = nodeFootprint(leftNode);
        const rightBox = nodeFootprint(rightNode);
        const overlapsX =
          leftBox.left < rightBox.right + NODE_COLLISION_GAP &&
          leftBox.right + NODE_COLLISION_GAP > rightBox.left;
        const overlapsY =
          leftBox.top < rightBox.bottom + NODE_COLLISION_GAP &&
          leftBox.bottom + NODE_COLLISION_GAP > rightBox.top;

        if (!overlapsX || !overlapsY) continue;

        const leftCenter = {
          x: leftBox.left + leftBox.width / 2,
          y: leftBox.top + leftBox.height / 2,
        };
        const rightCenter = {
          x: rightBox.left + rightBox.width / 2,
          y: rightBox.top + rightBox.height / 2,
        };
        const overlapX =
          Math.min(leftBox.right, rightBox.right) -
          Math.max(leftBox.left, rightBox.left) +
          NODE_COLLISION_GAP;
        const overlapY =
          Math.min(leftBox.bottom, rightBox.bottom) -
          Math.max(leftBox.top, rightBox.top) +
          NODE_COLLISION_GAP;
        const separateVertically = overlapY <= overlapX || Math.abs(rightCenter.y - leftCenter.y) > 20;
        const leftWeight = leftNode.id === 'center' ? 0.28 : 0.5;
        const rightWeight = rightNode.id === 'center' ? 0.28 : 0.5;

        if (separateVertically) {
          const direction = rightCenter.y >= leftCenter.y ? 1 : -1;
          leftNode.position.y -= direction * overlapY * leftWeight;
          rightNode.position.y += direction * overlapY * rightWeight;
        } else {
          const direction = rightCenter.x >= leftCenter.x ? 1 : -1;
          leftNode.position.x -= direction * overlapX * leftWeight;
          rightNode.position.x += direction * overlapX * rightWeight;
        }

        changed = true;
      }
    }

    if (!changed) break;
  }

  return resolved;
}

function directionSide(
  sourcePosition: { x: number; y: number },
  sourceRole: NodeRole,
  targetPosition: { x: number; y: number },
  targetRole: NodeRole
): EdgeSide {
  const sourceCenter = nodeCenter(sourcePosition, sourceRole);
  const targetCenter = nodeCenter(targetPosition, targetRole);
  const dx = targetCenter.x - sourceCenter.x;
  const dy = targetCenter.y - sourceCenter.y;

  if (Math.abs(dy) > Math.abs(dx) * 0.45) {
    return dy > 0 ? 'bottom' : 'top';
  }

  return dx > 0 ? 'right' : 'left';
}

function createDirectionalEdge({
  id,
  source,
  target,
  sourcePosition,
  sourceRole,
  targetPosition,
  targetRole,
  stroke = 'rgba(148, 163, 184, 0.72)',
  strokeWidth = 1.6,
}: {
  id: string;
  source: string;
  target: string;
  sourcePosition: { x: number; y: number };
  sourceRole: NodeRole;
  targetPosition: { x: number; y: number };
  targetRole: NodeRole;
  stroke?: string;
  strokeWidth?: number;
}): Edge {
  const sourceSide = directionSide(
    sourcePosition,
    sourceRole,
    targetPosition,
    targetRole
  );
  const targetSide = directionSide(
    targetPosition,
    targetRole,
    sourcePosition,
    sourceRole
  );

  return {
    id,
    source,
    target,
    sourceHandle: `source-${sourceSide}`,
    targetHandle: `target-${targetSide}`,
    type: 'smoothstep',
    style: { stroke, strokeWidth },
  };
}

function layoutStorageKey(viewMode: 'simple' | 'full') {
  return viewMode === 'simple' ? SIMPLE_LAYOUT_STORAGE_KEY : LAYOUT_STORAGE_KEY;
}

function loadLayoutPositions(viewMode: 'simple' | 'full'): LayoutPositions {
  if (typeof window === 'undefined') return {};

  try {
    const stored = sessionStorage.getItem(layoutStorageKey(viewMode));
    return stored ? (JSON.parse(stored) as LayoutPositions) : {};
  } catch {
    return {};
  }
}

function persistLayoutPositions(nodes: Node<FlowNodeData>[], viewMode: 'simple' | 'full') {
  if (typeof window === 'undefined') return;

  try {
    const positions = nodes.reduce<LayoutPositions>((acc, node) => {
      acc[node.id] = node.position;
      return acc;
    }, {});
    sessionStorage.setItem(layoutStorageKey(viewMode), JSON.stringify(positions));
  } catch {
    // Layout persistence is best-effort only.
  }
}

function clearLayoutPositions(viewMode: 'simple' | 'full') {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(layoutStorageKey(viewMode));
}

function applySavedPositions(nodes: Node<FlowNodeData>[], viewMode: 'simple' | 'full') {
  const savedPositions = loadLayoutPositions(viewMode);
  const positionedNodes = nodes.map((node) => ({
    ...node,
    draggable: true,
    position: savedPositions[node.id] || node.position,
  }));

  return resolveNodeCollisions(positionedNodes);
}

function buildFlowElements({
  mindmap,
  pivots,
  viewMode,
  onExplorePivot,
  onExploreBranch,
  onExploreNode,
  onSelectBranch,
  onSelectCenter,
  onSelectNode,
  onReadPapers,
  selectedBranchId,
  selectedNodeId,
  selectedCenter,
}: ThesisMindmapFlowProps): { nodes: Node<FlowNodeData>[]; edges: Edge[] } {
  const nodes: Node<FlowNodeData>[] = [
    {
      id: 'center',
      type: 'mindmapCard',
      position: viewMode === 'simple' ? { x: 282, y: 248 } : { x: 470, y: 286 },
      data: {
        title: mindmap.center.split(':')[0] || 'Thesis idea',
        subtitle: mindmap.center,
        kind: 'center',
        nodeRole: 'center',
        isSelected: selectedCenter,
        onSelectCenter,
      },
      draggable: true,
    },
  ];
  const edges: Edge[] = [];

  mindmap.branches.forEach((branch, branchIndex) => {
    if (viewMode === 'simple') {
      const branchPosition =
        SIMPLE_BRANCH_SLOTS[branch.kind] || FALLBACK_SLOTS[branchIndex % FALLBACK_SLOTS.length].branch;
      const branchId = `branch-${branch.id}`;
      const topNode = branch.nodes[0];

      nodes.push({
        id: branchId,
        type: 'mindmapCard',
        position: branchPosition,
        data: {
          title: ZONE_LABELS[branch.kind] || branch.label,
          subtitle: simpleBranchSummary(branch, topNode),
          status: topNode?.status,
          kind: branch.kind,
          nodeRole: 'branch',
          isSelected: selectedBranchId === branch.id,
          paperCount: branch.nodes.reduce(
            (sum, node) => sum + (node.paperCount || 0),
            0
          ),
          branch,
          onExploreBranch,
          onSelectBranch,
        },
        draggable: true,
      });
      edges.push(
        createDirectionalEdge({
          id: `center-${branchId}`,
          source: 'center',
          target: branchId,
          sourcePosition: nodes[0].position,
          sourceRole: 'center',
          targetPosition: branchPosition,
          targetRole: 'branch',
          strokeWidth: 1.8,
        })
      );
      return;
    }

    const slot =
      BRANCH_SLOTS[branch.kind] || FALLBACK_SLOTS[branchIndex % FALLBACK_SLOTS.length];
    const branchX = slot.branch.x;
    const branchY = slot.branch.y;
    const branchId = `branch-${branch.id}`;

    nodes.push({
      id: branchId,
      type: 'mindmapCard',
      position: { x: branchX, y: branchY },
      data: {
        title: branch.label,
        subtitle: branch.summary,
        kind: branch.kind,
        nodeRole: 'branch',
        isSelected: selectedBranchId === branch.id,
        branch,
        onExploreBranch,
        onSelectBranch,
      },
      draggable: true,
    });
    edges.push(
      createDirectionalEdge({
        id: `center-${branchId}`,
        source: 'center',
        target: branchId,
        sourcePosition: nodes[0].position,
        sourceRole: 'center',
        targetPosition: { x: branchX, y: branchY },
        targetRole: 'branch',
        stroke: 'rgba(148, 163, 184, 0.66)',
        strokeWidth: 1.6,
      })
    );

    branch.nodes.slice(0, slot.children.length).forEach((node, nodeIndex) => {
      const childId = `node-${node.id}`;
      const childPosition = slot.children[nodeIndex];
      nodes.push({
        id: childId,
        type: 'mindmapCard',
        position: childPosition,
        data: {
          title: node.label,
          subtitle: node.description,
          status: node.status,
          kind: branch.kind,
          nodeRole: 'leaf',
          isSelected: selectedNodeId === node.id,
          paperCount: node.paperCount,
          isOpportunity: node.id === mindmap.bestOpportunityNodeId,
          action: node.action,
          pivotIndex: node.pivotIndex,
          branch,
          node,
          onExplorePivot,
          onExploreNode,
          onSelectNode,
          onReadPapers,
          pivots,
        },
        draggable: true,
      });
      edges.push(
        createDirectionalEdge({
          id: `${branchId}-${childId}`,
          source: branchId,
          target: childId,
          sourcePosition: { x: branchX, y: branchY },
          sourceRole: 'branch',
          targetPosition: childPosition,
          targetRole: 'leaf',
          strokeWidth: 1.4,
        })
      );
    });
  });

  return { nodes, edges };
}

interface FlowCanvasProps {
  computedNodes: Node<FlowNodeData>[];
  edges: Edge[];
  viewMode: 'simple' | 'full';
  onViewModeChange?: (mode: 'simple' | 'full') => void;
  workspaceMode: 'compact' | 'fullscreen';
  viewportCommand?: MindmapViewportCommand;
}

function FlowToolbar({
  viewMode,
  onViewModeChange,
  onFit,
  onReset,
  workspaceMode,
}: {
  viewMode: 'simple' | 'full';
  onViewModeChange?: (mode: 'simple' | 'full') => void;
  onFit: () => void;
  onReset: () => void;
  workspaceMode: 'compact' | 'fullscreen';
}) {
  return (
    <div
      className={`absolute right-4 top-4 z-10 flex flex-wrap items-center justify-end gap-3 transition-opacity hover:opacity-100 focus-within:opacity-100 ${
        workspaceMode === 'fullscreen' ? 'opacity-100' : 'opacity-20'
      }`}
    >
      <div className="hidden rounded-lg border border-border-subtle bg-bg-surface/85 p-1 backdrop-blur">
        {(['simple', 'full'] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => onViewModeChange?.(mode)}
            className={`min-h-[32px] rounded-md px-3 text-xs font-medium capitalize transition-colors ${
              viewMode === mode
                ? 'bg-accent-base text-white shadow-sm shadow-accent-base/20'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {mode}
          </button>
        ))}
      </div>
      <div className="inline-flex rounded-lg border border-border-subtle bg-bg-surface/85 p-1 backdrop-blur">
        <button
          type="button"
          onClick={onFit}
          className="min-h-[32px] rounded-md px-3 text-xs font-medium text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
        >
          Fit
        </button>
        <button
          type="button"
          onClick={onReset}
          className="min-h-[32px] rounded-md px-3 text-xs font-medium text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
        >
          Reset
        </button>
      </div>
    </div>
  );
}

function FlowViewport({
  nodes,
  edges,
  viewMode,
  onNodesChange,
  onNodeDragStop,
  onViewModeChange,
  onReset,
  workspaceMode,
  viewportCommand,
}: {
  nodes: Node<FlowNodeData>[];
  edges: Edge[];
  viewMode: 'simple' | 'full';
  onNodesChange: OnNodesChange<Node<FlowNodeData>>;
  onNodeDragStop: OnNodeDrag<Node<FlowNodeData>>;
  onViewModeChange?: (mode: 'simple' | 'full') => void;
  onReset: () => void;
  workspaceMode: 'compact' | 'fullscreen';
  viewportCommand?: MindmapViewportCommand;
}) {
  const { fitView } = useReactFlow<Node<FlowNodeData>>();
  const fitPadding = workspaceMode === 'fullscreen' ? 0.06 : viewMode === 'simple' ? 0.06 : 0.1;
  const fitMap = useCallback(() => {
    fitView({
      padding: fitPadding,
      duration: 250,
    });
  }, [fitPadding, fitView]);

  useEffect(() => {
    if (viewportCommand?.type === 'fit') {
      fitMap();
    }
  }, [fitMap, viewportCommand?.id, viewportCommand?.type]);

  return (
    <>
      {workspaceMode !== 'fullscreen' && (
        <FlowToolbar
          viewMode={viewMode}
          onViewModeChange={onViewModeChange}
          onFit={fitMap}
          onReset={onReset}
          workspaceMode={workspaceMode}
        />
      )}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onNodeDragStop={onNodeDragStop}
        fitView
        fitViewOptions={{
          padding: workspaceMode === 'fullscreen' ? 0.06 : viewMode === 'simple' ? 0.06 : 0.08,
        }}
        minZoom={workspaceMode === 'fullscreen' ? 0.55 : viewMode === 'simple' ? 0.72 : 0.52}
        maxZoom={workspaceMode === 'fullscreen' ? 1.45 : 1.25}
        proOptions={{ hideAttribution: true }}
        nodesDraggable
        nodesConnectable={false}
        elementsSelectable
        panOnScroll
      />
    </>
  );
}

function FlowCanvas({
  computedNodes,
  edges,
  viewMode,
  onViewModeChange,
  workspaceMode,
  viewportCommand,
}: FlowCanvasProps) {
  const [nodes, setNodes] = useState<Node<FlowNodeData>[]>(() =>
    applySavedPositions(computedNodes, viewMode)
  );

  const onNodesChange: OnNodesChange<Node<FlowNodeData>> = useCallback((changes) => {
    setNodes((currentNodes) =>
      applyNodeChanges(changes, currentNodes)
    );
  }, []);

  const handleNodeDragStop: OnNodeDrag<Node<FlowNodeData>> = useCallback(
    (_event, draggedNode) => {
      setNodes((currentNodes) => {
        const nextNodes = currentNodes.map((node) =>
          node.id === draggedNode.id
            ? { ...node, position: draggedNode.position }
            : node
        );
        persistLayoutPositions(nextNodes, viewMode);
        return nextNodes;
      });
    },
    [viewMode]
  );

  const resetLayout = useCallback(() => {
    clearLayoutPositions(viewMode);
    setNodes(applySavedPositions(computedNodes, viewMode));
  }, [computedNodes, viewMode]);

  useEffect(() => {
    if (viewportCommand?.type === 'reset') {
      queueMicrotask(resetLayout);
    }
  }, [resetLayout, viewportCommand?.id, viewportCommand?.type]);

  return (
    <div
      className={`relative hidden overflow-hidden lg:block ${
        workspaceMode === 'fullscreen' ? 'h-full min-h-0' : 'h-[660px]'
      }`}
    >
      <div
        className={
          workspaceMode === 'fullscreen'
            ? 'h-full bg-[#07111f] bg-[radial-gradient(circle_at_50%_45%,rgba(139,92,246,0.10),transparent_28%),radial-gradient(circle_at_20%_25%,rgba(6,182,212,0.08),transparent_32%),linear-gradient(135deg,rgba(7,17,31,1),rgba(2,6,23,1))]'
            : 'h-full bg-[radial-gradient(circle_at_50%_45%,rgba(139,92,246,0.10),transparent_28%),radial-gradient(circle_at_20%_25%,rgba(6,182,212,0.08),transparent_32%),linear-gradient(135deg,rgba(15,23,42,0.62),rgba(2,6,23,0.18))]'
        }
      >
        <ReactFlowProvider>
          <FlowViewport
            nodes={nodes}
            edges={edges}
            viewMode={viewMode}
            onNodesChange={onNodesChange}
            onNodeDragStop={handleNodeDragStop}
            onViewModeChange={onViewModeChange}
            onReset={resetLayout}
            workspaceMode={workspaceMode}
            viewportCommand={viewportCommand}
          />
        </ReactFlowProvider>
      </div>
    </div>
  );
}

export default function ThesisMindmapFlow(props: ThesisMindmapFlowProps) {
  const { nodes: computedNodes, edges } = useMemo(
    () => buildFlowElements(props),
    [props]
  );
  const layoutKey = useMemo(
    () =>
      computedNodes
        .map(
          (node) =>
            `${props.viewMode}:${node.id}:${node.data.title}:${node.data.subtitle || ''}:${node.data.isSelected ? 'selected' : 'idle'}`
        )
        .join('|'),
    [computedNodes, props.viewMode]
  );

  return (
    <FlowCanvas
      key={layoutKey}
      computedNodes={computedNodes}
      edges={edges}
      viewMode={props.viewMode}
      onViewModeChange={props.onViewModeChange}
      workspaceMode={props.workspaceMode || 'compact'}
      viewportCommand={props.viewportCommand}
    />
  );
}
