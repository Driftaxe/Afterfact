import { z } from 'zod';
import { ClaimTicket, VerificationPropertySchema } from './claim-ticket';
import { CalendarDateOrTimestampSchema, IsoTimestampSchema } from './dates';
import { HttpUrlSchema } from './evidence';
import { SourceRoleSchema } from './research';

/**
 * Source document extraction status.
 */
export const ExtractionStatusSchema = z.enum([
  'success',   // Complete text extraction succeeded
  'partial',   // Partial extraction due to layout complexity or paywall
  'truncated', // Extraction hit buffer limits and was cleanly sliced
  'failed',    // Extraction failed (e.g. 404, anti-bot challenge, network timeout)
]);
export type ExtractionStatus = z.infer<typeof ExtractionStatusSchema>;

/**
 * Source Document Schema.
 * Represents a retrieved web page or external publication.
 */
export const SourceDocumentSchema = z
  .object({
    documentId: z.string().min(1, { message: 'Document ID is required' }),
    runId: z.string().min(1, { message: 'Run ID is required' }),
    url: HttpUrlSchema,
    finalUrl: HttpUrlSchema,
    canonicalUrl: HttpUrlSchema.nullable().optional(),
    title: z.string().nullable().optional(),
    publisher: z.string().nullable().optional(),
    retrievedContentHash: z.string().min(1, { message: 'Content hash is required' }),
    retrievedAt: IsoTimestampSchema,
    rawText: z.string().nullable().optional(),
    extractionStatus: ExtractionStatusSchema,
    failureReason: z.string().nullable().optional(),
    publicationDate: CalendarDateOrTimestampSchema.nullable().optional(),
    effectiveDate: CalendarDateOrTimestampSchema.nullable().optional(),
    sourceRole: SourceRoleSchema,
  })
  .superRefine((doc, ctx) => {
    // 1. Success, partial, or truncated must contain extracted rawText
    if (
      (doc.extractionStatus === 'success' ||
        doc.extractionStatus === 'partial' ||
        doc.extractionStatus === 'truncated') &&
      (!doc.rawText || doc.rawText.trim().length === 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['rawText'],
        message: `Extraction status '${doc.extractionStatus}' requires non-empty rawText`,
      });
    }

    // 2. Failed extraction must have null/empty rawText and a non-empty failureReason
    if (doc.extractionStatus === 'failed') {
      if (doc.rawText && doc.rawText.length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['rawText'],
          message: "Failed extraction cannot have non-empty rawText",
        });
      }
      if (!doc.failureReason || doc.failureReason.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['failureReason'],
          message: "Failed extraction requires a non-empty failureReason",
        });
      }
    }
  });

export type SourceDocument = z.infer<typeof SourceDocumentSchema>;

/**
 * Character or DOM locator referencing the extracted passage within the SourceDocument.
 */
export const EvidenceLocatorSchema = z
  .object({
    charOffsetStart: z.number().int().nonnegative().optional(),
    charOffsetEnd: z.number().int().nonnegative().optional(),
    domSelector: z.string().optional(),
    sectionAnchor: z.string().optional(),
  })
  .superRefine((loc, ctx) => {
    if (
      loc.charOffsetStart !== undefined &&
      loc.charOffsetEnd !== undefined &&
      loc.charOffsetStart >= loc.charOffsetEnd
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['charOffsetStart'],
        message: 'charOffsetStart must be strictly less than charOffsetEnd',
      });
    }
  });

export type EvidenceLocator = z.infer<typeof EvidenceLocatorSchema>;

/**
 * Context-preserving Evidence Unit Schema.
 * Represents a localized excerpt with surrounding structural headers, footnotes, or table cells.
 */
export const EvidenceUnitSchema = z.object({
  evidenceId: z.string().min(1, { message: 'Evidence ID is required' }),
  documentId: z.string().min(1, { message: 'Document ID is required' }),
  verbatimText: z.string().min(1, { message: 'Verbatim text cannot be empty' }),
  locator: EvidenceLocatorSchema,
  surroundingHeaders: z.array(z.string()).default([]),
  tableContext: z
    .object({
      tableTitle: z.string().optional(),
      columnHeader: z.string().optional(),
      rowHeader: z.string().optional(),
    })
    .nullable()
    .optional(),
  footnotes: z.array(z.string()).default([]),
  extractedProperties: z.array(VerificationPropertySchema).default([]),
  publicationDate: CalendarDateOrTimestampSchema.nullable().optional(),
  effectiveDate: CalendarDateOrTimestampSchema.nullable().optional(),
  announcementDate: CalendarDateOrTimestampSchema.nullable().optional(),
  extractionLimitations: z.array(z.string()).default([]),
});

export type EvidenceUnit = z.infer<typeof EvidenceUnitSchema>;

/**
 * Evaluated relationship between an individual ClaimTicket revision and an EvidenceUnit.
 */
