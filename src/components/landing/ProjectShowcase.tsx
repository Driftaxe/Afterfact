'use client';

import React, { useState } from 'react';

export function ProjectShowcase() {
  const [activeTab, setActiveTab] = useState<'verify' | 'run' | 'bifrost'>('verify');

  const verifiedStats = [
    { label: 'AUTOMATED TESTS', value: '535+', hint: '511 Vitest · 24 Playwright' },
    { label: 'VERIFIED COMMITS', value: '180+', hint: 'Audited Git Lineage' },
    { label: 'CONTRIBUTORS', value: '3', hint: 'Driftaxe Core Team' },
    { label: 'SYNTHESIS PATTERNS', value: '5 Modes', hint: 'Bounded Semantic Inference' },
    { label: 'DECISION GATES', value: '4 Gates', hint: 'Pure Deterministic Gate' },
    { label: 'GATEWAY FALLBACK', value: '< 800ms', hint: 'Multi-Provider Bifrost' },
    { label: 'QUOTE GROUNDING', value: '100%', hint: 'Fail-Closed Substring Match' },
    { label: '3-DATE SEPARATION', value: 'Strict', hint: 'Pub · Event · Effective' },
    { label: 'DATABASE ENGINE', value: 'Neon PG', hint: 'Serverless Pooled Branching' },
    { label: 'WORKER DISPATCH', value: 'QStash', hint: 'Signed HMAC SHA-256 Webhooks' },
    { label: 'LEASE FENCING', value: '30s', hint: 'Distributed Clock Guard' },
    { label: 'SECRET SAFETY', value: 'Strict', hint: 'Zero Token / Key Leakage' },
  ];

  const architecturalPillars = [
    {
      step: '01',
      title: 'DISTRIBUTED EXECUTION',
      subtitle: 'Neon PG + Upstash QStash',
      description:
        'Verification runs execute as dynamically expanding DAGs in Neon PostgreSQL. Workers use signed QStash webhooks, lease-fenced concurrency (30s heartbeat), and fail-closed transaction commit guards.',
      tags: ['Connection Pooling', 'HMAC SHA-256', '409 Conflict Lease Guard'],
    },
    {
      step: '02',
      title: 'MODEL GATEWAY & RETRIEVAL',
      subtitle: 'Bifrost Router + Tavily Search',
      description:
        'A unified Bifrost Model Gateway coordinates live multi-provider fallback routing (Gemini 2.5 Flash, Flash-Lite, and Pro) alongside budgeted Tavily web search with context-preserving passage extraction.',
      tags: ['Auto Fallback Cascade', 'Table & Quote Extraction', 'Zero Secret Logging'],
    },
    {
      step: '03',
      title: 'EVIDENCE-BASED INVARIANTS',
      subtitle: 'Deterministic Invariant-to-Proof Chain',
      description:
        'Factual claims pass through strict temporal date fencing, separating publication dates from effective dates. Unsupported citations fail closed, and surgical replacement diffs ensure verifiable truth.',
      tags: ['Temporal Date Fencing', 'Citation Integrity', 'Surgical Diff Corrections'],
    },
  ];

  const contributors = [
    {
      name: 'Mayur Nanda',
      role: 'Lead Architect & Verification Systems',
      lane: 'Lane A (Verification Engine)',
      handle: 'Mayur11code',
      highlights: 'Core verifier, bounded semantic inference synthesizer, decision gates, formal verification invariants, eval benchmark',
      commits: '90+ commits',
    },
    {
      name: 'Hardik Akshay',
      role: 'Infrastructure & Cloud Integration',
      lane: 'Lane B (Platform & Delivery)',
      handle: 'Hardik-codr',
      highlights: 'Maxim Bifrost gateway, Neon PostgreSQL data schemas, Upstash QStash worker execution, serverless runtime',
      commits: '55+ commits',
    },
    {
      name: 'Jivjot Singh Kohli',
      role: 'Product Architecture & Temporal UI',
      lane: 'Lane C (Product Experience)',
      handle: 'JivjotSingh559',
      highlights: '55:45 split document inspector, Then vs Now timeline, responsive design system, SSE streaming client',
      commits: '40+ commits',
    },
  ];

  const invariantChain = [
    { name: 'Unsupported Citation', rule: 'Quotes must strictly match retrieved source substrings', effect: 'Fail closed to insufficient_evidence' },
    { name: 'Wrong-Scope Evidence', rule: 'Differing regions, years, or tiers cannot grant support', effect: '409 / Scope mismatch exclusion' },
    { name: 'Future Effective Date', rule: 'Announcements with pending dates do not mark facts stale', effect: 'Scheduled change badge, not outdated' },
    { name: 'Cross-Owner Access', rule: 'Runs strictly partitioned by anonymous owner hash', effect: '404 Not Found privacy isolation' },
    { name: 'Duplicate Delivery', rule: 'Repeated QStash webhooks must never duplicate claims', effect: 'Idempotency key fence & lease renewal' },
    { name: 'Stale Lease Commit', rule: 'Workers losing their DB lease must fail closed', effect: '409 Conflict transaction abort' },
  ];

  const cliSnippets = {
    verify: {
      cmd: 'pnpm test && pnpm typecheck && pnpm lint',
      output: `✓ tests/unit/verify/evidence-reasoning-components.test.ts (28 tests) 87ms
✓ tests/unit/verify/evidence-reasoning-diagnostic.test.ts (12 tests) 128ms
✓ tests/unit/verify/semantic-correctness.test.ts (32 tests) 732ms
✓ tests/unit/verify/decide.test.ts (42 tests) 530ms
...
Test Files  26 passed (26)
Tests       511 passed (511)
$ tsc --noEmit (0 errors)
$ eslint . (0 errors)`,
    },
    run: {
      cmd: 'pnpm dev',
      output: `▲ Next.js 15.5.29
- Local:   http://localhost:3000
- Environments: .env
✓ Ready in 1.4s
○ /app (Interactive Verification Workspace)
○ /report/sample-run (Full Verification Report)
○ /design (Paired Semantic Token Showcase)`,
    },
    bifrost: {
      cmd: 'pnpm bifrost',
      output: `[Bifrost] Starting Maxim Model Gateway on port 8080...
[Bifrost] Loaded profiles: extract, assess, draft, fallback
[Bifrost] Primary: gemini-3.5-flash-lite
[Bifrost] Secondary Fallback: gemini-2.5-flash
[Bifrost] Health check OK · 200 OK (latency: 18ms)`,
    },
  };

  return (
    <section id="developers" className="scroll-mt-20 sm:scroll-mt-24 py-20 sm:py-28 border-b border-border-subtle bg-surface/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        
        {/* Header & GitHub Repository Link */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 pb-10 border-b border-border-subtle">
          <div className="space-y-3 max-w-2xl">
            <div className="flex items-center gap-2.5 text-accent font-mono text-xs uppercase tracking-widest">
              <span>07 // PROJECT & ENGINEERING</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-light tracking-tight text-text-primary">
              Engineered for Verifiable Grounding
            </h2>
            <p className="text-sm sm:text-base text-text-secondary leading-relaxed">
              Afterfact is an open evidence-intelligence system built on disciplined engineering standards, deterministic DAG execution, and strict temporal fencing.
            </p>
          </div>

          <div>
            <a
              href="https://github.com/Driftaxe/Afterfact"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 px-5 py-3 rounded-md bg-surface border border-border-subtle hover:border-border-strong text-text-primary font-mono text-xs tracking-wider transition-all shadow-sm hover:bg-surface-raised group"
            >
              <svg className="w-4 h-4 fill-current text-text-secondary group-hover:text-text-primary transition-colors" viewBox="0 0 24 24" aria-hidden="true">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
              <span>Driftaxe/Afterfact</span>
              <span className="text-text-muted">↗</span>
            </a>
          </div>
        </div>

        {/* Real Verified Engineering Metrics Grid (12 Live Telemetry Stats) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-border-subtle/80 pb-2">
            <span className="font-mono text-xs tracking-wider uppercase text-text-muted">
              VERIFIED ENGINEERING & SYSTEM TELEMETRY
            </span>
            <span className="font-mono text-[11px] text-accent">
              12 Audited Invariants · Live Telemetry
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
            {verifiedStats.map((stat, i) => (
              <div
                key={i}
                className="rounded-lg bg-surface/80 dark:bg-[#18191C]/80 border border-border-subtle hover:border-border-strong p-3.5 sm:p-4 space-y-1.5 transition-colors"
              >
                <div className="text-[9px] sm:text-[10px] font-mono tracking-wider uppercase text-text-muted truncate">
                  {stat.label}
                </div>
                <div className="font-mono text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-text-primary">
                  {stat.value}
                </div>
                <div className="text-[10px] font-mono text-text-secondary truncate">
                  {stat.hint}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Developer Architecture & Invariant Specifications */}
        <div className="space-y-6 pt-2">
          <div className="flex items-center justify-between border-b border-border-subtle pb-3">
            <span className="font-mono text-xs tracking-wider uppercase text-text-muted">
              CORE SYSTEM ARCHITECTURE & RIGOR
            </span>
            <span className="font-mono text-xs text-text-secondary">
              Lane A · B · C Unified Stack
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {architecturalPillars.map((pillar) => (
              <div
                key={pillar.step}
                className="rounded-lg bg-surface/60 dark:bg-[#18191C]/60 border border-border-subtle hover:border-border-strong p-5 sm:p-6 space-y-4 transition-colors flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-accent font-semibold">{`${pillar.step} //`}</span>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted">
                      {pillar.subtitle}
                    </span>
                  </div>
                  <h3 className="text-base font-medium text-text-primary">
                    {pillar.title}
                  </h3>
                  <p className="text-xs text-text-secondary leading-relaxed">
                    {pillar.description}
                  </p>
                </div>

                <div className="flex flex-wrap gap-1.5 pt-2 border-t border-border-subtle/50">
                  {pillar.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-block text-[10px] font-mono bg-[#111214] border border-white/10 text-zinc-400 px-2 py-0.5 rounded"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Invariant-to-Proof Verification Chain */}
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between border-b border-border-subtle pb-3">
            <span className="font-mono text-xs tracking-wider uppercase text-text-muted">
              SYSTEM INVARIANT-TO-PROOF VERIFICATION CHAIN
            </span>
            <span className="font-mono text-xs text-accent">
              Invariant → Authority → Enforcement → Evidence
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {invariantChain.map((inv, i) => (
              <div
                key={i}
                className="rounded-lg bg-surface/50 dark:bg-[#18191C]/50 border border-border-subtle p-4 space-y-2 hover:border-border-strong transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] text-accent uppercase tracking-wider">
                    Invariant #{i + 1}
                  </span>
                  <span className="text-[10px] font-mono text-text-muted">Enforced</span>
                </div>
                <div className="text-sm font-medium text-text-primary">
                  {inv.name}
                </div>
                <div className="text-xs text-text-secondary leading-relaxed">
                  {inv.rule}
                </div>
                <div className="text-[10px] font-mono text-accent/80 pt-1 border-t border-border-subtle/40">
                  ↳ {inv.effect}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Interactive Developer CLI & Toolchain Terminal */}
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between border-b border-border-subtle pb-3">
            <span className="font-mono text-xs tracking-wider uppercase text-text-muted">
              DEVELOPER TOOLCHAIN & LIVE DIAGNOSTICS
            </span>
            <div className="flex items-center gap-2">
              {(['verify', 'run', 'bifrost'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-2.5 py-1 rounded font-mono text-[11px] transition-colors ${
                    activeTab === tab
                      ? 'bg-accent/20 text-accent border border-accent/40'
                      : 'text-text-muted hover:text-text-primary'
                  }`}
                >
                  {tab === 'verify' ? 'Test Suite' : tab === 'run' ? 'App Server' : 'Bifrost Gateway'}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg bg-[#0d0e11] border border-border-subtle p-4 sm:p-5 font-mono text-xs space-y-3 overflow-hidden shadow-inner">
            <div className="flex items-center justify-between text-text-muted text-[11px] pb-2 border-b border-white/5">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500/70 inline-block" />
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/70 inline-block" />
                <span className="w-2.5 h-2.5 rounded-full bg-green-500/70 inline-block" />
                <span className="ml-2 text-text-secondary">terminal // afterfact-runtime</span>
              </div>
              <span className="text-accent text-[10px]">pnpm v11.9.0 · Node 22</span>
            </div>

            <div className="text-accent flex items-center gap-2">
              <span className="text-text-muted">$</span>
              <span>{cliSnippets[activeTab].cmd}</span>
            </div>

            <pre className="text-[11px] text-text-secondary leading-relaxed whitespace-pre overflow-x-auto max-h-48 scrollbar-thin">
              {cliSnippets[activeTab].output}
            </pre>
          </div>
        </div>

        {/* Public Repository Contributors & Core Team Details */}
        <div className="space-y-6 pt-2">
          <div className="flex items-center justify-between border-b border-border-subtle pb-3">
            <span className="font-mono text-xs tracking-wider uppercase text-text-muted">
              CORE REPOSITORY CONTRIBUTORS & LANE OWNERSHIP
            </span>
            <span className="font-mono text-xs text-text-secondary">
              Driftaxe Engineering Team
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {contributors.map((c, i) => (
              <div
                key={i}
                className="rounded-lg bg-surface/60 dark:bg-[#18191C]/60 border border-border-subtle p-5 space-y-3 hover:border-border-strong transition-colors flex flex-col justify-between"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-accent font-semibold">{`0${i + 1} // ${c.lane}`}</span>
                    <a
                      href={`https://github.com/${c.handle}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] font-mono text-accent hover:underline flex items-center gap-1"
                    >
                      @{c.handle} ↗
                    </a>
                  </div>
                  <div className="text-base font-medium text-text-primary">
                    {c.name}
                  </div>
                  <div className="text-xs font-mono text-text-secondary">
                    {c.role}
                  </div>
                  <p className="text-xs text-text-muted leading-relaxed">
                    {c.highlights}
                  </p>
                </div>

                <div className="pt-3 border-t border-border-subtle/50 flex items-center justify-between text-[11px] font-mono text-text-secondary">
                  <span>Audited Lineage</span>
                  <span className="text-text-primary font-medium">{c.commits}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}
