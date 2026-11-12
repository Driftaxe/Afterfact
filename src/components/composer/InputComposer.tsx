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
import type {
  StartPreparationActionResult,
  ConfirmPreparationActionResult,
} from '@/lib/contracts/actions';

const SAMPLE_ANSWER_TEXT =
  "Anthropic Claude Pro costs $20 per month in the United States. Stripe's payment intent requires specifying payment_method_types manually on modern API versions. The EU AI Act classifies general-purpose AI models with systemic risk under transparency and evaluation rules. Parag Agrawal is the current CEO of Twitter. Cloudflare Workers enforce a strict maximum limit of 50 milliseconds of CPU execution time.";

export interface InputComposerProps {
  initialAnswerText?: string;
  initialContext?: SharedContext;
  onValidatedPaste?: (request: PasteRequest) => void;
  onValidatedAsk?: (request: AskRequest) => void;
  showSampleLink?: boolean;
  className?: string;
}

export function InputComposer({
  initialAnswerText = '',
  initialContext = {},
  onValidatedPaste,
  onValidatedAsk,
  showSampleLink = true,
  className = '',
}: InputComposerProps) {
  const [mode, setMode] = useState<'paste' | 'ask'>('paste');
  const [answerText, setAnswerText] = useState(initialAnswerText);
  const [askQuestion, setAskQuestion] = useState('');
  const [context, setContext] = useState<SharedContext>(initialContext);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  // Preparation & Confirmation workflow state (Task C03)
  const [isPreparing, setIsPreparing] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [preparation, setPreparation] = useState<StartPreparationActionResult | null>(null);
  const [confirmedRun, setConfirmedRun] = useState<ConfirmPreparationActionResult | null>(null);

  const resetAll = () => {
    setPreparation(null);
    setConfirmedRun(null);
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
      const result = await startPreparationAction({
        mode: 'paste',
        text: answerText,
        context,
      });

      if (!result.success) {
        setActionError(result.error);
        return;
      }

      setPreparation(result.data);
    } catch (err: unknown) {
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
      const result = await startPreparationAction({
        mode: 'ask',
        text: askQuestion,
        originalQuestion: askQuestion,
        context,
      });

      if (!result.success) {
        setActionError(result.error);
        return;
      }

      setPreparation(result.data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to initiate question preparation';
      setActionError(msg);
    } finally {
      setIsPreparing(false);
    }
  };

  const handleConfirmRun = async () => {
    if (!preparation) return;

    setIsConfirming(true);
    setActionError(null);

    try {
      const result = await confirmPreparationAction({
        preparationId: preparation.preparationId,
        inputHash: preparation.inputHash,
        revision: preparation.revision,
        confirmedClaims: preparation.claims,
      });

      if (!result.success) {
        setActionError(result.error);
        return;
      }

      setConfirmedRun(result.data);
    } catch (err: unknown) {
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

              {showSampleLink && (
                <Link
                  href="/report/demo?mode=fixture"
                  className="inline-flex items-center justify-center h-10 px-4 rounded-[9px] bg-accent text-accent-contrast hover:bg-accent/90 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring text-center"
                >
                  View sample report (Replay)
                </Link>
              )}
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // State 2: Preparation Review State
  if (preparation) {
    return (
      <div className={`w-full max-w-3xl mx-auto space-y-6 ${className}`}>
        <Card variant="raised" className="border-border-strong">
          <CardHeader
            title="Review Prepared Claims & Scope"
            description={`Extracted ${preparation.claims.length} verifiable factual proposition(s) bound to revision ${preparation.revision}.`}
            action={<StatusBadge status="supported" label="Preparation Ready" size="sm" />}
          />

          <div className="space-y-4 pt-1">
            <div className="space-y-3">
              {preparation.claims.map((claim, idx) => (
                <div
                  key={claim.ticketId}
                  className="rounded-md border border-border-subtle bg-surface p-3.5 space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between text-text-muted font-mono">
                    <span>Claim #{idx + 1}</span>
                    <span className="text-[10px] bg-surface-raised px-1.5 py-0.5 rounded text-text-secondary">
                      {claim.claimId}
                    </span>
                  </div>

                  <p className="text-sm font-medium text-text-primary leading-relaxed">
                    {claim.normalizedProposition}
                  </p>

                  {claim.verificationContext.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {claim.verificationContext.map((prop) => (
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
              ))}
            </div>

            {actionError && <InlineError message={actionError} className="mt-2" />}

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-4 border-t border-border-subtle">
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={handleConfirmRun}
                disabled={isConfirming}
              >
                {isConfirming ? 'Materializing DAG Run...' : 'Confirm & Run Verification'}
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
  return (
    <div className={`w-full max-w-3xl mx-auto space-y-6 ${className}`}>
      {/* Mode Switch Tabs */}
      <div className="flex items-center gap-2 border-b border-border-subtle pb-2">
        <button
          type="button"
          onClick={() => {
            setMode('paste');
            resetAll();
          }}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
            mode === 'paste'
              ? 'bg-surface-raised text-text-primary'
              : 'text-text-muted hover:text-text-secondary'
          }`}
          aria-selected={mode === 'paste'}
          role="tab"
        >
          Paste answer
        </button>
        <button
          type="button"
          onClick={() => {
            setMode('ask');
            resetAll();
          }}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
            mode === 'ask'
              ? 'bg-surface-raised text-text-primary'
              : 'text-text-muted hover:text-text-secondary'
          }`}
          aria-selected={mode === 'ask'}
          role="tab"
        >
          Ask question
          <span className="ml-1.5 rounded bg-surface px-1.5 py-0.5 text-[10px] text-text-muted">
            Phase 3
          </span>
        </button>
      </div>

      {/* Main Input Form */}
      {mode === 'paste' ? (
        <form onSubmit={handlePasteSubmit} className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="answer-input" className="text-sm font-medium text-text-primary">
                AI-Generated Answer
              </label>
              <div className="flex items-center gap-3">
                {answerText.length > 0 && (
                  <button
                    type="button"
                    onClick={clearInput}
                    className="text-xs text-text-muted hover:text-text-secondary transition-colors"
                  >
                    Clear
                  </button>
                )}
                <button
                  type="button"
                  onClick={loadSampleInput}
                  className="text-xs text-accent hover:underline transition-colors"
                >
                  Try sample input
                </button>
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
              placeholder="Paste an AI-generated answer or summary to evaluate its time-sensitive factual assertions..."
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
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
            <Button type="submit" variant="primary" size="md" disabled={isPreparing}>
              {isPreparing ? 'Preparing claims...' : 'Verify answer'}
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
        </form>
      ) : (
        <form onSubmit={handleAskSubmit} className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="ask-input" className="text-sm font-medium text-text-primary">
                Question to verify
              </label>
              {askQuestion.length > 0 && (
                <button
                  type="button"
                  onClick={clearInput}
                  className="text-xs text-text-muted hover:text-text-secondary transition-colors"
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

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
            <Button type="submit" variant="primary" size="md" disabled={isPreparing}>
              {isPreparing ? 'Preparing question...' : 'Submit question'}
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
        </form>
      )}
    </div>
  );
}
