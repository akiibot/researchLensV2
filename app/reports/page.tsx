'use client';

import React, { useEffect, useState } from 'react';
import { SavedReport } from '@/lib/types';

export default function ReportsPage() {
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/reports')
      .then((response) => response.json())
      .then((data) => setReports(data.reports || []))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <div className="mb-8">
        <p className="text-xs uppercase tracking-wide text-accent-base font-semibold mb-2">
          Saved Reports
        </p>
        <h2 className="text-2xl sm:text-3xl font-bold text-text-primary">
          Browse saved research analyses
        </h2>
        <p className="text-sm text-text-secondary mt-2">
          Reports are saved after each completed analysis when Supabase is configured.
        </p>
      </div>

      {isLoading ? (
        <div className="skeleton h-48" />
      ) : reports.length > 0 ? (
        <div className="grid grid-cols-1 gap-4">
          {reports.map((report) => (
            <article key={report.id} className="surface-card p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-accent-base font-semibold mb-2">
                    {report.idea.mode || 'student'} workflow
                  </p>
                  <h3 className="text-base font-semibold text-text-primary">
                    {report.idea.text}
                  </h3>
                  <p className="text-xs text-text-secondary mt-2">
                    {report.idea.field} - {report.idea.level} -{' '}
                    {new Date(report.createdAt).toLocaleString()}
                  </p>
                </div>
                <span className="text-xs px-2 py-1 rounded-md bg-bg-secondary text-text-secondary border border-border-subtle">
                  {report.result.overlapRisk} risk
                </span>
              </div>
              {report.result.studentSummary && (
                <p className="text-sm text-text-secondary mt-4">
                  {report.result.studentSummary}
                </p>
              )}
            </article>
          ))}
        </div>
      ) : (
        <div className="surface-card p-8 text-center">
          <p className="text-sm text-text-secondary">
            No reports have been saved yet.
          </p>
        </div>
      )}
    </div>
  );
}
