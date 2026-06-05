/**
 * @file SearchForm Component
 *
 * The main input form for ResearchLens. Allows the student to:
 * - Describe their research idea in a textarea (max 500 chars)
 * - Select their academic field
 * - Select their academic level (Undergraduate/Master's/PhD)
 * - Toggle language (English/Bangla)
 *
 * Includes character count, validation, and clickable example idea chips.
 *
 * @component
 */

'use client';

import React, { useState, useEffect } from 'react';

/** Academic field options */
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

/** Academic level options with labels */
const LEVELS = [
  { value: 'undergraduate' as const, label: 'Undergraduate' },
  { value: 'masters' as const, label: "Master's" },
  { value: 'phd' as const, label: 'PhD' },
];

/** Example ideas as clickable chips */
const EXAMPLES = [
  'Social media use and exam anxiety in university students',
  'Remote work and employee productivity post-pandemic',
  'Machine learning in early disease detection',
];

/** Props for the SearchForm component */
interface SearchFormProps {
  /** Called when the form is submitted with a valid research idea */
  onSubmit: (data: {
    text: string;
    field: string;
    level: 'undergraduate' | 'masters' | 'phd';
    language: 'en' | 'bn';
  }) => void;
  /** Whether the form is currently submitting */
  isLoading: boolean;
  /** Optional pre-filled idea text (for "Refine Your Idea" flow) */
  initialIdea?: string;
}

const MAX_CHARS = 500;
const MIN_CHARS = 20;

/**
 * SearchForm renders the research idea input form with full validation,
 * field/level selectors, language toggle, and example idea chips.
 */
export default function SearchForm({
  onSubmit,
  isLoading,
  initialIdea,
}: SearchFormProps) {
  const [text, setText] = useState(initialIdea || '');
  const [field, setField] = useState('');
  const [level, setLevel] = useState<'undergraduate' | 'masters' | 'phd'>(
    'undergraduate'
  );
  const [language, setLanguage] = useState<'en' | 'bn'>('en');

  useEffect(() => {
    if (initialIdea) {
      setText(initialIdea);
    }
  }, [initialIdea]);

  const charCount = text.length;
  const isValid = charCount >= MIN_CHARS && charCount <= MAX_CHARS && field !== '';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || isLoading) return;
    onSubmit({ text, field, level, language });
  };

  const handleExampleClick = (example: string) => {
    setText(example);
    setLanguage('en');
  };

  const placeholderText =
    language === 'bn'
      ? 'আপনার গবেষণার ধারণা বর্ণনা করুন...'
      : 'Describe your research idea in a few sentences. For example: "I want to study how social media usage affects exam anxiety among university students in Bangladesh"';

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto">
      <div className="surface-card p-6 sm:p-8 space-y-6">
        {/* Textarea */}
        <div>
          <label
            htmlFor="research-idea"
            className="block text-sm font-medium text-text-secondary mb-2"
          >
            Your Research Idea
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

        {/* Example chips */}
        <div>
          <p className="text-xs text-text-tertiary mb-2">Try an example:</p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => handleExampleClick(example)}
                disabled={isLoading}
                className="text-xs px-3 py-1.5 min-h-[44px] min-w-[44px] rounded-full border border-border-subtle bg-bg-secondary text-text-secondary hover:text-accent-hover hover:border-accent-base/30 hover:bg-accent-base/5 transition-all disabled:opacity-50 cursor-pointer"
              >
                {example}
              </button>
            ))}
          </div>
        </div>

        {/* Field & Level Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Field selector */}
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
          </div>

          {/* Level selector */}
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
        </div>

        {/* Language toggle */}
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
              বাংলা
            </button>
          </div>
        </div>

        {/* Submit button */}
        <button
          type="submit"
          disabled={!isValid || isLoading}
          className={`w-full py-3.5 px-6 min-h-[44px] rounded-xl text-sm font-semibold transition-all cursor-pointer ${
            isValid && !isLoading
              ? 'bg-accent-base text-text-primary hover:bg-accent-hover shadow-lg shadow-accent-base/10 hover:shadow-accent-base/20'
              : 'bg-bg-tertiary text-text-tertiary cursor-not-allowed'
          }`}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <svg
                className="animate-spin-slow h-4 w-4"
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
              Analyzing...
            </span>
          ) : (
            'Analyze Research Gap →'
          )}
        </button>
      </div>
    </form>
  );
}
