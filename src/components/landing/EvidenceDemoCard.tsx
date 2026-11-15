'use client';

import React from 'react';

export function EvidenceDemoCard() {
  return (
    <div className="rounded-lg bg-surface/95 dark:bg-[#18191C]/95 border border-border-strong/90 p-3.5 sm:p-4 shadow-xl backdrop-blur-md transition-all duration-300 hover:border-accent/40 group space-y-3">
      {/* Header Bar: Sequence Number + Source + Primary Authority */}
      <div className="flex items-center justify-between gap-3 pb-2.5 border-b border-border-subtle/70">
        <div className="flex items-center gap-2.5">
          <span className="font-mono text-xl sm:text-2xl font-bold tracking-tight text-accent">
            01
          </span>
          <div className="flex items-center gap-2 text-xs font-mono text-text-secondary">
            <span className="w-1.5 h-1.5 rounded-full bg-status-supported-text" />
            <span className="font-medium text-text-primary">stripe.com/pricing</span>
          </div>
        </div>

        <span className="px-2 py-0.5 rounded-sm bg-status-supported-bg border border-status-supported-border text-[9px] font-mono font-semibold text-status-supported-text uppercase tracking-wider">
          PRIMARY AUTHORITY
        </span>
      </div>

      {/* Main Extracted Numerical Claim & Visual Grounding Gauge */}
      <div className="flex items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-xl sm:text-2xl font-bold tracking-tight text-text-primary">
            2.9% + 30¢
          </span>
          <span className="text-[10px] font-mono text-text-muted">
            / standard domestic card
          </span>
        </div>
        <span className="text-[9px] font-mono text-status-supported-text font-semibold">
          ● VERIFIED
        </span>
      </div>

      {/* Visual Match Gauge Bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[9px] font-mono text-text-muted">
          <span>GROUNDING CONFIDENCE</span>
          <span className="text-status-supported-text font-semibold">100% VERBATIM</span>
        </div>
        <div className="w-full bg-surface-raised h-1 rounded-sm overflow-hidden flex">
          <div className="bg-status-supported-text w-full h-full" />
        </div>
      </div>

      {/* Compact Supporting Verbatim Passage */}
      <div className="rounded bg-surface-raised/60 border border-border-subtle/50 p-2.5 space-y-1">
        <p className="text-[11px] sm:text-xs font-serif italic text-text-primary/95 leading-relaxed">
          &ldquo;Standard processing rate is{' '}
          <mark className="bg-status-supported-bg text-status-supported-text font-sans font-semibold not-italic px-1 py-0.2 rounded-sm">
            2.9% + 30¢ per transaction
          </mark>{' '}
          for online domestic card transactions...&rdquo;
        </p>
      </div>

      {/* Footer Metadata */}
      <div className="flex items-center justify-between text-[9px] font-mono text-text-muted pt-1 border-t border-border-subtle/50">
        <span>CRAWLED: 2026-11-12</span>
        <span className="px-1.5 py-0.2 rounded bg-surface-raised border border-border-subtle text-text-muted">
          ILLUSTRATIVE FIXTURE
        </span>
      </div>
    </div>
  );
}
