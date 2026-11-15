'use client';

import React, { useState } from 'react';

const VERDICT_STATES = [
  {
    key: 'supported',
    title: 'SUPPORTED',
    badgeClass: 'bg-status-supported-bg border-status-supported-border text-status-supported-text',
    summary: 'The claim is directly confirmed by authoritative evidence valid on the target evaluation date.',
    example: 'Stripe charges 2.9% + 30¢ for standard card processing in the US in 2026.',
    temporalStatus: 'CURRENT',
  },
  {
    key: 'outdated',
    title: 'OUTDATED',
    badgeClass: 'bg-status-outdated-bg border-status-outdated-border text-status-outdated-text',
    summary: 'The claim was factual in the past, but has been superseded by a documented transition event.',
    example: 'Parag Agrawal is the current CEO of Twitter (Valid in 2021; Superseded October 2022).',
    temporalStatus: 'HISTORICAL',
  },
  {
    key: 'contradicted',
    title: 'CONTRADICTED',
    badgeClass: 'bg-status-contradicted-bg border-status-contradicted-border text-status-contradicted-text',
    summary: 'The claim is directly refuted by authoritative documentation or historical records.',
    example: 'Stripe does not charge per-transaction fees on credit card transactions.',
    temporalStatus: 'REFUTED',
  },
  {
    key: 'context_dependent',
    title: 'CONTEXT-DEPENDENT',
    badgeClass: 'bg-status-unresolved-bg border-status-unresolved-border text-status-unresolved-text',
    summary: 'The veracity depends on a missing material qualifier such as geographic jurisdiction or SDK tier.',
    example: 'Standard processing is 1.4% + 20p (True only in the UK, false in the US).',
    temporalStatus: 'QUALIFIER REQUIRED',
  },
  {
    key: 'unresolved',
    title: 'INSUFFICIENT EVIDENCE',
    badgeClass: 'bg-status-checking-bg border-status-checking-border text-status-checking-text',
    summary: 'No primary authority or reliable web source was found to conclusively confirm or refute the claim.',
    example: 'Internal unannounced roadmaps or confidential operational metrics.',
    temporalStatus: 'OPEN',
  },
];

