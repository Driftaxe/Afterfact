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

const API_TERMS_REGEX = /\b(api|sdk|endpoint|method|parameter|graphql|rest|grpc|payload|deprecation|breaking change|changelog|releases?|streaming)\b/i;

export class ApiPolicy implements DomainPolicyModule {
  public readonly domainId = 'api' as const;
  public readonly version = '1.0.0';

  public matches(ticket: ClaimTicket, semanticFacts?: SemanticIntentFacts): boolean {
    if (semanticFacts?.domainHint) {
      return semanticFacts.domainHint === 'api';
    }

    const domain = ticket.domain?.toLowerCase();
    if (domain === 'api' || domain === 'software' || domain === 'developer') {
      return true;
    }

    const statement = ticket.originalStatement || ticket.normalizedProposition;
    return API_TERMS_REGEX.test(statement);
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
    const statement = ticket.originalStatement || ticket.normalizedProposition;

    // Distinguish "version as scope" ("SDK v2 supports streaming")
    // from "version as asserted value" ("The latest stable version of SolisDB is v3.4")
    const isAssertingVersionValue = /\b(latest\s+(stable\s+)?version\s+is|current\s+version\s+is)\b/i.test(statement);

    for (const prop of ticket.verificationContext) {
      let role: 'scope_qualifier' | 'asserted_value';
      let required = true;

      if (explicitAsserted.has(prop.key)) {
        role = 'asserted_value';
      } else if (explicitScope.has(prop.key)) {
        role = 'scope_qualifier';
      } else if (prop.key === 'version') {
        role = isAssertingVersionValue ? 'asserted_value' : 'scope_qualifier';
      } else if (
        prop.key === 'supported' ||
        prop.key === 'status' ||
        prop.key === 'feature' ||
        prop.key === 'capability' ||
        prop.key === 'deprecated' ||
        prop.key === 'removed'
      ) {
        role = 'asserted_value';
      } else {
        role = 'scope_qualifier';
      }

      // Essentiality rules
      if (explicitOptional.has(prop.key)) {
        required = false;
      } else if (prop.key === 'release_channel' || prop.key === 'deployment_model') {
        required = prop.origin === 'explicit_claim_text';
      } else if (prop.key === 'sdk_language' || prop.key === 'language') {
        // Language is required if claim asserts language-specific method or explicitly missing
        required = prop.origin === 'explicit_claim_text' || ticket.missingMaterialContext.includes(prop.key);
      } else if (prop.key === 'version' && !isAssertingVersionValue) {
        // Version as scope is required if stated or explicitly missing
        required = prop.origin === 'explicit_claim_text' || ticket.missingMaterialContext.includes(prop.key);
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
        'primary_authority',
        'official_changelog',
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

      // 1. Official changelog / release notes
      if (prov.basis === 'official_changelog' && doc.sourceRole === 'official_changelog') {
        facts.push({
          documentId: doc.documentId,
          basis: 'official_changelog',
          claimApplicability: prov.entityMatch ? (prov.claimApplicability ?? 'applicable') : 'not_applicable',
        });
        continue;
      }

      // 2. Official documentation / API reference
      if (prov.basis === 'official_primary_record' && doc.sourceRole === 'primary_authority') {
        facts.push({
          documentId: doc.documentId,
          basis: 'official_primary_record',
          claimApplicability: prov.entityMatch ? (prov.claimApplicability ?? 'applicable') : 'not_applicable',
        });
        continue;
      }

      // 3. Independent secondary report (e.g. major tech analysis, independent benchmark)
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

      // 4. Community forums or unverified sources
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

    // Check for ambiguous SDK language when assertion might vary across languages
    if (missingKeys.has('sdk_language') && !existingExplicitKeys.has('sdk_language')) {
      questions.push({
        questionId: `q_sdk_lang_${ticket.ticketId}`,
        propertyKey: 'sdk_language',
        prompt: 'Which SDK or programming language client does this claim refer to?',
        reason: 'Streaming and method support often varies significantly across language SDK implementations.',
        fieldType: 'select',
        required: true,
        allowUnknown: true,
        options: [
          { value: 'typescript', label: 'TypeScript / Node.js SDK' },
          { value: 'python', label: 'Python SDK' },
          { value: 'go', label: 'Go SDK' },
        ],
      });
    }

    if (questions.length === 0) {
      return {
        status: 'not_needed',
        reason: 'All material API/software qualifiers are established; no clarification required.',
      };
    }

    if (round > MAX_CLARIFICATION_ROUNDS) {
      return {
        status: 'rounds_exhausted',
        unresolvedFields: Array.from(missingKeys),
        reason: `Maximum clarification rounds (${MAX_CLARIFICATION_ROUNDS}) reached with unresolved API/software context.`,
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
        obligationId: `obl_api_runtime_scope_${ticket.ticketId}`,
        description: 'Verify method or capability existence in official changelogs, release notes, or OpenAPI schemas.',
        status: 'unresolved',
        material: true,
        scope: 'claim',
        affectedAssessmentIds: [],
        resolvedByAssessmentIds: [],
      },
      {
        obligationId: `obl_api_version_status_${ticket.ticketId}`,
        description: 'Verify deprecation, removal, or migration path notes for referenced API version.',
        status: 'unresolved',
        material: false,
        scope: 'claim',
        affectedAssessmentIds: [],
        resolvedByAssessmentIds: [],
      },
    ];
  }
}
