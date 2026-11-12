import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { ClaimTicket } from '@/lib/contracts/claim-ticket';
import type { EvidenceUnit, SourceDocument } from '@/lib/contracts/evidence-objects';
import { assessEvidenceAgainstClaim } from '@/server/verify/assess-evidence';
import * as bifrostClient from '@/server/bifrost/client';

vi.mock('@/server/bifrost/client', () => ({
  bifrostChat: vi.fn(),
  BifrostError: class BifrostError extends Error {},
}));

describe('Stage 3: Claim–Evidence Semantic Assessment (assessEvidenceAgainstClaim)', () => {
  const baseTicket: ClaimTicket = {
    ticketId: 'tkt_01j98ab7102938475610293847',
    claimId: 'clm_01j98ab7000000000000000000',
    runId: 'run_01j98ab7000000000000000000',
    inputHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    revision: 1,
    originalStatement: 'SolisDB v2 charges $15 per node per month in the EU.',
    sourceSpan: { start: 0, end: 51 },
    normalizedProposition: 'SolisDB version 2 subscription charges 15 USD per node per month in the European Union.',
    domain: 'pricing',
    targetTime: '2026-11-08',
    missingMaterialContext: [],
    verificationContext: [
      {
        key: 'jurisdiction',
        label: 'Geographic Jurisdiction',
        propertyType: 'string',
        value: 'EU',
        origin: 'explicit_claim_text',
        sourceSpan: { start: 45, end: 47 },
        status: 'confirmed',
        applicability: 'claim_level',
      },
      {
        key: 'version',
        label: 'Product Version',
        propertyType: 'string',
        value: 'v2',
        origin: 'explicit_claim_text',
        sourceSpan: { start: 8, end: 10 },
        status: 'confirmed',
        applicability: 'claim_level',
      },
    ],
  };

  const sampleSourceText = 'In the European Union, SolisDB v2 is priced at $15 per node per month.';
  const sampleDoc: SourceDocument = {
    documentId: 'doc_solis_pricing',
    runId: baseTicket.runId,
    url: 'https://solisdb.com/pricing',
    finalUrl: 'https://solisdb.com/pricing',
    retrievedContentHash: 'hash123',
    retrievedAt: '2026-11-08T12:00:00Z',
    rawText: sampleSourceText,
    extractionStatus: 'success',
    publicationDate: '2026-01-15',
    effectiveDate: '2026-02-01',
    sourceRole: 'primary_authority',
  };

  const sampleUnit: EvidenceUnit = {
    evidenceId: 'evi_solis_1',
    documentId: sampleDoc.documentId,
    verbatimText: 'In the European Union, SolisDB v2 is priced at $15 per node per month.',
    locator: {
      charOffsetStart: 0,
      charOffsetEnd: 70,
    },
    surroundingHeaders: ['Pricing'],
    footnotes: [],
    extractedProperties: [],
    effectiveDate: '2026-02-01',
    extractionLimitations: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('produces a validated ClaimEvidenceAssessment confirming direct authoritative support', async () => {
    const mockModelAssessment = {
      assessments: [
        {
          evidenceId: sampleUnit.evidenceId,
          relationship: 'supports',
          scopeMatching: 'match',
          propertyMatchStatus: {
            matching: ['jurisdiction', 'version', 'monthlyPrice'],
            mismatched: [],
            missingInEvidence: [],
          },
          temporalApplicability: 'active_at_target_time',
          sourceSuitability: 'authoritative_primary',
          modelConfidence: 0.95,
          reasoning: 'Primary vendor documentation confirms the exact $15 price in the EU.',
        },
      ],
      requiresAdditionalResearch: false,
    };

    vi.mocked(bifrostClient.bifrostChat).mockResolvedValueOnce(JSON.stringify(mockModelAssessment));

    const result = await assessEvidenceAgainstClaim({
      ticket: baseTicket,
      evidenceUnits: [sampleUnit],
      sourceDocuments: new Map([[sampleDoc.documentId, sampleDoc]]),
    });

    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.assessments.length).toBe(1);
      const asm = result.assessments[0];
      expect(asm.claimTicketId).toBe(baseTicket.ticketId);
      expect(asm.claimRevision).toBe(baseTicket.revision);
      expect(asm.evidenceId).toBe(sampleUnit.evidenceId);
      expect(asm.relationship).toBe('supports');
      expect(asm.scopeMatching).toBe('match');
      expect(asm.quotationVerified).toBe(true);
      expect(asm.sourceSuitability).toBe('authoritative_primary');
      expect(result.requiresAdditionalResearch).toBe(false);
    }
  });

  it('enforces Invariant 1: Scope mismatch cannot be classified as supports', async () => {
    // Model erroneously returns 'supports' despite a scope mismatch (e.g. US pricing)
    const mockModelAssessment = {
      assessments: [
        {
          evidenceId: sampleUnit.evidenceId,
          relationship: 'supports',
          scopeMatching: 'mismatch', // Conflicting region
          propertyMatchStatus: {
            matching: ['version'],
            mismatched: ['jurisdiction'],
            missingInEvidence: [],
          },
          reasoning: 'Mentions $15 but applies to US region only.',
        },
      ],
      requiresAdditionalResearch: true,
    };

    vi.mocked(bifrostClient.bifrostChat).mockResolvedValueOnce(JSON.stringify(mockModelAssessment));

    const result = await assessEvidenceAgainstClaim({
      ticket: baseTicket,
      evidenceUnits: [sampleUnit],
      sourceDocuments: new Map([[sampleDoc.documentId, sampleDoc]]),
    });

    expect(result.status).toBe('success');
    if (result.status === 'success') {
      const asm = result.assessments[0];
      // Clamped to relevant_but_inconclusive
      expect(asm.relationship).toBe('relevant_but_inconclusive');
      expect(asm.scopeMatching).toBe('mismatch');
    }
  });

  it('enforces Invariant 3: Future effective date is classified as future_scheduled_change', async () => {
    // Evidence announces price increase effective in 2027 (relative to targetTime 2026-11-08)
    const futureText = 'On January 1, 2027, SolisDB v2 rate will increase to $20/node in EU.';
    const futureDoc: SourceDocument = {
      ...sampleDoc,
      documentId: 'doc_future',
      rawText: futureText,
      effectiveDate: '2027-01-01',
    };
    const futureUnit: EvidenceUnit = {
      ...sampleUnit,
      evidenceId: 'evi_future',
      documentId: futureDoc.documentId,
      verbatimText: futureText,
      locator: { charOffsetStart: 0, charOffsetEnd: futureText.length },
      effectiveDate: '2027-01-01',
    };

    const mockModelAssessment = {
      assessments: [
        {
          evidenceId: futureUnit.evidenceId,
          relationship: 'contradicts', // Model improperly says contradicts
          scopeMatching: 'match',
          reasoning: 'Rate will increase to $20 in 2027.',
        },
      ],
      requiresAdditionalResearch: false,
    };

    vi.mocked(bifrostClient.bifrostChat).mockResolvedValueOnce(JSON.stringify(mockModelAssessment));

    const result = await assessEvidenceAgainstClaim({
      ticket: baseTicket,
      evidenceUnits: [futureUnit],
      sourceDocuments: new Map([[futureDoc.documentId, futureDoc]]),
    });

    expect(result.status).toBe('success');
    if (result.status === 'success') {
      const asm = result.assessments[0];
      // Deterministically clamped to future_scheduled_change
      expect(asm.relationship).toBe('future_scheduled_change');
      expect(asm.temporalApplicability).toBe('future_pending');
    }
  });

  it('preserves valid conflicting evidence without suppressing disagreement', async () => {
    const contraText = 'In the EU, SolisDB v2 price is $25 per node per month.';
    const contradictionDoc: SourceDocument = {
      ...sampleDoc,
      documentId: 'doc_contra',
      rawText: contraText,
    };
    const contraUnit: EvidenceUnit = {
      ...sampleUnit,
      evidenceId: 'evi_contra',
      documentId: contradictionDoc.documentId,
      verbatimText: contraText,
      locator: { charOffsetStart: 0, charOffsetEnd: contraText.length },
    };

    const mockAssessmentWithConflict = {
      assessments: [
        {
          evidenceId: sampleUnit.evidenceId,
          relationship: 'supports',
          scopeMatching: 'match',
          reasoning: 'Confirmed $15 price.',
        },
        {
          evidenceId: contraUnit.evidenceId,
          relationship: 'contradicts',
          scopeMatching: 'match',
          reasoning: 'Contradicts: asserts $25 price.',
        },
      ],
      requiresAdditionalResearch: false,
    };

    vi.mocked(bifrostClient.bifrostChat).mockResolvedValueOnce(JSON.stringify(mockAssessmentWithConflict));

    const result = await assessEvidenceAgainstClaim({
      ticket: baseTicket,
      evidenceUnits: [sampleUnit, contraUnit],
      sourceDocuments: new Map([
        [sampleDoc.documentId, sampleDoc],
        [contradictionDoc.documentId, contradictionDoc],
      ]),
    });

    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.assessments.length).toBe(2);
      expect(result.assessments[0].relationship).toBe('supports');
      expect(result.assessments[1].relationship).toBe('contradicts');
      // Conflicting evidence triggers requiresAdditionalResearch
      expect(result.requiresAdditionalResearch).toBe(true);
      expect(result.additionalResearchReasons).toContain(
        'Discovered direct contradiction between evaluated evidence sources'
      );
    }
  });

  it('discards ungrounded candidate units before invoking Bifrost', async () => {
    const ungroundedUnit: EvidenceUnit = {
      ...sampleUnit,
      evidenceId: 'evi_ungrounded',
      verbatimText: 'Text not present in source document.',
      locator: { charOffsetStart: 0, charOffsetEnd: 36 },
    };

    const result = await assessEvidenceAgainstClaim({
      ticket: baseTicket,
      evidenceUnits: [ungroundedUnit],
      sourceDocuments: new Map([[sampleDoc.documentId, sampleDoc]]),
    });

    expect(result.status).toBe('no_evidence_assessed');
    expect(bifrostClient.bifrostChat).not.toHaveBeenCalled();
  });

  it('returns no_evidence_assessed when empty evidenceUnits list is provided', async () => {
    const result = await assessEvidenceAgainstClaim({
      ticket: baseTicket,
      evidenceUnits: [],
      sourceDocuments: new Map([[sampleDoc.documentId, sampleDoc]]),
    });

    expect(result.status).toBe('no_evidence_assessed');
    expect(bifrostClient.bifrostChat).not.toHaveBeenCalled();
  });

  it('enforces deterministic 1:1 mapping by discarding duplicate assessments for the same evidenceId', async () => {
    const mockModelWithDuplicate = {
      assessments: [
        {
          evidenceId: sampleUnit.evidenceId,
          relationship: 'supports',
          scopeMatching: 'match',
          reasoning: 'Initial evaluation confirms $15 price.',
        },
        {
          evidenceId: sampleUnit.evidenceId,
          relationship: 'contradicts',
          scopeMatching: 'match',
          reasoning: 'Duplicate contradictory proposal for the exact same evidence unit.',
        },
      ],
      requiresAdditionalResearch: false,
    };

    vi.mocked(bifrostClient.bifrostChat).mockResolvedValueOnce(JSON.stringify(mockModelWithDuplicate));

    const result = await assessEvidenceAgainstClaim({
      ticket: baseTicket,
      evidenceUnits: [sampleUnit],
      sourceDocuments: new Map([[sampleDoc.documentId, sampleDoc]]),
    });

    expect(result.status).toBe('success');
    if (result.status === 'success') {
      // Exactly 1 assessment retained for sampleUnit.evidenceId
      expect(result.assessments.length).toBe(1);
      expect(result.assessments[0].evidenceId).toBe(sampleUnit.evidenceId);
      expect(result.assessments[0].relationship).toBe('supports');
      // Duplicate was discarded with audit explanation
      expect(result.discardedAssessments.length).toBe(1);
      expect(result.discardedAssessments[0].evidenceId).toBe(sampleUnit.evidenceId);
      expect(result.discardedAssessments[0].reason).toContain('Duplicate assessment');
    }
  });

  it('preserves model-evaluated historical_prior or undetermined status without unjustified overrides', async () => {
    const mockModelAssessment = {
      assessments: [
        {
          evidenceId: sampleUnit.evidenceId,
          relationship: 'historical_state',
          scopeMatching: 'match',
          temporalApplicability: 'historical_prior',
          reasoning: 'Evidence describes a former pricing tier that has since expired.',
        },
      ],
      requiresAdditionalResearch: false,
    };

    vi.mocked(bifrostClient.bifrostChat).mockResolvedValueOnce(JSON.stringify(mockModelAssessment));

    const result = await assessEvidenceAgainstClaim({
      ticket: baseTicket,
      evidenceUnits: [sampleUnit],
      sourceDocuments: new Map([[sampleDoc.documentId, sampleDoc]]),
    });

    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.assessments[0].temporalApplicability).toBe('historical_prior');
      expect(result.assessments[0].relationship).toBe('historical_state');
    }
  });

  it('marks assessment temporalApplicability as undetermined when evidence has only publication date', async () => {
    const pubOnlyDoc: SourceDocument = {
      ...sampleDoc,
      documentId: 'doc_pub_only',
      publicationDate: '2023-05-01',
      effectiveDate: null,
    };
    const pubOnlyUnit: EvidenceUnit = {
      ...sampleUnit,
      evidenceId: 'evi_pub_only',
      documentId: pubOnlyDoc.documentId,
      publicationDate: '2023-05-01',
      effectiveDate: null,
    };

    const mockModelAssessment = {
      assessments: [
        {
          evidenceId: pubOnlyUnit.evidenceId,
          relationship: 'supports',
          scopeMatching: 'match',
          temporalApplicability: 'active_at_target_time', // Model claims active, but only publication date exists
          reasoning: 'Published in 2023.',
        },
      ],
      requiresAdditionalResearch: false,
    };

    vi.mocked(bifrostClient.bifrostChat).mockResolvedValueOnce(JSON.stringify(mockModelAssessment));

    const result = await assessEvidenceAgainstClaim({
      ticket: baseTicket,
      evidenceUnits: [pubOnlyUnit],
      sourceDocuments: new Map([[pubOnlyDoc.documentId, pubOnlyDoc]]),
    });

    expect(result.status).toBe('success');
    if (result.status === 'success') {
      // Publication date alone cannot establish active validity; falls back to undetermined
      expect(result.assessments[0].temporalApplicability).toBe('undetermined');
    }
  });
});
