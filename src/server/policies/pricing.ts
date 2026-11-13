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

const PRICING_ASSERTED_KEYS = new Set([
  'price',
  'cost',
  'fee',
  'rate',
  'amount',
  'monthly_price',
  'annual_price',
  'subscription_fee',
  'seat_price',
  'percentage',
  'percent',
  'percentage_increase',
  'percentage_decrease',
  'increase',
  'discount',
]);

const PRICING_TERMS_REGEX = /\b(price|pricing|costs?|fees?|rate|rates?|subscription|\/mo|\/month|\/year|per month|per year|billing)\b/i;
const CAPABILITY_TERMS_REGEX = /\b(supports?|streaming|endpoint|method|sdk|parameter|feature|integrat(e|ion))\b/i;

export class PricingPolicy implements DomainPolicyModule {
  public readonly domainId = 'pricing' as const;
  public readonly version = '1.0.0';

  public matches(ticket: ClaimTicket, semanticFacts?: SemanticIntentFacts): boolean {
    if (semanticFacts?.domainHint) {
      return semanticFacts.domainHint === 'pricing';
    }

    const domain = ticket.domain?.toLowerCase();
    const statement = ticket.originalStatement || ticket.normalizedProposition;

    // A capability statement on a tiered product (e.g. "Enterprise tier supports streaming")
    // is an API/Software capability assertion, not a pricing proposition.
    if (CAPABILITY_TERMS_REGEX.test(statement) && !/\$\d|£\d|€\d|\bcosts?\b/i.test(statement)) {
      return false;
    }

    if (domain === 'pricing') {
      return true;
    }

    return PRICING_TERMS_REGEX.test(statement);
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
    const props = ticket.verificationContext;

    // Strictly declare roles ONLY for properties present on the ticket
    for (const prop of props) {
      let role: 'scope_qualifier' | 'asserted_value';
      let required = true;

      if (explicitAsserted.has(prop.key)) {
        role = 'asserted_value';
      } else if (explicitScope.has(prop.key)) {
        role = 'scope_qualifier';
      } else if (PRICING_ASSERTED_KEYS.has(prop.key.toLowerCase()) || props.length === 1) {
        role = 'asserted_value';
      } else {
        role = 'scope_qualifier';
      }

      // Essentiality rules
      if (explicitOptional.has(prop.key)) {
        required = false;
      } else if (prop.key === 'tax_terms' || prop.key === 'tax') {
        // Tax inclusion is optional unless explicitly stated in claim text
        required = prop.origin === 'explicit_claim_text';
      } else if (prop.key === 'plan_tier' || prop.key === 'tier') {
        // Plan tier is required if stated or explicitly missing, but not if the product has a single flat price
        required = prop.origin === 'explicit_claim_text' || ticket.missingMaterialContext.includes(prop.key);
      } else if (prop.key === 'billing_commitment' || prop.key === 'billing_term') {
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
        'regulatory_filing',
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
        // Without provenance establishing publisher identity, authority is unknown
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

      // Explicit non-applicable provenance fails closed
      if (prov.claimApplicability === 'not_applicable') {
        facts.push({
          documentId: doc.documentId,
          basis: prov.basis,
          claimApplicability: 'not_applicable',
        });
        continue;
      }

      // 1. Primary Authority Qualification
      if (prov.basis === 'official_primary_record' && doc.sourceRole === 'primary_authority') {
        if (!prov.entityMatch) {
          facts.push({
            documentId: doc.documentId,
            basis: 'official_primary_record',
            claimApplicability: 'not_applicable',
          });
          continue;
        }

        // A vendor's self-promotional marketing superlatives ("cheapest worldwide")
        // cannot serve as primary authority for comparative claims.
        const isSuperlativeClaim = /\b(cheapest|lowest|best price|unbeatable)\b/i.test(
          ticket.originalStatement || ticket.normalizedProposition
        );
        const docIsSelfPromotional =
          prov.isSelfPromotional === true || prov.attributesCovered?.includes('marketing_superlative');

        if (isSuperlativeClaim && docIsSelfPromotional) {
          facts.push({
            documentId: doc.documentId,
            basis: 'official_primary_record',
            claimApplicability: 'not_applicable',
          });
        } else {
          facts.push({
            documentId: doc.documentId,
            basis: 'official_primary_record',
            claimApplicability: prov.claimApplicability ?? 'applicable',
          });
        }
        continue;
      }

      // 2. Regulatory Filing Qualification (e.g. SEC tariff filing, public utility rate)
      if (prov.basis === 'regulatory_filing' && doc.sourceRole === 'regulatory_filing') {
        facts.push({
          documentId: doc.documentId,
          basis: 'regulatory_filing',
          claimApplicability: prov.entityMatch ? (prov.claimApplicability ?? 'applicable') : 'not_applicable',
        });
        continue;
      }

      // 3. Independent Secondary Report (e.g. reputable industry market pricing survey)
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

      // 4. Default / Inconclusive
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
    const existingExplicitKeys = new Set(
      ticket.verificationContext
        .filter((p) => p.origin === 'explicit_claim_text')
        .map((p) => p.key)
    );

    const questions: ClarificationQuestion[] = [];

    // Check for material billing commitment ambiguity
    if (missingKeys.has('billing_commitment') && !existingExplicitKeys.has('billing_commitment')) {
      questions.push({
        questionId: `q_billing_${ticket.ticketId}`,
        propertyKey: 'billing_commitment',
        prompt: 'Is this subscription price based on monthly billing or an annual commitment?',
        reason: 'Monthly rates often vary significantly between monthly and annual payment terms.',
        fieldType: 'select',
        required: true,
        allowUnknown: true,
        options: [
          { value: 'monthly', label: 'Billed monthly' },
          { value: 'annual', label: 'Billed annually' },
        ],
      });
    }

    // Check for ambiguous currency symbol (e.g. '$' in international context)
    if (missingKeys.has('currency') && !existingExplicitKeys.has('currency')) {
      questions.push({
        questionId: `q_currency_${ticket.ticketId}`,
        propertyKey: 'currency',
        prompt: 'Which currency does this pricing claim refer to?',
        reason: 'The currency symbol alone is ambiguous without jurisdiction or market context.',
        fieldType: 'select',
        required: true,
        allowUnknown: true,
        options: [
          { value: 'USD', label: 'US Dollars ($)' },
          { value: 'CAD', label: 'Canadian Dollars (CA$)' },
          { value: 'AUD', label: 'Australian Dollars (A$)' },
        ],
      });
    }

    // 1. If no material user-context gap exists -> clarification not needed
    if (questions.length === 0) {
      return {
        status: 'not_needed',
        reason: 'All material pricing qualifiers are established; no user clarification required.',
      };
    }

    // 2. If material context is missing but round limit is exhausted
    if (round > MAX_CLARIFICATION_ROUNDS) {
      return {
        status: 'rounds_exhausted',
        unresolvedFields: Array.from(missingKeys),
        reason: `Maximum clarification rounds (${MAX_CLARIFICATION_ROUNDS}) reached with unresolved pricing context.`,
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
        obligationId: `obl_pricing_commitment_${ticket.ticketId}`,
        description: 'Verify whether published price requires an annual commitment, upfront payment, or minimum contract term.',
        status: 'unresolved',
        material: true,
        scope: 'claim',
        affectedAssessmentIds: [],
        resolvedByAssessmentIds: [],
      },
      {
        obligationId: `obl_pricing_currency_${ticket.ticketId}`,
        description: 'Confirm market jurisdiction, currency denomination, and applicable taxes or VAT.',
        status: 'unresolved',
        material: false,
        scope: 'claim',
        affectedAssessmentIds: [],
        resolvedByAssessmentIds: [],
      },
    ];
  }
}
