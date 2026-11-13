import { ClaimTicketSchema, type ClaimTicket } from '@/lib/contracts/claim-ticket';
import type { SourceDocument } from '@/lib/contracts/evidence-objects';
import type {
  CoverageObligation,
  DecisionPolicy,
  SourceAuthorityFact,
} from '@/lib/contracts/decision';

import type {
  AuthorityQualificationOptions,
  ClarificationPlanResult,
  ClarificationPlanningOptions,
  DomainPolicyModule,
  EvaluatePolicyInput,
  ObligationPlanningOptions,
  PolicyEvaluationResult,
  PolicyResolutionOptions,
  SemanticIntentFacts,
} from './types';

import { PricingPolicy } from './pricing';
import { ApiPolicy } from './api';
import { RegulationPolicy } from './regulation';
import { LeadershipPolicy } from './leadership';
import { GenericPolicy } from './generic';

// Export policy singletons
export const pricingPolicy = new PricingPolicy();
export const apiPolicy = new ApiPolicy();
export const regulationPolicy = new RegulationPolicy();
export const leadershipPolicy = new LeadershipPolicy();
export const genericPolicy = new GenericPolicy();

export const SPECIALIZED_POLICIES: DomainPolicyModule[] = [
  pricingPolicy,
  apiPolicy,
  regulationPolicy,
  leadershipPolicy,
];

/**
 * Resolves the governing domain policy module for a given ClaimTicket.
 *
 * Selection Rules:
 * 1. Honors explicit `semanticFacts.domainHint` if supplied upstream.
 * 2. Evaluates specialized policies (Pricing, APIs, Regulation, Leadership).
 * 3. If multiple specialized policies match with equal strength without clear intent,
 *    falls back to GenericPolicy rather than arbitrarily favoring one domain.
 * 4. Falls back to GenericPolicy for unfamiliar domains; never rejects a claim
 *    solely because no specialized policy exists.
 */
export function resolveDomainPolicy(
  ticket: ClaimTicket,
  semanticFacts?: SemanticIntentFacts
): DomainPolicyModule {
  if (semanticFacts?.domainHint) {
    switch (semanticFacts.domainHint) {
      case 'pricing':
        return pricingPolicy;
      case 'api':
        return apiPolicy;
      case 'regulation':
        return regulationPolicy;
      case 'leadership':
        return leadershipPolicy;
      case 'generic':
        return genericPolicy;
    }
  }

  if (ticket.domain?.toLowerCase() === 'generic') {
    return genericPolicy;
  }

  const matchingPolicies = SPECIALIZED_POLICIES.filter((p) => p.matches(ticket, semanticFacts));

  if (matchingPolicies.length === 1) {
    return matchingPolicies[0];
  }

  if (matchingPolicies.length > 1) {
    // If ticket.domain explicitly names one of the matched policies, prioritize it
    const explicitDomain = ticket.domain?.toLowerCase();
    const exactMatch = matchingPolicies.find((p) => p.domainId === explicitDomain);
    if (exactMatch) {
      return exactMatch;
    }

    // Material conflict between multiple specialized domains -> fall back to generic
    // to preserve neutral evaluation without forcing incorrect domain constraints.
    return genericPolicy;
  }

  return genericPolicy;
}

/**
 * Generates the DecisionPolicy configuration for A05 decideClaim.
 */
export function buildDecisionPolicy(
  ticket: ClaimTicket,
  options?: PolicyResolutionOptions
): DecisionPolicy {
  const policyModule = resolveDomainPolicy(ticket, options?.semanticFacts);
  return policyModule.resolvePolicy(ticket, options);
}

/**
 * Qualifies source documents against the claim using the matched domain policy.
 */
export function qualifySourceAuthorityForClaim(
  ticket: ClaimTicket,
  documents: SourceDocument[],
  options?: AuthorityQualificationOptions
): SourceAuthorityFact[] {
  const policyModule = resolveDomainPolicy(ticket);
  return policyModule.qualifySourceAuthority(ticket, documents, options);
}

/**
 * Evaluates whether material missing context requires clarification.
 * Explicitly distinguishes 'not_needed', 'questions_planned', 'rounds_exhausted', and 'invalid_input'.
 */
export function evaluateClaimClarification(
  ticket: ClaimTicket,
  options?: ClarificationPlanningOptions
): ClarificationPlanResult {
  const policyModule = resolveDomainPolicy(ticket, options?.semanticFacts);
  return policyModule.planClarification(ticket, options);
}

