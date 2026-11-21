import type { ClaimTicket } from '@/lib/contracts/claim-ticket';
import type { SourceDocument } from '@/lib/contracts/evidence-objects';
import type {
  CoverageObligation,
  DecisionPolicy,
  DecisionPropertyRole,
  SourceAuthorityFact,
} from '@/lib/contracts/decision';
import type {
  ClarificationQuestion,
  ClarificationQuestionSet,
} from '@/lib/contracts/clarification';
import {
  MAX_CLARIFICATION_ROUNDS,
  type AuthorityQualificationOptions,
  type ClarificationPlanResult,
  type ClarificationPlanningOptions,
  type DomainPolicyModule,
  type PolicyResolutionOptions,
  type SemanticIntentFacts,
} from './types';

// Canonical policy implementation for generic claims

export class GenericPolicy implements DomainPolicyModule {
  public readonly domainId = 'generic' as const;
  public readonly version = '1.0.0';

  public matches(ticket: ClaimTicket, semanticFacts?: SemanticIntentFacts): boolean {
    void ticket;
    void semanticFacts;
    // Generic policy serves as the universal fallback for all claims
    return true;
  }

  public resolvePolicy(
    ticket: ClaimTicket,
    options?: PolicyResolutionOptions
  ): DecisionPolicy {
    const semantic = options?.semanticFacts;
    const propertyRoles: DecisionPropertyRole[] = [];
    const props = ticket.verificationContext;

    // Check optional binding if semantic facts specify claimId/revision
    const isBindingValid =
      (!semantic?.claimId || semantic.claimId === ticket.claimId) &&
      (!semantic?.revision || semantic.revision === ticket.revision);

    const explicitAsserted = new Set(
      isBindingValid ? (semantic?.assertedPropertyKeys ?? []) : []
    );
    const explicitScope = new Set(
      isBindingValid ? (semantic?.scopeQualifierKeys ?? []) : []
    );
    const explicitOptional = new Set(
      isBindingValid ? (semantic?.optionalPropertyKeys ?? []) : []
    );

    for (const prop of props) {
      let role: 'scope_qualifier' | 'asserted_value' | null = null;
      let required = true;

      // 1. Role determination (order-independent):
      if (prop.role === 'asserted_value' || prop.role === 'scope_qualifier') {
        role = prop.role;
      } else if (explicitAsserted.has(prop.key)) {
        role = 'asserted_value';
      } else if (explicitScope.has(prop.key)) {
        role = 'scope_qualifier';
      }

      // If semantic role is undetermined: do NOT guess based on array position!
      // Only include properties with deterministically known roles in propertyRoles.
      if (role !== null) {
        // Essentiality rules:
        if (explicitOptional.has(prop.key)) {
          required = false;
        } else if (
          prop.origin === 'model_inferred' &&
          !ticket.missingMaterialContext.includes(prop.key)
        ) {
          required = false;
        } else if (prop.origin === 'explicit_claim_text') {
          required = true;
        }

        propertyRoles.push({
          key: prop.key,
          role,
          required,
        });
      }
    }

    return {
      policyId: this.domainId,
      policyVersion: options?.policyVersion ?? this.version,
      propertyRoles,
      authoritativeSourceRoles: options?.customAuthoritativeRoles ?? [
        'primary_authority',
        'regulatory_filing',
        'official_changelog',
        'reputable_secondary',
      ],
    };
  }

  public qualifySourceAuthority(
    ticket: ClaimTicket,
    documents: SourceDocument[],
    options?: AuthorityQualificationOptions
  ): SourceAuthorityFact[] {
    const provenanceMap = options?.provenanceMap ?? {};
    const facts: SourceAuthorityFact[] = [];

    for (const doc of documents) {
      const prov = provenanceMap[doc.documentId];

      // Rule: Missing provenance record leaves authority unknown
      if (!prov) {
        facts.push({
          documentId: doc.documentId,
          basis: 'unknown',
          claimApplicability: 'unknown',
        });
        continue;
      }

      // Rule: Validate claim and revision binding if supplied on provenance record
      if (
        (prov.claimId && prov.claimId !== ticket.claimId) ||
        (prov.revision && prov.revision !== ticket.revision)
      ) {
        facts.push({
          documentId: doc.documentId,
          basis: prov.basis,
          claimApplicability: 'not_applicable',
        });
        continue;
      }

      // Rule: Explicit non-applicable provenance fails closed
      if (prov.claimApplicability === 'not_applicable') {
        facts.push({
          documentId: doc.documentId,
          basis: prov.basis,
          claimApplicability: 'not_applicable',
        });
        continue;
      }

      // Rule: Primary Authority Qualification
      const isPrimaryRole =
        (prov.basis === 'official_primary_record' && doc.sourceRole === 'primary_authority') ||
        (prov.basis === 'regulatory_filing' && doc.sourceRole === 'regulatory_filing') ||
        (prov.basis === 'official_changelog' && doc.sourceRole === 'official_changelog');

      if (isPrimaryRole) {
        // Entity match and claim applicability are required for primary qualification
        if (!prov.entityMatch) {
          facts.push({
            documentId: doc.documentId,
            basis: prov.basis,
            claimApplicability: 'not_applicable',
          });
          continue;
        }

        // Marketing superlatives on comparative claims cannot serve as primary authority
        if (prov.isSelfPromotional === true || prov.attributesCovered?.includes('marketing_superlative')) {
          facts.push({
            documentId: doc.documentId,
            basis: prov.basis,
            claimApplicability: 'not_applicable',
          });
          continue;
        }

        facts.push({
          documentId: doc.documentId,
          basis: prov.basis,
          claimApplicability: prov.claimApplicability ?? 'applicable',
        });
        continue;
      }

      // Rule: Secondary Authority Qualification
      if (
        prov.basis === 'independent_secondary_report' &&
        doc.sourceRole === 'reputable_secondary'
      ) {
        if (prov.isIndependentSecondary === true) {
          facts.push({
            documentId: doc.documentId,
            basis: 'independent_secondary_report',
            claimApplicability: 'applicable',
          });
        } else {
          facts.push({
            documentId: doc.documentId,
            basis: 'independent_secondary_report',
            claimApplicability: 'unknown',
          });
        }
        continue;
      }

      // Non-matching source role / unverified basis
      facts.push({
        documentId: doc.documentId,
        basis: prov.basis,
        claimApplicability: 'unknown',
      });
    }

    return facts;
  }

