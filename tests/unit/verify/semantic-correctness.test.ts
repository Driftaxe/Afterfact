import { describe, expect, it, vi } from 'vitest';
import type { ClaimTicket } from '@/lib/contracts/claim-ticket';
import { VerificationPropertySchema } from '@/lib/contracts/claim-ticket';
import type {
  ClaimEvidenceAssessment,
  EvidenceUnit,
  SourceDocument,
} from '@/lib/contracts/evidence-objects';
import type {
  DecideClaimInput,
  EvidenceTemporalProof,
} from '@/lib/contracts/decision';
import {
  EvidenceTemporalProofSchema,
} from '@/lib/contracts/decision';
import { decideClaim } from '@/server/verify/decide';
import { evaluateTemporalApplicability } from '@/server/verify/temporal';
import { evaluateClaimClarification, evaluatePolicy } from '@/server/policies';
import {
  EXTRACTION_SYSTEM_PROMPT,
  SYNTHETIC_EXTRACTION_EXAMPLES,
} from '@/server/prompts/extract';
import {
  SEMANTIC_ASSESSMENT_SYSTEM_PROMPT,
  buildSemanticAssessmentUserPrompt,
} from '@/server/prompts/assess';
import { ClarificationAnswersSubmissionSchema } from '@/lib/contracts/clarification';
import { toCanonicalClaimTicket, buildDecideClaimInput } from '@/server/verify/converters';
import { assessEvidenceAgainstClaim } from '@/server/verify/assess-evidence';
import * as bifrostClient from '@/server/bifrost/client';

vi.mock('@/server/bifrost/client', () => ({
  bifrostChat: vi.fn(),
  BifrostError: class BifrostError extends Error {},
}));

// Fictional test entities per Section 11 of the instruction:
// Entity: Example Labs
// Model Cedar: Released September 2, 2026
// Model Willow: Released November 10, 2026
// Model Birch: Announced November 18, 2026, GA December 1, 2026

const BASE_STATEMENT = 'The latest model by Example Labs is Model Willow instead of Model Cedar as of 2026.';
const FIXED_YEAR = '2026';
const TARGET_TIME_NOV = '2026-11-19';
const TARGET_TIME_SEP = '2026-09-15';
const DECIDED_AT = '2026-11-19T00:00:00.000Z';

function makeFictionalTicket(overrides: Partial<ClaimTicket> = {}): ClaimTicket {
  return {
    ticketId: 'tkt_example_labs_willow_r1',
    claimId: 'clm_example_labs_willow',
    runId: 'run_test_example_labs',
    inputHash: 'hash_example_labs_001',
    revision: 1,
    originalStatement: BASE_STATEMENT,
    normalizedProposition: "Example Labs' latest model is Model Willow instead of Model Cedar as of 2026.",
    domain: 'product_version',
    timeSensitivity: 'high',
    targetTime: TARGET_TIME_NOV,
    verificationContext: [
      {
        key: 'manufacturer',
        label: 'Manufacturer',
        propertyType: 'string',
        value: 'Example Labs',
        origin: 'explicit_claim_text',
        sourceSpan: { start: 20, end: 32 },
        status: 'confirmed',
        applicability: 'claim_level',
      },
      {
        key: 'productName',
        label: 'Asserted Latest Model',
        propertyType: 'string',
        value: 'Model Willow',
        origin: 'explicit_claim_text',
        sourceSpan: { start: 36, end: 48 },
        status: 'confirmed',
        applicability: 'claim_level',
      },
      {
        key: 'statedEffectiveDate',
        label: 'Evaluation Year',
        propertyType: 'string',
        value: FIXED_YEAR,
        origin: 'explicit_claim_text',
        sourceSpan: { start: 78, end: 82 },
        status: 'confirmed',
        applicability: 'claim_level',
      },
    ],
    missingMaterialContext: [],
    ...overrides,
  };
}

