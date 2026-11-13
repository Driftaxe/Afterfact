import { describe, expect, it } from 'vitest';
import type { ClaimTicket } from '@/lib/contracts/claim-ticket';
import type {
  ClaimEvidenceAssessment,
  EvidenceUnit,
  SourceDocument,
} from '@/lib/contracts/evidence-objects';
import type {
  DecisionRecord,
  TransitionProof,
} from '@/lib/contracts/decision';
import { ReportSchema } from '@/lib/contracts/report';
import {
  composeTimeline,
  createExactSpanEdit,
  draftSurgicalReplacement,
  isCorrectionEligible,
  orchestrateClaimCorrection,
  reconcileMultipleEdits,
  reconstructCandidate,
  reverifyCandidate,
} from '@/server/verify';

function makeClaimTicket(overrides: Partial<ClaimTicket> = {}): ClaimTicket {
  return {
    ticketId: 'tkt_twitter_01',
    claimId: 'clm_twitter_01',
    runId: 'run_test_01',
    inputHash: 'hash_test_01',
    revision: 1,
    originalStatement: 'Parag Agrawal is the current CEO of Twitter',
    sourceSpan: { start: 0, end: 43 },
    normalizedProposition: 'Parag Agrawal is the Chief Executive Officer of Twitter, Inc.',
    domain: 'leadership',
    targetTime: '2024-09-01T00:00:00.000Z',
    verificationContext: [
      {
        key: 'organization',
        label: 'Organization',
        propertyType: 'string',
        value: 'Twitter',
        origin: 'explicit_claim_text',
        sourceSpan: { start: 36, end: 43 },
        status: 'confirmed',
        applicability: 'claim_level',
      },
      {
        key: 'title',
        label: 'Title',
        propertyType: 'string',
        value: 'CEO',
        origin: 'explicit_claim_text',
        sourceSpan: { start: 27, end: 30 },
        status: 'confirmed',
        applicability: 'claim_level',
      },
      {
        key: 'person',
        label: 'Person',
        propertyType: 'string',
        value: 'Parag Agrawal',
        origin: 'explicit_claim_text',
        sourceSpan: { start: 0, end: 13 },
        status: 'confirmed',
        applicability: 'claim_level',
      },
    ],
    missingMaterialContext: [],
    ...overrides,
  };
}

function makeDecisionRecord(overrides: Partial<DecisionRecord> = {}): DecisionRecord {
  return {
    recordId: 'dec_test_01',
    claimTicketId: 'tkt_twitter_01',
    claimRevision: 1,
    appliedPolicy: 'leadership@1.0.0',
    verdict: 'outdated',
    score: 0,
    reasonCode: 'SUPERSEDED_HISTORICAL_CLAIM',
    scoreReason: 'Earlier validity superseded by documented transition.',
    primaryEvidenceIds: ['evi_parag_2021', 'evi_linda_2023'],
    counterEvidenceIds: ['evi_linda_2023'],
    excludedEvidence: [],
    extractedQualifiers: [],
    temporalBasis: {
      targetTime: '2024-09-01T00:00:00.000Z',
      effectiveDate: '2023-06-05',
      transitionEventDate: '2022-10-27',
    },
    traceIds: {},
    limitations: [],
    ...overrides,
  };
}

function makeEvidenceUnit(overrides: Partial<EvidenceUnit> = {}): EvidenceUnit {
  return {
    evidenceId: 'evi_linda_2023',
    documentId: 'doc_sec_8k',
    verbatimText: 'Linda Yaccarino was appointed Chief Executive Officer of Twitter/X effective June 5, 2023.',
    locator: { charOffsetStart: 0, charOffsetEnd: 90 },
    surroundingHeaders: ['Executive Leadership'],
    footnotes: [],
    extractedProperties: [],
    publicationDate: '2023-05-12',
    effectiveDate: '2023-06-05',
    extractionLimitations: [],
    ...overrides,
  };
}

