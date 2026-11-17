'use client';

import React from 'react';
import Link from 'next/link';
import { HeroBackground } from './HeroBackground';
import { TemporalRevealStrip } from './TemporalRevealStrip';

export function HeroSection() {
  return (
    <div className="relative w-full overflow-hidden">
      {/* 1. Hero Section: Intimate, Cinematic, Normal-flow Content Group (Full 100svh Hero Viewport) */}
      <section className="relative min-h-screen lg:min-h-[100svh] flex flex-col items-center justify-center pt-32 sm:pt-40 md:pt-44 pb-16 sm:pb-20 md:pb-24 overflow-hidden">
        {/* Full-Bleed Video Background with Seamless Lower Transition */}
        <HeroBackground />

        {/* Accessible semantic heading for SEO & screen-readers */}
        <h1 className="sr-only">
          Afterfact — Answers age. Know what still holds. Check AI-generated claims against current sources.
        </h1>

        {/* Central Architectural Hierarchy: Unified Content Group (Shifted Lower, Expanded to 7xl) */}
        <div className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center justify-center text-center z-10 translate-y-4 sm:translate-y-8 md:translate-y-12">
          {/* Subtle, Feathered Central Tonal Vignette */}
          <div
            className="absolute inset-0 pointer-events-none -z-10 flex items-center justify-center overflow-hidden"
            aria-hidden="true"
          >
            <div className="w-[min(1300px,96vw)] h-[360px] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(16,16,18,0.38)_0%,rgba(16,16,18,0.10)_48%,transparent_75%)] blur-2xl pointer-events-none" />
          </div>

          {/* Primary Visual Anchor: AFTERFACT Wordmark */}
          <div className="w-full flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/media/hero/afterfact-wordmark-transparent.png"
              alt="AFTERFACT"
              decoding="async"
              className="hero-wordmark select-none pointer-events-none"
            />
          </div>

          {/* Supporting Copy: Tagline (Shifted further down) */}
          <h2 className="mt-12 sm:mt-16 md:mt-20 font-sans font-normal text-[17px] sm:text-[20px] md:text-[22px] tracking-tight leading-tight text-[var(--af-ivory)] dark:text-[var(--af-ivory)] text-[#18191C]">
            Answers age. Know what still holds.
          </h2>

          {/* Supporting Copy: Description (Tightly coupled beneath tagline) */}
          <p className="mt-1.5 sm:mt-2 font-sans font-normal text-[14px] sm:text-[15.5px] text-[var(--af-silver)] dark:text-[#A8A19F] text-[#55524E] max-w-xl leading-normal">
            Check AI-generated claims against current sources.
          </p>

          {/* Actions: Primary & Secondary (Closer to supporting text) */}
          <div className="flex flex-wrap items-center justify-center gap-3.5 sm:gap-4 mt-5 sm:mt-6 md:mt-7 w-full">
            <Link
              href="/app"
              className="inline-flex items-center justify-center gap-2 h-11 sm:h-12 px-5 sm:px-6 rounded-md bg-[#B8AEA2] hover:bg-[#C5BCB1] dark:bg-[#B8AEA2] dark:hover:bg-[#C5BCB1] text-[#101012] font-sans font-medium text-[13px] sm:text-[13.5px] tracking-normal transition-all shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B8AEA2] focus-visible:ring-offset-2 focus-visible:ring-offset-[#101012] group"
            >
              <span>Verify an answer</span>
              <span className="text-xs transition-transform group-hover:translate-x-0.5" aria-hidden="true">→</span>
            </Link>

            <Link
              href="/report/demo?mode=fixture"
              className="inline-flex items-center justify-center gap-2.5 h-11 sm:h-12 px-4.5 sm:px-5 rounded-md border border-white/[0.14] dark:border-white/[0.14] border-black/[0.14] bg-white/[0.04] dark:bg-white/[0.04] bg-black/[0.03] hover:bg-white/[0.08] dark:hover:bg-white/[0.08] hover:bg-black/[0.06] text-[var(--af-silver)] dark:text-[var(--af-silver)] text-[#444240] hover:text-[var(--af-ivory)] dark:hover:text-[var(--af-ivory)] hover:text-[#111215] font-sans font-medium text-[13px] sm:text-[13.5px] tracking-normal transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-[#101012] group"
            >
              <span>View sample report</span>
              <span className="text-[11px] text-[var(--af-silver)]/80 group-hover:text-[var(--af-ivory)]" aria-hidden="true">↗</span>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[var(--af-obsidian)]/80 dark:bg-[var(--af-obsidian)]/80 bg-black/10 border border-white/[0.08] dark:border-white/[0.08] border-black/[0.08] text-[var(--af-silver)] dark:text-[var(--af-silver)] text-[#555]">
                Replay
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* 2. Architectural Editorial Baseline Bar: Positioned Slightly Lower (Comes into view on scroll) */}
      <div className="relative w-full border-t border-b border-[var(--af-border)]/40 bg-[var(--af-obsidian)]/90 backdrop-blur-md z-20 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 sm:py-4">
          <TemporalRevealStrip />
        </div>
      </div>
    </div>
  );
}
