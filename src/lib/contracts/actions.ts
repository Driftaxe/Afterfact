import { z } from 'zod';
import { ClaimTicketSchema } from './claim-ticket';
import { ClarificationAnswerItemSchema, ClarificationQuestionSchema } from './clarification';
import { PreparationStatusSchema } from './preparation';
import { MAX_ASK_LENGTH, MAX_PASTE_LENGTH, SharedContextSchema } from './request';

/**
 * Server Action: startPreparationAction
 */
export const StartPreparationActionInputSchema = z
  .object({
    mode: z.enum(['paste', 'ask']),
    text: z
      .string()
      .min(1, { message: 'Input text cannot be empty' })
      .max(MAX_PASTE_LENGTH, { message: `Input text exceeds maximum length of ${MAX_PASTE_LENGTH}` }),
    originalQuestion: z
      .string()
      .max(MAX_ASK_LENGTH, { message: `Original question exceeds ${MAX_ASK_LENGTH}` })
      .optional()
      .nullable(),
    context: SharedContextSchema.optional().default({}),
  })
  .strict();
export type StartPreparationActionInput = z.infer<typeof StartPreparationActionInputSchema>;

export const StartPreparationActionResultSchema = z
  .object({
    preparationId: z.string().min(1),
    inputHash: z.string().min(1),
    revision: z.number().int().min(1),
    status: PreparationStatusSchema,
    claims: z.array(ClaimTicketSchema),
    questions: z.array(ClarificationQuestionSchema).optional(),
  })
  .strict();
export type StartPreparationActionResult = z.infer<typeof StartPreparationActionResultSchema>;

/**
 * Server Action: confirmPreparationAction
 */
export const ConfirmPreparationActionInputSchema = z
  .object({
    preparationId: z.string().min(1),
    inputHash: z.string().min(1),
    revision: z.number().int().min(1),
    confirmedClaims: z.array(ClaimTicketSchema).min(1, { message: 'At least one claim must be confirmed' }),
  })
  .strict();
export type ConfirmPreparationActionInput = z.infer<typeof ConfirmPreparationActionInputSchema>;

export const ConfirmPreparationActionResultSchema = z
  .object({
    runId: z.string().min(1),
    status: z.literal('running'),
    graphVersion: z.number().int().min(1),
    streamUrl: z.string().min(1),
  })
  .strict();
export type ConfirmPreparationActionResult = z.infer<typeof ConfirmPreparationActionResultSchema>;

/**
 * Server Action: submitClarificationAction
 */
export const SubmitClarificationActionInputSchema = z
  .object({
    runId: z.string().min(1),
    questionSetId: z.string().min(1),
    revision: z.number().int().min(1),
    answers: z.array(ClarificationAnswerItemSchema),
  })
  .strict();
export type SubmitClarificationActionInput = z.infer<typeof SubmitClarificationActionInputSchema>;

export const SubmitClarificationActionResultSchema = z
  .object({
    runId: z.string().min(1),
    status: z.enum(['running', 'waiting_for_input']),
    acceptedAnswers: z.number().int().nonnegative(),
  })
  .strict();
export type SubmitClarificationActionResult = z.infer<typeof SubmitClarificationActionResultSchema>;

/**
 * Server Action: compareAction
 */
export const CompareActionInputSchema = z
  .object({
    parentRunId: z.string().min(1),
    claimId: z.string().min(1),
    targetContext: z.record(z.string(), z.string().nullable().optional()),
  })
  .strict();
export type CompareActionInput = z.infer<typeof CompareActionInputSchema>;

export const CompareActionResultSchema = z
  .object({
    parentRunId: z.string().min(1),
    childRunId: z.string().min(1),
    streamUrl: z.string().min(1),
  })
  .strict();
export type CompareActionResult = z.infer<typeof CompareActionResultSchema>;

/**
 * Server Action: recheckAction
 */
export const RecheckActionInputSchema = z
  .object({
    runId: z.string().min(1),
  })
  .strict();
export type RecheckActionInput = z.infer<typeof RecheckActionInputSchema>;

export const RecheckActionResultSchema = z
  .object({
    parentRunId: z.string().min(1),
    childRunId: z.string().min(1),
    streamUrl: z.string().min(1),
  })
  .strict();
export type RecheckActionResult = z.infer<typeof RecheckActionResultSchema>;
