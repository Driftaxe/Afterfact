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

  return (
    <section id="architecture" className="scroll-mt-20 sm:scroll-mt-24 py-20 sm:py-28 border-b border-border-subtle bg-surface/30 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="max-w-3xl space-y-4 mb-16 sm:mb-20">
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

        {/* Interactive Then vs. Now Chronology Showcase */}
        <div className="rounded-xl bg-surface border border-border-strong p-6 sm:p-8 shadow-2xl mb-16 space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border-subtle">
            <div className="space-y-1">
              <span className="text-[10px] font-mono text-text-muted uppercase tracking-wider block">
                CASE STUDY // REAL-WORLD TEMPORAL SHIFT
              </span>
              <h3 className="text-base sm:text-lg font-sans text-text-primary font-medium tracking-tight">
                {activeTab === 'outdated'
                  ? 'Pricing Restructure: Twitter/X Enterprise API Transition'
                  : 'Pricing Schedule: Stripe European Interchange'}
              </h3>
            </div>

            <div className="flex items-center gap-2 p-1 rounded-md bg-surface-raised border border-border-subtle self-start sm:self-center">
              <button
                type="button"
                onClick={() => setActiveTab('outdated')}
                className={`px-3 py-1.5 rounded-sm text-xs font-mono tracking-wider uppercase transition-all ${
                  activeTab === 'outdated'
                    ? 'bg-surface text-text-primary shadow-sm font-semibold'
                    : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                Case A: Twitter API
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('supported')}
                className={`px-3 py-1.5 rounded-sm text-xs font-mono tracking-wider uppercase transition-all ${
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
                  <div className="p-4 rounded-md bg-surface-raised border border-border-subtle space-y-2">
                    <div className="flex items-center justify-between text-[10px] font-mono">
                      <span className="text-text-muted">HISTORICAL (2021)</span>
                      <span className="text-status-supported-text">VERIFIED THEN</span>
                    </div>
                    <p className="text-xs text-text-primary font-medium">
                      Twitter Enterprise API access costs $42,000/month for firehose data stream access.
                    </p>
                    <span className="text-[10px] font-mono text-text-muted block">Policy Effective: 2021-03-29</span>
                  </div>

                  {/* Point 2: Transition Event */}
                  <div className="p-4 rounded-md bg-status-outdated-bg/40 border border-status-outdated-border space-y-2">
                    <div className="flex items-center justify-between text-[10px] font-mono">
                      <span className="text-status-outdated-text">TRANSITION EVENT</span>
                      <span className="text-status-outdated-text">SUPERSEDED</span>
                    </div>
                    <p className="text-xs text-text-primary font-medium">
                      X Developer Platform restructuring introduces new Basic and Pro tiers.
                    </p>
                    <span className="text-[10px] font-mono text-status-outdated-text block font-semibold">
                      Effective Date: June 1, 2023
                    </span>
                  </div>

                  {/* Point 3: Current State */}
                  <div className="p-4 rounded-md bg-surface-raised border border-border-subtle space-y-2">
                    <div className="flex items-center justify-between text-[10px] font-mono">
                      <span className="text-text-muted">CURRENT (2026)</span>
                      <span className="text-status-supported-text">CURRENT REALITY</span>
                    </div>
                    <p className="text-xs text-text-primary font-medium">
                      Developer tiers: Basic ($100/mo), Pro ($5,000/mo), Custom Enterprise.
                    </p>
                    <span className="text-[10px] font-mono text-text-muted block">Source: developer.x.com</span>
                  </div>
                </div>
              </div>

              {/* Verdict Summary Box */}
              <div className="p-4 rounded-md bg-background border border-border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
                <div className="flex items-center gap-3">
                  <span className="px-2 py-0.5 rounded-sm bg-status-outdated-bg border border-status-outdated-border text-status-outdated-text uppercase font-semibold">
                    OUTDATED (SCORE: 0)
                  </span>
                  <span className="text-text-secondary">
                    Assertion was true until 2023-06-01; marked stale for target evaluation date 2026-11-16.
                  </span>
                </div>
                <span className="text-accent text-[11px]">Surgical Correction Generated →</span>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Case B: Supported Timeline */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="p-5 rounded-md bg-surface-raised border border-border-subtle space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-mono text-text-muted">
                    <span>DOMESTIC US RATE</span>
                    <span className="text-status-supported-text">CONFIRMED ACTIVE</span>
                  </div>
                  <p className="text-sm text-text-primary font-medium">
                    2.9% + 30¢ per online card transaction remains the official standard schedule in the US.
                  </p>
                  <span className="text-[10px] font-mono text-text-muted block">
                    Verified against stripe.com/pricing on 2026-11-16
                  </span>
                </div>

                <div className="p-5 rounded-md bg-surface-raised border border-border-subtle space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-mono text-text-muted">
                    <span>UK / EUROPEAN JURISDICTION</span>
                    <span className="text-accent">QUALIFIER MATCH</span>
                  </div>
                  <p className="text-sm text-text-primary font-medium">
                    1.4% + 20p applies strictly to standard UK & European Economic Area cards.
                  </p>
                  <span className="text-[10px] font-mono text-text-muted block">
                    Verified against stripe.com/gb/pricing on 2026-11-16
                  </span>
                </div>
              </div>

              <div className="p-4 rounded-md bg-background border border-border-subtle flex items-center gap-3 text-xs font-mono">
                <span className="px-2 py-0.5 rounded-sm bg-status-supported-bg border border-status-supported-border text-status-supported-text uppercase font-semibold">
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
              className="p-5 rounded-md bg-surface border border-border-subtle flex flex-col justify-between space-y-3"
            >
              <div className="space-y-2">
                <span className={`inline-block px-2 py-0.5 rounded-sm border text-[10px] font-mono font-semibold tracking-wider ${state.badgeClass}`}>
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
