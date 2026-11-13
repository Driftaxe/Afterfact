import { z } from 'zod';
import { ClaimSpanSchema, validateClaimSpan } from './claim';
import { EvidenceItemSchema } from './evidence';
import { CompleteCalendarDateSchema, CalendarDateOrTimestampOrPartialSchema, IsoTimestampSchema } from './dates';
import { SharedContextSchema } from './request';

/**
 * Permitted verification verdicts.
 */
export const VerdictSchema = z.enum([
  'supported',
  'outdated',
  'contradicted',
  'depends_on_context',
  'conflicting_evidence',
  'insufficient_evidence',
]);

export type Verdict = z.infer<typeof VerdictSchema>;

/**
 * Processing state of an individual claim.
 */
export const ClaimStateSchema = z.enum([
  'pending',
  'researching',
  'assessed',
  'failed',
]);

export type ClaimState = z.infer<typeof ClaimStateSchema>;

/**
 * Lifecycle state of a full verification run.
 */
export const RunStateSchema = z.enum([
  'queued',
  'running',
  'completed',
  'partial',
  'failed',
]);

export type RunState = z.infer<typeof RunStateSchema>;

/**
 * Chronological state for Then vs. Now timeline entries.
 */
export const TimelineStateSchema = z.enum([
  'historical',
  'transition',
  'current',
  'upcoming',
]);

export type TimelineState = z.infer<typeof TimelineStateSchema>;

/**
 * Entry in the Then vs. Now transition timeline.
 */
export const TimelineEntrySchema = z.object({
  state: TimelineStateSchema,
  effectiveDate: CalendarDateOrTimestampOrPartialSchema.nullable().optional(),
  announcementDate: CalendarDateOrTimestampOrPartialSchema.nullable().optional(),
  summary: z.string().min(1, { message: 'Timeline summary cannot be empty' }),
  evidenceId: z.string().nullable().optional(),
});

export type TimelineEntry = z.infer<typeof TimelineEntrySchema>;

/**
 * Evidence-backed surgical correction diff.
 * If verified is true, at least one evidenceId is required.
 */
export const CorrectionSchema = z.object({
  originalText: z.string().min(1, { message: 'Original text is required' }),
  replacementText: z.string().min(1, { message: 'Replacement text is required' }),
  diff: z.string().min(1, { message: 'Correction diff is required' }),
  verified: z.boolean(),
  evidenceIds: z.array(z.string()).default([]),
});

export type Correction = z.infer<typeof CorrectionSchema>;

/**
 * Shared validation function enforcing the documented verdict/score rubric:
 * - supported -> 100 or 75
 * - outdated or contradicted -> 0 (strictly)
 * - depends_on_context, conflicting_evidence, insufficient_evidence -> null, with meaningful non-whitespace reason
 */
export function validateAssessedVerdictScore(
  data: {
    verdict: Verdict;
    score: number | null;
    scoreReason?: string | null;
    reasonCode?: string | null;
  },
  ctx: z.RefinementCtx
) {
  if (data.scoreReason !== undefined && data.scoreReason !== null && data.scoreReason.trim().length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['scoreReason'],
      message: 'scoreReason cannot be empty or whitespace-only',
    });
  }

  if (data.reasonCode !== undefined && data.reasonCode !== null && data.reasonCode.trim().length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['reasonCode'],
      message: 'reasonCode cannot be empty or whitespace-only',
    });
  }

  if (data.verdict === 'supported') {
    if (data.score !== 100 && data.score !== 75) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['score'],
        message: `Verdict 'supported' requires score 100 or 75, received ${data.score}`,
      });
    }
  } else if (data.verdict === 'outdated' || data.verdict === 'contradicted') {
    if (data.score !== 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['score'],
        message: `Verdict '${data.verdict}' requires score 0, received ${data.score}`,
      });
    }
  } else {
    // Unresolved verdicts: depends_on_context, conflicting_evidence, insufficient_evidence
    if (data.score !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['score'],
        message: `Unresolved verdict '${data.verdict}' must have score null, received ${data.score}`,
      });
    }

    if (!data.scoreReason || data.scoreReason.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['scoreReason'],
        message: `Unresolved verdict '${data.verdict}' requires a non-empty scoreReason`,
      });
    }
  }
}

/**
 * Base common fields present on all claim result items.
 */
const BaseClaimFields = {
  id: z.string().min(1, { message: 'Result ID is required' }),
  claimId: z.string().min(1, { message: 'Claim ID is required' }),
  parentClaimId: z.string().nullable().optional(),
  ordinal: z.number().int().nonnegative(),
  rawText: z.string().min(1, { message: 'Raw claim text is required' }),
  span: ClaimSpanSchema.nullable().optional(),
};

/**
 * Fully assessed claim result item.
 */
export const AssessedClaimResultSchema = z
  .object({
    ...BaseClaimFields,
    state: z.literal('assessed'),
    verdict: VerdictSchema,
    score: z.union([z.literal(100), z.literal(75), z.literal(0), z.null()]),
    scoreReason: z.string().min(1, { message: 'scoreReason is required' }),
    reasonCode: z.string().min(1, { message: 'reasonCode is required' }),
    evidenceIds: z.array(z.string()).default([]),
    timeline: z.array(TimelineEntrySchema).optional(),
    correction: CorrectionSchema.nullable().optional(),
  })
  .superRefine((claim, ctx) => validateAssessedVerdictScore(claim, ctx));

