'use client';

import React from 'react';

export function EvidenceDemoCard() {
  return (
    <div className="rounded-md bg-surface/90 dark:bg-[#18191C]/90 border border-border-subtle p-5 sm:p-6 shadow-xl backdrop-blur-md transition-all duration-300 hover:border-accent/40 space-y-4">
      {/* Header: Sequence Number + Verification Identifier + Source */}
      <div className="flex items-center justify-between pb-3 border-b border-border-subtle/60">
        <div className="flex items-center gap-3">
          <span className="font-mono text-2xl sm:text-3xl font-light text-accent">
            01
          </span>
          <div>
            <div className="text-[10px] font-mono tracking-widest uppercase text-text-muted">
              VERIFIED CITATION
            </div>
            <div className="text-xs font-mono text-text-secondary">
              stripe.com/pricing
            </div>
          </div>
        </div>

        <span className="inline-flex items-center gap-1.5 text-[10px] font-mono font-medium text-status-supported-text">
          <span className="w-1.5 h-1.5 rounded-full bg-status-supported-text" />
          SUPPORTED
        </span>
      </div>

      {/* Primary Numerical Claim */}
      <div className="space-y-1">
        <div className="font-sans text-3xl sm:text-4xl font-medium text-text-primary tracking-tight">
          2.9% + 30¢
        </div>
        <div className="font-sans text-xs text-text-muted">
          Standard online card processing fee in the United States
        </div>
      </div>

      {/* Supporting Verbatim Quotation */}
      <blockquote className="border-l-2 border-status-supported-text/60 pl-3.5 py-1">
        <p className="font-sans text-xs sm:text-sm text-text-primary/90 leading-relaxed">
          &ldquo;Standard processing rate is{' '}
          <mark className="bg-status-supported-bg text-status-supported-text font-sans font-medium not-italic px-1.5 py-0.5 rounded-sm border border-status-supported-border">
            2.9% + 30¢ per transaction
          </mark>{' '}
          for online domestic card transactions.&rdquo;
        </p>
      </blockquote>

      {/* Restrained Footnote */}
      <div className="pt-2 border-t border-border-subtle/40 flex items-center justify-between text-[10px] font-mono text-text-muted">
        <span>PRIMARY SOURCE VERIFIED</span>
        <span>ILLUSTRATIVE FIXTURE</span>
      </div>
    </div>
  );
}
