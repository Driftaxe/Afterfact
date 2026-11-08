'use client';

import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Skeleton, Notice } from '@/components/ui/Feedback';

export function ReportLoadingSkeleton() {
  return (
    <div className="w-full max-w-7xl mx-auto space-y-8 animate-pulse p-4 sm:p-6" role="region" aria-label="Loading verification report">
      {/* Header Skeleton */}
      <div className="space-y-3 border-b border-border-subtle pb-6">
        <Skeleton className="h-6 w-48 rounded-md" />
        <Skeleton className="h-4 w-96 rounded-md" />
      </div>

      {/* Summary Bar Skeleton */}
      <div className="flex gap-2">
        <Skeleton className="h-9 w-24 rounded-lg" />
        <Skeleton className="h-9 w-24 rounded-lg" />
        <Skeleton className="h-9 w-24 rounded-lg" />
        <Skeleton className="h-9 w-24 rounded-lg" />
      </div>

      {/* 55:45 Grid Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 space-y-4">
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
        <div className="lg:col-span-5 space-y-4">
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

export interface ReportEmptyClaimsStateProps {
  answerText?: string | null;
  onBack?: () => void;
}

export function ReportEmptyClaimsState({ answerText, onBack }: ReportEmptyClaimsStateProps) {
  return (
    <div className="w-full max-w-3xl mx-auto p-6 sm:p-10 text-center space-y-6">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-surface-raised border border-border-subtle text-text-muted">
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>

      <div className="space-y-2">
        <h2 className="text-xl font-medium text-text-primary">
          No Time-Sensitive Claims Identified
        </h2>
        <p className="text-sm text-text-secondary max-w-md mx-auto leading-relaxed">
          No verifiable temporal claims (e.g. pricing, versions, leadership, or regulations) were
          extracted from this answer.
        </p>
        <p className="text-xs text-text-muted max-w-sm mx-auto">
          Note: An empty claim set means no temporal assertions were detected; it does not certify that the text is entirely true.
        </p>
      </div>

      {answerText && (
        <div className="text-left rounded-xl border border-border-subtle bg-surface p-4 text-xs font-mono text-text-secondary max-h-40 overflow-y-auto">
          {answerText}
        </div>
      )}

      <div className="flex justify-center gap-3 pt-2">
        {onBack ? (
          <Button onClick={onBack} variant="primary">
            Return to Composer
          </Button>
        ) : (
          <Link
            href="/"
            className="inline-flex items-center justify-center h-10 px-5 rounded-[9px] bg-btn-primary text-btn-primary-text text-sm font-medium hover:bg-btn-primary-hover transition-colors"
          >
            Return to Composer
          </Link>
        )}
      </div>
    </div>
  );
}

export interface ReportErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export function ReportErrorState({
  title = 'Report Unavailable',
  message = 'The requested verification report could not be loaded or parsed.',
  onRetry,
}: ReportErrorStateProps) {
  return (
    <div className="w-full max-w-xl mx-auto p-6 sm:p-10 text-center space-y-6">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-status-contradicted-bg border border-status-contradicted-border text-status-contradicted-text">
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>

      <div className="space-y-2">
        <h2 className="text-xl font-medium text-text-primary">{title}</h2>
        <p className="text-sm text-text-secondary leading-relaxed">{message}</p>
      </div>

      <div className="flex items-center justify-center gap-3 pt-2">
        <Link
          href="/"
          className="inline-flex items-center justify-center h-10 px-4 rounded-[9px] border border-border-subtle bg-surface text-text-secondary hover:text-text-primary text-sm font-medium transition-colors"
        >
          Return to Input
        </Link>
        {onRetry ? (
          <Button onClick={onRetry} variant="primary">
            Retry Load
          </Button>
        ) : (
          <Link
            href="/report/demo?mode=fixture"
            className="inline-flex items-center justify-center h-10 px-4 rounded-[9px] bg-btn-primary text-btn-primary-text text-sm font-medium hover:bg-btn-primary-hover transition-colors"
          >
            Load Sample Report
          </Link>
        )}
      </div>
    </div>
  );
}

export function ReportPartialBanner({ completedCount, totalCount }: { completedCount: number; totalCount: number }) {
  return (
    <Notice title="Partial Verification" className="text-xs">
      This report is in partial progress ({completedCount} of {totalCount} claims assessed).
      Pending claims are actively evaluating and do not have fabricated verdicts.
    </Notice>
  );
}
