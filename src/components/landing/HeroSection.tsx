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

      {/* 2. Main Hero Viewport: Central Architectural Hierarchy */}
      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex-1 flex flex-col items-center justify-center text-center py-6 sm:py-10 lg:py-12 z-10">
        
        {/* Subtle, Feathered Central Tonal Gradient behind Headline (Non-Panel Legibility Contrast) */}
        <div
          className="absolute inset-0 pointer-events-none -z-10 flex items-center justify-center overflow-hidden"
          aria-hidden="true"
        >
          <div className="w-[min(960px,94vw)] h-[340px] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(16,16,18,0.52)_0%,rgba(16,16,18,0.22)_48%,transparent_75%)] blur-2xl pointer-events-none" />
        </div>

        {/* 1. Primary Title: AFTERFACT Wordmark (Prominent, High-Contrast, Unfaded) */}
        <div className="w-full max-w-4xl flex justify-center mb-3 sm:mb-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/media/hero/afterfact-wordmark-transparent.png"
            alt="AFTERFACT"
            decoding="async"
            className="hero-wordmark w-full max-w-[min(90vw,980px)] h-auto select-none pointer-events-none drop-shadow-sm"
          />
        </div>

        {/* 2. Subtitle: Every claim has a story. (Positioned Below the Title, Smaller, Stretched Horizontally, Faded Color) */}
        <div className="w-full max-w-3xl flex justify-center">
          <ScratchRevealHeadline />
        </div>

        {/* Refined Micro Actions (Moved Lower & Compact) */}
        <div className="flex flex-wrap items-center justify-center gap-2.5 mt-8 sm:mt-10 lg:mt-12">
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
