/**
 * @file GapMatrix Component
 *
 * Displays the four-dimension gap matrix as a visual 2×2 grid.
 * - Crowded: red/orange gradient background
 * - Moderate: amber/yellow background
 * - Open: green background with "GAP" indicator
 * Clicking a cell expands the evidence detail.
 *
 * @component
 */

'use client';

import React, { useState } from 'react';
import { GapDimension } from '@/lib/types';

interface GapMatrixProps {
  gaps: GapDimension[];
}

/** Dimension display config */
const DIMENSION_CONFIG: Record<
  string,
  { icon: string; label: string; color: string }
> = {
  topic: { icon: 'T', label: 'Topic', color: 'indigo' },
  method: { icon: 'M', label: 'Method', color: 'purple' },
  population: { icon: 'P', label: 'Population', color: 'teal' },
  geography: { icon: 'G', label: 'Geography', color: 'orange' },
};

/** Saturation color config */
function getSaturationStyles(saturation: string): {
  bg: string;
  badge: string;
  badgeText: string;
  label: string;
} {
  switch (saturation) {
    case 'crowded':
      return {
        bg: 'bg-status-error-bg/30 border-status-error/20 hover:bg-status-error-bg/50',
        badge: 'bg-status-error-bg',
        badgeText: 'text-status-error',
        label: 'CROWDED',
      };
    case 'moderate':
      return {
        bg: 'bg-status-warning-bg/30 border-status-warning/20 hover:bg-status-warning-bg/50',
        badge: 'bg-status-warning-bg',
        badgeText: 'text-status-warning',
        label: 'MODERATE',
      };
    case 'open':
      return {
        bg: 'bg-status-success-bg/30 border-status-success/20 hover:bg-status-success-bg/50',
        badge: 'bg-status-success-bg',
        badgeText: 'text-status-success',
        label: 'OPEN',
      };
    default:
      return {
        bg: 'bg-bg-tertiary border-border-subtle',
        badge: 'bg-bg-secondary',
        badgeText: 'text-text-secondary',
        label: 'UNKNOWN',
      };
  }
}

/**
 * GapMatrix renders the four-dimension gap classification as a 2×2 grid.
 */
export default function GapMatrix({ gaps }: GapMatrixProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {gaps.map((gap) => {
        const config = DIMENSION_CONFIG[gap.dimension] || {
          icon: 'A',
          label: gap.dimension,
          color: 'slate',
        };
        const styles = getSaturationStyles(gap.saturation);
        const isExpanded = expandedId === gap.dimension;

        return (
          <button
            key={gap.dimension}
            onClick={() =>
              setExpandedId(isExpanded ? null : gap.dimension)
            }
            aria-expanded={isExpanded}
            aria-controls={`gap-evidence-${gap.dimension}`}
            className={`${styles.bg} border rounded-xl p-4 text-left transition-all cursor-pointer w-full min-h-[44px]`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">{config.icon}</span>
                <span className="text-sm font-semibold text-text-primary">
                  {config.label}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded-md ${styles.badge} ${styles.badgeText}`}
                >
                  {styles.label}
                </span>
                {gap.saturation === 'open' && (
                  <span className="text-xs text-status-success font-medium">
                    GAP
                  </span>
                )}
              </div>
            </div>

            <p className="text-xs text-text-secondary">
              {gap.paperCount} papers
            </p>

            {/* Expanded evidence */}
            {isExpanded && (
              <div id={`gap-evidence-${gap.dimension}`} className="mt-3 pt-3 border-t border-border-subtle animate-fade-in">
                <p className="text-xs text-text-primary leading-relaxed">
                  {gap.evidence}
                </p>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
