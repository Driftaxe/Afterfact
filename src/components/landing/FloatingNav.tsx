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
      setScrolled(window.scrollY > 30);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 pointer-events-none w-full px-3 sm:px-6 pt-4 sm:pt-6 transition-all duration-300">
      <div className="max-w-7xl mx-auto flex items-center justify-center">
        
        {/* DESKTOP SPLIT TRAPEZOIDAL NAVIGATION WITH CENTRAL TRIANGULAR EMBLEM */}
        <nav
          aria-label="Main Navigation"
          className="pointer-events-auto hidden lg:flex items-center justify-center transition-all duration-300"
        >
          {/* Left Trapezoidal Pod: Outer Rounded, Inner Diagonal Following Triangle Slope */}
          <div
            className={`relative p-[1px] rounded-l-full transition-all duration-300 ${
              scrolled
                ? 'bg-border-strong/90 shadow-2xl'
                : 'bg-border-subtle/80 shadow-xl'
            }`}
            style={{
              clipPath: 'polygon(0% 0%, 100% 0%, calc(100% - 22px) 100%, 0% 100%)',
            }}
          >
            <div
              className={`h-12 flex items-center pl-8 pr-10 rounded-l-full transition-colors duration-300 ${
                scrolled
                  ? 'bg-surface/95 dark:bg-[#18191C]/95 backdrop-blur-xl'
                  : 'bg-surface/80 dark:bg-[#18191C]/80 backdrop-blur-md'
              }`}
              style={{
                clipPath: 'polygon(0% 0%, 100% 0%, calc(100% - 22px) 100%, 0% 100%)',
              }}
            >
              <div className="flex items-center gap-7 text-[11px] font-medium tracking-[0.14em] uppercase text-text-secondary">
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
            </div>
          </div>

          {/* Central Triangular Brand Anchor: Extends Above Nav Bar */}
          <div className="relative -top-3.5 z-20 flex items-center justify-center -mx-2 group">
            <Link
              href="/"
              aria-label="Afterfact Home"
              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-full transition-transform duration-200 group-hover:scale-105"
            >
              <Emblem size="md" />
            </Link>
          </div>

          {/* Right Trapezoidal Pod: Inner Diagonal Following Triangle Slope, Outer Rounded */}
          <div
            className={`relative p-[1px] rounded-r-full transition-all duration-300 ${
              scrolled
                ? 'bg-border-strong/90 shadow-2xl'
                : 'bg-border-subtle/80 shadow-xl'
            }`}
            style={{
              clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 22px 100%)',
            }}
          >
            <div
              className={`h-12 flex items-center pl-10 pr-6 rounded-r-full transition-colors duration-300 ${
                scrolled
                  ? 'bg-surface/95 dark:bg-[#18191C]/95 backdrop-blur-xl'
                  : 'bg-surface/80 dark:bg-[#18191C]/80 backdrop-blur-md'
              }`}
              style={{
                clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 22px 100%)',
              }}
            >
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
                <Link
                  href="/app"
                  className="text-text-primary hover:text-accent font-semibold transition-colors py-1 flex items-center gap-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent rounded-sm"
                >
                  <span>GET STARTED</span>
                  <span aria-hidden="true">→</span>
                </Link>

                {/* Discreetly integrated theme toggle */}
                <div className="pl-2 border-l border-border-subtle/70">
                  <ThemeToggle />
                </div>
              </div>
            </div>
          </div>
        </nav>

        {/* MOBILE COMPACT FLOATING NAVIGATION BAR */}
        <div className="pointer-events-auto lg:hidden w-full flex items-center justify-between px-4 py-2.5 rounded-full bg-surface/90 dark:bg-[#18191C]/90 border border-border-subtle backdrop-blur-xl shadow-xl">
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

      {/* MOBILE SLIDE-OUT MENU DRAWER */}
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
            <Link
              href="/app"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-btn-primary text-btn-primary-text font-medium text-xs tracking-wider uppercase shadow-md transition-opacity hover:opacity-95"
            >
              <span>GET STARTED</span>
              <span>→</span>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
