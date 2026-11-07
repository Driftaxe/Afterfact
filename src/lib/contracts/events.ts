import { z } from 'zod';
import { ClaimSpanSchema } from './claim';
import { VerdictSchema, ReportSummarySchema, validateAssessedVerdictScore } from './report';
import { IsoTimestampSchema } from './dates';

/**
 * Event: run_started
 * Emitted immediately after run creation when coordinator processing initiates.
 */
export const RunStartedEventSchema = z
  .object({
    type: z.literal('run_started'),
    runId: z.string().min(1, { message: 'runId is required' }),
    seq: z.number().int().positive({ message: 'seq must be a positive integer' }),
    mode: z.enum(['paste', 'ask']),
    textLength: z.number().int().nonnegative(),
    timestamp: IsoTimestampSchema,
  })
  .strict();

export type RunStartedEvent = z.infer<typeof RunStartedEventSchema>;

/**
 * Event: claims_identified
 * Emitted after atomic claim extraction has split the input text into claims.
 */
export const ClaimsIdentifiedEventSchema = z
  .object({
    type: z.literal('claims_identified'),
    runId: z.string().min(1, { message: 'runId is required' }),
    seq: z.number().int().positive({ message: 'seq must be a positive integer' }),
    claims: z.array(
      z
        .object({
          id: z.string().min(1),
          ordinal: z.number().int().nonnegative(),
          text: z.string().min(1),
          span: ClaimSpanSchema.nullable().optional(),
        })
        .strict()
    ),
    timestamp: IsoTimestampSchema,
  })
  .strict();

export type ClaimsIdentifiedEvent = z.infer<typeof ClaimsIdentifiedEventSchema>;

/**
 * Event: claim_result
 * Emitted when an individual claim's verification finishes with a conclusive verdict.
 * Reuses the canonical assessed verdict/score validation rule shared with ReportSchema.
 */
export const ClaimResultEventSchema = z
  .object({
    type: z.literal('claim_result'),
    runId: z.string().min(1, { message: 'runId is required' }),
    seq: z.number().int().positive({ message: 'seq must be a positive integer' }),
    claimId: z.string().min(1, { message: 'claimId is required' }),
    verdict: VerdictSchema,
    score: z.union([z.literal(100), z.literal(75), z.literal(0), z.null()]),
    reasonCode: z.string().min(1, { message: 'reasonCode is required' }),
    scoreReason: z.string().optional().nullable(),
    timestamp: IsoTimestampSchema,
  })
  .strict()
  .superRefine((event, ctx) => validateAssessedVerdictScore(event, ctx));

export type ClaimResultEvent = z.infer<typeof ClaimResultEventSchema>;

/**
 * Event: claim_failed
 * Emitted if a claim worker crashes or exhausts retries without producing a verdict.
 */
export const ClaimFailedEventSchema = z
  .object({
    type: z.literal('claim_failed'),
    runId: z.string().min(1, { message: 'runId is required' }),
    seq: z.number().int().positive({ message: 'seq must be a positive integer' }),
    claimId: z.string().min(1, { message: 'claimId is required' }),
    reasonCode: z.string().min(1, { message: 'reasonCode is required' }),
    error: z.string().min(1, { message: 'error message is required' }),
    timestamp: IsoTimestampSchema,
  })
  .strict();

export type ClaimFailedEvent = z.infer<typeof ClaimFailedEventSchema>;

/**
 * Event: run_finished
 * Emitted when all claims reach terminal status and the overall run state is finalized.
 */
export const RunFinishedEventSchema = z
  .object({
    type: z.literal('run_finished'),
    runId: z.string().min(1, { message: 'runId is required' }),
    seq: z.number().int().positive({ message: 'seq must be a positive integer' }),
    state: z.enum(['completed', 'partial', 'failed']),
    summary: ReportSummarySchema,
    timestamp: IsoTimestampSchema,
  })
  .strict();

export type RunFinishedEvent = z.infer<typeof RunFinishedEventSchema>;

/**
 * Discriminated union of all server-sent verification progress events.
 * Note: Individual event validation proves payload shape and sequence number validity,
 * but stream-level monotonicity and replay gaps must be verified by the consumer stream handler.
 */
export const VerificationEventSchema = z.discriminatedUnion('type', [
  RunStartedEventSchema,
  ClaimsIdentifiedEventSchema,
  ClaimResultEventSchema,
  ClaimFailedEventSchema,
  RunFinishedEventSchema,
]);

export type VerificationEvent = z.infer<typeof VerificationEventSchema>;
