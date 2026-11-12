import { describe, expect, it } from 'vitest';
import type { ClaimTicket } from '@/lib/contracts/claim-ticket';
import type {
  ClaimEvidenceAssessment,
  EvidenceUnit,
  SourceDocument,
} from '@/lib/contracts/evidence-objects';
import type {
  AssessmentContextBasis,
  AuthorityBasis,
  CoverageObligation,
  DecideClaimInput,
  SourceAuthorityFact,
  TemporalProofBasis,
} from '@/lib/contracts/decision';
import {
  DecisionRecordSchema,
  validateDecisionRecordReferences,
} from '@/lib/contracts/decision';
import type { SourceRole } from '@/lib/contracts/research';
import { AssessedClaimResultSchema } from '@/lib/contracts/report';
import { ClaimResultEventSchema } from '@/lib/contracts/events';
import { decideClaim } from '@/server/verify/decide';

const CLAIM_TEXT = 'SolisDB Pro plan costs £15 per month in the UK.';
const TARGET_TIME = '2026-11-13';
const DECIDED_AT = '2026-11-13T00:00:00Z';

type Relationship = ClaimEvidenceAssessment['relationship'];
type ScopeMatching = ClaimEvidenceAssessment['scopeMatching'];
type TemporalApplicability = ClaimEvidenceAssessment['temporalApplicability'];
type SourceSuitability = ClaimEvidenceAssessment['sourceSuitability'];

function baseTicket(): ClaimTicket {
  return {
    ticketId: 'tkt_solis_pricing_r1',
    claimId: 'clm_solis_pricing',
    runId: 'run_1',
    inputHash: 'hash_claim',
    revision: 1,
    originalStatement: CLAIM_TEXT,
    normalizedProposition: 'SolisDB Pro plan price is £15 per month in the UK.',
    domain: 'pricing',
    targetTime: TARGET_TIME,
    verificationContext: [
      {
        key: 'jurisdiction',
        label: 'Jurisdiction',
        propertyType: 'string',
        value: 'UK',
        origin: 'explicit_claim_text',
        sourceSpan: { start: 0, end: CLAIM_TEXT.length },
        status: 'confirmed',
        applicability: 'claim_level',
      },
      {
        key: 'plan_tier',
        label: 'Plan tier',
        propertyType: 'string',
        value: 'Pro',
        origin: 'explicit_claim_text',
        sourceSpan: { start: 0, end: CLAIM_TEXT.length },
        status: 'confirmed',
        applicability: 'claim_level',
      },
      {
        key: 'price',
        label: 'Price',
        propertyType: 'number',
        value: 15,
        units: 'GBP',
        origin: 'explicit_claim_text',
        sourceSpan: { start: 0, end: CLAIM_TEXT.length },
        status: 'confirmed',
        applicability: 'claim_level',
      },
      {
        key: 'billing_term',
        label: 'Billing term',
        propertyType: 'selection',
        value: 'monthly',
        origin: 'explicit_claim_text',
        sourceSpan: { start: 0, end: CLAIM_TEXT.length },
        status: 'confirmed',
        applicability: 'claim_level',
      },
    ],
    missingMaterialContext: [],
  };
}

function emptyInput(): DecideClaimInput {
  return {
    ticket: baseTicket(),
    assessments: [],
    evidenceUnits: [],
    sourceDocuments: [],
    claimTemporalScope: {
      quantifier: 'current',
      intervalSemantics: 'existential',
    },
    assessmentGrounding: [],
    evidenceTemporalProofs: [],
    sourceAuthority: [],
    transitions: [],
    coverage: {
      researchComplete: true,
      obligations: [],
      rejectedCandidates: [],
      budgetExhausted: false,
      limitations: [],
    },
    policy: {
      policyId: 'generic',
      policyVersion: '1.0.0',
      propertyRoles: [
        { key: 'jurisdiction', role: 'scope_qualifier', required: true },
        { key: 'plan_tier', role: 'scope_qualifier', required: true },
        { key: 'billing_term', role: 'scope_qualifier', required: true },
        { key: 'price', role: 'asserted_value', required: true },
      ],
      authoritativeSourceRoles: [
        'primary_authority',
        'regulatory_filing',
        'official_changelog',
      ],
    },
    decidedAt: DECIDED_AT,
  };
}

interface EvidenceOptions {
  evidenceId: string;
  documentId: string;
  text: string;
  sourceRole?: SourceRole;
  authorityBasis?: AuthorityBasis;
  claimApplicability?: SourceAuthorityFact['claimApplicability'];
  includeAuthority?: boolean;
  assessmentId?: string;
  relationship?: Relationship;
  scopeMatching?: ScopeMatching;
  quotationVerified?: boolean;
  propertyMatchStatus?: ClaimEvidenceAssessment['propertyMatchStatus'];
  temporalApplicability?: TemporalApplicability;
  sourceSuitability?: SourceSuitability;
  contextBasis?: AssessmentContextBasis;
  proofBasis?: TemporalProofBasis;
  interval?: { start: string; end: string } | null;
  publicationDate?: string | null;
  effectiveDate?: string | null;
  modelConfidence?: number | null;
  runId?: string;
}

function defaultAuthorityBasis(sourceRole: SourceRole): AuthorityBasis {
  switch (sourceRole) {
    case 'primary_authority':
      return 'official_primary_record';
    case 'regulatory_filing':
      return 'regulatory_filing';
    case 'official_changelog':
      return 'official_changelog';
    case 'reputable_secondary':
    case 'counter_perspective':
      return 'independent_secondary_report';
  }
}

