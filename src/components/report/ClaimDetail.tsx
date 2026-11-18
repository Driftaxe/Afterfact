'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { ClaimResultItem } from '@/lib/contracts/report';
import type { EvidenceItem } from '@/lib/contracts/evidence';
import type { ClarificationQuestion } from '@/lib/contracts/clarification';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/Button';
import { compareAction } from '@/actions/run-actions';
import { EvidenceCard } from './EvidenceCard';
import { ClarificationForm } from './ClarificationForm';
import { ChangeTimeline } from './ChangeTimeline';
import { ScheduledChangeBadge } from './ScheduledChangeBadge';
import { ContextComparison } from '@/components/ContextComparison';

/**
 * Context data required to render an inline clarification form within a claim detail.
 * 'waiting_for_input' is a DAG Node state, not a ClaimResultItem state.
 * The parent (LiveReportViewer / ReportView) is responsible for passing this
 * context when it detects the DAG branch is waiting_for_input.
 */
export interface ClaimClarificationContext {
  clarificationId: string;
  questions: ClarificationQuestion[];
}

export interface ClaimDetailProps {
  claim: ClaimResultItem | null;
  evidenceMap: Map<string, EvidenceItem>;
  clarification?: ClaimClarificationContext;
  onClarificationSuccess?: () => void;
  runId?: string;
  className?: string;
}

interface MissingContextResolverProps {
  claim: ClaimResultItem;
  runId?: string;
}

