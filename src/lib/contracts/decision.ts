import { z } from 'zod';
import { ClaimTicket, VerificationPropertySchema } from './claim-ticket';
import { IsoTimestampSchema } from './dates';
import {
  ClaimEvidenceAssessment,
  EvidenceUnit,
} from './evidence-objects';
import { validateAssessedVerdictScore, VerdictSchema } from './report';

/**
 * Untrusted synthesis proposal emitted by LLM verifier.
 * Represents an unverified candidate verdict pending deterministic validation.
 */
export const SynthesisProposalSchema = z.object({
  proposalId: z.string().min(1, { message: 'Proposal ID is required' }),
  claimTicketId: z.string().min(1, { message: 'Claim ticket ID is required' }),
  claimRevision: z.number().int().min(1, { message: 'Claim revision must be >= 1' }),
  recommendedVerdict: VerdictSchema,
  recommendedScore: z.union([z.literal(100), z.literal(75), z.literal(0), z.null()]),
  citedAssessmentIds: z.array(z.string()).default([]),
  opposingAssessmentIds: z.array(z.string()).default([]),
  unresolvedConflicts: z.array(z.string()).default([]),
  requestsAdditionalResearch: z.boolean().default(false),
  requestsClarification: z.boolean().default(false),
  rationale: z.string().min(1, { message: 'Proposal rationale is required' }),
  limitations: z.array(z.string()).default([]),
});

export type SynthesisProposal = z.infer<typeof SynthesisProposalSchema>;

/**
 * Excluded evidence item discarded during synthesis.
 */
export const ExcludedEvidenceItemSchema = z.object({
  evidenceId: z.string().min(1),
  exclusionReason: z.enum([
    'wrong_scope',
    'unverifiable_quote',
    'superseded_date',
    'untrusted_source',
  ]),
});
export type ExcludedEvidenceItem = z.infer<typeof ExcludedEvidenceItemSchema>;

/**
 * Temporal basis markers for the final decision.
 */
export const TemporalBasisSchema = z.object({
  targetTime: z.string().min(1),
  effectiveDate: z.string().nullable().optional(),
  publicationDate: z.string().nullable().optional(),
  transitionEventDate: z.string().nullable().optional(),
});
export type TemporalBasis = z.infer<typeof TemporalBasisSchema>;

/**
 * Audit trace references linking the decision to model execution logs.
 */
export const DecisionTraceIdsSchema = z.object({
  runId: z.string().optional(),
  nodeId: z.string().optional(),
  researchPlanTraceId: z.string().optional(),
  assessmentTraceId: z.string().optional(),
  proposalId: z.string().optional(),
});
export type DecisionTraceIds = z.infer<typeof DecisionTraceIdsSchema>;

/**
 * Immutable, auditable Decision Record.
 * Represents the final verified outcome produced by the deterministic decision gate.
 * Strict object validation rejects illegal extra fields (e.g. vector similarity truth scores).
 */
export const DecisionRecordSchema = z
  .object({
    recordId: z.string().min(1, { message: 'Record ID is required' }),
    claimTicketId: z.string().min(1, { message: 'Claim ticket ID is required' }),
    claimRevision: z.number().int().min(1, { message: 'Claim revision must be >= 1' }),
    appliedPolicy: z.string().min(1, { message: 'Applied policy is required' }),
    verdict: VerdictSchema,
    score: z.union([z.literal(100), z.literal(75), z.literal(0), z.null()]),
    reasonCode: z.string().min(1, { message: 'Reason code is required' }),
    scoreReason: z.string().min(1, { message: 'Score reason is required' }),
    primaryEvidenceIds: z.array(z.string()).default([]),
    counterEvidenceIds: z.array(z.string()).default([]),
    excludedEvidence: z.array(ExcludedEvidenceItemSchema).default([]),
    extractedQualifiers: z.array(VerificationPropertySchema).default([]),
    temporalBasis: TemporalBasisSchema,
    limitations: z.array(z.string()).default([]),
    traceIds: DecisionTraceIdsSchema.default({}),
    verifiedAt: IsoTimestampSchema.optional(),
  })
  .strict()
  .superRefine((rec, ctx) => {
    // 1. Enforce documented verdict / score rubric
    validateAssessedVerdictScore(
      {
        verdict: rec.verdict,
        score: rec.score,
        scoreReason: rec.scoreReason,
        reasonCode: rec.reasonCode,
      },
      ctx
    );

    // 2. Verdicts granting support, contradiction, or obsolescence require primary evidence
    if (
      (rec.verdict === 'supported' ||
        rec.verdict === 'contradicted' ||
        rec.verdict === 'outdated') &&
      rec.primaryEvidenceIds.length === 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['primaryEvidenceIds'],
        message: `Verdict '${rec.verdict}' requires at least one primaryEvidenceId`,
      });
    }
  });

