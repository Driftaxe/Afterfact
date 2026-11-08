'use client';

import React from 'react';
import type { ClaimResultItem } from '@/lib/contracts/report';
import { StatusBadge } from '@/components/ui/StatusBadge';
import type { VerdictFilter } from './ReportSummaryBar';

export interface ClaimListProps {
  claims: ClaimResultItem[];
  selectedClaimId: string | null;
  onSelectClaim: (claimId: string) => void;
  activeFilter?: VerdictFilter;
  className?: string;
}

export function ClaimList({
  claims,
  selectedClaimId,
  onSelectClaim,
  activeFilter = 'all',
  className = '',
}: ClaimListProps) {
  const filteredClaims = claims.filter((claim) => {
    if (activeFilter === 'all') return true;
    if (claim.state !== 'assessed') return false;
    if (activeFilter === 'depends_on_context') {
      return (
        claim.verdict === 'depends_on_context' ||
        claim.verdict === 'conflicting_evidence' ||
        claim.verdict === 'insufficient_evidence'
      );
    }
    return claim.verdict === activeFilter;
  });

  return (
    <div
      className={`space-y-2.5 ${className}`}
      role="listbox"
      aria-label="Extracted claim statements"
    >
      <div className="flex items-center justify-between pb-1">
        <h3 className="text-sm font-medium text-text-primary">
          Claims ({filteredClaims.length} of {claims.length})
        </h3>
        {activeFilter !== 'all' && (
          <span className="text-xs text-text-muted font-mono capitalize">
            Filtered: {activeFilter.replace(/_/g, ' ')}
          </span>
        )}
      </div>

      {filteredClaims.length === 0 ? (
        <div className="rounded-xl border border-border-subtle bg-surface p-4 text-center text-xs text-text-muted">
          No claims match the active filter.
        </div>
      ) : (
        filteredClaims.map((claim) => {
          const isSelected = selectedClaimId === claim.id;

          let verdictLabel: string = 'Pending';
          let verdictStatus = 'checking';
          let scoreText = '—';

          if (claim.state === 'assessed') {
            verdictStatus = claim.verdict;
            if (claim.verdict === 'supported') verdictLabel = 'Supported';
            else if (claim.verdict === 'outdated') verdictLabel = 'Outdated';
            else if (claim.verdict === 'contradicted') verdictLabel = 'Contradicted';
            else if (claim.verdict === 'depends_on_context') verdictLabel = 'Context Missing';
            else if (claim.verdict === 'conflicting_evidence') verdictLabel = 'Conflicting';
            else if (claim.verdict === 'insufficient_evidence') verdictLabel = 'Insufficient';

            scoreText = claim.score !== null ? `${claim.score}` : '—';
          } else if (claim.state === 'failed') {
            verdictStatus = 'unresolved';
            verdictLabel = 'Failed';
          }

          return (
            <div
              key={claim.id}
              onClick={() => onSelectClaim(claim.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectClaim(claim.id);
                }
              }}
              role="option"
              aria-selected={isSelected}
              tabIndex={0}
              className={`group cursor-pointer rounded-xl border p-3.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
                isSelected
                  ? 'border-border-strong bg-surface-raised shadow-sm ring-1 ring-border-strong'
                  : 'border-border-subtle bg-surface hover:border-border-strong/60 hover:bg-surface-raised/50'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-surface-raised text-[10px] font-mono font-medium text-text-muted border border-border-subtle">
                    {claim.ordinal + 1}
                  </span>
                  <StatusBadge status={verdictStatus} label={verdictLabel} size="sm" />
                </div>

                <div className="flex items-center gap-1.5 text-xs font-mono">
                  <span className="text-text-muted">Score:</span>
                  <span
                    className={`font-semibold ${
                      scoreText === '100' || scoreText === '75'
                        ? 'text-status-supported-text'
                        : scoreText === '0'
                        ? 'text-status-contradicted-text'
                        : 'text-text-secondary'
                    }`}
                  >
                    {scoreText}
                  </span>
                </div>
              </div>

              <p className="mt-2 text-xs font-medium text-text-primary leading-relaxed line-clamp-2">
                {claim.rawText}
              </p>

              {claim.state === 'assessed' && claim.scoreReason && (
                <p className="mt-1.5 text-[11px] text-text-muted line-clamp-1">
                  {claim.scoreReason}
                </p>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
