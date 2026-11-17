'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { Notice, InlineError } from '@/components/ui/Feedback';
import { Card, CardHeader } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ContextFields } from './ContextFields';
import {
  PasteRequestSchema,
  AskRequestSchema,
  MAX_PASTE_LENGTH,
  MAX_ASK_LENGTH,
  type SharedContext,
  type PasteRequest,
  type AskRequest,
} from '@/lib/contracts/request';
import {
  startPreparationAction,
  confirmPreparationAction,
} from '@/actions/run-actions';
import type { ClaimTicket } from '@/lib/contracts/claim-ticket';
import type {
  StartPreparationActionResult,
  ConfirmPreparationActionResult,
} from '@/lib/contracts/actions';
import { saveCheck } from '@/lib/iphistory';

const SAMPLE_ANSWER_TEXT =
  "Anthropic Claude Pro costs $20 per month in the United States. Stripe's payment intent requires specifying payment_method_types manually on modern API versions. The EU AI Act classifies general-purpose AI models with systemic risk under transparency and evaluation rules. Parag Agrawal is the current CEO of Twitter. Cloudflare Workers enforce a strict maximum limit of 50 milliseconds of CPU execution time.";

export interface InputComposerProps {
  initialAnswerText?: string;
  initialMode?: 'paste' | 'ask';
  initialContext?: SharedContext;
  onValidatedPaste?: (request: PasteRequest) => void;
  onValidatedAsk?: (request: AskRequest) => void;
  showSampleLink?: boolean;
  className?: string;
  onOpenHistory?: () => void;
}