/**
 * Defines research obligations for the claim.
 */
export function buildResearchObligations(
  ticket: ClaimTicket,
  options?: ObligationPlanningOptions
): CoverageObligation[] {
  const policyModule = resolveDomainPolicy(ticket);
  return policyModule.buildResearchObligations(ticket, options);
}

/**
 * Primary Unified Policy Service for Ticket A06.
 *
 * Produces validated DecisionPolicy, SourceAuthorityFact[], CoverageObligation[],
 * and explicit ClarificationPlanResult in a single atomic, deterministic evaluation.
 */
export function evaluatePolicy(input: EvaluatePolicyInput): PolicyEvaluationResult {
  const parsedTicket = ClaimTicketSchema.safeParse(input.ticket);
  if (!parsedTicket.success) {
    return {
      status: 'invalid_input',
      selectedDomain: 'generic',
      policyVersion: '1.0.0',
      policy: {
        policyId: 'generic',
        policyVersion: '1.0.0',
        propertyRoles: [],
        authoritativeSourceRoles: ['primary_authority', 'regulatory_filing', 'official_changelog'],
      },
      authorityFacts: [],
      obligations: [],
      clarification: {
        status: 'invalid_input',
        reason: 'ClaimTicket failed schema validation',
      },
      limitations: ['Invalid input: ClaimTicket failed schema validation'],
      issues: parsedTicket.error.issues.map((i) => ({
        code: i.code,
        message: `${i.path.join('.')}: ${i.message}`,
      })),
    };
  }

  const ticket = parsedTicket.data;
  const policyModule = resolveDomainPolicy(ticket, input.semanticFacts);
  const limitations: string[] = [];

  const policy = policyModule.resolvePolicy(ticket, {
    ...input.policyOptions,
    semanticFacts: input.semanticFacts ?? input.policyOptions?.semanticFacts,
  });

  const authorityFacts = policyModule.qualifySourceAuthority(
    ticket,
    input.documents ?? [],
    { provenanceMap: input.provenanceMap }
  );

  const clarification = policyModule.planClarification(ticket, {
    runId: input.clarificationState?.runId,
    round: input.clarificationState?.round,
    questionSetId: input.clarificationState?.questionSetId,
    semanticFacts: input.semanticFacts,
  });

  const obligations = policyModule.buildResearchObligations(ticket);

  // Check for unresolved property roles in generic policy
  const propertyRoleKeys = new Set(policy.propertyRoles.map((r) => r.key));
  const unresolvedRoles = ticket.verificationContext
    .filter((p) => !propertyRoleKeys.has(p.key))
    .map((p) => p.key);

  const hasAssertedValue = policy.propertyRoles.some((r) => r.role === 'asserted_value');

  let status: PolicyEvaluationResult['status'] = 'ready';

  if (clarification.status === 'invalid_input') {
    status = 'invalid_input';
    limitations.push(clarification.reason);
  } else if (clarification.status === 'questions_planned') {
    status = 'clarification_needed';
    limitations.push('Material missing context detected; clarification question set planned');
  } else if (clarification.status === 'rounds_exhausted') {
    status = 'clarification_exhausted';
    limitations.push(`Clarification rounds exhausted; missing context unresolved: ${clarification.unresolvedFields.join(', ')}`);
  } else if (unresolvedRoles.length > 0 || !hasAssertedValue) {
    status = 'unresolved_prerequisites';
    limitations.push(
      `Semantic roles undetermined for properties: [${unresolvedRoles.join(', ')}]. Upstream semantic producer (Ticket A03 claim extraction or preparation review) must supply SemanticIntentFacts declaring assertedPropertyKeys and scopeQualifierKeys.`
    );
  } else if (
    input.documents &&
    input.documents.length > 0 &&
    authorityFacts.length > 0 &&
    authorityFacts.every((f) => f.basis === 'unknown' || f.claimApplicability === 'unknown')
  ) {
    status = 'unresolved_prerequisites';
    limitations.push('Supplied documents lack verified provenance or claim applicability facts');
  }

  return {
    status,
    selectedDomain: policyModule.domainId,
    policyVersion: policyModule.version,
    policy,
    authorityFacts,
    obligations,
    clarification,
    unresolvedRoles: unresolvedRoles.length > 0 ? unresolvedRoles : undefined,
    limitations,
  };
}

export * from './types';
export * from './pricing';
export * from './api';
export * from './regulation';
export * from './leadership';
export * from './generic';
