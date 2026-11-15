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

      {/* Main Hero Viewport Split Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex-1 flex flex-col justify-end py-6 sm:py-8 lg:py-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-end w-full">
          
          {/* Left Column: Small, Architectural Cluster Anchored Towards the Lower Left */}
          <div className="lg:col-span-6 flex flex-col justify-end space-y-4 sm:space-y-5 pb-2">
            {/* Understated Product Identifier */}
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-sm bg-surface-raised/80 border border-border-subtle text-[10px] font-mono tracking-[0.2em] uppercase text-text-secondary w-fit">
              <span className="w-1.5 h-1.5 rounded-full bg-accent" />
              <span>TEMPORAL EVIDENCE INTELLIGENCE</span>
            </div>

            {/* Brand Signature Editorial Heading */}
            <div className="border-l-2 border-accent/40 pl-3 py-0.5">
              <h1 className="font-serif italic text-lg sm:text-xl text-text-primary/95 font-normal tracking-wide">
                Clarity, even as facts change.
              </h1>
            </div>

            {/* Concise Product Description (Small, refined typography for cinematic visibility) */}
            <div className="space-y-1.5 max-w-lg">
              <p className="text-xs sm:text-sm text-text-primary/90 font-light leading-relaxed">
                Verify AI-generated answers against current sources. Trace every claim to its evidence, context, and point in time.
              </p>
              <p className="text-[11px] sm:text-xs text-text-muted leading-relaxed">
                Check AI-generated answers against current web sources to detect outdated, contradicted, or unverified claims with character-grounded provenance.
              </p>
            </div>

            {/* Compact Dual Actions */}
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <Link
                href="/app"
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-md bg-btn-primary text-btn-primary-text hover:bg-btn-primary-hover font-medium text-xs font-mono tracking-wider uppercase transition-all shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring group"
              >
                <span>Verify an answer</span>
                <span className="transition-transform group-hover:translate-x-0.5" aria-hidden="true">→</span>
              </Link>

              <Link
                href="/report/demo?mode=fixture"
                className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-md bg-surface/90 border border-border-subtle hover:border-border-strong text-text-secondary hover:text-text-primary text-xs font-mono tracking-wide transition-all shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              >
                <span>View sample report</span>
                <span className="text-[9px] font-mono px-1 py-0.2 rounded-sm bg-status-outdated-bg border border-status-outdated-border text-status-outdated-text">
                  Replay
                </span>
              </Link>
            </div>

            {/* Architectural Invariants Telemetry */}
            <div className="pt-2 flex flex-wrap items-center gap-3 sm:gap-4 text-[9px] sm:text-[10px] font-mono tracking-wider uppercase text-text-muted border-t border-border-subtle/40">
              <span className="flex items-center gap-1">
                <span className="text-status-supported-text">✓</span> Deterministic DAG
              </span>
              <span className="flex items-center gap-1">
                <span className="text-status-supported-text">✓</span> UTF-16 Offset Grounding
              </span>
              <span className="flex items-center gap-1">
                <span className="text-status-supported-text">✓</span> Temporal Decay Fencing
              </span>
            </div>
          </div>

          {/* Right Column: Redesigned Demo Claim Cards (Elevated Architectural Terminals) */}
          <div className="lg:col-span-6 relative w-full flex flex-col gap-3.5 sm:gap-4">
            {/* Background Ambient Glow */}
            <div className="absolute -inset-4 bg-gradient-to-tr from-surface-raised/40 via-surface/30 to-transparent rounded-2xl blur-2xl -z-10" />

            {/* Demonstration Card 01: Evidence Verification */}
            <EvidenceDemoCard />

            {/* Demonstration Card 02: Temporal Transition */}
            <TemporalDemoCard />

            {/* Compact Sample Run Decomposition Strip */}
            <div className="rounded-md bg-surface/90 dark:bg-[#18191C]/90 border border-border-subtle px-3.5 py-2 shadow-md flex items-center justify-between text-[10px] font-mono">
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 sm:py-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-8 divide-y md:divide-y-0 md:divide-x divide-border-subtle">
            
            {/* Story 01: TRACE THE CLAIM */}
            <div className="pt-2.5 md:pt-0 md:pr-6 space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-semibold text-accent">01 //</span>
                <h3 className="text-xs font-mono font-semibold tracking-widest uppercase text-text-primary">
                  TRACE THE CLAIM
                </h3>
              </div>
              <p className="text-xs text-text-secondary leading-relaxed pl-5">
                Understand exactly which statements are being verified with character-grounded extraction.
              </p>
            </div>

            {/* Story 02: INSPECT THE EVIDENCE */}
            <div className="pt-2.5 md:pt-0 md:px-6 space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-semibold text-accent">02 //</span>
                <h3 className="text-xs font-mono font-semibold tracking-widest uppercase text-text-primary">
                  INSPECT THE EVIDENCE
                </h3>
              </div>
              <p className="text-xs text-text-secondary leading-relaxed pl-5">
                Follow every claim back to its supporting primary source material and verbatim quotes.
              </p>
            </div>

            {/* Story 03: TRACK WHAT CHANGES */}
            <div className="pt-2.5 md:pt-0 md:pl-6 space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-semibold text-accent">03 //</span>
                <h3 className="text-xs font-mono font-semibold tracking-widest uppercase text-text-primary">
                  TRACK WHAT CHANGES
                </h3>
              </div>
              <p className="text-xs text-text-secondary leading-relaxed pl-5">
                See how facts evolve over time, identify effective dates, and inspect surgical claim corrections.
              </p>
            </div>

          </div>
        </div>
      </div>
    </section>
  );
}
