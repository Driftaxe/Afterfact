'use client';

import React from 'react';

export function TemporalDemoCard() {
  return (
    <div className="rounded-md bg-surface/90 dark:bg-[#18191C]/90 border border-border-subtle p-5 sm:p-6 shadow-xl backdrop-blur-md transition-all duration-300 hover:border-accent/40 space-y-4">
      {/* Header: Sequence Number + Verification Identifier + Status */}
      <div className="flex items-center justify-between pb-3 border-b border-border-subtle/60">
        <div className="flex items-center gap-3">
          <span className="font-mono text-2xl sm:text-3xl font-light text-accent">
            02
          </span>
          <div>
            <div className="text-[10px] font-mono tracking-widest uppercase text-text-muted">
              TEMPORAL TRANSITION
            </div>
            <div className="text-xs font-mono text-text-secondary">
              Twitter / X Enterprise API Access
            </div>
          </div>
        </div>

        <span className="inline-flex items-center gap-1.5 text-[10px] font-mono font-medium text-status-outdated-text">
          <span className="w-1.5 h-1.5 rounded-full bg-status-outdated-text" />
          OUTDATED
        </span>
      </div>

      {/* Prominent Historical vs Current Transition */}
      <div className="grid grid-cols-2 gap-4 pt-1">
        <div className="space-y-1">
          <span className="font-mono text-[11px] text-text-muted uppercase tracking-wider block">
            HISTORICAL // 2021
          </span>
          <div className="font-serif text-xl sm:text-2xl font-normal text-text-muted line-through decoration-status-outdated-text/70">
            $42,000 / mo
          </div>
          <p className="font-sans text-[11px] text-text-muted">
            Firehose access stream
          </p>
        </div>

        <div className="space-y-1 border-l border-border-subtle/60 pl-4">
          <span className="font-mono text-[11px] text-status-supported-text uppercase tracking-wider block">
            SUPERSEDED // 2023 → PRESENT
          </span>
          <div className="font-serif text-xl sm:text-2xl font-normal text-text-primary">
            $100 – $5,000 / mo
          </div>
          <p className="font-sans text-[11px] text-text-secondary">
            Basic and Pro developer tiers
          </p>
        </div>
      </div>

      {/* Clear Explanatory Statement */}
      <div className="rounded bg-surface-raised/40 border border-border-subtle/40 p-3">
        <p className="font-serif italic text-xs sm:text-sm text-text-primary/90 leading-relaxed">
          &ldquo;An assertion factual in 2021 was superseded on June 1, 2023. Flagged outdated for queries evaluated after that transition date.&rdquo;
        </p>
      </div>

      {/* Restrained Footnote */}
      <div className="pt-2 border-t border-border-subtle/40 flex items-center justify-between text-[10px] font-mono text-text-muted">
        <span>POLICY TRANSITION VERIFIED</span>
        <span>ILLUSTRATIVE FIXTURE</span>
      </div>
    </div>
  );
}
