'use client';

import React, { useTransition, useState } from 'react';
import type { ClarificationQuestion } from '@/lib/contracts/clarification';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { submitClarificationAction } from '@/actions/run-actions';

export interface ClarificationFormProps {
  clarificationId: string;
  questions: ClarificationQuestion[];
  onSuccess: () => void;
}

type AnswerMap = Record<string, string | number | boolean | null>;

export function ClarificationForm({ clarificationId, questions, onSuccess }: ClarificationFormProps) {
  const [isPending, startTransition] = useTransition();
  const [answers, setAnswers] = useState<AnswerMap>(() =>
    Object.fromEntries(questions.map((q) => [q.questionId, '']))
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const setValue = (questionId: string, value: string | number | boolean | null) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const submit = (asUnknown = false) => {
    setErrorMsg(null);
    const payload = asUnknown
      ? Object.fromEntries(questions.map((q) => [q.questionId, null]))
      : answers;

    startTransition(async () => {
      const result = await submitClarificationAction({ clarificationId, answer: payload });
      if (result.success) {
        onSuccess();
      } else {
        setErrorMsg(result.error);
      }
    });
  };

  return (
    <div
      className="rounded-xl border border-border-subtle bg-surface-raised p-4 space-y-4"
      role="form"
      aria-label="Clarification form"
    >
      <div className="flex items-center gap-2 pb-1 border-b border-border-subtle">
        <span className="h-2 w-2 rounded-full bg-status-outdated-text animate-pulse" aria-hidden="true" />
        <h4 className="text-xs font-mono font-medium text-text-secondary uppercase tracking-wider">
          Awaiting Your Input
        </h4>
      </div>

      <div className="space-y-5">
        {questions.map((q) => (
          <div key={q.questionId} className="space-y-1.5">
            <p className="text-sm font-medium text-text-primary">{q.prompt}</p>
            {q.reason && (
              <p className="text-xs text-text-muted leading-relaxed">{q.reason}</p>
            )}

            {q.fieldType === 'select' && q.options && (
              <Select
                options={q.options.map((o) => ({ value: o.value, label: o.label }))}
                value={String(answers[q.questionId] ?? '')}
                onChange={(e) => setValue(q.questionId, e.target.value)}
                disabled={isPending}
                required={q.required}
                aria-label={q.prompt}
              />
            )}

            {q.fieldType === 'short_text' && (
              <Input
                type="text"
                value={String(answers[q.questionId] ?? '')}
                onChange={(e) => setValue(q.questionId, e.target.value)}
                maxLength={q.constraints?.maxLength ?? 60}
                disabled={isPending}
                required={q.required}
                placeholder="Enter your answer…"
                aria-label={q.prompt}
              />
            )}

            {q.fieldType === 'date' && (
              <Input
                type="date"
                value={String(answers[q.questionId] ?? '')}
                onChange={(e) => setValue(q.questionId, e.target.value)}
                disabled={isPending}
                required={q.required}
                aria-label={q.prompt}
              />
            )}

            {q.fieldType === 'number' && (
              <Input
                type="number"
                value={answers[q.questionId] === '' || answers[q.questionId] === null ? '' : String(answers[q.questionId])}
                onChange={(e) =>
                  setValue(q.questionId, e.target.value === '' ? '' : Number(e.target.value))
                }
                min={q.constraints?.min}
                max={q.constraints?.max}
                disabled={isPending}
                required={q.required}
                aria-label={q.prompt}
              />
            )}

            {q.fieldType === 'boolean' && (
              <Select
                options={[
                  { value: '', label: 'Select…' },
                  { value: 'true', label: 'Yes' },
                  { value: 'false', label: 'No' },
                ]}
                value={answers[q.questionId] === true ? 'true' : answers[q.questionId] === false ? 'false' : ''}
                onChange={(e) =>
                  setValue(
                    q.questionId,
                    e.target.value === 'true' ? true : e.target.value === 'false' ? false : ''
                  )
                }
                disabled={isPending}
                required={q.required}
                aria-label={q.prompt}
              />
            )}
          </div>
        ))}
      </div>

      {errorMsg && (
        <p role="alert" className="text-xs font-medium text-status-contradicted-text">
          {errorMsg}
        </p>
      )}

      <div className="flex items-center gap-2 pt-1">
        <Button
          variant="primary"
          size="sm"
          loading={isPending}
          disabled={isPending}
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
