'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { Notice } from '@/components/ui/Feedback';
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
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  const handlePasteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
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
    } else {
      setStatusNotice(
        "Live verification isn’t available yet. Explore a sample report to see how claims and evidence are presented."
      );
    }
  };

  const handleAskSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
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
    } else {
      setStatusNotice(
        'Question validated successfully against AskRequestSchema. Model generation and live search are scheduled for Phase 3 (Task C07). Explore the sample report for verified results.'
      );
    }
  };

  const loadSampleInput = () => {
    setAnswerText(SAMPLE_ANSWER_TEXT);
    setContext({
      targetDate: '2024-09-01',
      jurisdiction: 'US',
      currency: 'USD',
    });
    setError(null);
    setStatusNotice(null);
  };

  const clearInput = () => {
    if (mode === 'paste') {
      setAnswerText('');
    } else {
      setAskQuestion('');
    }
    setError(null);
    setStatusNotice(null);
  };

  return (
    <div className={`w-full max-w-3xl mx-auto space-y-6 ${className}`}>
      {/* Mode Switch Tabs */}
      <div className="flex items-center gap-2 border-b border-border-subtle pb-2">
        <button
          type="button"
          onClick={() => {
            setMode('paste');
            setError(null);
            setStatusNotice(null);
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
            setError(null);
            setStatusNotice(null);
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

          {/* Honest Status Notice */}
          {statusNotice && (
            <Notice title="Verification Ready" className="text-xs">
              {statusNotice}
            </Notice>
          )}

          {/* Form Actions */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
            <Button type="submit" variant="primary" size="md">
              Verify answer
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

          {statusNotice && (
            <Notice title="Question Received" className="text-xs">
              {statusNotice}
            </Notice>
          )}

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
            <Button type="submit" variant="primary" size="md">
              Submit question
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
