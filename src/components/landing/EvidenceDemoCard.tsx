'use client';

import React from 'react';

export function EvidenceDemoCard() {
  return (
    <div className="rounded-xl bg-surface/95 dark:bg-[#18191C]/95 border border-border-strong/90 p-5 sm:p-6 shadow-2xl backdrop-blur-md transition-all duration-300 hover:border-accent/40 group">
      {/* Header Bar: Prominent Sequence Number + Category + Authority */}
      <div className="flex items-start justify-between gap-4 pb-4 border-b border-border-subtle/80">
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-3xl sm:text-4xl font-bold tracking-tight text-accent">
            01
          </span>
          <div className="space-y-0.5">
            <span className="block font-mono text-[10px] tracking-[0.2em] uppercase text-text-muted">
              EVIDENCE VERIFICATION
            </span>
            <div className="flex items-center gap-2 text-xs font-mono text-text-secondary">
              <span className="w-1.5 h-1.5 rounded-full bg-status-supported-text" />
              <span>stripe.com/pricing</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1">
          <span className="px-2 py-0.5 rounded-sm bg-status-supported-bg border border-status-supported-border text-[9px] font-mono font-medium text-status-supported-text uppercase tracking-wider">
            PRIMARY AUTHORITY
          </span>
          <span className="text-[9px] font-mono text-text-muted">
            HTTP 200 FINAL
          </span>
        </div>
      </div>

      {/* Main Extracted Numerical Claim Display */}
      <div className="py-4">
        <div className="text-[10px] font-mono text-text-muted uppercase tracking-wider mb-1">
          EXTRACTED PROPOSITION RATE
        </div>
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-3xl sm:text-4xl font-bold tracking-tight text-text-primary">
            2.9% + 30¢
          </span>
          <span className="text-xs font-mono text-text-muted">
            / standard domestic transaction
          </span>
        </div>
      </div>

      {/* Supporting Verbatim Passage with Highlighted Evidence Span */}
      <div className="rounded-md bg-surface-raised/70 border border-border-subtle/60 p-3.5 space-y-2">
        <div className="flex items-center justify-between text-[10px] font-mono text-text-muted">
          <span>SOURCE PASSAGE // UTF-16 SPAN [112..148]</span>
          <span className="text-status-supported-text font-semibold">MATCH 100%</span>
        </div>
        <p className="text-xs sm:text-[13px] font-serif italic text-text-primary/95 leading-relaxed">
          &ldquo;Standard processing rate is{' '}
          <mark className="bg-status-supported-bg border-b border-status-supported-text text-status-supported-text font-sans font-semibold not-italic px-1 py-0.5 rounded-sm">
            2.9% + 30¢ per transaction
          </mark>{' '}
          for online domestic card transactions...&rdquo;
        </p>
      </div>

      {/* Footer Metadata & Verification Status */}
      <div className="pt-4 flex flex-wrap items-center justify-between gap-3 text-[10px] font-mono text-text-muted border-t border-border-subtle/80 mt-4">
        <div className="flex items-center gap-4">
          <span>CRAWLED: 2026-11-12</span>
          <span>GROUNDING: VERBATIM</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-1.5 py-0.5 rounded-sm bg-surface-raised border border-border-subtle text-[9px] text-text-muted">
            ILLUSTRATIVE FIXTURE
          </span>
          <span className="text-status-supported-text font-semibold">
            ● CONFIRMED
          </span>
        </div>
      </div>
    </div>
  );
}
