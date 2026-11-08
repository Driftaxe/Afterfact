import { validateClaimSpan } from '@/lib/contracts/claim';
import type { ClaimResultItem } from '@/lib/contracts/report';

export interface AnswerSegment {
  text: string;
  claimId: string | null;
  start: number;
  end: number;
  verdict?: string;
}

export interface SegmentAnswerOptions {
  answerText: string;
  claims: ClaimResultItem[];
}

export interface SegmentAnswerResult {
  segments: AnswerSegment[];
  hasMalformedSpans: boolean;
  malformedClaimIds: string[];
}

/**
 * Deterministically segments answer text into contiguous slices based on claim spans.
 * Guarantees that concatenating all segment texts exactly equals the original answer text.
 * Properly handles UTF-16 code units (emojis), non-overlapping gaps, and overlapping intervals.
 */
export function segmentAnswerText({
  answerText,
  claims,
}: SegmentAnswerOptions): SegmentAnswerResult {
  if (!answerText) {
    return {
      segments: [],
      hasMalformedSpans: false,
      malformedClaimIds: [],
    };
  }

  const malformedClaimIds: string[] = [];
  interface ValidSpan {
    id: string;
    start: number;
    end: number;
    verdict?: string;
  }
  const validSpans: ValidSpan[] = [];

  for (const claim of claims) {
    if (!claim.span) continue;

    const validation = validateClaimSpan(answerText, claim.span, claim.rawText);
    if (!validation.valid) {
      malformedClaimIds.push(claim.id);
      continue;
    }

    validSpans.push({
      id: claim.id,
      start: claim.span.start,
      end: claim.span.end,
      verdict: claim.state === 'assessed' ? claim.verdict : undefined,
    });
  }

  if (validSpans.length === 0) {
    return {
      segments: [
        {
          text: answerText,
          claimId: null,
          start: 0,
          end: answerText.length,
        },
      ],
      hasMalformedSpans: malformedClaimIds.length > 0,
      malformedClaimIds,
    };
  }

  // Collect and sort all unique boundary offsets
  const boundarySet = new Set<number>([0, answerText.length]);
  for (const span of validSpans) {
    boundarySet.add(span.start);
    boundarySet.add(span.end);
  }

  const boundaries = Array.from(boundarySet).sort((a, b) => a - b);
  const segments: AnswerSegment[] = [];

  for (let i = 0; i < boundaries.length - 1; i++) {
    const start = boundaries[i];
    const end = boundaries[i + 1];
    if (start >= end) continue;

    const slice = answerText.slice(start, end);

    // Find any span that covers this entire sub-interval [start, end]
    const covering = validSpans.filter((s) => s.start <= start && s.end >= end);

    if (covering.length > 0) {
      const primary = covering[0];
      segments.push({
        text: slice,
        claimId: primary.id,
        start,
        end,
        verdict: primary.verdict,
      });
    } else {
      segments.push({
        text: slice,
        claimId: null,
        start,
        end,
      });
    }
  }

  return {
    segments,
    hasMalformedSpans: malformedClaimIds.length > 0,
    malformedClaimIds,
  };
}