export function InputComposer({
  initialAnswerText = '',
  initialMode = 'paste',
  initialContext = {},
  onValidatedPaste,
  onValidatedAsk,
  showSampleLink = true,
  className = '',
  onOpenHistory,
}: InputComposerProps) {
  const [mode, setMode] = useState<'paste' | 'ask'>(initialMode);
  const [answerText, setAnswerText] = useState(initialAnswerText);
  const [askQuestion, setAskQuestion] = useState('');
  const [context, setContext] = useState<SharedContext>(initialContext);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  React.useEffect(() => {
    if (initialAnswerText !== undefined && initialAnswerText.length > 0) {
      if (initialMode === 'ask') {
        setAskQuestion(initialAnswerText);
      } else {
        setAnswerText(initialAnswerText);
      }
    }
    if (initialMode) {
      setMode(initialMode);
    }
  }, [initialAnswerText, initialMode]);

  // Preparation & Confirmation workflow state (Task C03)
  const [isPreparing, setIsPreparing] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [preparation, setPreparation] = useState<StartPreparationActionResult | null>(null);
  const [confirmedRun, setConfirmedRun] = useState<ConfirmPreparationActionResult | null>(null);
  const [editableClaims, setEditableClaims] = useState<ClaimTicket[]>([]);
  const [splittingIndex, setSplittingIndex] = useState<number | null>(null);
  const [splitPart1, setSplitPart1] = useState('');
  const [splitPart2, setSplitPart2] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingProposition, setEditingProposition] = useState('');
  const [isAddingClaim, setIsAddingClaim] = useState(false);
  const [newClaimText, setNewClaimText] = useState('');

  const resetAll = () => {
    setPreparation(null);
    setConfirmedRun(null);
    setEditableClaims([]);
    setSplittingIndex(null);
    setEditingIndex(null);
    setIsAddingClaim(false);
    setActionError(null);
    setError(null);
    setStatusNotice(null);
  };

  const handlePasteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setActionError(null);
    setStatusNotice(null);

    const validation = PasteRequestSchema.safeParse({
      mode: 'paste',
      answerText,
      context,
    });

    if (!validation.success) {
      const issue = validation.error.issues[0];
      setError(issue?.message || 'Invalid answer text input');
      return;
    }

    if (onValidatedPaste) {
      onValidatedPaste(validation.data);
    }

    setIsPreparing(true);
    try {
      console.log('[InputComposer] Starting paste preparation for text length:', answerText.length);
      const result = await startPreparationAction({
        mode: 'paste',
        text: answerText,
        context,
      });

      if (!result.success) {
        console.error('[InputComposer] Preparation action failed:', result.error, result.code, result.issues);
        setActionError(result.error);
        return;
      }

      console.log(`[InputComposer] Prepared ${result.data.claims.length} candidate claim(s):`, result.data.claims);
      if (result.notice) {
        console.warn('[InputComposer Notice]', result.notice);
        setStatusNotice(result.notice);
      }

      setPreparation(result.data);
      setEditableClaims(result.data.claims);
    } catch (err: unknown) {
      console.error('[InputComposer] Unexpected preparation error:', err);
      const msg = err instanceof Error ? err.message : 'Failed to initiate preparation';
      setActionError(msg);
    } finally {
      setIsPreparing(false);
    }
  };

  const handleAskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setActionError(null);
    setStatusNotice(null);

    const validation = AskRequestSchema.safeParse({
      mode: 'ask',
      question: askQuestion,
      context,
    });

    if (!validation.success) {
      const issue = validation.error.issues[0];
      setError(issue?.message || 'Invalid question input');
      return;
    }

    if (onValidatedAsk) {
      onValidatedAsk(validation.data);
    }

    setIsPreparing(true);
    try {
      console.log('[InputComposer] Starting ask preparation for question:', askQuestion);
      const result = await startPreparationAction({
        mode: 'ask',
        text: askQuestion,
        originalQuestion: askQuestion,
        context,
      });

      if (!result.success) {
        console.error('[InputComposer] Ask preparation failed:', result.error, result.code, result.issues);
        setActionError(result.error);
        return;
      }

      console.log(`[InputComposer] Prepared ${result.data.claims.length} candidate claim(s) from question:`, result.data.claims);
      if (result.notice) {
        console.warn('[InputComposer Notice]', result.notice);
        setStatusNotice(result.notice);
      }

      setPreparation(result.data);
      setEditableClaims(result.data.claims);
    } catch (err: unknown) {
      console.error('[InputComposer] Unexpected ask preparation error:', err);
      const msg = err instanceof Error ? err.message : 'Failed to initiate question preparation';
      setActionError(msg);
    } finally {
      setIsPreparing(false);
    }
  };

  const handleStartSplit = (idx: number) => {
    const claim = editableClaims[idx];
    if (!claim) return;
    setSplittingIndex(idx);
    setEditingIndex(null);
    setIsAddingClaim(false);

    // Heuristic clause split
    const text = claim.normalizedProposition;
    const splitRegex = /;\s*|\s+and\s+|\s+while\s+|\s+as well as\s+|\s+but\s+/i;
    const match = text.match(splitRegex);
    if (match && match.index !== undefined) {
      const part1 = text.slice(0, match.index).trim();
      const part2 = text.slice(match.index + match[0].length).trim();
      setSplitPart1(part1);
      setSplitPart2(part2);
    } else {
      const commaIdx = text.indexOf(',');
      if (commaIdx !== -1) {
        setSplitPart1(text.slice(0, commaIdx).trim());
        setSplitPart2(text.slice(commaIdx + 1).trim());
      } else {
        setSplitPart1(text);
        setSplitPart2('');
      }
    }
  };

  const handleConfirmSplit = () => {
    if (splittingIndex === null || !preparation) return;
    const p1 = splitPart1.trim();
    const p2 = splitPart2.trim();
    if (!p1 || !p2) return;

    const original = editableClaims[splittingIndex];
    const ticket1: ClaimTicket = {
      ...original,
      ticketId: `${original.ticketId}_s1_${Date.now()}`,
      claimId: `${original.claimId}_1`,
      originalStatement: p1,
      normalizedProposition: p1,
    };
    const ticket2: ClaimTicket = {
      ...original,
      ticketId: `${original.ticketId}_s2_${Date.now()}`,
      claimId: `${original.claimId}_2`,
      originalStatement: p2,
      normalizedProposition: p2,
    };

    const nextClaims = [...editableClaims];
    nextClaims.splice(splittingIndex, 1, ticket1, ticket2);
    setEditableClaims(nextClaims);
    setSplittingIndex(null);
    setSplitPart1('');
    setSplitPart2('');
  };

  const handleStartEdit = (idx: number) => {
    const claim = editableClaims[idx];
    if (!claim) return;
    setEditingIndex(idx);
    setEditingProposition(claim.normalizedProposition);
    setSplittingIndex(null);
    setIsAddingClaim(false);
  };

  const handleSaveEdit = () => {
    if (editingIndex === null) return;
    const text = editingProposition.trim();
    if (!text) return;

    const nextClaims = [...editableClaims];
    nextClaims[editingIndex] = {
      ...nextClaims[editingIndex],
      normalizedProposition: text,
      originalStatement: text,
    };
    setEditableClaims(nextClaims);
    setEditingIndex(null);
    setEditingProposition('');
  };

  const handleDeleteClaim = (idx: number) => {
    if (editableClaims.length <= 1) return;
    const nextClaims = editableClaims.filter((_, i) => i !== idx);
    setEditableClaims(nextClaims);
    if (splittingIndex === idx) setSplittingIndex(null);
    if (editingIndex === idx) setEditingIndex(null);
  };

  const handleAddClaim = () => {
    const text = newClaimText.trim();
    if (!text || !preparation) return;

    const base = editableClaims[0];
    const newTicket: ClaimTicket = {
      ticketId: `ticket_custom_${Date.now()}`,
      claimId: `claim_custom_${editableClaims.length + 1}`,
      runId: base?.runId || `run_${preparation.inputHash.slice(0, 16)}`,
      inputHash: preparation.inputHash,
      revision: preparation.revision,
      originalStatement: text,
      normalizedProposition: text,
      domain: base?.domain || 'generic',
      targetTime: base?.targetTime || new Date().toISOString().slice(0, 10),
      verificationContext: [],
      searchContext: null,
      missingMaterialContext: [],
    };

    setEditableClaims([...editableClaims, newTicket]);
    setNewClaimText('');
    setIsAddingClaim(false);
  };

  const handleConfirmRun = async () => {
    if (!preparation) return;

    setIsConfirming(true);
    setActionError(null);

    try {
      const claimsToSubmit = editableClaims.length > 0 ? editableClaims : preparation.claims;
      console.log(`[InputComposer] Confirming run with ${claimsToSubmit.length} claim(s)...`);
      const result = await confirmPreparationAction({
        preparationId: preparation.preparationId,
        inputHash: preparation.inputHash,
        revision: preparation.revision,
        confirmedClaims: claimsToSubmit,
      });

      if (!result.success) {
        console.error('[InputComposer] Run confirmation failed:', result.error, result.code, result.issues);
        setActionError(result.error);
        return;
      }

      console.log('[InputComposer] Run confirmed successfully, run ID:', result.data.runId);
      setConfirmedRun(result.data);

      // Record newly confirmed verification to anonymous IP history
      saveCheck({
        id: result.data.runId,
        timestamp: Date.now(),
        mode,
        title: mode === 'ask'
          ? (askQuestion.slice(0, 48) || 'Question Verification')
          : (answerText.slice(0, 48) || 'Text Verification'),
        queryOrSnippet: mode === 'ask' ? askQuestion : answerText,
        claimsCount: claimsToSubmit.length,
        status: 'running',
        reportUrl: `/report/${result.data.runId}`,
        asOfDate: context.targetDate || undefined,
      });
    } catch (err: unknown) {
      console.error('[InputComposer] Unexpected confirmation exception:', err);
      const msg = err instanceof Error ? err.message : 'Failed to confirm run';
      setActionError(msg);
    } finally {
      setIsConfirming(false);
    }
  };

  const loadSampleInput = () => {
    resetAll();
    setAnswerText(SAMPLE_ANSWER_TEXT);
    setContext({
      targetDate: '2024-09-01',
      jurisdiction: 'US',
      currency: 'USD',
    });
  };

  const clearInput = () => {
    if (mode === 'paste') {
      setAnswerText('');
    } else {
      setAskQuestion('');
    }
    resetAll();
  };

  // State 3: Confirmed Run Active State
  if (confirmedRun) {
    return (
      <div className={`w-full max-w-3xl mx-auto space-y-6 ${className}`}>
        <Card variant="raised" className="border-border-strong">
          <CardHeader
            title="Verification Run Materialized"
            description="The dynamic DAG run was successfully created in PostgreSQL and enqueued."
            action={<StatusBadge status="checking" label="Running (DAG Slice)" size="sm" />}
          />

          <div className="space-y-4 pt-2">
            <div className="rounded-md bg-surface p-4 border border-border-subtle font-mono text-xs space-y-2">
              <div className="flex justify-between items-center text-text-muted">
                <span>Run ID:</span>
                <span className="text-text-primary font-semibold">{confirmedRun.runId}</span>
              </div>
              <div className="flex justify-between items-center text-text-muted">
                <span>Status:</span>
                <span className="text-status-supported-text uppercase">{confirmedRun.status}</span>
              </div>
              <div className="flex justify-between items-center text-text-muted">
                <span>Graph Version:</span>
                <span className="text-text-primary">v{confirmedRun.graphVersion}</span>
              </div>
              <div className="flex justify-between items-center text-text-muted">
                <span>Stream Endpoint:</span>
                <span className="text-accent truncate max-w-[260px]">{confirmedRun.streamUrl}</span>
              </div>
            </div>

            <Notice title="Deterministic Verification Active" className="text-xs">
              DAG execution workers are processing research queries and passage assessments. You can inspect the
              canonical report structure using the sample replay viewer.
            </Notice>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3">
              <Button type="button" variant="secondary" size="md" onClick={resetAll}>
                Verify another answer
              </Button>

              <div className="flex flex-col sm:flex-row items-center gap-2">
                {showSampleLink && (
                  <Link
                    href="/report/demo?mode=fixture"
                    className="inline-flex items-center justify-center h-10 px-4 rounded-[9px] border border-border text-text-secondary hover:text-text-primary hover:bg-surface-elevated text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring text-center"
                  >
                    View sample report
                  </Link>
                )}

                <Link
                  href={`/report/${confirmedRun.runId}`}
                  className="inline-flex items-center justify-center h-10 px-5 rounded-[9px] bg-accent text-accent-contrast hover:bg-accent/90 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring text-center shadow-sm"
                >
                  Open Live Report &rarr;
                </Link>
              </div>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // State 2: Preparation Review State
  if (preparation) {
    const claimsToDisplay = editableClaims.length > 0 ? editableClaims : preparation.claims;

    return (
      <div className={`w-full max-w-3xl mx-auto space-y-6 ${className}`}>
        <Card variant="raised" className="border-border-strong">
          <CardHeader
            title="Review Prepared Claims & Scope"
            description={`Configured ${claimsToDisplay.length} verifiable atomic proposition(s) bound to revision ${preparation.revision}. You can split complex statements, edit propositions, or add new claims.`}
            action={<StatusBadge status="supported" label="Preparation Ready" size="sm" />}
          />

          <div className="space-y-4 pt-1">
            <div className="space-y-3">
              {claimsToDisplay.map((claim, idx) => {
                const isSplitting = splittingIndex === idx;
                const isEditing = editingIndex === idx;

                return (
                  <div
                    key={claim.ticketId}
                    className="rounded-md border border-border-subtle bg-surface p-3.5 space-y-2.5 text-xs transition-colors hover:border-border-subtle/90"
                  >
                    <div className="flex items-center justify-between text-text-muted font-mono">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-text-primary">Claim #{idx + 1}</span>
                        <span className="text-[10px] bg-surface-raised px-1.5 py-0.5 rounded text-text-secondary">
                          {claim.claimId}
                        </span>
                      </div>

                      {/* Action buttons: Split, Edit, Delete */}
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => (isSplitting ? setSplittingIndex(null) : handleStartSplit(idx))}
                          disabled={isConfirming}
                          className="px-2 py-0.5 rounded text-[11px] font-sans font-medium text-accent hover:bg-accent/10 border border-accent/20 transition-colors"
                          title="Break compound sentence into atomic claims"
                        >
                          {isSplitting ? 'Cancel Split' : '✂ Split Claim'}
                        </button>
                        <button
                          type="button"
                          onClick={() => (isEditing ? setEditingIndex(null) : handleStartEdit(idx))}
                          disabled={isConfirming}
                          className="px-2 py-0.5 rounded text-[11px] font-sans text-text-muted hover:text-text-primary hover:bg-surface-raised border border-border-subtle transition-colors"
                          title="Edit proposition text"
                        >
                          {isEditing ? 'Cancel' : '✎ Edit'}
                        </button>
                        {claimsToDisplay.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleDeleteClaim(idx)}
                            disabled={isConfirming}
                            className="px-1.5 py-0.5 rounded text-[11px] text-text-muted hover:text-red-400 hover:bg-red-400/10 border border-border-subtle transition-colors"
                            title="Remove this proposition"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Proposition display or inline editor */}
                    {isEditing ? (
                      <div className="space-y-2 pt-1">
                        <textarea
                          value={editingProposition}
                          onChange={(e) => setEditingProposition(e.target.value)}
                          rows={2}
                          className="w-full rounded-md border border-accent/40 bg-surface-raised p-2 text-sm text-text-primary font-sans focus:outline-none focus:ring-1 focus:ring-accent"
                          placeholder="Edit atomic proposition..."
                        />
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="primary"
                            size="sm"
                            onClick={handleSaveEdit}
                          >
                            Save Proposition
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => setEditingIndex(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm font-medium text-text-primary leading-relaxed">
                        {claim.normalizedProposition}
                      </p>
                    )}

                    {/* Inline Split Form */}
                    {isSplitting && (
                      <div className="mt-2 rounded-lg border border-accent/30 bg-accent/5 p-3 space-y-3">
                        <div className="flex items-center gap-2 text-[11px] font-mono text-accent">
                          <span className="font-semibold uppercase tracking-wider">Break Into Two Atomic Claims</span>
                        </div>
                        <div className="space-y-2">
                          <div>
                            <label className="block text-[10px] font-mono text-text-muted uppercase mb-1">
                              Atomic Proposition 1
                            </label>
                            <input
                              type="text"
                              value={splitPart1}
                              onChange={(e) => setSplitPart1(e.target.value)}
                              className="w-full rounded border border-border-subtle bg-surface px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent"
                              placeholder="First atomic fact..."
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-mono text-text-muted uppercase mb-1">
                              Atomic Proposition 2
                            </label>
                            <input
                              type="text"
                              value={splitPart2}
                              onChange={(e) => setSplitPart2(e.target.value)}
                              className="w-full rounded border border-border-subtle bg-surface px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent"
                              placeholder="Second atomic fact..."
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                          <Button
                            type="button"
                            variant="primary"
                            size="sm"
                            disabled={!splitPart1.trim() || !splitPart2.trim()}
                            onClick={handleConfirmSplit}
                          >
                            Confirm Split
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => setSplittingIndex(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}

                    {claim.verificationContext.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {claim.verificationContext.map((prop: { key: string; value: unknown }) => (
                          <span
                            key={prop.key}
                            className="inline-flex items-center gap-1 rounded bg-surface-raised border border-border-subtle px-2 py-0.5 text-[11px] text-text-secondary font-mono"
                          >
                            <span className="text-text-muted">{prop.key}:</span>
                            <span className="text-accent">{String(prop.value)}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Add Atomic Proposition Button / Form */}
            {isAddingClaim ? (
              <div className="rounded-md border border-border-subtle bg-surface-raised/60 p-3 space-y-2">
                <label className="block text-xs font-mono text-text-muted uppercase">
                  Add New Atomic Proposition
                </label>
                <input
                  type="text"
                  value={newClaimText}
                  onChange={(e) => setNewClaimText(e.target.value)}
                  placeholder="e.g. Stripe requires API version 2024-06-20 for automatic payment methods."
                  className="w-full rounded border border-border-subtle bg-surface px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent"
                />
                <div className="flex items-center gap-2 pt-1">
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    disabled={!newClaimText.trim()}
                    onClick={handleAddClaim}
                  >
                    Add Claim
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setIsAddingClaim(false);
                      setNewClaimText('');
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsAddingClaim(true)}
                disabled={isConfirming}
                className="w-full py-2 border border-dashed border-border-subtle hover:border-accent/40 rounded-md text-xs font-mono text-text-muted hover:text-accent transition-colors flex items-center justify-center gap-1.5"
              >
                <span>+</span>
                <span>Add Atomic Proposition</span>
              </button>
            )}

            {actionError && <InlineError message={actionError} className="mt-2" />}

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-4 border-t border-border-subtle">
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={handleConfirmRun}
                disabled={isConfirming || claimsToDisplay.length === 0}
              >
                {isConfirming ? 'Materializing DAG Run...' : `Confirm & Run Verification (${claimsToDisplay.length})`}
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => {
                    setPreparation(null);
                    setActionError(null);
                  }}
                  disabled={isConfirming}
                >
                  Edit input
                </Button>

                {showSampleLink && (
                  <Link
                    href="/report/demo?mode=fixture"
                    className="inline-flex items-center justify-center h-10 px-4 rounded-[9px] border border-border-subtle bg-surface text-text-secondary hover:text-text-primary hover:bg-surface-raised text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring text-center"
                  >
                    View sample report
                  </Link>
                )}
              </div>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // State 1: Input Composer Form (Default)
  const PRESET_TEMPLATES = [
    {
      label: 'Claude Pro',
      text: "Anthropic Claude Pro costs $20 per month in the United States. Priority access is granted during peak hours.",
      context: { targetDate: '2024-09-01', jurisdiction: 'US', currency: 'USD' },
    },
    {
      label: 'Stripe API',
      text: "Stripe's payment intent requires specifying payment_method_types manually on modern API versions.",
      context: { targetDate: '2024-09-01' },
    },
    {
      label: 'Twitter CEO',
      text: "Parag Agrawal is the current CEO of Twitter following Jack Dorsey stepping down as Chief Executive Officer.",
      context: { targetDate: '2024-09-01' },
    },
  ];

  return (
    <div className={`w-full max-w-3xl mx-auto rounded-xl border border-border-subtle/80 bg-surface/60 backdrop-blur-xs p-6 sm:p-7 space-y-6 shadow-xs ${className}`}>
      {/* Mode Switch Tabs & Past Checks link */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle/70 pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setMode('paste');
              resetAll();
            }}
            className={`px-3 py-1.5 text-xs font-mono tracking-wider uppercase rounded-xs border transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus-ring ${
              mode === 'paste'
                ? 'border-border-strong bg-surface-raised text-text-primary shadow-xs font-medium'
                : 'border-transparent text-text-muted hover:text-text-primary hover:bg-surface-raised/40'
            }`}
            aria-selected={mode === 'paste'}
            role="tab"
          >
            Atomic Extraction (Paste)
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('ask');
              resetAll();
            }}
            aria-label="Ask question"
            className={`px-3 py-1.5 text-xs font-mono tracking-wider uppercase rounded-xs border transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus-ring ${
              mode === 'ask'
                ? 'border-border-strong bg-surface-raised text-text-primary shadow-xs font-medium'
                : 'border-transparent text-text-muted hover:text-text-primary hover:bg-surface-raised/40'
            }`}
            aria-selected={mode === 'ask'}
            role="tab"
          >
            Temporal Query (Ask)
            <span className="ml-1.5 rounded-xs bg-surface px-1.5 py-0.2 text-[9px] text-text-muted border border-border-subtle/60">
              Phase 3
            </span>
          </button>
        </div>

        {onOpenHistory && (
          <button
            type="button"
            onClick={onOpenHistory}
            className="text-[11px] font-mono text-text-muted hover:text-text-primary flex items-center gap-1 transition-colors cursor-pointer"
            title="Inspect recent checks from your IP address"
          >
            <span>◷ Past checks</span>
            <span>↗</span>
          </button>
        )}
      </div>

      {/* Main Input Form */}
      {mode === 'paste' ? (
        <form onSubmit={handlePasteSubmit} className="space-y-4">
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-text-muted" />
                <label htmlFor="answer-input" className="text-xs font-mono uppercase tracking-wider text-text-primary">
                  AI-Generated Answer Text
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted hidden sm:inline-block">
                  Presets:
                </span>
                <button
                  type="button"
                  onClick={loadSampleInput}
                  aria-label="Try sample input"
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xs border border-border-subtle/80 bg-surface hover:bg-surface-raised hover:border-border-strong text-[10px] font-mono text-text-secondary hover:text-text-primary transition-all cursor-pointer"
                >
                  <span>Golden Suite</span>
                </button>
                {PRESET_TEMPLATES.map((tmpl) => (
                  <button
                    key={tmpl.label}
                    type="button"
                    onClick={() => {
                      resetAll();
                      setAnswerText(tmpl.text);
                      if (tmpl.context) setContext(tmpl.context);
                    }}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xs border border-border-subtle/80 bg-surface hover:bg-surface-raised hover:border-border-strong text-[10px] font-mono text-text-muted hover:text-text-primary transition-all cursor-pointer"
                  >
                    <span>{tmpl.label}</span>
                  </button>
                ))}

                {answerText.length > 0 && (
                  <button
                    type="button"
                    onClick={clearInput}
                    className="text-[10px] font-mono text-text-muted hover:text-status-contradicted-text transition-colors ml-1 cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            <Textarea
              id="answer-input"
              value={answerText}
              onChange={(e) => {
                setAnswerText(e.target.value);
                if (error) setError(null);
                if (actionError) setActionError(null);
                if (statusNotice) setStatusNotice(null);
              }}
              placeholder="Paste an AI-generated answer or summary to evaluate its time-sensitive factual assertions against authoritative ground truth..."
              rows={7}
              maxLength={MAX_PASTE_LENGTH}
              showCount
              error={error || undefined}
              className="font-sans text-sm leading-relaxed"
            />
          </div>

          {/* Progressive Context Accordion */}
          <ContextFields context={context} onChange={setContext} />

          {/* Error and Status Notices */}
          {actionError && <InlineError message={actionError} className="text-xs" />}

          {statusNotice && (
            <Notice title="Verification Ready" className="text-xs">
              {statusNotice}
            </Notice>
          )}

          {/* Form Actions */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-border-subtle/60">
            <button
              type="submit"
              disabled={isPreparing}
              className="inline-flex items-center justify-center h-10 px-6 rounded-xs bg-[#E8E1DA] hover:bg-[#F4F4F0] text-[#111215] font-mono text-xs tracking-wider uppercase font-semibold transition-all shadow-xs cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus-ring disabled:opacity-50"
            >
              {isPreparing ? 'Preparing claims...' : 'Verify answer →'}
            </button>

            {showSampleLink && (
              <Link
                href="/report/demo?mode=fixture"
                className="inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-xs border border-border-subtle bg-surface/70 hover:bg-surface-raised text-text-secondary hover:text-text-primary text-xs font-mono transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus-ring text-center"
              >
                <span>View sample report</span>
                <span className="text-[9px] rounded-xs bg-surface-raised px-1 py-0.2 border border-border-subtle text-text-muted">
                  Replay
                </span>
              </Link>
            )}
          </div>
        </form>
      ) : (
        <form onSubmit={handleAskSubmit} className="space-y-4">
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-text-muted" />
                <label htmlFor="ask-input" className="text-xs font-mono uppercase tracking-wider text-text-primary">
                  Question to verify
                </label>
              </div>

              {askQuestion.length > 0 && (
                <button
                  type="button"
                  onClick={clearInput}
                  className="text-[10px] font-mono text-text-muted hover:text-status-contradicted-text transition-colors cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>

            <Textarea
              id="ask-input"
              value={askQuestion}
              onChange={(e) => {
                setAskQuestion(e.target.value);
                if (error) setError(null);
                if (actionError) setActionError(null);
                if (statusNotice) setStatusNotice(null);
              }}
              placeholder="Ask a question requiring current facts (e.g., 'What are the current pricing tiers for Anthropic Claude?')..."
              rows={4}
              maxLength={MAX_ASK_LENGTH}
              showCount
              error={error || undefined}
              className="font-sans text-sm leading-relaxed"
            />
          </div>

          <ContextFields context={context} onChange={setContext} />

          {actionError && <InlineError message={actionError} className="text-xs" />}

          {statusNotice && (
            <Notice title="Question Received" className="text-xs">
              {statusNotice}
            </Notice>
          )}

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-border-subtle/60">
            <button
              type="submit"
              disabled={isPreparing}
              className="inline-flex items-center justify-center h-10 px-6 rounded-xs bg-[#E8E1DA] hover:bg-[#F4F4F0] text-[#111215] font-mono text-xs tracking-wider uppercase font-semibold transition-all shadow-xs cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus-ring disabled:opacity-50"
            >
              {isPreparing ? 'Preparing question...' : 'Submit question →'}
            </button>

            {showSampleLink && (
              <Link
                href="/report/demo?mode=fixture"
                className="inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-xs border border-border-subtle bg-surface/70 hover:bg-surface-raised text-text-secondary hover:text-text-primary text-xs font-mono transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus-ring text-center"
              >
                <span>View sample report</span>
                <span className="text-[9px] rounded-xs bg-surface-raised px-1 py-0.2 border border-border-subtle text-text-muted">
                  Replay
                </span>
              </Link>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
