'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Emblem } from './Emblem';
import { ThemeToggle } from '@/components/theme/ThemeToggle';

export function FloatingNav() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 40);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 pointer-events-none w-full px-3 sm:px-6 pt-4 sm:pt-6 transition-all duration-300">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        {/* Left Floating Capsule: Live Telemetry Indicator */}
        <div className="pointer-events-auto hidden md:flex items-center gap-2.5 px-3.5 py-2 rounded-full bg-surface/80 dark:bg-[#18191C]/80 border border-border-subtle/80 backdrop-blur-md shadow-lg">
          <span className="relative flex h-2 w-2" aria-hidden="true">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-status-supported-text opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-status-supported-text" />
          </span>
          <span className="text-[11px] font-mono tracking-widest uppercase text-text-secondary">
            VERIFIER // 2.4
          </span>
        </div>

        {/* Center Floating Pill Navigation with Overlapping Emblem */}
        <nav
          aria-label="Main Navigation"
          className={`pointer-events-auto hidden lg:flex items-center justify-center rounded-full px-7 py-2.5 transition-all duration-300 ${
            scrolled
              ? 'bg-surface/90 dark:bg-[#18191C]/90 border border-border-strong/90 backdrop-blur-xl shadow-2xl'
              : 'bg-surface/75 dark:bg-[#18191C]/75 border border-border-subtle/80 backdrop-blur-md shadow-xl'
          }`}
        >
          {/* Left Navigation Group */}
          <div className="flex items-center gap-6 text-[11px] font-medium tracking-[0.14em] uppercase text-text-secondary">
            <a
              href="#product"
              className="hover:text-text-primary transition-colors py-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent rounded-sm"
            >
              PRODUCT
            </a>
            <a
              href="#how-it-works"
              className="hover:text-text-primary transition-colors py-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent rounded-sm"
            >
              HOW IT WORKS
            </a>
            <a
              href="#evidence"
              className="hover:text-text-primary transition-colors py-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent rounded-sm"
            >
              EVIDENCE
            </a>
          </div>

          {/* Central Rising Emblem (Overlaps and rises above navigation pill) */}
          <div className="relative mx-7 flex items-center justify-center -top-3.5 group">
            <Link
              href="/"
              aria-label="Afterfact Home"
              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-full transition-transform group-hover:scale-105"
            >
              <Emblem size="md" />
            </Link>
          </div>

          {/* Right Navigation Group */}
          <div className="flex items-center gap-6 text-[11px] font-medium tracking-[0.14em] uppercase text-text-secondary">
            <a
              href="#architecture"
              className="hover:text-text-primary transition-colors py-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent rounded-sm"
            >
              ARCHITECTURE
            </a>
            <Link
              href="/report/demo?mode=fixture"
              className="hover:text-text-primary transition-colors py-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent rounded-sm flex items-center gap-1.5"
            >
              <span>SAMPLE REPORT</span>
              <span className="rounded bg-status-outdated-bg border border-status-outdated-border px-1 py-0.2 text-[9px] text-status-outdated-text">
                REPLAY
              </span>
            </Link>
            <a
              href="#workspace"
              className="text-text-primary hover:text-accent font-semibold transition-colors py-1 flex items-center gap-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent rounded-sm"
            >
              <span>GET STARTED</span>
              <span aria-hidden="true">→</span>
            </a>
          </div>
        </nav>

        {/* Right Floating Capsule: Theme & Controls */}
        <div className="pointer-events-auto hidden md:flex items-center gap-3 px-3 py-1.5 rounded-full bg-surface/80 dark:bg-[#18191C]/80 border border-border-subtle/80 backdrop-blur-md shadow-lg">
          <ThemeToggle />
          <Link
            href="/design"
            className="text-[10px] font-mono uppercase tracking-wider text-text-muted hover:text-text-primary transition-colors px-2 py-0.5 rounded bg-surface-raised/60 border border-border-subtle/50"
          >
            /design
          </Link>
        </div>

        {/* Mobile View: Compact Floating Header Pill */}
        <div className="pointer-events-auto lg:hidden w-full flex items-center justify-between px-4 py-2 rounded-full bg-surface/90 dark:bg-[#18191C]/90 border border-border-subtle backdrop-blur-xl shadow-xl">
          <Link href="/" className="flex items-center gap-2.5">
            <Emblem size="sm" />
            <span className="font-serif text-base tracking-tight text-text-primary font-normal">
              Afterfact
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-full text-text-secondary hover:text-text-primary hover:bg-surface-raised transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              aria-label="Toggle menu"
              aria-expanded={mobileMenuOpen}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7h16M4 12h16M4 17h16" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Slide-out Menu Drawer */}
      {mobileMenuOpen && (
        <div className="pointer-events-auto lg:hidden fixed inset-x-3 top-20 rounded-2xl bg-surface/95 dark:bg-[#18191C]/95 border border-border-strong backdrop-blur-2xl shadow-2xl p-6 space-y-5 animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="flex flex-col space-y-3.5 text-xs font-mono tracking-widest uppercase text-text-secondary">
            <a
              href="#product"
              onClick={() => setMobileMenuOpen(false)}
              className="py-2 border-b border-border-subtle/50 hover:text-text-primary transition-colors flex justify-between items-center"
            >
              <span>01 // PRODUCT</span>
              <span>→</span>
            </a>
            <a
              href="#how-it-works"
              onClick={() => setMobileMenuOpen(false)}
              className="py-2 border-b border-border-subtle/50 hover:text-text-primary transition-colors flex justify-between items-center"
            >
              <span>02 // HOW IT WORKS</span>
              <span>→</span>
            </a>
            <a
              href="#evidence"
              onClick={() => setMobileMenuOpen(false)}
              className="py-2 border-b border-border-subtle/50 hover:text-text-primary transition-colors flex justify-between items-center"
            >
              <span>03 // EVIDENCE</span>
              <span>→</span>
            </a>
            <a
              href="#architecture"
              onClick={() => setMobileMenuOpen(false)}
              className="py-2 border-b border-border-subtle/50 hover:text-text-primary transition-colors flex justify-between items-center"
            >
              <span>04 // ARCHITECTURE</span>
              <span>→</span>
            </a>
            <Link
              href="/report/demo?mode=fixture"
              onClick={() => setMobileMenuOpen(false)}
              className="py-2 border-b border-border-subtle/50 hover:text-text-primary transition-colors flex justify-between items-center"
            >
              <span>05 // SAMPLE REPORT</span>
              <span className="rounded bg-status-outdated-bg border border-status-outdated-border px-1.5 py-0.5 text-[9px] text-status-outdated-text">
                REPLAY
              </span>
            </Link>
          </div>

          <div className="pt-2">
            <a
              href="#workspace"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-btn-primary text-btn-primary-text font-medium text-xs tracking-wider uppercase shadow-md transition-opacity hover:opacity-95"
            >
              <span>VERIFY AN ANSWER</span>
              <span>→</span>
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
