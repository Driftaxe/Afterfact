'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import type { Report, ClaimResultItem } from '@/lib/contracts/report';
import type { EvidenceItem } from '@/lib/contracts/evidence';
import { AnswerDocument } from './AnswerDocument';
import { ClaimList } from './ClaimList';
import { ClaimDetail } from './ClaimDetail';
import { ReportSummaryBar, type VerdictFilter } from './ReportSummaryBar';
import { ReportEmptyClaimsState, ReportPartialBanner } from './ReportStates';

export interface ReportViewProps {
  report: Report;
  onBack?: () => void;
  className?: string;
}

export function ReportView({ report, onBack, className = '' }: ReportViewProps) {
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(
    report.claims[0]?.id || null
  );
  const [activeFilter, setActiveFilter] = useState<VerdictFilter>('all');

  // Pre-index evidence by ID for instant O(1) lookups
  const evidenceMap = useMemo(() => {
    const map = new Map<string, EvidenceItem>();
    for (const evi of report.evidence) {
      map.set(evi.id, evi);
    }
    return map;
  }, [report.evidence]);

  // Find currently selected claim item
  const selectedClaim = useMemo<ClaimResultItem | null>(() => {
    if (!selectedClaimId) return null;
    return report.claims.find((c) => c.id === selectedClaimId) || null;
  }, [report.claims, selectedClaimId]);

  if (report.claims.length === 0) {
    return <ReportEmptyClaimsState answerText={report.answerText} onBack={onBack} />;
  }

  const isPartial = report.state === 'partial';
  const completedClaimsCount = report.claims.filter((c) => c.state === 'assessed').length;

  return (
    <div className={`w-full max-w-7xl mx-auto space-y-6 ${className}`}>
      {/* Report Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border-subtle">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-normal tracking-heading text-text-primary">
              Verification Report
            </h1>

            {report.isReplay ? (
              <span className="inline-flex items-center rounded-md bg-status-outdated-bg/80 border border-status-outdated-border px-2.5 py-0.5 text-xs font-mono font-medium text-status-outdated-text">
                Sample report · Not a live verification
              </span>
            ) : (
              <span className="inline-flex items-center rounded-md bg-surface-raised px-2 py-0.5 text-xs font-mono text-text-secondary">
                Live Run
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-muted">
            <span>
              Run ID: <code className="font-mono text-text-secondary">{report.id}</code>
            </span>
            {report.asOfDate && (
              <span>
                As of Date: <span className="font-mono text-text-secondary">{report.asOfDate}</span>
              </span>
            )}
            <span>
              Mode: <span className="capitalize text-text-secondary">{report.mode}</span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center justify-center h-9 px-4 rounded-lg border border-border-subtle bg-surface text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-surface-raised transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            >
              ← Back to Composer
            </button>
          ) : (
            <Link
              href="/"
              className="inline-flex items-center justify-center h-9 px-4 rounded-lg border border-border-subtle bg-surface text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-surface-raised transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            >
              ← Back to Composer
            </Link>
          )}
        </div>
      </div>

      {/* Partial State Banner */}
      {isPartial && (
        <ReportPartialBanner
          completedCount={completedClaimsCount}
          totalCount={report.claims.length}
        />
      )}

      {/* Summary Chips & Filter Bar */}
      <ReportSummaryBar
        summary={report.summary}
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
      />

      {/* 55:45 Coordinated Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column (55% on desktop): Answer Document with interactive spans */}
        <div className="lg:col-span-7 space-y-6">
          <AnswerDocument
            answerText={report.answerText || ''}
            claims={report.claims}
            selectedClaimId={selectedClaimId}
            onSelectClaim={setSelectedClaimId}
          />
        </div>

        {/* Right Column (45% on desktop): Claim List + Selected Detail Panel */}
        <div className="lg:col-span-5 space-y-6">
          <ClaimList
            claims={report.claims}
            selectedClaimId={selectedClaimId}
            onSelectClaim={setSelectedClaimId}
            activeFilter={activeFilter}
          />

          <ClaimDetail claim={selectedClaim} evidenceMap={evidenceMap} />
        </div>
      </div>
    </div>
  );
}
