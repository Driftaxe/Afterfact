'use client';

import React from 'react';

export function EvidenceSection() {
  const chainSteps = [
    {
      step: '01',
      title: 'Atomic Claim',
      table: 'TABLE: `claims`',
      desc: 'Normalized natural language proposition decomposed from the user input with exact character span bounds.',
      badge: 'clm_9a8f2e_1',
    },
    {
      step: '02',
      title: 'Source Document',
      table: 'TABLE: `source_documents`',
      desc: 'Canonical URL retrieved from primary publisher authority with crawl timestamp and HTTP status.',
      badge: 'doc_4b71c0_a',
    },
    {
      step: '03',
      title: 'Evidence Passage',
      table: 'TABLE: `evidence_units`',
      desc: 'Verbatim text excerpt containing surrounding context headers, tables, and exact quote matches.',
      badge: 'evi_88d3f1_9',
    },
    {
      step: '04',
      title: 'Evidence Assessment',
      table: 'TABLE: `assessments`',
      desc: 'Semantic stance analysis (supports, contradicts, neutral) evaluating effective date versus target date.',
      badge: 'asm_3c19e4_7',
    },
    {
      step: '05',
      title: 'Decision Record',
      table: 'TABLE: `decisions`',
      desc: 'Deterministic verdict scoring (100, 75, 0, null) with surgical claim-by-claim transition explanation.',
      badge: 'dec_6f02a8_b',
    },
  ];

  return (
    <section id="evidence" className="py-20 sm:py-28 border-b border-border-subtle relative overflow-hidden bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="max-w-3xl space-y-4 mb-16 sm:mb-20">
          <div className="text-[11px] font-mono tracking-[0.2em] uppercase text-accent">
            04 // EVIDENCE INTELLIGENCE
          </div>
          <h2 className="font-serif text-3xl sm:text-5xl lg:text-6xl font-normal tracking-tight text-text-primary leading-[1.1]">
            From raw web byte to verified decision.
          </h2>
          <p className="text-sm sm:text-base text-text-secondary leading-relaxed font-light">
            Every verdict is anchored to immutable database records. If an assertion cannot be traced to a verbatim
            passage retrieved from an authoritative publisher, the system fails closed.
          </p>
        </div>

        {/* 5-Link Architectural Evidence Chain */}
        <div className="rounded-xl bg-surface border border-border-strong p-6 sm:p-8 shadow-2xl space-y-8">
          <div className="flex items-center justify-between border-b border-border-subtle pb-4 text-xs font-mono">
            <span className="text-text-secondary uppercase tracking-wider">
              EVIDENCE PROVENANCE GRAPH // RELATIONAL DAG CHAIN
            </span>
            <span className="text-status-supported-text flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-status-supported-text" />
              INVARIANT P10 ENFORCED
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 relative">
            {chainSteps.map((item) => (
              <div
                key={item.step}
                className="space-y-3 p-4 rounded-md bg-surface-raised/60 border border-border-subtle flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-mono text-text-muted">
                    <span className="text-accent font-semibold">{`${item.step} //`}</span>
                    <span className="font-mono text-text-secondary">{item.badge}</span>
                  </div>
                  <h3 className="font-mono text-xs font-semibold uppercase text-text-primary">
                    {item.title}
                  </h3>
                  <p className="text-xs text-text-secondary leading-relaxed">
                    {item.desc}
                  </p>
                </div>
                <div className="text-[10px] font-mono text-text-muted pt-2 border-t border-border-subtle/50">
                  {item.table}
                </div>
              </div>
            ))}
          </div>

          {/* Database Invariant Lock Card */}
          <div className="rounded-md bg-surface-raised/40 border border-border-subtle p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono text-text-muted">
            <div className="flex items-center gap-2">
              <span className="text-status-supported-text font-bold">✓</span>
              <span>FOREIGN KEY INTEGRITY: All citations bind to persistent PostgreSQL records with lease locking.</span>
            </div>
            <span className="text-text-primary">NEON POSTGRESQL · PRISMA MIGRATIONS</span>
          </div>
        </div>
      </div>
    </section>
  );
}
