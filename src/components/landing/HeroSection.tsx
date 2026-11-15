'use client';

import React from 'react';
import Link from 'next/link';
import { HeroBackground } from './HeroBackground';
import { EvidenceDemoCard } from './EvidenceDemoCard';
import { TemporalDemoCard } from './TemporalDemoCard';

export function HeroSection() {
  return (
    <section className="relative min-h-screen flex flex-col justify-between pt-28 sm:pt-32 lg:pt-36 pb-0 border-b border-border-subtle overflow-hidden">
      {/* Video-First Cinematic Background Layer */}
      <HeroBackground />

      {/* Main Hero Split Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex-1 flex flex-col justify-center py-8 lg:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-center w-full">
          
          {/* Left Column: Understated Editorial Introduction & Primary Route to /app */}
          <div className="lg:col-span-6 flex flex-col justify-between h-full space-y-8 lg:space-y-12">
            <div className="space-y-6">
              {/* Understated Product Identifier */}
              <div className="inline-flex items-center gap-2.5 px-3 py-1 rounded-sm bg-surface-raised/80 border border-border-subtle text-[10px] sm:text-[11px] font-mono tracking-[0.2em] uppercase text-text-secondary">
                <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                <span>TEMPORAL EVIDENCE INTELLIGENCE</span>
              </div>

              {/* Primary Product Explanation */}
              <div className="space-y-4 max-w-xl">
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-light tracking-tight text-text-primary leading-tight">
                  Verify AI-generated answers against current sources. Trace every claim to its evidence, context, and point in time.
                </h2>
                <p className="text-sm sm:text-base text-text-secondary font-light leading-relaxed">
                  Check AI-generated answers against current web sources to detect outdated, contradicted, or unverified claims with character-grounded provenance.
                </p>
              </div>

              {/* Dual Actions: Primary to /app & Secondary to /report/demo?mode=fixture */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5 pt-2">
                <Link
                  href="/app"
                  className="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-md bg-btn-primary text-btn-primary-text hover:bg-btn-primary-hover font-medium text-xs sm:text-sm tracking-wider uppercase transition-all shadow-lg shadow-black/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring group"
                >
                  <span>Verify an answer</span>
                  <span className="transition-transform group-hover:translate-x-0.5" aria-hidden="true">→</span>
                </Link>

                <Link
                  href="/report/demo?mode=fixture"
                  className="inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-md bg-surface/90 border border-border-subtle hover:border-border-strong text-text-secondary hover:text-text-primary font-medium text-xs sm:text-sm tracking-wide transition-all shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                >
                  <span>View sample report</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-sm bg-status-outdated-bg border border-status-outdated-border text-status-outdated-text">
                    Replay
                  </span>
                </Link>
              </div>

              {/* Architectural Invariant Telemetry */}
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

            {/* Bottom-Left Brand Signature: "Clarity, even as facts change." */}
            <div className="pt-6 sm:pt-8 lg:pt-12">
              <div className="inline-block border-l-2 border-accent/40 pl-3.5 py-1">
                <h1 className="font-serif italic text-lg sm:text-xl text-text-primary/90 font-normal tracking-wide">
                  Clarity, even as facts change.
                </h1>
                <span className="block font-mono text-[9px] tracking-[0.2em] uppercase text-text-muted mt-0.5">
                  AFTERFACT BRAND SIGNATURE
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: Redesigned Two Demo Claim Cards (Asymmetric Composition) */}
          <div className="lg:col-span-6 relative w-full flex flex-col gap-4 lg:gap-5">
            {/* Background Ambient Glow */}
            <div className="absolute -inset-4 bg-gradient-to-tr from-surface-raised/40 via-surface/30 to-transparent rounded-2xl blur-2xl -z-10" />

            {/* Demonstration Card 01: Evidence Verification */}
            <EvidenceDemoCard />

            {/* Demonstration Card 02: Temporal Transition */}
            <TemporalDemoCard />

            {/* Compact Sample Run Decomposition Strip */}
            <div className="rounded-md bg-surface/90 dark:bg-[#18191C]/90 border border-border-subtle px-4 py-2.5 shadow-md flex items-center justify-between text-[10px] font-mono">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                <span className="text-text-secondary">SAMPLE RUN DECOMPOSITION: 3 CLAIMS</span>
              </div>
              <div className="flex items-center gap-2 text-text-muted">
                <span className="text-status-supported-text font-semibold">2 SUPPORTED</span>
                <span>·</span>
                <span className="text-status-outdated-text font-semibold">1 OUTDATED</span>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Bottom Hero Story Rail: 3 Numbered Visual Story Panels */}
      <div className="w-full border-t border-border-subtle bg-surface/50 dark:bg-[#18191C]/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 divide-y md:divide-y-0 md:divide-x divide-border-subtle">
            
            {/* Story 01: TRACE THE CLAIM */}
            <div className="pt-3 md:pt-0 md:pr-6 space-y-1">
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-xs font-semibold text-accent">01 //</span>
                <h3 className="text-xs font-mono font-semibold tracking-widest uppercase text-text-primary">
                  TRACE THE CLAIM
                </h3>
              </div>
              <p className="text-xs text-text-secondary leading-relaxed pl-6">
                Understand exactly which statements are being verified with character-grounded extraction.
              </p>
            </div>

            {/* Story 02: INSPECT THE EVIDENCE */}
            <div className="pt-3 md:pt-0 md:px-6 space-y-1">
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-xs font-semibold text-accent">02 //</span>
                <h3 className="text-xs font-mono font-semibold tracking-widest uppercase text-text-primary">
                  INSPECT THE EVIDENCE
                </h3>
              </div>
              <p className="text-xs text-text-secondary leading-relaxed pl-6">
                Follow every claim back to its supporting primary source material and verbatim quotes.
              </p>
            </div>

            {/* Story 03: TRACK WHAT CHANGES */}
            <div className="pt-3 md:pt-0 md:pl-6 space-y-1">
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-xs font-semibold text-accent">03 //</span>
                <h3 className="text-xs font-mono font-semibold tracking-widest uppercase text-text-primary">
                  TRACK WHAT CHANGES
                </h3>
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
