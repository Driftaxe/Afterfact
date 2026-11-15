import React from 'react';

export function IntroductionSection() {
  return (
    <section id="product" className="py-24 sm:py-32 border-b border-border-subtle relative overflow-hidden">
      {/* Background Subtle Ambience */}
      <div className="absolute inset-0 pointer-events-none -z-10">
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Editorial Headline Statement */}
        <div className="max-w-4xl space-y-4 mb-16 sm:mb-20">
          <div className="text-[11px] font-mono tracking-[0.2em] uppercase text-accent">
            01 // INSTITUTIONAL MANIFESTO
          </div>
          <h2 className="font-serif text-3xl sm:text-5xl lg:text-6xl font-normal tracking-tight text-text-primary leading-[1.1]">
            The hallucination problem is fundamentally a{' '}
            <span className="italic font-serif text-text-primary/95">temporal problem.</span>
          </h2>
        </div>

        {/* Split Editorial Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
          {/* Left Column: Deep Narrative Explanation */}
          <div className="lg:col-span-5 space-y-6 text-sm sm:text-base text-text-secondary leading-relaxed font-light">
            <p>
              Large language models generate assertions with unwavering linguistic fluency regardless of whether the
              underlying fact is current, superseded, or outright obsolete. When documentation updates, APIs deprecate,
              or executive leadership turns over, frozen weights cannot adapt without authoritative external grounding.
            </p>
            <p>
              Afterfact decomposes AI answers into discrete propositions, anchors each clause to exact UTF-16 character
              spans, and queries primary authorities in real time. We do not trust model self-evaluations or fuzzy
              vector heuristics: every decision is bound by deterministic scoring rules and cryptographic hash audit
              trails.
            </p>
            <div className="pt-4 border-t border-border-subtle grid grid-cols-2 gap-4 text-xs font-mono">
              <div>
                <span className="text-text-muted block uppercase text-[10px] tracking-wider">PRIMARY PARADIGM</span>
                <span className="text-text-primary font-medium">Deterministic DAG</span>
              </div>
              <div>
                <span className="text-text-muted block uppercase text-[10px] tracking-wider">CITATION AUTHORITY</span>
                <span className="text-text-primary font-medium">Verbatim Web Source</span>
              </div>
            </div>
          </div>

          {/* Right Column: Visual Product Architecture Card */}
          <div className="lg:col-span-7">
            <div className="rounded-2xl bg-surface border border-border-strong p-6 sm:p-8 shadow-2xl relative overflow-hidden">
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
                  <div className="p-3.5 rounded-xl bg-surface-raised border border-border-subtle font-mono text-xs text-text-primary">
                    &ldquo;Anthropic Claude Pro costs $20 per month in the United States.&rdquo;
                  </div>
                </div>

                {/* Node 2: Extracted Context Qualifiers */}
                <div className="space-y-2">
                  <div className="text-xs font-mono text-text-muted">
                    STAGE 2: TYPED CONTEXT QUALIFIERS
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 font-mono text-[11px]">
                    <div className="p-2.5 rounded-lg bg-surface-raised/70 border border-border-subtle">
                      <span className="text-text-muted block text-[9px]">JURISDICTION</span>
                      <span className="text-text-primary font-medium">US (United States)</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-surface-raised/70 border border-border-subtle">
                      <span className="text-text-muted block text-[9px]">CURRENCY</span>
                      <span className="text-text-primary font-medium">USD ($)</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-surface-raised/70 border border-border-subtle">
                      <span className="text-text-muted block text-[9px]">EVALUATION DATE</span>
                      <span className="text-text-primary font-medium">2026-11-12</span>
                    </div>
                  </div>
                </div>

                {/* Node 3: Grounded Decision Outcome */}
                <div className="p-4 rounded-xl bg-status-supported-bg/40 border border-status-supported-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-status-supported-text font-semibold">
                      DETERMINISTIC VERDICT
                    </span>
                    <p className="text-xs text-text-primary font-medium">
                      Claim verified against official Anthropic pricing documentation.
                    </p>
                  </div>
                  <span className="self-start sm:self-center px-2.5 py-1 rounded bg-status-supported-bg border border-status-supported-border text-xs font-mono text-status-supported-text uppercase tracking-wider">
                    SUPPORTED (100)
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