function addEvidence(
  input: DecideClaimInput,
  options: EvidenceOptions
): string {
  const sourceRole = options.sourceRole ?? 'primary_authority';
  const isSecondary =
    sourceRole === 'reputable_secondary' || sourceRole === 'counter_perspective';
  const assessmentId =
    options.assessmentId ?? `asm_${options.evidenceId.replace(/^evi_/, '')}`;
  const runId = options.runId ?? input.ticket.runId;

  const source: SourceDocument = {
    documentId: options.documentId,
    runId,
    url: `https://example.com/${options.documentId}`,
    finalUrl: `https://example.com/${options.documentId}`,
    retrievedContentHash: `hash_${options.documentId}_v1`,
    retrievedAt: '2026-11-12T00:00:00Z',
    rawText: options.text,
    extractionStatus: 'success',
    publicationDate: options.publicationDate ?? '2026-11-01',
    effectiveDate: options.effectiveDate ?? '2026-01-01',
    sourceRole,
  };

  const unit: EvidenceUnit = {
    evidenceId: options.evidenceId,
    documentId: options.documentId,
    verbatimText: options.text,
    locator: {
      charOffsetStart: 0,
      charOffsetEnd: options.text.length,
    },
    surroundingHeaders: [],
    footnotes: [],
    extractedProperties: [],
    extractionLimitations: [],
  };

  const assessment: ClaimEvidenceAssessment = {
    assessmentId,
    claimTicketId: input.ticket.ticketId,
    claimRevision: input.ticket.revision,
    evidenceId: options.evidenceId,
    relationship: options.relationship ?? 'supports',
    scopeMatching: options.scopeMatching ?? 'match',
    quotationVerified: options.quotationVerified ?? true,
    propertyMatchStatus:
      options.propertyMatchStatus ?? {
        matching: input.ticket.verificationContext.map((property) => property.key),
        mismatched: [],
        missingInEvidence: [],
      },
    temporalApplicability:
      options.temporalApplicability ?? 'active_at_target_time',
    sourceSuitability:
      options.sourceSuitability ??
      (isSecondary ? 'credible_secondary' : 'authoritative_primary'),
    modelConfidence: options.modelConfidence ?? 0.9,
    reasoning: 'Synthetic deterministic fixture, not held-out benchmark data.',
  };

  input.sourceDocuments.push(source);
  input.evidenceUnits.push(unit);
  input.assessments.push(assessment);
  input.assessmentGrounding.push({
    assessmentId,
    contextBasis: options.contextBasis ?? 'quotation_only',
    limitations: [],
  });
  input.evidenceTemporalProofs.push({
    evidenceId: options.evidenceId,
    basis: options.proofBasis ?? 'current_validity_confirmed',
    applicableInterval: options.interval ?? null,
  });

  if (options.includeAuthority !== false) {
    input.sourceAuthority.push({
      documentId: options.documentId,
      basis: options.authorityBasis ?? defaultAuthorityBasis(sourceRole),
      claimApplicability: options.claimApplicability ?? 'applicable',
    });
  }

  return assessmentId;
}

function baseInput(): DecideClaimInput {
  const input = emptyInput();
  addEvidence(input, {
    evidenceId: 'evi_official',
    documentId: 'doc_official',
    text: CLAIM_TEXT,
  });
  return input;
}

function addObligation(
  input: DecideClaimInput,
  obligationId: string,
  overrides: Partial<CoverageObligation> = {}
): void {
  input.coverage.obligations.push({
    obligationId,
    description: `Synthetic material requirement ${obligationId}.`,
    status: 'unresolved',
    material: true,
    scope: 'claim',
    affectedAssessmentIds: [],
    resolvedByAssessmentIds: [],
    ...overrides,
  });
}

function expectDecided(outcome: ReturnType<typeof decideClaim>) {
  expect(outcome.status).toBe('decided');
  if (outcome.status !== 'decided') {
    throw new Error(`Expected decided outcome, received ${outcome.status}`);
  }
  return outcome.decision;
}

function expectInvalid(outcome: ReturnType<typeof decideClaim>) {
  expect(outcome.status).toBe('invalid_input');
  if (outcome.status !== 'invalid_input') {
    throw new Error(`Expected invalid_input outcome, received ${outcome.status}`);
  }
  return outcome;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value as Record<string, unknown>)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
  }
  return value;
}

