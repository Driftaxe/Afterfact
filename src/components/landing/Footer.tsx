'use client';

import React from 'react';
import Link from 'next/link';
import { Emblem } from './Emblem';

export function Footer() {
  return (
    <footer className="border-t border-border-subtle bg-background py-16 sm:py-20 text-text-secondary relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 sm:gap-8 pb-12 sm:pb-16 border-b border-border-subtle">
          
          {/* Brand Column */}
          <div className="md:col-span-5 space-y-4">
            <Link href="/" className="inline-flex items-center gap-3 group">
              <Emblem size="sm" />
              <span className="font-sans text-xl tracking-tight text-text-primary font-medium">
                Afterfact
              </span>
            </Link>
            <p className="text-xs sm:text-sm text-text-muted max-w-sm leading-relaxed font-light">
              Evidence-grounded temporal fact verification for AI-generated answers. Decomposes unstructured statements,
              queries primary authorities, and identifies outdated or contradicted facts with deterministic audit trails.
            </p>
            <div className="pt-2">
              <a
                href="https://github.com/Driftaxe/Afterfact"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-xs font-mono text-text-muted hover:text-text-primary transition-colors"
              >
                <span>github.com/Driftaxe/Afterfact</span>
                <span>↗</span>
              </a>
            </div>
          </div>

          {/* Navigation Links Columns */}
          <div className="md:col-span-2 space-y-3">
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-text-primary font-semibold">
              PRODUCT
            </div>
            <ul className="space-y-2 text-xs font-mono text-text-secondary">
              <li>
                <a href="#product" className="hover:text-text-primary transition-colors">
                  Overview
                </a>
              </li>
              <li>
                <a href="#how-it-works" className="hover:text-text-primary transition-colors">
                  DAG Pipeline
                </a>
              </li>
              <li>
                <a href="#evidence" className="hover:text-text-primary transition-colors">
                  Evidence Graph
                </a>
              </li>
              <li>
                <Link href="/app" className="hover:text-text-primary transition-colors">
                  Workspace
                </Link>
              </li>
            </ul>
          </div>

          <div className="md:col-span-2 space-y-3">
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-text-primary font-semibold">
              ARCHITECTURE
            </div>
            <ul className="space-y-2 text-xs font-mono text-text-secondary">
              <li>
                <a href="#architecture" className="hover:text-text-primary transition-colors">
                  Temporal Engine
                </a>
              </li>
              <li>
                <Link href="/report/demo?mode=fixture" className="hover:text-text-primary transition-colors">
                  Sample Report
                </Link>
              </li>
              <li>
                <a href="#engineering" className="hover:text-text-primary transition-colors">
                  Engineering Specs
                </a>
              </li>
              <li>
                <span className="text-text-muted cursor-default">REST API v1</span>
              </li>
            </ul>
          </div>

          <div className="md:col-span-3 space-y-3">
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-text-primary font-semibold">
              EVIDENCE INTEGRITY
            </div>
            <p className="text-xs text-text-muted leading-relaxed font-light">
              All runs strictly enforce invariant P10: unsupported citations fail closed. Claims without primary
              authority backing never receive positive scores.
            </p>
            <div className="pt-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-surface-raised border border-border-subtle text-[10px] font-mono text-text-secondary">
                <span className="w-1.5 h-1.5 rounded-full bg-status-supported-text" />
                Zero Hallucination Tolerance
              </span>
            </div>
          </div>

        </div>

        {/* Bottom Bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-text-muted">
          <div>
            &copy; {new Date().getFullYear()} Afterfact Institutional Intelligence. All rights reserved.
          </div>
          <div className="flex items-center gap-6">
            <Link href="/app" className="hover:text-text-primary transition-colors">
              Verify Answer
            </Link>
            <Link href="/report/demo?mode=fixture" className="hover:text-text-primary transition-colors">
              View Sample Report
            </Link>
            <a
              href="https://github.com/Driftaxe/Afterfact"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-text-primary transition-colors"
            >
              GitHub ↗
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
