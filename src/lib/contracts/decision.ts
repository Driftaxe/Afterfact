import { z } from 'zod';
import {
  ClaimTicket,
  ClaimTicketSchema,
  VerificationPropertySchema,
} from './claim-ticket';
import {
  CalendarDateOrPartialDateSchema,
  CalendarDateOrTimestampSchema,
  IsoTimestampSchema,
} from './dates';
import {
  ClaimEvidenceAssessment,
  ClaimEvidenceAssessmentSchema,
  EvidenceUnit,
  EvidenceUnitSchema,
  SourceDocumentSchema,
} from './evidence-objects';
import { SourceRoleSchema } from './research';
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
    'insufficient_authority',
    'unverified_context',
    'incomplete_property_match',
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

// =============================================================================
// Decision Input Handoff & Policy Contracts
// =============================================================================
//
// A05 is a pure deterministic decision boundary. It cannot re-run A04, call a
// model, or infer semantic facts. The contracts below are the minimal typed
// handoff that lets the caller supply the facts a decision gate actually needs:
//
// - What role each claim property plays (scope qualifier vs asserted value).
// - Whether structural context used by A04 belongs to the quotation.
// - Whether the evidence is valid now, only historically, only prospectively,
//   or only by publication date.
// - Why a source is authoritative *for this claim*, beyond a role label.
// - A documented supersession chain, when the caller claims a transition.
// - Material research obligations and coverage limitations still outstanding.
//
// Missing facts are represented as `unknown`/absent and are treated
// conservatively. They never silently become "grounded", "complete",
// "authoritative", "matching", or "current".

/**
 * Role of a claim property in the proposition under test.
 * Roles are claim-dependent; a date or version can be scope in one claim and
 * the asserted value in another. Callers (A06/domain policy) must declare them.
 */
export const PropertyRoleSchema = z.enum(['scope_qualifier', 'asserted_value']);
export type PropertyRole = z.infer<typeof PropertyRoleSchema>;

export const DecisionPropertyRoleSchema = z.object({
  key: z.string().min(1),
  role: PropertyRoleSchema,
  /**
   * When true (default), a claim property that evidence does not mention is a
   * material gap. Mark a qualifier optional only when its absence genuinely
   * cannot change the proposition's truth.
   */
  required: z.boolean().default(true),
});
export type DecisionPropertyRole = z.infer<typeof DecisionPropertyRoleSchema>;

/**
 * Explicit temporal meaning of the claim itself, separate from the verification
 * target time. `assertedTime` may be partial (e.g. "2021") to preserve the
 * source's precision. `intervalSemantics` distinguishes an existential claim
 * ("at some point in 2023") from a throughout-the-period claim.
 */
export const ClaimTemporalScopeSchema = z
  .object({
    quantifier: z.enum(['current', 'historical']).default('current'),
    assertedTime: CalendarDateOrPartialDateSchema.nullable().optional(),
    intervalSemantics: z.enum(['existential', 'throughout']).default('existential'),
  })
  .superRefine((scope, ctx) => {
    if (scope.quantifier === 'historical' && !scope.assertedTime) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['assertedTime'],
        message: "Historical claim scope requires an assertedTime",
      });
    }
  });
export type ClaimTemporalScope = z.infer<typeof ClaimTemporalScopeSchema>;

/**
 * Whether A04's structural context (headers, table labels, footnotes) was
 * verified as belonging to the actual quotation.
 *
 * - `quotation_only`: decisive meaning does not depend on structural context.
 * - `verified_context`: structural context was verified for this quotation.
 * - `unverified_context`: structural context exists but association is unproven.
 * - `unknown`: producer did not declare the basis.
 *
 * A05 treats `unverified_context` and `unknown` as insufficient for an
 * independent decisive verdict. It does not try to re-parse the document.
 */
export const AssessmentContextBasisSchema = z.enum([
  'quotation_only',
  'verified_context',
  'unverified_context',
  'unknown',
]);
export type AssessmentContextBasis = z.infer<typeof AssessmentContextBasisSchema>;

export const AssessmentGroundingSchema = z.object({
  assessmentId: z.string().min(1),
  contextBasis: AssessmentContextBasisSchema,
  limitations: z.array(z.string()).default([]),
});
export type AssessmentGrounding = z.infer<typeof AssessmentGroundingSchema>;