export type AssessedClaimResult = z.infer<typeof AssessedClaimResultSchema>;

/**
 * Failed claim result item: preserves terminal error without fabricating an assessed verdict.
 */
export const FailedClaimResultSchema = z.object({
  ...BaseClaimFields,
  state: z.literal('failed'),
  error: z.string().min(1, { message: 'Error description is required for failed claim' }),
  reasonCode: z.string().min(1, { message: 'reasonCode is required' }),
  verdict: z.null().optional(),
  score: z.null().optional(),
  scoreReason: z.string().nullable().optional(),
  evidenceIds: z.array(z.string()).default([]),
  timeline: z.array(TimelineEntrySchema).optional(),
  correction: z.null().optional(),
});

export type FailedClaimResult = z.infer<typeof FailedClaimResultSchema>;

/**
 * Pending or researching claim result item: indicates in-flight work without a fabricated verdict.
 */
export const InProgressClaimResultSchema = z.object({
  ...BaseClaimFields,
  state: z.enum(['pending', 'researching']),
  verdict: z.null().optional(),
  score: z.null().optional(),
  scoreReason: z.string().nullable().optional(),
  reasonCode: z.string().nullable().optional(),
  evidenceIds: z.array(z.string()).default([]),
  timeline: z.array(TimelineEntrySchema).optional(),
  correction: z.null().optional(),
});

export type InProgressClaimResult = z.infer<typeof InProgressClaimResultSchema>;

/**
 * Discriminated union of all claim states in a report.
 */
export const ClaimResultItemSchema = z.discriminatedUnion('state', [
  AssessedClaimResultSchema,
  FailedClaimResultSchema,
  InProgressClaimResultSchema,
]);

export type ClaimResultItem = z.infer<typeof ClaimResultItemSchema>;

/**
 * Summary counts for a verification report.
 */
export const ReportSummarySchema = z.object({
  totalClaims: z.number().int().nonnegative(),
  supported: z.number().int().nonnegative(),
  outdated: z.number().int().nonnegative(),
  contradicted: z.number().int().nonnegative(),
  unresolved: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative().optional(),
  pending: z.number().int().nonnegative().optional(),
});

export type ReportSummary = z.infer<typeof ReportSummarySchema>;

/**
 * Base report structure.
 */
export const BaseReportSchema = z.object({
  id: z.string().min(1, { message: 'Run ID is required' }),
  parentRunId: z.string().nullable().optional(),
  mode: z.enum(['paste', 'ask']),
  state: RunStateSchema,
  answerText: z.string().nullable().optional(),
  context: SharedContextSchema.optional().default({}),
  asOfDate: CompleteCalendarDateSchema.nullable().optional(),
  createdAt: IsoTimestampSchema,
  finishedAt: IsoTimestampSchema.nullable().optional(),
  latestSeq: z.number().int().nonnegative(),
  summary: ReportSummarySchema,
  claims: z.array(ClaimResultItemSchema),
  evidence: z.array(EvidenceItemSchema),
  isReplay: z.boolean().optional().default(false),
  replayLabel: z.string().nullable().optional(),
});

/**
 * Full Report schema with holistic integrity verification:
 * 1. Confirms each present highlight matches answerText.
 * 2. Rejects ambiguous duplicate claim identifiers.
 * 3. Rejects duplicate evidence IDs.
 * 4. Verifies all cited evidence IDs exist within report.evidence.
 * 5. Requires verified corrections to have at least one valid evidence reference.
 * 6. Validates summary counts match actual claims.
 */
