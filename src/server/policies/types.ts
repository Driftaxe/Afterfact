import { z } from 'zod';
import type { ClaimTicket } from '@/lib/contracts/claim-ticket';
import type { SourceDocument } from '@/lib/contracts/evidence-objects';
import type { SourceRole } from '@/lib/contracts/research';
import type {
  AuthorityBasis,
  CoverageObligation,
  DecisionPolicy,
  SourceAuthorityFact,
} from '@/lib/contracts/decision';
import type { ClarificationQuestionSet } from '@/lib/contracts/clarification';

/**
 * Maximum permitted rounds for user clarification.
 * Round 1: Initial clarification questions.
 * Round 2: Second and final clarification questions.
 * Beyond round 2: Rounds are exhausted.
 */
export const MAX_CLARIFICATION_ROUNDS = 2;

/**
 * Discriminated outcome of clarification planning.
 * Explicitly distinguishes between:
 * 1. 'not_needed': All essential context is present.
 * 2. 'questions_planned': Material user context is missing and rounds remain available.
 * 3. 'rounds_exhausted': Material user context remains missing after allowed rounds.
 * 4. 'invalid_input': Malformed round counter, invalid revision, or malformed ticket.
 */
export type ClarificationPlanResult =
  | {
      status: 'not_needed';
      reason: string;
    }
  | {
      status: 'questions_planned';
      questionSet: ClarificationQuestionSet;
    }
  | {
      status: 'rounds_exhausted';
      unresolvedFields: string[];
      reason: string;
      roundsAttempted: number;
    }
  | {
      status: 'invalid_input';
      reason: string;
    };

/**
 * Structured semantic facts that may be supplied upstream by claim extraction (A03)
 * or user preparation review. A06 uses these facts when available instead of guessing.
 */
export interface SemanticIntentFacts {
  /**
   * Optional binding to ticket claimId and revision to reject stale semantic facts.
   */
  claimId?: string;
  revision?: number;

  /**
   * Explicit keys of properties that represent the proposition's asserted fact/value
   * rather than scope conditions.
   */
  assertedPropertyKeys?: string[];

  /**
   * Explicit keys of properties that represent scope/qualifier boundaries.
   */
  scopeQualifierKeys?: string[];

  /**
   * Explicit keys of properties whose absence does not materially alter the proposition.
   */
  optionalPropertyKeys?: string[];

  /**
   * Set true when retrieval or candidate evaluation demonstrates that different
   * plausible values of an unstated qualifier produce differing factual outcomes.
   */
  disagreementsAcrossValues?: boolean;

  /**
   * Specific domain hint if explicitly established upstream.
   */
  domainHint?: 'pricing' | 'api' | 'regulation' | 'leadership' | 'generic';
}

/**
 * Provenance verification facts supplied by platform retrieval or identity resolvers (B03/A04).
 * A06 uses this structured record to qualify authority without relying on superficial URL matching.
 *
 * TRUST BOUNDARY: This is an internal typed boundary for verified platform metadata.
 * It is not proof that arbitrary caller-submitted client metadata is true.
 */
export interface ProvenanceFact {
  documentId: string;
  claimId?: string;
  revision?: number;
  verifiedPublisher?: string;
  verifiedDomain?: string;
  basis: AuthorityBasis;
  /**
   * Whether the publisher is verified to be the specific entity or competent authority for the claim.
   */
  entityMatch: boolean;
  /**
   * Explicit assertion applicability:
   * - 'applicable': source directly addresses the claimed entity, property, and assertion.
   * - 'not_applicable': source is authentic but irrelevant or out-of-scope for this assertion.
   * - 'unknown': applicability has not been established.
   */
  claimApplicability?: 'applicable' | 'not_applicable' | 'unknown';
  /**
   * Specific attributes or topics covered by this document (e.g. ['pricing', 'plan_tier']).
   */
  attributesCovered?: string[];
  /**
   * For secondary reports: whether editorial independence and reputability have been verified.
   */
  isIndependentSecondary?: boolean;
  /**
   * Whether the document content contains promotional self-claims (e.g. marketing superlatives).
   */
  isSelfPromotional?: boolean;
}

