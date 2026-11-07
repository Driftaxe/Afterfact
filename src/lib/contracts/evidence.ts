import { z } from 'zod';
import { CalendarDateOrTimestampSchema, IsoTimestampSchema } from './dates';

/**
 * Validates that an evidence URL strictly uses HTTP or HTTPS protocol.
 * Generic URL validation alone is insufficient as it permits javascript:, mailto:, or file: schemes.
 */
export const HttpUrlSchema = z
  .string()
  .url({ message: 'Evidence URL must be a valid URL' })
  .refine((url) => /^https?:\/\//i.test(url), {
    message: 'Evidence URL must use http:// or https:// protocol',
  });

/**
 * Known trustworthy authority types for evidence classification.
 */
export const SourceTypeSchema = z
  .enum([
    'official_documentation',
    'changelog',
    'regulatory_register',
    'statutory_code',
    'sec_filing',
    'press_release',
    'news_report',
    'general_web',
  ])
  .or(z.string());

export type SourceType = z.infer<typeof SourceTypeSchema>;

/**
 * Retrieved evidence passage schema.
 * Represents an exact, immutable excerpt from a web search or extraction run.
 * Preserves source URL query parameters (e.g. version or anchor tags).
 */
export const EvidenceItemSchema = z.object({
  id: z.string().min(1, { message: 'Evidence ID is required' }),
  url: HttpUrlSchema,
  title: z.string().optional().nullable(),
  publisher: z.string().optional().nullable(),
  sourceType: SourceTypeSchema.optional().nullable(),
  passage: z.string().min(1, { message: 'Retrieved passage cannot be empty' }),
  retrievedAt: IsoTimestampSchema,
  publicationDate: CalendarDateOrTimestampSchema.nullable().optional(),
  announcementDate: CalendarDateOrTimestampSchema.nullable().optional(),
  effectiveDate: CalendarDateOrTimestampSchema.nullable().optional(),
  scope: z.record(z.string(), z.string().nullable().optional()).nullable().optional(),
  contentHash: z.string().optional().nullable(),
});

export type EvidenceItem = z.infer<typeof EvidenceItemSchema>;
