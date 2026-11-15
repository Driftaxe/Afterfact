'use client';

import React from 'react';
import Link from 'next/link';
import { HeroBackground } from './HeroBackground';
import { ScratchRevealHeadline } from './ScratchRevealHeadline';

export function HeroSection() {
  return (
    <section className="relative min-h-screen flex flex-col justify-between pt-28 sm:pt-32 lg:pt-36 pb-0 border-b border-border-subtle overflow-hidden">
      {/* 1. Full-Bleed Video Background with Translucent AFTERFACT Wordmark */}
      <HeroBackground />

      {/* 2. Main Hero Viewport: Refined Centered Editorial Hierarchy Over AFTERFACT Wordmark */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex-1 flex flex-col items-center justify-center text-center py-8 sm:py-12 lg:py-14 z-10">
        
        {/* 1. Small Eyebrow: TEMPORAL EVIDENCE INTELLIGENCE */}
        <div className="mb-4 sm:mb-5 inline-flex items-center gap-2 px-3 py-1 rounded-sm bg-[var(--af-graphite)]/60 border border-[var(--af-border)] text-[10px] font-mono tracking-[0.2em] uppercase text-[var(--af-silver)] shadow-xs">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--af-mauve)]" aria-hidden="true" />
          <span>TEMPORAL EVIDENCE INTELLIGENCE</span>
        </div>

        {/* 2. Dominant Primary Hero Headline (Instrument Serif Regular, Scratch-to-Reveal) */}
        <div className="w-full max-w-4xl flex justify-center">
          <ScratchRevealHeadline />
        </div>

        {/* 3. Concise Product Explanation (Manrope Regular) */}
        <div className="mt-4 sm:mt-5 max-w-xl mx-auto">
          <p className="font-sans font-normal text-sm sm:text-base text-[var(--af-text-secondary)] leading-relaxed">
            Verify AI-generated answers against current sources. Trace every claim to its evidence, context, and point in time.
          </p>
        </div>

        {/* 4. Primary & Secondary CTA Group (Manrope Medium, Restrained Architecture) */}
        <div className="flex flex-wrap items-center justify-center gap-3 mt-6 sm:mt-8">
          <Link
            href="/app"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 sm:px-5 sm:py-2.5 rounded-[5px] bg-[var(--af-ivory)] hover:bg-[#F2ECE6] text-[var(--af-obsidian)] font-sans font-medium text-xs sm:text-[13px] tracking-wide transition-all shadow-sm hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring group"
          >
            <span>VERIFY AN ANSWER</span>
            <span className="text-xs transition-transform group-hover:translate-x-0.5" aria-hidden="true">→</span>
          </Link>

          <Link
            href="/report/demo?mode=fixture"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 sm:px-4.5 sm:py-2.5 rounded-[5px] bg-[var(--af-graphite)]/60 hover:bg-[var(--af-graphite)]/90 border border-[var(--af-border)] hover:border-[rgba(232,225,218,0.25)] text-[var(--af-ivory)] font-sans font-medium text-xs sm:text-[13px] tracking-wide transition-all shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring group"
          >
            <span>View sample report</span>
            <span className="text-[8px] font-mono px-1.5 py-0.5 rounded-xs bg-[var(--af-obsidian)]/80 border border-[var(--af-border)] text-[var(--af-silver)]">
              Replay
            </span>
          </Link>
        </div>

      </div>

      {/* 5. Architectural Editorial Baseline Bar: Brand Signature & Exploration */}
      <div className="w-full border-t border-[var(--af-border)] bg-[var(--af-obsidian)]/60 backdrop-blur-md z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 sm:py-4">
          <div className="flex items-center justify-between text-xs">
            
            {/* Left: Brand Signature in Instrument Serif Italic */}
            <p className="font-serif italic text-xs sm:text-sm text-[var(--af-ivory)]/75 tracking-wide">
              Clarity, even as facts change.
            </p>

            {/* Right: Exploration Affordance */}
            <div className="flex items-center">
              <a
                href="#product"
                className="group inline-flex items-center gap-1.5 text-[10px] font-mono tracking-[0.2em] uppercase text-[var(--af-silver)] hover:text-[var(--af-ivory)] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent rounded-sm py-0.5"
              >
                <span>EXPLORE STORY</span>
                <span className="transition-transform group-hover:translate-y-0.5 font-sans text-xs" aria-hidden="true">↓</span>
              </a>
            </div>

          </div>
        </div>
      </div>
    </section>
  );
}
