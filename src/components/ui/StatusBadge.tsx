'use client';

import React from 'react';

export type VerificationStatus =
  | 'supported'
  | 'outdated'
  | 'contradicted'
  | 'unresolved'
  | 'checking'
  | 'awaiting_clarification';

export interface StatusBadgeProps {
  status: VerificationStatus | string;
  label?: string;
  size?: 'sm' | 'md';
  className?: string;
}

interface StatusConfig {
  defaultLabel: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  icon: React.ReactNode;
}

const STATUS_CONFIGS: Record<VerificationStatus, StatusConfig> = {
  supported: {
    defaultLabel: 'Supported',
    bgClass: 'bg-status-supported-bg',
    textClass: 'text-status-supported-text',
    borderClass: 'border-status-supported-border',
    icon: (
      <svg
        className="h-3 w-3 shrink-0"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
          clipRule="evenodd"
        />
      </svg>
    ),
  },
  outdated: {
    defaultLabel: 'Outdated',
    bgClass: 'bg-status-outdated-bg',
    textClass: 'text-status-outdated-text',
    borderClass: 'border-status-outdated-border',
    icon: (
      <svg
        className="h-3 w-3 shrink-0"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
          clipRule="evenodd"
        />
      </svg>
    ),
  },
  contradicted: {
    defaultLabel: 'Contradicted',
    bgClass: 'bg-status-contradicted-bg',
    textClass: 'text-status-contradicted-text',
    borderClass: 'border-status-contradicted-border',
    icon: (
      <svg
        className="h-3 w-3 shrink-0"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
          clipRule="evenodd"
        />
      </svg>
    ),
  },
  unresolved: {
    defaultLabel: 'Unresolved',
    bgClass: 'bg-status-unresolved-bg',
    textClass: 'text-status-unresolved-text',
    borderClass: 'border-status-unresolved-border',
    icon: (
      <svg
        className="h-3 w-3 shrink-0"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z"
          clipRule="evenodd"
        />
      </svg>
    ),
  },
  checking: {
    defaultLabel: 'Checking',
    bgClass: 'bg-status-checking-bg',
    textClass: 'text-status-checking-text',
    borderClass: 'border-status-checking-border',
    icon: (
      <svg
        className="h-3 w-3 shrink-0 animate-spin"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
    ),
  },
  awaiting_clarification: {
    defaultLabel: 'Awaiting Clarification',
    bgClass: 'bg-status-checking-bg',
    textClass: 'text-status-checking-text',
    borderClass: 'border-status-checking-border',
    icon: (
      <svg
        className="h-3 w-3 shrink-0"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
      </svg>
    ),
  },
};

export function StatusBadge({
  status,
  label,
  size = 'md',
  className = '',
}: StatusBadgeProps) {
  const normalizedKey = status.toLowerCase().replace(/\s+/g, '_') as VerificationStatus;
  const config = STATUS_CONFIGS[normalizedKey] || STATUS_CONFIGS.unresolved;

  const displayLabel = label || config.defaultLabel;

  const sizeClasses =
    size === 'sm'
      ? 'px-2 py-0.5 text-xs gap-1'
      : 'px-2.5 py-1 text-xs font-medium gap-1.5';

  return (
    <span
      className={`inline-flex items-center rounded-full border ${config.bgClass} ${config.textClass} ${config.borderClass} ${sizeClasses} select-none ${className}`}
    >
      {config.icon}
      <span>{displayLabel}</span>
    </span>
  );
}
