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

const LEADERSHIP_TERMS_REGEX = /\b(ceo|chief executive|cto|cfo|coo|president|chairman|appointed|stepped down|resigned|fired|interim ceo|board of directors|executive officer)\b/i;

export class LeadershipPolicy implements DomainPolicyModule {
  public readonly domainId = 'leadership' as const;
  public readonly version = '1.0.0';

  public matches(ticket: ClaimTicket, semanticFacts?: SemanticIntentFacts): boolean {
    if (semanticFacts?.domainHint) {
      return semanticFacts.domainHint === 'leadership';
    }

    const domain = ticket.domain?.toLowerCase();
    if (domain === 'leadership' || domain === 'corporate_governance' || domain === 'executive') {
      return true;
    }

    const statement = ticket.originalStatement || ticket.normalizedProposition;
    return LEADERSHIP_TERMS_REGEX.test(statement);
  }

  public resolvePolicy(
    ticket: ClaimTicket,
    options?: PolicyResolutionOptions
  ): DecisionPolicy {
    const semantic = options?.semanticFacts;
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

    const propertyRoles: DecisionPropertyRole[] = [];

    for (const prop of ticket.verificationContext) {
      let role: 'scope_qualifier' | 'asserted_value';
      let required = true;

      if (explicitAsserted.has(prop.key)) {
        role = 'asserted_value';
      } else if (explicitScope.has(prop.key)) {
        role = 'scope_qualifier';
      } else if (
        prop.key === 'person' ||
        prop.key === 'leader_name' ||
        prop.key === 'appointee' ||
        prop.key === 'incumbent' ||
        prop.key === 'name'
      ) {
        // The person's identity is the fact being asserted
        role = 'asserted_value';
      } else if (
        prop.key === 'organization' ||
        prop.key === 'company' ||
        prop.key === 'entity' ||
        prop.key === 'office' ||
        prop.key === 'title' ||
        prop.key === 'role'
      ) {
        // The company and title define the scope/qualification
        role = 'scope_qualifier';
      } else {
        role = 'scope_qualifier';
      }

      // Essentiality rules
      if (explicitOptional.has(prop.key)) {
        required = false;
      } else if (prop.key === 'organization' || prop.key === 'company') {
        required = true;
      } else if (prop.key === 'title' || prop.key === 'office') {
        required = true;
      } else if (prop.key === 'subsidiary' || prop.key === 'division') {
        required = prop.origin === 'explicit_claim_text';
      }

      propertyRoles.push({
        key: prop.key,
        role,
        required,
      });
    }

    return {
      policyId: this.domainId,
      policyVersion: options?.policyVersion ?? this.version,
      propertyRoles,
      authoritativeSourceRoles: options?.customAuthoritativeRoles ?? [
        'regulatory_filing',
        'primary_authority',
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

      if (!prov) {
        facts.push({
          documentId: doc.documentId,
          basis: 'unknown',
          claimApplicability: 'unknown',
        });
        continue;
      }

      // Validate claim and revision binding if supplied
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

      if (prov.claimApplicability === 'not_applicable') {
        facts.push({
          documentId: doc.documentId,
          basis: prov.basis,
          claimApplicability: 'not_applicable',
        });
        continue;
      }

      // 1. Official SEC Form 8-K or statutory filing disclosing officer change
      if (prov.basis === 'regulatory_filing' && doc.sourceRole === 'regulatory_filing') {
        facts.push({
          documentId: doc.documentId,
          basis: 'regulatory_filing',
          claimApplicability: prov.entityMatch ? (prov.claimApplicability ?? 'applicable') : 'not_applicable',
        });
        continue;
      }

      // 2. Official corporate press release / investor relations notice
      if (prov.basis === 'official_primary_record' && doc.sourceRole === 'primary_authority') {
        facts.push({
          documentId: doc.documentId,
          basis: 'official_primary_record',
          claimApplicability: prov.entityMatch ? (prov.claimApplicability ?? 'applicable') : 'not_applicable',
        });
        continue;
      }

      // 3. Independent reputable business news wires (Reuters, Bloomberg, WSJ)
      if (
        prov.basis === 'independent_secondary_report' &&
        doc.sourceRole === 'reputable_secondary'
      ) {
        facts.push({
          documentId: doc.documentId,
          basis: 'independent_secondary_report',
          claimApplicability: prov.isIndependentSecondary === true ? 'applicable' : 'unknown',
        });
        continue;
      }

      facts.push({
        documentId: doc.documentId,
        basis: prov.basis,
        claimApplicability: 'not_applicable',
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
    const existingExplicitKeys = new Set(
      ticket.verificationContext
        .filter((p) => p.origin === 'explicit_claim_text')
        .map((p) => p.key)
    );

    const questions: ClarificationQuestion[] = [];

    // Invariant: In leadership claims, ask ONLY for missing user scope qualifiers (organization entity, division).
    // NEVER ask the user who the leader is (that is what Afterfact is verifying).
    if (missingKeys.has('organization') && !existingExplicitKeys.has('organization')) {
      questions.push({
        questionId: `q_org_${ticket.ticketId}`,
        propertyKey: 'organization',
        prompt: 'Which specific company, subsidiary, or organization does this leadership assertion apply to?',
        reason: 'Multiple affiliated corporate entities may hold differing executives or titles.',
        fieldType: 'short_text',
        required: true,
        allowUnknown: true,
        constraints: {
          maxLength: 60,
        },
      });
    }

    if (questions.length === 0) {
      return {
        status: 'not_needed',
        reason: 'All material leadership scope qualifiers are established; no clarification required.',
      };
    }

    if (round > MAX_CLARIFICATION_ROUNDS) {
      return {
        status: 'rounds_exhausted',
        unresolvedFields: Array.from(missingKeys),
        reason: `Maximum clarification rounds (${MAX_CLARIFICATION_ROUNDS}) reached with unresolved leadership context.`,
        roundsAttempted: round - 1,
      };
    }

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
        obligationId: `obl_leadership_8k_${ticket.ticketId}`,
        description: 'Locate SEC Form 8-K Item 5.02 departure/appointment filing or verified corporate investor relations announcement.',
        status: 'unresolved',
        material: true,
        scope: 'claim',
        affectedAssessmentIds: [],
        resolvedByAssessmentIds: [],
      },
      {
        obligationId: `obl_leadership_effective_date_${ticket.ticketId}`,
        description: 'Confirm formal effective date of officer appointment or departure transition.',
        status: 'unresolved',
        material: false,
        scope: 'claim',
        affectedAssessmentIds: [],
        resolvedByAssessmentIds: [],
      },
    ];
  }
}
