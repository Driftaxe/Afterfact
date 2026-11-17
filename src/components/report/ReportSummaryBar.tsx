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
      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 sm:p-4 rounded-xl border border-border-subtle/80 bg-surface/50 backdrop-blur-xs ${className}`}
      role="region"
      aria-label="Report claim summary"
    >
      <div className="flex items-center gap-2.5">
        <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-text-muted">
          FILTER ASSERTIONS:
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {filters.map((f) => {
          const isSelected = activeFilter === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => onFilterChange && onFilterChange(f.id)}
              className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xs border text-xs font-mono transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus-ring ${
                isSelected
                  ? 'border-border-strong bg-surface-raised text-text-primary shadow-xs font-medium'
                  : 'border-border-subtle/60 bg-surface/30 hover:border-border-strong/60 hover:bg-surface-raised/40 text-text-muted hover:text-text-primary'
              }`}
              aria-pressed={isSelected}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${
                f.id === 'supported'
                  ? 'bg-[var(--af-sage)]'
                  : f.id === 'outdated'
                  ? 'bg-status-outdated-text'
                  : f.id === 'contradicted'
                  ? 'bg-status-contradicted-text'
                  : f.id === 'depends_on_context'
                  ? 'bg-status-unresolved-text'
                  : 'bg-text-muted'
              }`} />
              <span className={isSelected ? 'text-text-primary' : f.colorClass}>{f.label}</span>
              <span className="rounded-xs bg-surface-raised px-1.5 py-0.2 text-[10px] font-mono text-text-muted border border-border-subtle/50">
                {f.count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
