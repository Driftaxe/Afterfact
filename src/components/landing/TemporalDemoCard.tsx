'use client';

import React from 'react';

export function TemporalDemoCard() {
  return (
    <div className="rounded-lg bg-surface/95 dark:bg-[#18191C]/95 border border-border-strong/90 p-3.5 sm:p-4 shadow-xl backdrop-blur-md transition-all duration-300 hover:border-accent/40 group space-y-3">
      {/* Header Bar: Sequence Number + Topic + Status Badge */}
      <div className="flex items-center justify-between gap-3 pb-2.5 border-b border-border-subtle/70">
        <div className="flex items-center gap-2.5">
          <span className="font-mono text-xl sm:text-2xl font-bold tracking-tight text-accent">
            02
          </span>
          <span className="text-xs font-mono font-medium text-text-primary">
            Twitter/X Enterprise API Access
          </span>
        </div>

        <span className="px-2 py-0.5 rounded-sm bg-status-outdated-bg border border-status-outdated-border text-[9px] font-mono font-semibold text-status-outdated-text uppercase tracking-wider">
          OUTDATED (SCORE: 0)
        </span>
      </div>

      {/* Visual Connected Chronological Node Diagram */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-[9px] font-mono text-text-muted">
          <span>TEMPORAL DRIFT DIAGRAM</span>
          <span className="text-status-outdated-text">SUPERSEDED 2023-06</span>
        </div>

        {/* Visual Node Diagram */}
        <div className="grid grid-cols-11 items-center gap-1.5 py-1">
          {/* Node 1: Historical 2021 */}
          <div className="col-span-5 rounded bg-surface-raised/70 border border-border-subtle p-2 space-y-0.5">
            <div className="flex items-center justify-between text-[9px] font-mono text-text-muted">
              <span>HISTORICAL</span>
              <span className="text-status-outdated-text font-semibold">2021</span>
            </div>
            <div className="text-xs font-mono font-medium text-text-secondary line-through truncate">
              $42,000 / month
            </div>
          </div>

          {/* Visual Connector Arrow */}
          <div className="col-span-1 flex flex-col items-center justify-center">
            <span className="text-accent text-sm font-bold">→</span>
          </div>

          {/* Node 2: Current 2026 */}
          <div className="col-span-5 rounded bg-surface-raised/70 border border-status-supported-border/40 p-2 space-y-0.5">
            <div className="flex items-center justify-between text-[9px] font-mono">
              <span className="text-text-muted">CURRENT</span>
              <span className="text-status-supported-text font-semibold">2026</span>
            </div>
            <div className="text-xs font-mono font-medium text-status-supported-text truncate">
              $100 – $5,000 / mo
            </div>
          </div>
        </div>

        {/* Transition Progress Bar */}
        <div className="w-full bg-surface-raised h-1 rounded-sm overflow-hidden flex">
          <div className="bg-status-outdated-text w-1/2 h-full" title="Historical Active" />
          <div className="bg-status-supported-text w-1/2 h-full" title="Current Policy" />
        </div>
      </div>

      {/* Footer Metadata */}
      <div className="flex items-center justify-between text-[9px] font-mono text-text-muted pt-1 border-t border-border-subtle/50">
        <span>CHANGE: RESTRUCTURED_TIERING</span>
        <span className="px-1.5 py-0.2 rounded bg-surface-raised border border-border-subtle text-text-muted">
          ILLUSTRATIVE FIXTURE
        </span>
      </div>
    </div>
  );
}