export const AssessmentRelationshipSchema = z.enum([
  'supports',                  // Directly confirms proposition and qualifiers
  'contradicts',              // Directly refutes proposition under matching scope
  'relevant_but_inconclusive', // Mentions entity/attribute but lacks decisive qualifiers
  'unrelated',                // Lacks semantic relevance
  'historical_state',         // Confirms claim was valid in past, but since superseded
  'future_scheduled_change',  // Confirms change announced but effective in future
]);
export type AssessmentRelationship = z.infer<typeof AssessmentRelationshipSchema>;

/**
 * Scope matching assessment.
 */
export const ScopeMatchingSchema = z.enum(['match', 'mismatch', 'unknown']);
export type ScopeMatching = z.infer<typeof ScopeMatchingSchema>;

/**
 * Evaluated Claim Evidence Assessment Schema.
 */
export const ClaimEvidenceAssessmentSchema = z.object({
  assessmentId: z.string().min(1, { message: 'Assessment ID is required' }),
  claimTicketId: z.string().min(1, { message: 'Claim ticket ID is required' }),
  claimRevision: z.number().int().min(1, { message: 'Claim revision must be >= 1' }),
  evidenceId: z.string().min(1, { message: 'Evidence ID is required' }),
  relationship: AssessmentRelationshipSchema,
  scopeMatching: ScopeMatchingSchema,
  quotationVerified: z.boolean(),
  propertyMatchStatus: z.object({
    matching: z.array(z.string()).default([]),
    mismatched: z.array(z.string()).default([]),
    missingInEvidence: z.array(z.string()).default([]),
  }),
  temporalApplicability: z.enum([
    'active_at_target_time',
    'historical_prior',
    'future_pending',
    'undetermined',
  ]),
  sourceSuitability: z.enum([
    'authoritative_primary',
    'credible_secondary',
    'insufficient_authority',
  ]),
  modelConfidence: z.number().min(0).max(1).nullable().optional(),
  reasoning: z.string().min(1, { message: 'Reasoning is required' }),
});

export type ClaimEvidenceAssessment = z.infer<typeof ClaimEvidenceAssessmentSchema>;

/**
 * Pure aggregate validation boundary between a SourceDocument and an EvidenceUnit:
 * - Ensures evidence unit refers to the given source document.
 * - Rejects dangling source IDs or missing raw text.
 * - Verifies verbatim excerpt substring presence in the source document.
 * - If character offsets are present, verifies exact character offset slice matches verbatim text.
 */
export function validateEvidenceUnitAgainstSource(
  source: SourceDocument,
  unit: EvidenceUnit
): { valid: boolean; reason?: string } {
  if (unit.documentId !== source.documentId) {
    return {
      valid: false,
      reason: `Dangling source reference: EvidenceUnit points to document ${unit.documentId}, but received ${source.documentId}`,
    };
  }

  if (source.rawText === null || source.rawText === undefined) {
    return {
      valid: false,
      reason: `Source document ${source.documentId} has no extracted rawText (extractionStatus: ${source.extractionStatus})`,
    };
  }

  // 1. Offsets check if present
  const { charOffsetStart, charOffsetEnd } = unit.locator;
  if (charOffsetStart !== undefined && charOffsetEnd !== undefined) {
    if (charOffsetStart < 0 || charOffsetEnd > source.rawText.length) {
      return {
        valid: false,
        reason: `Character offsets [${charOffsetStart}, ${charOffsetEnd}] exceed source text length of ${source.rawText.length}`,
      };
    }

    const sliced = source.rawText.slice(charOffsetStart, charOffsetEnd);
    if (sliced !== unit.verbatimText) {
      return {
        valid: false,
        reason: `Source text slice at [${charOffsetStart}, ${charOffsetEnd}] does not match verbatim text`,
      };
    }
  }

  // 2. Substring presence check
  if (!source.rawText.includes(unit.verbatimText)) {
    return {
      valid: false,
      reason: `Source document does not contain verbatim text excerpt`,
    };
  }

  return { valid: true };
}

/**
 * Pure aggregate boundary validating an assessment against its bound ClaimTicket and EvidenceUnit:
 * - Rejects dangling evidence references (assessment.evidenceId !== evidence.evidenceId).
 * - Rejects incorrect claim linkage (assessment.claimTicketId !== claim.ticketId).
 * - Rejects stale/incorrect claim revision linkage (assessment.claimRevision !== claim.revision).
 */
export function validateClaimEvidenceAssessmentReferences(
  assessment: ClaimEvidenceAssessment,
  claim: ClaimTicket,
  evidence: EvidenceUnit
): { valid: boolean; reason?: string } {
  if (assessment.claimTicketId !== claim.ticketId) {
    return {
      valid: false,
      reason: `Claim ticket mismatch: assessment bound to '${assessment.claimTicketId}', received claim '${claim.ticketId}'`,
    };
  }

  if (assessment.claimRevision !== claim.revision) {
    return {
      valid: false,
      reason: `Claim revision mismatch: assessment evaluated revision ${assessment.claimRevision}, but claim is at revision ${claim.revision}`,
    };
  }

  if (assessment.evidenceId !== evidence.evidenceId) {
    return {
      valid: false,
      reason: `Dangling evidence reference: assessment points to evidence '${assessment.evidenceId}', received evidence '${evidence.evidenceId}'`,
    };
  }

  return { valid: true };
}
