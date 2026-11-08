'use client';

import React, { useMemo } from 'react';
import type { ClaimResultItem } from '@/lib/contracts/report';
import { segmentAnswerText } from '@/lib/report/spans';

export interface AnswerDocumentProps {
  answerText: string;
  claims: ClaimResultItem[];
  selectedClaimId: string | null;
  onSelectClaim: (claimId: string) => void;
  className?: string;
}

export function AnswerDocument({
  answerText,
  claims,
  selectedClaimId,
  onSelectClaim,
  className = '',
}: AnswerDocumentProps) {
  const { segments, hasMalformedSpans } = useMemo(() => {
    return segmentAnswerText({ answerText, claims });
  }, [answerText, claims]);

  return (
    <div
      className={`rounded-2xl border border-border-subtle bg-surface p-5 sm:p-6 space-y-4 ${className}`}
      role="region"
      aria-label="Analyzed original answer document"
    >
      <div className="flex items-center justify-between border-b border-border-subtle pb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-text-primary">Original Answer</h3>
          <span className="text-xs text-text-muted font-mono">
            ({claims.length} {claims.length === 1 ? 'claim' : 'claims'} analyzed)
          </span>
        </div>
        <p className="text-xs text-text-muted hidden sm:block">
          Select highlighted text to inspect evidence
        </p>
      </div>

      {hasMalformedSpans && (
        <div className="p-2.5 rounded-lg bg-status-unresolved-bg border border-status-unresolved-border text-xs text-status-unresolved-text">
          Notice: One or more claim offsets in this report could not be cleanly anchored to the text.
        </div>
      )}

      {/* Rendered answer text with interactive highlights */}
      <div
        className="font-sans text-sm sm:text-base leading-[1.75] text-text-primary whitespace-pre-wrap selection:bg-accent/20"
        tabIndex={0}
        aria-label="Answer content with interactive verification highlights"
      >
        {segments.map((segment, idx) => {
          if (!segment.claimId) {
            return <span key={`unhighlighted-${idx}`}>{segment.text}</span>;
          }

          const isSelected = selectedClaimId === segment.claimId;
          const verdict = segment.verdict || 'unresolved';

          // Base style by verdict
          let verdictClasses = 'decoration-status-unresolved-border bg-status-unresolved-bg/40 text-text-primary';
          if (verdict === 'supported') {
            verdictClasses = 'decoration-status-supported-border bg-status-supported-bg/30 text-text-primary';
          } else if (verdict === 'outdated') {
            verdictClasses = 'decoration-status-outdated-border bg-status-outdated-bg/30 text-text-primary';
          } else if (verdict === 'contradicted') {
            verdictClasses = 'decoration-status-contradicted-border bg-status-contradicted-bg/30 text-text-primary';
          }

          // Distinct selected styling (ring + prominent underline + raised surface, not color alone)
          const selectionClasses = isSelected
            ? 'ring-2 ring-focus-ring bg-surface-raised font-medium shadow-sm underline-offset-4 decoration-[3px]'
            : 'underline underline-offset-4 decoration-[1.5px] hover:bg-surface-raised transition-colors';

          return (
            <button
              key={`claim-span-${segment.claimId}-${idx}`}
              type="button"
              onClick={() => onSelectClaim(segment.claimId!)}
              className={`inline rounded-sm px-0.5 mx-0.5 text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${verdictClasses} ${selectionClasses}`}
              aria-pressed={isSelected}
              aria-label={`Claim: ${segment.text} (${verdict})`}
            >
              {segment.text}
            </button>
          );
        })}
      </div>
    </div>
  );
}
