'use client';

import React from 'react';

export function ProjectShowcase() {
  const verifiedStats = [
    { label: 'COMMITS RECORDED', value: '129', hint: 'Verified Git History' },
    { label: 'CONTRIBUTORS', value: '3', hint: 'Driftaxe Core Team' },
    { label: 'AUTOMATED TESTS', value: '78', hint: '55 Vitest · 23 Playwright' },
    { label: 'PRIMARY STACK', value: '100%', hint: 'TypeScript & Next.js 15' },
    { label: 'DATABASE ENGINE', value: 'Neon PG', hint: 'Pooled Connection Branching' },
    { label: 'LICENSE', value: 'MIT', hint: 'Open Source Software' },
  ];

  const contributors = [
    {
      name: 'Mayur Nanda',
      role: 'Platform & Verification Engineering',
      handle: 'Mayur11code',
    },
    {
      name: 'Hardik Akshay',
      role: 'Infrastructure & Integration',
      handle: 'Hardik-codr',
    },
    {
      name: 'Jivjot Singh Kohli',
      role: 'Temporal Analysis & UI Architecture',
      handle: 'JivjotSingh559',
    },
  ];

  return (
    <section id="engineering" className="py-20 sm:py-28 border-b border-border-subtle bg-surface/20">
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

        {/* Real Verified Engineering Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {verifiedStats.map((stat, i) => (
            <div
              key={i}
              className="rounded-lg bg-surface/80 dark:bg-[#18191C]/80 border border-border-subtle p-4 space-y-2"
            >
              <div className="text-[10px] font-mono tracking-wider uppercase text-text-muted">
                {stat.label}
              </div>
              <div className="font-mono text-2xl sm:text-3xl font-bold tracking-tight text-text-primary">
                {stat.value}
              </div>
              <div className="text-[10px] font-mono text-text-secondary truncate">
                {stat.hint}
              </div>
            </div>
          ))}
        </div>

        {/* Public Repository Contributors */}
        <div className="space-y-6 pt-4">
          <div className="flex items-center justify-between border-b border-border-subtle pb-3">
            <span className="font-mono text-xs tracking-wider uppercase text-text-muted">
              CORE REPOSITORY CONTRIBUTORS
            </span>
            <span className="font-mono text-xs text-text-secondary">
              Driftaxe Engineering
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {contributors.map((c, i) => (
              <div
                key={i}
                className="rounded-lg bg-surface/60 dark:bg-[#18191C]/60 border border-border-subtle p-5 space-y-2 hover:border-border-strong transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-accent">{`0${i + 1} //`}</span>
                  <a
                    href={`https://github.com/${c.handle}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] font-mono text-text-muted hover:text-text-primary transition-colors"
                  >
                    @{c.handle} ↗
                  </a>
                </div>
                <div className="text-base font-medium text-text-primary">
                  {c.name}
                </div>
                <div className="text-xs text-text-secondary">
                  {c.role}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}
