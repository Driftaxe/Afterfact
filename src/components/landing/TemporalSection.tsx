'use client';

import React, { useState } from 'react';

const VERDICT_STATES = [
  {
    key: 'supported',
    title: 'SUPPORTED',
    badgeClass: 'bg-status-supported-bg border-status-supported-border text-status-supported-text',
    summary: 'Confirmed by primary documentation active on the target evaluation date.',
    example: 'Stripe charges 2.9% + 30¢ for standard card processing in the US.',
    temporalStatus: 'CURRENT',
  },
  {
    key: 'outdated',
    title: 'OUTDATED',
    badgeClass: 'bg-status-outdated-bg border-status-outdated-border text-status-outdated-text',
    summary: 'Factually true in the past, but superseded by a documented transition event.',
    example: 'Twitter Enterprise API is $42k/mo (restructured to tiered access June 2023).',
    temporalStatus: 'HISTORICAL',
  },
  {
    key: 'contradicted',
    title: 'CONTRADICTED',
    badgeClass: 'bg-status-contradicted-bg border-status-contradicted-border text-status-contradicted-text',
    summary: 'Directly refuted by authoritative documentation or historical records.',
    example: 'Stripe does not charge per-transaction fees on credit card transactions.',
    temporalStatus: 'REFUTED',
  },
  {
    key: 'context_dependent',
    title: 'CONTEXT-DEPENDENT',
    badgeClass: 'bg-status-unresolved-bg border-status-unresolved-border text-status-unresolved-text',
    summary: 'Veracity hinges on a missing qualifier like jurisdiction, tier, or region.',
    example: 'Standard processing is 1.4% + 20p (True only in the UK, false in the US).',
    temporalStatus: 'QUALIFIER REQUIRED',
  },
  {
    key: 'unresolved',
    title: 'INSUFFICIENT EVIDENCE',
    badgeClass: 'bg-status-checking-bg border-status-checking-border text-status-checking-text',
    summary: 'No primary authority found to conclusively confirm or refute the assertion.',
    example: 'Internal confidential metrics or unannounced product roadmaps.',
    temporalStatus: 'OPEN',
  },
];

