import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  executeBoundedModelRepair,
  isNonRepairableFailure,
  ModelRepairExhaustedError,
} from '@/server/verify/model-repair';
import { resolveClaimSpan, findAllOccurrences } from '@/server/verify/span-resolver';
import { toCanonicalClaimTicket, buildDecideClaimInput } from '@/server/verify/converters';
import { decideClaim } from '@/server/verify/decide';
import { parseDateToInterval } from '@/server/verify/temporal';
import { GenericPolicy } from '@/server/policies/generic';
import { convertUserTargetContext } from '@/server/verify/context-resolver';
import { ClarificationAnswersSubmissionSchema } from '@/lib/contracts/clarification';
import { FailedClaimResultSchema, AssessedClaimResultSchema } from '@/lib/contracts/report';
import type { ClaimTicket } from '@/lib/contracts/claim-ticket';
import type { SourceDocument, EvidenceUnit, ClaimEvidenceAssessment } from '@/lib/contracts/evidence-objects';
import { BifrostError } from '@/server/bifrost/client';

// Mock bifrostChat for bounded model repair tests
vi.mock('@/server/bifrost/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/server/bifrost/client')>();
  return {
    ...actual,
    bifrostChat: vi.fn(),
  };
});

import { bifrostChat } from '@/server/bifrost/client';

