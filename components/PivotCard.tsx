/**
 * @file PivotCard Component
 *
 * Displays a single research pivot suggestion with:
 * - Header showing pivot number and target gap dimension
 * - Description of the reformulated research direction
 * - Expandable rationale section
 * - Color accent matching the gap dimension
 *
 * @component
 */

'use client';

import React, { useState } from 'react';
import { Pivot } from '@/lib/types';
import Button from '@/components/ui/Button';

interface PivotCardProps {
  pivot: Pivot;
  index: number;
  onExplorePivot?: (pivot: Pivot) => void;
}

/** Color config per gap dimension */
const DIMENSION_COLORS: Record<
  string,
  { border: string; accent: string; bg: string; label: string }
> = {
  topic: {
    border: 'border-t-accent-base',
    accent: 'text-accent-base',
    bg: 'bg-accent-base/10',
    label: 'Topic',
  },
  method: {
    border: 'border-t-accent-base',
    accent: 'text-accent-base',
    bg: 'bg-accent-base/10',
    label: 'Method',
  },
  population: {
    border: 'border-t-accent-base',
    accent: 'text-accent-base',
    bg: 'bg-accent-base/10',
    label: 'Population',
  },
  geography: {
    border: 'border-t-accent-base',
    accent: 'text-accent-base',
    bg: 'bg-accent-base/10',
    label: 'Geography',
  },
};

/**
 * PivotCard renders a single evidence-backed research pivot with
 * expandable rationale.
 */
export default function PivotCard({ pivot, index, onExplorePivot }: PivotCardProps) {
  const [expanded, setExpanded] = useState(false);
  const colors = DIMENSION_COLORS[pivot.targetGap] || DIMENSION_COLORS.topic;

  return (
    <div
      className={`surface-card border-t-2 ${colors.border} overflow-hidden transition-all`}
    >
      <div className="p-5">
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <span
            className={`text-xs font-bold px-2 py-0.5 rounded-md ${colors.bg} ${colors.accent}`}
          >
            Pivot {index + 1}
          </span>
          <span className={`text-xs font-medium ${colors.accent}`}>
            {colors.label}
          </span>
        </div>

        {/* Title */}
        <h4 className="text-base font-semibold text-text-primary mb-2">
          {pivot.title}
        </h4>

        {/* Description */}
        <p className="text-sm text-text-secondary leading-relaxed mb-3">
          {pivot.description}
        </p>

        <div className="flex flex-wrap items-center gap-3">
          {/* Expandable rationale */}
          <button
            onClick={() => setExpanded(!expanded)}
            aria-expanded={expanded}
            aria-controls={`pivot-rationale-${index}`}
            className={`text-xs font-medium ${colors.accent} hover:underline cursor-pointer flex items-center gap-1 transition-all min-h-[44px]`}
          >
            {expanded ? 'Hide rationale' : 'Why this works'}
            <svg
              className={`w-3 h-3 transition-transform ${expanded ? 'rotate-90' : ''}`}
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </button>

          {onExplorePivot && (
            <Button variant="secondary" size="sm" onClick={() => onExplorePivot(pivot)}>
              Explore Pivot
            </Button>
          )}
        </div>

        {expanded && (
          <div id={`pivot-rationale-${index}`} className="mt-1 pt-3 border-t border-border-subtle animate-fade-in">
            <p className="text-xs text-text-tertiary leading-relaxed italic">
              {pivot.rationale}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