  public planClarification(
    ticket: ClaimTicket,
    options?: ClarificationPlanningOptions
  ): ClarificationPlanResult {
    const round = options?.round ?? 1;

    // Check invalid round counter input
    if (typeof round !== 'number' || !Number.isInteger(round) || round < 1) {
      return {
        status: 'invalid_input',
        reason: `Clarification round must be a positive integer, received: ${round}`,
      };
    }

    const missingKeys = new Set(ticket.missingMaterialContext);

    const questions: ClarificationQuestion[] = [];

    for (const key of missingKeys) {
      const explicitProp = ticket.verificationContext.find(
        (p) => (p.key === key || (key === 'asOfDate' && p.key === 'targetDate')) &&
               (p.origin === 'explicit_claim_text' || p.origin === 'user_target_context')
      );

      // If an explicit value is present and fully specific (not a coarse partial date like YYYY), skip
      if (explicitProp && explicitProp.value !== null) {
        const strVal = String(explicitProp.value);
        const isTemporalKey =
          key.toLowerCase().includes('date') ||
          key.toLowerCase().includes('time') ||
          key.toLowerCase().includes('month') ||
          key === 'year';
        // DEF-004 Fix: Only require finer precision than year/month when timeSensitivity is high (fast-moving releases)
        // and the claim is not a low-cadence historical fact.
        const requiresFinePrecision = ticket.timeSensitivity === 'high' && ticket.domain !== 'historical';
        if (!isTemporalKey || strVal.length > 7 || !requiresFinePrecision) {
          continue;
        }
      }

      const isDateQuestion =
        key.toLowerCase().includes('date') ||
        key.toLowerCase().includes('time') ||
        key.toLowerCase().includes('month') ||
        key === 'year';

      questions.push({
        questionId: `q_generic_${key}_${ticket.ticketId}`,
        propertyKey: key,
        prompt: isDateQuestion
          ? `Please specify the exact target month or date (e.g. YYYY-MM or YYYY-MM-DD) for this assertion:`
          : `Please specify the ${key.replace(/_/g, ' ')} for this assertion:`,
        reason: isDateQuestion
          ? `The assertion references a broad timeframe, but verifying recency requires specific month or date precision.`
          : `Verification outcome depends on knowing the specific ${key.replace(/_/g, ' ')}.`,
        fieldType: 'short_text',
        required: true,
        allowUnknown: true,
        constraints: {
          maxLength: 60,
        },
      });
    }

    // 1. If no material gap exists -> clarification not needed
    if (questions.length === 0) {
      return {
        status: 'not_needed',
        reason: 'All material user-context qualifiers are established; no clarification required.',
      };
    }

    // 2. If material context is missing but rounds are exhausted (> MAX_CLARIFICATION_ROUNDS)
    if (round > MAX_CLARIFICATION_ROUNDS) {
      return {
        status: 'rounds_exhausted',
        unresolvedFields: Array.from(missingKeys),
        reason: `Maximum clarification rounds (${MAX_CLARIFICATION_ROUNDS}) reached with unresolved material context.`,
        roundsAttempted: round - 1,
      };
    }

    // 3. Questions planned within round bounds
    const runId = options?.runId ?? 'run_clarify';
    const questionSetId = options?.questionSetId ?? `qs_${ticket.ticketId}_${round}`;

    const questionSet: ClarificationQuestionSet = {
      questionSetId,
      runId,
      revision: ticket.revision,
      round,
      questions,
    };

    return {
      status: 'questions_planned',
      questionSet,
    };
  }

  public buildResearchObligations(
    ticket: ClaimTicket
  ): CoverageObligation[] {
    return [
      {
        obligationId: `obl_generic_primary_${ticket.ticketId}`,
        description: 'Locate primary authoritative evidence or official publication establishing the asserted proposition.',
        status: 'unresolved',
        material: true,
        scope: 'claim',
        affectedAssessmentIds: [],
        resolvedByAssessmentIds: [],
      },
    ];
  }
}
