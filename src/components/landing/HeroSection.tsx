'use client';

import React from 'react';
import Link from 'next/link';
import { HeroBackground } from './HeroBackground';
import { TemporalRevealStrip } from './TemporalRevealStrip';

export function HeroSection() {
  return (
    <div className="relative w-full overflow-hidden">
      {/* 1. Full-Screen 100vh Hero Viewport: Pure Cinematic Video, Title & CTAs (No Strip in Initial Viewport) */}
      <section className="relative h-screen min-h-[640px] flex flex-col items-center justify-center pt-20 pb-12 overflow-hidden">
        {/* Full-Bleed Video Background with Seamless Lower Transition */}
        <HeroBackground />

        {/* Accessible semantic heading for SEO & screen-readers */}
        <h1 className="sr-only">
          Afterfact — Verification of AI-generated assertions against temporal ground truth
        </h1>

        {/* Central Architectural Hierarchy */}
        <div className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center justify-center text-center z-10 my-auto">
          {/* Subtle, Feathered Central Tonal Gradient */}
          <div
            className="absolute inset-0 pointer-events-none -z-10 flex items-center justify-center overflow-hidden"
            aria-hidden="true"
          >
            <div className="w-[min(1300px,96vw)] h-[380px] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(16,16,18,0.52)_0%,rgba(16,16,18,0.22)_48%,transparent_75%)] blur-2xl pointer-events-none" />
          </div>

          {/* Primary Title: AFTERFACT Wordmark */}
          <div className="w-full flex justify-center mb-10 sm:mb-14 md:mb-16">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/media/hero/afterfact-wordmark-transparent.png"
              alt="AFTERFACT"
              decoding="async"
              className="hero-wordmark select-none pointer-events-none drop-shadow-sm"
            />
          </div>

          {/* Refined Micro Actions — Positioned Lower with Darkened Tactile Palette & Ultra-Subtle Borders */}
          <div className="flex flex-wrap items-center justify-center gap-3 mt-2 sm:mt-4">
            <Link
              href="/app"
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-sm bg-[#1C1B1E] hover:bg-[#262529] border border-white/[0.06] hover:border-white/[0.14] text-[var(--af-ivory)] font-sans font-medium text-[10px] sm:text-[11px] tracking-wide transition-all shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring group"
            >
              <span>VERIFY AN ANSWER</span>
              <span className="text-[10px] text-[var(--af-silver)] group-hover:text-[var(--af-ivory)] transition-transform group-hover:translate-x-0.5" aria-hidden="true">→</span>
            </Link>

            <Link
              href="/report/demo?mode=fixture"
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-sm bg-[#121214]/80 hover:bg-[#1C1B1E] border border-white/[0.04] hover:border-white/[0.10] text-[var(--af-silver)] hover:text-[var(--af-ivory)] font-sans font-medium text-[10px] sm:text-[11px] tracking-wide transition-all shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring group"
            >
              <span>View sample report</span>
              <span className="text-[7px] font-mono px-1 py-0.2 rounded-xs bg-[var(--af-obsidian)]/80 border border-white/[0.05] text-[var(--af-silver)]">
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