describe('Stage 4: Deterministic Decision Gate (decideClaim)', () => {
  describe('Support and authority', () => {
    it('AC01: direct primary support with qualified provenance yields supported/100', () => {
      const decision = expectDecided(decideClaim(baseInput()));

      expect(decision.verdict).toBe('supported');
      expect(decision.score).toBe(100);
      expect(decision.reasonCode).toBe('AUTHORITATIVE_PRIMARY_SUPPORT');
      expect(decision.primaryEvidenceIds).toEqual(['asm_official']);
    });

    it('AC02: credible secondary support yields supported/75', () => {
      const input = emptyInput();
      addEvidence(input, {
        evidenceId: 'evi_secondary',
        documentId: 'doc_secondary',
        text: CLAIM_TEXT,
        sourceRole: 'reputable_secondary',
      });

      const decision = expectDecided(decideClaim(input));

      expect(decision.verdict).toBe('supported');
      expect(decision.score).toBe(75);
      expect(decision.reasonCode).toBe('INDIRECT_CREDIBLE_SUPPORT');
    });

    it('AC03: an authoritative label without claim-specific provenance cannot grant 100', () => {
      const noFact = emptyInput();
      addEvidence(noFact, {
        evidenceId: 'evi_unproven',
        documentId: 'doc_unproven',
        text: CLAIM_TEXT,
        includeAuthority: false,
      });
      const noFactDecision = expectDecided(decideClaim(noFact));
      expect(noFactDecision.verdict).toBe('insufficient_evidence');
      expect(noFactDecision.score).toBeNull();
      expect(noFactDecision.excludedEvidence).toContainEqual({
        evidenceId: 'evi_unproven',
        exclusionReason: 'insufficient_authority',
      });

      const mismatchedBasis = emptyInput();
      addEvidence(mismatchedBasis, {
        evidenceId: 'evi_label_mismatch',
        documentId: 'doc_label_mismatch',
        text: CLAIM_TEXT,
        sourceRole: 'primary_authority',
        authorityBasis: 'official_changelog',
      });
      const mismatchDecision = expectDecided(decideClaim(mismatchedBasis));
      expect(mismatchDecision.verdict).toBe('insufficient_evidence');
      expect(mismatchDecision.score).toBeNull();
    });

    it('AC04: an applicable official changelog can qualify an API claim for 100', () => {
      const apiText = 'SolisDB API v2 was deprecated on 2024-01-01.';
      const input = emptyInput();
      input.ticket.originalStatement = apiText;
      input.ticket.normalizedProposition =
        'SolisDB API v2 deprecation date is 2024-01-01.';
      input.ticket.domain = 'api';
      input.ticket.verificationContext = [
        {
          key: 'version',
          label: 'API version',
          propertyType: 'string',
          value: 'v2',
          origin: 'explicit_claim_text',
          sourceSpan: { start: 0, end: apiText.length },
          status: 'confirmed',
          applicability: 'claim_level',
        },
        {
          key: 'event_date',
          label: 'Event date',
          propertyType: 'date',
          value: '2024-01-01',
          origin: 'explicit_claim_text',
          sourceSpan: { start: 0, end: apiText.length },
          status: 'confirmed',
          applicability: 'claim_level',
        },
      ];
      input.policy.propertyRoles = [
        { key: 'version', role: 'scope_qualifier', required: true },
        { key: 'event_date', role: 'asserted_value', required: true },
      ];
      addEvidence(input, {
        evidenceId: 'evi_changelog',
        documentId: 'doc_changelog',
        text: apiText,
        sourceRole: 'official_changelog',
      });

      const decision = expectDecided(decideClaim(input));
      expect(decision.verdict).toBe('supported');
      expect(decision.score).toBe(100);
      expect(decision.reasonCode).toBe('AUTHORITATIVE_PRIMARY_SUPPORT');
    });
  });

  describe('Scope qualifiers versus asserted values', () => {
    it('AC05: same-scope different asserted price remains an eligible contradiction', () => {
      const input = emptyInput();
      addEvidence(input, {
        evidenceId: 'evi_price_20',
        documentId: 'doc_price_20',
        text: 'SolisDB Pro plan costs £20 per month in the UK.',
        relationship: 'contradicts',
        scopeMatching: 'match',
        propertyMatchStatus: {
          matching: ['jurisdiction', 'plan_tier', 'billing_term'],
          mismatched: ['price'],
          missingInEvidence: [],
        },
      });

      const decision = expectDecided(decideClaim(input));
      expect(decision.verdict).toBe('contradicted');
      expect(decision.score).toBe(0);
      expect(decision.reasonCode).toBe('DECISIVE_CONTRADICTION');

      // A04 may say "mismatch" because the value differs. The declared role
      // says price is the asserted value, not a scope qualifier.
      const mislabeled = emptyInput();
      addEvidence(mislabeled, {
        evidenceId: 'evi_price_20_label',
        documentId: 'doc_price_20_label',
        text: 'SolisDB Pro plan costs £20 per month in the UK.',
        relationship: 'contradicts',
        scopeMatching: 'mismatch',
        propertyMatchStatus: {
          matching: ['jurisdiction', 'plan_tier', 'billing_term'],
          mismatched: ['price'],
          missingInEvidence: [],
        },
      });

      const mislabeledDecision = expectDecided(decideClaim(mislabeled));
      expect(mislabeledDecision.verdict).toBe('contradicted');
      expect(mislabeledDecision.score).toBe(0);
    });

    it('AC06: a different jurisdiction cannot directly contradict the UK claim', () => {
      const input = emptyInput();
      addEvidence(input, {
        evidenceId: 'evi_us',
        documentId: 'doc_us',
        text: 'SolisDB Pro plan costs $20 per month in the US.',
        relationship: 'contradicts',
        scopeMatching: 'mismatch',
        propertyMatchStatus: {
          matching: ['plan_tier', 'billing_term'],
          mismatched: ['jurisdiction'],
          missingInEvidence: [],
        },
      });

      const decision = expectDecided(decideClaim(input));
      expect(decision.verdict).not.toBe('contradicted');
      expect(decision.verdict).toBe('insufficient_evidence');
      expect(decision.score).toBeNull();
      expect(decision.excludedEvidence).toContainEqual({
        evidenceId: 'evi_us',
        exclusionReason: 'wrong_scope',
      });
    });

    it('AC06b: an unclassified property mismatch preserves uncertainty', () => {
      const input = emptyInput();
      input.ticket.verificationContext.push({
        key: 'sales_channel',
        label: 'Sales channel',
        propertyType: 'string',
        value: 'online',
        origin: 'explicit_claim_text',
        sourceSpan: { start: 0, end: CLAIM_TEXT.length },
        status: 'confirmed',
        applicability: 'claim_level',
      });
      addEvidence(input, {
        evidenceId: 'evi_unknown_property',
        documentId: 'doc_unknown_property',
        text: 'SolisDB Pro plan costs £20 per month in the UK.',
        relationship: 'contradicts',
        propertyMatchStatus: {
          matching: ['jurisdiction', 'plan_tier', 'billing_term', 'price'],
          mismatched: ['sales_channel'],
          missingInEvidence: [],
        },
      });

      const decision = expectDecided(decideClaim(input));
      expect(decision.verdict).toBe('insufficient_evidence');
      expect(
        decision.limitations.some((limitation) =>
          limitation.startsWith('PROPERTY_ROLE_UNCLASSIFIED')
        )
      ).toBe(true);
    });
  });

  describe('Conflict resolution', () => {
    it('AC07: equal-authority unresolved opposition yields conflicting_evidence/null', () => {
      const input = baseInput();
      addEvidence(input, {
        evidenceId: 'evi_primary_opposition',
        documentId: 'doc_primary_opposition',
        text: 'SolisDB Pro plan costs £20 per month in the UK.',
        relationship: 'contradicts',
        scopeMatching: 'match',
        propertyMatchStatus: {
          matching: ['jurisdiction', 'plan_tier', 'billing_term'],
          mismatched: ['price'],
          missingInEvidence: [],
        },
      });

      const decision = expectDecided(decideClaim(input));
      expect(decision.verdict).toBe('conflicting_evidence');
      expect(decision.score).toBeNull();
      expect(decision.reasonCode).toBe('CREDIBLE_SOURCES_DISAGREE');
      expect(decision.primaryEvidenceIds).toEqual([]);
      expect(decision.counterEvidenceIds).toEqual([
        'asm_official',
        'asm_primary_opposition',
      ]);
    });

    it('AC08: an applicable documented supersession resolves the apparent conflict as outdated', () => {
      const input = emptyInput();
      const priorId = addEvidence(input, {
        evidenceId: 'evi_prior',
        documentId: 'doc_prior',
        text: 'SolisDB Pro plan costs £10 per month in the UK.',
        relationship: 'historical_state',
        temporalApplicability: 'historical_prior',
        proofBasis: 'historical_interval_confirmed',
        interval: { start: '2021-01-01', end: '2022-12-31' },
        effectiveDate: '2021-01-01',
        publicationDate: '2021-01-01',
      });
      const supersedingId = addEvidence(input, {
        evidenceId: 'evi_current',
        documentId: 'doc_current',
        text: 'SolisDB Pro plan costs £20 per month in the UK.',
        relationship: 'contradicts',
        propertyMatchStatus: {
          matching: ['jurisdiction', 'plan_tier', 'billing_term'],
          mismatched: ['price'],
          missingInEvidence: [],
        },
        effectiveDate: '2023-01-01',
        publicationDate: '2023-01-02',
      });
      input.transitions.push({
        transitionId: 'tr_price_change',
        claimTicketId: input.ticket.ticketId,
        claimRevision: input.ticket.revision,
        priorAssessmentId: priorId,
        supersedingAssessmentId: supersedingId,
        effectiveDate: '2023-01-01',
        entityAndScopeMatch: 'match',
        basis: 'documented_effective_change',
      });

      const decision = expectDecided(decideClaim(input));
      expect(decision.verdict).toBe('outdated');
      expect(decision.score).toBe(0);
      expect(decision.reasonCode).toBe('SUPERSEDED_HISTORICAL_CLAIM');
      expect(decision.temporalBasis.transitionEventDate).toBe('2023-01-01');
      expect(decision.primaryEvidenceIds).toEqual(['asm_current', 'asm_prior']);
    });

    it('AC09: a newer publication date alone does not resolve equal-authority conflict', () => {
      const input = emptyInput();
      addEvidence(input, {
        evidenceId: 'evi_old_support',
        documentId: 'doc_old_support',
        text: CLAIM_TEXT,
        publicationDate: '2026-01-01',
      });
      addEvidence(input, {
        evidenceId: 'evi_new_opposition',
        documentId: 'doc_new_opposition',
        text: 'SolisDB Pro plan costs £20 per month in the UK.',
        relationship: 'contradicts',
        propertyMatchStatus: {
          matching: ['jurisdiction', 'plan_tier', 'billing_term'],
          mismatched: ['price'],
          missingInEvidence: [],
        },
        publicationDate: '2026-11-10',
      });

      const decision = expectDecided(decideClaim(input));
      expect(decision.verdict).toBe('conflicting_evidence');
      expect(decision.score).toBeNull();
    });
  });

  describe('Temporal policy', () => {
    it('AC10: historical validity plus a matching effective transition yields outdated', () => {
      const input = emptyInput();
      const priorId = addEvidence(input, {
        evidenceId: 'evi_prior_support',
        documentId: 'doc_prior_support',
        text: 'SolisDB Pro plan cost £10 per month in the UK from 2021 through 2022.',
        relationship: 'historical_state',
        temporalApplicability: 'historical_prior',
        proofBasis: 'historical_interval_confirmed',
        interval: { start: '2021-01-01', end: '2022-12-31' },
        effectiveDate: '2021-01-01',
      });
      const supersedingId = addEvidence(input, {
        evidenceId: 'evi_new_state',
        documentId: 'doc_new_state',
        text: 'SolisDB Pro plan costs £20 per month in the UK.',
        relationship: 'contradicts',
        propertyMatchStatus: {
          matching: ['jurisdiction', 'plan_tier', 'billing_term'],
          mismatched: ['price'],
          missingInEvidence: [],
        },
        effectiveDate: '2023-01-01',
      });
      input.transitions.push({
        transitionId: 'tr_2',
        claimTicketId: input.ticket.ticketId,
        claimRevision: input.ticket.revision,
        priorAssessmentId: priorId,
        supersedingAssessmentId: supersedingId,
        effectiveDate: '2023-01-01',
        entityAndScopeMatch: 'match',
        basis: 'documented_effective_change',
      });

      const decision = expectDecided(decideClaim(input));
      expect(decision.verdict).toBe('outdated');
      expect(decision.score).toBe(0);
    });

    it('AC11: no earlier validity but an independent current contradiction yields contradicted', () => {
      const input = emptyInput();
      addEvidence(input, {
        evidenceId: 'evi_non_decisive_history',
        documentId: 'doc_non_decisive_history',
        text: 'SolisDB Pro plan pricing was discussed in a planning document.',
        relationship: 'relevant_but_inconclusive',
      });
      const oppositionId = addEvidence(input, {
        evidenceId: 'evi_current_opposition',
        documentId: 'doc_current_opposition',
        text: 'SolisDB Pro plan costs £20 per month in the UK.',
        relationship: 'contradicts',
        propertyMatchStatus: {
          matching: ['jurisdiction', 'plan_tier', 'billing_term'],
          mismatched: ['price'],
          missingInEvidence: [],
        },
      });
      input.transitions.push({
        transitionId: 'tr_incomplete',
        claimTicketId: input.ticket.ticketId,
        claimRevision: input.ticket.revision,
        priorAssessmentId: 'asm_non_decisive_history',
        supersedingAssessmentId: oppositionId,
        effectiveDate: '2023-01-01',
        entityAndScopeMatch: 'match',
        basis: 'documented_effective_change',
      });

      const decision = expectDecided(decideClaim(input));
      expect(decision.verdict).toBe('contradicted');
      expect(decision.score).toBe(0);
    });

    it('AC12: an incomplete transition with no decisive contradiction remains uncertain', () => {
      const input = emptyInput();
      const priorId = addEvidence(input, {
        evidenceId: 'evi_prior_only',
        documentId: 'doc_prior_only',
        text: 'SolisDB Pro plan costs £10 per month in the UK.',
        relationship: 'historical_state',
        temporalApplicability: 'historical_prior',
        proofBasis: 'historical_interval_confirmed',
        interval: { start: '2021-01-01', end: '2022-12-31' },
        effectiveDate: '2021-01-01',
      });
      const inconclusiveId = addEvidence(input, {
        evidenceId: 'evi_announcement',
        documentId: 'doc_announcement',
        text: 'SolisDB announced a future price change for 2027.',
        relationship: 'relevant_but_inconclusive',
        proofBasis: 'future_effective',
        temporalApplicability: 'future_pending',
        effectiveDate: '2027-01-01',
        publicationDate: '2026-10-01',
      });
      input.transitions.push({
        transitionId: 'tr_announced_only',
        claimTicketId: input.ticket.ticketId,
        claimRevision: input.ticket.revision,
        priorAssessmentId: priorId,
        supersedingAssessmentId: inconclusiveId,
        effectiveDate: '2027-01-01',
        entityAndScopeMatch: 'unknown',
        basis: 'announced_future_change',
      });

      const decision = expectDecided(decideClaim(input));
      expect(decision.verdict).toBe('insufficient_evidence');
      expect(decision.score).toBeNull();
    });

    it('AC12b: an independently sufficient current contradiction survives missing transition proof', () => {
      const input = emptyInput();
      addEvidence(input, {
        evidenceId: 'evi_prior_validity',
        documentId: 'doc_prior_validity',
        text: 'SolisDB Pro plan cost £10 per month in the UK from 2021 through 2022.',
        relationship: 'historical_state',
        temporalApplicability: 'historical_prior',
        proofBasis: 'historical_interval_confirmed',
        interval: { start: '2021-01-01', end: '2022-12-31' },
        effectiveDate: '2021-01-01',
      });
      addEvidence(input, {
        evidenceId: 'evi_current_price',
        documentId: 'doc_current_price',
        text: 'SolisDB Pro plan costs £20 per month in the UK.',
        relationship: 'contradicts',
        propertyMatchStatus: {
          matching: ['jurisdiction', 'plan_tier', 'billing_term'],
          mismatched: ['price'],
          missingInEvidence: [],
        },
      });

      const decision = expectDecided(decideClaim(input));
      expect(decision.verdict).toBe('contradicted');
      expect(decision.score).toBe(0);
      expect(decision.reasonCode).toBe('DECISIVE_CONTRADICTION');
      expect(decision.primaryEvidenceIds).toEqual(['asm_current_price']);
      // Earlier validity is preserved and referenced, not erased.
      expect(decision.limitations).toContain(
        'PRIOR_VALIDITY_TRANSITION_UNESTABLISHED: asm_prior_validity'
      );
      expect(decision.scoreReason).toContain('Earlier validity');
      expect(decision.scoreReason).toContain('does not invalidate');
    });

    it('AC12c: the same current contradiction becomes outdated when the transition is complete', () => {
      const input = emptyInput();
      const priorId = addEvidence(input, {
        evidenceId: 'evi_prior_validity',
        documentId: 'doc_prior_validity',
        text: 'SolisDB Pro plan cost £10 per month in the UK from 2021 through 2022.',
        relationship: 'historical_state',
        temporalApplicability: 'historical_prior',
        proofBasis: 'historical_interval_confirmed',
        interval: { start: '2021-01-01', end: '2022-12-31' },
        effectiveDate: '2021-01-01',
      });
      const supersedingId = addEvidence(input, {
        evidenceId: 'evi_current_price',
        documentId: 'doc_current_price',
        text: 'SolisDB Pro plan costs £20 per month in the UK.',
        relationship: 'contradicts',
        propertyMatchStatus: {
          matching: ['jurisdiction', 'plan_tier', 'billing_term'],
          mismatched: ['price'],
          missingInEvidence: [],
        },
        effectiveDate: '2023-01-01',
      });
      input.transitions.push({
        transitionId: 'tr_price_change',
        claimTicketId: input.ticket.ticketId,
        claimRevision: input.ticket.revision,
        priorAssessmentId: priorId,
        supersedingAssessmentId: supersedingId,
        effectiveDate: '2023-01-01',
        entityAndScopeMatch: 'match',
        basis: 'documented_effective_change',
      });

      const decision = expectDecided(decideClaim(input));
      expect(decision.verdict).toBe('outdated');
      expect(decision.score).toBe(0);
      expect(decision.reasonCode).toBe('SUPERSEDED_HISTORICAL_CLAIM');
      expect(decision.primaryEvidenceIds).toEqual([
        'asm_current_price',
        'asm_prior_validity',
      ]);
    });

    it('AC12d: historical support alone does not establish current falsity', () => {
      const input = emptyInput();
      addEvidence(input, {
        evidenceId: 'evi_prior_only',
        documentId: 'doc_prior_only',
        text: 'SolisDB Pro plan cost £10 per month in the UK in 2021.',
        relationship: 'historical_state',
        temporalApplicability: 'historical_prior',
        proofBasis: 'historical_interval_confirmed',
        interval: { start: '2021-01-01', end: '2021-12-31' },
        effectiveDate: '2021-01-01',
      });

      const decision = expectDecided(decideClaim(input));
      expect(decision.verdict).toBe('insufficient_evidence');
      expect(decision.score).toBeNull();
      expect(decision.reasonCode).toBe('INSUFFICIENT_RETRIEVAL_DATA');
      expect(decision.verdict).not.toBe('contradicted');
      expect(decision.verdict).not.toBe('outdated');
    });

    it('AC13: explicit historical truth survives a later change', () => {
      const historicalText = 'SolisDB Pro plan cost £10 per month in 2021.';
      const input = emptyInput();
      input.ticket.originalStatement = historicalText;
      input.ticket.normalizedProposition =
        'SolisDB Pro plan price was £10 per month in 2021.';
      input.ticket.verificationContext[2].value = 10;
      input.claimTemporalScope = {
        quantifier: 'historical',
        assertedTime: '2021',
        intervalSemantics: 'existential',
      };

      addEvidence(input, {
        evidenceId: 'evi_2021',
        documentId: 'doc_2021',
        text: historicalText,
        relationship: 'supports',
        temporalApplicability: 'historical_prior',
        proofBasis: 'historical_interval_confirmed',
        interval: { start: '2021-01-01', end: '2021-12-31' },
        effectiveDate: '2021-03-01',
        publicationDate: '2021-04-01',
      });
      addEvidence(input, {
        evidenceId: 'evi_2024_state',
        documentId: 'doc_2024_state',
        text: 'SolisDB Pro plan costs £20 per month in the UK.',
        relationship: 'contradicts',
        propertyMatchStatus: {
          matching: ['jurisdiction', 'plan_tier', 'billing_term'],
          mismatched: ['price'],
          missingInEvidence: [],
        },
        effectiveDate: '2024-01-01',
        publicationDate: '2024-01-02',
      });

      const decision = expectDecided(decideClaim(input));
      expect(decision.verdict).toBe('supported');
      expect(decision.score).toBe(100);
      expect(decision.reasonCode).toBe('AUTHORITATIVE_PRIMARY_SUPPORT');
    });

    it('AC14: a future announcement does not automatically invalidate current state', () => {
      const input = baseInput();
      addEvidence(input, {
        evidenceId: 'evi_future',
        documentId: 'doc_future',
        text: 'SolisDB Pro plan will cost £20 per month in the UK from 2027-01-01.',
        relationship: 'future_scheduled_change',
        temporalApplicability: 'future_pending',
        proofBasis: 'future_effective',
        effectiveDate: '2027-01-01',
        propertyMatchStatus: {
          matching: ['jurisdiction', 'plan_tier', 'billing_term'],
          mismatched: ['price'],
          missingInEvidence: [],
        },
      });

      const decision = expectDecided(decideClaim(input));
      expect(decision.verdict).toBe('supported');
      expect(decision.score).toBe(100);
      expect(
        decision.limitations.some((limitation) =>
          limitation.startsWith('FUTURE_CHANGE_NOT_APPLIED')
        )
      ).toBe(true);
    });

    it('AC15: an old effective start alone does not prove current validity', () => {
      const input = emptyInput();
      addEvidence(input, {
        evidenceId: 'evi_start_only',
        documentId: 'doc_start_only',
        text: CLAIM_TEXT,
        proofBasis: 'effective_start_only',
      });

      const decision = expectDecided(decideClaim(input));
      expect(decision.verdict).toBe('insufficient_evidence');
      expect(decision.score).toBeNull();
      expect(
        decision.limitations.some((limitation) =>
          limitation.startsWith('EFFECTIVE_START_ONLY')
        )
      ).toBe(true);
    });

    it('AC16: publication date does not replace event or effective time', () => {
      const input = emptyInput();
      addEvidence(input, {
        evidenceId: 'evi_publication_only',
        documentId: 'doc_publication_only',
        text: CLAIM_TEXT,
        proofBasis: 'publication_only',
      });

      const decision = expectDecided(decideClaim(input));
      expect(decision.verdict).toBe('insufficient_evidence');
      expect(decision.score).toBeNull();
      expect(
        decision.limitations.some((limitation) =>
          limitation.startsWith('PUBLICATION_DATE_INSUFFICIENT')
        )
      ).toBe(true);
    });
  });

  describe('Context, coverage, and uncertainty', () => {
    it('AC17: material missing context yields depends_on_context/null', () => {
      const input = baseInput();
      input.ticket.missingMaterialContext = ['billing_term'];

      const decision = expectDecided(decideClaim(input));
      expect(decision.verdict).toBe('depends_on_context');
      expect(decision.score).toBeNull();
      expect(decision.reasonCode).toBe('ESSENTIAL_CONTEXT_MISSING');
      expect(decision.scoreReason).toContain('billing_term');
    });

    it('AC18: an optional unknown qualifier does not block a decision', () => {
      const input = baseInput();
      input.ticket.verificationContext.push({
        key: 'tax',
        label: 'Tax treatment',
        propertyType: 'string',
        value: null,
        origin: 'unknown',
        status: 'confirmed',
        applicability: 'claim_level',
      });
      input.policy.propertyRoles.push({
        key: 'tax',
        role: 'scope_qualifier',
        required: false,
      });

      const decision = expectDecided(decideClaim(input));
      expect(decision.verdict).toBe('supported');
      expect(decision.score).toBe(100);
    });

    it('AC19: no decisive evidence yields insufficient_evidence/null', () => {
      const input = emptyInput();

      const decision = expectDecided(decideClaim(input));
      expect(decision.verdict).toBe('insufficient_evidence');
      expect(decision.score).toBeNull();
      expect(decision.reasonCode).toBe('INSUFFICIENT_RETRIEVAL_DATA');
    });

    it('AC20: malformed aggregates are rejected instead of deciding from a partial remainder', () => {
      const wrongClaim = baseInput();
      wrongClaim.assessments[0].claimTicketId = 'tkt_other';
      expectInvalid(decideClaim(wrongClaim));

      const staleRevision = baseInput();
      staleRevision.assessments[0].claimRevision = 2;
      expectInvalid(decideClaim(staleRevision));

      const danglingEvidence = baseInput();
      danglingEvidence.assessments[0].evidenceId = 'evi_missing';
      expectInvalid(decideClaim(danglingEvidence));

      const conflictingDuplicate = baseInput();
      conflictingDuplicate.assessments.push({
        ...conflictingDuplicate.assessments[0],
        relationship: 'contradicts',
      });
      expectInvalid(decideClaim(conflictingDuplicate));

      const multiplePerEvidence = baseInput();
      multiplePerEvidence.assessments.push({
        ...multiplePerEvidence.assessments[0],
        assessmentId: 'asm_second_for_same_evidence',
      });
      expectInvalid(decideClaim(multiplePerEvidence));

      const wrongRun = baseInput();
      wrongRun.sourceDocuments[0].runId = 'run_other';
      expectInvalid(decideClaim(wrongRun));

      const inconsistentSource = baseInput();
      inconsistentSource.evidenceUnits[0].verbatimText =
        'This sentence is not present in the source document.';
      expectInvalid(decideClaim(inconsistentSource));

      const invalidTimestamp = baseInput();
      (invalidTimestamp as { decidedAt: string }).decidedAt = '2026-11-13';
      expectInvalid(decideClaim(invalidTimestamp));

      const invalidPolicy = baseInput();
      (
        invalidPolicy.policy as unknown as { authoritativeSourceRoles: string[] }
      ).authoritativeSourceRoles = ['not_a_source_role'];
      expectInvalid(decideClaim(invalidPolicy));

      const unknownPolicyRole = baseInput();
      unknownPolicyRole.policy.propertyRoles.push({
        key: 'not_a_claim_property',
        role: 'scope_qualifier',
        required: true,
      });
      expectInvalid(decideClaim(unknownPolicyRole));
    });

    it('AC21: context-uncertain evidence cannot independently grant a decisive verdict', () => {
      const uncertainOnly = emptyInput();
      addEvidence(uncertainOnly, {
        evidenceId: 'evi_uncertain_context',
        documentId: 'doc_uncertain_context',
        text: CLAIM_TEXT,
        contextBasis: 'unverified_context',
      });

      const uncertainDecision = expectDecided(decideClaim(uncertainOnly));
      expect(uncertainDecision.verdict).toBe('insufficient_evidence');
      expect(uncertainDecision.score).toBeNull();
      expect(uncertainDecision.excludedEvidence).toContainEqual({
        evidenceId: 'evi_uncertain_context',
        exclusionReason: 'unverified_context',
      });

      // Another independently grounded assessment may still decide.
      const withGroundedSupport = emptyInput();
      addEvidence(withGroundedSupport, {
        evidenceId: 'evi_grounded',
        documentId: 'doc_grounded',
        text: CLAIM_TEXT,
      });
      addEvidence(withGroundedSupport, {
        evidenceId: 'evi_uncertain_opposition',
        documentId: 'doc_uncertain_opposition',
        text: 'SolisDB Pro plan costs £20 per month in the UK.',
        relationship: 'contradicts',
        contextBasis: 'unverified_context',
        propertyMatchStatus: {
          matching: ['jurisdiction', 'plan_tier', 'billing_term'],
          mismatched: ['price'],
          missingInEvidence: [],
        },
      });

      const groundedDecision = expectDecided(decideClaim(withGroundedSupport));
      expect(groundedDecision.verdict).toBe('supported');
      expect(groundedDecision.score).toBe(100);
    });

    it('AC22: unrelated rejected candidates do not invalidate independently sufficient grounded evidence', () => {
      const input = baseInput();
      input.coverage.rejectedCandidates.push({
        evidenceId: 'evi_unrelated',
        reason: 'unrelated',
        material: false,
      });

      const decision = expectDecided(decideClaim(input));
      expect(decision.verdict).toBe('supported');
      expect(decision.score).toBe(100);
    });

    it('AC23a: a material limitation affecting every support yields uncertainty', () => {
      const input = emptyInput();
      addEvidence(input, {
        evidenceId: 'evi_primary',
        documentId: 'doc_primary',
        text: CLAIM_TEXT,
      });
      addEvidence(input, {
        evidenceId: 'evi_secondary',
        documentId: 'doc_secondary',
        text: CLAIM_TEXT,
        sourceRole: 'reputable_secondary',
      });
      addObligation(input, 'obl_scope_check', {
        scope: 'evidence',
        affectedAssessmentIds: ['asm_primary', 'asm_secondary'],
        description:
          'The quotation has not been confirmed to belong to the asserted UK monthly plan scope.',
      });

      const decision = expectDecided(decideClaim(input));
      expect(decision.verdict).toBe('insufficient_evidence');
      expect(decision.score).toBeNull();
      expect(decision.reasonCode).toBe('INSUFFICIENT_RETRIEVAL_DATA');
      expect(decision.primaryEvidenceIds).toEqual([]);
      expect(decision.limitations).toContain(
        'MATERIAL_OBLIGATION_UNRESOLVED: obl_scope_check'
      );
      expect(decision.limitations).toContain(
        'MATERIAL_COVERAGE_LIMITATION_UNRESOLVED: asm_primary'
      );
      expect(decision.limitations).toContain(
        'MATERIAL_COVERAGE_LIMITATION_UNRESOLVED: asm_secondary'
      );
    });

    it('AC23b: adding secondary support does not resolve an unresolved claim-wide limitation', () => {
      const input = emptyInput();
      addEvidence(input, {
        evidenceId: 'evi_primary',
        documentId: 'doc_primary',
        text: CLAIM_TEXT,
      });
      addObligation(input, 'obl_required_check', {
        description: 'A required current-state check is unfinished.',
      });

      const before = expectDecided(decideClaim(input));
      expect(before.verdict).toBe('insufficient_evidence');
      expect(before.score).toBeNull();

      addEvidence(input, {
        evidenceId: 'evi_secondary',
        documentId: 'doc_secondary',
        text: CLAIM_TEXT,
        sourceRole: 'reputable_secondary',
      });

      const after = expectDecided(decideClaim(input));
      expect(after.verdict).toBe('insufficient_evidence');
      expect(after.score).toBeNull();
      expect(after.limitations).toContain(
        'MATERIAL_OBLIGATION_UNRESOLVED: obl_required_check'
      );
    });

    it('AC23c: evidence limited by its own specific gap leaves independent credible-secondary support at 75', () => {
      const input = emptyInput();
      addEvidence(input, {
        evidenceId: 'evi_primary',
        documentId: 'doc_primary',
        text: CLAIM_TEXT,
      });
      addEvidence(input, {
        evidenceId: 'evi_secondary',
        documentId: 'doc_secondary',
        text: CLAIM_TEXT,
        sourceRole: 'reputable_secondary',
      });
      addObligation(input, 'obl_primary_grounding', {
        scope: 'evidence',
        affectedAssessmentIds: ['asm_primary'],
        description:
          'The primary quotation still depends on unverified surrounding context.',
      });

      const decision = expectDecided(decideClaim(input));
      expect(decision.verdict).toBe('supported');
      expect(decision.score).toBe(75);
      expect(decision.reasonCode).toBe('INDIRECT_CREDIBLE_SUPPORT');
      expect(decision.primaryEvidenceIds).toEqual(['asm_secondary']);
      expect(decision.limitations).toContain(
        'MATERIAL_COVERAGE_LIMITATION_UNRESOLVED: asm_primary'
      );
    });

    it('AC23d: a material but unrelated rejected candidate does not block independent primary support', () => {
      const input = baseInput();
      input.coverage.rejectedCandidates.push({
        evidenceId: 'evi_unrelated_material',
        reason: 'unrelated',
        material: true,
      });

      const decision = expectDecided(decideClaim(input));
      expect(decision.verdict).toBe('supported');
      expect(decision.score).toBe(100);
      expect(decision.reasonCode).toBe('AUTHORITATIVE_PRIMARY_SUPPORT');
      expect(decision.limitations).not.toContain(
        'MATERIAL_REJECTED_CANDIDATE: evi_unrelated_material:unrelated'
      );
    });

    it('AC23e: an exhausted budget with a required material check unfinished yields uncertainty', () => {
      const input = baseInput();
      input.coverage.researchComplete = false;
      input.coverage.budgetExhausted = true;
      addObligation(input, 'obl_unfinished_budget_check', {
        description: 'A required pricing schedule check was never completed.',
      });

      const decision = expectDecided(decideClaim(input));
      expect(decision.verdict).toBe('insufficient_evidence');
      expect(decision.score).toBeNull();
      expect(decision.limitations).toContain('RESEARCH_BUDGET_EXHAUSTED');
      expect(decision.limitations).toContain(
        'MATERIAL_OBLIGATION_UNRESOLVED: obl_unfinished_budget_check'
      );
    });

    it('AC23f: budget exhaustion alone does not invalidate sufficient evidence', () => {
      const input = baseInput();
      input.coverage.researchComplete = false;
      input.coverage.budgetExhausted = true;
      addObligation(input, 'obl_completed_check', {
        status: 'satisfied',
        resolutionBasis:
          'The required current pricing schedule was checked before the budget ran out.',
      });

      const decision = expectDecided(decideClaim(input));
      expect(decision.verdict).toBe('supported');
      expect(decision.score).toBe(100);
      expect(decision.limitations).toContain('RESEARCH_BUDGET_EXHAUSTED');
      expect(decision.limitations).not.toContain(
        'MATERIAL_OBLIGATION_UNRESOLVED: obl_completed_check'
      );
    });

    it('AC23g: unknown material coverage does not silently become complete', () => {
      const incompleteResearch = baseInput();
      incompleteResearch.coverage.researchComplete = false;

      const incompleteDecision = expectDecided(decideClaim(incompleteResearch));
      expect(incompleteDecision.verdict).toBe('insufficient_evidence');
      expect(incompleteDecision.score).toBeNull();
      expect(incompleteDecision.limitations).toContain(
        'RESEARCH_COVERAGE_INCOMPLETE'
      );

      const unboundedObligation = baseInput();
      addObligation(unboundedObligation, 'obl_unknown_affect', {
        scope: 'evidence',
        affectedAssessmentIds: [],
      });

      const unboundedDecision = expectDecided(decideClaim(unboundedObligation));
      expect(unboundedDecision.verdict).toBe('insufficient_evidence');
      expect(unboundedDecision.score).toBeNull();
    });

    it('AC24: duplicate or syndicated sources do not manufacture corroboration', () => {
      const input = emptyInput();
      addEvidence(input, {
        evidenceId: 'evi_support_a',
        documentId: 'doc_support_a',
        text: CLAIM_TEXT,
      });
      addEvidence(input, {
        evidenceId: 'evi_support_b',
        documentId: 'doc_support_b',
        text: CLAIM_TEXT,
      });
      addEvidence(input, {
        evidenceId: 'evi_opposition',
        documentId: 'doc_opposition',
        text: 'SolisDB Pro plan costs £20 per month in the UK.',
        relationship: 'contradicts',
        propertyMatchStatus: {
          matching: ['jurisdiction', 'plan_tier', 'billing_term'],
          mismatched: ['price'],
          missingInEvidence: [],
        },
      });

      const decision = expectDecided(decideClaim(input));
      expect(decision.verdict).toBe('conflicting_evidence');
      expect(decision.score).toBeNull();
    });
  });

  describe('Truth-signal fencing and determinism', () => {
    it('AC25: modelConfidence and vector fields cannot change verdict or score', () => {
      const lowConfidence = baseInput();
      lowConfidence.assessments[0].modelConfidence = 0.01;

      const highConfidence = baseInput();
      highConfidence.assessments[0].modelConfidence = 0.99;
      const contaminatedAssessment = highConfidence.assessments[0] as ClaimEvidenceAssessment & {
        vectorSimilarity?: number;
        embeddingConfidence?: number;
      };
      contaminatedAssessment.vectorSimilarity = 0.99;
      contaminatedAssessment.embeddingConfidence = 0.98;

      const low = expectDecided(decideClaim(lowConfidence));
      const high = expectDecided(decideClaim(highConfidence));

      expect(high.verdict).toBe(low.verdict);
      expect(high.score).toBe(low.score);
      expect(high.reasonCode).toBe(low.reasonCode);
      expect(high).not.toHaveProperty('vectorSimilarity');
      expect(high).not.toHaveProperty('embeddingConfidence');
    });

    it('AC26: an untrusted synthesis proposal cannot assign verdict or score', () => {
      const input = baseInput() as DecideClaimInput & {
        proposal?: {
          recommendedVerdict: string;
          recommendedScore: number;
        };
      };
      input.proposal = {
        recommendedVerdict: 'contradicted',
        recommendedScore: 0,
      };

      const decision = expectDecided(decideClaim(input));
      expect(decision.verdict).toBe('supported');
      expect(decision.score).toBe(100);
    });

    it('AC27: every accepted record passes schema and reference validation', () => {
      const input = baseInput();
      const decision = expectDecided(decideClaim(input));

      expect(DecisionRecordSchema.safeParse(decision).success).toBe(true);
      expect(
        validateDecisionRecordReferences(
          decision,
          input.assessments,
          input.evidenceUnits,
          [input.ticket]
        )
      ).toEqual({ valid: true });
    });

    it('AC28: scores and uncertainty verdicts match public report and event contracts', () => {
      const supported = expectDecided(decideClaim(baseInput()));

      const assessedResult = {
        id: 'res_1',
        claimId: supported.claimTicketId,
        ordinal: 0,
        rawText: CLAIM_TEXT,
        state: 'assessed' as const,
        verdict: supported.verdict,
        score: supported.score,
        scoreReason: supported.scoreReason,
        reasonCode: supported.reasonCode,
        evidenceIds: supported.primaryEvidenceIds,
      };
      expect(AssessedClaimResultSchema.safeParse(assessedResult).success).toBe(true);

      const conflict = expectDecided(
        decideClaim(
          (() => {
            const input = baseInput();
            addEvidence(input, {
              evidenceId: 'evi_conflict',
              documentId: 'doc_conflict',
              text: 'SolisDB Pro plan costs £20 per month in the UK.',
              relationship: 'contradicts',
              propertyMatchStatus: {
                matching: ['jurisdiction', 'plan_tier', 'billing_term'],
                mismatched: ['price'],
                missingInEvidence: [],
              },
            });
            return input;
          })()
        )
      );
      expect(conflict.verdict).toBe('conflicting_evidence');

      for (const decision of [supported, conflict]) {
        const event = {
          type: 'claim_result' as const,
          runId: 'run_1',
          seq: 1,
          claimId: decision.claimTicketId,
          verdict: decision.verdict,
          score: decision.score,
          reasonCode: decision.reasonCode,
          scoreReason: decision.scoreReason,
          timestamp: DECIDED_AT,
        };
        expect(ClaimResultEventSchema.safeParse(event).success).toBe(true);
      }
    });

    it('AC29: identical complete input and injected time produce the same result', () => {
      const input = baseInput();
      const first = decideClaim(input);
      const second = decideClaim(input);
      expect(second).toEqual(first);
    });

    it('AC30: equivalent input ordering does not alter the decision', () => {
      const original = baseInput();
      addEvidence(original, {
        evidenceId: 'evi_opposition',
        documentId: 'doc_opposition',
        text: 'SolisDB Pro plan costs £20 per month in the UK.',
        relationship: 'contradicts',
        propertyMatchStatus: {
          matching: ['jurisdiction', 'plan_tier', 'billing_term'],
          mismatched: ['price'],
          missingInEvidence: [],
        },
      });

      const reordered = structuredClone(original);
      reordered.assessments.reverse();
      reordered.evidenceUnits.reverse();
      reordered.sourceDocuments.reverse();
      reordered.assessmentGrounding.reverse();
      reordered.evidenceTemporalProofs.reverse();
      reordered.sourceAuthority.reverse();
      reordered.transitions.reverse();
      reordered.policy.propertyRoles.reverse();

      const originalDecision = expectDecided(decideClaim(original));
      const reorderedDecision = expectDecided(decideClaim(reordered));
      expect(reorderedDecision).toEqual(originalDecision);
    });

    it('AC31: inputs remain unchanged after execution', () => {
      const input = baseInput();
      addEvidence(input, {
        evidenceId: 'evi_opposition',
        documentId: 'doc_opposition',
        text: 'SolisDB Pro plan costs £20 per month in the UK.',
        relationship: 'contradicts',
        propertyMatchStatus: {
          matching: ['jurisdiction', 'plan_tier', 'billing_term'],
          mismatched: ['price'],
          missingInEvidence: [],
        },
      });
      const snapshot = structuredClone(input);
      deepFreeze(input);

      expect(() => decideClaim(input)).not.toThrow();
      expect(input).toEqual(snapshot);
    });
  });
});
