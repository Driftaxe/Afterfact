import { describe, it, expect } from 'vitest';
import { decideClaim } from '@/server/verify/decide';
import type { DecideClaimInput } from '@/lib/contracts/decision';
import { RegulationPolicy } from '@/server/policies/regulation';

function expectDecided(outcome: ReturnType<typeof decideClaim>) {
  if (outcome.status === 'invalid_input') {
    console.error('INVALID INPUT ISSUES:', JSON.stringify(outcome.issues, null, 2));
  }
  expect(outcome.status).toBe('decided');
  if (outcome.status !== 'decided') {
    throw new Error(`Expected decided outcome, received ${outcome.status}`);
  }
  return outcome.decision;
}

describe('DecideClaim Gate Purity: Predicate Contradiction vs Scope Qualifier Gate', () => {
  const policyModule = new RegulationPolicy();

  it('allows contradiction when scope matches even if fabricated flat fee amount is absent/disputed in evidence', () => {
    const runId = 'run_test_ca';
    const text = 'Every corporation incorporated, registered, or doing business in California is subject to the $800 annual minimum franchise tax for the taxable year.';

    const ticket = {
      ticketId: 'tkt_statutory_levy',
      claimId: 'claim_statutory_levy',
      runId,
      inputHash: 'input_hash_ca_1',
      revision: 1,
      originalStatement: 'In California, corporations must pay a flat compliance fee of $2,500 regardless of size',
      normalizedProposition: 'In California, corporations must pay a flat compliance fee of $2,500 regardless of company size.',
      targetTime: '2026-11-20T12:00:00Z',
      domain: 'regulation',
      verificationContext: [
        {
          key: 'jurisdiction',
          label: 'Jurisdiction',
          propertyType: 'string' as const,
          value: 'California',
          origin: 'explicit_claim_text' as const,
          sourceSpan: { start: 3, end: 13 },
          status: 'confirmed' as const,
          applicability: 'claim_level' as const,
          role: 'scope_qualifier' as const,
        },
        {
          key: 'feeAmount',
          label: 'Fee Amount',
          propertyType: 'number' as const,
          value: 2500,
          origin: 'explicit_claim_text' as const,
          sourceSpan: { start: 62, end: 68 },
          status: 'confirmed' as const,
          applicability: 'claim_level' as const,
          role: 'asserted_value' as const,
        },
      ],
      provenance: { sourceType: 'user_prompt' as const, extractedAt: '2026-11-20T12:00:00Z' },
      temporalSensitivity: { cadence: 'medium' as const, confidence: 0.9 },
      missingMaterialContext: [],
    };

    const resolvedPolicy = policyModule.resolvePolicy(ticket);

    const input: DecideClaimInput = {
      decidedAt: '2026-11-20T12:00:00Z',
      claimTemporalScope: { quantifier: 'current', intervalSemantics: 'throughout' },
      transitions: [],
      ticket,
      policy: resolvedPolicy,
      sourceDocuments: [
        {
          documentId: 'doc_ftb_ca',
          runId,
          url: 'https://www.ftb.ca.gov/file/business/types/corporations/index.html',
          finalUrl: 'https://www.ftb.ca.gov/file/business/types/corporations/index.html',
          retrievedContentHash: 'hash_ftb_ca',
          retrievedAt: '2026-11-20T12:00:00Z',
          extractionStatus: 'success',
          sourceRole: 'primary_authority',
          rawText: text,
        },
      ],
      evidenceUnits: [
        {
          evidenceId: 'unit_ftb_1',
          documentId: 'doc_ftb_ca',
          verbatimText: text,
          locator: { charOffsetStart: 0, charOffsetEnd: text.length },
          surroundingHeaders: [],
          footnotes: [],
          extractedProperties: [],
          extractionLimitations: [],
        },
      ],
      assessments: [
        {
          assessmentId: 'asm_1',
          claimTicketId: ticket.ticketId,
          evidenceId: 'unit_ftb_1',
          claimRevision: 1,
          relationship: 'contradicts',
          scopeMatching: 'match',
          quotationVerified: true,
          propertyMatchStatus: {
            matching: ['jurisdiction'],
            mismatched: ['feeAmount'],
            missingInEvidence: [],
          },
          temporalApplicability: 'active_at_target_time',
          sourceSuitability: 'authoritative_primary',
          modelConfidence: 0.95,
          reasoning: 'Evidence proves California franchise tax is $800, contradicting the asserted flat $2,500 fee.',
        },
      ],
      assessmentGrounding: [
        {
          assessmentId: 'asm_1',
          contextBasis: 'quotation_only',
          limitations: [],
        },
      ],
      evidenceTemporalProofs: [
        {
          evidenceId: 'unit_ftb_1',
          basis: 'current_validity_confirmed',
          applicableInterval: null,
        },
      ],
      sourceAuthority: [
        {
          documentId: 'doc_ftb_ca',
          basis: 'official_primary_record',
          claimApplicability: 'applicable',
        },
      ],
      coverage: {
        obligations: [],
        researchComplete: true,
        rejectedCandidates: [],
        budgetExhausted: false,
        limitations: [],
      },
    };

    const outcome = decideClaim(input);
    const decision = expectDecided(outcome);

    expect(decision.verdict).toBe('contradicted');
    expect(decision.score).toBe(0);
    expect(decision.reasonCode).toBe('DECISIVE_CONTRADICTION');
  });

  it('fails closed under wrong_scope if a scope qualifier does not match', () => {
    const runId = 'run_test_ny';
    const text = 'New York State corporation tax is based on business income base.';

    const ticket = {
      ticketId: 'tkt_statutory_levy_scope',
      claimId: 'claim_statutory_levy_scope',
      runId,
      inputHash: 'input_hash_ny_1',
      revision: 1,
      originalStatement: 'In California, corporations must pay a flat compliance fee of $2,500',
      normalizedProposition: 'In California, corporations must pay a flat compliance fee of $2,500.',
      targetTime: '2026-11-20T12:00:00Z',
      domain: 'regulation',
      verificationContext: [
        {
          key: 'jurisdiction',
          label: 'Jurisdiction',
          propertyType: 'string' as const,
          value: 'California',
          origin: 'explicit_claim_text' as const,
          sourceSpan: { start: 3, end: 13 },
          status: 'confirmed' as const,
          applicability: 'claim_level' as const,
          role: 'scope_qualifier' as const,
        },
      ],
      provenance: { sourceType: 'user_prompt' as const, extractedAt: '2026-11-20T12:00:00Z' },
      temporalSensitivity: { cadence: 'medium' as const, confidence: 0.9 },
      missingMaterialContext: [],
    };

    const resolvedPolicy = policyModule.resolvePolicy(ticket);

    const input: DecideClaimInput = {
      decidedAt: '2026-11-20T12:00:00Z',
      claimTemporalScope: { quantifier: 'current', intervalSemantics: 'throughout' },
      transitions: [],
      ticket,
      policy: resolvedPolicy,
      sourceDocuments: [
        {
          documentId: 'doc_ny_tax',
          runId,
          url: 'https://tax.ny.gov/bus/ct/ct3.htm',
          finalUrl: 'https://tax.ny.gov/bus/ct/ct3.htm',
          retrievedContentHash: 'hash_ny_tax',
          retrievedAt: '2026-11-20T12:00:00Z',
          extractionStatus: 'success',
          sourceRole: 'primary_authority',
          rawText: text,
        },
      ],
      evidenceUnits: [
        {
          evidenceId: 'unit_ny_1',
          documentId: 'doc_ny_tax',
          verbatimText: text,
          locator: { charOffsetStart: 0, charOffsetEnd: text.length },
          surroundingHeaders: [],
          footnotes: [],
          extractedProperties: [],
          extractionLimitations: [],
        },
      ],
      assessments: [
        {
          assessmentId: 'asm_scope_mismatch',
          claimTicketId: ticket.ticketId,
          evidenceId: 'unit_ny_1',
          claimRevision: 1,
          relationship: 'contradicts',
          scopeMatching: 'mismatch',
          quotationVerified: true,
          propertyMatchStatus: {
            matching: [],
            mismatched: ['jurisdiction'],
            missingInEvidence: [],
          },
          temporalApplicability: 'active_at_target_time',
          sourceSuitability: 'authoritative_primary',
          modelConfidence: 0.9,
          reasoning: 'Evidence describes New York, not California.',
        },
      ],
      assessmentGrounding: [
        {
          assessmentId: 'asm_scope_mismatch',
          contextBasis: 'quotation_only',
          limitations: [],
        },
      ],
      evidenceTemporalProofs: [
        {
          evidenceId: 'unit_ny_1',
          basis: 'current_validity_confirmed',
          applicableInterval: null,
        },
      ],
      sourceAuthority: [
        {
          documentId: 'doc_ny_tax',
          basis: 'official_primary_record',
          claimApplicability: 'applicable',
        },
      ],
      coverage: {
        obligations: [],
        researchComplete: true,
        rejectedCandidates: [],
        budgetExhausted: false,
        limitations: [],
      },
    };

    const outcome = decideClaim(input);
    const decision = expectDecided(outcome);

    expect(decision.verdict).toBe('insufficient_evidence');
    expect(decision.score).toBeNull();
  });
});