export type DecisionRecord = z.infer<typeof DecisionRecordSchema>;

/**
 * Pure aggregate validation boundary for DecisionRecord references:
 * - Ensures bound ClaimTicket exists and revision matches.
 * - Ensures all referenced primaryEvidenceIds and counterEvidenceIds exist in assessments with matching claim and revision.
 * - Ensures each referenced assessment points to a known EvidenceUnit.
 * - If verdict is 'outdated', ensures at least one primary assessment provides historical evidence.
 */
export function validateDecisionRecordReferences(
  record: DecisionRecord,
  assessments: ClaimEvidenceAssessment[],
  evidenceUnits: EvidenceUnit[],
  claims: ClaimTicket[]
): { valid: boolean; reason?: string } {
  // 1. Claim existence & revision match
  const matchingClaim = claims.find((c) => c.ticketId === record.claimTicketId);
  if (!matchingClaim) {
    return {
      valid: false,
      reason: `Claim ticket '${record.claimTicketId}' not found in known claim tickets`,
    };
  }

  if (matchingClaim.revision !== record.claimRevision) {
    return {
      valid: false,
      reason: `Claim ticket revision mismatch: claim is revision ${matchingClaim.revision}, but decision evaluated revision ${record.claimRevision}`,
    };
  }

  // 2. Index assessments and evidence units
  const assessmentMap = new Map<string, ClaimEvidenceAssessment>();
  for (const asm of assessments) {
    assessmentMap.set(asm.assessmentId, asm);
  }

  const evidenceMap = new Map<string, EvidenceUnit>();
  for (const evi of evidenceUnits) {
    evidenceMap.set(evi.evidenceId, evi);
  }

  // 3. Verify primary evidence assessments
  const allReferencedAsmIds = [...record.primaryEvidenceIds, ...record.counterEvidenceIds];
  for (const asmId of allReferencedAsmIds) {
    const asm = assessmentMap.get(asmId);
    if (!asm) {
      return {
        valid: false,
        reason: `Referenced assessment '${asmId}' not found in assessments`,
      };
    }

    if (asm.claimTicketId !== record.claimTicketId) {
      return {
        valid: false,
        reason: `Assessment '${asmId}' belongs to claim '${asm.claimTicketId}', not decision claim '${record.claimTicketId}'`,
      };
    }

    if (asm.claimRevision !== record.claimRevision) {
      return {
        valid: false,
        reason: `Assessment '${asmId}' evaluated revision ${asm.claimRevision}, not decision revision ${record.claimRevision}`,
      };
    }

    // Verify underlying EvidenceUnit exists
    if (!evidenceMap.has(asm.evidenceId)) {
      return {
        valid: false,
        reason: `Assessment '${asmId}' references unknown EvidenceUnit '${asm.evidenceId}'`,
      };
    }
  }

  // 4. Outdated verdict structural prerequisite: at least one primary assessment must be historical
  if (record.verdict === 'outdated') {
    const hasHistoricalSupport = record.primaryEvidenceIds.some((id) => {
      const asm = assessmentMap.get(id);
      return (
        asm &&
        (asm.relationship === 'historical_state' ||
          asm.temporalApplicability === 'historical_prior')
      );
    });

    if (!hasHistoricalSupport) {
      return {
        valid: false,
        reason: "Verdict 'outdated' requires at least one primary assessment demonstrating historical validity",
      };
    }
  }

  return { valid: true };
}