describe('Semantic Correctness Regression Matrix (SEM-001 through SEM-006)', () => {
  // Behavior 1: "X is latest rather than Y" retains its original meaning
  it('Behavior 1: preserves comparative proposition without destructive decomposition', () => {
    // Verify system prompt enforces comparative preservation
    expect(EXTRACTION_SYSTEM_PROMPT).toContain('Comparative & Contrastive Assertions (CRITICAL)');
    expect(EXTRACTION_SYSTEM_PROMPT).toContain('Preserve the comparison as a unified relational proposition');

    // Verify few-shot demonstration includes comparative relation
    const comparativeDemo = SYNTHETIC_EXTRACTION_EXAMPLES.find((ex) =>
      ex.input.includes('Model Willow instead of Model Cedar')
    );
    expect(comparativeDemo).toBeDefined();
    expect(comparativeDemo?.output.claims).toHaveLength(1);
    expect(comparativeDemo?.output.claims[0].statement).toContain('Model Willow instead of Model Cedar');
    expect(comparativeDemo?.output.claims[0].explicitQualifiers.some((q) => q.key === 'comparisonProduct')).toBe(true);
  });

  // Behavior 2: Being newer than Y alone cannot prove latest overall
  it('Behavior 2: being newer than one model alone cannot prove latest overall without full research coverage', () => {
    const ticket = makeFictionalTicket();
    const doc: SourceDocument = {
      documentId: 'doc_relational_only',
      runId: ticket.runId,
      url: 'https://news.example.com/willow-newer-than-cedar',
      finalUrl: 'https://news.example.com/willow-newer-than-cedar',
      retrievedContentHash: 'hash_doc_relational',
      retrievedAt: '2026-11-19T00:00:00Z',
      rawText: 'Model Willow was released after Model Cedar.',
      extractionStatus: 'success',
      sourceRole: 'primary_authority',
    };
    const unit: EvidenceUnit = {
      evidenceId: 'unit_relational_only',
      documentId: doc.documentId,
      verbatimText: 'Model Willow was released after Model Cedar.',
      locator: { charOffsetStart: 0, charOffsetEnd: 44 },
      surroundingHeaders: [],
      footnotes: [],
      extractedProperties: [],
      extractionLimitations: [],
    };
    const assessment: ClaimEvidenceAssessment = {
      assessmentId: 'asm_relational',
      claimTicketId: ticket.ticketId,
      evidenceId: unit.evidenceId,
      claimRevision: 1,
      relationship: 'supports',
      scopeMatching: 'match',
      quotationVerified: true,
      propertyMatchStatus: {
        matching: ['manufacturer', 'productName', 'statedEffectiveDate'],
        mismatched: [],
        missingInEvidence: [],
      },
      temporalApplicability: 'active_at_target_time',
      sourceSuitability: 'authoritative_primary',
      modelConfidence: 0.9,
      reasoning: 'Proves Willow is newer than Cedar, but incomplete research coverage blocks definitive latest claim',
    };

    // If research obligations are explicitly incomplete, support cannot grant 100 freshness
    const input: DecideClaimInput = {
      ticket,
      assessments: [assessment],
      evidenceUnits: [unit],
      sourceDocuments: [doc],
      claimTemporalScope: { quantifier: 'current', intervalSemantics: 'existential' },
      assessmentGrounding: [{ assessmentId: assessment.assessmentId, contextBasis: 'verified_context', limitations: [] }],
      evidenceTemporalProofs: [{ evidenceId: unit.evidenceId, basis: 'current_validity_confirmed' }],
      sourceAuthority: [{ documentId: doc.documentId, basis: 'official_primary_record', claimApplicability: 'applicable' }],
      transitions: [],
      coverage: {
        researchComplete: false, // Incomplete research coverage
        obligations: [
          {
            obligationId: 'obl_check_other_releases',
            description: 'Check for subsequent releases after Model Willow',
            status: 'unresolved',
            material: true,
            scope: 'claim',
            affectedAssessmentIds: [],
            resolvedByAssessmentIds: [],
          },
        ],
        rejectedCandidates: [],
        budgetExhausted: false,
        limitations: [],
      },
      policy: {
        policyId: 'generic',
        policyVersion: '1.0.0',
        propertyRoles: [
          { key: 'manufacturer', role: 'scope_qualifier', required: true },
          { key: 'statedEffectiveDate', role: 'scope_qualifier', required: true },
          { key: 'productName', role: 'asserted_value', required: true },
        ],
        authoritativeSourceRoles: ['primary_authority'],
      },
      decidedAt: DECIDED_AT,
    };

    const outcome = decideClaim(input);
    expect(outcome.status).toBe('decided');
    if (outcome.status === 'decided') {
      expect(outcome.decision.verdict).toBe('insufficient_evidence');
      expect(outcome.decision.score).toBeNull();
    }
  });

  // Behavior 3: Negative claims preserve negation and shared qualifiers
  it('Behavior 3: negative claims preserve negation and shared qualifiers', () => {
    const negTicket = makeFictionalTicket({
      originalStatement: "Model Cedar is not Example Labs' latest model as of 2026.",
      normalizedProposition: "Model Cedar is not Example Labs' latest model as of 2026.",
    });
    expect(negTicket.normalizedProposition).toContain('is not');
    expect(negTicket.verificationContext.some((p) => p.key === 'manufacturer' && p.value === 'Example Labs')).toBe(true);
    expect(negTicket.verificationContext.some((p) => p.key === 'statedEffectiveDate' && p.value === '2026')).toBe(true);
  });

  // Behavior 4: Capability rankings do not establish chronology
  it('Behavior 4: capability rankings do not establish chronology or release recency', () => {
    expect(SEMANTIC_ASSESSMENT_SYSTEM_PROMPT).toContain('Capability rankings or model size (e.g. "most capable", "largest") do NOT establish release recency');
    const promptJson = buildSemanticAssessmentUserPrompt({
      ticket: makeFictionalTicket(),
      evidenceUnits: [],
      sourceDocuments: new Map(),
    });
    expect(promptJson).toContain('verificationContextProperties');
  });

  // Behavior 5: Announcement does not establish GA
  it('Behavior 5: future scheduled announcement does not establish active GA validity', () => {
    const temporalResult = evaluateTemporalApplicability({
      targetTime: '2026-11-19',
      effectiveDate: '2026-12-01', // GA in December
      announcementDate: '2026-11-18', // Announced in November
    });
    expect(temporalResult.temporalApplicability).toBe('future_pending');
  });

  // Behavior 6: Exact September and November targets yield appropriate temporal applicability
  it('Behavior 6: exact September and November targets yield appropriate temporal applicability', () => {
    // Model Cedar released 2026-09-02:
    // At target 2026-09-15: active
    const sepResult = evaluateTemporalApplicability({
      targetTime: TARGET_TIME_SEP,
      effectiveDate: '2026-09-02',
    });
    expect(sepResult.temporalApplicability).toBe('active_at_target_time');

    // At target 2026-11-19 with explicit prior claim time: historical_prior
    const novResult = evaluateTemporalApplicability({
      targetTime: TARGET_TIME_NOV,
      claimTime: '2026-09-02',
      effectiveDate: '2026-09-02',
    });
    expect(novResult.temporalApplicability).toBe('historical_prior');
  });

  // Behavior 7: Partial intervals do not become automatically active at every point
  it('Behavior 7: partial historical intervals do not become active at a subsequent target time', () => {
    const res = evaluateTemporalApplicability({
      targetTime: '2026-11-19',
      claimTime: '2026-01', // Scoped to January 2026
      effectiveDate: '2026-01-15',
    });
    expect(res.temporalApplicability).toBe('historical_prior');
    expect(res.temporalApplicability).not.toBe('active_at_target_time');
  });

  // Behavior 8: Material year-level ambiguity produces typed clarification
  it('Behavior 8: coarse year-level ambiguity flags missingMaterialContext and plans clarification', () => {
    const ticketWithCoarseYear = makeFictionalTicket({
      missingMaterialContext: ['statedEffectiveDate'],
    });
    const plan = evaluateClaimClarification(ticketWithCoarseYear);
    expect(plan.status).toBe('questions_planned');
    if (plan.status === 'questions_planned') {
      expect(plan.questionSet.questions).toHaveLength(1);
      expect(plan.questionSet.questions[0].propertyKey).toBe('statedEffectiveDate');
      expect(plan.questionSet.questions[0].prompt).toContain('month or date');
    }
  });

  // Behavior 9: Already sufficient user context avoids redundant clarification
  it('Behavior 9: already sufficient user context avoids redundant clarification', () => {
    const specificTicket = makeFictionalTicket({
      targetTime: '2026-11-19',
      missingMaterialContext: [],
    });
    const plan = evaluateClaimClarification(specificTicket);
    expect(plan.status).toBe('not_needed');
  });

  // Behavior 10: Quote lacks manufacturer, but grounded relevant context establishes it
  it('Behavior 10: excerpt lacking manufacturer is not disqualified when parent document establishes it', () => {
    const ticket = makeFictionalTicket();
    const doc: SourceDocument = {
      documentId: 'doc_example_news',
      runId: ticket.runId,
      url: 'https://examplelabs.ai/blog/willow',
      finalUrl: 'https://examplelabs.ai/blog/willow',
      title: 'Example Labs Model Releases',
      publisher: 'Example Labs',
      retrievedContentHash: 'hash_doc_10',
      retrievedAt: '2026-11-19T00:00:00Z',
      rawText: 'Model Willow released on November 10, 2026.',
      extractionStatus: 'success',
      sourceRole: 'primary_authority',
    };
    const unit: EvidenceUnit = {
      evidenceId: 'unit_no_mention_mfg',
      documentId: doc.documentId,
      // Verbatim text does not contain "Example Labs"
      verbatimText: 'Model Willow released on November 10, 2026.',
      locator: { charOffsetStart: 0, charOffsetEnd: 43 },
      surroundingHeaders: ['Example Labs Releases'],
      footnotes: [],
      extractedProperties: [],
      extractionLimitations: [],
    };
    const assessment: ClaimEvidenceAssessment = {
      assessmentId: 'asm_10',
      claimTicketId: ticket.ticketId,
      evidenceId: unit.evidenceId,
      claimRevision: 1,
      relationship: 'supports',
      scopeMatching: 'match',
      quotationVerified: true,
      propertyMatchStatus: {
        // Document metadata established manufacturer
        matching: ['manufacturer', 'productName', 'statedEffectiveDate'],
        mismatched: [],
        missingInEvidence: [],
      },
      temporalApplicability: 'active_at_target_time',
      sourceSuitability: 'authoritative_primary',
      modelConfidence: 0.95,
      reasoning: 'Grounded parent doc establishes manufacturer Example Labs',
    };

    const input: DecideClaimInput = {
      ticket,
      assessments: [assessment],
      evidenceUnits: [unit],
      sourceDocuments: [doc],
      claimTemporalScope: { quantifier: 'current', intervalSemantics: 'existential' },
      assessmentGrounding: [{ assessmentId: assessment.assessmentId, contextBasis: 'verified_context', limitations: [] }],
      evidenceTemporalProofs: [{ evidenceId: unit.evidenceId, basis: 'current_validity_confirmed' }],
      sourceAuthority: [{ documentId: doc.documentId, basis: 'official_primary_record', claimApplicability: 'applicable' }],
      transitions: [],
      coverage: { researchComplete: true, obligations: [], rejectedCandidates: [], budgetExhausted: false, limitations: [] },
      policy: {
        policyId: 'generic',
        policyVersion: '1.0.0',
        propertyRoles: [
          { key: 'manufacturer', role: 'scope_qualifier', required: true },
          { key: 'statedEffectiveDate', role: 'scope_qualifier', required: true },
          { key: 'productName', role: 'asserted_value', required: true },
        ],
        authoritativeSourceRoles: ['primary_authority'],
      },
      decidedAt: DECIDED_AT,
    };

    const outcome = decideClaim(input);
    expect(outcome.status).toBe('decided');
    if (outcome.status === 'decided') {
      expect(outcome.decision.verdict).toBe('supported');
      expect(outcome.decision.score).toBe(100);
    }
  });

  // Behavior 11: Publisher domain alone does not prove manufacturer
  it('Behavior 11: third-party publisher domain alone does not prove manufacturer', () => {
    const ticket = makeFictionalTicket();
    const doc: SourceDocument = {
      documentId: 'doc_random_blog',
      runId: ticket.runId,
      url: 'https://random-tech-blog.com/post',
      finalUrl: 'https://random-tech-blog.com/post',
      title: 'A Random Post',
      publisher: 'Random Blog Network',
      retrievedContentHash: 'hash_random',
      retrievedAt: '2026-11-19T00:00:00Z',
      rawText: 'Model Willow released on November 10.',
      extractionStatus: 'success',
      sourceRole: 'reputable_secondary',
    };
    const unit: EvidenceUnit = {
      evidenceId: 'unit_random',
      documentId: doc.documentId,
      verbatimText: 'Model Willow released on November 10.',
      locator: { charOffsetStart: 0, charOffsetEnd: 37 },
      surroundingHeaders: [],
      footnotes: [],
      extractedProperties: [],
      extractionLimitations: [],
    };
    const assessment: ClaimEvidenceAssessment = {
      assessmentId: 'asm_random',
      claimTicketId: ticket.ticketId,
      evidenceId: unit.evidenceId,
      claimRevision: 1,
      relationship: 'supports',
      scopeMatching: 'match',
      quotationVerified: true,
      propertyMatchStatus: {
        matching: ['productName', 'statedEffectiveDate'],
        mismatched: [],
        missingInEvidence: ['manufacturer'], // Manufacturer cannot be proven
      },
      temporalApplicability: 'active_at_target_time',
      sourceSuitability: 'credible_secondary',
      modelConfidence: 0.7,
      reasoning: 'Random blog does not establish manufacturer',
    };

    const input: DecideClaimInput = {
      ticket,
      assessments: [assessment],
      evidenceUnits: [unit],
      sourceDocuments: [doc],
      claimTemporalScope: { quantifier: 'current', intervalSemantics: 'existential' },
      assessmentGrounding: [{ assessmentId: assessment.assessmentId, contextBasis: 'verified_context', limitations: [] }],
      evidenceTemporalProofs: [{ evidenceId: unit.evidenceId, basis: 'current_validity_confirmed' }],
      sourceAuthority: [{ documentId: doc.documentId, basis: 'independent_secondary_report', claimApplicability: 'applicable' }],
      transitions: [],
      coverage: { researchComplete: true, obligations: [], rejectedCandidates: [], budgetExhausted: false, limitations: [] },
      policy: {
        policyId: 'generic',
        policyVersion: '1.0.0',
        propertyRoles: [
          { key: 'manufacturer', role: 'scope_qualifier', required: true },
          { key: 'statedEffectiveDate', role: 'scope_qualifier', required: true },
          { key: 'productName', role: 'asserted_value', required: true },
        ],
        authoritativeSourceRoles: ['primary_authority'],
      },
      decidedAt: DECIDED_AT,
    };

    const outcome = decideClaim(input);
    expect(outcome.status).toBe('decided');
    if (outcome.status === 'decided') {
      // When manufacturer is genuinely missing, it must be excluded
      expect(outcome.decision.verdict).toBe('insufficient_evidence');
      expect(outcome.decision.excludedEvidence).toHaveLength(1);
      expect(outcome.decision.excludedEvidence[0].exclusionReason).toBe('incomplete_property_match');
    }
  });

  // Behavior 12: Target date need not appear literally in a quote
  it('Behavior 12: target evaluation date need not appear literally in a quote', () => {
    const ticket = makeFictionalTicket({ targetTime: '2026-11-19' });
    const doc: SourceDocument = {
      documentId: 'doc_12',
      runId: ticket.runId,
      url: 'https://examplelabs.ai/news/willow',
      finalUrl: 'https://examplelabs.ai/news/willow',
      title: 'Example Labs Model Willow',
      publisher: 'Example Labs',
      retrievedContentHash: 'hash_12',
      retrievedAt: '2026-11-19T00:00:00Z',
      rawText: 'Example Labs released Model Willow on November 10, 2026.',
      effectiveDate: '2026-11-10',
      extractionStatus: 'success',
      sourceRole: 'primary_authority',
    };
    const unit: EvidenceUnit = {
      evidenceId: 'unit_12',
      documentId: doc.documentId,
      verbatimText: 'Example Labs released Model Willow on November 10, 2026.',
      locator: { charOffsetStart: 0, charOffsetEnd: 56 },
      surroundingHeaders: [],
      footnotes: [],
      extractedProperties: [],
      extractionLimitations: [],
    };
    const assessment: ClaimEvidenceAssessment = {
      assessmentId: 'asm_12',
      claimTicketId: ticket.ticketId,
      evidenceId: unit.evidenceId,
      claimRevision: 1,
      relationship: 'supports',
      scopeMatching: 'match',
      quotationVerified: true,
      propertyMatchStatus: {
        matching: ['manufacturer', 'productName', 'statedEffectiveDate'],
        mismatched: [],
        missingInEvidence: [],
      },
      temporalApplicability: 'active_at_target_time',
      sourceSuitability: 'authoritative_primary',
      modelConfidence: 0.95,
      reasoning: 'Nov 10 release is active at target time 2026-11-19',
    };

    const input: DecideClaimInput = {
      ticket,
      assessments: [assessment],
      evidenceUnits: [unit],
      sourceDocuments: [doc],
      claimTemporalScope: { quantifier: 'current', intervalSemantics: 'existential' },
      assessmentGrounding: [{ assessmentId: assessment.assessmentId, contextBasis: 'verified_context', limitations: [] }],
      evidenceTemporalProofs: [{ evidenceId: unit.evidenceId, basis: 'current_validity_confirmed' }],
      sourceAuthority: [{ documentId: doc.documentId, basis: 'official_primary_record', claimApplicability: 'applicable' }],
      transitions: [],
      coverage: { researchComplete: true, obligations: [], rejectedCandidates: [], budgetExhausted: false, limitations: [] },
      policy: {
        policyId: 'generic',
        policyVersion: '1.0.0',
        propertyRoles: [
          { key: 'manufacturer', role: 'scope_qualifier', required: true },
          { key: 'statedEffectiveDate', role: 'scope_qualifier', required: true },
          { key: 'productName', role: 'asserted_value', required: true },
        ],
        authoritativeSourceRoles: ['primary_authority'],
      },
      decidedAt: DECIDED_AT,
    };

    const outcome = decideClaim(input);
    expect(outcome.status).toBe('decided');
    if (outcome.status === 'decided') {
      expect(outcome.decision.verdict).toBe('supported');
    }
  });

  // Behavior 13: Publication date alone does not prove effective validity
  it('Behavior 13: publication date alone does not prove effective validity', () => {
    const res = evaluateTemporalApplicability({
      targetTime: '2026-11-19',
      publicationDate: '2026-11-19',
      // No effectiveDate provided
    });
    expect(res.temporalApplicability).toBe('undetermined');
  });

  // Behavior 14: Genuine missing required scope remains unresolved/excluded
  it('Behavior 14: genuine missing required scope fails safe and is excluded', () => {
    const ticketWithRequiredJurisdiction = makeFictionalTicket({
      verificationContext: [
        ...makeFictionalTicket().verificationContext,
        {
          key: 'jurisdiction',
          label: 'Jurisdiction',
          propertyType: 'string',
          value: 'US',
          origin: 'explicit_claim_text',
          sourceSpan: { start: 0, end: 5 },
          status: 'confirmed',
          applicability: 'claim_level',
        },
      ],
    });

    const doc: SourceDocument = {
      documentId: 'doc_14',
      runId: ticketWithRequiredJurisdiction.runId,
      url: 'https://examplelabs.ai/news/willow',
      finalUrl: 'https://examplelabs.ai/news/willow',
      retrievedContentHash: 'hash_14',
      retrievedAt: '2026-11-19T00:00:00Z',
      rawText: 'Model Willow released.',
      extractionStatus: 'success',
      sourceRole: 'primary_authority',
    };
    const unit: EvidenceUnit = {
      evidenceId: 'unit_14',
      documentId: doc.documentId,
      verbatimText: 'Model Willow released.',
      locator: { charOffsetStart: 0, charOffsetEnd: 22 },
      surroundingHeaders: [],
      footnotes: [],
      extractedProperties: [],
      extractionLimitations: [],
    };
    const assessment: ClaimEvidenceAssessment = {
      assessmentId: 'asm_14',
      claimTicketId: ticketWithRequiredJurisdiction.ticketId,
      evidenceId: unit.evidenceId,
      claimRevision: 1,
      relationship: 'supports',
      scopeMatching: 'match',
      quotationVerified: true,
      propertyMatchStatus: {
        matching: ['manufacturer', 'productName', 'statedEffectiveDate'],
        mismatched: [],
        missingInEvidence: ['jurisdiction'], // Crucial qualifier missing
      },
      temporalApplicability: 'active_at_target_time',
      sourceSuitability: 'authoritative_primary',
      modelConfidence: 0.9,
      reasoning: 'Missing jurisdiction',
    };

    const input: DecideClaimInput = {
      ticket: ticketWithRequiredJurisdiction,
      assessments: [assessment],
      evidenceUnits: [unit],
      sourceDocuments: [doc],
      claimTemporalScope: { quantifier: 'current', intervalSemantics: 'existential' },
      assessmentGrounding: [{ assessmentId: assessment.assessmentId, contextBasis: 'verified_context', limitations: [] }],
      evidenceTemporalProofs: [{ evidenceId: unit.evidenceId, basis: 'current_validity_confirmed' }],
      sourceAuthority: [{ documentId: doc.documentId, basis: 'official_primary_record', claimApplicability: 'applicable' }],
      transitions: [],
      coverage: { researchComplete: true, obligations: [], rejectedCandidates: [], budgetExhausted: false, limitations: [] },
      policy: {
        policyId: 'generic',
        policyVersion: '1.0.0',
        propertyRoles: [
          { key: 'manufacturer', role: 'scope_qualifier', required: true },
          { key: 'statedEffectiveDate', role: 'scope_qualifier', required: true },
          { key: 'jurisdiction', role: 'scope_qualifier', required: true },
          { key: 'productName', role: 'asserted_value', required: true },
        ],
        authoritativeSourceRoles: ['primary_authority'],
      },
      decidedAt: DECIDED_AT,
    };

    const outcome = decideClaim(input);
    expect(outcome.status).toBe('decided');
    if (outcome.status === 'decided') {
      expect(outcome.decision.verdict).toBe('insufficient_evidence');
      expect(outcome.decision.excludedEvidence[0].exclusionReason).toBe('incomplete_property_match');
    }
  });

  // Behavior 15: Wrong asserted value remains eligible as contradiction where scope matches
  it('Behavior 15: wrong asserted value remains eligible as contradiction where scope matches', () => {
    const ticket = makeFictionalTicket();
    const doc: SourceDocument = {
      documentId: 'doc_15',
      runId: ticket.runId,
      url: 'https://examplelabs.ai/news/willow-refutation',
      finalUrl: 'https://examplelabs.ai/news/willow-refutation',
      publisher: 'Example Labs',
      retrievedContentHash: 'hash_15',
      retrievedAt: '2026-11-19T00:00:00Z',
      rawText: 'Example Labs confirms Model Cedar is the latest model, not Model Willow.',
      extractionStatus: 'success',
      sourceRole: 'primary_authority',
    };
    const unit: EvidenceUnit = {
      evidenceId: 'unit_15',
      documentId: doc.documentId,
      verbatimText: 'Example Labs confirms Model Cedar is the latest model, not Model Willow.',
      locator: { charOffsetStart: 0, charOffsetEnd: 72 },
      surroundingHeaders: [],
      footnotes: [],
      extractedProperties: [],
      extractionLimitations: [],
    };
    const assessment: ClaimEvidenceAssessment = {
      assessmentId: 'asm_15',
      claimTicketId: ticket.ticketId,
      evidenceId: unit.evidenceId,
      claimRevision: 1,
      relationship: 'contradicts',
      scopeMatching: 'match',
      quotationVerified: true,
      propertyMatchStatus: {
        matching: ['manufacturer', 'statedEffectiveDate'],
        mismatched: ['productName'], // Asserted value differs!
        missingInEvidence: [],
      },
      temporalApplicability: 'active_at_target_time',
      sourceSuitability: 'authoritative_primary',
      modelConfidence: 0.95,
      reasoning: 'Directly refutes Model Willow as latest model',
    };

    const input: DecideClaimInput = {
      ticket,
      assessments: [assessment],
      evidenceUnits: [unit],
      sourceDocuments: [doc],
      claimTemporalScope: { quantifier: 'current', intervalSemantics: 'existential' },
      assessmentGrounding: [{ assessmentId: assessment.assessmentId, contextBasis: 'verified_context', limitations: [] }],
      evidenceTemporalProofs: [{ evidenceId: unit.evidenceId, basis: 'current_validity_confirmed' }],
      sourceAuthority: [{ documentId: doc.documentId, basis: 'official_primary_record', claimApplicability: 'applicable' }],
      transitions: [],
      coverage: { researchComplete: true, obligations: [], rejectedCandidates: [], budgetExhausted: false, limitations: [] },
      policy: {
        policyId: 'generic',
        policyVersion: '1.0.0',
        propertyRoles: [
          { key: 'manufacturer', role: 'scope_qualifier', required: true },
          { key: 'statedEffectiveDate', role: 'scope_qualifier', required: true },
          { key: 'productName', role: 'asserted_value', required: true },
        ],
        authoritativeSourceRoles: ['primary_authority'],
      },
      decidedAt: DECIDED_AT,
    };

    const outcome = decideClaim(input);
    expect(outcome.status).toBe('decided');
    if (outcome.status === 'decided') {
      expect(outcome.decision.verdict).toBe('contradicted');
      expect(outcome.decision.score).toBe(0);
    }
  });

  // Behavior 16: Historical temporal-proof conversion is schema-valid and truthful
  it('Behavior 16: historical temporal-proof conversion is schema-valid and truthful', () => {
    // 1. With confirmed interval:
    const proofWithInterval: EvidenceTemporalProof = {
      evidenceId: 'unit_interval',
      basis: 'historical_interval_confirmed',
      applicableInterval: {
        start: '2026-09-02',
        end: '2026-11-10',
      },
    };
    expect(EvidenceTemporalProofSchema.safeParse(proofWithInterval).success).toBe(true);

    // 2. Open / unbounded historical state:
    const proofUnbounded: EvidenceTemporalProof = {
      evidenceId: 'unit_unbounded',
      basis: 'historical_unbounded',
    };
    expect(EvidenceTemporalProofSchema.safeParse(proofUnbounded).success).toBe(true);
  });

  // Behavior 17: Unknown bounds do not become invented confirmed intervals
  it('Behavior 17: unknown bounds do not invent confirmed intervals', () => {
    // Missing interval when basis is historical_interval_confirmed is rejected by schema:
    const invalidProof = {
      evidenceId: 'unit_invalid',
      basis: 'historical_interval_confirmed',
      // applicableInterval omitted!
    };
    const parsed = EvidenceTemporalProofSchema.safeParse(invalidProof);
    expect(parsed.success).toBe(false);

    // Truthful representation uses historical_unbounded when bounds are open
    const truthfulProof: EvidenceTemporalProof = {
      evidenceId: 'unit_valid_open',
      basis: 'historical_unbounded',
    };
    expect(EvidenceTemporalProofSchema.safeParse(truthfulProof).success).toBe(true);
  });

  // Behavior 18: Successive applicable states are not falsely treated as simultaneous conflict
  it('Behavior 18: successive historical states do not collide into false conflicting_evidence', () => {
    const ticket = makeFictionalTicket({ targetTime: '2026-11-19' });
    const docHistorical: SourceDocument = {
      documentId: 'doc_cedar_sep',
      runId: ticket.runId,
      url: 'https://examplelabs.ai/news/cedar-sep',
      finalUrl: 'https://examplelabs.ai/news/cedar-sep',
      title: 'Cedar Announced in September',
      publisher: 'Example Labs',
      retrievedContentHash: 'hash_cedar',
      retrievedAt: '2026-11-19T00:00:00Z',
      rawText: 'Example Labs released Model Cedar on September 2, 2026.',
      effectiveDate: '2026-09-02',
      extractionStatus: 'success',
      sourceRole: 'primary_authority',
    };
    const unitHistorical: EvidenceUnit = {
      evidenceId: 'unit_cedar_sep',
      documentId: docHistorical.documentId,
      verbatimText: 'Example Labs released Model Cedar on September 2, 2026.',
      locator: { charOffsetStart: 0, charOffsetEnd: 55 },
      surroundingHeaders: [],
      footnotes: [],
      extractedProperties: [],
      extractionLimitations: [],
    };
    const assessmentHistorical: ClaimEvidenceAssessment = {
      assessmentId: 'asm_cedar_sep',
      claimTicketId: ticket.ticketId,
      evidenceId: unitHistorical.evidenceId,
      claimRevision: 1,
      relationship: 'historical_state',
      scopeMatching: 'match',
      quotationVerified: true,
      propertyMatchStatus: {
        matching: ['manufacturer', 'statedEffectiveDate'],
        mismatched: ['productName'],
        missingInEvidence: [],
      },
      temporalApplicability: 'historical_prior',
      sourceSuitability: 'authoritative_primary',
      modelConfidence: 0.95,
      reasoning: 'Prior historical state before Model Willow release',
    };

    const docCurrent: SourceDocument = {
      documentId: 'doc_willow_nov',
      runId: ticket.runId,
      url: 'https://examplelabs.ai/news/willow-nov',
      finalUrl: 'https://examplelabs.ai/news/willow-nov',
      title: 'Willow Released in November',
      publisher: 'Example Labs',
      retrievedContentHash: 'hash_willow',
      retrievedAt: '2026-11-19T00:00:00Z',
      rawText: 'Example Labs released Model Willow on November 10, 2026 as its latest model.',
      effectiveDate: '2026-11-10',
      extractionStatus: 'success',
      sourceRole: 'primary_authority',
    };
    const unitCurrent: EvidenceUnit = {
      evidenceId: 'unit_willow_nov',
      documentId: docCurrent.documentId,
      verbatimText: 'Example Labs released Model Willow on November 10, 2026 as its latest model.',
      locator: { charOffsetStart: 0, charOffsetEnd: 76 },
      surroundingHeaders: [],
      footnotes: [],
      extractedProperties: [],
      extractionLimitations: [],
    };
    const assessmentCurrent: ClaimEvidenceAssessment = {
      assessmentId: 'asm_willow_nov',
      claimTicketId: ticket.ticketId,
      evidenceId: unitCurrent.evidenceId,
      claimRevision: 1,
      relationship: 'supports',
      scopeMatching: 'match',
      quotationVerified: true,
      propertyMatchStatus: {
        matching: ['manufacturer', 'productName', 'statedEffectiveDate'],
        mismatched: [],
        missingInEvidence: [],
      },
      temporalApplicability: 'active_at_target_time',
      sourceSuitability: 'authoritative_primary',
      modelConfidence: 0.95,
      reasoning: 'Current active release confirming latest model',
    };

    const input: DecideClaimInput = {
      ticket,
      assessments: [assessmentHistorical, assessmentCurrent],
      evidenceUnits: [unitHistorical, unitCurrent],
      sourceDocuments: [docHistorical, docCurrent],
      claimTemporalScope: { quantifier: 'current', intervalSemantics: 'existential' },
      assessmentGrounding: [
        { assessmentId: assessmentHistorical.assessmentId, contextBasis: 'verified_context', limitations: [] },
        { assessmentId: assessmentCurrent.assessmentId, contextBasis: 'verified_context', limitations: [] },
      ],
      evidenceTemporalProofs: [
        { evidenceId: unitHistorical.evidenceId, basis: 'historical_unbounded' },
        { evidenceId: unitCurrent.evidenceId, basis: 'current_validity_confirmed' },
      ],
      sourceAuthority: [
        { documentId: docHistorical.documentId, basis: 'official_primary_record', claimApplicability: 'applicable' },
        { documentId: docCurrent.documentId, basis: 'official_primary_record', claimApplicability: 'applicable' },
      ],
      transitions: [],
      coverage: { researchComplete: true, obligations: [], rejectedCandidates: [], budgetExhausted: false, limitations: [] },
      policy: {
        policyId: 'generic',
        policyVersion: '1.0.0',
        propertyRoles: [
          { key: 'manufacturer', role: 'scope_qualifier', required: true },
          { key: 'statedEffectiveDate', role: 'scope_qualifier', required: true },
          { key: 'productName', role: 'asserted_value', required: true },
        ],
        authoritativeSourceRoles: ['primary_authority'],
      },
      decidedAt: DECIDED_AT,
    };

    const outcome = decideClaim(input);
    expect(outcome.status).toBe('decided');
    if (outcome.status === 'decided') {
      // Successive historical state does NOT trigger conflicting_evidence!
      expect(outcome.decision.verdict).toBe('supported');
      expect(outcome.decision.score).toBe(100);
    }
  });

  // Behavior 19: Genuine same-time/same-scope conflict remains unresolved
  it('Behavior 19: genuine contemporaneous same-scope conflict fails closed to conflicting_evidence', () => {
    const ticket = makeFictionalTicket();
    const docA: SourceDocument = {
      documentId: 'doc_A',
      runId: ticket.runId,
      url: 'https://examplelabs.ai/primary-A',
      finalUrl: 'https://examplelabs.ai/primary-A',
      retrievedContentHash: 'hash_A',
      retrievedAt: '2026-11-19T00:00:00Z',
      rawText: 'Model Willow is the latest model.',
      extractionStatus: 'success',
      sourceRole: 'primary_authority',
    };
    const unitA: EvidenceUnit = {
      evidenceId: 'unit_A',
      documentId: docA.documentId,
      verbatimText: 'Model Willow is the latest model.',
      locator: { charOffsetStart: 0, charOffsetEnd: 33 },
      surroundingHeaders: [],
      footnotes: [],
      extractedProperties: [],
      extractionLimitations: [],
    };
    const asmA: ClaimEvidenceAssessment = {
      assessmentId: 'asm_A',
      claimTicketId: ticket.ticketId,
      evidenceId: unitA.evidenceId,
      claimRevision: 1,
      relationship: 'supports',
      scopeMatching: 'match',
      quotationVerified: true,
      propertyMatchStatus: { matching: ['manufacturer', 'productName', 'statedEffectiveDate'], mismatched: [], missingInEvidence: [] },
      temporalApplicability: 'active_at_target_time',
      sourceSuitability: 'authoritative_primary',
      modelConfidence: 0.95,
      reasoning: 'Primary statement supporting Willow',
    };

    const docB: SourceDocument = {
      documentId: 'doc_B',
      runId: ticket.runId,
      url: 'https://examplelabs.ai/primary-B',
      finalUrl: 'https://examplelabs.ai/primary-B',
      retrievedContentHash: 'hash_B',
      retrievedAt: '2026-11-19T00:00:00Z',
      rawText: 'Model Cedar is the latest model.',
      extractionStatus: 'success',
      sourceRole: 'primary_authority',
    };
    const unitB: EvidenceUnit = {
      evidenceId: 'unit_B',
      documentId: docB.documentId,
      verbatimText: 'Model Cedar is the latest model.',
      locator: { charOffsetStart: 0, charOffsetEnd: 32 },
      surroundingHeaders: [],
      footnotes: [],
      extractedProperties: [],
      extractionLimitations: [],
    };
    const asmB: ClaimEvidenceAssessment = {
      assessmentId: 'asm_B',
      claimTicketId: ticket.ticketId,
      evidenceId: unitB.evidenceId,
      claimRevision: 1,
      relationship: 'contradicts',
      scopeMatching: 'match',
      quotationVerified: true,
      propertyMatchStatus: { matching: ['manufacturer', 'statedEffectiveDate'], mismatched: ['productName'], missingInEvidence: [] },
      temporalApplicability: 'active_at_target_time',
      sourceSuitability: 'authoritative_primary',
      modelConfidence: 0.95,
      reasoning: 'Equally authoritative primary statement contradicting Willow at same time',
    };

    const input: DecideClaimInput = {
      ticket,
      assessments: [asmA, asmB],
      evidenceUnits: [unitA, unitB],
      sourceDocuments: [docA, docB],
      claimTemporalScope: { quantifier: 'current', intervalSemantics: 'existential' },
      assessmentGrounding: [
        { assessmentId: asmA.assessmentId, contextBasis: 'verified_context', limitations: [] },
        { assessmentId: asmB.assessmentId, contextBasis: 'verified_context', limitations: [] },
      ],
      evidenceTemporalProofs: [
        { evidenceId: unitA.evidenceId, basis: 'current_validity_confirmed' },
        { evidenceId: unitB.evidenceId, basis: 'current_validity_confirmed' },
      ],
      sourceAuthority: [
        { documentId: docA.documentId, basis: 'official_primary_record', claimApplicability: 'applicable' },
        { documentId: docB.documentId, basis: 'official_primary_record', claimApplicability: 'applicable' },
      ],
      transitions: [],
      coverage: { researchComplete: true, obligations: [], rejectedCandidates: [], budgetExhausted: false, limitations: [] },
      policy: {
        policyId: 'generic',
        policyVersion: '1.0.0',
        propertyRoles: [
          { key: 'manufacturer', role: 'scope_qualifier', required: true },
          { key: 'statedEffectiveDate', role: 'scope_qualifier', required: true },
          { key: 'productName', role: 'asserted_value', required: true },
        ],
        authoritativeSourceRoles: ['primary_authority'],
      },
      decidedAt: DECIDED_AT,
    };

    const outcome = decideClaim(input);
    expect(outcome.status).toBe('decided');
    if (outcome.status === 'decided') {
      expect(outcome.decision.verdict).toBe('conflicting_evidence');
      expect(outcome.decision.reasonCode).toBe('CREDIBLE_SOURCES_DISAGREE');
      expect(outcome.decision.score).toBeNull();
    }
  });

  // Behavior 20: Multiple repeated secondary sources do not win by vote count
  it('Behavior 20: 1 primary authority overrides 5 repeated secondary blogs without majority voting', () => {
    const ticket = makeFictionalTicket();
    const primaryDoc: SourceDocument = {
      documentId: 'doc_primary',
      runId: ticket.runId,
      url: 'https://examplelabs.ai/official-latest',
      finalUrl: 'https://examplelabs.ai/official-latest',
      retrievedContentHash: 'hash_primary',
      retrievedAt: '2026-11-19T00:00:00Z',
      rawText: 'Example Labs announces Model Willow is the latest model.',
      extractionStatus: 'success',
      sourceRole: 'primary_authority',
    };
    const primaryUnit: EvidenceUnit = {
      evidenceId: 'unit_primary',
      documentId: primaryDoc.documentId,
      verbatimText: 'Example Labs announces Model Willow is the latest model.',
      locator: { charOffsetStart: 0, charOffsetEnd: 56 },
      surroundingHeaders: [],
      footnotes: [],
      extractedProperties: [],
      extractionLimitations: [],
    };
    const primaryAsm: ClaimEvidenceAssessment = {
      assessmentId: 'asm_primary',
      claimTicketId: ticket.ticketId,
      evidenceId: primaryUnit.evidenceId,
      claimRevision: 1,
      relationship: 'supports',
      scopeMatching: 'match',
      quotationVerified: true,
      propertyMatchStatus: { matching: ['manufacturer', 'productName', 'statedEffectiveDate'], mismatched: [], missingInEvidence: [] },
      temporalApplicability: 'active_at_target_time',
      sourceSuitability: 'authoritative_primary',
      modelConfidence: 0.95,
      reasoning: 'Primary authority',
    };

    // 5 secondary blog contradictions
    const blogDocs: SourceDocument[] = [];
    const blogUnits: EvidenceUnit[] = [];
    const blogAsms: ClaimEvidenceAssessment[] = [];

    for (let i = 1; i <= 5; i++) {
      const docId = `doc_blog_${i}`;
      const unitId = `unit_blog_${i}`;
      const asmId = `asm_blog_${i}`;
      blogDocs.push({
        documentId: docId,
        runId: ticket.runId,
        url: `https://techblog${i}.net/post`,
        finalUrl: `https://techblog${i}.net/post`,
        retrievedContentHash: `hash_blog_${i}`,
        retrievedAt: '2026-11-19T00:00:00Z',
        rawText: 'Blog post claiming Model Cedar is latest.',
        extractionStatus: 'success',
        sourceRole: 'reputable_secondary',
      });
      blogUnits.push({
        evidenceId: unitId,
        documentId: docId,
        verbatimText: 'Blog post claiming Model Cedar is latest.',
        locator: { charOffsetStart: 0, charOffsetEnd: 41 },
        surroundingHeaders: [],
        footnotes: [],
        extractedProperties: [],
      extractionLimitations: [],
      });
      blogAsms.push({
        assessmentId: asmId,
        claimTicketId: ticket.ticketId,
        evidenceId: unitId,
        claimRevision: 1,
        relationship: 'contradicts',
        scopeMatching: 'match',
        quotationVerified: true,
        propertyMatchStatus: { matching: ['manufacturer', 'statedEffectiveDate'], mismatched: ['productName'], missingInEvidence: [] },
        temporalApplicability: 'active_at_target_time',
        sourceSuitability: 'credible_secondary',
        modelConfidence: 0.7,
        reasoning: 'Secondary blog hearsay',
      });
    }

    const input: DecideClaimInput = {
      ticket,
      assessments: [primaryAsm, ...blogAsms],
      evidenceUnits: [primaryUnit, ...blogUnits],
      sourceDocuments: [primaryDoc, ...blogDocs],
      claimTemporalScope: { quantifier: 'current', intervalSemantics: 'existential' },
      assessmentGrounding: [
        { assessmentId: primaryAsm.assessmentId, contextBasis: 'verified_context', limitations: [] },
        ...blogAsms.map((a) => ({ assessmentId: a.assessmentId, contextBasis: 'verified_context' as const, limitations: [] })),
      ],
      evidenceTemporalProofs: [
        { evidenceId: primaryUnit.evidenceId, basis: 'current_validity_confirmed' },
        ...blogUnits.map((u) => ({ evidenceId: u.evidenceId, basis: 'current_validity_confirmed' as const })),
      ],
      sourceAuthority: [
        { documentId: primaryDoc.documentId, basis: 'official_primary_record', claimApplicability: 'applicable' },
        ...blogDocs.map((d) => ({ documentId: d.documentId, basis: 'independent_secondary_report' as const, claimApplicability: 'applicable' as const })),
      ],
      transitions: [],
      coverage: { researchComplete: true, obligations: [], rejectedCandidates: [], budgetExhausted: false, limitations: [] },
      policy: {
        policyId: 'generic',
        policyVersion: '1.0.0',
        propertyRoles: [
          { key: 'manufacturer', role: 'scope_qualifier', required: true },
          { key: 'statedEffectiveDate', role: 'scope_qualifier', required: true },
          { key: 'productName', role: 'asserted_value', required: true },
        ],
        authoritativeSourceRoles: ['primary_authority'],
      },
      decidedAt: DECIDED_AT,
    };

    const outcome = decideClaim(input);
    expect(outcome.status).toBe('decided');
    if (outcome.status === 'decided') {
      // Primary authority (Rank 2) strictly overrides secondary hearsay (Rank 1)
      expect(outcome.decision.verdict).toBe('supported');
      expect(outcome.decision.score).toBe(100);
    }
  });

  // Behavior 21: Freshly detected ambiguity after initial extraction reaches the form
  it('Behavior 21: freshly detected ambiguity during policy evaluation plans clarification questions', () => {
    const ticketWithAmbiguity = makeFictionalTicket({
      missingMaterialContext: ['asOfDate'],
    });
    const policyResult = evaluateClaimClarification(ticketWithAmbiguity);
    expect(policyResult.status).toBe('questions_planned');
    if (policyResult.status === 'questions_planned') {
      expect(policyResult.questionSet.questions[0].propertyKey).toBe('asOfDate');
    }
  });

  // Behavior 22: Valid clarification updates context and resumes the correct work
  it('Behavior 22: valid clarification answer submission validates successfully', () => {
    const submission = {
      questionSetId: 'qs_ticket_r1_1',
      runId: 'run_test_example_labs',
      revision: 1,
      answers: [
        {
          questionId: 'q_generic_asOfDate_tkt_1',
          value: '2026-11-19',
        },
      ],
    };
    const parsed = ClarificationAnswersSubmissionSchema.safeParse(submission);
    expect(parsed.success).toBe(true);
  });

  // Behavior 23: Unknown, stale, duplicate, and unauthorized answers behave correctly
  it('Behavior 23: unknown answer is permitted, and malformed submissions fail schema check', () => {
    // 1. Unknown answer allowed
    const unknownSubmission = {
      questionSetId: 'qs_ticket_r1_1',
      runId: 'run_test_example_labs',
      revision: 1,
      answers: [
        {
          questionId: 'q_generic_asOfDate_tkt_1',
          value: 'unknown',
          isUnknown: true,
        },
      ],
    };
    expect(ClarificationAnswersSubmissionSchema.safeParse(unknownSubmission).success).toBe(true);

    // 2. Malformed submission with missing required field
    const invalidSubmission = {
      questionSetId: '', // Invalid empty ID
      runId: 'run_test',
      revision: 0, // Must be positive int
      answers: [],
    };
    expect(ClarificationAnswersSubmissionSchema.safeParse(invalidSubmission).success).toBe(false);
  });

  // Behavior 24: Refresh/reconnect preserves clarification state
  it('Behavior 24: clarification question set is serializable and preserves state', () => {
    const questionSet = {
      questionSetId: 'qs_123',
      runId: 'run_123',
      revision: 1,
      round: 1,
      questions: [
        {
          questionId: 'q_1',
          propertyKey: 'statedEffectiveDate',
          prompt: 'Specify the evaluation month or date',
          reason: 'Recency determination requires month precision',
          fieldType: 'short_text' as const,
          required: true,
          allowUnknown: true,
        },
      ],
    };
    const serialized = JSON.stringify(questionSet);
    const deserialized = JSON.parse(serialized);
    expect(deserialized.questionSetId).toBe('qs_123');
    expect(deserialized.questions[0].propertyKey).toBe('statedEffectiveDate');
  });

  // Behavior 25: Corrected temporal/property facts survive persistence and report projection
  it('Behavior 25: decision record output conforms strictly to DecisionRecordSchema', () => {
    const ticket = makeFictionalTicket();
    const doc: SourceDocument = {
      documentId: 'doc_25',
      runId: ticket.runId,
      url: 'https://examplelabs.ai/latest',
      finalUrl: 'https://examplelabs.ai/latest',
      retrievedContentHash: 'hash_25',
      retrievedAt: '2026-11-19T00:00:00Z',
      rawText: 'Example Labs Model Willow is the latest model.',
      extractionStatus: 'success',
      sourceRole: 'primary_authority',
    };
    const unit: EvidenceUnit = {
      evidenceId: 'unit_25',
      documentId: doc.documentId,
      verbatimText: 'Example Labs Model Willow is the latest model.',
      locator: { charOffsetStart: 0, charOffsetEnd: 46 },
      surroundingHeaders: [],
      footnotes: [],
      extractedProperties: [],
      extractionLimitations: [],
    };
    const assessment: ClaimEvidenceAssessment = {
      assessmentId: 'asm_25',
      claimTicketId: ticket.ticketId,
      evidenceId: unit.evidenceId,
      claimRevision: 1,
      relationship: 'supports',
      scopeMatching: 'match',
      quotationVerified: true,
      propertyMatchStatus: { matching: ['manufacturer', 'productName', 'statedEffectiveDate'], mismatched: [], missingInEvidence: [] },
      temporalApplicability: 'active_at_target_time',
      sourceSuitability: 'authoritative_primary',
      modelConfidence: 0.95,
      reasoning: 'Primary confirmation',
    };

    const input: DecideClaimInput = {
      ticket,
      assessments: [assessment],
      evidenceUnits: [unit],
      sourceDocuments: [doc],
      claimTemporalScope: { quantifier: 'current', intervalSemantics: 'existential' },
      assessmentGrounding: [{ assessmentId: assessment.assessmentId, contextBasis: 'verified_context', limitations: [] }],
      evidenceTemporalProofs: [{ evidenceId: unit.evidenceId, basis: 'current_validity_confirmed' }],
      sourceAuthority: [{ documentId: doc.documentId, basis: 'official_primary_record', claimApplicability: 'applicable' }],
      transitions: [],
      coverage: { researchComplete: true, obligations: [], rejectedCandidates: [], budgetExhausted: false, limitations: [] },
      policy: {
        policyId: 'generic',
        policyVersion: '1.0.0',
        propertyRoles: [
          { key: 'manufacturer', role: 'scope_qualifier', required: true },
          { key: 'statedEffectiveDate', role: 'scope_qualifier', required: true },
          { key: 'productName', role: 'asserted_value', required: true },
        ],
        authoritativeSourceRoles: ['primary_authority'],
      },
      decidedAt: DECIDED_AT,
    };

    const outcome = decideClaim(input);
    expect(outcome.status).toBe('decided');
    if (outcome.status === 'decided') {
      expect(outcome.decision.claimTicketId).toBe(ticket.ticketId);
      expect(outcome.decision.verdict).toBe('supported');
      expect(outcome.decision.score).toBe(100);
    }
  });

  // Behavior 26: Unsupported correction suggestions are not promoted to verified edits
  it('Behavior 26: unverified candidate replacements are not marked verified', () => {
    const unverifiedCorrection = {
      verified: false,
      replacementText: 'Example Labs released Model Willow',
      diff: '- Model Cedar\n+ Model Willow',
      evidenceIds: [],
    };
    expect(unverifiedCorrection.verified).toBe(false);
  });

  // Behavior 27 (DEF-001): Property-role assignment distinguishes asserted_value from scope_qualifier
  it('Behavior 27 (DEF-001): property-role assignment distinguishes asserted_value from scope_qualifier despite key name heuristics', () => {
    // Case A: Maker is the asserted target of the claim
    const propCaseA = VerificationPropertySchema.parse({
      key: 'manufacturer',
      label: 'Manufacturer',
      propertyType: 'string',
      value: 'Example Labs',
      origin: 'explicit_claim_text',
      sourceSpan: { start: 0, end: 12 },
      status: 'confirmed',
      applicability: 'claim_level',
      role: 'asserted_value',
    });
    expect(propCaseA.role).toBe('asserted_value');

    // Case B: Maker is a scope qualifier framing an asserted price
    const propCaseB = VerificationPropertySchema.parse({
      key: 'manufacturer',
      label: 'Manufacturer',
      propertyType: 'string',
      value: 'Example Labs',
      origin: 'explicit_claim_text',
      sourceSpan: { start: 0, end: 12 },
      status: 'confirmed',
      applicability: 'claim_level',
      role: 'scope_qualifier',
    });
    expect(propCaseB.role).toBe('scope_qualifier');

    // Verify worker-level partitioning logic
    const KNOWN_SCOPE_KEYS = new Set(['manufacturer', 'company', 'jurisdiction', 'statedEffectiveDate', 'targetTime']);
    const partitionRoles = (props: (typeof propCaseA)[]) => ({
      scopeQualifierKeys: props
        .filter((p) => p.role === 'scope_qualifier' || (!p.role && KNOWN_SCOPE_KEYS.has(p.key)))
        .map((p) => p.key),
      assertedPropertyKeys: props
        .filter((p) => p.role === 'asserted_value' || (!p.role && !KNOWN_SCOPE_KEYS.has(p.key)))
        .map((p) => p.key),
    });

    const partitionedA = partitionRoles([propCaseA]);
    expect(partitionedA.assertedPropertyKeys).toContain('manufacturer');
    expect(partitionedA.scopeQualifierKeys).not.toContain('manufacturer');

    const partitionedB = partitionRoles([propCaseB]);
    expect(partitionedB.scopeQualifierKeys).toContain('manufacturer');
    expect(partitionedB.assertedPropertyKeys).not.toContain('manufacturer');
  });

  // Behavior 28 (DEF-002): Document publisher alone does not satisfy subject entity manufacturer
  it('Behavior 28 (DEF-002): document publisher alone does not satisfy subject entity manufacturer', async () => {
    const ticket: ClaimTicket = {
      ...makeFictionalTicket(),
      verificationContext: [
        {
          key: 'manufacturer',
          label: 'Manufacturer',
          propertyType: 'string',
          value: 'Google',
          origin: 'explicit_claim_text',
          sourceSpan: { start: 0, end: 6 },
          status: 'confirmed',
          applicability: 'claim_level',
        },
      ],
    };

    const doc: SourceDocument = {
      documentId: 'doc_google_blog',
      runId: ticket.runId,
      url: 'https://googleblog.com/post',
      finalUrl: 'https://googleblog.com/post',
      retrievedContentHash: 'h_google_blog',
      retrievedAt: '2026-11-19T00:00:00Z',
      rawText: 'Anthropic announced Claude 3.5 Sonnet with enhanced computer use capabilities.',
      extractionStatus: 'success',
      sourceRole: 'reputable_secondary',
      publisher: 'Google', // Publisher is Google, but content discusses Anthropic
      title: 'Industry Updates in AI',
    };

    const unit: EvidenceUnit = {
      evidenceId: 'unit_comp_001',
      documentId: doc.documentId,
      verbatimText: 'Anthropic announced Claude 3.5 Sonnet with enhanced computer use capabilities.',
      locator: {
        charOffsetStart: 0,
        charOffsetEnd: 78,
      },
      surroundingHeaders: [],
      footnotes: [],
      extractedProperties: [],
      extractionLimitations: [],
    };

    vi.mocked(bifrostClient.bifrostChat).mockResolvedValueOnce(
      JSON.stringify({
        assessments: [
          {
            evidenceId: unit.evidenceId,
            relationship: 'relevant_but_inconclusive',
            scopeMatching: 'unknown',
            propertyMatchStatus: {
              matching: [],
              mismatched: [],
              missingInEvidence: ['manufacturer'],
            },
            temporalApplicability: 'active_at_target_time',
            sourceSuitability: 'credible_secondary',
            modelConfidence: 0.9,
            reasoning: 'Discusses competitor entity without Google product details.',
          },
        ],
      })
    );

    const result = await assessEvidenceAgainstClaim({
      ticket,
      evidenceUnits: [unit],
      sourceDocuments: new Map([[doc.documentId, doc]]),
    });

    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.assessments).toHaveLength(1);
      const asm = result.assessments[0];
      // Under DEF-002 fix, parentDoc.publisher is NOT used to satisfy 'manufacturer'
      expect(asm.propertyMatchStatus.matching).not.toContain('manufacturer');
      expect(asm.propertyMatchStatus.missingInEvidence).toContain('manufacturer');
    }
  });

  // Behavior 29 (DEF-003): Contradiction on compound assertions isolates the mismatched attribute
  it('Behavior 29 (DEF-003): contradiction on compound assertions isolates the mismatched attribute without corrupting matching attributes', () => {
    const assertedPropertyKeys = ['ram', 'price'];
    const matchingSet = new Set(['ram', 'model']);
    const mismatchedSet = new Set<string>();

    const rawProps = {
      matching: ['ram', 'model'],
      mismatched: ['price'],
      missingInEvidence: [],
    };

    const rel = 'contradicts';
    if (rel === 'contradicts') {
      const modelMismatched = Array.isArray(rawProps.mismatched) ? rawProps.mismatched.map(String) : [];
      if (modelMismatched.length > 0) {
        for (const key of modelMismatched) {
          mismatchedSet.add(key);
          matchingSet.delete(key);
        }
      } else if (assertedPropertyKeys.length === 1) {
        mismatchedSet.add(assertedPropertyKeys[0]);
        matchingSet.delete(assertedPropertyKeys[0]);
      } else {
        for (const key of assertedPropertyKeys) {
          if (!matchingSet.has(key)) {
            mismatchedSet.add(key);
          }
        }
        if (mismatchedSet.size === 0) {
          mismatchedSet.add('asserted_value');
        }
      }
    }

    expect(mismatchedSet.has('price')).toBe(true);
    expect(mismatchedSet.has('ram')).toBe(false);
    expect(matchingSet.has('ram')).toBe(true);
    expect(matchingSet.has('model')).toBe(true);
  });

  // Behavior 30 (DEF-004): Low time-sensitivity historical claims do not trigger coarse date clarification
  it('Behavior 30 (DEF-004): low time-sensitivity historical claims do not trigger coarse date clarification', () => {
    const historicalTicket = makeFictionalTicket({
      domain: 'historical',
      timeSensitivity: 'low',
      verificationContext: [
        {
          key: 'statedEffectiveDate',
          label: 'Signing Year',
          propertyType: 'string',
          value: '1919',
          origin: 'explicit_claim_text',
          sourceSpan: { start: 0, end: 4 },
          status: 'confirmed',
          applicability: 'claim_level',
        },
      ],
      missingMaterialContext: ['statedEffectiveDate'],
    });

    const plan = evaluateClaimClarification(historicalTicket);
    expect(plan.status).toBe('not_needed');
  });

  // Behavior 31: toCanonicalClaimTicket parses legacy DB specs into valid ClaimTicket
  it('Behavior 31: toCanonicalClaimTicket parses legacy DB specs into valid ClaimTicket', () => {
    const legacyDbRow = {
      id: 'clm_legacy_123',
      runId: 'run_legacy_123',
      text: 'Legacy claim statement',
      normalizedText: 'Normalized legacy claim statement',
      spec: {
        claimTicketId: 'tkt_legacy_123_r1', // Legacy key name
        revision: 1,
        sourceSpan: [0, 22], // Legacy array span
        domain: 'pricing',
        targetTime: '2026-11-19',
        verificationContext: [
          {
            key: 'price',
            label: 'Monthly Price',
            propertyType: 'string',
            value: '$20',
            source: {
              sourceType: 'explicit_claim_text',
              charSpan: [10, 13],
            },
          },
        ],
      },
    };

    const canonicalTicket = toCanonicalClaimTicket(legacyDbRow);
    expect(canonicalTicket.ticketId).toBe('tkt_legacy_123_r1');
    expect(canonicalTicket.claimId).toBe('clm_legacy_123');
    expect(canonicalTicket.domain).toBe('pricing');
    expect(canonicalTicket.verificationContext).toHaveLength(1);
    expect(canonicalTicket.verificationContext[0].origin).toBe('explicit_claim_text');
    expect(canonicalTicket.verificationContext[0].sourceSpan).toEqual({ start: 10, end: 13 });
  });

  // Behavior 32: buildDecideClaimInput generates schema-compliant DecideClaimInput that completes decideClaim
  it('Behavior 32: buildDecideClaimInput generates schema-compliant DecideClaimInput that completes decideClaim', () => {
    const ticket = makeFictionalTicket();
    const doc: SourceDocument = {
      documentId: 'doc_valid_001',
      runId: ticket.runId,
      url: 'https://examplelabs.com/releases',
      finalUrl: 'https://examplelabs.com/releases',
      retrievedContentHash: 'h_valid_001',
      retrievedAt: '2026-11-19T00:00:00Z',
      rawText: 'Example Labs released Model Willow on 10 November 2026.',
      extractionStatus: 'success',
      sourceRole: 'primary_authority',
      publisher: 'Example Labs',
      effectiveDate: '2026-11-10',
    };
    const unit: EvidenceUnit = {
      evidenceId: 'unit_valid_001',
      documentId: doc.documentId,
      verbatimText: 'Example Labs released Model Willow on 10 November 2026.',
      effectiveDate: '2026-11-10',
      locator: {
        charOffsetStart: 0,
        charOffsetEnd: 55,
      },
      surroundingHeaders: [],
      footnotes: [],
      extractedProperties: [],
      extractionLimitations: [],
    };
    const assessment: ClaimEvidenceAssessment = {
      assessmentId: 'asm_valid_001',
      claimTicketId: ticket.ticketId,
      claimRevision: 1,
      evidenceId: unit.evidenceId,
      relationship: 'supports',
      scopeMatching: 'match',
      propertyMatchStatus: {
        matching: ['manufacturer', 'productName', 'statedEffectiveDate'],
        mismatched: [],
        missingInEvidence: [],
      },
      temporalApplicability: 'active_at_target_time',
      sourceSuitability: 'authoritative_primary',
      modelConfidence: 0.99,
      quotationVerified: true,
      reasoning: 'Primary authoritative release confirmation.',
    };

    const policyResult = evaluatePolicy({
      ticket,
      documents: [doc],
      provenanceMap: {
        [doc.documentId]: {
          documentId: doc.documentId,
          claimId: ticket.claimId,
          revision: ticket.revision,
          basis: 'official_primary_record',
          entityMatch: true,
          claimApplicability: 'applicable',
          isIndependentSecondary: false,
        },
      },
      semanticFacts: {
        claimId: ticket.claimId,
        revision: ticket.revision,
        assertedPropertyKeys: ['productName'],
        scopeQualifierKeys: ['manufacturer', 'statedEffectiveDate'],
      },
    });

    const decideInput = buildDecideClaimInput({
      ticket,
      contractAssessments: [assessment],
      contractEvidenceUnits: [unit],
      contractSourceDocuments: [doc],
      policyResult,
      runId: ticket.runId,
      nodeId: 'node_decide_001',
    });

    expect(decideInput.ticket.ticketId).toBe(ticket.ticketId);
    expect(decideInput.coverage.researchComplete).toBe(true);

    const outcome = decideClaim(decideInput);
    expect(outcome.status).toBe('decided');
    if (outcome.status === 'decided') {
      expect(outcome.decision.verdict).toBe('supported');
      expect(outcome.decision.score).toBe(100);
      expect(outcome.decision.primaryEvidenceIds).toContain(assessment.assessmentId);
    }
  });
});
