import React from 'react';
import Link from 'next/link';

export function HeroSection() {
  return (
    <section className="relative min-h-screen flex flex-col justify-between pt-32 sm:pt-36 lg:pt-40 pb-0 border-b border-border-subtle overflow-hidden">
      {/* Background Architectural Canvas & Cinematic Atmospherics */}
      <div className="absolute inset-0 pointer-events-none -z-10 overflow-hidden" aria-hidden="true">
        {/* Subtle geometric dot grid */}
        <div
          className="absolute inset-0 opacity-[0.035] dark:opacity-[0.07]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)`,
            backgroundSize: '32px 32px',
          }}
        />

        {/* Cinematic gradient ambient glow behind floating cards */}
        <div className="absolute -top-24 right-0 w-[550px] lg:w-[750px] h-[550px] lg:h-[750px] bg-gradient-to-br from-accent/10 via-transparent to-transparent rounded-full blur-3xl opacity-60" />
        <div className="absolute top-1/2 left-0 w-[400px] h-[400px] bg-status-supported-text/5 rounded-full blur-3xl opacity-40" />

        {/* Fine architectural hairline vector overlays */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.04] dark:opacity-[0.06]" xmlns="http://www.w3.org/2000/svg">
          <line x1="0" y1="20%" x2="100%" y2="20%" stroke="currentColor" strokeWidth="1" strokeDasharray="6 6" />
          <line x1="0" y1="75%" x2="100%" y2="75%" stroke="currentColor" strokeWidth="1" strokeDasharray="6 6" />
          <line x1="62%" y1="0" x2="62%" y2="100%" stroke="currentColor" strokeWidth="1" strokeDasharray="8 8" />
        </svg>

        {/* Film grain vignette mask */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/40 to-background" />
      </div>

      {/* Main Hero Viewport Split Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex-1 flex items-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center w-full py-8 sm:py-12">
          
          {/* Left Column: Editorial Statement & Primary Call to Action */}
          <div className="lg:col-span-7 space-y-6 sm:space-y-8">
            {/* Architectural Eyebrow */}
            <div className="inline-flex items-center gap-2.5 px-3 py-1 rounded-full bg-surface-raised/70 border border-border-subtle text-[10px] sm:text-[11px] font-mono tracking-[0.2em] uppercase text-text-secondary">
              <span className="w-1.5 h-1.5 rounded-full bg-accent" />
              <span>TEMPORAL EVIDENCE INTELLIGENCE</span>
            </div>

            {/* Exact Primary Brand Statement in Editorial Serif */}
            <h1 className="font-serif text-4xl sm:text-6xl md:text-7xl xl:text-[80px] font-normal tracking-tight text-text-primary leading-[1.04]">
              Clarity, even as <br className="hidden sm:inline" />
              <span className="italic font-serif text-text-primary/95">facts change.</span>
            </h1>

            {/* Subtitles & Rigorous Verification Description */}
            <div className="space-y-3 max-w-xl">
              <p className="text-base sm:text-lg text-text-primary/90 font-light leading-relaxed">
                Verify AI-generated answers against current sources. Trace every claim to its evidence, context, and point in time.
              </p>
              <p className="text-xs sm:text-sm text-text-muted leading-relaxed">
                Check AI-generated answers against current web sources to detect outdated, contradicted, or unverified claims.
              </p>
            </div>

            {/* Dual Actions: Interactive Workspace & Sample Report Link */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5 pt-2">
              <a
                href="#workspace"
                className="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-btn-primary text-btn-primary-text hover:bg-btn-primary-hover font-medium text-xs sm:text-sm tracking-wider uppercase transition-all shadow-lg shadow-black/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring group"
              >
                <span>Verify an answer</span>
                <span className="transition-transform group-hover:translate-x-0.5" aria-hidden="true">→</span>
              </a>

              <Link
                href="/report/demo?mode=fixture"
                className="inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-surface border border-border-subtle hover:border-border-strong text-text-secondary hover:text-text-primary font-medium text-xs sm:text-sm tracking-wide transition-all shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              >
                <span>View sample report</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-status-outdated-bg border border-status-outdated-border text-status-outdated-text">
                  Replay
                </span>
              </Link>
            </div>

            {/* Telemetry Micro-Badges */}
            <div className="pt-4 flex flex-wrap items-center gap-4 sm:gap-6 text-[10px] sm:text-[11px] font-mono tracking-wider uppercase text-text-muted border-t border-border-subtle/50">
              <span className="flex items-center gap-1.5">
                <span className="text-status-supported-text">✓</span> Deterministic DAG
              </span>
              <span className="flex items-center gap-1.5">
                <span className="text-status-supported-text">✓</span> UTF-16 Offset Grounding
              </span>
              <span className="flex items-center gap-1.5">
                <span className="text-status-supported-text">✓</span> Temporal Decay Fencing
              </span>
            </div>
          </div>

          {/* Right Column: Floating Asymmetric Elevated Promotional Cards */}
          <div className="lg:col-span-5 relative w-full flex flex-col gap-4 lg:gap-5">
            {/* Background Aura */}
            <div className="absolute -inset-4 bg-gradient-to-tr from-surface-raised/40 via-surface/30 to-transparent rounded-3xl blur-2xl -z-10" />

            {/* Card 1 — Evidence Intelligence (Miniature Source Document & Citation) */}
            <div className="rounded-2xl bg-surface/90 dark:bg-[#18191C]/90 border border-border-strong/80 p-4 sm:p-5 shadow-xl backdrop-blur-md transition-all duration-300 hover:border-accent/40">
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-border-subtle/60 text-[11px] font-mono">
                <div className="flex items-center gap-2 text-text-secondary truncate">
                  <span className="w-2 h-2 rounded-full bg-status-supported-text" />
                  <span className="truncate">stripe.com/pricing</span>
                </div>
                <span className="px-1.5 py-0.5 rounded bg-status-supported-bg border border-status-supported-border text-[9px] font-mono text-status-supported-text uppercase tracking-wider">
                  Primary Authority
                </span>
              </div>
              <div className="pt-3 space-y-2">
                <div className="text-[10px] font-mono text-text-muted uppercase tracking-wider">
                  RETRIEVED EXCERPT // 2026-11-12
                </div>
                <p className="text-xs text-text-primary/95 font-serif italic leading-relaxed bg-surface-raised/50 p-2.5 rounded-lg border border-border-subtle/40">
                  &ldquo;...standard card processing rate is{' '}
                  <mark className="bg-status-supported-bg text-status-supported-text px-1 py-0.2 rounded font-sans font-medium not-italic">
                    2.9% + 30¢ per transaction
                  </mark>{' '}
                  for online domestic card transactions...&rdquo;
                </p>
                <div className="flex items-center justify-between text-[10px] font-mono text-text-muted pt-1">
                  <span>GROUNDING // 100% VERBATIM</span>
                  <span className="text-status-supported-text">CONFIRMED</span>
                </div>
              </div>
            </div>

            {/* Card 2 — Temporal Verification (Historical vs Current Timeline Shift) */}
            <div className="rounded-2xl bg-surface/90 dark:bg-[#18191C]/90 border border-border-strong/80 p-4 sm:p-5 shadow-xl backdrop-blur-md transition-all duration-300 hover:border-accent/40">
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-border-subtle/60 text-[11px] font-mono">
                <span className="text-text-secondary uppercase tracking-wider text-[10px]">
                  TEMPORAL TRANSITION STATE
                </span>
                <span className="px-1.5 py-0.5 rounded bg-status-outdated-bg border border-status-outdated-border text-[9px] font-mono text-status-outdated-text uppercase tracking-wider">
                  OUTDATED CLAIM
                </span>
              </div>
              <div className="pt-3 space-y-2.5">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-text-secondary line-through">Parag Agrawal is CEO of Twitter</span>
                    <span className="text-[10px] font-mono text-status-outdated-text">THEN (2021)</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-text-primary font-medium">Linda Yaccarino / Elon Musk (X)</span>
                    <span className="text-[10px] font-mono text-status-supported-text">NOW (CURRENT)</span>
                  </div>
                </div>

                {/* Transition Bar */}
                <div className="w-full bg-surface-raised h-1.5 rounded-full overflow-hidden flex">
                  <div className="bg-status-outdated-text w-1/3 h-full" />
                  <div className="bg-accent w-1/3 h-full" />
                  <div className="bg-status-supported-text w-1/3 h-full" />
                </div>
                <div className="flex justify-between text-[9px] font-mono text-text-muted">
                  <span>2021 APPOINTMENT</span>
                  <span className="text-status-outdated-text font-semibold">2022 TRANSITION</span>
                  <span className="text-status-supported-text">CURRENT STATE</span>
                </div>
              </div>
            </div>

            {/* Card 3 — Multi-Claim Inspection Status Pill */}
            <div className="rounded-2xl bg-surface/85 dark:bg-[#18191C]/85 border border-border-subtle p-3.5 shadow-lg backdrop-blur-md">
              <div className="flex items-center justify-between gap-2 text-[10px] font-mono">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                  <span className="text-text-secondary">SAMPLE RUN DECOMPOSITION: 3 CLAIMS</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-status-supported-text" title="1 Supported" />
                  <span className="w-2 h-2 rounded-full bg-status-outdated-text" title="1 Outdated" />
                  <span className="w-2 h-2 rounded-full bg-status-supported-text" title="1 Supported" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Hero Story Rail: 3 Numbered Visual Story Panels */}
      <div className="w-full border-t border-border-subtle bg-surface/40 dark:bg-[#18191C]/40 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 divide-y md:divide-y-0 md:divide-x divide-border-subtle">
            
            {/* Story 01: TRACE THE CLAIM */}
            <div className="pt-4 md:pt-0 md:pr-6 space-y-1.5">
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-xs font-semibold text-accent">01 //</span>
                <h2 className="text-xs font-mono font-semibold tracking-widest uppercase text-text-primary">
                  TRACE THE CLAIM
                </h2>
              </div>
              <p className="text-xs text-text-secondary leading-relaxed pl-6">
                Understand exactly which statements are being verified with character-grounded extraction.
              </p>
            </div>

            {/* Story 02: INSPECT THE EVIDENCE */}
            <div className="pt-4 md:pt-0 md:px-6 space-y-1.5">
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-xs font-semibold text-accent">02 //</span>
                <h2 className="text-xs font-mono font-semibold tracking-widest uppercase text-text-primary">
                  INSPECT THE EVIDENCE
                </h2>
              </div>
              <p className="text-xs text-text-secondary leading-relaxed pl-6">
                Follow every claim back to its supporting primary source material and verbatim quotes.
              </p>
            </div>

            {/* Story 03: TRACK WHAT CHANGES */}
            <div className="pt-4 md:pt-0 md:pl-6 space-y-1.5">
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-xs font-semibold text-accent">03 //</span>
                <h2 className="text-xs font-mono font-semibold tracking-widest uppercase text-text-primary">
                  TRACK WHAT CHANGES
                </h2>
              </div>
              <p className="text-xs text-text-secondary leading-relaxed pl-6">
                See how facts evolve over time, identify effective dates, and inspect surgical claim corrections.
              </p>
            </div>

          </div>
        </div>
      </div>
    </section>
  );
}