export const ReportSchema = BaseReportSchema.superRefine((report, ctx) => {
  // 1. Answer text validation
  if (report.mode === 'paste' && (!report.answerText || report.answerText.trim().length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['answerText'],
      message: 'answerText is required for paste mode reports',
    });
  }

  if (report.mode === 'ask' && report.state === 'completed' && (!report.answerText || report.answerText.trim().length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['answerText'],
      message: 'answerText is required for completed ask mode reports',
    });
  }

  const hasAnySpan = report.claims.some((c) => c.span !== null && c.span !== undefined);
  if (hasAnySpan && (!report.answerText || report.answerText.trim().length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['answerText'],
      message: 'answerText is required and cannot be blank when claims contain highlight spans',
    });
  }

  // 2. Reject duplicate claim result IDs and claimIds
  const seenResultIds = new Set<string>();
  const seenClaimIds = new Set<string>();
  report.claims.forEach((claim, idx) => {
    if (seenResultIds.has(claim.id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['claims', idx, 'id'],
        message: `Duplicate claim identifier detected: '${claim.id}'`,
      });
    }
    seenResultIds.add(claim.id);

    if (seenClaimIds.has(claim.claimId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['claims', idx, 'claimId'],
        message: `Duplicate claimId detected: '${claim.claimId}'`,
      });
    }
    seenClaimIds.add(claim.claimId);
  });

  // 3. Reject duplicate evidence IDs
  const seenEvidenceIds = new Set<string>();
  report.evidence.forEach((evi, idx) => {
    if (seenEvidenceIds.has(evi.id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['evidence', idx, 'id'],
        message: `Duplicate evidence identifier detected: '${evi.id}'`,
      });
    }
    seenEvidenceIds.add(evi.id);
  });

  // 4. Highlight validation against answerText when present
  report.claims.forEach((claim, idx) => {
    if (claim.span) {
      if (!report.answerText || report.answerText.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['claims', idx, 'span'],
          message: 'Claim span requires non-blank answerText in report',
        });
      } else {
        const spanCheck = validateClaimSpan(report.answerText, claim.span, claim.rawText);
        if (!spanCheck.valid) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['claims', idx, 'span'],
            message: spanCheck.reason || 'Claim span does not match answerText',
          });
        }
      }
    }
  });

  // 5. Referential integrity for evidence references
  report.claims.forEach((claim, claimIdx) => {
    claim.evidenceIds.forEach((eviId, eviIdx) => {
      if (!seenEvidenceIds.has(eviId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['claims', claimIdx, 'evidenceIds', eviIdx],
          message: `Referenced evidence ID '${eviId}' does not exist in the report's evidence collection`,
        });
      }
    });

    if (claim.timeline) {
      claim.timeline.forEach((entry, timelineIdx) => {
        if (entry.evidenceId && !seenEvidenceIds.has(entry.evidenceId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['claims', claimIdx, 'timeline', timelineIdx, 'evidenceId'],
            message: `Timeline referenced evidence ID '${entry.evidenceId}' does not exist in the report's evidence collection`,
          });
        }
      });
    }

    if (claim.correction) {
      if (claim.correction.verified && (!claim.correction.evidenceIds || claim.correction.evidenceIds.length === 0)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['claims', claimIdx, 'correction', 'evidenceIds'],
          message: 'A verified correction must cite at least one evidence ID',
        });
      }

      if (claim.correction.evidenceIds) {
        claim.correction.evidenceIds.forEach((eviId, corrIdx) => {
          if (!seenEvidenceIds.has(eviId)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['claims', claimIdx, 'correction', 'evidenceIds', corrIdx],
              message: `Correction referenced evidence ID '${eviId}' does not exist in the report's evidence collection`,
            });
          }
        });
      }
    }
  });

  // 6. Summary counts verification
  let actualSupported = 0;
  let actualOutdated = 0;
  let actualContradicted = 0;
  let actualUnresolved = 0;
  let actualFailed = 0;
  let actualPending = 0;

  report.claims.forEach((c) => {
    if (c.state === 'assessed') {
      if (c.verdict === 'supported') actualSupported++;
      else if (c.verdict === 'outdated') actualOutdated++;
      else if (c.verdict === 'contradicted') actualContradicted++;
      else actualUnresolved++;
    } else if (c.state === 'failed') {
      actualFailed++;
    } else {
      actualPending++;
    }
  });

  if (report.summary.totalClaims !== report.claims.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['summary', 'totalClaims'],
      message: `Summary totalClaims (${report.summary.totalClaims}) does not match claims count (${report.claims.length})`,
    });
  }

  if (report.summary.supported !== actualSupported) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['summary', 'supported'],
      message: `Summary supported (${report.summary.supported}) does not match actual count (${actualSupported})`,
    });
  }

  if (report.summary.outdated !== actualOutdated) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['summary', 'outdated'],
      message: `Summary outdated (${report.summary.outdated}) does not match actual count (${actualOutdated})`,
    });
  }

  if (report.summary.contradicted !== actualContradicted) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['summary', 'contradicted'],
      message: `Summary contradicted (${report.summary.contradicted}) does not match actual count (${actualContradicted})`,
    });
  }

  if (report.summary.unresolved !== actualUnresolved) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['summary', 'unresolved'],
      message: `Summary unresolved (${report.summary.unresolved}) does not match actual count (${actualUnresolved})`,
    });
  }

  // Summary failed counter: mismatch if provided, or rejected if omitted when actual > 0
  if (report.summary.failed !== undefined) {
    if (report.summary.failed !== actualFailed) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['summary', 'failed'],
        message: `Summary failed (${report.summary.failed}) does not match actual count (${actualFailed})`,
      });
    }
  } else if (actualFailed > 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['summary', 'failed'],
      message: `Summary failed was omitted (treated as 0) but report contains ${actualFailed} failed claim(s)`,
    });
  }

  // Summary pending counter: mismatch if provided, or rejected if omitted when actual > 0
  if (report.summary.pending !== undefined) {
    if (report.summary.pending !== actualPending) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['summary', 'pending'],
        message: `Summary pending (${report.summary.pending}) does not match actual count (${actualPending})`,
      });
    }
  } else if (actualPending > 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['summary', 'pending'],
      message: `Summary pending was omitted (treated as 0) but report contains ${actualPending} pending/researching claim(s)`,
    });
  }
});

export type Report = z.infer<typeof ReportSchema>;
