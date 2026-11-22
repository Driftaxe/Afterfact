'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import type { Report, ClaimResultItem } from '@/lib/contracts/report';
import type { EvidenceItem } from '@/lib/contracts/evidence';
import type { ClarificationQuestion } from '@/lib/contracts/clarification';
import { AnswerDocument } from './AnswerDocument';
import { ClaimList } from './ClaimList';
import { ClaimDetail } from './ClaimDetail';
import { ReportSummaryBar, type VerdictFilter } from './ReportSummaryBar';
import { ReportEmptyClaimsState, ReportPartialBanner } from './ReportStates';
import { ExportReport } from '@/components/ExportReport';
import { DagInspector, type SanitizedDagNode } from '@/components/DagInspector';
import { ReportErrorBoundary } from './ReportErrorBoundaries';

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
    for (const evi of (report.evidence || [])) {
      map.set(evi.id, evi);
    }
    return map;
  }, [report.evidence]);

  // Find currently selected claim item
  const selectedClaim = useMemo<ClaimResultItem | null>(() => {
    if (!selectedClaimId) return null;
    return report.claims.find((c) => c.id === selectedClaimId) || null;
  }, [report.claims, selectedClaimId]);

  // Find pending clarification relevant to the selected claim or overall run
  const activeClarification = useMemo(() => {
    const clarList = (report as unknown as { clarifications?: Array<{ id: string; claimId?: string; status: string; question?: string; questionDefinition?: unknown }> }).clarifications;
    if (!clarList || !Array.isArray(clarList)) return undefined;

    const pending = clarList.filter((c) => c.status === 'pending');
    if (pending.length === 0) return undefined;

    // Match selected claim, or use first pending
    const match = selectedClaim
      ? pending.find((c) => c.claimId === selectedClaim.claimId || c.claimId === selectedClaim.id)
      : null;

    const target = match || pending[0];
    if (!target) return undefined;

    const qd = target.questionDefinition as
      | { fieldId?: string; propertyKey?: string; label?: string; fieldType?: string; options?: Array<string | { value: string; label: string }> }
      | undefined;

    const questions: ClarificationQuestion[] = [];
    if (qd) {
      questions.push({
        questionId: qd.fieldId || target.id,
        propertyKey: qd.propertyKey || qd.fieldId || 'clarification_field',
        prompt: qd.label || target.question || 'Please provide required context:',
        reason: 'Material context is required to determine the factual truth of this claim.',
        fieldType: (qd.fieldType === 'select' ? 'select' : 'short_text') as 'select' | 'short_text',
        required: true,
        allowUnknown: true,
        options: qd.options
          ? qd.options.map((opt) => (typeof opt === 'string' ? { value: opt, label: opt } : opt))
          : undefined,
      });
    } else if (target.question) {
      questions.push({
        questionId: target.id,
        propertyKey: 'context_qualifier',
        prompt: target.question,
        reason: 'Material context is required to evaluate this claim.',
        fieldType: 'short_text',
        required: true,
        allowUnknown: true,
      });
    }

    return {
      clarificationId: target.id,
      questions,
    };
  }, [report, selectedClaim]);

  if (report.claims.length === 0) {
    return <ReportEmptyClaimsState answerText={report.answerText} onBack={onBack} />;
  }

  const isPartial = report.state === 'partial';
  const completedClaimsCount = report.claims.filter((c) => c.state === 'assessed').length;

  return (
    <div className={`w-full max-w-7xl mx-auto space-y-8 ${className}`}>
      {/* Editorial Dossier Header */}
      <div className="flex flex-col gap-4 border-b border-border-subtle/70 pb-6">
        {/* Top bar: Back breadcrumb & Quick actions */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {onBack ? (
              <button
                type="button"
                onClick={onBack}
                className="group inline-flex items-center gap-1.5 text-[11px] font-mono tracking-widest uppercase text-text-muted hover:text-text-primary transition-colors cursor-pointer focus-visible:outline-none"
              >
                <span className="transition-transform group-hover:-translate-x-0.5">←</span>
                <span>BACK TO COMPOSER</span>
              </button>
            ) : (
              <Link
                href="/app"
                className="group inline-flex items-center gap-1.5 text-[11px] font-mono tracking-widest uppercase text-text-muted hover:text-text-primary transition-colors focus-visible:outline-none"
              >
                <span className="transition-transform group-hover:-translate-x-0.5">←</span>
                <span>BACK TO COMPOSER</span>
              </Link>
            )}
            <span className="text-border-subtle select-none font-mono">/</span>
            <span className="font-mono text-[11px] tracking-widest uppercase text-text-muted">
              DOSSIER #{report.id.slice(0, 12)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <ExportReport report={report} />
          </div>
        </div>

        {/* Headline, Status & Technical Metadata Strip */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pt-1">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--af-sage)]" />
              <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-text-muted">
                TEMPORAL GROUND TRUTH AUDIT
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-sans text-3xl sm:text-4xl lg:text-[42px] font-normal tracking-heading text-text-primary leading-tight">
                Verification Report
              </h1>

              <span className="inline-flex items-center gap-1.5 rounded-xs bg-surface-raised border border-border-subtle px-2.5 py-1 text-xs font-mono text-text-secondary">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--af-sage)] animate-pulse" />
                Live Run
              </span>
            </div>
          </div>

          {/* Dossier Metadata Grid */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 py-2 px-3.5 rounded-lg border border-border-subtle bg-surface/50 backdrop-blur-xs text-xs font-mono text-text-muted">
            <div className="flex items-center gap-1.5">
              <span className="text-text-muted/70 uppercase text-[10px] tracking-wider">Run ID:</span>
              <code className="text-text-secondary font-semibold">{report.id}</code>
            </div>
            {report.asOfDate && (
              <div className="flex items-center gap-1.5">
                <span className="text-text-muted/70 uppercase text-[10px] tracking-wider">As of:</span>
                <span className="text-text-secondary">{report.asOfDate}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <span className="text-text-muted/70 uppercase text-[10px] tracking-wider">Mode:</span>
              <span className="capitalize text-text-secondary">{report.mode}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Active Clarification Alert Banner */}
      {activeClarification && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
          <div className="flex items-center gap-2 text-amber-500 font-semibold">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping inline-block" />
            <span className="uppercase tracking-wider">Awaiting Material Context Input</span>
          </div>
          <span className="text-text-secondary">
            Additional context parameters are required to finalize this verification. Please complete the form in the Claim Inspector panel.
          </span>
        </div>
      )}

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

      {/* Coordinated Dual-Column Editorial Split Layout:
          Left Column (col-span-5): Original Document + Sequenced Claims Index
          Right Column (col-span-7, sticky): Active Claim Forensic Inspection Dossier */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Source Document + Claims Index */}
        <div className="lg:col-span-5 space-y-6">
          <AnswerDocument
            answerText={report.answerText || ''}
            claims={report.claims}
            selectedClaimId={selectedClaimId}
            onSelectClaim={setSelectedClaimId}
          />

          <ClaimList
            claims={report.claims}
            selectedClaimId={selectedClaimId}
            onSelectClaim={setSelectedClaimId}
            activeFilter={activeFilter}
          />
        </div>

        {/* Right Column: Active Claim Forensic Inspection Dossier (Sticky on Desktop) */}
        <div className="lg:col-span-7 lg:sticky lg:top-24 space-y-6">
          <ClaimDetail
            claim={selectedClaim}
            evidenceMap={evidenceMap}
            clarification={activeClarification}
            runId={report.id}
            runState={report.state}
          />
        </div>
      </div>

      {/* Dynamic DAG Graph Inspector */}
      <ReportErrorBoundary>
        <DagInspector
          nodes={((report as unknown as { dagNodes?: SanitizedDagNode[] }).dagNodes) || []}
          totalNodes={((report as unknown as { dag?: { totalNodes?: number } }).dag)?.totalNodes}
          completedNodes={((report as unknown as { dag?: { completedNodes?: number } }).dag)?.completedNodes}
          defaultExpanded={false}
        />
      </ReportErrorBoundary>
    </div>
  );
}
