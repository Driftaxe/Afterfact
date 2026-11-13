import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  startPreparationAction,
  confirmPreparationAction,
  submitClarificationAction,
  _clearPreparationStore,
} from '@/actions/run-actions';
import {
  StartPreparationActionResultSchema,
  ConfirmPreparationActionResultSchema,
} from '@/lib/contracts/actions';
import { MAX_PASTE_LENGTH } from '@/lib/contracts/request';

describe('Task C03 & C04: run-actions Server Actions', () => {
  beforeEach(async () => {
    await _clearPreparationStore();
  });

  describe('startPreparationAction', () => {
    it('successfully extracts claims and prepares valid proposition tickets', async () => {
      const input = {
        mode: 'paste' as const,
        text: 'Anthropic Claude Pro costs $20 per month in the United States. Parag Agrawal is the current CEO of Twitter.',
        context: {
          jurisdiction: 'US',
          targetDate: '2026-11-08',
        },
      };

      const result = await startPreparationAction(input);

      expect(result.success).toBe(true);
      if (!result.success) return;

      // Validate strict schema conformance
      const parsed = StartPreparationActionResultSchema.safeParse(result.data);
      expect(parsed.success).toBe(true);

      expect(result.data.status).toBe('ready');
      expect(result.data.revision).toBe(1);
      expect(result.data.inputHash).toMatch(/^[a-f0-9]{64}$/);
      expect(result.data.preparationId).toMatch(/^prep_[a-f0-9]{16}$/);
      expect(result.data.claims.length).toBeGreaterThanOrEqual(1);

      // Verify claim ticket fields
      const firstClaim = result.data.claims[0];
      expect(firstClaim.inputHash).toBe(result.data.inputHash);
      expect(firstClaim.revision).toBe(1);
      expect(firstClaim.domain).toBe('generic');
      expect(firstClaim.targetTime).toBe('2026-11-08');

      // Verify context inheritance
      const jurisdictionProp = firstClaim.verificationContext.find((p) => p.key === 'jurisdiction');
      expect(jurisdictionProp).toBeDefined();
      expect(jurisdictionProp?.value).toBe('US');
    });

    it('processes Ask Question mode successfully', async () => {
      const input = {
        mode: 'ask' as const,
        text: 'What are the current pricing tiers for Anthropic Claude?',
        originalQuestion: 'What are the current pricing tiers for Anthropic Claude?',
      };

      const result = await startPreparationAction(input);

      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data.status).toBe('ready');
      expect(result.data.claims.length).toBeGreaterThanOrEqual(1);
    });

    it('rejects empty input text with INPUT_EMPTY_OR_WHITESPACE', async () => {
      const result = await startPreparationAction({
        mode: 'paste',
        text: '',
      });

      expect(result.success).toBe(false);
      if (result.success) return;

      expect(result.code).toBe('INPUT_EMPTY_OR_WHITESPACE');
      expect(result.error).toContain('cannot be empty');
    });

    it('rejects whitespace-only input text with INPUT_EMPTY_OR_WHITESPACE', async () => {
      const result = await startPreparationAction({
        mode: 'paste',
        text: '   \n\t   ',
      });

      expect(result.success).toBe(false);
      if (result.success) return;

      expect(result.code).toBe('INPUT_EMPTY_OR_WHITESPACE');
      expect(result.error).toContain('cannot be empty or whitespace-only');
    });

    it('rejects oversized input exceeding MAX_PASTE_LENGTH with INPUT_EXCEEDS_MAX_LENGTH', async () => {
      const oversizedText = 'a'.repeat(MAX_PASTE_LENGTH + 1);
      const result = await startPreparationAction({
        mode: 'paste',
        text: oversizedText,
      });

      expect(result.success).toBe(false);
      if (result.success) return;

      expect(result.code).toBe('INPUT_EXCEEDS_MAX_LENGTH');
      expect(result.error).toMatch(/exceeds maximum length/);
    });

    it('rejects malformed payload shape with INVALID_PAYLOAD_SHAPE', async () => {
      const badInput = {
        mode: 'unsupported_mode' as unknown as 'paste',
        text: 'Valid text sample.',
      };

      const result = await startPreparationAction(badInput);

      expect(result.success).toBe(false);
      if (result.success) return;

      expect(result.code).toBe('INVALID_PAYLOAD_SHAPE');
    });
  });

  describe('confirmPreparationAction', () => {
    it('successfully confirms prepared claims and materializes running DAG state', async () => {
      const prepRes = await startPreparationAction({
        mode: 'paste',
        text: 'Stripe charges 2.9% + 30 cents per transaction in the US.',
      });
      expect(prepRes.success).toBe(true);
      if (!prepRes.success) return;

      const confirmRes = await confirmPreparationAction({
        preparationId: prepRes.data.preparationId,
        inputHash: prepRes.data.inputHash,
        revision: prepRes.data.revision,
        confirmedClaims: prepRes.data.claims,
      });

      expect(confirmRes.success).toBe(true);
      if (!confirmRes.success) return;

      // Validate strict schema conformance
      const parsed = ConfirmPreparationActionResultSchema.safeParse(confirmRes.data);
      expect(parsed.success).toBe(true);

      expect(confirmRes.data.status).toBe('running');
      expect(confirmRes.data.graphVersion).toBe(1);
      expect(confirmRes.data.runId).toMatch(/^run_[a-f0-9]{16}$/);
      expect(confirmRes.data.streamUrl).toBe(`/api/v1/runs/${confirmRes.data.runId}/stream`);
    });

    it('rejects confirmation with empty confirmedClaims (Zod schema boundary)', async () => {
      const confirmRes = await confirmPreparationAction({
        preparationId: 'prep_test_123',
        inputHash: 'hash_test_123',
        revision: 1,
        confirmedClaims: [],
      });

      expect(confirmRes.success).toBe(false);
      if (confirmRes.success) return;

      expect(confirmRes.code).toBe('INVALID_PAYLOAD_SHAPE');
      expect(confirmRes.error).toContain('At least one claim must be confirmed');
    });

    it('enforces revision binding (TC-08): rejects edited inputHash with STALE_PREPARATION_REVISION', async () => {
      // 1. Initial preparation step
      const prepRes = await startPreparationAction({
        mode: 'paste',
        text: 'Parag Agrawal is the current CEO of Twitter.',
      });
      expect(prepRes.success).toBe(true);
      if (!prepRes.success) return;

      // 2. Client edits text or passes a mismatched inputHash during confirmation
      const tamperedHash = 'f'.repeat(64);
      const confirmRes = await confirmPreparationAction({
        preparationId: prepRes.data.preparationId,
        inputHash: tamperedHash,
        revision: prepRes.data.revision,
        confirmedClaims: prepRes.data.claims,
      });

      expect(confirmRes.success).toBe(false);
      if (confirmRes.success) return;

      expect(confirmRes.code).toBe('STALE_PREPARATION_REVISION');
      expect(confirmRes.error).toContain('Text was edited after preparation');
    });

    it('enforces revision binding when claim tickets carry a different inputHash', async () => {
      const prepRes = await startPreparationAction({
        mode: 'paste',
        text: 'Claude Pro costs $20.',
      });
      expect(prepRes.success).toBe(true);
      if (!prepRes.success) return;

      // Alter claim ticket's internal inputHash
      const alteredClaims = prepRes.data.claims.map((claim) => ({
        ...claim,
        inputHash: 'stale_hash_from_previous_revision',
      }));

      const confirmRes = await confirmPreparationAction({
        preparationId: prepRes.data.preparationId,
        inputHash: prepRes.data.inputHash,
        revision: prepRes.data.revision,
        confirmedClaims: alteredClaims,
      });

      expect(confirmRes.success).toBe(false);
      if (confirmRes.success) return;

      expect(confirmRes.code).toBe('STALE_PREPARATION_REVISION');
    });
  });

  describe('submitClarificationAction', () => {
    it('handles clarification submission error gracefully when clarification is missing', async () => {
      const result = await submitClarificationAction({
        clarificationId: 'nonexistent-clarification-id',
        answer: { answers: { jurisdiction: 'US' }, unknown: false },
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeDefined();
      }
    });

    it('submits successfully when ClarificationService resumes answer', async () => {
      // Mock ClarificationService dynamic import
      vi.doMock('@/server/services/clarification-service', () => ({
        ClarificationService: {
          resumeWithAnswer: vi.fn().mockResolvedValue({ success: true }),
        },
      }));

      const result = await submitClarificationAction({
        clarificationId: 'clar_mock_123',
        answer: { answers: { jurisdiction: 'US' }, unknown: false },
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.accepted).toBe(true);
      }

      vi.doUnmock('@/server/services/clarification-service');
    });
  });
});