/**
 * Why the evidence is temporally applicable.
 * A model temporal label or an old effective-start date alone is not enough.
 */
export const TemporalProofBasisSchema = z.enum([
  'current_validity_confirmed',       // source explicitly establishes the state at target time
  'historical_interval_confirmed',    // source applies within a known historical interval
  'effective_start_only',             // only an effective start is known; continued validity unproven
  'publication_only',                 // only a publication date exists; event/effective time unknown
  'future_effective',                 // change is announced for a future effective date
  'unknown',
]);
export type TemporalProofBasis = z.infer<typeof TemporalProofBasisSchema>;

export const EvidenceTemporalProofSchema = z
  .object({
    evidenceId: z.string().min(1),
    basis: TemporalProofBasisSchema,
    /**
     * Required for `historical_interval_confirmed`: the interval the evidence
     * actually supports. The existing temporal helper parses these bounds.
     */
    applicableInterval: z
      .object({
        start: CalendarDateOrTimestampSchema,
        end: CalendarDateOrTimestampSchema,
      })
      .nullable()
      .optional(),
  })
  .superRefine((proof, ctx) => {
    if (proof.basis === 'historical_interval_confirmed') {
      if (!proof.applicableInterval) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['applicableInterval'],
          message: "Temporal proof 'historical_interval_confirmed' requires an applicableInterval",
        });
      } else if (proof.applicableInterval.start > proof.applicableInterval.end) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['applicableInterval', 'start'],
          message: 'applicableInterval.start must be on or before applicableInterval.end',
        });
      }
    }
  });
export type EvidenceTemporalProof = z.infer<typeof EvidenceTemporalProofSchema>;

/**
 * Structured provenance basis for source authority, separate from
 * `SourceDocument.sourceRole` and `ClaimEvidenceAssessment.sourceSuitability`.
 * `claimApplicability` is the claim-specific fact A06 must supply; a role label
 * alone never wins 100.
 */
export const AuthorityBasisSchema = z.enum([
  'official_primary_record',
  'regulatory_filing',
  'official_changelog',
  'independent_secondary_report',
  'unknown',
]);
export type AuthorityBasis = z.infer<typeof AuthorityBasisSchema>;

export const SourceAuthorityFactSchema = z.object({
  documentId: z.string().min(1),
  basis: AuthorityBasisSchema,
  claimApplicability: z.enum(['applicable', 'not_applicable', 'unknown']),
});
export type SourceAuthorityFact = z.infer<typeof SourceAuthorityFactSchema>;

/**
 * Documented supersession chain supplied by a trusted caller.
 * Two differently dated values alone are not a transition; the caller must
 * name the prior-validity evidence, the superseding evidence, the effective
 * date, and the scope/entity match already resolved upstream.
 */
export const TransitionBasisSchema = z.enum([
  'documented_effective_change',
  'announced_future_change',
  'unknown',
]);
export type TransitionBasis = z.infer<typeof TransitionBasisSchema>;

export const TransitionProofSchema = z.object({
  transitionId: z.string().min(1),
  claimTicketId: z.string().min(1),
  claimRevision: z.number().int().min(1),
  priorAssessmentId: z.string().min(1),
  supersedingAssessmentId: z.string().min(1),
  effectiveDate: CalendarDateOrTimestampSchema,
  entityAndScopeMatch: z.enum(['match', 'mismatch', 'unknown']),
  basis: TransitionBasisSchema,
});
export type TransitionProof = z.infer<typeof TransitionProofSchema>;

/**
 * Material research obligations still outstanding. `researchComplete` is an
 * explicit assertion by the trusted caller; it is never inferred from the
 * presence of evidence.
 *
 * An obligation is scoped either to the claim as a whole (`claim`) or to a
 * bounded set of assessments (`evidence`). A material unresolved obligation
 * blocks only the support it actually affects; an evidence-scope obligation
 * with no affected assessment IDs is treated as claim-wide because the
 * affected set is unknown. `resolutionBasis` records why a satisfied
 * obligation is considered resolved; a bare boolean is not enough.
 */
export const CoverageObligationScopeSchema = z.enum(['claim', 'evidence']);
export type CoverageObligationScope = z.infer<typeof CoverageObligationScopeSchema>;

