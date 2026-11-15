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

        {/* Ultra-Refined Micro Actions (Moved Lower & Sleek) */}
        <div className="flex flex-wrap items-center justify-center gap-2.5 mt-12 sm:mt-16 lg:mt-20">
          <Link
            href="/app"
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-1.5 rounded-sm bg-btn-primary text-btn-primary-text hover:bg-btn-primary-hover font-mono font-medium text-[10px] tracking-[0.14em] uppercase transition-all shadow-xs hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring group"
          >
            <span>VERIFY AN ANSWER</span>
            <span className="text-[10px] transition-transform group-hover:translate-x-0.5" aria-hidden="true">→</span>
          </Link>

          <Link
            href="/report/demo?mode=fixture"
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-1.5 rounded-sm bg-surface/90 border border-border-subtle hover:border-border-strong text-text-secondary hover:text-text-primary text-[10px] font-sans tracking-normal transition-all shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            <span>View sample report</span>
            <span className="text-[7px] font-mono px-1 py-0.2 rounded-xs bg-status-outdated-bg border border-status-outdated-border text-status-outdated-text">
              Replay
            </span>
          </Link>
        </div>

      </div>

      {/* 3. Architectural Editorial Baseline Bar: Signature & Quiet Exploration */}
      <div className="w-full border-t border-border-subtle/80 bg-surface/30 dark:bg-[#111214]/40 backdrop-blur-md z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-3.5">
          <div className="flex items-center justify-between text-xs">
            
            {/* Left: Brand Signature */}
            <p className="font-serif italic text-xs text-text-muted/80 tracking-wide">
              Clarity, even as facts change.
            </p>

            {/* Right: Exploration Affordance */}
            <div className="flex items-center">
              <a
                href="#product"
                className="group inline-flex items-center gap-1.5 text-[10px] font-mono tracking-[0.2em] uppercase text-text-muted hover:text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent rounded-sm py-0.5"
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
