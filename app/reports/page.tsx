'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SavedReport } from '@/lib/types';
import { ownerIdHeaders } from '@/lib/ownerToken';

export default function ReportsPage() {
  const router = useRouter();
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    fetch('/api/reports', { headers: ownerIdHeaders() })
      .then((response) => {
        if (!response.ok) throw new Error('Failed to load reports');
        return response.json();
      })
      .then((data) => setReports(data.reports || []))
      .catch(() => setLoadError(true))
      .finally(() => setIsLoading(false));
  }, []);

  const openReport = (report: SavedReport) => {
    sessionStorage.setItem('researchlens_result', JSON.stringify(report.result));
    sessionStorage.setItem('researchlens_queries', JSON.stringify(report.queries));
    sessionStorage.setItem('researchlens_idea_data', JSON.stringify(report.idea));
    sessionStorage.setItem('researchlens_idea', report.idea.text);
    router.push('/results');
  };

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
      ) : loadError ? (
        <div className="surface-card p-8 text-center">
          <p className="text-sm font-semibold text-text-primary">
            Couldn&apos;t load your saved reports.
          </p>
          <p className="text-sm text-text-secondary mt-1">
            There was a problem reaching the server. Try refreshing the page.
          </p>
        </div>
      ) : reports.length > 0 ? (
        <div className="grid grid-cols-1 gap-4">
          {reports.map((report) => (
            <button
              key={report.id}
              type="button"
              onClick={() => openReport(report)}
              className="surface-card surface-card-hover p-5 text-left w-full cursor-pointer token-focus"
            >
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
                <span className="text-xs px-2 py-1 rounded-md bg-bg-secondary text-text-secondary border border-border-subtle whitespace-nowrap">
                  {report.result.overlapRisk} risk
                </span>
              </div>
              {report.result.studentSummary && (
                <p className="text-sm text-text-secondary mt-4">
                  {report.result.studentSummary}
                </p>
              )}
            </button>
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
