/**
 * @file LoadingSteps Component
 *
 * Displays a step-by-step animated progress indicator while the
 * retrieval + analysis pipeline runs. Each step activates with a
 * 1.5s stagger after the previous.
 *
 * @component
 */

'use client';

import React, { useState, useEffect } from 'react';

/** Pipeline steps with labels */
const PIPELINE_STEPS = [
  { id: 'expand', label: 'Expanding your research idea into search queries...' },
  { id: 'openalex', label: 'Searching OpenAlex (250M+ papers)...' },
  { id: 'semantic', label: 'Searching Semantic Scholar (214M+ papers)...' },
  { id: 'pubmed', label: 'Searching PubMed biomedical literature...' },
  { id: 'preprints', label: 'Checking arXiv and Europe PMC for recent work...' },
  { id: 'datacite', label: 'Retrieving thesis & dissertation records...' },
  { id: 'dedup', label: 'Deduplicating and ranking by similarity...' },
  { id: 'gap', label: 'Building gap matrix...' },
  { id: 'faculty', label: 'Finding relevant faculty and researchers...' },
  { id: 'analyze', label: 'Generating evidence-backed pivots...' },
];

/**
 * Check icon SVG for completed steps.
 */
function CheckIcon() {
  return (
    <svg
      className="w-4 h-4 text-emerald-400 animate-check-pop"
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path
        fillRule="evenodd"
        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/**
 * Spinner icon SVG for the currently active step.
 */
function SpinnerIcon() {
  return (
    <svg
      className="w-4 h-4 text-indigo-400 animate-spin-slow"
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
        strokeDasharray="32"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * LoadingSteps renders an animated multi-step progress indicator.
 * Steps activate sequentially with 1.5s stagger timing.
 */
export default function LoadingSteps() {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIndex((prev) => {
        if (prev >= PIPELINE_STEPS.length - 1) return prev;
        return prev + 1;
      });
    }, 1500);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full max-w-lg mx-auto">
      <div className="surface-card p-6 sm:p-8">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 mb-3">
            <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
            <span className="text-xs font-medium text-indigo-300">
              Analysis in Progress
            </span>
          </div>
          <p className="text-sm text-slate-400">
            Searching real academic databases...
          </p>
        </div>

        {/* Steps */}
        <div className="space-y-3">
          {PIPELINE_STEPS.map((step, index) => {
            const isComplete = index < activeIndex;
            const isActive = index === activeIndex;
            const isPending = index > activeIndex;

            return (
              <div
                key={step.id}
                className={`flex items-center gap-3 py-2 px-3 rounded-lg transition-all duration-500 ${
                  isComplete
                    ? 'bg-emerald-500/5 border border-emerald-500/10'
                    : isActive
                      ? 'bg-indigo-500/5 border border-indigo-500/20'
                      : 'border border-transparent'
                }`}
                style={{
                  opacity: isPending ? 0.3 : 1,
                  transform: isPending
                    ? 'translateX(8px)'
                    : 'translateX(0)',
                  transition: 'all 0.5s ease',
                }}
              >
                {/* Icon */}
                <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
                  {isComplete ? (
                    <CheckIcon />
                  ) : isActive ? (
                    <SpinnerIcon />
                  ) : (
                    <div className="w-2 h-2 rounded-full bg-slate-600" />
                  )}
                </div>

                {/* Label */}
                <span
                  className={`text-sm transition-colors duration-300 ${
                    isComplete
                      ? 'text-emerald-300'
                      : isActive
                        ? 'text-white'
                        : 'text-slate-600'
                  }`}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Progress bar */}
        <div className="mt-6 h-1 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 rounded-full transition-all duration-700 ease-out"
            style={{
              width: `${((activeIndex + 1) / PIPELINE_STEPS.length) * 100}%`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
