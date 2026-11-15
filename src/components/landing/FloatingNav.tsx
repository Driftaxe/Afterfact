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

      // Detect whether page has scrolled past initial threshold
      setScrolled(currentScrollY > 30);

      // Smart Auto-Hiding (Scroll-Direction Aware / Headroom Header):
      // Scrolls out of view on scroll-down; smoothly slides back into view on scroll-up
      if (currentScrollY > 80) {
        if (currentScrollY > lastScrollY.current + 8) {
          // Scrolling down -> hide navbar to maximize cinematic viewport
          setNavVisible(false);
        } else if (currentScrollY < lastScrollY.current - 8) {
          // Scrolling up -> reveal navbar immediately
          setNavVisible(true);
        }
      } else {
        // At top of page -> always visible
        setNavVisible(true);
      }

      lastScrollY.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 pointer-events-none w-full px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 transition-transform duration-300 ease-in-out ${
        navVisible ? 'translate-y-0' : '-translate-y-full'
      }`}
    >
      <div className="max-w-7xl mx-auto w-full relative flex items-center justify-center">
        
        {/* TOP-LEFT DOCKED CONTROLS: THEME TOGGLE, DRIFTAXE REPO LINK & SAMPLE REPORT HYPERLINK */}
        <div className="pointer-events-auto hidden md:flex flex-col items-start gap-1 absolute left-0 top-0">
          {/* Pill Container: Driftaxe Repo Link + Theme Toggle */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface/85 dark:bg-[#18191C]/85 border border-border-subtle/80 backdrop-blur-md shadow-lg">
            <a
              href="https://github.com/Driftaxe/Afterfact"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub Repository by Driftaxe"
              className="flex items-center gap-1.5 text-[10px] font-mono tracking-wider uppercase text-text-secondary hover:text-text-primary transition-colors px-1.5 py-0.5 rounded bg-surface-raised/70 border border-border-subtle/50"
            >
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
              <span>DRIFTAXE</span>
              <span className="text-text-muted text-[9px]">↗</span>
            </a>

            <div className="pl-1 border-l border-border-subtle/70">
              <ThemeToggle />
            </div>
          </div>

          {/* Text Hyperlink Just Below the Dock: View sample report */}
          <Link
            href="/report/demo?mode=fixture"
            className="text-[11px] font-mono text-text-muted hover:text-text-primary transition-colors flex items-center gap-1.5 pl-1 py-0.5 group"
          >
            <span className="underline decoration-border-subtle group-hover:decoration-text-primary underline-offset-4">
              View sample report
            </span>
            <span className="rounded bg-status-outdated-bg/80 border border-status-outdated-border/60 px-1 py-0.2 text-[9px] text-status-outdated-text">
              Replay
            </span>
          </Link>
        </div>

        {/* DESKTOP SPLIT TRAPEZOIDAL NAVIGATION WITH ARCHITECTURAL REDUCED CURVINESS */}
        <nav
          aria-label="Main Navigation"
          className="pointer-events-auto hidden lg:flex items-center justify-center transition-all duration-300"
        >
          {/* Left Trapezoidal Pod: Architectural 8px Corner Radius, Angled Inner Edge */}
          <div
            className={`relative p-[1px] rounded-l-lg transition-all duration-300 w-[290px] xl:w-[310px] ${
              scrolled
                ? 'bg-border-strong/90 shadow-2xl'
                : 'bg-border-subtle/80 shadow-xl'
            }`}
            style={{
              clipPath: 'polygon(0% 0%, 100% 0%, calc(100% - 22px) 100%, 0% 100%)',
            }}
          >
            <div
              className={`h-11 flex items-center justify-between pl-6 pr-9 rounded-l-lg transition-colors duration-300 ${
                scrolled
                  ? 'bg-surface/95 dark:bg-[#18191C]/95 backdrop-blur-xl'
                  : 'bg-surface/85 dark:bg-[#18191C]/85 backdrop-blur-md'
              }`}
              style={{
                clipPath: 'polygon(0% 0%, 100% 0%, calc(100% - 22px) 100%, 0% 100%)',
              }}
            >
              <div className="flex items-center justify-between w-full text-[11px] font-mono font-medium tracking-[0.14em] uppercase text-text-secondary">
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
          <div className="relative -top-3.5 z-20 flex items-center justify-center -mx-2.5 group">
            <Link
              href="/"
              aria-label="Afterfact Home"
              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-full transition-transform duration-200 group-hover:scale-105"
            >
              <Emblem size="md" />
            </Link>
          </div>

          {/* Right Trapezoidal Pod: Angled Inner Edge, Architectural 8px Corner Radius */}
          <div
            className={`relative p-[1px] rounded-r-lg transition-all duration-300 w-[290px] xl:w-[310px] ${
              scrolled
                ? 'bg-border-strong/90 shadow-2xl'
                : 'bg-border-subtle/80 shadow-xl'
            }`}
            style={{
              clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 22px 100%)',
            }}
          >
            <div
              className={`h-11 flex items-center justify-between pl-9 pr-6 rounded-r-lg transition-colors duration-300 ${
                scrolled
                  ? 'bg-surface/95 dark:bg-[#18191C]/95 backdrop-blur-xl'
                  : 'bg-surface/85 dark:bg-[#18191C]/85 backdrop-blur-md'
              }`}
              style={{
                clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 22px 100%)',
              }}
            >
              <div className="flex items-center justify-between w-full text-[11px] font-mono font-medium tracking-[0.14em] uppercase text-text-secondary">
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

        {/* MOBILE COMPACT FLOATING NAVIGATION BAR */}
        <div className="pointer-events-auto lg:hidden w-full flex items-center justify-between px-4 py-2.5 rounded-lg bg-surface/90 dark:bg-[#18191C]/90 border border-border-subtle backdrop-blur-xl shadow-xl">
          <Link href="/" className="flex items-center gap-2.5">
            <Emblem size="sm" />
            <span className="font-serif text-base tracking-tight text-text-primary font-normal">
              Afterfact
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <a
              href="https://github.com/Driftaxe/Afterfact"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub Repository"
              className="p-1.5 rounded text-text-secondary hover:text-text-primary transition-colors"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
            </a>
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
