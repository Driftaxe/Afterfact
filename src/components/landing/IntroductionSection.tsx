'use client';

import React from 'react';

export function IntroductionSection() {
  return (
    <section id="product" className="scroll-mt-20 sm:scroll-mt-24 py-16 sm:py-24 border-b border-border-subtle relative overflow-hidden bg-surface/20">
      {/* Background Subtle Ambience */}
      <div className="absolute inset-0 pointer-events-none -z-10">
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Editorial Headline Statement */}
        <div className="max-w-3xl space-y-3 mb-12 sm:mb-16">
          <div className="text-[11px] font-mono tracking-[0.2em] uppercase text-accent">
            02 // PRODUCT INTRODUCTION
          </div>
          <h2 className="font-sans text-3xl sm:text-4xl md:text-5xl font-normal tracking-heading text-text-primary leading-tight">
            Answers are easy.{' '}
            <span className="text-text-secondary">Verifying them is harder.</span>
          </h2>
          <p className="text-sm sm:text-base text-text-secondary font-light leading-relaxed">
            Language models generate assertions with unwavering fluency regardless of whether facts are current, superseded, or obsolete. Afterfact anchors generative answers to verifiable reality through deterministic DAG execution.
          </p>
        </div>

        {/* Split Editorial Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* Left Column: Essential Core Tenets (Low density, high impact) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
              <div className="p-3.5 rounded-md bg-surface border border-border-subtle space-y-1">
                <span className="text-accent font-semibold text-[11px]">01 // ATOMIC EXTRACTION</span>
                <p className="text-text-secondary text-[11px] leading-relaxed">
                  Isolates individual verifiable proposition clauses bound to exact UTF-16 character offsets.
                </p>
              </div>

              <div className="p-3.5 rounded-md bg-surface border border-border-subtle space-y-1">
                <span className="text-accent font-semibold text-[11px]">02 // PRIMARY RETRIEVAL</span>
                <p className="text-text-secondary text-[11px] leading-relaxed">
                  Queries official documentation, regulatory filings, and primary authority publisher endpoints.
                </p>
              </div>

              <div className="p-3.5 rounded-md bg-surface border border-border-subtle space-y-1">
                <span className="text-accent font-semibold text-[11px]">03 // CITATION GROUNDING</span>
                <p className="text-text-secondary text-[11px] leading-relaxed">
                  Enforces invariant P10: unsupported citations fail closed without positive score hallucination.
                </p>
              </div>

              <div className="p-3.5 rounded-md bg-surface border border-border-subtle space-y-1">
                <span className="text-accent font-semibold text-[11px]">04 // TEMPORAL REASONING</span>
                <p className="text-text-secondary text-[11px] leading-relaxed">
                  Detects policy shifts, version updates, and transitions to distinguish current fact from past truth.
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Visual Product Architecture Inspector */}
          <div className="lg:col-span-7">
            <div className="rounded-lg bg-surface border border-border-strong p-5 sm:p-6 shadow-xl relative overflow-hidden space-y-5">
              <div className="flex items-center justify-between pb-3.5 border-b border-border-subtle text-xs font-mono">
                <span className="text-text-secondary uppercase tracking-wider">
                  VERIFICATION RUN INSPECTOR
                </span>
                <span className="text-status-supported-text flex items-center gap-1.5 text-[11px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-status-supported-text" />
                  PERSISTED POSTGRESQL DAG
                </span>
              </div>

              {/* Architecture Anatomy Demonstration */}
              <div className="space-y-4">
                {/* Node 1: Unstructured Answer Ingestion */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-mono text-text-muted">
                    <span>STAGE 1: EXTRACTED CLAIM</span>
                    <span className="text-accent">UTF-16 SPAN [0..62]</span>
                  </div>
                  <div className="p-3 rounded-md bg-surface-raised border border-border-subtle font-mono text-xs text-text-primary">
                    &ldquo;Anthropic Claude Pro costs $20 per month in the United States.&rdquo;
                  </div>
                </div>

                {/* Node 2: Extracted Context Qualifiers */}
                <div className="grid grid-cols-3 gap-2 font-mono text-[10px]">
                  <div className="p-2 rounded bg-surface-raised/70 border border-border-subtle">
                    <span className="text-text-muted block text-[9px]">JURISDICTION</span>
                    <span className="text-text-primary font-medium">US (United States)</span>
                  </div>
                  <div className="p-2 rounded bg-surface-raised/70 border border-border-subtle">
                    <span className="text-text-muted block text-[9px]">CURRENCY</span>
                    <span className="text-text-primary font-medium">USD ($)</span>
                  </div>
                  <div className="p-2 rounded bg-surface-raised/70 border border-border-subtle">
                    <span className="text-text-muted block text-[9px]">EVALUATION DATE</span>
                    <span className="text-text-primary font-medium">2026-11-16</span>
                  </div>
                </div>

                {/* Node 3: Grounded Decision Outcome */}
                <div className="p-3.5 rounded-md bg-status-supported-bg/40 border border-status-supported-border flex items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-status-supported-text font-semibold">
                      VERDICT // SUPPORTED
                    </span>
                    <div className="text-xs text-text-primary">
                      Primary authority corroborates $20/mo pricing for US customers.
                    </div>
                  </div>
                  <div className="font-mono text-xs text-status-supported-text font-semibold shrink-0">
                    SCORE: 100/100
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
