'use client';

import React from 'react';
import Link from 'next/link';
import { HeroBackground } from './HeroBackground';
import { ScratchRevealHeadline } from './ScratchRevealHeadline';

export function HeroSection() {
  return (
    <section className="relative min-h-screen flex flex-col justify-between pt-28 sm:pt-32 lg:pt-36 pb-0 overflow-hidden">
      {/* 1. Full-Bleed Video Background with Seamless Lower Transition */}
      <HeroBackground />

      {/* 2. Main Hero Viewport: Central Architectural Hierarchy */}
      <div className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex-1 flex flex-col items-center justify-center text-center py-10 sm:py-16 lg:py-20 z-10">
        
        {/* Subtle, Feathered Central Tonal Gradient behind Headline */}
        <div
          className="absolute inset-0 pointer-events-none -z-10 flex items-center justify-center overflow-hidden"
          aria-hidden="true"
        >
          <div className="w-[min(1300px,96vw)] h-[380px] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(16,16,18,0.52)_0%,rgba(16,16,18,0.22)_48%,transparent_75%)] blur-2xl pointer-events-none" />
        </div>

        {/* 1. Primary Title: AFTERFACT Wordmark (Oversized, Atmospheric Faded Presence) */}
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

      {/* 3. Architectural Editorial Baseline Bar: Interactive Claim Reveal Strip */}
      <div className="w-full border-t border-[var(--af-border)]/50 bg-[var(--af-obsidian)]/80 backdrop-blur-md z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 sm:py-4">
          <div className="flex items-center justify-start text-xs">
            {/* Left: Every claim has a story (Interactive Scratch Effect, Horizontally Compressed) */}
            <div className="flex items-center">
              <ScratchRevealHeadline />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
