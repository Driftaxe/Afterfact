'use client';

import React, { useMemo, useState } from 'react';
import type { VerificationProperty } from '@/lib/contracts/claim-ticket';

export type DiffChangeType = 'unchanged' | 'modified' | 'added' | 'removed';

export interface ContextPropertyDiff {
  key: string;
  label: string;
  originalValue: string;
  discoveredValue: string;
  status: DiffChangeType;
}

export interface ContextComparisonProps {
  /** Original claim or proposition text as asserted */
  originalText?: string;
  /** Current discovered fact or proposition supported by recent evidence */
  discoveredText?: string;
  /** Original context qualifiers (e.g. jurisdiction, targetDate, version, tier) */
  originalQualifiers?: Record<string, unknown> | VerificationProperty[];
  /** Current discovered qualifiers discovered through retrieval */
  discoveredQualifiers?: Record<string, unknown> | VerificationProperty[];
  /** Original source URL associated with earlier state */
  originalSourceUrl?: string | null;
  /** Modern/discovered source URL associated with active truth */
  discoveredSourceUrl?: string | null;
  /** Publisher of original source */
  originalPublisher?: string | null;
  /** Publisher of discovered source */
  discoveredPublisher?: string | null;
  /** Section title */
  title?: string;
  /** Default view mode: 'unified' (default) or 'side-by-side' */
  defaultTab?: 'side-by-side' | 'unified';
  /** Callback when user edits or simulates a qualifier modification */
  onQualifierChange?: (key: string, newValue: string) => void;
  className?: string;
}

interface DiffToken {
  type: 'added' | 'removed' | 'same';
  value: string;
}

/**
 * Computes a clean word-level diff between two text strings for side-by-side or inline display.
 */
function computeWordDiff(original: string, discovered: string): DiffToken[] {
  if (!original && !discovered) return [];
  if (!original) return [{ type: 'added', value: discovered }];
  if (!discovered) return [{ type: 'removed', value: original }];

  const origWords = original.split(/\s+/).filter(Boolean);
  const discWords = discovered.split(/\s+/).filter(Boolean);

  const tokens: DiffToken[] = [];
  let i = 0;
  let j = 0;

  while (i < origWords.length || j < discWords.length) {
    if (i < origWords.length && j < discWords.length && origWords[i] === discWords[j]) {
      tokens.push({ type: 'same', value: origWords[i] });
      i++;
      j++;
    } else {
      // Lookahead match
      const nextMatchInDisc = discWords.indexOf(origWords[i], j);
      const nextMatchInOrig = origWords.indexOf(discWords[j], i);

      if (nextMatchInDisc !== -1 && (nextMatchInOrig === -1 || nextMatchInDisc - j <= nextMatchInOrig - i)) {
        while (j < nextMatchInDisc) {
          tokens.push({ type: 'added', value: discWords[j] });
          j++;
        }
      } else if (nextMatchInOrig !== -1) {
        while (i < nextMatchInOrig) {
          tokens.push({ type: 'removed', value: origWords[i] });
          i++;
        }
      } else {
        if (i < origWords.length) {
          tokens.push({ type: 'removed', value: origWords[i] });
          i++;
        }
        if (j < discWords.length) {
          tokens.push({ type: 'added', value: discWords[j] });
          j++;
        }
      }
    }
  }

  return tokens;
}

/**
 * Normalizes qualifier inputs into a consistent key-value map.
 */
function normalizeQualifiers(
  input?: Record<string, unknown> | VerificationProperty[]
): Record<string, string> {
  if (!input) return {};
  const res: Record<string, string> = {};

  if (Array.isArray(input)) {
    for (const prop of input) {
      if (prop && typeof prop === 'object' && 'key' in prop) {
        const val = prop.value;
        res[prop.key] =
          typeof val === 'object' && val !== null ? JSON.stringify(val) : String(val ?? '');
      }
    }
  } else if (typeof input === 'object') {
    for (const [k, v] of Object.entries(input)) {
      if (v !== undefined && v !== null) {
        res[k] = typeof v === 'object' ? JSON.stringify(v) : String(v);
      }
    }
  }

  return res;
}

/**
 * ContextComparison
 * Side-by-side diff viewer comparing the Original Claim Context against the Current Discovered Context.
 */
