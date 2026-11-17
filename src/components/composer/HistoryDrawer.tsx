'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  getRecentChecks,
  clearHistory,
  removeCheck,
  HISTORY_UPDATED_EVENT,
  type HistoryCheckItem,
} from '@/lib/iphistory';

export interface HistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSnippet?: (text: string, mode: 'paste' | 'ask') => void;
}

function formatRelativeTime(timestamp: number): string {
  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export function HistoryDrawer({ isOpen, onClose, onSelectSnippet }: HistoryDrawerProps) {
  const [checks, setChecks] = useState<HistoryCheckItem[]>([]);
  const [source, setSource] = useState<'database' | 'fallback'>('database');
  const [isLoading, setIsLoading] = useState(false);

  const refreshChecks = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/history');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.checks) && data.checks.length > 0) {
          setChecks(data.checks);
          if (data.source) setSource(data.source);
          return;
        }
      }
    } catch {
      // Ignore network errors and fallback to client localStorage
    } finally {
      setIsLoading(false);
    }

    setChecks(getRecentChecks(25));
  };

  useEffect(() => {
    refreshChecks();

    const handleUpdate = () => refreshChecks();
    window.addEventListener(HISTORY_UPDATED_EVENT, handleUpdate);
    return () => window.removeEventListener(HISTORY_UPDATED_EVENT, handleUpdate);
  }, []);

  useEffect(() => {
    if (isOpen) {
      refreshChecks();
    }
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Recent checks and IP verification history"
    >
      {/* Dimmed backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-over panel */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-surface border-l border-border-subtle/80 shadow-2xl flex flex-col">
          
          {/* Header */}
          <div className="p-6 border-b border-border-subtle/70 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[var(--af-sage)] animate-pulse" />
                <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-text-muted">
                  {source === 'database' ? 'POSTGRESQL // LIVE AUDIT LOG' : 'IP-ANCHORED SESSION HISTORY'}
                </span>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-xs border border-border-subtle/70 hover:border-border-strong flex items-center justify-center text-text-muted hover:text-text-primary text-sm font-mono transition-colors focus-visible:outline-none"
                aria-label="Close history drawer"
              >
                ✕
              </button>
            </div>

            <h2 className="font-sans text-2xl font-normal tracking-heading text-text-primary">
              Recent Checks
            </h2>
            <p className="text-xs text-text-secondary leading-relaxed">
              Real verification runs and temporal audits queried by hashed client IP from PostgreSQL.
            </p>
          </div>

          {/* Checks List */}
          <div className="flex-1 overflow-y-auto p-6 space-y-3">
            {isLoading && checks.length === 0 ? (
              <div className="text-center py-12 space-y-3">
                <span className="font-mono text-xs text-text-muted animate-pulse">Loading recent checks...</span>
              </div>
            ) : checks.length === 0 ? (
              <div className="text-center py-12 space-y-3">
                <span className="font-mono text-xs text-text-muted">No past checks found.</span>
                <p className="text-[11px] text-text-muted/70 max-w-xs mx-auto">
                  Submit a question or text in the workspace to automatically record verification runs.
                </p>
              </div>
            ) : (
              checks.map((check) => (
                <div
                  key={check.id}
                  className="group relative rounded-xl border border-border-subtle/80 bg-surface-raised/40 hover:bg-surface-raised/70 hover:border-border-strong/70 p-4 transition-all space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="inline-block px-1.5 py-0.2 rounded-xs border border-border-subtle bg-surface text-[9px] font-mono tracking-wider uppercase text-text-muted">
                          {check.mode}
                        </span>
                        <span className="text-[10px] font-mono text-text-muted">
                          {formatRelativeTime(check.timestamp)}
                        </span>
                      </div>
                      <h3 className="font-sans text-sm font-medium text-text-primary truncate pt-0.5">
                        {check.title}
                      </h3>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeCheck(check.id)}
                      className="opacity-0 group-hover:opacity-100 text-[11px] text-text-muted hover:text-status-contradicted-text transition-opacity p-1"
                      title="Remove check from history"
                      aria-label="Remove item"
                    >
                      ✕
                    </button>
                  </div>

                  <p className="text-xs text-text-secondary line-clamp-2 leading-relaxed font-sans">
                    “{check.queryOrSnippet}”
                  </p>

                  <div className="flex items-center justify-between pt-1 border-t border-border-subtle/40 text-[11px] font-mono">
                    <div className="flex items-center gap-2">
                      <span className="text-text-muted">
                        {check.claimsCount} {check.claimsCount === 1 ? 'claim' : 'claims'}
                      </span>
                      {check.truthScore !== undefined && check.truthScore !== null && (
                        <span
                          className={`font-semibold ${
                            check.truthScore >= 70
                              ? 'text-status-supported-text'
                              : check.truthScore === 0
                              ? 'text-status-contradicted-text'
                              : 'text-text-secondary'
                          }`}
                        >
                          · Score: {check.truthScore}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {onSelectSnippet && (
                        <button
                          type="button"
                          onClick={() => {
                            onSelectSnippet(check.queryOrSnippet, check.mode);
                            onClose();
                          }}
                          className="text-text-muted hover:text-text-primary transition-colors cursor-pointer"
                          title="Load this text back into the composer"
                        >
                          Load ⟳
                        </button>
                      )}
                      <Link
                        href={check.reportUrl}
                        className="inline-flex items-center gap-0.5 text-text-primary hover:underline font-semibold"
                        onClick={onClose}
                      >
                        <span>Report</span>
                        <span>↗</span>
                      </Link>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer Actions */}
          {checks.length > 0 && (
            <div className="p-4 border-t border-border-subtle/70 flex items-center justify-between text-xs font-mono">
              <span className="text-text-muted text-[11px]">
                {checks.length} recorded {checks.length === 1 ? 'run' : 'runs'}
              </span>
              <button
                type="button"
                onClick={clearHistory}
                className="text-text-muted hover:text-status-contradicted-text transition-colors cursor-pointer"
              >
                Clear all history
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
