'use client';

import React from 'react';
import Link from 'next/link';
import { HeroBackground } from './HeroBackground';
import { ScratchRevealHeadline } from './ScratchRevealHeadline';
import { EvidenceDemoCard } from './EvidenceDemoCard';
import { TemporalDemoCard } from './TemporalDemoCard';

export function HeroSection() {
  return (
    <section className="relative min-h-screen flex flex-col justify-between pt-28 sm:pt-32 lg:pt-36 pb-0 border-b border-border-subtle overflow-hidden">
      {/* 1. Full-Bleed Video Background with Oversized Translucent AFTERFACT Wordmark */}
      <HeroBackground />

      {/* 2. Main Two-Column Asymmetric Viewport */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex-1 flex flex-col justify-end py-6 sm:py-8 lg:py-10 z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-end w-full">
          
          {/* Left Column: Product Story (~50% width on desktop) */}
          <div className="lg:col-span-6 xl:col-span-6 flex flex-col justify-end space-y-5 pb-2">
            
            {/* Small Eyebrow */}
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-sm bg-surface-raised/80 border border-border-subtle text-[10px] font-mono tracking-[0.2em] uppercase text-text-secondary w-fit">
              <span className="w-1.5 h-1.5 rounded-full bg-accent" />
              <span>TEMPORAL EVIDENCE INTELLIGENCE</span>
            </div>

            {/* Signature Interactive Scratch-to-Reveal Headline */}
            <div className="w-full">
              <ScratchRevealHeadline />
            </div>

            {/* Product Explanation */}
            <div className="space-y-1.5 max-w-xl">
              <p className="font-sans text-sm sm:text-base text-text-secondary font-light leading-relaxed">
                Verify AI-generated answers against current sources. Trace every claim to its evidence, context, and point in time.
              </p>
            </div>

            {/* Clean Horizontal CTA Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link
                href="/app"
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-md bg-btn-primary text-btn-primary-text hover:bg-btn-primary-hover font-sans font-medium text-xs tracking-wider uppercase transition-all shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring group"
              >
                <span>VERIFY AN ANSWER</span>
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
            <div className="pt-3 border-t border-border-subtle/50 max-w-sm">
              <p className="font-serif italic text-xs sm:text-sm text-text-primary/80 tracking-wide">
                Clarity, even as facts change.
              </p>
            </div>

          </div>

          {/* Right Column: Product Proof (Demonstration Cards ~50% width on desktop) */}
          <div className="lg:col-span-6 xl:col-span-6 relative w-full flex flex-col gap-4">
            {/* Subtle ambient directional darkening behind the cards */}
            <div className="absolute -inset-4 bg-gradient-to-tr from-surface/40 via-surface/20 to-transparent rounded-2xl blur-xl -z-10" />

            {/* Card 01: Evidence Verification */}
            <EvidenceDemoCard />

            {/* Card 02: Temporal Transition */}
            <TemporalDemoCard />
          </div>

        </div>
      </div>

      {/* 3. Bottom Hero Story Rail: 3 Numbered Visual Story Panels */}
      <div className="w-full border-t border-border-subtle bg-surface/60 dark:bg-[#18191C]/60 backdrop-blur-sm z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 sm:py-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 divide-y md:divide-y-0 md:divide-x divide-border-subtle">
            
            {/* Story 01: TRACE THE CLAIM */}
            <div className="pt-2 md:pt-0 md:pr-6 space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-accent">01 //</span>
                <h3 className="text-xs font-sans font-semibold tracking-widest uppercase text-text-primary">
                  TRACE THE CLAIM
                </h3>
              </div>
              <p className="text-xs font-sans text-text-secondary leading-relaxed pl-6 font-light">
                Understand exactly which statements are being verified with character-grounded extraction.
              </p>
            </div>

            {/* Story 02: INSPECT THE EVIDENCE */}
            <div className="pt-2 md:pt-0 md:px-6 space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-accent">02 //</span>
                <h3 className="text-xs font-sans font-semibold tracking-widest uppercase text-text-primary">
                  INSPECT THE EVIDENCE
                </h3>
              </div>
              <p className="text-xs font-sans text-text-secondary leading-relaxed pl-6 font-light">
                Follow every claim back to its supporting primary source material and verbatim quotes.
              </p>
            </div>

            {/* Story 03: TRACK WHAT CHANGES */}
            <div className="pt-2 md:pt-0 md:pl-6 space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-accent">03 //</span>
                <h3 className="text-xs font-sans font-semibold tracking-widest uppercase text-text-primary">
                  TRACK WHAT CHANGES
                </h3>
              </div>
              <p className="text-xs font-sans text-text-secondary leading-relaxed pl-6 font-light">
                See how facts evolve over time, identify effective dates, and inspect surgical claim corrections.
              </p>
            </div>

          </div>
        </div>
      </div>
    </section>
  );
}