export function ContextComparison({
  originalText = '',
  discoveredText = '',
  originalQualifiers,
  discoveredQualifiers,
  originalSourceUrl,
  discoveredSourceUrl,
  originalPublisher,
  discoveredPublisher,
  title = 'Context Qualifier Comparison',
  defaultTab = 'unified',
  onQualifierChange,
  className = '',
}: ContextComparisonProps) {
  const [activeTab, setActiveTab] = useState<'side-by-side' | 'unified'>(defaultTab);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editedVal, setEditedVal] = useState<string>('');

  const diffTokens = useMemo(
    () => computeWordDiff(originalText, discoveredText),
    [originalText, discoveredText]
  );

  const normalizedOrig = useMemo(() => normalizeQualifiers(originalQualifiers), [originalQualifiers]);
  const normalizedDisc = useMemo(() => normalizeQualifiers(discoveredQualifiers), [discoveredQualifiers]);

  // Combine and diff properties
  const propertyDiffs = useMemo<ContextPropertyDiff[]>(() => {
    const allKeys = Array.from(new Set([...Object.keys(normalizedOrig), ...Object.keys(normalizedDisc)]));
    return allKeys.map((key) => {
      const orig = normalizedOrig[key];
      const disc = normalizedDisc[key];

      let status: DiffChangeType = 'unchanged';
      if (orig === undefined && disc !== undefined) {
        status = 'added';
      } else if (orig !== undefined && disc === undefined) {
        status = 'removed';
      } else if (orig !== disc) {
        status = 'modified';
      }

      // Format clean user-friendly label from camelCase or snake_case
      const label = key
        .replace(/([A-Z])/g, ' $1')
        .replace(/[_-]/g, ' ')
        .replace(/^\w/, (c) => c.toUpperCase());

      return {
        key,
        label,
        originalValue: orig ?? '—',
        discoveredValue: disc ?? '—',
        status,
      };
    });
  }, [normalizedOrig, normalizedDisc]);

  const hasContextDifference =
    originalText !== discoveredText ||
    propertyDiffs.some((p) => p.status !== 'unchanged') ||
    originalSourceUrl !== discoveredSourceUrl;

  const handleStartEdit = (key: string, currentVal: string) => {
    setEditingKey(key);
    setEditedVal(currentVal === '—' ? '' : currentVal);
  };

  const handleSaveEdit = (key: string) => {
    if (onQualifierChange) {
      onQualifierChange(key, editedVal);
    }
    setEditingKey(null);
  };

  return (
    <div
      className={`rounded-2xl border border-border-subtle bg-surface p-5 sm:p-6 space-y-6 ${className}`}
      role="region"
      aria-label="Context comparison viewer"
    >
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border-subtle">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold uppercase tracking-wider font-mono text-text-primary">
              {title}
            </h3>
            {hasContextDifference ? (
              <span className="rounded bg-accent/15 border border-accent/30 px-2 py-0.5 text-[10px] font-mono font-medium text-accent">
                Context Drift Detected
              </span>
            ) : (
              <span className="rounded bg-surface-raised border border-border-subtle px-2 py-0.5 text-[10px] font-mono text-text-muted">
                Context In Sync
              </span>
            )}
          </div>
          <p className="text-xs text-text-secondary">
            Inspect how original assertion qualifiers diverge from authoritative live evidence.
          </p>
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center rounded-lg border border-border-subtle bg-surface-raised p-1 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('side-by-side')}
            className={`px-3 py-1 rounded-md font-medium transition-colors ${
              activeTab === 'side-by-side'
                ? 'bg-surface text-text-primary shadow-sm'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            Side-by-Side
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('unified')}
            className={`px-3 py-1 rounded-md font-medium transition-colors ${
              activeTab === 'unified'
                ? 'bg-surface text-text-primary shadow-sm'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            Unified Diff
          </button>
        </div>
      </div>

      {/* Main Proposition Comparison */}
      {(originalText || discoveredText) && (
        <div className="space-y-2">
          <h4 className="text-xs font-mono uppercase tracking-wider text-text-muted">
            Proposition Comparison
          </h4>

          {activeTab === 'side-by-side' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Original Claim Context Card */}
              <div className="rounded-xl border border-border-subtle bg-surface-raised/40 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono uppercase font-semibold text-text-muted flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-status-outdated-border inline-block" />
                    Original Claim Context
                  </span>
                  <span className="text-[10px] font-mono text-text-muted">Then / Input</span>
                </div>
                <p className="text-xs sm:text-sm text-text-primary leading-relaxed font-sans bg-surface p-3 rounded-lg border border-border-subtle">
                  {originalText || <span className="italic text-text-muted">No original assertion specified</span>}
                </p>
              </div>

              {/* Current Discovered Context Card */}
              <div className="rounded-xl border border-accent/30 bg-accent/5 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono uppercase font-semibold text-accent flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-accent inline-block" />
                    Current Discovered Context
                  </span>
                  <span className="text-[10px] font-mono text-accent">Now / Verified</span>
                </div>
                <p className="text-xs sm:text-sm text-text-primary leading-relaxed font-sans bg-surface p-3 rounded-lg border border-accent/20">
                  {discoveredText || <span className="italic text-text-muted">No updated context recorded</span>}
                </p>
              </div>
            </div>
          ) : (
            /* Unified Word-by-Word Diff Highlight */
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-text-muted">
                <span className="flex items-center gap-2">
                  <span className="uppercase tracking-wider">Word-by-Word Token Drift:</span>
                  <span className="text-status-outdated-text font-semibold">
                    -{diffTokens.filter((t) => t.type === 'removed').length} drifted
                  </span>
                  <span>·</span>
                  <span className="text-status-supported-text font-semibold">
                    +{diffTokens.filter((t) => t.type === 'added').length} discovered
                  </span>
                </span>
                <span className="text-[10px] text-text-muted/80">
                  <span className="line-through text-status-outdated-text px-1 py-0.5 rounded bg-status-outdated-bg border border-status-outdated-border/50">Asserted</span>
                  {' '}→{' '}
                  <span className="text-status-supported-text font-medium px-1 py-0.5 rounded bg-status-supported-bg border border-status-supported-border/50">Discovered</span>
                </span>
              </div>

              <div className="rounded-xl border border-border-subtle bg-surface-raised/70 p-4 font-mono text-xs sm:text-[13px] leading-relaxed overflow-x-auto shadow-inner">
                <div className="flex flex-wrap gap-1.5 items-center">
                  {diffTokens.map((token, idx) => {
                    if (token.type === 'removed') {
                      return (
                        <span
                          key={`diff-${idx}`}
                          className="rounded px-1.5 py-0.5 bg-status-outdated-bg text-status-outdated-text line-through border border-status-outdated-border/80 font-medium"
                          title="Drifted / Outdated in original assertion"
                        >
                          {token.value}
                        </span>
                      );
                    }
                    if (token.type === 'added') {
                      return (
                        <span
                          key={`diff-${idx}`}
                          className="rounded px-1.5 py-0.5 bg-status-supported-bg text-status-supported-text font-semibold border border-status-supported-border/80"
                          title="Authoritative discovered truth"
                        >
                          {token.value}
                        </span>
                      );
                    }
                    return (
                      <span key={`diff-${idx}`} className="text-text-primary">
                        {token.value}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Context Qualifier Properties Diff Table */}
      {propertyDiffs.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-mono uppercase tracking-wider text-text-muted">
              Qualifier Boundaries & Parameters ({propertyDiffs.length})
            </h4>
            <span className="text-[11px] text-text-muted">
              {propertyDiffs.filter((p) => p.status !== 'unchanged').length} modified
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border-subtle">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-surface-raised border-b border-border-subtle text-text-muted font-mono uppercase text-[10px]">
                  <th className="px-3.5 py-2.5 font-medium">Qualifier</th>
                  <th className="px-3.5 py-2.5 font-medium">Original Context</th>
                  <th className="px-3.5 py-2.5 font-medium">Discovered Context</th>
                  <th className="px-3.5 py-2.5 font-medium">Status</th>
                  {onQualifierChange && <th className="px-3.5 py-2.5 font-medium text-right">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {propertyDiffs.map((diff) => {
                  let badge = (
                    <span className="rounded px-1.5 py-0.5 text-[10px] font-mono bg-surface-raised text-text-muted border border-border-subtle">
                      Identical
                    </span>
                  );
                  if (diff.status === 'modified') {
                    badge = (
                      <span className="rounded px-1.5 py-0.5 text-[10px] font-mono bg-status-outdated-bg text-status-outdated-text border border-status-outdated-border">
                        Drifted
                      </span>
                    );
                  } else if (diff.status === 'added') {
                    badge = (
                      <span className="rounded px-1.5 py-0.5 text-[10px] font-mono bg-status-supported-bg text-status-supported-text border border-status-supported-border">
                        New
                      </span>
                    );
                  } else if (diff.status === 'removed') {
                    badge = (
                      <span className="rounded px-1.5 py-0.5 text-[10px] font-mono bg-surface-raised text-text-muted line-through border border-border-subtle">
                        Omitted
                      </span>
                    );
                  }

                  return (
                    <tr
                      key={diff.key}
                      className={`hover:bg-surface-raised/50 transition-colors ${
                        diff.status !== 'unchanged' ? 'bg-surface-raised/20' : ''
                      }`}
                    >
                      <td className="px-3.5 py-2.5 font-mono text-text-primary font-medium">
                        {diff.label}
                        <span className="block text-[10px] text-text-muted font-normal font-mono">
                          {diff.key}
                        </span>
                      </td>

                      <td className="px-3.5 py-2.5 font-mono text-text-secondary">
                        <span className={diff.status === 'removed' ? 'line-through text-text-muted' : ''}>
                          {diff.originalValue}
                        </span>
                      </td>

                      <td className="px-3.5 py-2.5 font-mono text-text-primary">
                        {editingKey === diff.key ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={editedVal}
                              onChange={(e) => setEditedVal(e.target.value)}
                              className="h-6 px-2 text-xs rounded border border-accent bg-surface font-mono text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveEdit(diff.key)}
                              className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-accent text-white hover:opacity-90"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingKey(null)}
                              className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-border-subtle text-text-muted hover:bg-surface"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <span className={diff.status === 'added' || diff.status === 'modified' ? 'text-accent font-medium' : ''}>
                            {diff.discoveredValue}
                          </span>
                        )}
                      </td>

                      <td className="px-3.5 py-2.5">{badge}</td>

                      {onQualifierChange && (
                        <td className="px-3.5 py-2.5 text-right font-mono">
                          {editingKey !== diff.key && (
                            <button
                              type="button"
                              onClick={() => handleStartEdit(diff.key, diff.discoveredValue !== '—' ? diff.discoveredValue : diff.originalValue)}
                              className="text-[11px] text-accent hover:underline font-mono"
                            >
                              Edit
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Source URL & Provenance Comparison */}
      {(originalSourceUrl || discoveredSourceUrl) && (
        <div className="space-y-3 pt-2">
          <h4 className="text-xs font-mono uppercase tracking-wider text-text-muted">
            Source URL & Provenance Grounding
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Original Source */}
            <div className="p-3.5 rounded-xl border border-border-subtle bg-surface-raised/40 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-mono text-text-muted">
                <span>Original Source</span>
                {originalPublisher && (
                  <span className="text-text-secondary font-medium">{originalPublisher}</span>
                )}
              </div>
              {originalSourceUrl ? (
                <a
                  href={originalSourceUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="block text-xs font-mono text-accent hover:underline break-all"
                >
                  {originalSourceUrl}
                </a>
              ) : (
                <span className="text-xs text-text-muted italic">Unspecified or user-prompt input</span>
              )}
            </div>

            {/* Discovered Source */}
            <div className="p-3.5 rounded-xl border border-accent/30 bg-accent/5 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-mono text-accent">
                <span>Discovered Authoritative Source</span>
                {discoveredPublisher && (
                  <span className="text-text-primary font-medium">{discoveredPublisher}</span>
                )}
              </div>
              {discoveredSourceUrl ? (
                <a
                  href={discoveredSourceUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="block text-xs font-mono text-accent hover:underline break-all"
                >
                  {discoveredSourceUrl}
                </a>
              ) : (
                <span className="text-xs text-text-muted italic">Awaiting web retrieval</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
