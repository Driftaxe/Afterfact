'use client';

import React from 'react';
import Link from 'next/link';
import { HeroBackground } from './HeroBackground';
import { ScratchRevealHeadline } from './ScratchRevealHeadline';

export function HeroSection() {
  return (
    <section className="relative min-h-screen flex flex-col justify-between pt-24 sm:pt-28 pb-0 overflow-hidden bg-[var(--af-obsidian)]">
      {/* 1. Full-Bleed Video Background with Translucent AFTERFACT Wordmark */}
      <HeroBackground />

      {/* 2. Main Hero Viewport: Central Architectural Hierarchy */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex-1 flex flex-col items-center justify-center text-center py-6 sm:py-8 lg:py-10 z-10">
        
        {/* Subtle, Feathered Central Tonal Gradient behind Headline (Non-Panel Legibility Contrast) */}
        <div
          className="absolute inset-0 pointer-events-none -z-10 flex items-center justify-center overflow-hidden"
          aria-hidden="true"
        >
          <div className="w-[min(1400px,96vw)] h-[400px] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(16,16,18,0.52)_0%,rgba(16,16,18,0.22)_48%,transparent_75%)] blur-2xl pointer-events-none" />
        </div>

        {/* 1. Primary Title: AFTERFACT Wordmark (Slightly Larger, More Faded, Constant) */}
        <div className="w-full flex justify-center mb-6 sm:mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/media/hero/afterfact-wordmark-transparent.png"
            alt="AFTERFACT"
            decoding="async"
            className="hero-wordmark select-none pointer-events-none drop-shadow-sm"
          />
        </div>

        {/* 2. Refined Micro Actions */}
        <div className="flex flex-wrap items-center justify-center gap-2.5">
          <Link
            href="/app"
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-1.5 rounded-sm bg-[var(--af-ivory)] hover:bg-[#F2ECE6] text-[var(--af-obsidian)] font-sans font-medium text-[10px] sm:text-[11px] tracking-wide transition-all shadow-xs hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring group"
          >
            <span>VERIFY AN ANSWER</span>
            <span className="text-[10px] transition-transform group-hover:translate-x-0.5" aria-hidden="true">→</span>
          </Link>

          <Link
            href="/report/demo?mode=fixture"
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-1.5 rounded-sm bg-[var(--af-graphite)]/60 hover:bg-[var(--af-graphite)]/90 border border-[var(--af-border)] hover:border-[rgba(232,225,218,0.25)] text-[var(--af-ivory)] font-sans font-medium text-[10px] sm:text-[11px] tracking-wide transition-all shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring group"
          >
            <span>View sample report</span>
            <span className="text-[7px] font-mono px-1 py-0.2 rounded-xs bg-[var(--af-obsidian)]/80 border border-[var(--af-border)] text-[var(--af-silver)]">
              Replay
            </span>
          </Link>
        </div>

      </div>

      {/* 3. Bottom Strip: Smooth Gradient Blend into Bottom, Housing Scratchable Headline */}
      <div className="w-full bg-gradient-to-b from-transparent via-[var(--af-obsidian)]/75 to-[var(--af-obsidian)] z-10 pt-8 pb-5 sm:pb-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-center items-center">
          <ScratchRevealHeadline />
        </div>
      </div>
    </section>
  );
}
