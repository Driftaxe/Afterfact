import React from 'react';

const PIPELINE_STAGES = [
  {
    step: '01',
    title: 'CLAIM EXTRACTION',
    category: 'DECOMPOSITION',
    description:
      'Candidate answers are split into atomic propositions. Each assertion is anchored to exact UTF-16 character offsets with preserved negation, numerical bounds, and typed context qualifiers.',
    badge: 'extractClaimsFromText',
  },
  {
    step: '02',
    title: 'RESEARCH & RETRIEVAL',
    category: 'PROVENANCE',
    description:
      'Formulates targeted search queries aimed at primary authorities (official documentation, regulatory registries, verified press releases) using budgeted live Tavily endpoints.',
    badge: 'tavilySearch',
  },
  {
    step: '03',
    title: 'EVIDENCE ASSESSMENT',
    category: 'GROUNDING',
    description:
      'Extracts context-preserving passages retaining parent headers, tables, and conditionals. Classifies semantic stance (supports, contradicts, neutral) with strict quote verification.',
    badge: 'assessEvidence',
  },
  {
    step: '04',
    title: 'TEMPORAL REASONING',
    category: 'CHRONOLOGY',
    description:
      'Separates effective dates from publication dates. Analyzes whether a historically true statement was superseded before the target evaluation date to flag temporal decay.',
    badge: 'evaluateTemporalStatus',
  },
  {
    step: '05',
    title: 'DECISION & REPORTING',
    category: 'DETERMINISTIC SCORE',
    description:
      'Rules-based policy engine applies score fencing and derives transitions. Assembles a permanent, cryptographically auditable report with surgical claim-by-claim corrections.',
    badge: 'decideClaim',
  },
];

export function PipelineSection() {
  return (
    <section id="how-it-works" className="py-24 sm:py-32 border-b border-border-subtle bg-surface/30 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="max-w-3xl space-y-4 mb-16 sm:mb-20">
          <div className="text-[11px] font-mono tracking-[0.2em] uppercase text-accent">
            02 // PERSISTED DAG PIPELINE
          </div>
          <h2 className="font-serif text-3xl sm:text-5xl lg:text-6xl font-normal tracking-tight text-text-primary leading-[1.1]">
            How verification works.
          </h2>
          <p className="text-sm sm:text-base text-text-secondary leading-relaxed font-light">
            Every verification run executes as a dynamically expanding directed acyclic graph in PostgreSQL,
            governed by database leases and lease-fenced distributed worker dispatches.
          </p>
        </div>

        {/* Sequential 5-Stage Step Rail */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 lg:gap-4">
          {PIPELINE_STAGES.map((stage) => (
            <div
              key={stage.step}
              className="rounded-2xl bg-surface border border-border-subtle hover:border-border-strong p-5 sm:p-6 shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col justify-between space-y-4 group"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xl sm:text-2xl font-light text-text-primary group-hover:text-accent transition-colors">
                    {stage.step}
                  </span>
                  <span className="text-[9px] font-mono tracking-widest uppercase text-text-muted px-2 py-0.5 rounded bg-surface-raised border border-border-subtle">
                    {stage.category}
                  </span>
                </div>

                <h3 className="font-mono text-xs sm:text-sm font-semibold tracking-wider text-text-primary uppercase pt-1">
                  {stage.title}
                </h3>

                <p className="text-xs text-text-secondary leading-relaxed font-light">
                  {stage.description}
                </p>
              </div>

              <div className="pt-3 border-t border-border-subtle/60">
                <span className="text-[10px] font-mono text-accent/90 block truncate">
                  fn: {stage.badge}()
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
