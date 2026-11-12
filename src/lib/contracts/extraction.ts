import { z } from 'zod';
import { MAX_PASTE_LENGTH, SharedContextSchema } from './request';
import { ClaimTicketSchema, PropertyTypeSchema } from './claim-ticket';
import { TimeSensitivitySchema } from './claim';

/**
 * Permitted error codes for extraction failures.
 */
export const ExtractionErrorCodeSchema = z.enum([
  'INVALID_INPUT',
  'PROVIDER_ERROR',
  'TIMEOUT',
  'PROVIDER_REFUSAL',
  'MALFORMED_OUTPUT',
  'SCHEMA_VIOLATION',
  'GROUNDING_FAILURE',
]);
export type ExtractionErrorCode = z.infer<typeof ExtractionErrorCodeSchema>;

/**
 * Structured, sanitized extraction error.
 */
export const ExtractionErrorSchema = z.object({
  code: ExtractionErrorCodeSchema,
  message: z.string().min(1),
  retryable: z.boolean(),
});
export type ExtractionError = z.infer<typeof ExtractionErrorSchema>;

/**
 * Validated input boundary for claim extraction.
 */
export const ExtractClaimsInputSchema = z.object({
  text: z
    .string()
    .max(MAX_PASTE_LENGTH, {
      message: `Answer text exceeds maximum limit of ${MAX_PASTE_LENGTH} characters`,
    })
    .refine((val) => val.trim().length > 0, {
      message: 'Answer text cannot be empty or whitespace-only',
    }),
  runId: z.string().min(1, { message: 'Execution identity (runId/prepId) is required' }),
  revision: z.number().int().min(1, { message: 'Revision must be an integer >= 1' }).default(1),
  inputHash: z.string().optional(),
  targetTime: z.string().optional(),
  contextOverrides: SharedContextSchema.optional().default({}),
  model: z.string().optional(),
  enableFallback: z.boolean().optional().default(true),
});
export type ExtractClaimsInput = z.input<typeof ExtractClaimsInputSchema>;
export type ExtractClaimsParsedInput = z.output<typeof ExtractClaimsInputSchema>;

/**
 * Minimal location hint supplied by the model to disambiguate repeated excerpts.
 */
export const LocationHintSchema = z
  .object({
    occurrence: z.number().int().nonnegative().optional(),
    prefix: z.string().optional(),
    suffix: z.string().optional(),
    candidateSpan: z
      .object({
        start: z.number().int().nonnegative(),
        end: z.number().int().nonnegative(),
      })
      .optional(),
  })
  .optional();
export type LocationHint = z.infer<typeof LocationHintSchema>;

/**
 * Explicit qualifier proposed by the model with an exact verbatim substring anchor.
 */
export const RawExtractedQualifierSchema = z.object({
  key: z.string().min(1, { message: 'Qualifier key is required' }),
  label: z.string().min(1, { message: 'Qualifier label is required' }),
  value: z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.array(z.string()),
  ]),
  propertyType: PropertyTypeSchema,
  exactExcerpt: z.string().min(1, { message: 'exactExcerpt is required to ground explicit qualifier' }),
  units: z.string().nullable().optional(),
});
export type RawExtractedQualifier = z.infer<typeof RawExtractedQualifierSchema>;

/**
 * Inferred qualifier proposed by the model where context is unstated in source text.
 */
export const RawInferredQualifierSchema = z.object({
  key: z.string().min(1, { message: 'Qualifier key is required' }),
  label: z.string().min(1, { message: 'Qualifier label is required' }),
  value: z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.array(z.string()),
    z.null(),
  ]),
  propertyType: PropertyTypeSchema,
  rationale: z.string().min(1, { message: 'Rationale is required for inferred qualifier' }),
  confidence: z.number().min(0).max(1).optional(),
});
export type RawInferredQualifier = z.infer<typeof RawInferredQualifierSchema>;

/**
 * Individual raw candidate claim extracted by model.
 */
export const RawExtractedClaimSchema = z.object({
  statement: z.string().min(1, { message: 'Statement excerpt cannot be empty' }),
  normalizedProposition: z.string().min(1, { message: 'Normalized proposition cannot be empty' }),
  domain: z.string().optional().default('generic'),
  timeSensitivity: TimeSensitivitySchema.optional().default('medium'),
  locationHint: LocationHintSchema,
  explicitQualifiers: z.array(RawExtractedQualifierSchema).default([]),
  inferredQualifiers: z.array(RawInferredQualifierSchema).default([]),
  missingMaterialQualifiers: z.array(z.string()).default([]),
});
export type RawExtractedClaim = z.infer<typeof RawExtractedClaimSchema>;

/**
 * Complete intermediate model response schema.
 */
export const RawExtractionResponseSchema = z.object({
  claims: z.array(RawExtractedClaimSchema),
  refusal: z.string().optional(),
});
export type RawExtractionResponse = z.infer<typeof RawExtractionResponseSchema>;

/**
 * Output discriminated union branches.
 */
export const ExtractClaimsSuccessOutcomeSchema = z.object({
  status: z.literal('success'),
  tickets: z
    .array(ClaimTicketSchema)
    .min(1, { message: 'Success outcome requires at least one claim ticket' }),
  inputHash: z.string().min(1),
  rawCount: z.number().int().min(1),
});
export type ExtractClaimsSuccessOutcome = z.infer<typeof ExtractClaimsSuccessOutcomeSchema>;

export const ExtractClaimsNoClaimsOutcomeSchema = z.object({
  status: z.literal('no_claims'),
  tickets: z.array(ClaimTicketSchema).max(0),
  inputHash: z.string().min(1),
  reason: z.string().min(1),
});
export type ExtractClaimsNoClaimsOutcome = z.infer<typeof ExtractClaimsNoClaimsOutcomeSchema>;

export const ExtractClaimsFailedOutcomeSchema = z.object({
  status: z.literal('failed'),
  tickets: z.array(ClaimTicketSchema).max(0),
  inputHash: z.string().optional(),
  error: ExtractionErrorSchema,
});
export type ExtractClaimsFailedOutcome = z.infer<typeof ExtractClaimsFailedOutcomeSchema>;

/**
 * Canonical discriminated union governing the operation outcome of A03.
 */
export const ExtractClaimsOutcomeSchema = z.discriminatedUnion('status', [
  ExtractClaimsSuccessOutcomeSchema,
  ExtractClaimsNoClaimsOutcomeSchema,
  ExtractClaimsFailedOutcomeSchema,
]);
export type ExtractClaimsOutcome = z.infer<typeof ExtractClaimsOutcomeSchema>;