export function TemporalSection() {
  const [activeTab, setActiveTab] = useState<'outdated' | 'supported'>('outdated');

  return (
    <section id="architecture" className="py-24 sm:py-32 border-b border-border-subtle bg-surface/30 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="max-w-3xl space-y-4 mb-16 sm:mb-20">
          <div className="text-[11px] font-mono tracking-[0.2em] uppercase text-accent">
            04 // TEMPORAL VERDICT TAXONOMY
          </div>
          <h2 className="font-serif text-3xl sm:text-5xl lg:text-6xl font-normal tracking-tight text-text-primary leading-[1.1]">
            Temporal intelligence in practice.
          </h2>
          <p className="text-sm sm:text-base text-text-secondary leading-relaxed font-light">
            Truth is not a static binary. A fact true in 2021 can become false today without ever having been a lie.
            Afterfact reasons over transition events and effective dates.
          </p>
        </div>

        {/* Interactive Then vs. Now Chronology Showcase */}
        <div className="rounded-2xl bg-surface border border-border-strong p-6 sm:p-10 shadow-2xl mb-16 space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border-subtle">
            <div className="space-y-1">
              <span className="text-[10px] font-mono text-text-muted uppercase tracking-wider block">
                CASE STUDY // REAL-WORLD TEMPORAL SHIFT
              </span>
              <h3 className="text-base sm:text-lg font-serif text-text-primary font-normal">
                {activeTab === 'outdated'
                  ? 'Leadership Transition: Twitter CEO Verification'
                  : 'Pricing Schedule: Stripe European Interchange'}
              </h3>
            </div>

            <div className="flex items-center gap-2 p-1 rounded-xl bg-surface-raised border border-border-subtle self-start sm:self-center">
              <button
                type="button"
                onClick={() => setActiveTab('outdated')}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono tracking-wider uppercase transition-all ${
                  activeTab === 'outdated'
                    ? 'bg-surface text-text-primary shadow-sm font-semibold'
                    : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                Case A: Twitter CEO
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('supported')}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono tracking-wider uppercase transition-all ${
                  activeTab === 'supported'
                    ? 'bg-surface text-text-primary shadow-sm font-semibold'
                    : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                Case B: Stripe Pricing
              </button>
            </div>
          </div>

          {activeTab === 'outdated' ? (
            <div className="space-y-6">
              {/* Timeline Horizontal Track */}
              <div className="relative pl-6 sm:pl-0">
                <div className="hidden sm:block absolute top-1/2 left-0 right-0 h-0.5 bg-border-subtle -translate-y-1/2 z-0" />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 relative z-10">
                  {/* Point 1: Historical State */}
                  <div className="p-4 rounded-xl bg-surface-raised border border-border-subtle space-y-2">
                    <div className="flex items-center justify-between text-[10px] font-mono">
                      <span className="text-text-muted">2021-11-29</span>
                      <span className="text-status-supported-text">VERIFIED THEN</span>
                    </div>
                    <p className="text-xs text-text-primary font-medium">
                      Parag Agrawal appointed CEO of Twitter following Jack Dorsey resignation.
                    </p>
                    <span className="text-[10px] font-mono text-text-muted block">Source: PR Newswire / SEC 8-K</span>
                  </div>

                  {/* Point 2: Transition Event */}
                  <div className="p-4 rounded-xl bg-status-outdated-bg/40 border border-status-outdated-border space-y-2">
                    <div className="flex items-center justify-between text-[10px] font-mono">
                      <span className="text-status-outdated-text">2022-10-27</span>
                      <span className="text-status-outdated-text">TRANSITION EVENT</span>
                    </div>
                    <p className="text-xs text-text-primary font-medium">
                      Acquisition closes; Agrawal departs. Elon Musk assumes executive control.
                    </p>
                    <span className="text-[10px] font-mono text-status-outdated-text block font-semibold">
                      SUPERSEDED AS OF THIS DATE
                    </span>
                  </div>

                  {/* Point 3: Current State */}
                  <div className="p-4 rounded-xl bg-surface-raised border border-border-subtle space-y-2">
                    <div className="flex items-center justify-between text-[10px] font-mono">
                      <span className="text-text-muted">2026 (NOW)</span>
                      <span className="text-status-supported-text">CURRENT REALITY</span>
                    </div>
                    <p className="text-xs text-text-primary font-medium">
                      Linda Yaccarino serves as Chief Executive Officer of X Corp.
                    </p>
                    <span className="text-[10px] font-mono text-text-muted block">Source: X Corp Press Office</span>
                  </div>
                </div>
              </div>

              {/* Verdict Summary Box */}
              <div className="p-4 rounded-xl bg-background border border-border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
                <div className="flex items-center gap-3">
                  <span className="px-2 py-0.5 rounded bg-status-outdated-bg border border-status-outdated-border text-status-outdated-text uppercase font-semibold">
                    OUTDATED
                  </span>
                  <span className="text-text-secondary">
                    Proposition was factual until 2022-10-27; stale for target evaluation date 2026-11-12.
                  </span>
                </div>
                <span className="text-accent text-[11px]">Surgical Correction Generated →</span>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Case B: Supported Timeline */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="p-5 rounded-xl bg-surface-raised border border-border-subtle space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-mono text-text-muted">
                    <span>DOMESTIC US RATE</span>
                    <span className="text-status-supported-text">CONFIRMED ACTIVE</span>
                  </div>
                  <p className="text-sm text-text-primary font-medium">
                    2.9% + 30¢ per online card transaction remains the official standard schedule in the US.
                  </p>
                  <span className="text-[10px] font-mono text-text-muted block">
                    Verified against stripe.com/pricing on 2026-11-12
                  </span>
                </div>

                <div className="p-5 rounded-xl bg-surface-raised border border-border-subtle space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-mono text-text-muted">
                    <span>UK / EUROPEAN JURISDICTION</span>
                    <span className="text-accent">QUALIFIER MATCH</span>
                  </div>
                  <p className="text-sm text-text-primary font-medium">
                    1.4% + 20p applies strictly to standard UK & European Economic Area cards.
                  </p>
                  <span className="text-[10px] font-mono text-text-muted block">
                    Verified against stripe.com/gb/pricing on 2026-11-12
                  </span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-background border border-border-subtle flex items-center gap-3 text-xs font-mono">
                <span className="px-2 py-0.5 rounded bg-status-supported-bg border border-status-supported-border text-status-supported-text uppercase font-semibold">
                  SUPPORTED (100)
                </span>
                <span className="text-text-secondary">
                  No decay detected. Assertions are currently valid with exact currency & jurisdiction matching.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* 5-State Verdict Taxonomy Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {VERDICT_STATES.map((state) => (
            <div
              key={state.key}
              className="p-5 rounded-2xl bg-surface border border-border-subtle flex flex-col justify-between space-y-3"
            >
              <div className="space-y-2">
                <span className={`inline-block px-2 py-0.5 rounded border text-[10px] font-mono font-semibold tracking-wider ${state.badgeClass}`}>
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
