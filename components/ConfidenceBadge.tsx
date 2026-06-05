/**
 * @file ConfidenceBadge Component
 *
 * Displays a single confidence/risk badge with color coding:
 * - Risk type: HIGH=red, MEDIUM=amber, LOW=green
 * - Confidence type: HIGH=green, MEDIUM=amber, LOW=red
 * - Novelty type: STRONG=green, MODERATE=amber, WEAK=red
 *
 * Shows a "basis line" on hover with additional context.
 *
 * @component
 */

'use client';

import React, { useState } from 'react';

interface ConfidenceBadgeProps {
  /** Display label (e.g., "Overlap Risk") */
  label: string;
  /** Value text (e.g., "HIGH") */
  value: string;
  /** Badge type determines color logic */
  type: 'risk' | 'confidence' | 'novelty';
  /** Additional context shown on hover */
  basisText?: string;
}

/**
 * Returns the appropriate color classes based on badge type and value.
 */
function getColorClasses(
  type: 'risk' | 'confidence' | 'novelty',
  value: string
): { bg: string; text: string; border: string; glow: string } {
  const v = value.toLowerCase();

  if (type === 'risk') {
    if (v === 'high') return { bg: 'bg-status-error-bg/30', text: 'text-status-error', border: 'border-status-error/20', glow: 'shadow-none' };
    if (v === 'medium') return { bg: 'bg-status-warning-bg/30', text: 'text-status-warning', border: 'border-status-warning/20', glow: 'shadow-none' };
    return { bg: 'bg-status-success-bg/30', text: 'text-status-success', border: 'border-status-success/20', glow: 'shadow-none' };
  }

  if (type === 'confidence') {
    if (v === 'high') return { bg: 'bg-status-success-bg/30', text: 'text-status-success', border: 'border-status-success/20', glow: 'shadow-none' };
    if (v === 'medium') return { bg: 'bg-status-warning-bg/30', text: 'text-status-warning', border: 'border-status-warning/20', glow: 'shadow-none' };
    return { bg: 'bg-status-error-bg/30', text: 'text-status-error', border: 'border-status-error/20', glow: 'shadow-none' };
  }

  // novelty
  if (v === 'strong') return { bg: 'bg-status-success-bg/30', text: 'text-status-success', border: 'border-status-success/20', glow: 'shadow-none' };
  if (v === 'moderate') return { bg: 'bg-status-warning-bg/30', text: 'text-status-warning', border: 'border-status-warning/20', glow: 'shadow-none' };
  return { bg: 'bg-status-error-bg/30', text: 'text-status-error', border: 'border-status-error/20', glow: 'shadow-none' };
}

/**
 * ConfidenceBadge renders a labeled badge with color coding and hover detail.
 */
export default function ConfidenceBadge({
  label,
  value,
  type,
  basisText,
}: ConfidenceBadgeProps) {
  const [showBasis, setShowBasis] = useState(false);
  const colors = getColorClasses(type, value);

  return (
    <div
      className={`relative flex-1 min-w-[140px] ${colors.bg} ${colors.border} border rounded-xl p-4 cursor-pointer transition-all hover:shadow-md ${colors.glow}`}
      onMouseEnter={() => setShowBasis(true)}
      onMouseLeave={() => setShowBasis(false)}
      onClick={() => setShowBasis(!showBasis)}
    >
      <p className="text-xs text-text-secondary font-medium mb-1">{label}</p>
      <p className={`text-lg font-bold ${colors.text} uppercase tracking-wide`}>
        {value}
      </p>

      {/* Basis text tooltip */}
      {showBasis && basisText && (
        <div className="absolute left-0 right-0 -bottom-10 z-10 px-3 py-2 bg-bg-secondary border border-border-subtle rounded-lg shadow-xl animate-fade-in">
          <p className="text-xs text-text-primary whitespace-nowrap">{basisText}</p>
        </div>
      )}
    </div>
  );
}
