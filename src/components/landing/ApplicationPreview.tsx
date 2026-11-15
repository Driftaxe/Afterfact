'use client';

import React, { useState } from 'react';
import Link from 'next/link';

export function ApplicationPreview() {
  const [sampleAnswer, setSampleAnswer] = useState(
    'Stripe charges a 2.9% + 30¢ flat fee for standard credit card transactions in the US.'
  );

  return (
    <section className="py-20 sm:py-28 border-b border-border-subtle bg-surface/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-12 border-b border-border-subtle">
          <div className="space-y-3 max-w-2xl">
            <div className="flex items-center gap-2.5 text-accent font-mono text-xs uppercase tracking-widest">
              <span>06 // APPLICATION PREVIEW</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-light tracking-tight text-text-primary">
              Interactive Verification Workspace
            </h2>
            <p className="text-sm sm:text-base text-text-secondary leading-relaxed">
              Experience the complete temporal verification pipeline. Decompose complex text into atomic propositions, ground citations in primary web sources, and detect factual decay.
            </p>
          </div>

          <div>
            <Link
              href="/app"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-md bg-btn-primary text-btn-primary-text font-medium text-xs sm:text-sm tracking-wider uppercase transition-all shadow-md hover:bg-btn-primary-hover group"
            >
              <span>Explore the verification workspace</span>
              <span className="transition-transform group-hover:translate-x-1" aria-hidden="true">→</span>
            </Link>
          </div>
        </div>

        {/* Polished Terminal Workspace Preview */}
        <div className="pt-12">
          <div className="rounded-xl border border-border-strong bg-surface dark:bg-[#18191C] shadow-2xl overflow-hidden">
            {/* Terminal Window Chrome */}
            <div className="px-5 py-3 border-b border-border-subtle bg-surface-raised flex items-center justify-between text-[11px] font-mono text-text-muted">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-border-strong" />
                <span className="w-2.5 h-2.5 rounded-full bg-border-strong" />
                <span className="w-2.5 h-2.5 rounded-full bg-border-strong" />
                <span className="ml-2 text-text-secondary font-medium">afterfact-workspace // preview mode</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-status-supported-text">● ENGINE READY</span>
                <span>NEON PG // POOLED</span>
              </div>
            </div>

            {/* Terminal Body */}
            <div className="p-6 sm:p-8 space-y-6">
              {/* Tab Selector Preview */}
              <div className="flex items-center gap-2 border-b border-border-subtle pb-3">
                <span className="px-3 py-1 rounded-sm bg-surface-raised border border-border-subtle text-xs font-mono font-medium text-text-primary">
                  Paste Answer
                </span>
                <span className="px-3 py-1 rounded-sm text-xs font-mono text-text-muted">
                  Ask Question (Phase 3)
                </span>
              </div>

              {/* Input Area Preview with #answer-input */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <label htmlFor="answer-input" className="text-text-secondary font-medium">
                    AI-Generated Answer to Verify
                  </label>
                  <span className="text-text-muted">
                    {sampleAnswer.length} / 8000
                  </span>
                </div>
                <textarea
                  id="answer-input"
                  name="answer-input"
                  rows={3}
                  value={sampleAnswer}
                  onChange={(e) => setSampleAnswer(e.target.value)}
                  placeholder="Paste an AI-generated answer or summary to evaluate its time-sensitive factual assertions..."
                  className="w-full rounded-md border border-border-subtle bg-background px-4 py-3 text-sm text-text-primary font-mono placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent resize-none transition-colors"
                />
              </div>

              {/* Context Qualifiers Preview */}
              <div className="flex flex-wrap items-center gap-3 pt-2 text-xs font-mono">
                <span className="text-text-muted">Context Qualifiers:</span>
                <span className="px-2.5 py-1 rounded-sm bg-surface-raised border border-border-subtle text-text-secondary">
                  Jurisdiction: United States (US / USD)
                </span>
                <span className="px-2.5 py-1 rounded-sm bg-surface-raised border border-border-subtle text-text-secondary">
                  Target Date: 2026-11-16 (Current)
                </span>
                <span className="px-2.5 py-1 rounded-sm bg-status-supported-bg border border-status-supported-border text-status-supported-text">
                  Strict Primary Authority: Active
                </span>
              </div>

              {/* Action Banner to Enter Live Workspace */}
              <div className="pt-4 border-t border-border-subtle flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-xs font-mono text-text-muted">
                  Ready to test real answers against live web search and temporal decay fences?
                </div>
                <Link
                  href="/app"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-md bg-btn-primary text-btn-primary-text font-medium text-xs tracking-wider uppercase shadow-md transition-all hover:bg-btn-primary-hover"
                >
                  <span>Launch Workspace</span>
                  <span aria-hidden="true">→</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
