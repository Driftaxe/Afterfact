'use client';

import React from 'react';
import type { TimelineEntry, TimelineState } from '@/lib/contracts/report';
import type { EvidenceItem } from '@/lib/contracts/evidence';
import { ScheduledChangeBadge } from './ScheduledChangeBadge';

export interface ChangeTimelineProps {
  /**
   * Chronological timeline entries from report contracts.
   */
  timeline?: TimelineEntry[] | null;
  /**
   * Optional transition payload fallback if passed from alternative caller.
   */
  transition?: unknown;
  /**
   * Evidence lookup map to resolve evidence passages, publishers, and publication dates.
   */
  evidenceMap?: Map<string, EvidenceItem>;
  /**
   * Target evaluation date to contextualize upcoming vs. active state.
   */
  targetDate?: string | null;
  /**
   * Optional custom section heading. Defaults to 'Then vs. Now Chronology'.
   */
  title?: string;
  className?: string;
}

interface StateVisualConfig {
  phaseLabel: string;
  stateBadge: string;
  markerBorder: string;
  markerBg: string;
  cardBorder: string;
  cardBg: string;
  icon: React.ReactNode;
}

const STATE_CONFIGS: Record<TimelineState, StateVisualConfig> = {
  historical: {
    phaseLabel: 'Then (Prior State)',
    stateBadge: 'bg-surface-raised text-text-muted border-border-subtle',
    markerBorder: 'border-border-strong',
    markerBg: 'bg-surface-raised',
    cardBorder: 'border-border-subtle',
    cardBg: 'bg-surface-raised/40',
    icon: (
      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  transition: {
    phaseLabel: 'Transition Event',
    stateBadge: 'bg-accent/10 text-accent border-accent/40',
    markerBorder: 'border-accent',
    markerBg: 'bg-accent/20',
    cardBorder: 'border-accent/30',
    cardBg: 'bg-accent/5',
    icon: (
      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
      </svg>
    ),
  },
  current: {
    phaseLabel: 'Now (Active Truth)',
    stateBadge: 'bg-status-supported-bg text-status-supported-text border-status-supported-border',
    markerBorder: 'border-status-supported-border',
    markerBg: 'bg-status-supported-bg',
    cardBorder: 'border-status-supported-border/70',
    cardBg: 'bg-status-supported-bg/20',
    icon: (
      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
      </svg>
    ),
  },
  upcoming: {
    phaseLabel: 'Upcoming (Scheduled Change)',
    stateBadge: 'bg-status-outdated-bg text-status-outdated-text border-status-outdated-border',
    markerBorder: 'border-accent border-dashed',
    markerBg: 'bg-surface-raised',
    cardBorder: 'border-dashed border-accent/40',
    cardBg: 'bg-surface-raised/60',
    icon: (
      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
};

function formatDate(raw?: string | null): string | null {
  if (!raw) return null;
  if (raw.includes('T')) return raw.split('T')[0];
  return raw;
}

/**
 * ChangeTimeline
 * Renders chronological Then vs. Now progression cards for claims with historical transitions.
 * Enforces strict Three-Date Separation:
 *  - Publication Date: When evidence was authored/published.
 *  - Announcement Date: When the change was made public.
 *  - Effective Date: When the change legally/operationally took effect.
 */
export function ChangeTimeline({
  timeline,
  transition,
  evidenceMap,
  title = 'Then vs. Now Chronology',
  className = '',
}: ChangeTimelineProps) {
  // Normalize entries from either timeline prop or transition structure
  let entries: TimelineEntry[] = [];
  if (Array.isArray(timeline) && timeline.length > 0) {
    entries = timeline;
  } else if (Array.isArray(transition) && transition.length > 0) {
    // Attempt safe shape mapping if transition array provided
    entries = transition.filter(
      (item): item is TimelineEntry =>
        typeof item === 'object' &&
        item !== null &&
        'state' in item &&
        'summary' in item
    );
  }

  // Honest fallback message when historical transitions are unverified or absent
  if (entries.length === 0) {
    return (
      <div className={`space-y-2 ${className}`} role="region" aria-label={title}>
        <h4 className="text-xs font-medium text-text-secondary uppercase tracking-wider font-mono">
          {title}
        </h4>
        <div className="rounded-xl border border-dashed border-border-subtle bg-surface-raised/30 p-4 text-xs text-text-muted">
          Historical transitions unverified. No structured chronological progression records attached to this claim.
        </div>
      </div>
    );
  }

  // Check if timeline contains a future-effective upcoming change
  const hasUpcoming = entries.some((e) => e.state === 'upcoming');

  return (
    <div className={`space-y-3 ${className}`} role="region" aria-label={title}>
      {/* Header with Title and Optional Scheduled Change Badge */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h4 className="text-xs font-medium text-text-secondary uppercase tracking-wider font-mono">
            {title}
          </h4>
          <span className="text-[11px] font-mono text-text-muted">
            ({entries.length} {entries.length === 1 ? 'event' : 'events'})
          </span>
        </div>

        {hasUpcoming && (
          <ScheduledChangeBadge size="sm" showDate={false} />
        )}
      </div>

      {/* Vertical Chronology Line */}
      <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-border-subtle">
        {entries.map((entry, idx) => {
          const config = STATE_CONFIGS[entry.state] || STATE_CONFIGS.historical;
          const effective = formatDate(entry.effectiveDate);
          const announced = formatDate(entry.announcementDate);

          // Resolve linked evidence passage if available
          const linkedEvidence =
            entry.evidenceId && evidenceMap
              ? evidenceMap.get(entry.evidenceId)
              : null;
          const published = linkedEvidence
            ? formatDate(linkedEvidence.publicationDate)
            : null;

          return (
            <div
              key={`timeline-step-${idx}-${entry.state}`}
              className="relative group space-y-2"
              data-testid={`timeline-entry-${entry.state}`}
            >
              {/* Chronological Step Marker */}
              <div
                className={`absolute -left-[27px] top-1.5 flex h-5 w-5 items-center justify-center rounded-full border-2 ${config.markerBorder} ${config.markerBg} text-text-primary shadow-sm`}
                aria-hidden="true"
              >
                {config.icon}
              </div>

              {/* Entry Card */}
              <div
                className={`rounded-xl border ${config.cardBorder} ${config.cardBg} p-3.5 space-y-2 transition-all`}
              >
                {/* Header: Phase Label, State Badge, and Distinct Dates */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-text-primary">
                      {config.phaseLabel}
                    </span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider border ${config.stateBadge}`}
                    >
                      {entry.state}
                    </span>
                  </div>

                  {/* Strict Three-Date Separation: Distinctly labeled dates */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-mono text-text-muted">
                    {effective && (
                      <span className="text-text-secondary font-medium">
                        Effective: <span className="font-mono text-text-primary">{effective}</span>
                      </span>
                    )}
                    {announced && (
                      <span>
                        Announced: <span className="font-mono">{announced}</span>
                      </span>
                    )}
                    {published && (
                      <span>
                        Published: <span className="font-mono">{published}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Grounded Event Summary */}
                <p className="text-xs sm:text-sm text-text-secondary leading-relaxed font-sans">
                  {entry.summary}
                </p>

                {/* Supporting Evidence Passage Link */}
                {linkedEvidence && (
                  <div className="pt-2 border-t border-border-subtle/60 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                    <div className="flex items-center gap-1.5 text-text-muted truncate max-w-[280px] sm:max-w-md">
                      <svg className="h-3.5 w-3.5 shrink-0 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span className="truncate">
                        {linkedEvidence.title || linkedEvidence.publisher || 'Supporting Passage'}
                      </span>
                    </div>

                    <a
                      href={`#evidence-${entry.evidenceId}`}
                      className="inline-flex items-center gap-1 font-mono font-medium text-accent hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus-ring rounded"
                      aria-label={`Jump to evidence ${entry.evidenceId}`}
                    >
                      <span>Inspect Evidence</span>
                      <span aria-hidden="true">&darr;</span>
                    </a>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