function MissingContextResolver({ claim, runId }: MissingContextResolverProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(true);

  // Determine initial qualifier key
  const [selectedKey, setSelectedKey] = useState<string>(() => {
    if (claim.missingMaterialContext && claim.missingMaterialContext.length > 0) {
      return claim.missingMaterialContext[0];
    }
    const txt = claim.rawText.toLowerCase();
    if (txt.includes('cloudflare') || txt.includes('execution time') || txt.includes('limit')) return 'plan_tier';
    if (txt.includes('stripe') || txt.includes('payment')) return 'apiVersion';
    if (txt.includes('twitter') || txt.includes('ceo') || txt.includes('reign') || txt.includes('queen') || txt.includes('wife')) return 'asOfDate';
    return 'asOfDate';
  });

  // Pre-configured options for known domain qualifiers (MCQs)
  const suggestedOptions: { label: string; value: string; hint: string }[] = useMemo(() => {
    if (selectedKey === 'plan_tier') {
      return [
        { label: 'Workers Paid', value: 'Workers Paid', hint: 'Permits up to 50ms CPU execution time' },
        { label: 'Workers Free', value: 'Workers Free', hint: 'Strict 10ms CPU execution limit' },
      ];
    }
    if (selectedKey === 'apiVersion') {
      return [
        { label: '2024-06-20 (Modern)', value: '2024-06-20', hint: 'Explicit payment_method_types required' },
        { label: '2020-08-27 (Legacy)', value: '2020-08-27', hint: 'Implicit default payment methods allowed' },
      ];
    }
    if (selectedKey === 'jurisdiction') {
      return [
        { label: 'United States (US)', value: 'US', hint: 'Federal / US nationwide jurisdiction' },
        { label: 'United Kingdom (UK)', value: 'UK', hint: 'United Kingdom domestic jurisdiction' },
        { label: 'European Union (EU)', value: 'EU', hint: 'EU Community regulatory framework' },
        { label: 'Global / International', value: 'Global', hint: 'Worldwide international scope' },
      ];
    }
    // Default to asOfDate
    return [
      { label: '2024-09-01 (Present)', value: '2024-09-01', hint: 'Current / modern authoritative state' },
      { label: '2022-09-08 (Historical 2022)', value: '2022-09-08', hint: 'Historical period prior to royal succession / transition' },
      { label: '2021-12-01 (Historical 2021)', value: '2021-12-01', hint: 'Historical initial state (Dorsey resignation / Parag appointed)' },
    ];
  }, [selectedKey]);

  const [selectedValue, setSelectedValue] = useState<string>(
    suggestedOptions[0]?.value || ''
  );
  const [customKey, setCustomKey] = useState<string>('');
  const [customValue, setCustomValue] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [simulationResult, setSimulationResult] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const activeKey = selectedKey === 'custom' ? (customKey.trim() || 'qualifier') : selectedKey;
  const effectiveValue = customValue.trim() || selectedValue;

  const handleResolve = async () => {
    if (!effectiveValue) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    setSimulationResult(null);

    try {
      if (runId && !runId.startsWith('sample') && !runId.startsWith('fixture')) {
        const res = await compareAction({
          parentRunId: runId,
          claimId: claim.claimId || claim.id,
          targetContext: {
            [activeKey]: effectiveValue,
          },
        });

        if (res.success && res.data.childRunId) {
          router.push(`/report/${res.data.childRunId}`);
          return;
        } else if (!res.success) {
          setErrorMsg(res.error || 'Failed to dispatch comparison run.');
        }
      } else {
        // Replay / fixture mode simulation
        await new Promise((r) => setTimeout(r, 350));
        let outcome = '';
        if (activeKey === 'plan_tier') {
          if (effectiveValue.includes('Paid')) {
            outcome = '✓ Under "Workers Paid" (50ms limit), this proposition is SUPPORTED (Freshness Score: 100/100).';
          } else {
            outcome = '✗ Under "Workers Free" (10ms limit), this proposition is CONTRADICTED (Freshness Score: 0/100).';
          }
        } else if (activeKey === 'apiVersion') {
          if (effectiveValue.startsWith('2024') || effectiveValue.includes('Modern')) {
            outcome = '✓ Under Stripe API 2024-06-20, manual payment_method_types is mandatory: SUPPORTED (100/100).';
          } else {
            outcome = '✗ Under legacy Stripe API versions, automatic payment methods were enabled: OUTDATED (0/100).';
          }
        } else if (activeKey === 'asOfDate') {
          if (effectiveValue.startsWith('2024') || effectiveValue.startsWith('2023')) {
            outcome = `✓ Re-evaluated with target date ${effectiveValue}: Decisive current-state verdict reached.`;
          } else {
            outcome = `✓ Re-evaluated under historical interval ${effectiveValue}: Prior validity confirmed.`;
          }
        } else {
          outcome = `Context resolved: under ${activeKey} = "${effectiveValue}", this proposition resolves deterministically.`;
        }
        setSimulationResult(outcome);
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Context comparison failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-xl border border-amber-500/40 bg-surface-raised p-5 space-y-4 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-border-subtle/80">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <h4 className="text-xs font-mono font-semibold uppercase tracking-wider text-text-primary">
            More Context Needed
          </h4>
          <span className="rounded-xs bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[10px] font-mono text-amber-300">
            {claim.verdict || 'insufficient_evidence'}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="text-xs font-mono text-accent hover:underline self-start sm:self-auto"
        >
          {isOpen ? '▲ Collapse Form' : '▼ Expand Context Form'}
        </button>
      </div>

      <p className="text-xs text-text-secondary leading-relaxed">
        Factual verification was inconclusive or dependent on missing parameters ({claim.reasonCode || 'INSUFFICIENT_RETRIEVAL_DATA'}).
        Select a qualifier category and choice below or enter custom text to re-evaluate deterministically.
      </p>

      {isOpen && (
        <div className="space-y-4 pt-1">
          {/* Qualifier Dimension Selector Pills */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-mono text-text-muted uppercase">
              1. Select Qualifier Dimension:
            </label>
            <div className="flex flex-wrap gap-1.5">
              {[
                { id: 'asOfDate', label: 'Target Date / As-Of' },
                { id: 'jurisdiction', label: 'Jurisdiction / Region' },
                { id: 'apiVersion', label: 'API Version' },
                { id: 'plan_tier', label: 'Execution Tier' },
                { id: 'custom', label: 'Custom Key' },
              ].map((dim) => (
                <button
                  key={dim.id}
                  type="button"
                  onClick={() => {
                    setSelectedKey(dim.id);
                    setSimulationResult(null);
                  }}
                  className={`px-2.5 py-1 rounded text-xs font-mono transition-colors ${
                    selectedKey === dim.id
                      ? 'bg-accent text-accent-contrast font-semibold shadow-xs'
                      : 'bg-surface border border-border-subtle text-text-secondary hover:text-text-primary hover:border-border-strong'
                  }`}
                >
                  {dim.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Key Input (if custom selected) */}
          {selectedKey === 'custom' && (
            <div className="space-y-1">
              <label className="block text-[11px] font-mono text-text-muted uppercase">
                Custom Qualifier Key:
              </label>
              <input
                type="text"
                value={customKey}
                onChange={(e) => setCustomKey(e.target.value)}
                placeholder="e.g. relation, jurisdiction, sdkVersion..."
                className="w-full rounded-lg border border-border-subtle bg-surface px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent"
              />
            </div>
          )}

          {/* Quick Options MCQs */}
          {suggestedOptions.length > 0 && selectedKey !== 'custom' && (
            <div className="space-y-2">
              <label className="block text-[11px] font-mono text-text-muted uppercase">
                2. Quick Options (MCQs) for <code className="text-accent">{selectedKey}</code>:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {suggestedOptions.map((opt) => {
                  const isSelected = effectiveValue === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setSelectedValue(opt.value);
                        setCustomValue('');
                        setSimulationResult(null);
                      }}
                      className={`p-2.5 rounded-lg border text-left text-xs transition-all ${
                        isSelected
                          ? 'border-accent bg-accent/10 text-text-primary shadow-xs'
                          : 'border-border-subtle bg-surface hover:border-border-strong text-text-secondary'
                      }`}
                    >
                      <div className="font-semibold">{opt.label}</div>
                      <div className="text-[10px] text-text-muted mt-0.5">{opt.hint}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Custom input override */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-mono text-text-muted uppercase">
              {selectedKey === 'custom' ? 'Qualifier Value:' : 'Or Enter Custom Textfield Value:'}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={customValue}
                onChange={(e) => {
                  setCustomValue(e.target.value);
                  setSimulationResult(null);
                }}
                placeholder={`e.g. custom ${activeKey} value...`}
                className="flex-1 rounded-lg border border-border-subtle bg-surface px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          {simulationResult && (
            <div className="p-3 rounded-lg border border-status-supported-border bg-status-supported-bg text-xs font-mono text-status-supported-text">
              {simulationResult}
            </div>
          )}

          {errorMsg && (
            <div className="p-3 rounded-lg border border-red-500/30 bg-red-500/10 text-xs text-red-400">
              {errorMsg}
            </div>
          )}

          <div className="pt-2 border-t border-border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span className="text-[11px] font-mono text-text-muted">
              Active Context: <code className="text-accent">{activeKey} = &quot;{effectiveValue || '—'}&quot;</code>
            </span>
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={!effectiveValue || isSubmitting}
              onClick={handleResolve}
            >
              {isSubmitting ? 'Evaluating Context...' : 'Re-evaluate with this Context →'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function ClaimDetail({
  claim,
  evidenceMap,
  clarification,
  onClarificationSuccess,
  runId,
  className = '',
}: ClaimDetailProps) {
  const driftDiscoveredText = useMemo(() => {
    if (!claim) return '';
    if (claim.correction?.replacementText) {
      return claim.correction.replacementText;
    }
    const currentEntry = claim.timeline?.find((e) => e.state === 'current');
    if (currentEntry?.summary) return currentEntry.summary;

    const transitionEntry = claim.timeline?.find((e) => e.state === 'transition');
    if (transitionEntry?.summary) return transitionEntry.summary;

    if (claim.state === 'assessed' && claim.scoreReason) {
      return claim.scoreReason;
    }
    return '';
  }, [claim]);

  if (!claim) {
    return (
      <div className={`rounded-2xl border border-border-subtle bg-surface p-6 text-center text-xs text-text-muted ${className}`}>
        Select a claim or answer highlight to inspect detailed evidence.
      </div>
    );
  }

  let verdictStatus = 'checking';
  let verdictLabel = 'Pending';
  let scoreText = '—';
  let scoreClass = 'text-text-muted';

  if (claim.state === 'assessed') {
    verdictStatus = claim.verdict;
    if (claim.verdict === 'supported') verdictLabel = 'Supported';
    else if (claim.verdict === 'outdated') verdictLabel = 'Outdated';
    else if (claim.verdict === 'contradicted') verdictLabel = 'Contradicted';
    else if (claim.verdict === 'depends_on_context') verdictLabel = 'Depends on Context';
    else if (claim.verdict === 'conflicting_evidence') verdictLabel = 'Conflicting Evidence';
    else if (claim.verdict === 'insufficient_evidence') verdictLabel = 'Insufficient Evidence';

    if (claim.score !== null) {
      scoreText = `${claim.score}`;
      if (claim.score === 100 || claim.score === 75) scoreClass = 'text-status-supported-text';
      else if (claim.score === 0) scoreClass = 'text-status-contradicted-text';
    } else {
      scoreText = 'Unresolved (—)';
      scoreClass = 'text-status-unresolved-text';
    }
  } else if (claim.state === 'failed') {
    verdictStatus = 'unresolved';
    verdictLabel = 'Failed';
  }

  // Gather referenced evidence items in order
  const citedEvidence: EvidenceItem[] = [];
  if (claim.evidenceIds) {
    for (const id of claim.evidenceIds) {
      const evi = evidenceMap.get(id);
      if (evi) citedEvidence.push(evi);
    }
  }

  // Check if this claim requires word-by-word context drift analysis
  const needsDriftAnalysis =
    Boolean(claim.correction) ||
    claim.verdict === 'outdated' ||
    claim.verdict === 'contradicted' ||
    claim.verdict === 'depends_on_context' ||
    Boolean(claim.timeline && claim.timeline.some((e) => e.state === 'transition' || e.state === 'current'));

  const driftOriginalText = claim.correction?.originalText || claim.rawText;

  // Detect future-dated scheduled changes without falsely marking current fact stale
  const upcomingEntry = claim.timeline?.find((e) => e.state === 'upcoming');
  const hasScheduledChange =
    Boolean(upcomingEntry) ||
    (claim.state === 'assessed' && claim.reasonCode === 'SCHEDULED_CHANGE_PENDING');

  const hasTimelineData =
    Boolean(claim.timeline && claim.timeline.length > 0) ||
    Boolean('transition' in claim && (claim as unknown as { transition?: unknown }).transition);

  return (
    <div
      className={`rounded-xl border border-border-subtle/80 bg-surface/70 backdrop-blur-xs p-6 sm:p-7 space-y-6 shadow-xs ${className}`}
      role="region"
      aria-label={`Claim details for claim ${claim.ordinal + 1}`}
    >
      {/* Dossier Section Pre-Header */}
      <div className="space-y-4 pb-4 border-b border-border-subtle/70">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-text-muted">
              CLAIM INSPECTOR // {claim.id}
            </span>
          </div>

          <div className="text-right">
            <div className="text-xs font-mono font-semibold">
              <span className="text-text-muted">Freshness Score: </span>
              <span className={scoreClass}>{scoreText}</span>
            </div>
            <p className="text-[10px] text-text-muted mt-0.5 font-sans">
              Freshness score reflects the verification rubric, not a probability.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-xs bg-surface-raised text-[10px] font-mono font-medium text-text-muted border border-border-subtle">
            {claim.ordinal + 1}
          </span>
          <StatusBadge status={verdictStatus} label={verdictLabel} size="md" />
          {hasScheduledChange && (
            <ScheduledChangeBadge
              effectiveDate={upcomingEntry?.effectiveDate}
              announcementDate={upcomingEntry?.announcementDate}
              size="sm"
            />
          )}
        </div>

        {/* Claim Quote in Editorial Serif */}
        <div className="relative pl-3.5 border-l-2 border-border-strong py-0.5">
          <p className="font-serif text-base sm:text-lg text-text-primary leading-relaxed font-normal italic">
            “{claim.rawText}”
          </p>
        </div>

        {claim.state === 'assessed' && claim.scoreReason && (
          <div className="p-3.5 rounded-lg bg-surface-raised/80 border border-border-subtle/80 text-xs text-text-secondary leading-relaxed space-y-1.5">
            <div className="flex items-center gap-2 text-[11px] font-mono text-text-muted">
              <span className="uppercase tracking-wider">Decision Reason</span>
              {claim.reasonCode && (
                <>
                  <span>·</span>
                  <span className="text-accent font-semibold">{claim.reasonCode}</span>
                </>
              )}
            </div>
            <p className="text-text-primary/90">{claim.scoreReason}</p>
          </div>
        )}
      </div>

      {/* Then vs. Now Transition Timeline */}
      {hasTimelineData && (
        <ChangeTimeline
          timeline={claim.timeline}
          transition={'transition' in claim ? (claim as unknown as { transition?: unknown }).transition : undefined}
          evidenceMap={evidenceMap}
        />
      )}

      {/* Verified Surgical Correction Diff (if present) */}
      {claim.state === 'assessed' && claim.correction && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--af-sage)]" />
              <h4 className="text-[11px] font-mono text-text-muted uppercase tracking-[0.16em]">
                Surgical Correction
              </h4>
            </div>
            {claim.correction.verified && (
              <span className="rounded-xs bg-status-supported-bg border border-status-supported-border px-1.5 py-0.5 text-[10px] text-status-supported-text font-mono font-medium tracking-wider uppercase">
                Verified
              </span>
            )}
          </div>

          {claim.correction.replacementText && (
            <div className="p-3 rounded-lg bg-surface-raised/80 border border-border-subtle text-xs sm:text-sm font-medium text-text-primary leading-relaxed">
              {claim.correction.replacementText}
            </div>
          )}

          <pre className="rounded-lg border border-border-subtle/80 bg-surface-raised/90 p-3.5 text-xs font-mono text-text-primary leading-relaxed overflow-x-auto whitespace-pre-wrap">
            {claim.correction.diff}
          </pre>
        </div>
      )}

      {/* Word-by-Word Context Drift Analysis */}
      {needsDriftAnalysis && driftDiscoveredText && (
        <ContextComparison
          title="Word-by-Word Context Drift Analysis"
          originalText={driftOriginalText}
          discoveredText={driftDiscoveredText}
          defaultTab="unified"
          discoveredSourceUrl={
            claim.correction?.evidenceIds?.[0]
              ? evidenceMap.get(claim.correction.evidenceIds[0])?.url
              : citedEvidence[0]?.url
          }
          discoveredPublisher={
            claim.correction?.evidenceIds?.[0]
              ? evidenceMap.get(claim.correction.evidenceIds[0])?.publisher
              : citedEvidence[0]?.publisher
          }
        />
      )}

      {/* Interactive Missing Context Resolution Form (Shown only when verification depends on context or missing parameters) */}
      {((('verdict' in claim && claim.verdict === 'depends_on_context') ||
        ('reasonCode' in claim && claim.reasonCode === 'ESSENTIAL_CONTEXT_MISSING') ||
        Boolean(claim.missingMaterialContext && claim.missingMaterialContext.length > 0))) && (
        <MissingContextResolver claim={claim} runId={runId} />
      )}

      {/* Dynamic Clarification Form (when DAG branch is waiting_for_input) */}
      {clarification && (
        <ClarificationForm
          clarificationId={clarification.clarificationId}
          questions={clarification.questions}
          onSuccess={onClarificationSuccess ?? (() => {})}
        />
      )}

      {/* Cited Evidence Cards */}
      <div className="space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-text-muted" />
            <h4 className="text-[11px] font-mono text-text-muted uppercase tracking-[0.16em]">
              Cited Evidence ({citedEvidence.length})
            </h4>
          </div>
        </div>

        {citedEvidence.length === 0 ? (
          <p className="text-xs text-text-muted font-mono">
            No direct web evidence attached to this claim result.
          </p>
        ) : (
          <div className="space-y-3">
            {citedEvidence.map((evi) => (
              <EvidenceCard key={evi.id} evidence={evi} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
