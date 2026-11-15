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
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex-1 flex flex-col items-center justify-center text-center py-10 sm:py-14 lg:py-16 z-10">
        
        {/* Dominant Primary Hero Headline (Scratch-to-Reveal) Centered Over AFTERFACT Wordmark */}
        <div className="w-full max-w-4xl flex justify-center">
          <ScratchRevealHeadline />
        </div>

        {/* Refined, Compact Dual Actions (Moved Lower & Proportioned) */}
        <div className="flex flex-wrap items-center justify-center gap-3 mt-12 sm:mt-16 lg:mt-20">
          <Link
            href="/app"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 sm:px-4.5 sm:py-2 rounded-md bg-btn-primary text-btn-primary-text hover:bg-btn-primary-hover font-mono font-medium text-[11px] tracking-[0.14em] uppercase transition-all shadow-sm hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring group"
          >
            <span>VERIFY AN ANSWER</span>
            <span className="text-xs transition-transform group-hover:translate-x-0.5" aria-hidden="true">→</span>
          </Link>

          <Link
            href="/report/demo?mode=fixture"
            className="inline-flex items-center justify-center gap-2 px-3.5 py-2 sm:px-4 sm:py-2 rounded-md bg-surface/90 border border-border-subtle hover:border-border-strong text-text-secondary hover:text-text-primary text-[11px] font-sans tracking-wide transition-all shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            <span>View sample report</span>
            <span className="text-[8px] font-mono px-1 py-0.2 rounded-xs bg-status-outdated-bg border border-status-outdated-border text-status-outdated-text">
              Replay
            </span>
          </Link>
        </div>

      </div>

      {/* 3. Architectural Editorial Baseline Bar: Protocol Identity, Signature & Quiet Exploration */}
      <div className="w-full border-t border-border-subtle/80 bg-surface/30 dark:bg-[#111214]/40 backdrop-blur-md z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 sm:py-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            
            {/* Left: Protocol Specification */}
            <div className="flex items-center gap-2.5 text-[10px] font-mono tracking-[0.2em] uppercase text-text-muted">
              <span className="w-1.5 h-1.5 rounded-full bg-status-supported-text animate-pulse" aria-hidden="true" />
              <span>SYS // TEMPORAL EVIDENCE PROTOCOL</span>
            </div>

            {/* Center: Brand Signature */}
            <div className="flex items-center gap-2 text-text-muted/80">
              <span className="w-4 h-[1px] bg-border-subtle hidden md:inline-block" aria-hidden="true" />
              <p className="font-serif italic text-xs tracking-wide">
                Clarity, even as facts change.
              </p>
              <span className="w-4 h-[1px] bg-border-subtle hidden md:inline-block" aria-hidden="true" />
            </div>

            {/* Right: Exploration Affordance */}
            <div className="flex items-center">
              <a
                href="#product"
                className="group inline-flex items-center gap-1.5 text-[10px] font-mono tracking-[0.2em] uppercase text-text-muted hover:text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent rounded-sm py-0.5"
              >
                <span>EXPLORE STORY</span>
                <span className="transition-transform group-hover:translate-y-0.5 font-sans" aria-hidden="true">↓</span>
              </a>
            </div>

          </div>
        </div>
      </div>
    </section>
  );
}