describe('Ticket A07: Evidence-Backed Timelines, Surgical Corrections & Re-Verification', () => {
  // =========================================================================
  // 1. TIMELINE COMPOSITION (transition.ts)
  // =========================================================================
  describe('Timeline Composition (composeTimeline)', () => {
    it('produces grounded cited entries for established historical, transition, and current states', () => {
      const ticket = makeClaimTicket();
      const decision = makeDecisionRecord();

      const unitPrior = makeEvidenceUnit({
        evidenceId: 'evi_parag_2021',
        verbatimText: 'Twitter appoints Parag Agrawal as CEO.',
        publicationDate: '2021-11-29',
        effectiveDate: '2021-11-29',
      });

      const unitCurrent = makeEvidenceUnit({
        evidenceId: 'evi_linda_2023',
        verbatimText: 'Linda Yaccarino officially begins tenure as CEO of Twitter.',
        publicationDate: '2023-05-12',
        effectiveDate: '2023-06-05',
      });

      const assessmentPrior: ClaimEvidenceAssessment = {
        assessmentId: 'asm_prior',
        claimTicketId: ticket.ticketId,
        claimRevision: ticket.revision,
        evidenceId: unitPrior.evidenceId,
        relationship: 'supports',
        scopeMatching: 'match',
        quotationVerified: true,
        propertyMatchStatus: { matching: ['person'], mismatched: [], missingInEvidence: [] },
        temporalApplicability: 'historical_prior',
        sourceSuitability: 'authoritative_primary',
        reasoning: 'Prior tenure verified.',
      };

      const assessmentSuper: ClaimEvidenceAssessment = {
        assessmentId: 'asm_super',
        claimTicketId: ticket.ticketId,
        claimRevision: ticket.revision,
        evidenceId: unitCurrent.evidenceId,
        relationship: 'contradicts',
        scopeMatching: 'match',
        quotationVerified: true,
        propertyMatchStatus: { matching: ['title'], mismatched: ['person'], missingInEvidence: [] },
        temporalApplicability: 'active_at_target_time',
        sourceSuitability: 'authoritative_primary',
        reasoning: 'Current tenure verified.',
      };

      const transition: TransitionProof = {
        transitionId: 'trn_01',
        claimTicketId: ticket.ticketId,
        claimRevision: ticket.revision,
        priorAssessmentId: 'asm_prior',
        supersedingAssessmentId: 'asm_super',
        effectiveDate: '2022-10-27',
        entityAndScopeMatch: 'match',
        basis: 'documented_effective_change',
      };

      const result = composeTimeline({
        ticket,
        decision,
        evidenceUnits: [unitPrior, unitCurrent],
        transitions: [transition],
        assessments: [assessmentPrior, assessmentSuper],
        asOfDate: '2024-09-01',
      });

      expect(result.timeline.length).toBeGreaterThanOrEqual(3);
      const states = result.timeline.map((e) => e.state);
      expect(states).toContain('historical');
      expect(states).toContain('transition');
      expect(states).toContain('current');

      // Check date ordering: 2021-11-29 < 2022-10-27 < 2023-06-05
      const dates = result.timeline.map((e) => e.effectiveDate);
      expect(dates[0]).toBe('2021-11-29');
      expect(dates[1]).toBe('2022-10-27');
      expect(dates[2]).toBe('2023-06-05');
    });

    it('classifies a future effective date as upcoming (Scheduled change) relative to fixed target', () => {
      const ticket = makeClaimTicket({ targetTime: '2024-09-01T00:00:00.000Z' });
      const decision = makeDecisionRecord({
        verdict: 'supported',
        score: 100,
        primaryEvidenceIds: ['evi_future_law'],
      });

      const unitFuture = makeEvidenceUnit({
        evidenceId: 'evi_future_law',
        effectiveDate: '2025-08-02',
        publicationDate: '2024-07-12',
        verbatimText: 'General-Purpose AI governance obligations take full effect.',
      });

      const result = composeTimeline({
        ticket,
        decision,
        evidenceUnits: [unitFuture],
        asOfDate: '2024-09-01',
      });

      expect(result.hasUpcomingChange).toBe(true);
      expect(result.upcomingEffectiveDate).toBe('2025-08-02');
      expect(result.timeline).toHaveLength(1);
      expect(result.timeline[0].state).toBe('upcoming');
      expect(result.timeline[0].effectiveDate).toBe('2025-08-02');
      expect(result.timeline[0].announcementDate).toBe('2024-07-12');
    });

    it('preserves partial dates (YYYY, YYYY-MM) without artificial midnight or day padding', () => {
      const ticket = makeClaimTicket();
      const decision = makeDecisionRecord({
        verdict: 'supported',
        score: 100,
        primaryEvidenceIds: ['evi_partial_date'],
      });

      const unitPartial = makeEvidenceUnit({
        evidenceId: 'evi_partial_date',
        effectiveDate: '2021', // Year-only partial date
        publicationDate: '2021-06', // Month-only partial date
        verbatimText: 'Platform initiated operations in 2021.',
      });

      const result = composeTimeline({
        ticket,
        decision,
        evidenceUnits: [unitPartial],
      });

      expect(result.timeline[0].effectiveDate).toBe('2021');
      expect(result.timeline[0].announcementDate).toBe('2021-06');
    });

    it('missing transition proof produces limitation without rewriting original decision', () => {
      const ticket = makeClaimTicket();
      const decision = makeDecisionRecord({
        verdict: 'outdated',
        primaryEvidenceIds: ['evi_linda_2023'],
      });

      const unit = makeEvidenceUnit();

      const result = composeTimeline({
        ticket,
        decision,
        evidenceUnits: [unit],
        transitions: [], // No transition proof provided
      });

      expect(result.limitations.some((l) => l.includes('TransitionProof'))).toBe(true);
      // Original decision must be completely untouched
      expect(decision.verdict).toBe('outdated');
    });

    it('disallows dangling evidence ID references in timeline entries', () => {
      const ticket = makeClaimTicket();
      const decision = makeDecisionRecord({
        verdict: 'supported',
        score: 100,
        primaryEvidenceIds: ['evi_ghost_id_404'],
      });

      const result = composeTimeline({
        ticket,
        decision,
        evidenceUnits: [], // Empty
      });

      expect(result.timeline).toHaveLength(0);
      expect(result.limitations.some((l) => l.includes('not found in provided evidence units'))).toBe(true);
    });
  });

  // =========================================================================
  // 2. CORRECTION ELIGIBILITY & DRAFTING (correction.ts)
  // =========================================================================
  describe('Correction Eligibility (isCorrectionEligible)', () => {
    it('outdated claim with replacement evidence is ELIGIBLE', () => {
      const ticket = makeClaimTicket();
      const decision = makeDecisionRecord({ verdict: 'outdated' });
      const unit = makeEvidenceUnit();

      const res = isCorrectionEligible(ticket, decision, [unit]);
      expect(res.eligible).toBe(true);
      expect(res.replacementBasis).toBeDefined();
    });

    it('contradicted claim with replacement evidence is ELIGIBLE', () => {
      const ticket = makeClaimTicket();
      const decision = makeDecisionRecord({
        verdict: 'contradicted',
        score: 0,
        counterEvidenceIds: ['evi_linda_2023'],
      });
      const unit = makeEvidenceUnit();

      const res = isCorrectionEligible(ticket, decision, [unit]);
      expect(res.eligible).toBe(true);
    });

    it('supported, depends_on_context, or insufficient_evidence claims are INELIGIBLE', () => {
      const ticket = makeClaimTicket();
      const unit = makeEvidenceUnit();

      const supportedDec = makeDecisionRecord({ verdict: 'supported', score: 100 });
      expect(isCorrectionEligible(ticket, supportedDec, [unit]).eligible).toBe(false);

      const ambiguousDec = makeDecisionRecord({ verdict: 'depends_on_context', score: null });
      expect(isCorrectionEligible(ticket, ambiguousDec, [unit]).eligible).toBe(false);

      const insufficientDec = makeDecisionRecord({ verdict: 'insufficient_evidence', score: null });
      expect(isCorrectionEligible(ticket, insufficientDec, [unit]).eligible).toBe(false);
    });

    it('refutation without replacement evidence does NOT fabricate an alternative (INELIGIBLE)', () => {
      const ticket = makeClaimTicket();
      const decision = makeDecisionRecord({ verdict: 'contradicted', counterEvidenceIds: [] });

      const res = isCorrectionEligible(ticket, decision, []);
      expect(res.eligible).toBe(false);
      expect(res.reason).toContain('No grounded counterevidence');
    });

    it('supported historical claim remains unchanged and INELIGIBLE', () => {
      const ticket = makeClaimTicket({
        originalStatement: 'Parag Agrawal was CEO in 2021',
        verificationContext: [
          {
            key: 'year',
            label: 'Year',
            propertyType: 'date',
            value: '2021',
            origin: 'explicit_claim_text',
            sourceSpan: { start: 23, end: 27 },
            status: 'confirmed',
            applicability: 'claim_level',
          },
        ],
      });
      const decision = makeDecisionRecord({ verdict: 'supported', score: 100 });
      const unit = makeEvidenceUnit();

      const res = isCorrectionEligible(ticket, decision, [unit]);
      expect(res.eligible).toBe(false);
      expect(res.reason).toContain('Historical claim');
    });
  });

  // =========================================================================
  // 3. DRAFTING THROUGH BIFROST (draftSurgicalReplacement)
  // =========================================================================
  describe('Bifrost Drafting (draftSurgicalReplacement)', () => {
    it('parses valid JSON replacement text and emits structured draft', async () => {
      const ticket = makeClaimTicket();
      const decision = makeDecisionRecord();
      const unit = makeEvidenceUnit();
      const elig = isCorrectionEligible(ticket, decision, [unit]);

      const mockBifrost = async () => {
        return JSON.stringify({
          replacementText: 'Linda Yaccarino is the current CEO of Twitter',
          rationale: 'Linda Yaccarino assumed CEO role in 2023.',
        });
      };

      const result = await draftSurgicalReplacement({
        ticket,
        decision,
        basis: elig.replacementBasis!,
        options: { customBifrostClient: mockBifrost },
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.draft.replacementText).toBe('Linda Yaccarino is the current CEO of Twitter');
        expect(result.draft.attemptNumber).toBe(1);
      }
    });

    it('handles malformed JSON from model gracefully without crashing', async () => {
      const ticket = makeClaimTicket();
      const decision = makeDecisionRecord();
      const unit = makeEvidenceUnit();
      const elig = isCorrectionEligible(ticket, decision, [unit]);

      const mockBifrost = async () => 'Not JSON: replacement is Linda';

      const result = await draftSurgicalReplacement({
        ticket,
        decision,
        basis: elig.replacementBasis!,
        options: { customBifrostClient: mockBifrost },
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.status).toBe('provider_error');
        expect(result.error).toContain('malformed JSON');
      }
    });

    it('rejects empty or unchanged replacement proposal', async () => {
      const ticket = makeClaimTicket();
      const decision = makeDecisionRecord();
      const unit = makeEvidenceUnit();
      const elig = isCorrectionEligible(ticket, decision, [unit]);

      // Unchanged text
      const mockUnchanged = async () => {
        return JSON.stringify({
          replacementText: ticket.originalStatement,
          rationale: 'No change',
        });
      };

      const result = await draftSurgicalReplacement({
        ticket,
        decision,
        basis: elig.replacementBasis!,
        options: { customBifrostClient: mockUnchanged },
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('unchanged');
      }
    });
  });

  // =========================================================================
  // 4. CANDIDATE RECONSTRUCTION & RE-VERIFICATION (MANDATORY SCORE 100 GATE)
  // =========================================================================
  describe('Candidate Re-Verification (reverifyCandidate & Score 100 Gate)', () => {
    it('accepts candidate replacement achieving score 100 with verdict supported', () => {
      const originalTicket = makeClaimTicket();
      const unit = makeEvidenceUnit();
      const basis = isCorrectionEligible(originalTicket, makeDecisionRecord(), [unit]).replacementBasis!;

      const candidateTicket = reconstructCandidate(
        originalTicket,
        'Linda Yaccarino is the current CEO of Twitter',
        basis
      );

      const doc: SourceDocument = {
        documentId: 'doc_sec_8k',
        runId: 'run_test_01',
        url: 'https://sec.gov/edgar/data/twitter-8k',
        finalUrl: 'https://sec.gov/edgar/data/twitter-8k',
        title: 'SEC Form 8-K',
        publisher: 'Twitter, Inc.',
        retrievedContentHash: 'hash_8k',
        retrievedAt: '2024-09-01T00:00:00.000Z',
        rawText: unit.verbatimText,
        extractionStatus: 'success',
        sourceRole: 'primary_authority',
      };

      const reverify = reverifyCandidate({
        candidateTicket,
        originalTicket,
        evidenceUnits: [unit],
        sourceDocuments: [doc],
        basis,
      });

      expect(reverify.passedScore100Gate).toBe(true);
      if (reverify.outcome.status === 'decided') {
        expect(reverify.outcome.decision.verdict).toBe('supported');
        expect(reverify.outcome.decision.score).toBe(100);
      }
    });

    it('withholds candidate replacement scoring 75 (secondary-only authority)', () => {
      const originalTicket = makeClaimTicket();
      const unit = makeEvidenceUnit();
      const basis = isCorrectionEligible(originalTicket, makeDecisionRecord(), [unit]).replacementBasis!;
      const candidateTicket = reconstructCandidate(originalTicket, 'Linda Yaccarino is CEO', basis);

      // Custom decide function returning score 75 (secondary source)
      const mockDecide75 = () => ({
        status: 'decided' as const,
        decision: makeDecisionRecord({
          verdict: 'supported',
          score: 75,
          scoreReason: 'Supported by credible secondary authority only',
        }),
      });

      const reverify = reverifyCandidate({
        candidateTicket,
        originalTicket,
        evidenceUnits: [unit],
        sourceDocuments: [],
        basis,
        customDecideClaim: mockDecide75,
      });

      expect(reverify.passedScore100Gate).toBe(false);
      expect(reverify.reason).toContain('fails mandatory Score 100 Gate');
    });

    it('withholds candidate replacement if re-verification returns contradicted (score 0)', () => {
      const originalTicket = makeClaimTicket();
      const unit = makeEvidenceUnit();
      const basis = isCorrectionEligible(originalTicket, makeDecisionRecord(), [unit]).replacementBasis!;
      const candidateTicket = reconstructCandidate(originalTicket, 'Bogus Person is CEO', basis);

      const mockDecide0 = () => ({
        status: 'decided' as const,
        decision: makeDecisionRecord({
          verdict: 'contradicted',
          score: 0,
        }),
      });

      const reverify = reverifyCandidate({
        candidateTicket,
        originalTicket,
        evidenceUnits: [unit],
        sourceDocuments: [],
        basis,
        customDecideClaim: mockDecide0,
      });

      expect(reverify.passedScore100Gate).toBe(false);
    });
  });

  // =========================================================================
  // 5. EXACT-SPAN EDIT SAFETY & MULTI-EDIT RECONCILIATION
  // =========================================================================
  describe('Exact-Span Edit Safety & Reconciliation', () => {
    const rawAnswer = 'Parag Agrawal is the current CEO of Twitter and SolisDB costs $20 per month.';

    it('constructs verified exact-span edit with matching text and offsets', () => {
      const ticket = makeClaimTicket({
        originalStatement: 'Parag Agrawal is the current CEO of Twitter',
        sourceSpan: { start: 0, end: 43 },
      });

      const result = createExactSpanEdit(
        ticket,
        'Linda Yaccarino is the CEO of Twitter',
        rawAnswer,
        ticket.inputHash,
        'corr_01',
        ['evi_linda_2023']
      );

      expect(result.edit).not.toBeNull();
      expect(result.edit?.span).toEqual({ start: 0, end: 43 });
      expect(result.edit?.expectedOriginalText).toBe('Parag Agrawal is the current CEO of Twitter');
      expect(result.edit?.replacementText).toBe('Linda Yaccarino is the CEO of Twitter');
      expect(result.edit?.diff).toBe(
        '- Parag Agrawal is the current CEO of Twitter\n+ Linda Yaccarino is the CEO of Twitter'
      );
    });

    it('spanless claim produces standalone suggestion with edit set to null', () => {
      const ticket = makeClaimTicket({
        sourceSpan: null, // No exact span in raw answer
      });

      const result = createExactSpanEdit(
        ticket,
        'Linda Yaccarino is CEO',
        rawAnswer
      );

      expect(result.edit).toBeNull();
      expect(result.issue).toContain('standalone suggestion');
    });

    it('rejects edit with mismatched expected original text', () => {
      const ticket = makeClaimTicket({
        originalStatement: 'Parag Agrawal is CEO of Twitter', // Missing "the current"
        sourceSpan: { start: 0, end: 42 },
      });

      const result = createExactSpanEdit(
        ticket,
        'Linda Yaccarino is CEO',
        rawAnswer
      );

      expect(result.edit).toBeNull();
      expect(result.issue).toContain('Span text mismatch');
    });

    it('reconciles multiple non-overlapping edits in reverse character offset order', () => {
      const text = 'ClaimOne is wrong. And ClaimTwo is wrong.';
      // ClaimOne: start 0, end 18 ("ClaimOne is wrong.")
      // ClaimTwo: start 23, end 41 ("ClaimTwo is wrong.")
      const edit1 = {
        editId: 'edt_01',
        claimId: 'clm_01',
        claimRevision: 1,
        answerHash: 'h_1',
        span: { start: 0, end: 18 },
        expectedOriginalText: 'ClaimOne is wrong.',
        replacementText: 'ClaimOne is right.',
        diff: '- ClaimOne is wrong.\n+ ClaimOne is right.',
        evidenceIds: ['evi_01'],
      };

      const edit2 = {
        editId: 'edt_02',
        claimId: 'clm_02',
        claimRevision: 1,
        answerHash: 'h_1',
        span: { start: 23, end: 41 },
        expectedOriginalText: 'ClaimTwo is wrong.',
        replacementText: 'ClaimTwo is right.',
        diff: '- ClaimTwo is wrong.\n+ ClaimTwo is right.',
        evidenceIds: ['evi_02'],
      };

      const recon = reconcileMultipleEdits([edit1, edit2], text, 'h_1');
      expect(recon.success).toBe(true);
      expect(recon.updatedText).toBe('ClaimOne is right. And ClaimTwo is right.');
    });

    it('detects overlapping edit ranges and safely rejects batch without modifying text', () => {
      const text = 'The quick brown fox jumps over the lazy dog.';
      const editA = {
        editId: 'edt_A',
        claimId: 'clm_A',
        claimRevision: 1,
        answerHash: 'h_test',
        span: { start: 4, end: 19 }, // "quick brown fox"
        expectedOriginalText: 'quick brown fox',
        replacementText: 'fast red fox',
        diff: '',
        evidenceIds: [],
      };
      const editB = {
        editId: 'edt_B',
        claimId: 'clm_B',
        claimRevision: 1,
        answerHash: 'h_test',
        span: { start: 16, end: 25 }, // "fox jumps" (overlaps fox)
        expectedOriginalText: 'fox jumps',
        replacementText: 'dog leaps',
        diff: '',
        evidenceIds: [],
      };

      const recon = reconcileMultipleEdits([editA, editB], text, 'h_test');
      expect(recon.success).toBe(false);
      expect(recon.issues?.some((i) => i.includes('OVERLAPPING_EDITS'))).toBe(true);
      expect(recon.updatedText).toBeUndefined();
    });
  });

  // =========================================================================
  // 6. END-TO-END ORCHESTRATION & REPORT CONTRACT COMPATIBILITY
  // =========================================================================
  describe('Full Orchestration & Report Schema Integration (orchestrateClaimCorrection)', () => {
    it('executes full pipeline: eligible outdated claim achieves verified score 100 correction and passes ReportSchema', async () => {
      const rawAnswer = 'Parag Agrawal is the current CEO of Twitter.';
      const ticket = makeClaimTicket({
        originalStatement: 'Parag Agrawal is the current CEO of Twitter.',
        sourceSpan: { start: 0, end: 44 },
      });

      const unit = makeEvidenceUnit();
      const doc: SourceDocument = {
        documentId: 'doc_sec_8k',
        runId: 'run_test_01',
        url: 'https://sec.gov/edgar/twitter',
        finalUrl: 'https://sec.gov/edgar/twitter',
        title: 'Form 8-K',
        publisher: 'Twitter, Inc.',
        retrievedContentHash: 'hash_8k',
        retrievedAt: '2024-09-01T00:00:00.000Z',
        rawText: unit.verbatimText,
        extractionStatus: 'success',
        sourceRole: 'primary_authority',
      };

      const decision = makeDecisionRecord({
        claimTicketId: ticket.ticketId,
        verdict: 'outdated',
        score: 0,
      });

      const mockBifrost = async () => {
        return JSON.stringify({
          replacementText: 'Linda Yaccarino is the current CEO of Twitter.',
          rationale: 'Linda Yaccarino was appointed in 2023.',
        });
      };

      const result = await orchestrateClaimCorrection({
        ticket,
        decision,
        evidenceUnits: [unit],
        sourceDocuments: [doc],
        answerText: rawAnswer,
        answerHash: ticket.inputHash,
        options: { customBifrostClient: mockBifrost },
      });

      expect(result.status).toBe('reverification_passed_score_100');
      expect(result.publicCorrection).not.toBeNull();
      expect(result.publicCorrection?.verified).toBe(true);
      expect(result.publicCorrection?.evidenceIds).toContain('evi_linda_2023');
      expect(result.edit).not.toBeNull();
      expect(result.edit?.expectedOriginalText).toBe('Parag Agrawal is the current CEO of Twitter.');

      // Check ReportSchema compatibility
      const mockReport = {
        id: 'run_test_01',
        mode: 'paste' as const,
        state: 'completed' as const,
        asOfDate: '2024-09-01',
        answerText: rawAnswer,
        createdAt: '2024-09-01T12:00:00Z',
        finishedAt: '2024-09-01T12:00:18Z',
        latestSeq: 1,
        isReplay: false,
        summary: {
          totalClaims: 1,
          supported: 0,
          outdated: 1,
          contradicted: 0,
          unresolved: 0,
        },
        claims: [
          {
            id: 'res_01',
            claimId: ticket.claimId,
            ordinal: 0,
            rawText: ticket.originalStatement,
            span: ticket.sourceSpan,
            state: 'assessed' as const,
            verdict: 'outdated' as const,
            score: 0,
            scoreReason: 'Superseded historical fact',
            reasonCode: 'SUPERSEDED_HISTORICAL_CLAIM',
            evidenceIds: ['evi_linda_2023'],
            correction: result.publicCorrection,
          },
        ],
        evidence: [
          {
            id: 'evi_linda_2023',
            url: doc.url,
            title: doc.title,
            publisher: doc.publisher,
            effectiveDate: unit.effectiveDate,
            publicationDate: unit.publicationDate,
            passage: unit.verbatimText,
            retrievedAt: doc.retrievedAt,
          },
        ],
      };

      const reportValidation = ReportSchema.safeParse(mockReport);
      expect(reportValidation.success).toBe(true);
    });

    it('withheld correction is marked verified: false with diff suppressed and never appears as verified in report', async () => {
      const ticket = makeClaimTicket();
      const unit = makeEvidenceUnit();
      const doc: SourceDocument = {
        documentId: 'doc_sec_8k',
        runId: 'run_test_01',
        url: 'https://sec.gov/edgar/twitter',
        finalUrl: 'https://sec.gov/edgar/twitter',
        title: 'Form 8-K',
        publisher: 'Twitter, Inc.',
        retrievedContentHash: 'hash_8k',
        retrievedAt: '2024-09-01T00:00:00.000Z',
        rawText: unit.verbatimText,
        extractionStatus: 'success',
        sourceRole: 'primary_authority',
      };

      const decision = makeDecisionRecord({ verdict: 'outdated' });

      // Model returns proposal that fails A05 verification (mocking decideClaim to return score 75)
      const mockBifrost = async () => {
        return JSON.stringify({
          replacementText: 'Linda Yaccarino was named CEO in a news wire.',
          rationale: 'Secondary report only',
        });
      };

      const mockDecide75 = () => ({
        status: 'decided' as const,
        decision: makeDecisionRecord({
          verdict: 'supported',
          score: 75,
          scoreReason: 'Supported by secondary source only',
        }),
      });

      const result = await orchestrateClaimCorrection({
        ticket,
        decision,
        evidenceUnits: [unit],
        sourceDocuments: [doc],
        options: {
          customBifrostClient: mockBifrost,
          customDecideClaim: mockDecide75,
        },
      });

      expect(result.status).toBe('withheld_score_below_threshold');
      expect(result.publicCorrection).not.toBeNull();
      expect(result.publicCorrection?.verified).toBe(false);
      expect(result.edit).toBeNull();
    });

    it('original claim decision, verdict, and evidence lineage remain strictly unmutated throughout correction failure', async () => {
      const ticket = makeClaimTicket();
      const decision = makeDecisionRecord({ verdict: 'contradicted', score: 0 });
      const unit = makeEvidenceUnit();

      const origVerdict = decision.verdict;
      const origScore = decision.score;
      const origPrimaryIds = [...decision.primaryEvidenceIds];

      const mockFailureBifrost = async () => {
        throw new Error('Connection timeout to model gateway');
      };

      const result = await orchestrateClaimCorrection({
        ticket,
        decision,
        evidenceUnits: [unit],
        sourceDocuments: [],
        options: { customBifrostClient: mockFailureBifrost },
      });

      expect(result.status).toBe('provider_error');
      // Invariant: original decision must NOT be altered
      expect(decision.verdict).toBe(origVerdict);
      expect(decision.score).toBe(origScore);
      expect(decision.primaryEvidenceIds).toEqual(origPrimaryIds);
    });
  });
});
