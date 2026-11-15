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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex-1 flex flex-col justify-end py-8 sm:py-10 lg:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-end w-full">
          
          {/* Left Column: Asymmetric Editorial Hierarchy */}
          <div className="lg:col-span-7 flex flex-col justify-end space-y-6 pb-2">
            
            {/* Understated Category Label */}
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-sm bg-surface-raised/80 border border-border-subtle text-[10px] font-mono tracking-[0.2em] uppercase text-text-secondary w-fit">
              <span className="w-1.5 h-1.5 rounded-full bg-accent" />
              <span>TEMPORAL EVIDENCE INTELLIGENCE</span>
            </div>

            {/* Dominant Primary Hero Headline (Editorial Serif) */}
            <h1 className="font-serif text-4xl sm:text-6xl lg:text-7xl font-normal tracking-tight text-text-primary leading-[1.04]">
              Every claim has a story.
            </h1>

            {/* Product Explanation (Geist Sans) */}
            <div className="space-y-2 max-w-xl">
              <p className="font-sans text-sm sm:text-base text-text-secondary font-light leading-relaxed">
                Verify AI-generated answers against current sources. Trace every claim to its evidence, context, and point in time.
              </p>
              <p className="font-sans text-xs text-text-muted font-light leading-relaxed">
                Check AI-generated answers against current web sources to detect outdated, contradicted, or unverified claims with character-grounded provenance.
              </p>
            </div>

            {/* Dual Actions (Geist Sans) */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Link
                href="/app"
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-md bg-btn-primary text-btn-primary-text hover:bg-btn-primary-hover font-sans font-medium text-xs tracking-wider uppercase transition-all shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring group"
              >
                <span>Verify an answer</span>
                <span className="transition-transform group-hover:translate-x-0.5" aria-hidden="true">→</span>
              </Link>

              <Link
                href="/report/demo?mode=fixture"
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-md bg-surface/90 border border-border-subtle hover:border-border-strong text-text-secondary hover:text-text-primary text-xs font-sans tracking-wide transition-all shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              >
                <span>View sample report</span>
                <span className="text-[9px] font-mono px-1 py-0.2 rounded-sm bg-status-outdated-bg border border-status-outdated-border text-status-outdated-text">
                  Replay
                </span>
              </Link>
            </div>

            {/* Small Brand Signature at Bottom-Left */}
            <div className="pt-3 border-t border-border-subtle/50 max-w-md">
              <p className="font-serif italic text-xs sm:text-sm text-text-muted/80 tracking-wide">
                Clarity, even as facts change.
              </p>
            </div>

          </div>

          {/* Right Column: Compact, Redesigned Demonstration Cards */}
          <div className="lg:col-span-5 relative w-full flex flex-col gap-4">
            {/* Subtle Ambient Backing */}
            <div className="absolute -inset-4 bg-gradient-to-tr from-surface-raised/30 via-surface/20 to-transparent rounded-xl blur-2xl -z-10" />

            {/* Demonstration Card 01: Evidence Verification */}
            <EvidenceDemoCard />

            {/* Demonstration Card 02: Temporal Transition */}
            <TemporalDemoCard />
          </div>

        </div>
      </div>

      {/* Bottom Hero Story Rail: 3 Numbered Visual Story Panels */}
      <div className="w-full border-t border-border-subtle bg-surface/60 dark:bg-[#18191C]/60 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 divide-y md:divide-y-0 md:divide-x divide-border-subtle">
            
            {/* Story 01: TRACE THE CLAIM */}
            <div className="pt-3 md:pt-0 md:pr-6 space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-semibold text-accent">01 //</span>
                <h3 className="text-xs font-sans font-semibold tracking-widest uppercase text-text-primary">
                  TRACE THE CLAIM
                </h3>
              </div>
              <p className="text-xs font-sans text-text-secondary leading-relaxed pl-5 font-light">
                Understand exactly which statements are being verified with character-grounded extraction.
              </p>
            </div>

            {/* Story 02: INSPECT THE EVIDENCE */}
            <div className="pt-3 md:pt-0 md:px-6 space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-semibold text-accent">02 //</span>
                <h3 className="text-xs font-sans font-semibold tracking-widest uppercase text-text-primary">
                  INSPECT THE EVIDENCE
                </h3>
              </div>
              <p className="text-xs font-sans text-text-secondary leading-relaxed pl-5 font-light">
                Follow every claim back to its supporting primary source material and verbatim quotes.
              </p>
            </div>

            {/* Story 03: TRACK WHAT CHANGES */}
            <div className="pt-3 md:pt-0 md:pl-6 space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-semibold text-accent">03 //</span>
                <h3 className="text-xs font-sans font-semibold tracking-widest uppercase text-text-primary">
                  TRACK WHAT CHANGES
                </h3>
              </div>
              <p className="text-xs font-sans text-text-secondary leading-relaxed pl-5 font-light">
                See how facts evolve over time, identify effective dates, and inspect surgical claim corrections.
              </p>
            </div>

          </div>
        </div>
      </div>
    </section>
  );
}
