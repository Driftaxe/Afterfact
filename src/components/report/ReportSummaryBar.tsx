'use client';

import React from 'react';
import type { ReportSummary, Verdict } from '@/lib/contracts/report';

export type VerdictFilter = 'all' | Verdict;

export interface ReportSummaryBarProps {
  summary: ReportSummary;
  activeFilter?: VerdictFilter;
  onFilterChange?: (filter: VerdictFilter) => void;
  className?: string;
}

export function ReportSummaryBar({
  summary,
  activeFilter = 'all',
  onFilterChange,
  className = '',
}: ReportSummaryBarProps) {
  const filters: { id: VerdictFilter; label: string; count: number; colorClass: string }[] = [
    {
      id: 'all',
      label: 'All Claims',
      count: summary.totalClaims,
      colorClass: 'text-text-primary',
    },
    {
      id: 'supported',
      label: 'Supported',
      count: summary.supported,
      colorClass: 'text-status-supported-text',
    },
    {
      id: 'outdated',
      label: 'Outdated',
      count: summary.outdated,
      colorClass: 'text-status-outdated-text',
    },
    {
      id: 'contradicted',
      label: 'Contradicted',
      count: summary.contradicted,
      colorClass: 'text-status-contradicted-text',
    },
    {
      id: 'depends_on_context',
      label: 'Unresolved',
      count: summary.unresolved,
      colorClass: 'text-status-unresolved-text',
    },
  ];

  return (
    <div
      className={`flex flex-wrap items-center gap-2 p-3 rounded-xl border border-border-subtle bg-surface/50 ${className}`}
      role="region"
      aria-label="Report claim summary"
    >
      <div className="text-xs font-medium text-text-muted mr-1 hidden sm:inline-block">
        Summary:
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {filters.map((f) => {
          const isSelected = activeFilter === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => onFilterChange && onFilterChange(f.id)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
                isSelected
                  ? 'bg-surface-raised border border-border-strong text-text-primary shadow-sm'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface'
              }`}
              aria-pressed={isSelected}
            >
              <span className={f.colorClass}>{f.label}</span>
              <span className="rounded-full bg-surface-raised px-1.5 py-0.2 text-[11px] font-mono text-text-muted">
                {f.count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
