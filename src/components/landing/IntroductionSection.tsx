'use client';

import React from 'react';

export function IntroductionSection() {
  return (
    <section id="product" className="py-20 sm:py-28 border-b border-border-subtle relative overflow-hidden bg-surface/20">
      {/* Background Subtle Ambience */}
      <div className="absolute inset-0 pointer-events-none -z-10">
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Editorial Headline Statement */}
        <div className="max-w-4xl space-y-4 mb-16 sm:mb-20">
          <div className="text-[11px] font-mono tracking-[0.2em] uppercase text-accent">
            02 // PRODUCT INTRODUCTION
          </div>
          <h2 className="font-serif text-3xl sm:text-5xl lg:text-6xl font-normal tracking-tight text-text-primary leading-[1.1]">
            Answers are easy.{' '}
            <span className="italic font-serif text-text-primary/95">Verifying them is harder.</span>
          </h2>
          <p className="text-base sm:text-lg text-text-secondary max-w-2xl font-light leading-relaxed">
            Language models generate assertions with unwavering fluency regardless of whether the fact is current, superseded, or obsolete. Afterfact anchors generative answers to verifiable reality.
          </p>
        </div>

        {/* Split Editorial Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
          {/* Left Column: Deep Narrative Explanation */}
          <div className="lg:col-span-5 space-y-6 text-sm sm:text-base text-text-secondary leading-relaxed font-light">
            <p>
              When documentation updates, APIs deprecate, pricing models shift, or executive leadership changes, static model weights cannot adapt without authoritative external grounding.
            </p>
            <p>
              Afterfact decomposes complex answers into discrete atomic claims, anchors each clause to exact UTF-16 character spans, and queries primary authorities in real time. We do not trust model self-evaluations: every decision is bound by deterministic scoring rules and cryptographic audit trails.
            </p>

            {/* 5 Core Tenets */}
            <div className="pt-4 border-t border-border-subtle grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
              <div className="p-3 rounded-md bg-surface border border-border-subtle space-y-1">
                <span className="text-accent font-semibold">01 // ATOMIC EXTRACTION</span>
                <p className="text-text-muted text-[11px]">Surgically isolates individual verifiable factual propositions.</p>
              </div>
              <div className="p-3 rounded-md bg-surface border border-border-subtle space-y-1">
                <span className="text-accent font-semibold">02 // EVIDENCE RETRIEVAL</span>
                <p className="text-text-muted text-[11px]">Direct multi-provider web retrieval targeted by query intent.</p>
              </div>
              <div className="p-3 rounded-md bg-surface border border-border-subtle space-y-1">
                <span className="text-accent font-semibold">03 // CITATION GROUNDING</span>
                <p className="text-text-muted text-[11px]">Strict P10 invariant: unsupported citations fail closed.</p>
              </div>
              <div className="p-3 rounded-md bg-surface border border-border-subtle space-y-1">
                <span className="text-accent font-semibold">04 // TEMPORAL REASONING</span>
                <p className="text-text-muted text-[11px]">Distinguishes historically true claims from current policy.</p>
              </div>
            </div>
          </div>

          {/* Right Column: Visual Product Architecture Card */}
          <div className="lg:col-span-7">
            <div className="rounded-xl bg-surface border border-border-strong p-6 sm:p-8 shadow-2xl relative overflow-hidden">
              <div className="flex items-center justify-between pb-5 border-b border-border-subtle text-xs font-mono">
                <span className="text-text-secondary uppercase tracking-wider">
                  VERIFICATION RUN INSPECTOR // RUN_C03_DEMO
                </span>
                <span className="text-status-supported-text flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-status-supported-text" />
                  PERSISTED IN POSTGRESQL
                </span>
              </div>

              {/* Architecture Anatomy Demonstration */}
              <div className="pt-6 space-y-6">
                {/* Node 1: Unstructured Answer Ingestion */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono text-text-muted">
                    <span>STAGE 1: CANDIDATE PROPOSITION</span>
                    <span className="text-accent">UTF-16 OFFSETS [0..62]</span>
                  </div>
                  <div className="p-3.5 rounded-md bg-surface-raised border border-border-subtle font-mono text-xs text-text-primary">
                    &ldquo;Anthropic Claude Pro costs $20 per month in the United States.&rdquo;
                  </div>
                </div>

                {/* Node 2: Extracted Context Qualifiers */}
                <div className="space-y-2">
                  <div className="text-xs font-mono text-text-muted">
                    STAGE 2: TYPED CONTEXT QUALIFIERS
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 font-mono text-[11px]">
                    <div className="p-2.5 rounded-md bg-surface-raised/70 border border-border-subtle">
                      <span className="text-text-muted block text-[9px]">JURISDICTION</span>
                      <span className="text-text-primary font-medium">US (United States)</span>
                    </div>
                    <div className="p-2.5 rounded-md bg-surface-raised/70 border border-border-subtle">
                      <span className="text-text-muted block text-[9px]">CURRENCY</span>
                      <span className="text-text-primary font-medium">USD ($)</span>
                    </div>
                    <div className="p-2.5 rounded-md bg-surface-raised/70 border border-border-subtle">
                      <span className="text-text-muted block text-[9px]">EVALUATION DATE</span>
                      <span className="text-text-primary font-medium">2026-11-16</span>
                    </div>
                  </div>
                </div>

                {/* Node 3: Grounded Decision Outcome */}
                <div className="p-4 rounded-md bg-status-supported-bg/40 border border-status-supported-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-status-supported-text font-semibold">
                      VERDICT // SUPPORTED
                    </span>
                    <div className="text-xs text-text-primary">
                      Primary authority corroborates $20/mo pricing for US customers.
                    </div>
                  </div>
                  <div className="text-right font-mono text-xs text-status-supported-text font-semibold sm:self-center">
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
