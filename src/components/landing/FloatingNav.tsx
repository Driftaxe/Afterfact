'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Emblem } from './Emblem';
import { ThemeToggle } from '@/components/theme/ThemeToggle';

export function FloatingNav() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [navVisible, setNavVisible] = useState(true);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      // When scrollY <= 50, we are at the top of the page (round dock style)
      // When scrollY > 50, we are scrolled into the document
      const isPastTop = currentScrollY > 50;
      setScrolled(isPastTop);

      // Smart Auto-Hiding ("Headroom" / Scroll-Direction-Aware Header):
      // Scrolls out of view on scroll-down; slides back into view on scroll-up
      if (currentScrollY > 90) {
        if (currentScrollY > lastScrollY.current + 8) {
          // Scrolling down -> hide navbar to maximize reading and video viewport
          setNavVisible(false);
        } else if (currentScrollY < lastScrollY.current - 8) {
          // Scrolling up -> reveal full-width covered top strip navbar
          setNavVisible(true);
        }
      } else {
        // At or near top -> always visible in floating dock style
        setNavVisible(true);
      }

      lastScrollY.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 pointer-events-none w-full transition-all duration-300 ease-in-out ${
        navVisible ? 'translate-y-0' : '-translate-y-full'
      } ${
        scrolled
          ? 'bg-surface/95 dark:bg-[#111214]/95 border-b border-border-subtle/80 backdrop-blur-xl shadow-xl py-2.5 px-4 sm:px-6 lg:px-8'
          : 'bg-transparent border-b border-transparent shadow-none pt-4 sm:pt-6 pb-0 px-4 sm:px-6 lg:px-8'
      }`}
    >
      <div className="max-w-7xl mx-auto w-full relative flex items-center justify-center">
        {/* DESKTOP SPLIT TRAPEZOIDAL NAVIGATION */}
        <nav
          aria-label="Main Navigation"
          className="pointer-events-auto hidden lg:flex items-center justify-center transition-all duration-300"
        >
          {/* Left Trapezoidal Pod: Architectural Corner Radius, Angled Inner Edge */}
          <div
            className={`relative p-[1px] rounded-l-md transition-all duration-300 w-[285px] xl:w-[310px] ${
              scrolled
                ? 'bg-white/[0.12] dark:bg-white/[0.12] bg-black/[0.10] shadow-sm'
                : 'bg-white/[0.07] dark:bg-white/[0.07] bg-black/[0.06]'
            }`}
            style={{
              clipPath: 'polygon(0% 0%, 100% 0%, calc(100% - 20px) 100%, 0% 100%)',
            }}
          >
            <div
              className={`h-9 flex items-center justify-between pl-6 pr-8 rounded-l-md transition-colors duration-300 ${
                scrolled
                  ? 'bg-surface/85 dark:bg-[#161619]/85 backdrop-blur-md'
                  : 'bg-surface/70 dark:bg-[#161619]/70 backdrop-blur-md'
              }`}
              style={{
                clipPath: 'polygon(0% 0%, 100% 0%, calc(100% - 20px) 100%, 0% 100%)',
              }}
            >
              <div className="flex items-center justify-between w-full text-[11px] font-sans font-medium tracking-[0.06em] uppercase text-[var(--af-silver)]">
                <Link
                  href="/#product"
                  className="hover:text-[var(--af-ivory)] dark:hover:text-[var(--af-ivory)] hover:text-text-primary transition-colors py-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent rounded-sm"
                >
                  PRODUCT
                </Link>
                <Link
                  href="/#how-it-works"
                  className="hover:text-[var(--af-ivory)] dark:hover:text-[var(--af-ivory)] hover:text-text-primary transition-colors py-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent rounded-sm"
                >
                  HOW IT WORKS
                </Link>
                <Link
                  href="/#evidence"
                  className="hover:text-[var(--af-ivory)] dark:hover:text-[var(--af-ivory)] hover:text-text-primary transition-colors py-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent rounded-sm"
                >
                  EVIDENCE
                </Link>
              </div>
            </div>
          </div>

          {/* Central Triangular Brand Anchor: Grounded in Notch */}
          <div className="relative -top-1 z-20 flex items-center justify-center -mx-2 group">
            <Link
              href="/"
              aria-label="Afterfact Home"
              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-full transition-transform duration-200 group-hover:scale-105"
            >
              <Emblem size="sm" />
            </Link>
          </div>

          {/* Right Trapezoidal Pod: Angled Inner Edge, Integrated Theme Toggle */}
          <div
            className={`relative p-[1px] rounded-r-md transition-all duration-300 w-[285px] xl:w-[310px] ${
              scrolled
                ? 'bg-white/[0.12] dark:bg-white/[0.12] bg-black/[0.10] shadow-sm'
                : 'bg-white/[0.07] dark:bg-white/[0.07] bg-black/[0.06]'
            }`}
            style={{
              clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 20px 100%)',
            }}
          >
            <div
              className={`h-9 flex items-center justify-between pl-8 pr-5 rounded-r-md transition-colors duration-300 ${
                scrolled
                  ? 'bg-surface/85 dark:bg-[#161619]/85 backdrop-blur-md'
                  : 'bg-surface/70 dark:bg-[#161619]/70 backdrop-blur-md'
              }`}
              style={{
                clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 20px 100%)',
              }}
            >
              <div className="flex items-center justify-between w-full text-[11px] font-sans font-medium tracking-[0.06em] uppercase text-[var(--af-silver)]">
                <Link
                  href="/#architecture"
                  className="hover:text-[var(--af-ivory)] dark:hover:text-[var(--af-ivory)] hover:text-text-primary transition-colors py-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent rounded-sm"
                >
                  ARCHITECTURE
                </Link>

                {/* Integrated Theme Toggle without extra container */}
                <ThemeToggle variant="ghost" />

                <Link
                  href="/app"
                  className="text-[var(--af-ivory)] dark:text-[var(--af-ivory)] text-text-primary hover:text-white dark:hover:text-white font-medium transition-colors py-1 flex items-center gap-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent rounded-sm"
                >
                  <span>GET STARTED</span>
                  <span aria-hidden="true" className="text-xs">→</span>
                </Link>
              </div>
            </div>
          </div>
        </nav>

        {/* MOBILE COMPACT FLOATING NAVIGATION BAR */}
        <div className="pointer-events-auto lg:hidden w-full flex items-center justify-between px-3.5 py-2 rounded-md bg-surface/85 dark:bg-[#161619]/85 border border-white/[0.08] dark:border-white/[0.08] border-black/[0.08] backdrop-blur-xl shadow-xs">
          <Link href="/" className="flex items-center gap-2.5">
            <Emblem size="sm" />
            <span className="font-sans text-base tracking-tight text-text-primary font-medium">
              Afterfact
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <ThemeToggle variant="ghost" />
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded text-text-secondary hover:text-text-primary hover:bg-surface-raised transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
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
        <div className="pointer-events-auto lg:hidden fixed inset-x-3 top-20 rounded-xl bg-surface/95 dark:bg-[#18191C]/95 border border-border-strong backdrop-blur-2xl shadow-2xl p-6 space-y-5 animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="flex flex-col space-y-3.5 text-xs font-mono tracking-widest uppercase text-text-secondary">
            <Link
              href="/#product"
              onClick={() => setMobileMenuOpen(false)}
              className="py-2 border-b border-border-subtle/50 hover:text-text-primary transition-colors flex justify-between items-center"
            >
              <span>01 // PRODUCT</span>
              <span>→</span>
            </Link>
            <Link
              href="/#how-it-works"
              onClick={() => setMobileMenuOpen(false)}
              className="py-2 border-b border-border-subtle/50 hover:text-text-primary transition-colors flex justify-between items-center"
            >
              <span>02 // HOW IT WORKS</span>
              <span>→</span>
            </Link>
            <Link
              href="/#evidence"
              onClick={() => setMobileMenuOpen(false)}
              className="py-2 border-b border-border-subtle/50 hover:text-text-primary transition-colors flex justify-between items-center"
            >
              <span>03 // EVIDENCE</span>
              <span>→</span>
            </Link>
            <Link
              href="/#architecture"
              onClick={() => setMobileMenuOpen(false)}
              className="py-2 border-b border-border-subtle/50 hover:text-text-primary transition-colors flex justify-between items-center"
            >
              <span>04 // ARCHITECTURE</span>
              <span>→</span>
            </Link>
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
              className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-btn-primary text-btn-primary-text font-medium text-xs tracking-wider uppercase shadow-md transition-opacity hover:opacity-95"
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
