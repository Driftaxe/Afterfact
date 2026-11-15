import React from 'react';

export function EvidenceSection() {
  return (
    <section id="evidence" className="py-24 sm:py-32 border-b border-border-subtle relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="max-w-3xl space-y-4 mb-16 sm:mb-20">
          <div className="text-[11px] font-mono tracking-[0.2em] uppercase text-accent">
            03 // EVIDENCE GRAPH INTELLIGENCE
          </div>
          <h2 className="font-serif text-3xl sm:text-5xl lg:text-6xl font-normal tracking-tight text-text-primary leading-[1.1]">
            From raw web byte to verified decision.
          </h2>
          <p className="text-sm sm:text-base text-text-secondary leading-relaxed font-light">
            Every verdict is anchored to immutable database records. If an assertion cannot be traced to a verbatim
            passage retrieved from an authoritative publisher, the system fails closed.
          </p>
        </div>

        {/* Relational Entity Pipeline Demonstration */}
        <div className="rounded-2xl bg-surface border border-border-strong p-6 sm:p-10 shadow-2xl space-y-10">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 relative">
            {/* Step 1: Claim Record */}
            <div className="space-y-3 p-4 rounded-xl bg-surface-raised/50 border border-border-subtle">
              <div className="flex items-center justify-between text-[10px] font-mono text-text-muted">
                <span>ENTITY 01</span>
                <span className="text-accent">clm_9a8f2e_1</span>
              </div>
              <h3 className="font-mono text-xs font-semibold uppercase text-text-primary">
                Atomic Claim
              </h3>
              <p className="text-xs text-text-secondary leading-relaxed">
                Normalized natural language proposition decomposed from the user input with exact character span bounds.
              </p>
              <div className="text-[10px] font-mono text-text-muted pt-2 border-t border-border-subtle/50">
                TABLE: `claims`
              </div>
            </div>

            {/* Step 2: Source Document */}
            <div className="space-y-3 p-4 rounded-xl bg-surface-raised/50 border border-border-subtle">
              <div className="flex items-center justify-between text-[10px] font-mono text-text-muted">
                <span>ENTITY 02</span>
                <span className="text-status-supported-text">HTTP 200 OK</span>
              </div>
              <h3 className="font-mono text-xs font-semibold uppercase text-text-primary">
                Source Document
              </h3>
              <p className="text-xs text-text-secondary leading-relaxed">
                Immutable full-page crawl snapshot with SHA-256 content hash, authoritative publisher domain, and HTTP metadata.
              </p>
              <div className="text-[10px] font-mono text-text-muted pt-2 border-t border-border-subtle/50">
                TABLE: `source_documents`
              </div>
            </div>

            {/* Step 3: Evidence Unit */}
            <div className="space-y-3 p-4 rounded-xl bg-surface-raised/50 border border-border-subtle">
              <div className="flex items-center justify-between text-[10px] font-mono text-text-muted">
                <span>ENTITY 03</span>
                <span className="text-accent">VERBATIM QUOTE</span>
              </div>
              <h3 className="font-mono text-xs font-semibold uppercase text-text-primary">
                Evidence Unit
              </h3>
              <p className="text-xs text-text-secondary leading-relaxed">
                Context-preserving excerpt retaining enclosing section headings, table columns, and conditional caveats.
              </p>
              <div className="text-[10px] font-mono text-text-muted pt-2 border-t border-border-subtle/50">
                TABLE: `evidence_units`
              </div>
            </div>

            {/* Step 4: Decision Record */}
            <div className="space-y-3 p-4 rounded-xl bg-surface-raised/50 border border-border-subtle">
              <div className="flex items-center justify-between text-[10px] font-mono text-text-muted">
                <span>ENTITY 04</span>
                <span className="text-status-supported-text">VERIFIED</span>
              </div>
              <h3 className="font-mono text-xs font-semibold uppercase text-text-primary">
                Decision Record
              </h3>
              <p className="text-xs text-text-secondary leading-relaxed">
                Deterministic policy evaluation calculating score [0..100], stance alignment, and temporal validity status.
              </p>
              <div className="text-[10px] font-mono text-text-muted pt-2 border-t border-border-subtle/50">
                TABLE: `decision_records`
              </div>
            </div>
          </div>

          {/* Code Inspection Sample Box */}
          <div className="p-4 sm:p-5 rounded-xl bg-background border border-border-subtle font-mono text-[11px] space-y-2 overflow-x-auto">
            <div className="flex items-center justify-between text-text-muted border-b border-border-subtle pb-2">
              <span>SQL INVARIANT ENFORCEMENT // ADR-018</span>
              <span className="text-status-supported-text">STRICT RELATIONSHIP INTEGRITY</span>
            </div>
            <pre className="text-text-secondary text-[11px] leading-relaxed">
              <code>{`-- Every decision must cite at least one verified evidence unit from an authoritative source
SELECT d.id, c.text AS claim_text, e.verbatim_text, s.url, d.verdict_status, d.confidence
FROM decision_records d
JOIN claims c ON d.claim_id = c.id
JOIN claim_evidence_assessments a ON a.claim_id = c.id
JOIN evidence_units e ON a.evidence_unit_id = e.id
JOIN source_documents s ON e.document_id = s.id
WHERE d.verdict_status = 'SUPPORTED' AND a.quotation_verified = true;`}</code>
            </pre>
          </div>
        </div>
      </div>
    </section>
  );
}
