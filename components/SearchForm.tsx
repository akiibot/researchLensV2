'use client';

import React, { useEffect, useState } from 'react';
import {
  AppMode,
  EvidenceScope,
  PivotExplorationContext,
  ResearchIdea,
  RetrievalDepth,
  RetrievalSource,
} from '@/lib/types';

const FIELDS = [
  'Education',
  'Social Sciences',
  'Computer Science',
  'Business',
  'Engineering',
  'Medicine',
  'Psychology',
  'Environmental Science',
  'Other',
];

const LEVELS = [
  { value: 'undergraduate' as const, label: 'Undergraduate' },
  { value: 'masters' as const, label: "Master's" },
  { value: 'phd' as const, label: 'PhD' },
];

const EXAMPLES = [
  'Social media use and exam anxiety in university students',
  'Remote work and employee productivity post-pandemic',
  'Machine learning in early disease detection',
];

interface SearchFormProps {
  onSubmit: (data: {
    text: string;
    field: string;
    level: 'undergraduate' | 'masters' | 'phd';
    language: 'en' | 'bn';
    mode: AppMode;
    evidenceScope: EvidenceScope;
    retrievalDepth: RetrievalDepth;
    enabledSources: RetrievalSource[];
  }) => void;
  isLoading: boolean;
  initialIdea?: string;
  initialIdeaData?: ResearchIdea;
  mode: AppMode;
  onModeChange?: (mode: AppMode) => void;
  pivotContext?: PivotExplorationContext | null;
}

const MAX_CHARS = 500;
const MIN_CHARS = 20;

const SOURCE_OPTIONS: Array<{
  id: RetrievalSource;
  label: string;
  helper: string;
  defaultOn: boolean;
}> = [
  {
    id: 'openalex',
    label: 'OpenAlex',
    helper: 'Broad scholarly index',
    defaultOn: true,
  },
  {
    id: 'semanticscholar',
    label: 'Semantic Scholar',
    helper: 'Citation and CS-heavy coverage',
    defaultOn: true,
  },
  {
    id: 'datacite',
    label: 'DataCite',
    helper: 'Theses, reports, datasets',
    defaultOn: true,
  },
  {
    id: 'core',
    label: 'CORE',
    helper: 'OA repository records',
    defaultOn: true,
  },
  {
    id: 'pubmed',
    label: 'PubMed',
    helper: 'Biomedical literature',
    defaultOn: true,
  },
  {
    id: 'arxiv',
    label: 'arXiv',
    helper: 'Recent preprints',
    defaultOn: true,
  },
  {
    id: 'europepmc',
    label: 'Europe PMC',
    helper: 'Life science expansion',
    defaultOn: false,
  },
];

const FAST_SOURCES: RetrievalSource[] = ['openalex', 'datacite', 'core'];
const BALANCED_SOURCES: RetrievalSource[] = SOURCE_OPTIONS
  .filter((source) => source.defaultOn)
  .map((source) => source.id);
const FULL_SOURCES: RetrievalSource[] = SOURCE_OPTIONS.map((source) => source.id);

const EVIDENCE_SCOPE_OPTIONS: Array<{
  id: EvidenceScope;
  label: string;
  helper: string;
}> = [
  {
    id: 'balanced',
    label: 'Balanced',
    helper: 'Lightly prefers local evidence while keeping global papers.',
  },
  {
    id: 'strict_local',
    label: 'Strict local',
    helper: 'Prioritizes papers that preserve detected geography.',
  },
  {
    id: 'global_first',
    label: 'Global first',
    helper: 'Maps the worldwide literature before judging local novelty.',
  },
  {
    id: 'geography_independent',
    label: 'Geo-independent',
    helper: 'Ignores place terms when ranking papers.',
  },
  {
    id: 'compare_local_global',
    label: 'Compare local/global',
    helper: 'Reports whether the topic is global but locally underexplored.',
  },
];

