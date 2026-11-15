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

      {/* 2. Main Hero Viewport: Centered Editorial Headline Directly Over AFTERFACT Wordmark */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex-1 flex flex-col items-center justify-center text-center py-12 sm:py-16 lg:py-20 z-10">
        
        {/* Dominant Primary Hero Headline (Scratch-to-Reveal) Centered Over AFTERFACT Wordmark */}
        <div className="w-full max-w-4xl flex justify-center">
          <ScratchRevealHeadline />
        </div>

        {/* Centered Dual Actions */}
        <div className="flex flex-wrap items-center justify-center gap-3.5 pt-8 sm:pt-10">
          <Link
            href="/app"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-md bg-btn-primary text-btn-primary-text hover:bg-btn-primary-hover font-sans font-medium text-xs sm:text-sm tracking-wider uppercase transition-all shadow-lg hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring group"
          >
            <span>VERIFY AN ANSWER</span>
            <span className="transition-transform group-hover:translate-x-0.5" aria-hidden="true">→</span>
          </Link>

          <Link
            href="/report/demo?mode=fixture"
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-md bg-surface/90 border border-border-subtle hover:border-border-strong text-text-secondary hover:text-text-primary text-xs sm:text-sm font-sans tracking-wide transition-all shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            <span>View sample report</span>
            <span className="text-[9px] font-mono px-1 py-0.2 rounded-sm bg-status-outdated-bg border border-status-outdated-border text-status-outdated-text">
              Replay
            </span>
          </Link>
        </div>

        {/* Small Brand Signature Centered Underneath */}
        <div className="pt-6 sm:pt-8">
          <p className="font-serif italic text-xs sm:text-sm text-text-muted/80 tracking-wide">
            Clarity, even as facts change.
          </p>
        </div>

      </div>

      {/* 3. Bottom Hero Story Rail: 3 Numbered Visual Story Panels */}
      <div className="w-full border-t border-border-subtle bg-surface/60 dark:bg-[#18191C]/60 backdrop-blur-sm z-10">
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
