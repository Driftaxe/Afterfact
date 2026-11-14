'use client';

import React from 'react';

export interface ScheduledChangeBadgeProps {
  /**
   * The effective date when the announced change will take effect (YYYY-MM-DD or timestamp).
   */
  effectiveDate?: string | null;
  /**
   * The date when the upcoming change was officially announced.
   */
  announcementDate?: string | null;
  /**
   * Custom badge label. Defaults to 'Scheduled change'.
   */
  label?: string;
  /**
   * Size variant: 'sm' (compact for lists) or 'md' (default for detail headers).
   */
  size?: 'sm' | 'md';
  /**
   * Whether to display the effective date string inline inside the badge.
   */
  showDate?: boolean;
  className?: string;
}

/**
 * ScheduledChangeBadge
 * Flags announced changes whose effective date is in the future ($T_{effective} > T_{target}$).
 * Rendered alongside the main verdict badge without causing visual clutter.
 * Enforces the invariant that future-effective changes do not mark current assertions stale or outdated.
 */
export function ScheduledChangeBadge({
  effectiveDate,
  announcementDate,
  label = 'Scheduled change',
  size = 'md',
  showDate = true,
  className = '',
}: ScheduledChangeBadgeProps) {
  const sizeClasses =
    size === 'sm'
      ? 'px-2 py-0.5 text-[10px] gap-1'
      : 'px-2.5 py-1 text-xs gap-1.5';

  const tooltip = effectiveDate
    ? `Scheduled change effective on ${effectiveDate}. Current status remains valid.`
    : announcementDate
      ? `Scheduled change announced on ${announcementDate}. Current status remains valid.`
      : 'Scheduled change announced with pending future effective date. Current status remains valid.';

  return (
    <span
      className={`inline-flex items-center rounded-full font-mono font-medium border bg-surface-raised border-accent/40 text-accent ${sizeClasses} ${className}`}
      title={tooltip}
      role="status"
      aria-label={`${label}${effectiveDate ? ` effective ${effectiveDate}` : ''}`}
    >
      {/* Calendar / Clock Icon */}
      <svg
        className="h-3 w-3 shrink-0 text-accent"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M5.75 2a.75.75 0 01.75.75V4h7V2.75a.75.75 0 011.5 0V4h.25A2.75 2.75 0 0118 6.75v8.5A2.75 2.75 0 0115.25 18H4.75A2.75 2.75 0 012 15.25v-8.5A2.75 2.75 0 014.75 4H5V2.75A.75.75 0 015.75 2zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75z"
          clipRule="evenodd"
        />
      </svg>

      <span className="truncate">{label}</span>

      {showDate && effectiveDate && (
        <span className="text-text-muted font-normal">
          {`(${effectiveDate})`}
        </span>
      )}
    </span>
  );
}
