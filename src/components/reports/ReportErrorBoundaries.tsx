'use client';

import React, { Component, type ErrorInfo, type ReactNode } from 'react';

// ============================================================================
// Specialized Fallback 1: Retrieval Timeout Fallback UI
// ============================================================================

export interface RetrievalTimeoutFallbackProps {
  runId?: string;
  claimText?: string;
  onRetry?: () => void;
  onViewCached?: () => void;
  className?: string;
}

export function RetrievalTimeoutFallback({
  runId,
  claimText,
  onRetry,
  onViewCached,
  className = '',
}: RetrievalTimeoutFallbackProps) {
  return (
    <div
      className={`rounded-2xl border border-status-outdated-border bg-status-outdated-bg/20 p-6 sm:p-8 space-y-5 text-center max-w-xl mx-auto ${className}`}
      role="alert"
      aria-live="polite"
    >
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-status-outdated-bg border border-status-outdated-border text-status-outdated-text">
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>

      <div className="space-y-1.5">
        <h3 className="text-base font-semibold text-text-primary">
          Evidence Retrieval Timed Out
        </h3>
        <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
          The Tavily search pass for this claim exceeded the serverless processing threshold.
          Prior verified claims and timeline transitions remain safe and uncorrupted.
        </p>
        {claimText && (
          <p className="text-xs font-mono text-text-muted bg-surface p-2 rounded-lg border border-border-subtle truncate mt-2">
            “{claimText}”
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-accent text-white text-xs font-medium hover:opacity-95 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Retry Retrieval
          </button>
        )}

        {onViewCached && (
          <button
            type="button"
            onClick={onViewCached}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg border border-border-subtle bg-surface text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-surface-raised transition-colors"
          >
            View Partial Report
          </button>
        )}

        {runId && (
          <span className="block w-full text-[11px] font-mono text-text-muted pt-1">
            Run ID: {runId}
          </span>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Specialized Fallback 2: DAG Fetch & Stream Failure UI
// ============================================================================

export interface DagFetchErrorFallbackProps {
  errorMessage?: string;
  onReconnect?: () => void;
  className?: string;
}

export function DagFetchErrorFallback({
  errorMessage,
  onReconnect,
  className = '',
}: DagFetchErrorFallbackProps) {
  return (
    <div
      className={`rounded-2xl border border-border-subtle bg-surface p-6 space-y-4 text-center max-w-lg mx-auto ${className}`}
      role="alert"
    >
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-status-contradicted-bg border border-status-contradicted-border text-status-contradicted-text">
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>

      <div className="space-y-1">
        <h4 className="text-sm font-semibold text-text-primary">
          Execution Graph Unavailable
        </h4>
        <p className="text-xs text-text-secondary">
          Unable to synchronize dynamic verification DAG nodes or event stream.
        </p>
        {errorMessage && (
          <p className="text-xs font-mono text-status-contradicted-text bg-status-contradicted-bg/20 p-2 rounded-lg border border-status-contradicted-border mt-2 break-all">
            {errorMessage}
          </p>
        )}
      </div>

      {onReconnect && (
        <button
          type="button"
          onClick={onReconnect}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border-subtle bg-surface-raised text-xs font-mono text-text-secondary hover:text-text-primary transition-colors"
        >
          <span>↻ Reconnect Event Stream</span>
        </button>
      )}
    </div>
  );
}

// ============================================================================
// React Error Boundary Component
// ============================================================================

export interface ReportErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ReportErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ReportErrorBoundary extends Component<
  ReportErrorBoundaryProps,
  ReportErrorBoundaryState
> {
  constructor(props: ReportErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ReportErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const isTimeout =
        this.state.error?.message?.toLowerCase().includes('timeout') ||
        this.state.error?.message?.toLowerCase().includes('timed out');

      if (isTimeout) {
        return <RetrievalTimeoutFallback onRetry={this.handleReset} />;
      }

      return (
        <div
          className="rounded-2xl border border-status-contradicted-border/70 bg-surface p-6 sm:p-8 space-y-4 text-center max-w-lg mx-auto"
          role="alert"
        >
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-status-contradicted-bg text-status-contradicted-text border border-status-contradicted-border">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>

          <div className="space-y-1.5">
            <h3 className="text-base font-semibold text-text-primary">
              Report View Encountered An Error
            </h3>
            <p className="text-xs text-text-secondary">
              A rendering error occurred while loading this report section.
            </p>
            {this.state.error?.message && (
              <p className="text-xs font-mono text-status-contradicted-text bg-status-contradicted-bg/20 p-2 rounded border border-status-contradicted-border break-all">
                {this.state.error.message}
              </p>
            )}
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={this.handleReset}
              className="inline-flex items-center justify-center h-9 px-4 rounded-lg bg-surface-raised border border-border-subtle text-xs font-medium text-text-primary hover:bg-surface hover:border-border-strong transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
