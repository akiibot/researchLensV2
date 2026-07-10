'use client';

import Link from 'next/link';

interface RouteErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function RouteError({ error, reset }: RouteErrorProps) {
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
      <p className="text-xs uppercase tracking-wide text-accent-base font-semibold mb-2">
        Something went wrong
      </p>
      <h2 className="text-2xl font-bold text-text-primary mb-3">
        This page hit an unexpected error
      </h2>
      <p className="text-sm text-text-secondary mb-6">
        {error.message || 'An unexpected error occurred while rendering this page.'}
      </p>
      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-lg bg-accent-base px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-lg border border-border-subtle px-4 py-2 text-sm font-semibold text-text-primary hover:bg-bg-tertiary"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}
