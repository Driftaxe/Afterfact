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

const REGULATION_TERMS_REGEX = /\b(regulation|regulatory|compliance|gdpr|ccpa|eu ai act|sec rule|ftc|statute|law|fines?|penalty|mandate|enacted|in force)\b/i;

export class RegulationPolicy implements DomainPolicyModule {
  public readonly domainId = 'regulation' as const;
  public readonly version = '1.0.0';

  public matches(ticket: ClaimTicket, semanticFacts?: SemanticIntentFacts): boolean {
    if (semanticFacts?.domainHint) {
      return semanticFacts.domainHint === 'regulation';
    }

    const domain = ticket.domain?.toLowerCase();
    if (domain === 'regulation' || domain === 'legal' || domain === 'compliance') {
      return true;
    }

    const statement = ticket.originalStatement || ticket.normalizedProposition;
    return REGULATION_TERMS_REGEX.test(statement);
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
        prop.key === 'requirement' ||
        prop.key === 'effective_status' ||
        prop.key === 'mandate' ||
        prop.key === 'penalty' ||
        prop.key === 'fine' ||
        prop.key === 'fine_amount'
      ) {
        role = 'asserted_value';
      } else {
        role = 'scope_qualifier';
      }

      // Essentiality rules
      if (explicitOptional.has(prop.key)) {
        required = false;
      } else if (prop.key === 'jurisdiction') {
        // Jurisdiction is essential to determine legal applicability
        required = true;
      } else if (prop.key === 'regulatory_instrument' || prop.key === 'statute') {
        // Required only if explicit in claim or user intent; do not force user to supply statute name
        required = prop.origin === 'explicit_claim_text';
      } else if (prop.key === 'covered_entity' || prop.key === 'population') {
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

      // 1. Official government gazette, statutory registry, EUR-Lex, Federal Register
      if (prov.basis === 'regulatory_filing' && doc.sourceRole === 'regulatory_filing') {
        facts.push({
          documentId: doc.documentId,
          basis: 'regulatory_filing',
          claimApplicability: prov.entityMatch ? (prov.claimApplicability ?? 'applicable') : 'not_applicable',
        });
        continue;
      }

      // 2. Official regulatory agency primary publication (e.g. SEC, FTC, EDPB)
      if (prov.basis === 'official_primary_record' && doc.sourceRole === 'primary_authority') {
        facts.push({
          documentId: doc.documentId,
          basis: 'official_primary_record',
          claimApplicability: prov.entityMatch ? (prov.claimApplicability ?? 'applicable') : 'not_applicable',
        });
        continue;
      }

      // 3. Independent secondary legal analysis (e.g. reputable law firm client alert)
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

    // Invariant: In regulation claims, ask ONLY for missing user scope qualifiers (jurisdiction, entity type).
    // NEVER ask the user whether the regulation is in effect, enacted, or valid (that is the verification engine's job).
    if (missingKeys.has('jurisdiction') && !existingExplicitKeys.has('jurisdiction')) {
      questions.push({
        questionId: `q_jurisdiction_${ticket.ticketId}`,
        propertyKey: 'jurisdiction',
        prompt: 'Which jurisdiction or geographic region governs this regulatory assertion?',
        reason: 'Regulatory requirements, compliance deadlines, and statutory fines vary strictly by jurisdiction.',
        fieldType: 'short_text',
        required: true,
        allowUnknown: true,
        constraints: {
          maxLength: 40,
        },
      });
    }

    if (questions.length === 0) {
      return {
        status: 'not_needed',
        reason: 'All material regulatory qualifiers are established; no clarification required.',
      };
    }

    if (round > MAX_CLARIFICATION_ROUNDS) {
      return {
        status: 'rounds_exhausted',
        unresolvedFields: Array.from(missingKeys),
        reason: `Maximum clarification rounds (${MAX_CLARIFICATION_ROUNDS}) reached with unresolved regulatory context.`,
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
        obligationId: `obl_reg_statutory_text_${ticket.ticketId}`,
        description: 'Locate official statutory text, legislative gazette, or published administrative order in competent jurisdiction.',
        status: 'unresolved',
        material: true,
        scope: 'claim',
        affectedAssessmentIds: [],
        resolvedByAssessmentIds: [],
      },
      {
        obligationId: `obl_reg_effective_date_${ticket.ticketId}`,
        description: 'Verify statutory effective date, enforcement grace period, or transitional provisions.',
        status: 'unresolved',
        material: true,
        scope: 'claim',
        affectedAssessmentIds: [],
        resolvedByAssessmentIds: [],
      },
    ];
  }
}
