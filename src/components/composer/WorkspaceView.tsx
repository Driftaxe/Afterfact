'use client';

import React, { useState, useEffect } from 'react';
import { InputComposer } from './InputComposer';
import { HistoryDrawer } from './HistoryDrawer';
import { getRecentChecks, HISTORY_UPDATED_EVENT } from '@/lib/iphistory';

export function WorkspaceView() {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyCount, setHistoryCount] = useState(0);
  const [injectedText, setInjectedText] = useState<string | undefined>(undefined);
  const [injectedMode, setInjectedMode] = useState<'paste' | 'ask'>('paste');

  useEffect(() => {
    const updateCount = () => {
      setHistoryCount(getRecentChecks(50).length);
    };
    updateCount();
    window.addEventListener(HISTORY_UPDATED_EVENT, updateCount);
    return () => window.removeEventListener(HISTORY_UPDATED_EVENT, updateCount);
  }, []);

  const handleSelectSnippet = (text: string, mode: 'paste' | 'ask') => {
    setInjectedMode(mode);
    setInjectedText(text);
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-8">
      {/* Workspace Dossier Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-border-subtle/80 pb-6">
        <div className="space-y-3">
          <div className="flex items-center gap-2.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--af-sage)] animate-pulse" />
            <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-text-muted">
              LIVE VERIFICATION ENGINE // DAG RUNTIME V2.0
            </span>
          </div>

          <h1 className="font-sans text-3xl sm:text-4xl lg:text-5xl font-normal tracking-heading text-text-primary leading-tight">
            Verification Workspace
          </h1>

          <p className="text-xs sm:text-sm text-text-secondary max-w-2xl leading-relaxed font-sans">
            Submit AI-generated answers or questions to decompose into verifiable atomic claims,
            retrieve primary authority evidence, and detect temporal drift.
          </p>
        </div>

        {/* Top Controls: Recent Checks Button */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            className="group inline-flex items-center gap-2 h-9 px-3.5 rounded-xs border border-border-subtle/90 bg-surface/70 hover:bg-surface-raised/80 hover:border-border-strong text-xs font-mono text-text-muted hover:text-text-primary transition-all cursor-pointer shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus-ring"
            title="Inspect recent verification checks from your IP address"
            aria-label="Open recent checks history"
          >
            <span className="text-[12px] group-hover:rotate-12 transition-transform duration-200">◷</span>
            <span className="tracking-wide">Recent Checks</span>
            <span className="rounded-xs bg-surface-raised px-1.5 py-0.2 text-[10px] font-mono text-text-secondary border border-border-subtle/70">
              {historyCount}
            </span>
          </button>
        </div>
      </div>

      {/* Main Interactive Input Composer */}
      <div className="w-full">
        <InputComposer
          initialAnswerText={injectedText}
          initialMode={injectedMode}
          onOpenHistory={() => setHistoryOpen(true)}
        />
      </div>

      {/* Slide-over IP History Drawer */}
      <HistoryDrawer
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
        onSelectSnippet={handleSelectSnippet}
      />
    </div>
  );
}
