'use client';

import React, { useState } from 'react';
import type { EvidenceItem } from '@/lib/contracts/evidence';

export interface EvidenceCardProps {
  evidence: EvidenceItem;
  className?: string;
}

function formatDateString(rawDate?: string | null): string | null {
  if (!rawDate) return null;
  // If it's a full timestamp YYYY-MM-DDTHH:mm:ssZ, extract date or format cleanly
  if (rawDate.includes('T')) {
    return rawDate.split('T')[0];
  }
  return rawDate;
}

export function EvidenceCard({ evidence, className = '' }: EvidenceCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isLongPassage = evidence.passage.length > 240;

  const publishedDate = formatDateString(evidence.publicationDate);
  const effectiveDate = formatDateString(evidence.effectiveDate);
  const retrievedDate = formatDateString(evidence.retrievedAt);
  const announcedDate = formatDateString(evidence.announcementDate);

  let hostname = '';
  try {
    hostname = new URL(evidence.url).hostname;
  } catch {
    hostname = evidence.url;
  }

  return (
    <article
      id={`evidence-${evidence.id}`}
      className={`rounded-lg border border-border-subtle/80 bg-surface-raised/40 p-4 space-y-3.5 transition-colors hover:border-border-strong/60 ${className}`}
      aria-label={`Evidence: ${evidence.title || hostname}`}
    >
      {/* Evidence Source Header */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-0.5 min-w-0 flex-1">
          <h4 className="text-xs sm:text-sm font-medium text-text-primary truncate">
            {evidence.title || hostname}
          </h4>
          <p className="text-[11px] text-text-muted truncate font-mono">
            {evidence.publisher ? `${evidence.publisher} · ` : ''}
            <span>{hostname}</span>
          </p>
        </div>

        {evidence.sourceType && (
          <span className="inline-block rounded-xs bg-surface-raised px-1.5 py-0.5 text-[10px] font-mono text-text-secondary uppercase tracking-wider border border-border-subtle/60">
            {evidence.sourceType.replace(/_/g, ' ')}
          </span>
        )}
      </div>

      {/* Quoted Passage in Editorial Blockquote */}
      <blockquote className="border-l-2 border-border-strong pl-3.5 py-0.5 text-xs text-text-secondary leading-relaxed font-sans italic">
        <p className={!isExpanded && isLongPassage ? 'line-clamp-3' : ''}>
          “{evidence.passage}”
        </p>
        {isLongPassage && (
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="mt-1 text-[11px] font-mono text-accent hover:underline focus-visible:outline-none cursor-pointer"
          >
            {isExpanded ? 'Show less' : 'Read full passage'}
          </button>
        )}
      </blockquote>

      {/* Distinct Dates & External Link */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border-subtle/60 text-[11px] font-mono text-text-muted">
        <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1">
          {publishedDate && (
            <span>
              <span className="text-text-muted/70">Published:</span> {publishedDate}
            </span>
          )}
          {effectiveDate && (
            <span>
              <span className="text-text-muted/70">Effective:</span> {effectiveDate}
            </span>
          )}
          {announcedDate && (
            <span>
              <span className="text-text-muted/70">Announced:</span> {announcedDate}
            </span>
          )}
          {retrievedDate && (
            <span>
              <span className="text-text-muted/70">Retrieved:</span> {retrievedDate}
            </span>
          )}
        </div>

        <a
          href={evidence.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-mono text-[11px] text-text-muted hover:text-text-primary hover:underline transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus-ring rounded shrink-0"
        >
          <span>Verify source</span>
          <span aria-hidden="true">↗</span>
        </a>
      </div>
    </article>
  );
}