export function TemporalSection() {
  const [activeTab, setActiveTab] = useState<'outdated' | 'supported'>('outdated');
  const [diffView, setDiffView] = useState<'unified' | 'words'>('unified');

  return (
    <section id="architecture" className="scroll-mt-20 sm:scroll-mt-24 py-20 sm:py-28 border-b border-border-subtle bg-surface/30 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="max-w-3xl space-y-4 mb-14 sm:mb-18">
          <div className="text-[11px] font-mono tracking-[0.2em] uppercase text-accent">
            05 // ARCHITECTURE & TEMPORAL ENGINE
          </div>
          <h2 className="font-sans text-3xl sm:text-4xl md:text-5xl font-normal tracking-heading text-text-primary leading-tight">
            Temporal intelligence in practice.
          </h2>
          <p className="text-sm sm:text-base text-text-secondary leading-relaxed font-light">
            Truth evolves. A claim factual in 2021 can become obsolete today without ever having been false. Afterfact models temporal validity across announcement, crawl, and effective dates.
          </p>
        </div>

        {/* Interactive Case Study Dossier */}
        <div className="rounded-2xl bg-surface/90 border border-border-strong p-5 sm:p-8 shadow-2xl mb-16 space-y-8 backdrop-blur-sm">
          {/* Header & Mode Switcher */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border-subtle">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                <span className="text-[10px] font-mono text-text-muted uppercase tracking-[0.18em]">
                  CASE STUDY // REAL-WORLD TEMPORAL SHIFT
                </span>
              </div>
              <h3 className="text-lg sm:text-xl font-sans text-text-primary font-medium tracking-tight">
                {activeTab === 'outdated'
                  ? 'Pricing Restructure: Twitter/X Enterprise API Transition'
                  : 'Jurisdictional Boundaries: Stripe Standard Card Processing'}
              </h3>
            </div>

            {/* Case Selection Tabs */}
            <div className="flex items-center gap-1.5 p-1 rounded-lg bg-surface-raised border border-border-subtle self-start sm:self-center">
              <button
                type="button"
                onClick={() => setActiveTab('outdated')}
                className={`px-3 py-1.5 rounded-md text-xs font-mono tracking-wider uppercase transition-all ${
                  activeTab === 'outdated'
                    ? 'bg-surface text-text-primary shadow-sm font-semibold border border-border-subtle/60'
                    : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                Case A: Twitter API
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('supported')}
                className={`px-3 py-1.5 rounded-md text-xs font-mono tracking-wider uppercase transition-all ${
                  activeTab === 'supported'
                    ? 'bg-surface text-text-primary shadow-sm font-semibold border border-border-subtle/60'
                    : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                Case B: Stripe Pricing
              </button>
            </div>
          </div>

          {activeTab === 'outdated' ? (
            /* Case A: Twitter / X API Supersession Progression */
            <div className="space-y-6">
              {/* Chronological 3-Node Stepper Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6 relative">
                {/* Node 1: Historical State (2021) */}
                <div className="p-5 rounded-xl bg-surface-raised/80 border border-border-subtle space-y-3 relative group hover:border-border-strong transition-colors">
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-text-muted uppercase tracking-wider font-semibold">
                      01 // HISTORICAL (2021)
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] bg-surface border border-border-subtle text-text-muted font-medium">
                      VERIFIED THEN
                    </span>
                  </div>
                  <p className="text-sm text-text-primary font-medium leading-relaxed font-sans">
                    Twitter Enterprise API access costs $42,000/month for firehose data stream access.
                  </p>
                  <div className="pt-2 border-t border-border-subtle/50 space-y-1 text-[11px] font-mono text-text-muted">
                    <div className="flex items-center gap-1.5">
                      <span className="text-accent/80">Policy Effective:</span>
                      <span className="text-text-secondary">2021-03-29</span>
                    </div>
                    <div className="text-[10px] text-text-muted/80">Source: Twitter Enterprise Documentation</div>
                  </div>
                </div>

                {/* Node 2: Transition Event (2023) */}
                <div className="p-5 rounded-xl bg-status-outdated-bg/30 border border-status-outdated-border/70 space-y-3 relative group hover:border-status-outdated-border transition-colors">
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-status-outdated-text uppercase tracking-wider font-semibold">
                      02 // TRANSITION EVENT
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] bg-status-outdated-bg border border-status-outdated-border text-status-outdated-text font-bold">
                      SUPERSEDED
                    </span>
                  </div>
                  <p className="text-sm text-text-primary font-medium leading-relaxed font-sans">
                    X Developer Platform restructuring introduces new Basic and Pro tiers.
                  </p>
                  <div className="pt-2 border-t border-status-outdated-border/30 space-y-1 text-[11px] font-mono text-status-outdated-text">
                    <div className="flex items-center gap-1.5 font-semibold">
                      <span>Effective Date:</span>
                      <span>June 1, 2023</span>
                    </div>
                    <div className="text-[10px] opacity-80">Platform Migration: developer.x.com</div>
                  </div>
                </div>

                {/* Node 3: Current Reality (2026) */}
                <div className="p-5 rounded-xl bg-status-supported-bg/25 border border-status-supported-border/70 space-y-3 relative group hover:border-status-supported-border transition-colors">
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-status-supported-text uppercase tracking-wider font-semibold">
                      03 // CURRENT (2026)
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] bg-status-supported-bg border border-status-supported-border text-status-supported-text font-bold">
                      CURRENT REALITY
                    </span>
                  </div>
                  <p className="text-sm text-text-primary font-medium leading-relaxed font-sans">
                    Developer tiers: Basic ($100/mo), Pro ($5,000/mo), Custom Enterprise.
                  </p>
                  <div className="pt-2 border-t border-status-supported-border/30 space-y-1 text-[11px] font-mono text-status-supported-text">
                    <div className="flex items-center gap-1.5">
                      <span className="opacity-80">Authority:</span>
                      <span className="font-medium">developer.x.com</span>
                    </div>
                    <div className="text-[10px] opacity-80">Verified active on 2026-11-16</div>
                  </div>
                </div>
              </div>

              {/* Forensic Verdict & Verified Surgical Correction Dossier */}
              <div className="rounded-xl border border-border-subtle bg-surface-raised/90 p-5 sm:p-6 space-y-4">
                {/* Status Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border-subtle">
                  <div className="flex flex-wrap items-center gap-2.5 text-xs font-mono">
                    <span className="px-2 py-0.5 rounded bg-status-outdated-bg border border-status-outdated-border text-status-outdated-text uppercase font-bold tracking-wider">
                      OUTDATED (SCORE: 0)
                    </span>
                    <span className="text-text-muted">·</span>
                    <span className="text-accent font-semibold tracking-wider">
                      SUPERSEDED_HISTORICAL_CLAIM
                    </span>
                  </div>

                  {/* Diff View Switcher */}
                  <div className="flex items-center gap-1 rounded bg-surface border border-border-subtle p-0.5 text-[11px] font-mono">
                    <button
                      type="button"
                      onClick={() => setDiffView('unified')}
                      className={`px-2.5 py-1 rounded transition-colors ${
                        diffView === 'unified'
                          ? 'bg-surface-raised text-text-primary font-medium shadow-xs'
                          : 'text-text-muted hover:text-text-secondary'
                      }`}
                    >
                      Unified Diff
                    </button>
                    <button
                      type="button"
                      onClick={() => setDiffView('words')}
                      className={`px-2.5 py-1 rounded transition-colors ${
                        diffView === 'words'
                          ? 'bg-surface-raised text-text-primary font-medium shadow-xs'
                          : 'text-text-muted hover:text-text-secondary'
                      }`}
                    >
                      Word-Level Drift
                    </button>
                  </div>
                </div>

                {/* Verdict Explanation */}
                <p className="text-xs text-text-secondary leading-relaxed font-sans">
                  Assertion was true until 2023-06-01; marked stale for target evaluation date 2026-11-16.
                </p>

                {/* Surgical Correction Diff Box */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-mono text-text-muted">
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--af-sage)]" />
                      <span className="uppercase tracking-wider">Verified Surgical Correction</span>
                    </span>
                    <span className="text-[10px] text-text-muted">Deterministic Diff</span>
                  </div>

                  {diffView === 'unified' ? (
                    /* Git-style Unified Diff Display */
                    <pre className="rounded-lg border border-border-subtle/90 bg-[#0d0e10] p-4 text-xs font-mono leading-relaxed overflow-x-auto">
                      <div className="text-rose-400 bg-rose-500/10 px-2 py-1 rounded-sm border-l-2 border-rose-500 mb-1.5">
                        - Twitter Enterprise API access costs $42,000/month for firehose data stream access.
                      </div>
                      <div className="text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-sm border-l-2 border-emerald-500">
                        + Developer tiers: Basic ($100/mo), Pro ($5,000/mo), Custom Enterprise.
                      </div>
                    </pre>
                  ) : (
                    /* Word-Level Token Drift Highlight Display */
                    <div className="rounded-lg border border-border-subtle bg-[#0d0e10] p-4 text-xs font-mono space-y-2.5">
                      <div className="flex flex-wrap items-center gap-1.5 leading-relaxed">
                        <span className="text-[10px] uppercase font-bold text-text-muted tracking-wider block w-full mb-1">
                          Asserted Proposition (Drifted):
                        </span>
                        <span className="line-through px-1.5 py-0.5 rounded bg-status-outdated-bg text-status-outdated-text border border-status-outdated-border/60">
                          Twitter Enterprise API access costs $42,000/month for firehose data stream access.
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 leading-relaxed pt-2 border-t border-border-subtle/50">
                        <span className="text-[10px] uppercase font-bold text-text-muted tracking-wider block w-full mb-1">
                          Authoritative Discovered Truth (Now):
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-status-supported-bg text-status-supported-text border border-status-supported-border/60 font-semibold">
                          Developer tiers: Basic ($100/mo), Pro ($5,000/mo), Custom Enterprise.
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* Case B: Stripe Pricing Jurisdictional Boundaries */
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
                {/* Node 1: Domestic US */}
                <div className="p-5 rounded-xl bg-surface-raised/80 border border-border-subtle space-y-3 hover:border-border-strong transition-colors">
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-text-muted uppercase tracking-wider font-semibold">
                      01 // DOMESTIC US RATE
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] bg-status-supported-bg border border-status-supported-border text-status-supported-text font-bold">
                      SUPPORTED
                    </span>
                  </div>
                  <p className="text-sm text-text-primary font-medium leading-relaxed font-sans">
                    2.9% + 30¢ per online card transaction remains the official standard schedule in the US.
                  </p>
                  <div className="pt-2 border-t border-border-subtle/50 text-[11px] font-mono text-text-muted space-y-0.5">
                    <div>Jurisdiction: United States (US)</div>
                    <div className="text-[10px]">Verified: stripe.com/pricing</div>
                  </div>
                </div>

                {/* Node 2: Regulatory Boundary */}
                <div className="p-5 rounded-xl bg-surface-raised/50 border border-accent/30 space-y-3">
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-accent uppercase tracking-wider font-semibold">
                      02 // BOUNDARY QUALIFIER
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] bg-accent/10 border border-accent/30 text-accent font-medium">
                      QUALIFIER MATCH
                    </span>
                  </div>
                  <p className="text-sm text-text-primary font-medium leading-relaxed font-sans">
                    EU Interchange Fee Regulation (IFR) caps domestic European consumer interchange rates.
                  </p>
                  <div className="pt-2 border-t border-border-subtle/50 text-[11px] font-mono text-text-muted space-y-0.5">
                    <div>Cap: 0.2% debit / 0.3% credit</div>
                    <div className="text-[10px]">EU Regulation 2015/751</div>
                  </div>
                </div>

                {/* Node 3: UK & EEA Rate */}
                <div className="p-5 rounded-xl bg-surface-raised/80 border border-border-subtle space-y-3 hover:border-border-strong transition-colors">
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-text-muted uppercase tracking-wider font-semibold">
                      03 // UK / EEA JURISDICTION
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] bg-status-supported-bg border border-status-supported-border text-status-supported-text font-bold">
                      SUPPORTED
                    </span>
                  </div>
                  <p className="text-sm text-text-primary font-medium leading-relaxed font-sans">
                    1.4% + 20p applies strictly to standard UK & European Economic Area cards.
                  </p>
                  <div className="pt-2 border-t border-border-subtle/50 text-[11px] font-mono text-text-muted space-y-0.5">
                    <div>Jurisdiction: United Kingdom & EEA</div>
                    <div className="text-[10px]">Verified: stripe.com/gb/pricing</div>
                  </div>
                </div>
              </div>

              {/* Supported Verdict Summary Box */}
              <div className="rounded-xl border border-border-subtle bg-surface-raised/90 p-5 sm:p-6 space-y-3">
                <div className="flex flex-wrap items-center gap-2.5 text-xs font-mono">
                  <span className="px-2 py-0.5 rounded bg-status-supported-bg border border-status-supported-border text-status-supported-text uppercase font-bold tracking-wider">
                    SUPPORTED (SCORE: 100)
                  </span>
                  <span className="text-text-muted">·</span>
                  <span className="text-accent font-semibold tracking-wider">
                    QUALIFIER_BOUNDED_TRUTH
                  </span>
                </div>
                <p className="text-xs text-text-secondary leading-relaxed font-sans">
                  No decay detected. Assertions are currently valid with exact currency & jurisdiction matching. Cross-regional claims without jurisdiction qualifiers correctly branch to context resolution rather than false contradiction.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* 5-State Verdict Taxonomy Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {VERDICT_STATES.map((state) => (
            <div
              key={state.key}
              className="p-5 rounded-xl bg-surface/60 border border-border-subtle hover:border-border-strong transition-colors flex flex-col justify-between space-y-3"
            >
              <div className="space-y-2">
                <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono font-semibold tracking-wider ${state.badgeClass}`}>
                  {state.title}
                </span>
                <p className="text-xs text-text-secondary leading-relaxed font-light">
                  {state.summary}
                </p>
              </div>
              <div className="pt-2 border-t border-border-subtle/50 text-[10px] font-mono text-text-muted">
                STATUS: {state.temporalStatus}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