export interface PolicyResolutionOptions {
  semanticFacts?: SemanticIntentFacts;
  policyVersion?: string;
  customAuthoritativeRoles?: SourceRole[];
}

export interface AuthorityQualificationOptions {
  provenanceMap?: Record<string, ProvenanceFact>;
}

export interface ClarificationPlanningOptions {
  runId?: string;
  /**
   * Current round number being attempted (1-indexed).
   * 1: First clarification attempt.
   * 2: Second clarification attempt.
   * > 2: Exceeds MAX_CLARIFICATION_ROUNDS.
   */
  round?: number;
  questionSetId?: string;
  semanticFacts?: SemanticIntentFacts;
}

export interface ObligationPlanningOptions {
  claimScopeOnly?: boolean;
}

/**
 * Contract implemented by every domain policy module.
 */
export interface DomainPolicyModule {
  readonly domainId: 'pricing' | 'api' | 'regulation' | 'leadership' | 'generic';
  readonly version: string;

  /**
   * Checks whether this policy module should govern the given claim ticket.
   */
  matches(ticket: ClaimTicket, semanticFacts?: SemanticIntentFacts): boolean;

  /**
   * Resolves the DecisionPolicy configuration for A05, declaring property roles
   * strictly for properties actually present on the ticket.
   */
  resolvePolicy(ticket: ClaimTicket, options?: PolicyResolutionOptions): DecisionPolicy;

  /**
   * Evaluates retrieved source documents and provenance facts to produce
   * SourceAuthorityFact records for A05.
   */
  qualifySourceAuthority(
    ticket: ClaimTicket,
    documents: SourceDocument[],
    options?: AuthorityQualificationOptions
  ): SourceAuthorityFact[];

  /**
   * Evaluates whether material missing context requires user clarification,
   * returning an explicit ClarificationPlanResult.
   */
  planClarification(
    ticket: ClaimTicket,
    options?: ClarificationPlanningOptions
  ): ClarificationPlanResult;

  /**
   * Defines applicable research obligations for this domain.
   * Emitted obligations have status 'unresolved' or 'not_required'; A06 never
   * falsely marks an obligation 'satisfied'.
   */
  buildResearchObligations(
    ticket: ClaimTicket,
    options?: ObligationPlanningOptions
  ): CoverageObligation[];
}

/**
 * Input for the unified evaluatePolicy service.
 */
export interface EvaluatePolicyInput {
  ticket: ClaimTicket;
  documents?: SourceDocument[];
  provenanceMap?: Record<string, ProvenanceFact>;
  clarificationState?: {
    runId?: string;
    /**
     * Current round number being attempted (1-indexed).
     */
    round?: number;
    questionSetId?: string;
  };
  semanticFacts?: SemanticIntentFacts;
  policyOptions?: PolicyResolutionOptions;
}

export const PolicyEvaluationStatusSchema = z.enum([
  'ready',                      // Complete policy, authority, and obligations ready for A05
  'clarification_needed',       // Material essential qualifier is missing; question set emitted
  'clarification_exhausted',    // Material context remains missing after max clarification rounds
  'unresolved_prerequisites',   // Provenance or semantic role prerequisites are undetermined
  'invalid_input',              // Malformed ticket, round counter, or conflicting configuration
]);
export type PolicyEvaluationStatus = z.infer<typeof PolicyEvaluationStatusSchema>;

/**
 * Comprehensive evaluated output ready to feed into A05 decideClaim.
 */
export interface PolicyEvaluationResult {
  status: PolicyEvaluationStatus;
  selectedDomain: 'pricing' | 'api' | 'regulation' | 'leadership' | 'generic';
  policyVersion: string;
  policy: DecisionPolicy;
  authorityFacts: SourceAuthorityFact[];
  obligations: CoverageObligation[];
  clarification: ClarificationPlanResult;
  unresolvedRoles?: string[];
  limitations: string[];
  issues?: Array<{ code: string; message: string }>;
}