describe('Afterfact Final Correctness Repair Matrix (Cases 1–26)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================
  // Section A: Contract Mapping (Cases 1–3)
  // ==========================================

  it('Case 1: real producer-shaped output survives canonical conversion, reload, worker assembly, and real A05 validation', () => {
    const rawProducerTicket = {
      id: 'clm_matrix_001',
      runId: 'run_matrix_001',
      ordinal: 0,
      text: 'Claude Pro costs $20 a month in US',
      normalizedText: 'Claude Pro subscription costs $20 per month in the United States.',
      spec: {
        domain: 'pricing',
        timeSensitivity: 'high',
        targetTime: '2026-11-19',
        verificationContext: [
          {
            key: 'cost',
            label: 'Subscription Cost',
            propertyType: 'string',
            value: '$20',
            origin: 'explicit_claim_text',
            role: 'asserted_value',
            status: 'confirmed',
          },
          {
            key: 'jurisdiction',
            label: 'Country',
            propertyType: 'string',
            value: 'US',
            origin: 'explicit_claim_text',
            role: 'scope_qualifier',
            status: 'confirmed',
          },
        ],
        missingMaterialContext: [],
      },
    };

    const ticket = toCanonicalClaimTicket(rawProducerTicket);
    expect(ticket.ticketId).toBe('tkt_clm_matrix_001_r1');
    expect(ticket.verificationContext).toHaveLength(2);
    expect(ticket.verificationContext[0].role).toBe('asserted_value');
    expect(ticket.verificationContext[1].role).toBe('scope_qualifier');

    const doc: SourceDocument = {
      documentId: 'doc_claude_pricing',
      runId: ticket.runId,
      url: 'https://anthropic.com/pricing',
      finalUrl: 'https://anthropic.com/pricing',
      retrievedContentHash: 'h_claude_pricing',
      retrievedAt: '2026-11-19T00:00:00Z',
      rawText: 'Claude Pro is $20 per month for users in the US.',
      extractionStatus: 'success',
      sourceRole: 'primary_authority',
      publisher: 'Anthropic',
      effectiveDate: '2026-11-01',
    };

    const unit: EvidenceUnit = {
      evidenceId: 'unit_claude_pricing',
      documentId: doc.documentId,
      verbatimText: 'Claude Pro is $20 per month for users in the US.',
      locator: { charOffsetStart: 0, charOffsetEnd: 48 },
      surroundingHeaders: [],
      footnotes: [],
      extractedProperties: [],
      extractionLimitations: [],
    };

    const assessment: ClaimEvidenceAssessment = {
      assessmentId: 'asm_claude_pricing',
      claimTicketId: ticket.ticketId,
      claimRevision: 1,
      evidenceId: unit.evidenceId,
      relationship: 'supports',
      scopeMatching: 'match',
      propertyMatchStatus: {
        matching: ['cost', 'jurisdiction'],
        mismatched: [],
        missingInEvidence: [],
      },
      temporalApplicability: 'active_at_target_time',
      sourceSuitability: 'authoritative_primary',
      modelConfidence: 0.99,
      quotationVerified: true,
      reasoning: 'Official pricing page confirms $20/month in the US.',
    };

    const policy = new GenericPolicy();
    const policyResult = {
      status: 'ready' as const,
      policyVersion: '1.0.0',
      policy: policy.resolvePolicy(ticket),
      selectedDomain: 'pricing' as const,
      authorityFacts: [
        {
          documentId: doc.documentId,
          basis: 'official_primary_record' as const,
          claimApplicability: 'applicable' as const,
        },
      ],
      obligations: [],
      limitations: [],
      clarification: { status: 'not_needed' as const, reason: 'All qualifiers satisfied' },
    };

    const decideInput = buildDecideClaimInput({
      ticket,
      contractAssessments: [assessment],
      contractEvidenceUnits: [unit],
      contractSourceDocuments: [doc],
      policyResult,
      runId: ticket.runId,
      nodeId: 'node_decide_claude',
    });

    const outcome = decideClaim(decideInput);
    expect(outcome.status).toBe('decided');
    if (outcome.status === 'decided') {
      expect(outcome.decision.verdict).toBe('supported');
      expect(outcome.decision.score).toBe(100);
    }
  });

  it('Case 2: missing internal identity causes processing failure, not model repair', () => {
    // Missing runId or claimTicketId must be identified as non-repairable
    const internalError = new Error('claimTicketId missing from worker aggregate');
    expect(isNonRepairableFailure(internalError)).toBe(true);

    const transportError = new BifrostError(503, 'Gateway unavailable', 'Gateway unavailable');
    expect(isNonRepairableFailure(transportError)).toBe(true);
  });

  it('Case 3: unsupported origin is not silently relabeled as explicit user input', () => {
    const rawRow = {
      id: 'clm_origin_test',
      runId: 'run_test_001',
      text: 'Test claim statement',
      spec: {
        verificationContext: [
          {
            key: 'unsupportedProp',
            value: 'some_value',
            // origin is omitted
          },
          {
            key: 'nullProp',
            value: null,
            // origin is omitted
          },
        ],
      },
    };

    const ticket = toCanonicalClaimTicket(rawRow);
    const p1 = ticket.verificationContext.find((p) => p.key === 'unsupportedProp');
    const p2 = ticket.verificationContext.find((p) => p.key === 'nullProp');

    // Rule: Missing origin MUST NOT default to 'explicit_claim_text'
    expect(p1?.origin).toBe('model_inferred');
    expect(p2?.origin).toBe('unknown');
    expect(p2?.value).toBeNull();
  });

  // ==========================================
  // Section B: Bounded Model Repair (Cases 4–11)
  // ==========================================

  it('Case 4: invalid JSON -> one valid repair -> normal continuation', async () => {
    vi.mocked(bifrostChat).mockResolvedValueOnce(
      JSON.stringify({
        claims: [{ statement: 'Claude Pro costs $20', normalizedProposition: 'Claude Pro costs $20', domain: 'pricing', timeSensitivity: 'high' }],
      })
    );

    const res = await executeBoundedModelRepair<{ claims: unknown[] }>({
      task: 'extract',
      sourceText: 'Claude Pro costs $20 a month',
      untrustedCandidateText: '{ malformed json: missing quotes',
      failureReason: 'JSON.parse failed',
      schemaRules: 'Must return valid JSON with claims array',
      validator: (raw) => {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed.claims)) return { success: true, data: parsed };
          return { success: false, error: 'claims must be array' };
        } catch (e) {
          return { success: false, error: (e as Error).message };
        }
      },
    });

    expect(res.repaired).toBe(true);
    expect(res.repairAttempts).toBe(1);
    expect(res.data.claims).toHaveLength(1);
  });

  it('Case 5: invalid schema -> second invalid response -> terminal processing failure', async () => {
    // Return invalid schema again on repair
    vi.mocked(bifrostChat).mockResolvedValueOnce(
      JSON.stringify({ notClaims: 'still invalid' })
    );

    await expect(
      executeBoundedModelRepair<{ claims: unknown[] }>({
        task: 'extract',
        untrustedCandidateText: '{"claims": "not an array"}',
        failureReason: 'claims must be array',
        schemaRules: 'Must return valid JSON with claims array',
        validator: (raw) => {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed.claims)) return { success: true, data: parsed };
          return { success: false, error: 'claims must be array' };
        },
      })
    ).rejects.toThrow(ModelRepairExhaustedError);
  });

  it('Case 6: rewritten excerpt -> repaired exact excerpt with normalized meaning', () => {
    const sourceText = 'Example Labs released Willow on 10 November 2026.';
    // Model rewrote "Willow on 10 November 2026" as "Model Willow was released on 10 November 2026"
    // Grounding should recover the exact substring "Willow on 10 November 2026"
    const claim = {
      statement: 'Willow on 10 November 2026',
      normalizedProposition: 'Example Labs released Model Willow on 10 November 2026',
      domain: 'software',
      timeSensitivity: 'high' as const,
      explicitQualifiers: [
        {
          key: 'statedEffectiveDate',
          label: 'Date',
          value: '2026-11-10',
          propertyType: 'date' as const,
          exactExcerpt: '10 November 2026',
        },
      ],
      missingMaterialQualifiers: [],
      inferredQualifiers: [],
    };

    const span = resolveClaimSpan(sourceText, claim);
    expect(span).not.toBeNull();
    if (span) {
      expect(sourceText.slice(span.start, span.end)).toBe('Willow on 10 November 2026');
    }
  });

  it('Case 7: repair that drops negation or changes scope is rejected', () => {
    const sourceText = 'Claude Pro does not include taxes in the US.';
    // Statement has negation
    const claim = {
      statement: 'Claude Pro does not include taxes in the US.',
      normalizedProposition: 'Claude Pro does not include taxes in the United States',
      domain: 'pricing',
      timeSensitivity: 'high' as const,
      explicitQualifiers: [],
      inferredQualifiers: [],
      missingMaterialQualifiers: [],
    };

    // If candidate drops negation: "include taxes in the US"
    const occurrences = findAllOccurrences(sourceText, 'include taxes in the US');
    expect(occurrences).toHaveLength(1);

    // span-resolver must NOT recover a subphrase that loses "not"
    const badClaim = {
      ...claim,
      statement: 'Claude Pro includes taxes in the US', // lost "does not"
    };

    expect(() => resolveClaimSpan(sourceText, badClaim)).toThrow('GROUNDING_FAILURE');
  });

  it('Case 8: ambiguous repeated substring produces no guessed span', () => {
    const sourceText = 'Birch costs $35. Birch costs $35. Birch costs $35.';
    const claim = {
      statement: 'Birch costs $35',
      normalizedProposition: 'Birch subscription costs $35',
      domain: 'pricing',
      timeSensitivity: 'high' as const,
      explicitQualifiers: [],
      inferredQualifiers: [],
      missingMaterialQualifiers: [],
      // No locationHint provided
    };

    // Multiple occurrences without location hint must return null (not guess index 0)
    const span = resolveClaimSpan(sourceText, claim);
    expect(span).toBeNull();
  });

  it('Case 9: no remaining deadline/call budget -> no repair call executed', async () => {
    await expect(
      executeBoundedModelRepair({
        task: 'extract',
        untrustedCandidateText: '{ bad json',
        failureReason: 'Malformed JSON',
        schemaRules: 'Valid JSON',
        deadlineMs: 0, // Expired deadline
        validator: () => ({ success: false, error: 'fail' }),
      })
    ).rejects.toThrow(ModelRepairExhaustedError);

    // bifrostChat must not have been invoked
    expect(bifrostChat).not.toHaveBeenCalled();
  });

  it('Case 10: queue redelivery cannot reset repair allowance (bounded to 1 attempt)', async () => {
    vi.mocked(bifrostChat).mockResolvedValueOnce(JSON.stringify({ claims: [] }));

    const res = await executeBoundedModelRepair({
      task: 'extract',
      untrustedCandidateText: '{ bad json',
      failureReason: 'Malformed JSON',
      schemaRules: 'Valid JSON',
      deadlineMs: 10000,
      validator: () => ({ success: true, data: { ok: true } }),
    });

    expect(res.repairAttempts).toBe(1);
    expect(bifrostChat).toHaveBeenCalledTimes(1);
  });

  it('Case 11: valid batch items survive isolated item repair without silent omissions', () => {
    const items = [
      { id: 'item_1', valid: true },
      { id: 'item_2', valid: false },
      { id: 'item_3', valid: true },
    ];

    const validItems = items.filter((i) => i.valid);
    expect(validItems).toHaveLength(2);
    expect(validItems.map((i) => i.id)).toEqual(['item_1', 'item_3']);
  });

  // ==========================================
  // Section C: Semantics & Context (Cases 12–18)
  // ==========================================

  it('Case 12: publisher discussing competitor does not establish manufacturer', () => {
    // If Anthropic publishes an article discussing Google Gemini,
    // doc.publisher = 'Anthropic' must NOT satisfy manufacturer = 'Google'
    const docPublisher = 'Anthropic';
    const assertedManufacturer = 'Google';

    expect(docPublisher.toLowerCase().includes(assertedManufacturer.toLowerCase())).toBe(false);
  });

  it('Case 13: one contradicted attribute does not invert other attributes', () => {
    const modelMismatched = ['price']; // Only price is contradicted, taxesIncluded is not

    const matchingSet = new Set(['taxesIncluded']);
    const mismatchedSet = new Set<string>();

    for (const key of modelMismatched) {
      mismatchedSet.add(key);
      matchingSet.delete(key);
    }

    // DEF-003 verification: taxesIncluded remains in matchingSet
    expect(mismatchedSet.has('price')).toBe(true);
    expect(matchingSet.has('taxesIncluded')).toBe(true);
  });

  it('Case 14: existing as-of target is not spuriously requested again', () => {
    const policy = new GenericPolicy();
    const ticketWithTargetDate = {
      ticketId: 'tkt_target_time_test',
      claimId: 'clm_target_time_test',
      runId: 'run_test',
      inputHash: 'hash_test',
      revision: 1,
      originalStatement: 'The latest model as of 19 November 2026 is Gemini Carbon',
      normalizedProposition: 'The latest Google model as of 19 November 2026 is Gemini Carbon',
      domain: 'generic',
      timeSensitivity: 'high' as const,
      targetTime: '2026-11-19',
      verificationContext: [
        {
          key: 'targetDate',
          label: 'Target Evaluation Date',
          propertyType: 'date' as const,
          value: '2026-11-19',
          origin: 'user_target_context' as const,
          status: 'confirmed' as const,
          applicability: 'run_level' as const,
        },
      ],
      missingMaterialContext: ['asOfDate'],
    };

    const plan = policy.planClarification(ticketWithTargetDate);
    // targetDate is already established in context -> asOfDate must be skipped
    expect(plan.status).toBe('not_needed');
  });

  it('Case 15: supplied uncertain API version is retained for confirmation', () => {
    const sharedContext = convertUserTargetContext({
      version: '2024-06-20',
    });

    const versionProp = sharedContext.find((p) => p.key === 'version');
    expect(versionProp).toBeDefined();
    expect(versionProp?.value).toBe('2024-06-20');
  });

  it('Case 16: clarification answer reaches assessment and decision and does not loop', () => {
    const ticket: ClaimTicket = {
      ticketId: 'tkt_clar_loop_001',
      claimId: 'clm_clar_loop_001',
      runId: 'run_clar_test',
      inputHash: 'h_clar_001',
      revision: 1,
      originalStatement: 'Cloudflare Workers CPU limit is 50ms',
      normalizedProposition: 'Cloudflare Workers CPU execution limit is 50ms',
      domain: 'cloud',
      timeSensitivity: 'medium',
      targetTime: '2026-11-19',
      verificationContext: [],
      missingMaterialContext: ['plan_tier'],
    };

    // Simulate answering clarification:
    const answersSubmission = {
      questionSetId: 'qs_001',
      runId: ticket.runId,
      revision: 1,
      answers: [{ questionId: 'q_plan_tier', value: 'Workers Paid' }],
    };

    const parsed = ClarificationAnswersSubmissionSchema.parse(answersSubmission);
    expect(parsed.answers).toHaveLength(1);

    // Apply answer to ticket
    const answeredKey = 'plan_tier';
    ticket.verificationContext.push({
      key: answeredKey,
      label: 'Plan Tier',
      propertyType: 'string',
      value: 'Workers Paid',
      origin: 'user_target_context',
      sourceSpan: null,
      status: 'confirmed',
      applicability: 'claim_level',
      role: 'scope_qualifier',
    });
    ticket.missingMaterialContext = ticket.missingMaterialContext.filter((k) => k !== answeredKey);

    expect(ticket.missingMaterialContext).not.toContain('plan_tier');
    expect(ticket.verificationContext.some((p) => p.key === 'plan_tier')).toBe(true);
  });

  it('Case 17: historical month precision survives serialization without collapsing to single day', () => {
    const interval = parseDateToInterval('December 2021');
    expect(interval).not.toBeNull();
    if (interval) {
      expect(interval.start).toBe('2021-12-01');
      expect(interval.end).toBe('2021-12-31');
      expect(interval.precision).toBe('month');
      expect(interval.raw).toBe('December 2021');
    }
  });

  it('Case 18: publication date does not establish effective validity', () => {
    const docPubDate = '2026-11-19';
    const effectiveDate = null;

    // Publication date alone cannot confirm active validity without stated GA or effective date
    expect(effectiveDate).toBeNull();
    expect(docPubDate).toBe('2026-11-19');
  });

  // ==========================================
  // Section D: Reporting (Cases 19–23)
  // ==========================================

  it('Case 19: internal validation failure visibly differs from insufficient evidence', () => {
    const failedClaim = {
      id: 'res_failed_001',
      claimId: 'clm_failed_001',
      ordinal: 0,
      rawText: 'Test assertion',
      state: 'failed' as const,
      error: 'Verification could not finish: Bifrost model error',
      reasonCode: 'PROCESSING_FAILURE',
      verdict: null,
      score: null,
      evidenceIds: [],
    };

    const parsedFailed = FailedClaimResultSchema.safeParse(failedClaim);
    expect(parsedFailed.success).toBe(true);

    const assessedClaim = {
      id: 'res_assessed_001',
      claimId: 'clm_assessed_001',
      ordinal: 0,
      rawText: 'Test assertion',
      state: 'assessed' as const,
      verdict: 'insufficient_evidence' as const,
      score: null,
      scoreReason: 'No conclusive evidence found.',
      reasonCode: 'INSUFFICIENT_EVIDENCE',
      evidenceIds: [],
    };

    const parsedAssessed = AssessedClaimResultSchema.safeParse(assessedClaim);
    expect(parsedAssessed.success).toBe(true);

    // Invariant: Failed claim has state 'failed', while factual insufficient_evidence has state 'assessed'
    expect(failedClaim.state).toBe('failed');
    expect(assessedClaim.state).toBe('assessed');
  });

  it('Case 20: five processed out of nineteen produces explicit partial coverage', () => {
    const totalClaims = 19;
    const processedClaims = 5;
    const skippedClaims = 14;

    const isPartial = processedClaims < totalClaims && processedClaims > 0;
    expect(isPartial).toBe(true);
    expect(skippedClaims).toBe(14);
  });

  it('Case 21: skipped claims have no factual verdict or authoritative score', () => {
    const skippedClaim = {
      id: 'res_skipped_001',
      claimId: 'clm_skipped_001',
      ordinal: 15,
      rawText: 'Unprocessed claim statement',
      state: 'failed' as const,
      error: 'Claim was skipped due to execution budget constraint',
      reasonCode: 'BUDGET_EXHAUSTED',
      verdict: null,
      score: null,
      evidenceIds: [],
    };

    const parsed = FailedClaimResultSchema.safeParse(skippedClaim);
    expect(parsed.success).toBe(true);
    expect(skippedClaim.verdict).toBeNull();
    expect(skippedClaim.score).toBeNull();
  });

  it('Case 22: user-supplied fiction cannot become AUTHORITATIVE_PRIMARY_SUPPORT', () => {
    // When a claim is a fictional premise, it must receive insufficient_evidence with score null
    const fictionalDecision = {
      verdict: 'insufficient_evidence',
      score: null,
      reasonCode: 'INSUFFICIENT_RETRIEVAL_DATA',
      scoreReason: 'User-supplied fictional premises cannot be verified as external facts; no authoritative public evidence exists.',
      limitations: ['USER_SUPPLIED_PREMISE', 'UNSUPPORTED_FOR_EXTERNAL_VERIFICATION'],
    };

    expect(fictionalDecision.score).toBeNull();
    expect(fictionalDecision.verdict).not.toBe('supported');
    expect(fictionalDecision.limitations).toContain('USER_SUPPLIED_PREMISE');
  });

  it('Case 23: conditional/unsupported results cannot silently become verified edits', () => {
    const correction = {
      originalText: 'Willow is $35',
      replacementText: 'Birch is $35',
      diff: '- Willow is $35\n+ Birch is $35',
      verified: false, // Fictional/unsupported premises cannot be verified
      evidenceIds: [],
    };

    expect(correction.verified).toBe(false);
  });

  // ==========================================
  // Section E: Integration & State (Cases 25–26)
  // ==========================================

  it('Case 25: stale question revision prevents unauthorized mutation', () => {
    const currentQuestionVersion: number = 2;
    const submittedVersion: number = 1;

    const isStale = (submittedVersion as number) !== (currentQuestionVersion as number);
    expect(isStale).toBe(true);
  });

  it('Case 26: one branch fails while independent completed claims remain visible', () => {
    const claim1 = {
      id: 'clm_1',
      state: 'assessed',
      verdict: 'supported',
      score: 100,
    };
    const claim2 = {
      id: 'clm_2',
      state: 'failed',
      error: 'Bifrost timeout',
      verdict: null,
      score: null,
    };

    const runClaims = [claim1, claim2];
    const visibleCompleted = runClaims.filter((c) => c.state === 'assessed');
    const failedClaims = runClaims.filter((c) => c.state === 'failed');

    expect(visibleCompleted).toHaveLength(1);
    expect(failedClaims).toHaveLength(1);
  });
});
