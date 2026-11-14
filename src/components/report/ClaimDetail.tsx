'use client';

import React from 'react';
import type { ClaimResultItem } from '@/lib/contracts/report';
import type { EvidenceItem } from '@/lib/contracts/evidence';
import type { ClarificationQuestion } from '@/lib/contracts/clarification';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EvidenceCard } from './EvidenceCard';
import { ClarificationForm } from './ClarificationForm';
import { ChangeTimeline } from './ChangeTimeline';
import { ScheduledChangeBadge } from './ScheduledChangeBadge';

/**
 * Context data required to render an inline clarification form within a claim detail.
 * 'waiting_for_input' is a DAG Node state, not a ClaimResultItem state.
 * The parent (LiveReportViewer / ReportView) is responsible for passing this
 * context when it detects the DAG branch is waiting_for_input.
 */
export interface ClaimClarificationContext {
  clarificationId: string;
  questions: ClarificationQuestion[];
}

export interface ClaimDetailProps {
  claim: ClaimResultItem | null;
  evidenceMap: Map<string, EvidenceItem>;
  clarification?: ClaimClarificationContext;
  onClarificationSuccess?: () => void;
  className?: string;
}

export function ClaimDetail({ claim, evidenceMap, clarification, onClarificationSuccess, className = '' }: ClaimDetailProps) {
  if (!claim) {
    return (
      <div className={`rounded-2xl border border-border-subtle bg-surface p-6 text-center text-xs text-text-muted ${className}`}>
        Select a claim or answer highlight to inspect detailed evidence.
      </div>
    );
  }

  let verdictStatus = 'checking';
  let verdictLabel = 'Pending';
  let scoreText = '—';
  let scoreClass = 'text-text-muted';

  if (claim.state === 'assessed') {
    verdictStatus = claim.verdict;
    if (claim.verdict === 'supported') verdictLabel = 'Supported';
    else if (claim.verdict === 'outdated') verdictLabel = 'Outdated';
    else if (claim.verdict === 'contradicted') verdictLabel = 'Contradicted';
    else if (claim.verdict === 'depends_on_context') verdictLabel = 'Depends on Context';
    else if (claim.verdict === 'conflicting_evidence') verdictLabel = 'Conflicting Evidence';
    else if (claim.verdict === 'insufficient_evidence') verdictLabel = 'Insufficient Evidence';

    if (claim.score !== null) {
      scoreText = `${claim.score}`;
      if (claim.score === 100 || claim.score === 75) scoreClass = 'text-status-supported-text';
      else if (claim.score === 0) scoreClass = 'text-status-contradicted-text';
    } else {
      scoreText = 'Unresolved (—)';
      scoreClass = 'text-status-unresolved-text';
    }
  } else if (claim.state === 'failed') {
    verdictStatus = 'unresolved';
    verdictLabel = 'Failed';
  }

  // Gather referenced evidence items in order
  const citedEvidence: EvidenceItem[] = [];
  if (claim.evidenceIds) {
    for (const id of claim.evidenceIds) {
      const evi = evidenceMap.get(id);
      if (evi) citedEvidence.push(evi);
    }
  }

  // Detect future-dated scheduled changes without falsely marking current fact stale
  const upcomingEntry = claim.timeline?.find((e) => e.state === 'upcoming');
  const hasScheduledChange =
    Boolean(upcomingEntry) ||
    (claim.state === 'assessed' && claim.reasonCode === 'SCHEDULED_CHANGE_PENDING');

  const hasTimelineData =
    Boolean(claim.timeline && claim.timeline.length > 0) ||
    Boolean('transition' in claim && (claim as unknown as { transition?: unknown }).transition);

  return (
    <div
      className={`rounded-2xl border border-border-subtle bg-surface p-5 sm:p-6 space-y-6 ${className}`}
      role="region"
      aria-label={`Claim details for claim ${claim.ordinal + 1}`}
    >
      {/* Header & Claim Text */}
      <div className="space-y-3 pb-4 border-b border-border-subtle">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-raised text-xs font-mono font-medium text-text-muted border border-border-subtle">
              {claim.ordinal + 1}
            </span>
            <StatusBadge status={verdictStatus} label={verdictLabel} size="md" />
            {hasScheduledChange && (
              <ScheduledChangeBadge
                effectiveDate={upcomingEntry?.effectiveDate}
                announcementDate={upcomingEntry?.announcementDate}
                size="sm"
              />
            )}
          </div>

          <div className="text-right">
            <div className="text-xs font-mono font-semibold">
              <span className="text-text-muted">Freshness Score: </span>
              <span className={scoreClass}>{scoreText}</span>
            </div>
            <p className="text-[10px] text-text-muted mt-0.5">
              Freshness score reflects the verification rubric, not a probability.
            </p>
          </div>
        </div>

        <p className="text-sm sm:text-base font-normal text-text-primary leading-relaxed">
          “{claim.rawText}”
        </p>

        {claim.state === 'assessed' && claim.scoreReason && (
          <div className="p-3 rounded-lg bg-surface-raised/70 border border-border-subtle text-xs text-text-secondary leading-relaxed space-y-1">
            <div className="flex items-center gap-2 text-[11px] font-mono text-text-muted">
              <span>Decision Reason</span>
              {claim.reasonCode && (
                <>
                  <span>·</span>
                  <span className="text-accent">{claim.reasonCode}</span>
                </>
              )}
            </div>
            <p>{claim.scoreReason}</p>
          </div>
        )}
      </div>

      {/* Then vs. Now Transition Timeline */}
      {hasTimelineData && (
        <ChangeTimeline
          timeline={claim.timeline}
          transition={'transition' in claim ? (claim as unknown as { transition?: unknown }).transition : undefined}
          evidenceMap={evidenceMap}
        />
      )}

      {/* Verified Surgical Correction Diff */}
      {claim.state === 'assessed' && claim.correction && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-medium text-text-secondary uppercase tracking-wider font-mono">
              Surgical Correction
            </h4>
            {claim.correction.verified && (
              <span className="rounded bg-status-supported-bg border border-status-supported-border px-1.5 py-0.5 text-[10px] text-status-supported-text font-medium">
                Verified
              </span>
            )}
          </div>

          <pre className="rounded-xl border border-border-subtle bg-surface-raised p-3 text-xs font-mono text-text-primary leading-relaxed overflow-x-auto whitespace-pre-wrap">
            {claim.correction.diff}
          </pre>
        </div>
      )}

      {/* Dynamic Clarification Form (when DAG branch is waiting_for_input) */}
      {clarification && (
        <ClarificationForm
          clarificationId={clarification.clarificationId}
          questions={clarification.questions}
          onSuccess={onClarificationSuccess ?? (() => {})}
        />
      )}

      {/* Cited Evidence Cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-medium text-text-secondary uppercase tracking-wider font-mono">
            Cited Evidence ({citedEvidence.length})
          </h4>
        </div>

        {citedEvidence.length === 0 ? (
          <p className="text-xs text-text-muted">
            No direct web evidence attached to this claim result.
          </p>
        ) : (
          <div className="space-y-3">
            {citedEvidence.map((evi) => (
              <EvidenceCard key={evi.id} evidence={evi} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
