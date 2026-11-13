'use client';

import React, { useState, useTransition, useCallback } from 'react';
import type { ClarificationQuestion, ClarificationOption } from '@/lib/contracts/clarification';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { submitClarificationAction } from '@/actions/run-actions';

export interface ClarificationFormProps {
  clarificationId: string;
  questions: ClarificationQuestion[];
  onSuccess: () => void;
}

/**
 * Dynamic clarification form rendering approved primitive field types.
 * Supports 5 field types: select, short_text, date, number, boolean.
 * Provides "Submit" and "I don't know" actions per ADR-015.
 */
export function ClarificationForm({
  clarificationId,
  questions,
  onSuccess,
}: ClarificationFormProps) {
  const [answers, setAnswers] = useState<Record<string, string | number | boolean | null>>(() => {
    const initial: Record<string, string | number | boolean | null> = {};
    for (const q of questions) {
      initial[q.questionId] = null;
    }
    return initial;
  });
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const updateAnswer = useCallback(
    (questionId: string, value: string | number | boolean | null) => {
      setAnswers((prev) => ({ ...prev, [questionId]: value }));
    },
    []
  );

  const submit = useCallback(
    (skipAll: boolean) => {
      setErrorMsg(null);
      startTransition(async () => {
        try {
          const payload: Record<string, string | number | boolean | null> = {};
          if (skipAll) {
            for (const q of questions) {
              payload[q.questionId] = null;
            }
          } else {
            for (const q of questions) {
              payload[q.questionId] = answers[q.questionId] ?? null;
            }
          }

          const result = await submitClarificationAction({
            clarificationId,
            answer: payload,
          });

          if (result.success) {
            onSuccess();
          } else {
            setErrorMsg(result.error || 'Failed to submit clarification answers.');
          }
        } catch {
          setErrorMsg('An unexpected error occurred while submitting.');
        }
      });
    },
    [answers, clarificationId, onSuccess, questions]
  );

  return (
    <div className="bg-surface-raised border border-border-subtle rounded-xl p-5 space-y-5">
      {/* Header with animated pulse indicator */}
      <div className="flex items-center gap-3">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-status-outdated-text opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-status-outdated-text" />
        </span>
        <h4 className="text-xs font-mono font-semibold uppercase tracking-wider text-text-secondary">
          Awaiting Your Input
        </h4>
      </div>

      {/* Dynamic question fields */}
      <div className="space-y-4">
        {questions.map((question) => (
          <ClarificationField
            key={question.questionId}
            question={question}
            value={answers[question.questionId] ?? null}
            onChange={(val) => updateAnswer(question.questionId, val)}
          />
        ))}
      </div>

      {/* Error banner */}
      {errorMsg && (
        <p role="alert" className="text-xs font-medium text-status-contradicted-text">
          {errorMsg}
        </p>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap items-center gap-3 pt-1">
        <Button
          variant="primary"
          size="sm"
          loading={isPending}
          onClick={() => submit(false)}
        >
          Submit
        </Button>
        <Button
          variant="quiet"
          size="sm"
          disabled={isPending}
          onClick={() => submit(true)}
        >
          I don&apos;t know
        </Button>
      </div>
    </div>
  );
}

/* ─── Individual Field Renderer ─────────────────────────────────────── */

interface ClarificationFieldProps {
  question: ClarificationQuestion;
  value: string | number | boolean | null;
  onChange: (val: string | number | boolean | null) => void;
}

function ClarificationField({ question, value, onChange }: ClarificationFieldProps) {
  const { questionId, prompt, reason, fieldType, options, constraints } = question;

  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium text-text-primary">{prompt}</p>
      <p className="text-xs text-text-muted">{reason}</p>

      {fieldType === 'select' && (
        <Select
          id={`clarification-${questionId}`}
          options={[
            { value: '', label: 'Select…' },
            ...((options as ClarificationOption[]) || []).map((opt) => ({
              value: opt.value,
              label: opt.label,
            })),
          ]}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => {
            const v = e.target.value;
            onChange(v === '' ? null : v);
          }}
        />
      )}

      {fieldType === 'short_text' && (
        <Input
          id={`clarification-${questionId}`}
          type="text"
          maxLength={constraints?.maxLength ?? 60}
          placeholder="Type your answer…"
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => {
            const v = e.target.value;
            onChange(v === '' ? null : v);
          }}
        />
      )}

      {fieldType === 'date' && (
        <Input
          id={`clarification-${questionId}`}
          type="date"
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => {
            const v = e.target.value;
            onChange(v === '' ? null : v);
          }}
        />
      )}

      {fieldType === 'number' && (
        <Input
          id={`clarification-${questionId}`}
          type="number"
          min={constraints?.min}
          max={constraints?.max}
          placeholder={
            constraints?.unit ? `Enter value (${constraints.unit})` : 'Enter a number…'
          }
          value={typeof value === 'number' ? String(value) : ''}
          onChange={(e) => {
            const v = e.target.value;
            onChange(v === '' ? null : Number(v));
          }}
        />
      )}

      {fieldType === 'boolean' && (
        <Select
          id={`clarification-${questionId}`}
          options={[
            { value: '', label: 'Select…' },
            { value: 'true', label: 'Yes' },
            { value: 'false', label: 'No' },
          ]}
          value={typeof value === 'boolean' ? String(value) : ''}
          onChange={(e) => {
            const v = e.target.value;
            if (v === 'true') onChange(true);
            else if (v === 'false') onChange(false);
            else onChange(null);
          }}
        />
      )}
    </div>
  );
}
