import { z } from 'zod';
import { CompleteCalendarDateSchema } from './dates';

/**
 * Maximum character limits per input mode.
 * Character counts are measured in standard UTF-16 code units (JavaScript string.length).
 */
export const MAX_PASTE_LENGTH = 8000;
export const MAX_ASK_LENGTH = 800;

/**
 * Shared search and verification context provided by the user.
 * Explicit qualifiers found in claim text take precedence over these values.
 * targetDate and answerDate must be complete calendar dates (YYYY-MM-DD) when provided.
 */
export const SharedContextSchema = z
  .object({
    targetDate: CompleteCalendarDateSchema.optional().nullable(),
    answerDate: CompleteCalendarDateSchema.optional().nullable(),
    jurisdiction: z.string().optional().nullable(),
    region: z.string().optional().nullable(),
    currency: z.string().optional().nullable(),
    version: z.string().optional().nullable(),
    billingTerm: z.string().optional().nullable(),
  })
  .strict();

export type SharedContext = z.infer<typeof SharedContextSchema>;

/**
 * Paste verification request schema.
 * Strict object rejection prevents Ask fields from silently passing.
 * Rejects whitespace-only required input while preserving accepted input text byte-for-byte without auto-trimming.
 */
export const PasteRequestSchema = z
  .object({
    mode: z.literal('paste'),
    answerText: z
      .string()
      .max(MAX_PASTE_LENGTH, {
        message: `Answer text exceeds maximum limit of ${MAX_PASTE_LENGTH} characters`,
      })
      .refine((val) => val.trim().length > 0, {
        message: 'Answer text cannot be empty or whitespace-only',
      }),
    originalQuestion: z.string().optional().nullable(),
    context: SharedContextSchema.optional().default({}),
  })
  .strict();

export type PasteRequest = z.infer<typeof PasteRequestSchema>;

/**
 * Ask question verification request schema.
 * Strict object rejection prevents Paste fields from silently passing.
 * Rejects whitespace-only question while preserving accepted input.
 */
export const AskRequestSchema = z
  .object({
    mode: z.literal('ask'),
    question: z
      .string()
      .max(MAX_ASK_LENGTH, {
        message: `Question exceeds maximum limit of ${MAX_ASK_LENGTH} characters`,
      })
      .refine((val) => val.trim().length > 0, {
        message: 'Question cannot be empty or whitespace-only',
      }),
    context: SharedContextSchema.optional().default({}),
  })
  .strict();

export type AskRequest = z.infer<typeof AskRequestSchema>;

/**
 * Discriminated union of all supported verification requests.
 */
export const VerificationRequestSchema = z.discriminatedUnion('mode', [
  PasteRequestSchema,
  AskRequestSchema,
]);

export type VerificationRequest = z.infer<typeof VerificationRequestSchema>;
