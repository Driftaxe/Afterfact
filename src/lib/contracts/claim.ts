import { z } from 'zod';

/**
 * Level of temporal drift vulnerability for an atomic claim.
 */
export const TimeSensitivitySchema = z.enum(['high', 'medium', 'low']);
export type TimeSensitivity = z.infer<typeof TimeSensitivitySchema>;

/**
 * Character span offsets into unmodified source text.
 * Indices are non-negative, non-fractional UTF-16 code unit offsets with an exclusive end.
 * Empty spans (start === end) are explicitly prohibited.
 */
export const ClaimSpanSchema = z
  .object({
    start: z.number().int({ message: 'Span start must be an integer' }).nonnegative({ message: 'Span start must be non-negative' }),
    end: z.number().int({ message: 'Span end must be an integer' }).nonnegative({ message: 'Span end must be non-negative' }),
  })
  .refine((span) => span.start < span.end, {
    message: 'Span must be non-empty with start strictly less than end',
  });

export type ClaimSpan = z.infer<typeof ClaimSpanSchema>;

/**
 * Explicit qualifiers stated directly in the claim text.
 * Stored separately from the user-requested target context to prevent silent overwriting.
 */
export const SourceScopeSchema = z.record(z.string(), z.string().nullable().optional());
export type SourceScope = z.infer<typeof SourceScopeSchema>;

/**
 * Atomic claim specification extracted from source text.
 */
export const AtomicClaimSpecSchema = z.object({
  id: z.string().min(1, { message: 'Claim ID is required' }),
  ordinal: z.number().int().nonnegative().optional(),
  rawText: z.string().min(1, { message: 'Raw claim text is required' }),
  entity: z.string().min(1, { message: 'Normalized entity is required' }),
  attribute: z.string().min(1, { message: 'Normalized attribute is required' }),
  assertedValue: z.string().min(1, { message: 'Asserted value is required' }),
  timeSensitivity: TimeSensitivitySchema,
  sourceScope: SourceScopeSchema.optional().nullable(),
  span: ClaimSpanSchema.nullable().optional(),
});

export type AtomicClaimSpec = z.infer<typeof AtomicClaimSpecSchema>;

/**
 * Result of validating a claim span against unmodified answer text.
 */
export interface SpanValidationResult {
  valid: boolean;
  isHighlighted?: boolean;
  reason?: string;
}

/**
 * Validates that a claim's UTF-16 character offsets cleanly slice the unmodified answer text.
 * Returns valid with isHighlighted: false if span is explicitly null/undefined (representing unanchored claims).
 * Fails closed if span bounds exceed string length, span is empty/inverted, or the slice does not match rawText.
 * Diagnostic messages omit raw text fragments to prevent sensitive user text leakage in API errors.
 */
export function validateClaimSpan(
  answerText: string,
  span: ClaimSpan | null | undefined,
  expectedRawText: string
): SpanValidationResult {
  if (span === null || span === undefined) {
    return { valid: true, isHighlighted: false };
  }

  if (!Number.isInteger(span.start) || !Number.isInteger(span.end)) {
    return { valid: false, reason: 'Span offsets must be non-fractional integers' };
  }

  if (span.start < 0) {
    return { valid: false, reason: 'Span start cannot be negative' };
  }

  if (span.end > answerText.length) {
    return { valid: false, reason: 'Span end exceeds text length' };
  }

  if (span.start >= span.end) {
    return { valid: false, reason: 'Span must be non-empty with start strictly less than end' };
  }

  const extracted = answerText.slice(span.start, span.end);
  if (extracted !== expectedRawText) {
    return {
      valid: false,
      reason: 'Extracted text slice does not match expected rawText at specified span offsets',
    };
  }

  return { valid: true, isHighlighted: true };
}
