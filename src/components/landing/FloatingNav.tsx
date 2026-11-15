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
          {/* Left Trapezoidal Pod: Architectural 8px Corner Radius, Angled Inner Edge */}
          <div
            className={`relative p-[1px] rounded-l-lg transition-all duration-300 w-[320px] xl:w-[350px] ${
              scrolled
                ? 'bg-border-strong/80 shadow-md'
                : 'bg-border-subtle/80 shadow-xl'
            }`}
            style={{
              clipPath: 'polygon(0% 0%, 100% 0%, calc(100% - 24px) 100%, 0% 100%)',
            }}
          >
            <div
              className={`h-11 flex items-center justify-between pl-7 pr-10 rounded-l-lg transition-colors duration-300 ${
                scrolled
                  ? 'bg-surface/90 dark:bg-[#18191C]/90 backdrop-blur-md'
                  : 'bg-surface/85 dark:bg-[#18191C]/85 backdrop-blur-md'
              }`}
              style={{
                clipPath: 'polygon(0% 0%, 100% 0%, calc(100% - 24px) 100%, 0% 100%)',
              }}
            >
              <div className="flex items-center justify-between w-full text-[11px] xl:text-xs font-sans font-medium tracking-[0.14em] uppercase text-text-secondary">
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

          {/* Central Triangular Brand Anchor: Grounded in Notch */}
          <div className="relative -top-1.5 z-20 flex items-center justify-center -mx-2.5 group">
            <Link
              href="/"
              aria-label="Afterfact Home"
              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-full transition-transform duration-200 group-hover:scale-105"
            >
              <Emblem size="md" />
            </Link>
          </div>

          {/* Right Trapezoidal Pod: Angled Inner Edge, Clean Dual Items */}
          <div
            className={`relative p-[1px] rounded-r-lg transition-all duration-300 w-[320px] xl:w-[350px] ${
              scrolled
                ? 'bg-border-strong/80 shadow-md'
                : 'bg-border-subtle/80 shadow-xl'
            }`}
            style={{
              clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 24px 100%)',
            }}
          >
            <div
              className={`h-11 flex items-center justify-between pl-10 pr-6 rounded-r-lg transition-colors duration-300 ${
                scrolled
                  ? 'bg-surface/90 dark:bg-[#18191C]/90 backdrop-blur-md'
                  : 'bg-surface/85 dark:bg-[#18191C]/85 backdrop-blur-md'
              }`}
              style={{
                clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 24px 100%)',
              }}
            >
              <div className="flex items-center justify-between w-full text-[11px] xl:text-xs font-sans font-medium tracking-[0.14em] uppercase text-text-secondary">
                <a
                  href="#architecture"
                  className="hover:text-text-primary transition-colors py-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent rounded-sm"
                >
                  ARCHITECTURE
                </a>

                <Link
                  href="/app"
                  className="text-text-primary hover:text-accent font-semibold transition-colors py-1 flex items-center gap-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent rounded-sm"
                >
                  <span>GET STARTED</span>
                  <span aria-hidden="true">→</span>
                </Link>
              </div>
            </div>
          </div>
        </nav>

        {/* TOP-RIGHT CONTROLS: THEME TOGGLE DOCKED OUTSIDE NAVBAR ON RIGHT SIDE */}
        <div
          className={`pointer-events-auto hidden lg:flex items-center absolute right-0 transition-all duration-300 ${
            scrolled ? 'top-0.5' : 'top-0'
          }`}
        >
          <div className="flex items-center p-1.5 rounded-lg bg-surface/85 dark:bg-[#18191C]/85 border border-border-subtle/80 backdrop-blur-md shadow-lg">
            <ThemeToggle />
          </div>
        </div>

        {/* MOBILE COMPACT FLOATING NAVIGATION BAR */}
        <div className="pointer-events-auto lg:hidden w-full flex items-center justify-between px-4 py-2.5 rounded-lg bg-surface/90 dark:bg-[#18191C]/90 border border-border-subtle backdrop-blur-xl shadow-xl">
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
