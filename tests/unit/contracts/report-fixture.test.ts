import { describe, it, expect } from 'vitest';
import goldenReport from '../../../fixtures/golden-mixed-report.json';
import {
  ReportSchema,
  ClaimResultItemSchema,
  AssessedClaimResultSchema,
  FailedClaimResultSchema,
} from '../../../src/lib/contracts/report';
import {
  EvidenceItemSchema,
  HttpUrlSchema,
} from '../../../src/lib/contracts/evidence';
import {
  isValidCalendarDate,
  isValidIsoTimestamp,
} from '../../../src/lib/contracts/dates';
import {
  VerificationEventSchema,
  ClaimResultEventSchema,
} from '../../../src/lib/contracts/events';

describe('A02 Contracts — Evidence, Report, Events, and Golden Fixture', () => {
  describe('Full Golden Mixed Fixture Validation', () => {
    it('validates the complete golden fixture against ReportSchema without errors', () => {
      const parsed = ReportSchema.parse(goldenReport);
      expect(parsed.id).toBe('run_golden_fixture_mixed_001');
      expect(parsed.claims.length).toBe(5);
      expect(parsed.evidence.length).toBe(7);
      expect(parsed.isReplay).toBe(true);
      expect(parsed.replayLabel).toContain('REPLAY MODE');
      expect(parsed.answerText).toBeDefined();
    });

    it('contains all four domains plus an unresolved claim with strictly compliant scores', () => {
      const parsed = ReportSchema.parse(goldenReport);
      const verdicts = parsed.claims.map((c) => (c.state === 'assessed' ? c.verdict : null));
      expect(verdicts).toContain('supported');
      expect(verdicts).toContain('contradicted');
      expect(verdicts).toContain('outdated');
      expect(verdicts).toContain('depends_on_context');

      // 1. Check upcoming scheduled change on EU AI Act
      const regClaim = parsed.claims.find((c) => c.id === 'res_reg_01');
      expect(regClaim).toBeDefined();
      if (regClaim && regClaim.state === 'assessed') {
        expect(regClaim.verdict).toBe('supported');
        expect(regClaim.score).toBe(100);
        const upcomingEntry = regClaim.timeline?.find((t) => t.state === 'upcoming');
        expect(upcomingEntry).toBeDefined();
        expect(upcomingEntry?.effectiveDate).toBe('2025-08-02');
        // Assert upcoming effective date is strictly after fixture asOfDate
        expect(parsed.asOfDate).toBe('2024-09-01');
        expect(upcomingEntry!.effectiveDate! > parsed.asOfDate!).toBe(true);
      }

      // 2. Check outdated claim: must have score 0 (not null)
      const leadClaim = parsed.claims.find((c) => c.id === 'res_lead_01');
      expect(leadClaim).toBeDefined();
      if (leadClaim && leadClaim.state === 'assessed') {
        expect(leadClaim.verdict).toBe('outdated');
        expect(leadClaim.score).toBe(0);
        expect(leadClaim.correction?.verified).toBe(true);
        expect(leadClaim.correction?.evidenceIds.length).toBeGreaterThanOrEqual(1);
      }

      // 3. Check unresolved claim: must have score null with meaningful reason
      const ctxClaim = parsed.claims.find((c) => c.id === 'res_ctx_01');
      expect(ctxClaim).toBeDefined();
      if (ctxClaim && ctxClaim.state === 'assessed') {
        expect(ctxClaim.verdict).toBe('depends_on_context');
        expect(ctxClaim.score).toBeNull();
        expect(ctxClaim.scoreReason.length).toBeGreaterThan(0);
        expect(ctxClaim.reasonCode).toBe('ESSENTIAL_CONTEXT_MISSING');
      }
    });

    it('verifies that each present highlight matches report.answerText', () => {
      const parsed = ReportSchema.parse(goldenReport);
      parsed.claims.forEach((claim) => {
        if (claim.span && parsed.answerText) {
          const slice = parsed.answerText.slice(claim.span.start, claim.span.end);
          expect(slice).toBe(claim.rawText);
        }
      });
    });
  });

  describe('Calendar Date & Timestamp Validation', () => {
    it('approves complete calendar dates (YYYY-MM-DD)', () => {
      expect(isValidCalendarDate('2025-08-02')).toBe(true);
      expect(isValidCalendarDate('2024-02-29')).toBe(true); // leap year
    });

    it('rejects nonexistent dates, leap year invalidities, and trailing garbage', () => {
      expect(isValidCalendarDate('2023-02-29')).toBe(false); // non-leap year
      expect(isValidCalendarDate('2025-04-31')).toBe(false); // April has 30 days
      expect(isValidCalendarDate('2025-13-01')).toBe(false); // Month 13
      expect(isValidCalendarDate('2025-08-02trailing')).toBe(false); // Trailing garbage
    });

    it('validates ISO timestamps with explicit in-range timezone information (INV-03)', () => {
      expect(isValidIsoTimestamp('2024-09-01T12:00:00Z')).toBe(true);
      expect(isValidIsoTimestamp('2024-09-01T12:00:00.123+05:30')).toBe(true);
      expect(isValidIsoTimestamp('2024-09-01T12:00:00-04:00')).toBe(true);
      expect(isValidIsoTimestamp('2024-09-01T12:00:00-05:00')).toBe(true);
      expect(isValidIsoTimestamp('2024-09-01T12:00:00+00:00')).toBe(true);
    });

    it('rejects ISO timestamps with out-of-range timezone offset hours or minutes (INV-03)', () => {
      // Naive regex matches, but hour/minute offsets exceed 23 or 59
      expect(isValidIsoTimestamp('2024-09-01T12:00:00+99:99')).toBe(false);
      expect(isValidIsoTimestamp('2024-09-01T12:00:00+05:60')).toBe(false);
      expect(isValidIsoTimestamp('2024-09-01T12:00:00+24:00')).toBe(false);
      expect(isValidIsoTimestamp('2024-09-01T12:00:00-24:00')).toBe(false);
    });

    it('rejects timestamps without explicit timezone or malformed formats', () => {
      expect(isValidIsoTimestamp('2024-09-01T12:00:00')).toBe(false); // Missing timezone
      expect(isValidIsoTimestamp('2024-09-01 12:00:00Z')).toBe(false); // Missing 'T'
      expect(isValidIsoTimestamp('not-a-timestamp')).toBe(false);
    });
  });

  describe('Evidence URL Protocol Enforcement', () => {
    it('accepts HTTPS and HTTP URLs', () => {
      expect(HttpUrlSchema.safeParse('https://example.com/api').success).toBe(true);
      expect(HttpUrlSchema.safeParse('http://example.com/api?v=2024').success).toBe(true);
    });

    it('rejects javascript:, mailto:, and file: schemes', () => {
      expect(HttpUrlSchema.safeParse('javascript:alert(1)').success).toBe(false);
      expect(HttpUrlSchema.safeParse('mailto:admin@example.com').success).toBe(false);
      expect(HttpUrlSchema.safeParse('file:///etc/passwd').success).toBe(false);
    });
  });

  describe('Duplicate Identifiers Rejection', () => {
    it('rejects duplicate claim IDs in a report', () => {
      const corrupted = JSON.parse(JSON.stringify(goldenReport));
      corrupted.claims[1].id = corrupted.claims[0].id; // duplicate result ID

      const result = ReportSchema.safeParse(corrupted);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.message.includes('Duplicate claim identifier'))).toBe(true);
      }
    });

    it('rejects duplicate claimId across rows even with distinct result IDs (INV-01)', () => {
      const corrupted = JSON.parse(JSON.stringify(goldenReport));
      // Give distinct result IDs but duplicate claimId
      corrupted.claims[0].id = 'res_distinct_01';
      corrupted.claims[1].id = 'res_distinct_02';
      corrupted.claims[1].claimId = corrupted.claims[0].claimId; // duplicate claimId

      const result = ReportSchema.safeParse(corrupted);
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues.find(
          (i) => i.path.join('.') === 'claims.1.claimId' || i.message.includes('Duplicate claimId')
        );
        expect(issue).toBeDefined();
        expect(issue?.path).toEqual(['claims', 1, 'claimId']);
      }
    });

    it('preserves result ID uniqueness check when claimIds are distinct', () => {
      const corrupted = JSON.parse(JSON.stringify(goldenReport));
      corrupted.claims[1].id = corrupted.claims[0].id; // duplicate result ID
      corrupted.claims[1].claimId = 'clm_distinct_999';

      const result = ReportSchema.safeParse(corrupted);
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues.find((i) => i.path.join('.') === 'claims.1.id');
        expect(issue).toBeDefined();
      }
    });

    it('rejects duplicate evidence IDs in a report', () => {
      const corrupted = JSON.parse(JSON.stringify(goldenReport));
      corrupted.evidence[1].id = corrupted.evidence[0].id; // duplicate evidence ID

      const result = ReportSchema.safeParse(corrupted);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.message.includes('Duplicate evidence identifier'))).toBe(true);
      }
    });
  });

  describe('Cross-Reference Citation & Verified Correction Integrity', () => {
    it('rejects reports when claim cites a missing evidence ID', () => {
      const corrupted = JSON.parse(JSON.stringify(goldenReport));
      corrupted.claims[0].evidenceIds.push('evi_ghost_id_999');

      const result = ReportSchema.safeParse(corrupted);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.message.includes('evi_ghost_id_999'))).toBe(true);
      }
    });

    it('rejects verified corrections with empty evidence IDs', () => {
      const corrupted = JSON.parse(JSON.stringify(goldenReport));
      corrupted.claims[3].correction.evidenceIds = []; // Empty evidence IDs on verified correction

      const result = ReportSchema.safeParse(corrupted);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.message.includes('verified correction must cite at least one'))).toBe(true);
      }
    });

    it('rejects verified corrections with dangling evidence IDs', () => {
      const corrupted = JSON.parse(JSON.stringify(goldenReport));
      corrupted.claims[3].correction.evidenceIds = ['evi_dangling_999'];

      const result = ReportSchema.safeParse(corrupted);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.message.includes('evi_dangling_999'))).toBe(true);
      }
    });
  });

  describe('Shared Assessed Verdict and Score Consistency (Report & Event)', () => {
    it('rejects supported + 42 through both ClaimResultItemSchema and ClaimResultEventSchema', () => {
      const invalidClaim = {
        id: 'res_test',
        claimId: 'clm_test',
        ordinal: 0,
        rawText: 'Test text',
        state: 'assessed' as const,
        verdict: 'supported' as const,
        score: 42 as any,
        scoreReason: 'Invalid score',
        reasonCode: 'TEST',
        evidenceIds: [],
      };
      expect(ClaimResultItemSchema.safeParse(invalidClaim).success).toBe(false);

      const invalidEvent = {
        type: 'claim_result' as const,
        runId: 'run_01',
        seq: 1,
        claimId: 'clm_test',
        verdict: 'supported' as const,
        score: 42 as any,
        reasonCode: 'TEST',
        scoreReason: 'Invalid score',
        timestamp: '2024-09-01T12:00:00Z',
      };
      expect(ClaimResultEventSchema.safeParse(invalidEvent).success).toBe(false);
    });

    it('rejects outdated + null through both entry points (outdated strictly requires 0)', () => {
      const invalidOutdatedClaim = {
        id: 'res_test',
        claimId: 'clm_test',
        ordinal: 0,
        rawText: 'Test text',
        state: 'assessed' as const,
        verdict: 'outdated' as const,
        score: null,
        scoreReason: 'Historical claim',
        reasonCode: 'TEST',
        evidenceIds: [],
      };
      // Must be rejected because outdated requires score 0
      expect(AssessedClaimResultSchema.safeParse(invalidOutdatedClaim).success).toBe(false);

      const invalidOutdatedEvent = {
        type: 'claim_result' as const,
        runId: 'run_01',
        seq: 1,
        claimId: 'clm_test',
        verdict: 'outdated' as const,
        score: null,
        reasonCode: 'TEST',
        scoreReason: 'Historical claim',
        timestamp: '2024-09-01T12:00:00Z',
      };
      expect(ClaimResultEventSchema.safeParse(invalidOutdatedEvent).success).toBe(false);
    });

    it('rejects unresolved + numeric score through both entry points', () => {
      const invalidUnresolvedClaim = {
        id: 'res_test',
        claimId: 'clm_test',
        ordinal: 0,
        rawText: 'Test text',
        state: 'assessed' as const,
        verdict: 'depends_on_context' as const,
        score: 100,
        scoreReason: 'Context dependent',
        reasonCode: 'TEST',
        evidenceIds: [],
      };
      expect(ClaimResultItemSchema.safeParse(invalidUnresolvedClaim).success).toBe(false);

      const invalidUnresolvedEvent = {
        type: 'claim_result' as const,
        runId: 'run_01',
        seq: 1,
        claimId: 'clm_test',
        verdict: 'depends_on_context' as const,
        score: 100,
        reasonCode: 'TEST',
        scoreReason: 'Context dependent',
        timestamp: '2024-09-01T12:00:00Z',
      };
      expect(ClaimResultEventSchema.safeParse(invalidUnresolvedEvent).success).toBe(false);
    });

    it('accepts valid combinations through both entry points', () => {
      const validSupportedClaim = {
        id: 'res_test',
        claimId: 'clm_test',
        ordinal: 0,
        rawText: 'Test text',
        state: 'assessed' as const,
        verdict: 'supported' as const,
        score: 100,
        scoreReason: 'Authoritative support',
        reasonCode: 'AUTHORITATIVE_PRIMARY_SUPPORT',
        evidenceIds: [],
      };
      expect(ClaimResultItemSchema.safeParse(validSupportedClaim).success).toBe(true);

      const validSupportedEvent = {
        type: 'claim_result' as const,
        runId: 'run_01',
        seq: 1,
        claimId: 'clm_test',
        verdict: 'supported' as const,
        score: 100,
        reasonCode: 'AUTHORITATIVE_PRIMARY_SUPPORT',
        scoreReason: 'Authoritative support',
        timestamp: '2024-09-01T12:00:00Z',
      };
      expect(ClaimResultEventSchema.safeParse(validSupportedEvent).success).toBe(true);
    });
  });

  describe('Ask Reports & Highlight Span Invariants (INV-02)', () => {
    it('accepts an Ask run snapshot in pre-draft state (answerText is null) with zero claims', () => {
      const preDraftAskReport = {
        id: 'run_ask_queued_001',
        parentRunId: null,
        mode: 'ask' as const,
        state: 'queued' as const,
        answerText: null,
        context: {},
        createdAt: '2024-09-01T12:00:00Z',
        latestSeq: 1,
        summary: {
          totalClaims: 0,
          supported: 0,
          outdated: 0,
          contradicted: 0,
          unresolved: 0,
        },
        claims: [],
        evidence: [],
      };
      expect(ReportSchema.safeParse(preDraftAskReport).success).toBe(true);
    });

    it('rejects completed Ask reports without answerText or with whitespace-only answerText', () => {
      const completedAskNoText = {
        id: 'run_ask_completed_001',
        parentRunId: null,
        mode: 'ask' as const,
        state: 'completed' as const,
        answerText: null,
        context: {},
        createdAt: '2024-09-01T12:00:00Z',
        latestSeq: 1,
        summary: { totalClaims: 0, supported: 0, outdated: 0, contradicted: 0, unresolved: 0 },
        claims: [],
        evidence: [],
      };
      const resNull = ReportSchema.safeParse(completedAskNoText);
      expect(resNull.success).toBe(false);
      if (!resNull.success) {
        expect(resNull.error.issues.some((i) => i.path.includes('answerText'))).toBe(true);
      }

      const completedAskWhitespace = {
        ...completedAskNoText,
        answerText: '   \n  \t ',
      };
      const resBlank = ReportSchema.safeParse(completedAskWhitespace);
      expect(resBlank.success).toBe(false);
      if (!resBlank.success) {
        expect(resBlank.error.issues.some((i) => i.path.includes('answerText'))).toBe(true);
      }
    });

    it('rejects pre-draft Ask reports whenever any claim has a span', () => {
      const preDraftWithSpan = {
        id: 'run_ask_queued_002',
        parentRunId: null,
        mode: 'ask' as const,
        state: 'queued' as const,
        answerText: null,
        context: {},
        createdAt: '2024-09-01T12:00:00Z',
        latestSeq: 1,
        summary: { totalClaims: 1, supported: 0, outdated: 0, contradicted: 0, unresolved: 0, pending: 1 },
        claims: [
          {
            id: 'res_claim_span',
            claimId: 'clm_claim_span',
            ordinal: 0,
            rawText: 'Some claim text',
            span: { start: 0, end: 15 },
            state: 'pending' as const,
            evidenceIds: [],
          },
        ],
        evidence: [],
      };
      const result = ReportSchema.safeParse(preDraftWithSpan);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some((i) => i.path.includes('answerText') || i.path.includes('span'))
        ).toBe(true);
      }
    });

    it('passes queued, running, or failed pre-draft Ask run with null answerText when zero claims have spans', () => {
      // 1. Queued with 0 claims
      const queuedReport = {
        id: 'run_ask_queued_ok',
        parentRunId: null,
        mode: 'ask' as const,
        state: 'queued' as const,
        answerText: null,
        context: {},
        createdAt: '2024-09-01T12:00:00Z',
        latestSeq: 1,
        summary: { totalClaims: 0, supported: 0, outdated: 0, contradicted: 0, unresolved: 0 },
        claims: [],
        evidence: [],
      };
      expect(ReportSchema.safeParse(queuedReport).success).toBe(true);

      // 2. Running with claims without spans
      const runningReport = {
        id: 'run_ask_running_ok',
        parentRunId: null,
        mode: 'ask' as const,
        state: 'running' as const,
        answerText: null,
        context: {},
        createdAt: '2024-09-01T12:00:00Z',
        latestSeq: 2,
        summary: { totalClaims: 1, supported: 0, outdated: 0, contradicted: 0, unresolved: 0, pending: 1 },
        claims: [
          {
            id: 'res_claim_nospan',
            claimId: 'clm_claim_nospan',
            ordinal: 0,
            rawText: 'Claim without span',
            span: null,
            state: 'pending' as const,
            evidenceIds: [],
          },
        ],
        evidence: [],
      };
      expect(ReportSchema.safeParse(runningReport).success).toBe(true);

      // 3. Failed pre-draft
      const failedReport = {
        id: 'run_ask_failed_ok',
        parentRunId: null,
        mode: 'ask' as const,
        state: 'failed' as const,
        answerText: null,
        context: {},
        createdAt: '2024-09-01T12:00:00Z',
        latestSeq: 1,
        summary: { totalClaims: 0, supported: 0, outdated: 0, contradicted: 0, unresolved: 0 },
        claims: [],
        evidence: [],
      };
      expect(ReportSchema.safeParse(failedReport).success).toBe(true);
    });

    it('strictly requires non-blank answerText whenever any claim has a span regardless of mode or state', () => {
      const failedWithSpan = {
        id: 'run_failed_span',
        parentRunId: null,
        mode: 'ask' as const,
        state: 'failed' as const,
        answerText: null,
        context: {},
        createdAt: '2024-09-01T12:00:00Z',
        latestSeq: 1,
        summary: { totalClaims: 1, supported: 0, outdated: 0, contradicted: 0, unresolved: 0, failed: 1 },
        claims: [
          {
            id: 'res_f1',
            claimId: 'clm_f1',
            ordinal: 0,
            rawText: 'Failed claim',
            span: { start: 0, end: 12 },
            state: 'failed' as const,
            error: 'Failed before draft',
            reasonCode: 'FAILED_PRE_DRAFT',
            evidenceIds: [],
          },
        ],
        evidence: [],
      };
      expect(ReportSchema.safeParse(failedWithSpan).success).toBe(false);
    });
  });

  describe('Summary Counters Parity for Failed and Pending Claims (INV-04)', () => {
    it('accepts a realistic partial report with both an assessed claim and a failed claim', () => {
      const partialReport = {
        id: 'run_partial_001',
        parentRunId: null,
        mode: 'paste' as const,
        state: 'partial' as const,
        answerText: 'First claim text. Second claim text.',
        context: {},
        createdAt: '2024-09-01T12:00:00Z',
        finishedAt: '2024-09-01T12:00:15Z',
        latestSeq: 4,
        summary: {
          totalClaims: 2,
          supported: 1,
          outdated: 0,
          contradicted: 0,
          unresolved: 0,
          failed: 1,
        },
        claims: [
          {
            id: 'res_claim_1',
            claimId: 'clm_1',
            ordinal: 0,
            rawText: 'First claim text.',
            span: { start: 0, end: 17 },
            state: 'assessed' as const,
            verdict: 'supported' as const,
            score: 100,
            scoreReason: 'Valid source',
            reasonCode: 'AUTHORITATIVE_PRIMARY_SUPPORT',
            evidenceIds: ['evi_1'],
          },
          {
            id: 'res_claim_2',
            claimId: 'clm_2',
            ordinal: 1,
            rawText: 'Second claim text.',
            span: { start: 18, end: 36 },
            state: 'failed' as const,
            error: 'Tavily retrieval failed after 3 attempts',
            reasonCode: 'RETRIEVAL_FAILED',
            evidenceIds: [],
          },
        ],
        evidence: [
          {
            id: 'evi_1',
            url: 'https://example.com/docs',
            passage: 'First claim text is verified here.',
            retrievedAt: '2024-09-01T12:00:05Z',
          },
        ],
      };

      const result = ReportSchema.safeParse(partialReport);
      expect(result.success).toBe(true);
    });

    it('rejects summary count mismatch when failed or pending is set', () => {
      const baseReport = {
        id: 'run_summary_check',
        parentRunId: null,
        mode: 'paste' as const,
        state: 'partial' as const,
        answerText: 'First claim text. Second claim text.',
        context: {},
        createdAt: '2024-09-01T12:00:00Z',
        latestSeq: 2,
        summary: {
          totalClaims: 2,
          supported: 1,
          outdated: 0,
          contradicted: 0,
          unresolved: 0,
          failed: 99, // Mismatched: actual is 1
          pending: 0,
        },
        claims: [
          {
            id: 'res_1',
            claimId: 'clm_1',
            ordinal: 0,
            rawText: 'First claim text.',
            span: { start: 0, end: 17 },
            state: 'assessed' as const,
            verdict: 'supported' as const,
            score: 100,
            scoreReason: 'Supported',
            reasonCode: 'AUTHORITATIVE_PRIMARY_SUPPORT',
            evidenceIds: [],
          },
          {
            id: 'res_2',
            claimId: 'clm_2',
            ordinal: 1,
            rawText: 'Second claim text.',
            span: { start: 18, end: 36 },
            state: 'failed' as const,
            error: 'Execution failed',
            reasonCode: 'RETRIEVAL_FAILED',
            evidenceIds: [],
          },
        ],
        evidence: [],
      };

      const result = ReportSchema.safeParse(baseReport);
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues.find((i) => i.path.join('.') === 'summary.failed');
        expect(issue).toBeDefined();
        expect(issue?.message).toContain('Summary failed (99) does not match actual count (1)');
      }

      // Check pending mismatch
      const pendingMismatchReport = {
        ...baseReport,
        summary: { ...baseReport.summary, failed: 1, pending: 5 }, // pending actual is 0
      };
      const resPending = ReportSchema.safeParse(pendingMismatchReport);
      expect(resPending.success).toBe(false);
      if (!resPending.success) {
        const issue = resPending.error.issues.find((i) => i.path.join('.') === 'summary.pending');
        expect(issue).toBeDefined();
      }
    });

    it('rejects omitted failed/pending counter when actual count is greater than 0', () => {
      const reportOmittedFailed = {
        id: 'run_omitted_failed',
        parentRunId: null,
        mode: 'paste' as const,
        state: 'partial' as const,
        answerText: 'First claim text. Second claim text.',
        context: {},
        createdAt: '2024-09-01T12:00:00Z',
        latestSeq: 2,
        summary: {
          totalClaims: 2,
          supported: 1,
          outdated: 0,
          contradicted: 0,
          unresolved: 0,
          // 'failed' is omitted even though 1 failed claim exists
        },
        claims: [
          {
            id: 'res_1',
            claimId: 'clm_1',
            ordinal: 0,
            rawText: 'First claim text.',
            span: { start: 0, end: 17 },
            state: 'assessed' as const,
            verdict: 'supported' as const,
            score: 100,
            scoreReason: 'Supported',
            reasonCode: 'AUTHORITATIVE_PRIMARY_SUPPORT',
            evidenceIds: [],
          },
          {
            id: 'res_2',
            claimId: 'clm_2',
            ordinal: 1,
            rawText: 'Second claim text.',
            span: { start: 18, end: 36 },
            state: 'failed' as const,
            error: 'Execution failed',
            reasonCode: 'RETRIEVAL_FAILED',
            evidenceIds: [],
          },
        ],
        evidence: [],
      };

      const result = ReportSchema.safeParse(reportOmittedFailed);
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues.find((i) => i.path.join('.') === 'summary.failed');
        expect(issue).toBeDefined();
        expect(issue?.message).toContain('Summary failed was omitted');
      }
    });

    it('passes when omitted failed/pending counters have an actual count of 0', () => {
      // Golden report has 0 failed and 0 pending claims, and omits both summary fields
      const result = ReportSchema.safeParse(goldenReport);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.summary.failed).toBeUndefined();
        expect(result.data.summary.pending).toBeUndefined();
      }
    });
  });
});
