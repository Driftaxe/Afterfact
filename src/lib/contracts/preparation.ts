import { z } from 'zod';
import { ClaimSpanSchema } from './claim';
import { ClaimTicketSchema, VerificationPropertySchema } from './claim-ticket';
import { IsoTimestampSchema } from './dates';

/**
 * Operational status of an interactive preparation workflow.
 */
export const PreparationStatusSchema = z.enum([
  'drafting',             // Extraction in progress or initial review
  'ready',                // Context sufficient; ready for confirmation
  'needs_clarification',  // Material ambiguity requires clarification
  'superseded',           // New input text provided; previous revision invalidated
  'failed',               // Terminal extraction or processing failure
]);
export type PreparationStatus = z.infer<typeof PreparationStatusSchema>;

/**
 * Explicit qualifier extracted directly from the input text.
 */
export const ExplicitQualifierSchema = z.object({
  key: z.string().min(1, { message: 'Qualifier key is required' }),
  value: z.string().min(1, { message: 'Qualifier value is required' }),
  span: ClaimSpanSchema,
});
export type ExplicitQualifier = z.infer<typeof ExplicitQualifierSchema>;

/**
 * Context qualifier inferred by the model during preparation pass.
 * Pending user confirmation or empirical evidence corroboration.
 */
export const InferredSuggestionSchema = z.object({
  key: z.string().min(1, { message: 'Suggestion key is required' }),
  property: VerificationPropertySchema,
  confidence: z.number().min(0).max(1, { message: 'Confidence must be between 0 and 1' }),
  rationale: z.string().min(1, { message: 'Rationale is required for inferred suggestion' }),
});
export type InferredSuggestion = z.infer<typeof InferredSuggestionSchema>;

/**
 * Full Preparation Record Schema.
 * Tracks input hash binding, explicit qualifiers with text spans, inferred suggestions,
 * and proposed claim tickets.
 */
export const PreparationRecordSchema = z.object({
  preparationId: z.string().min(1, { message: 'Preparation ID is required' }),
  runId: z.string().min(1, { message: 'Run ID is required' }),
  inputHash: z.string().min(1, { message: 'Input hash is required' }),
  revision: z.number().int().min(1, { message: 'Revision must be >= 1' }),
  status: PreparationStatusSchema,
  explicitQualifiers: z.array(ExplicitQualifierSchema).default([]),
  inferredSuggestions: z.array(InferredSuggestionSchema).default([]),
  proposedTickets: z.array(ClaimTicketSchema).default([]),
  clarificationQuestionSetId: z.string().nullable().optional(),
  failureReason: z.string().nullable().optional(),
  createdAt: IsoTimestampSchema,
  updatedAt: IsoTimestampSchema,
});

export type PreparationRecord = z.infer<typeof PreparationRecordSchema>;