export const CoverageObligationSchema = z
  .object({
    obligationId: z.string().min(1),
    description: z.string().min(1),
    status: z.enum(['satisfied', 'unresolved', 'not_required']),
    material: z.boolean().default(true),
    scope: CoverageObligationScopeSchema.default('claim'),
    affectedAssessmentIds: z.array(z.string().min(1)).default([]),
    resolvedByAssessmentIds: z.array(z.string().min(1)).default([]),
    resolutionBasis: z.string().min(1).nullable().optional(),
  })
  .superRefine((obligation, ctx) => {
    if (
      obligation.status !== 'satisfied' &&
      obligation.resolvedByAssessmentIds.length > 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['resolvedByAssessmentIds'],
        message: 'Only a satisfied coverage obligation may name resolvedByAssessmentIds',
      });
    }
    if (
      obligation.status === 'satisfied' &&
      obligation.resolvedByAssessmentIds.length > 0 &&
      !obligation.resolutionBasis
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['resolutionBasis'],
        message: 'A satisfied obligation that names resolving assessments requires a resolutionBasis',
      });
    }
  });
export type CoverageObligation = z.infer<typeof CoverageObligationSchema>;

export const RejectedEvidenceCandidateSchema = z.object({
  evidenceId: z.string().min(1),
  reason: z.enum([
    'ungrounded',
    'wrong_scope',
    'insufficient_authority',
    'extraction_failure',
    'duplicate',
    'unrelated',
    'other',
  ]),
  material: z.boolean().default(false),
});
export type RejectedEvidenceCandidate = z.infer<typeof RejectedEvidenceCandidateSchema>;

export const DecisionCoverageSchema = z.object({
  researchComplete: z.boolean(),
  obligations: z.array(CoverageObligationSchema).default([]),
  rejectedCandidates: z.array(RejectedEvidenceCandidateSchema).default([]),
  budgetExhausted: z.boolean().default(false),
  limitations: z.array(z.string()).default([]),
});
export type DecisionCoverage = z.infer<typeof DecisionCoverageSchema>;

/**
 * Small typed policy input. A06 can narrow source roles or declare property
 * roles; the generic default is intentionally conservative.
 */
export const DecisionPolicySchema = z.object({
  policyId: z.string().min(1).default('generic'),
  policyVersion: z.string().min(1).default('1.0.0'),
  propertyRoles: z.array(DecisionPropertyRoleSchema).default([]),
  authoritativeSourceRoles: z
    .array(SourceRoleSchema)
    .default(['primary_authority', 'regulatory_filing', 'official_changelog']),
});
export type DecisionPolicy = z.infer<typeof DecisionPolicySchema>;

/**
 * Complete aggregate consumed by the deterministic decision boundary.
 * Assessments alone are insufficient: grounding, temporal proof, authority,
 * coverage, and any transition claim are explicit inputs.
 */
export const DecideClaimInputSchema = z.object({
  ticket: ClaimTicketSchema,
  assessments: z.array(ClaimEvidenceAssessmentSchema),
  evidenceUnits: z.array(EvidenceUnitSchema),
  sourceDocuments: z.array(SourceDocumentSchema),
  claimTemporalScope: ClaimTemporalScopeSchema.default({
    quantifier: 'current',
    intervalSemantics: 'existential',
  }),
  assessmentGrounding: z.array(AssessmentGroundingSchema).default([]),
  evidenceTemporalProofs: z.array(EvidenceTemporalProofSchema).default([]),
  sourceAuthority: z.array(SourceAuthorityFactSchema).default([]),
  transitions: z.array(TransitionProofSchema).default([]),
  coverage: DecisionCoverageSchema,
  policy: DecisionPolicySchema.default({
    policyId: 'generic',
    policyVersion: '1.0.0',
    propertyRoles: [],
    authoritativeSourceRoles: ['primary_authority', 'regulatory_filing', 'official_changelog'],
  }),
  /**
   * Injected by the caller so the pure decision path never calls Date.now().
   */
  decidedAt: IsoTimestampSchema,
  traceIds: DecisionTraceIdsSchema.optional(),
});
export type DecideClaimInput = z.infer<typeof DecideClaimInputSchema>;

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
