'use client';

import React from 'react';

export function TemporalDemoCard() {
  return (
    <div className="rounded-xl bg-surface/95 dark:bg-[#18191C]/95 border border-border-strong/90 p-5 sm:p-6 shadow-2xl backdrop-blur-md transition-all duration-300 hover:border-accent/40 group">
      {/* Header Bar: Sequence Number + Category + Status Badge */}
      <div className="flex items-start justify-between gap-4 pb-4 border-b border-border-subtle/80">
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-3xl sm:text-4xl font-bold tracking-tight text-accent">
            02
          </span>
          <div className="space-y-0.5">
            <span className="block font-mono text-[10px] tracking-[0.2em] uppercase text-text-muted">
              TEMPORAL VERIFICATION
            </span>
            <span className="block text-xs font-mono text-text-secondary">
              Twitter/X Enterprise API Pricing
            </span>
          </div>
        </div>

        <span className="px-2 py-0.5 rounded-sm bg-status-outdated-bg border border-status-outdated-border text-[9px] font-mono font-medium text-status-outdated-text uppercase tracking-wider">
          OUTDATED CLAIM
        </span>
      </div>

      {/* Prominent Numerical Year Transition Display */}
      <div className="py-4">
        <div className="flex items-center justify-between pb-2">
          <span className="font-mono text-[10px] tracking-wider uppercase text-text-muted">
            POLICY TRANSITION TIMELINE
          </span>
          <span className="font-mono text-[10px] text-status-outdated-text font-medium">
            SUPERSEDED BY JUNE 2023 RESTRUCTURING
          </span>
        </div>

        {/* Large Prominent Year Markers */}
        <div className="flex items-center justify-between font-mono text-2xl sm:text-3xl font-bold tracking-tight text-text-primary">
          <div className="flex flex-col">
            <span className="text-text-muted text-xs font-normal">HISTORICAL</span>
            <span className="text-text-secondary line-through">2021 // $42,000/mo</span>
          </div>
          <span className="text-accent text-xl sm:text-2xl font-light">→</span>
          <div className="flex flex-col text-right">
            <span className="text-status-supported-text text-xs font-normal">CURRENT</span>
            <span className="text-text-primary">$100 – $5,000/mo</span>
          </div>
        </div>

        {/* Chronological Transition Bar */}
        <div className="mt-3 w-full bg-surface-raised h-2 rounded-sm overflow-hidden flex">
          <div className="bg-status-outdated-text/70 w-1/3 h-full" title="Historical State" />
          <div className="bg-accent/80 w-1/3 h-full" title="Transition Event" />
          <div className="bg-status-supported-text w-1/3 h-full" title="Current Assessed State" />
        </div>
      </div>

      {/* Structured Chronology Grid */}
      <div className="grid grid-cols-2 gap-3 pt-1">
        <div className="rounded-md bg-surface-raised/50 border border-border-subtle/50 p-2.5 space-y-1">
          <div className="text-[9px] font-mono text-status-outdated-text uppercase font-semibold">
            THEN // EFFECTIVE 2023-03
          </div>
          <p className="text-xs text-text-secondary leading-snug">
            Enterprise tier at $42,000/mo for full stream access.
          </p>
        </div>

        <div className="rounded-md bg-surface-raised/50 border border-border-subtle/50 p-2.5 space-y-1">
          <div className="text-[9px] font-mono text-status-supported-text uppercase font-semibold">
            NOW // EFFECTIVE 2023-06
          </div>
          <p className="text-xs text-text-primary leading-snug">
            Restructured into Free, Basic ($100), and Pro ($5,000/mo).
          </p>
        </div>
      </div>

      {/* Footer Metadata */}
      <div className="pt-4 flex items-center justify-between text-[10px] font-mono text-text-muted border-t border-border-subtle/80 mt-4">
        <span>CHANGE REASON: RESTRUCTURED_PRICING</span>
        <span className="px-1.5 py-0.5 rounded-sm bg-surface-raised border border-border-subtle text-[9px] text-text-muted">
          ILLUSTRATIVE FIXTURE
        </span>
      </div>
    </div>
  );
}
