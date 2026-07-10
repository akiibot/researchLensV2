import React from 'react';

type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'error';

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: 'bg-bg-secondary text-text-secondary border-border-subtle',
  accent: 'bg-accent-base/10 text-accent-text border-accent-base/20',
  success: 'bg-status-success-bg text-status-success border-status-success/30',
  warning: 'bg-status-warning-bg text-status-warning border-status-warning/30',
  error: 'bg-status-error-bg text-status-error border-status-error/30',
};

/**
 * Shared badge/pill primitive for small labeled tags (risk levels, workflow
 * mode, counts, etc.) so the same visual role reads consistently everywhere.
 */
export default function Badge({
  tone = 'neutral',
  className = '',
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`rounded-md border px-2 py-1 text-xs font-medium ${TONE_CLASSES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
