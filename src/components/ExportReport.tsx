'use client';

import React, { useState } from 'react';
import type { Report } from '@/lib/contracts/report';
import {
  downloadReportAsJson,
  downloadReportAsMarkdown,
  copyReportToClipboard,
} from '@/lib/export';

export interface ExportReportProps {
  report: Report;
  className?: string;
}

export function ExportReport({ report, className = '' }: ExportReportProps) {
  const [copySuccess, setCopySuccess] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const handleCopy = async () => {
    const success = await copyReportToClipboard(report);
    if (success) {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  return (
    <div className={`relative inline-flex items-center gap-2 ${className}`}>
      {/* Quick Copy Markdown Button */}
      <button
        type="button"
        onClick={handleCopy}
        className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border border-border-subtle bg-surface text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-surface-raised transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        title="Copy complete report as Markdown"
      >
        {copySuccess ? (
          <>
            <svg className="h-3.5 w-3.5 text-status-supported-text" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-status-supported-text">Copied!</span>
          </>
        ) : (
          <>
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
              />
            </svg>
            <span>Copy Markdown</span>
          </>
        )}
      </button>

      {/* Export Dropdown Trigger */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-expanded={menuOpen}
          aria-haspopup="true"
          className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border border-border-subtle bg-surface text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-surface-raised transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
          <span>Export</span>
          <svg className="h-3 w-3 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {menuOpen && (
          <div
            className="absolute right-0 mt-1.5 w-48 rounded-xl border border-border-subtle bg-surface p-1.5 shadow-lg z-20 space-y-1 text-xs font-sans"
            role="menu"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                downloadReportAsJson(report);
                setMenuOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-raised transition-colors text-left"
            >
              <span className="font-mono text-[11px] font-semibold text-accent">JSON</span>
              <span>Download Raw JSON</span>
            </button>

            <button
              type="button"
              role="menuitem"
              onClick={() => {
                downloadReportAsMarkdown(report);
                setMenuOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-raised transition-colors text-left"
            >
              <span className="font-mono text-[11px] font-semibold text-text-muted">MD</span>
              <span>Download Markdown</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