export default function SearchForm({
  onSubmit,
  isLoading,
  initialIdea,
  initialIdeaData,
  mode,
  onModeChange,
  pivotContext,
}: SearchFormProps) {
  const [text, setText] = useState(initialIdea || '');
  const [field, setField] = useState('');
  const [level, setLevel] = useState<'undergraduate' | 'masters' | 'phd'>(
    'undergraduate'
  );
  const [language, setLanguage] = useState<'en' | 'bn'>('en');
  const [evidenceScope, setEvidenceScope] =
    useState<EvidenceScope>('balanced');
  const [retrievalDepth, setRetrievalDepth] =
    useState<RetrievalDepth>('balanced');
  const [enabledSources, setEnabledSources] =
    useState<RetrievalSource[]>(BALANCED_SOURCES);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (initialIdea) {
      queueMicrotask(() => setText(initialIdea));
    }
  }, [initialIdea]);

  useEffect(() => {
    if (!initialIdeaData) return;

    queueMicrotask(() => {
      setField(initialIdeaData.field || '');
      setLevel(initialIdeaData.level || 'undergraduate');
      setLanguage(initialIdeaData.language || 'en');
      setEvidenceScope(initialIdeaData.evidenceScope || 'balanced');
      if (initialIdeaData.evidenceScope && initialIdeaData.evidenceScope !== 'balanced') {
        setShowAdvanced(true);
      }
    });
  }, [initialIdeaData]);

  const charCount = text.length;
  const isValid = charCount >= MIN_CHARS && charCount <= MAX_CHARS && field !== '';

  const title = mode === 'faculty' ? 'Faculty Search Topic' : 'Your Research Idea';
  const helper =
    mode === 'faculty'
      ? 'Describe the topic, method, population, or subject area you want to review.'
      : 'Describe the thesis idea you want to validate and find potential supervisors for.';
  const placeholderText =
    language === 'bn'
      ? 'আপনার গবেষণার ধারণা বা বিষয় লিখুন...'
      : mode === 'faculty'
        ? 'For example: AI tools for formative assessment in higher education'
        : 'For example: I want to study how social media usage affects exam anxiety among university students in Bangladesh';
  const submitLabel =
    mode === 'faculty' ? 'Review Topic and Researchers' : 'Analyze Gap and Find Supervisors';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || isLoading) return;
    onSubmit({
      text,
      field,
      level,
      language,
      mode,
      evidenceScope,
      retrievalDepth,
      enabledSources,
    });
  };

  const applyDepth = (depth: RetrievalDepth) => {
    setRetrievalDepth(depth);
    if (depth === 'fast') setEnabledSources(FAST_SOURCES);
    if (depth === 'balanced') setEnabledSources(BALANCED_SOURCES);
    if (depth === 'full') setEnabledSources(FULL_SOURCES);
  };

  const toggleSource = (source: RetrievalSource) => {
    setRetrievalDepth('custom');
    setEnabledSources((current) => {
      if (current.includes(source)) {
        const next = current.filter((item) => item !== source);
        return next.length > 0 ? next : current;
      }
      return [...current, source];
    });
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto">
      <div className="surface-card p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex gap-2" role="group" aria-label="Workflow">
              {(
                [
                  { value: 'student' as const, label: 'Student workflow' },
                  { value: 'faculty' as const, label: 'Faculty workflow' },
                ]
              ).map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={mode === value}
                  onClick={() => onModeChange?.(value)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-all cursor-pointer ${
                    mode === value
                      ? 'bg-accent-base/20 border border-accent-base/40 text-accent-text'
                      : 'bg-bg-secondary border border-border-subtle text-text-secondary hover:text-text-primary hover:border-border-strong'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {pivotContext && (
              <div className="mt-3 rounded-lg border border-accent-base/20 bg-accent-base/10 px-3 py-2">
                <p className="text-xs font-medium text-accent-text">
                  Exploring pivot from previous report: {pivotContext.pivotTitle}
                </p>
                <p className="text-xs text-text-tertiary mt-1">
                  Target gap: {pivotContext.targetGap}
                </p>
              </div>
            )}
            <p className="text-xs text-text-tertiary mt-2">{helper}</p>
          </div>
        </div>

        <div>
          <label
            htmlFor="research-idea"
            className="block text-sm font-medium text-text-secondary mb-2"
          >
            {title}
          </label>
          <textarea
            id="research-idea"
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, MAX_CHARS))}
            placeholder={placeholderText}
            rows={4}
            disabled={isLoading}
            className="w-full bg-bg-tertiary border border-border-subtle rounded-xl px-4 py-3 text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent-base/50 focus:border-accent-base/50 transition-all resize-none disabled:opacity-50"
          />
          <div className="flex justify-between items-center mt-1.5">
            <p className="text-xs text-text-tertiary">
              {charCount < MIN_CHARS && charCount > 0
                ? `At least ${MIN_CHARS} characters required`
                : ''}
            </p>
            <p
              className={`text-xs font-mono ${
                charCount > MAX_CHARS * 0.9
                  ? 'text-status-warning'
                  : charCount > MAX_CHARS * 0.75
                    ? 'text-text-secondary'
                    : 'text-text-tertiary'
              }`}
            >
              {charCount}/{MAX_CHARS}
            </p>
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-text-secondary mb-2">Try Examples:</p>
          <div className="flex flex-col gap-2">
            {EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => {
                  setText(example);
                  setLanguage('en');
                }}
                disabled={isLoading}
                className="w-full min-h-[44px] rounded-lg border border-border-subtle bg-bg-secondary px-4 py-2 text-left text-sm text-text-secondary hover:text-accent-hover hover:border-accent-base/30 hover:bg-accent-base/5 transition-all disabled:opacity-50 cursor-pointer"
              >
                {example}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Academic Level
            </label>
            <div className="flex gap-2">
              {LEVELS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={level === value}
                  onClick={() => setLevel(value)}
                  disabled={isLoading}
                  className={`flex-1 min-h-[44px] px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all cursor-pointer ${
                    level === value
                      ? 'bg-accent-base/20 border border-accent-base/40 text-accent-text'
                      : 'bg-bg-secondary border border-border-subtle text-text-secondary hover:text-text-primary hover:border-border-strong'
                  } disabled:opacity-50`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label
              htmlFor="field-select"
              className="block text-sm font-medium text-text-secondary mb-2"
            >
              Academic Field
            </label>
            <select
              id="field-select"
              value={field}
              onChange={(e) => setField(e.target.value)}
              disabled={isLoading}
              className="w-full min-h-[44px] bg-bg-tertiary border border-border-subtle rounded-xl px-4 py-2.5 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-base/50 focus:border-accent-base/50 transition-all disabled:opacity-50 appearance-none cursor-pointer"
            >
              <option value="" disabled>
                Select field...
              </option>
              {FIELDS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
            {field === '' && charCount >= MIN_CHARS && (
              <p className="mt-1.5 text-xs text-status-warning">
                Select a field to continue.
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-text-secondary">
            Input Language
          </label>
          <div className="flex items-center gap-1 bg-bg-secondary border border-border-subtle rounded-lg p-1">
            <button
              type="button"
              aria-pressed={language === 'en'}
              onClick={() => setLanguage('en')}
              disabled={isLoading}
              className={`min-h-[44px] min-w-[64px] px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                language === 'en'
                  ? 'bg-accent-base/20 text-accent-text'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              English
            </button>
            <button
              type="button"
              aria-pressed={language === 'bn'}
              onClick={() => setLanguage('bn')}
              disabled={isLoading}
              className={`min-h-[44px] min-w-[64px] px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                language === 'bn'
                  ? 'bg-accent-base/20 text-accent-text'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Bangla
            </button>
          </div>
        </div>

        <div>
          <button
            type="button"
            onClick={() => setShowAdvanced((current) => !current)}
            aria-expanded={showAdvanced}
            aria-controls="advanced-options"
            className="flex w-full items-center justify-between rounded-xl border border-border-subtle bg-bg-secondary px-4 py-3 text-sm font-medium text-text-secondary transition-all cursor-pointer hover:border-border-strong hover:text-text-primary"
          >
            <span>Advanced options</span>
            <svg
              className={`h-4 w-4 transition-transform ${showAdvanced ? 'rotate-90' : ''}`}
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

          {showAdvanced && (
            <div id="advanced-options" className="mt-3 space-y-3 animate-fade-in">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Evidence Scope
                </label>
                <select
                  value={evidenceScope}
                  onChange={(event) =>
                    setEvidenceScope(event.target.value as EvidenceScope)
                  }
                  disabled={isLoading}
                  className="w-full min-h-[44px] bg-bg-tertiary border border-border-subtle rounded-xl px-4 py-2.5 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-base/50 focus:border-accent-base/50 transition-all disabled:opacity-50 appearance-none cursor-pointer"
                >
                  {EVIDENCE_SCOPE_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-text-tertiary mt-2">
                  {
                    EVIDENCE_SCOPE_OPTIONS.find(
                      (option) => option.id === evidenceScope
                    )?.helper
                  }
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Source Coverage
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['fast', 'balanced', 'full'] as const).map((depth) => (
                    <button
                      key={depth}
                      type="button"
                      aria-pressed={retrievalDepth === depth}
                      onClick={() => applyDepth(depth)}
                      disabled={isLoading}
                      className={`min-h-[44px] rounded-xl px-3 py-2 text-xs font-medium capitalize transition-all cursor-pointer ${
                        retrievalDepth === depth
                          ? 'bg-accent-base/20 border border-accent-base/40 text-accent-text'
                          : 'bg-bg-secondary border border-border-subtle text-text-secondary hover:text-text-primary hover:border-border-strong'
                      } disabled:opacity-50`}
                    >
                      {depth}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-text-tertiary mt-2">
                  Fast skips rate-limited citation and specialist databases. Full checks every configured source.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {SOURCE_OPTIONS.map((source) => (
                  <label
                    key={source.id}
                    className="flex items-start gap-3 rounded-xl border border-border-subtle bg-bg-secondary px-3 py-3 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={enabledSources.includes(source.id)}
                      onChange={() => toggleSource(source.id)}
                      disabled={isLoading}
                      className="mt-1"
                    />
                    <span>
                      <span className="block text-xs font-medium text-text-primary">
                        {source.label}
                      </span>
                      <span className="block text-xs text-text-tertiary">
                        {source.helper}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={!isValid || isLoading}
          className={`w-full py-3.5 px-6 min-h-[44px] rounded-xl text-sm font-semibold transition-all cursor-pointer ${
            isValid && !isLoading
              ? 'bg-accent-base text-text-primary hover:bg-accent-hover shadow-lg shadow-accent-base/10 hover:shadow-accent-base/20'
              : 'bg-bg-tertiary text-text-tertiary cursor-not-allowed'
          }`}
        >
          {isLoading ? 'Analyzing...' : submitLabel}
        </button>
      </div>
    </form>
  );
}
