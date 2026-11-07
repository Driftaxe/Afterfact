import { describe, it, expect } from 'vitest';
import {
  VerificationRequestSchema,
  PasteRequestSchema,
  AskRequestSchema,
  MAX_PASTE_LENGTH,
  MAX_ASK_LENGTH,
} from '../../../src/lib/contracts/request';
import {
  AtomicClaimSpecSchema,
  validateClaimSpan,
  ClaimSpanSchema,
} from '../../../src/lib/contracts/claim';

describe('A01 Contracts — Request and Claim Schemas', () => {
  describe('PasteRequestSchema & Input Limits', () => {
    it('accepts valid paste input up to exact 8,000 characters', () => {
      const validText = 'a'.repeat(MAX_PASTE_LENGTH);
      const parsed = PasteRequestSchema.parse({
        mode: 'paste',
        answerText: validText,
      });
      expect(parsed.mode).toBe('paste');
      expect(parsed.answerText.length).toBe(MAX_PASTE_LENGTH);
    });

    it('rejects one-over 8,001 character paste input', () => {
      const oneOverText = 'a'.repeat(MAX_PASTE_LENGTH + 1);
      const result = PasteRequestSchema.safeParse({
        mode: 'paste',
        answerText: oneOverText,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('exceeds maximum limit of 8000');
      }
    });

    it('rejects empty string and whitespace-only paste input', () => {
      expect(PasteRequestSchema.safeParse({ mode: 'paste', answerText: '' }).success).toBe(false);
      expect(PasteRequestSchema.safeParse({ mode: 'paste', answerText: '   \n\t  \r\n  ' }).success).toBe(false);
    });

    it('preserves leading and trailing whitespace exactly without auto-trimming', () => {
      const textWithSpaces = '  \nStripe processing fees in US are 2.9% + 30c.  \n';
      const parsed = PasteRequestSchema.parse({
        mode: 'paste',
        answerText: textWithSpaces,
      });
      expect(parsed.answerText).toBe(textWithSpaces);
    });

    it('rejects wrong-mode fields instead of silently stripping them (strict schema)', () => {
      // Paste payload with an Ask field (question) must fail validation
      const result = PasteRequestSchema.safeParse({
        mode: 'paste',
        answerText: 'Some valid answer text',
        question: 'An illegal ask question field',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const unrecognizedIssue = result.error.issues.find((i) => i.code === 'unrecognized_keys');
        expect(unrecognizedIssue).toBeDefined();
      }
    });
  });

  describe('AskRequestSchema & Input Limits', () => {
    it('accepts valid question up to exact 800 characters', () => {
      const validQuestion = 'q'.repeat(MAX_ASK_LENGTH);
      const parsed = AskRequestSchema.parse({
        mode: 'ask',
        question: validQuestion,
      });
      expect(parsed.mode).toBe('ask');
      expect(parsed.question.length).toBe(MAX_ASK_LENGTH);
    });

    it('rejects one-over 801 character question', () => {
      const oneOverQuestion = 'q'.repeat(MAX_ASK_LENGTH + 1);
      const result = AskRequestSchema.safeParse({
        mode: 'ask',
        question: oneOverQuestion,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('exceeds maximum limit of 800');
      }
    });

    it('rejects whitespace-only question', () => {
      const result = AskRequestSchema.safeParse({
        mode: 'ask',
        question: '   \t  \n  ',
      });
      expect(result.success).toBe(false);
    });

    it('rejects wrong-mode fields in Ask payload (strict schema)', () => {
      // Ask payload with a Paste field (answerText) must fail validation
      const result = AskRequestSchema.safeParse({
        mode: 'ask',
        question: 'Who is the CEO of Twitter?',
        answerText: 'An illegal paste field',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const unrecognizedIssue = result.error.issues.find((i) => i.code === 'unrecognized_keys');
        expect(unrecognizedIssue).toBeDefined();
      }
    });
  });

  describe('SharedContext Calendar Dates', () => {
    it('accepts valid complete calendar dates', () => {
      const result = PasteRequestSchema.safeParse({
        mode: 'paste',
        answerText: 'Valid text',
        context: {
          targetDate: '2026-11-08',
          answerDate: '2024-02-29', // leap year
        },
      });
      expect(result.success).toBe(true);
    });

    it('rejects trailing text on calendar dates', () => {
      const result = PasteRequestSchema.safeParse({
        mode: 'paste',
        answerText: 'Valid text',
        context: {
          targetDate: '2026-11-08garbage',
        },
      });
      expect(result.success).toBe(false);
    });

    it('rejects impossible calendar dates in context', () => {
      const nonLeapFeb = PasteRequestSchema.safeParse({
        mode: 'paste',
        answerText: 'Valid text',
        context: { targetDate: '2023-02-29' },
      });
      expect(nonLeapFeb.success).toBe(false);

      const invalidMonth = PasteRequestSchema.safeParse({
        mode: 'paste',
        answerText: 'Valid text',
        context: { answerDate: '2026-13-01' },
      });
      expect(invalidMonth.success).toBe(false);
    });
  });

  describe('VerificationRequestSchema Discriminated Union', () => {
    it('dispatches to paste schema when mode is paste', () => {
      const result = VerificationRequestSchema.safeParse({
        mode: 'paste',
        answerText: 'Some AI text',
        context: { jurisdiction: 'US' },
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.mode).toBe('paste');
      }
    });

    it('dispatches to ask schema when mode is ask', () => {
      const result = VerificationRequestSchema.safeParse({
        mode: 'ask',
        question: 'Who is CEO of Twitter?',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.mode).toBe('ask');
      }
    });

    it('rejects invalid or missing mode', () => {
      expect(VerificationRequestSchema.safeParse({ mode: 'unknown', text: 'hi' }).success).toBe(false);
      expect(VerificationRequestSchema.safeParse({ answerText: 'no mode' }).success).toBe(false);
    });
  });

  describe('AtomicClaimSpecSchema & Source Qualifiers', () => {
    it('parses valid atomic claim and preserves explicit sourceScope separately from requested context', () => {
      const claim = AtomicClaimSpecSchema.parse({
        id: 'clm_01',
        rawText: 'In the UK, Stripe charges 1.4% + 20p.',
        entity: 'Stripe',
        attribute: 'fee_percentage',
        assertedValue: '1.4% + 20p',
        timeSensitivity: 'high',
        sourceScope: { jurisdiction: 'UK', currency: 'GBP' },
        span: { start: 0, end: 36 },
      });

      expect(claim.sourceScope).toEqual({ jurisdiction: 'UK', currency: 'GBP' });
      expect(claim.timeSensitivity).toBe('high');
    });

    it('supports explicitly null span for unhighlightable claims', () => {
      const claim = AtomicClaimSpecSchema.parse({
        id: 'clm_02',
        rawText: 'Parag Agrawal is the current CEO of Twitter.',
        entity: 'Twitter',
        attribute: 'ceo',
        assertedValue: 'Parag Agrawal',
        timeSensitivity: 'medium',
        span: null,
      });
      expect(claim.span).toBeNull();
    });
  });

  describe('UTF-16 Span Offsets & validateClaimSpan Helper', () => {
    it('correctly validates UTF-16 offset preceded by a surrogate-pair emoji', () => {
      // 🚀 is 2 UTF-16 code units
      const answer = '🚀 Parag Agrawal is the current CEO of Twitter.';
      const rawClaim = 'Parag Agrawal';
      const startIndex = 2 + 1; // 2 for emoji + 1 space = 3
      const endIndex = startIndex + rawClaim.length; // 3 + 13 = 16

      expect(answer.slice(startIndex, endIndex)).toBe(rawClaim);

      const validation = validateClaimSpan(answer, { start: startIndex, end: endIndex }, rawClaim);
      expect(validation.valid).toBe(true);
      expect(validation.isHighlighted).toBe(true);
    });

    it('rejects empty span (start === end)', () => {
      const answer = 'Testing bounds';
      const validation = validateClaimSpan(answer, { start: 5, end: 5 }, '');
      expect(validation.valid).toBe(false);
      expect(validation.reason).toContain('non-empty');

      const schemaResult = ClaimSpanSchema.safeParse({ start: 5, end: 5 });
      expect(schemaResult.success).toBe(false);
    });

    it('rejects fractional span offsets', () => {
      const answer = 'Fractional testing';
      const validation = validateClaimSpan(answer, { start: 1.5 as unknown as number, end: 5 }, 'rac');
      expect(validation.valid).toBe(false);
      expect(validation.reason).toContain('non-fractional integers');

      const schemaResult = ClaimSpanSchema.safeParse({ start: 1.5, end: 5 });
      expect(schemaResult.success).toBe(false);
    });

    it('rejects negative offsets', () => {
      const answer = 'Some answer text';
      const validation = validateClaimSpan(answer, { start: -1, end: 4 }, 'Some');
      expect(validation.valid).toBe(false);
      expect(validation.reason).toContain('negative');
    });

    it('rejects out-of-bounds offsets that exceed answer length', () => {
      const answer = 'Short';
      const validation = validateClaimSpan(answer, { start: 0, end: 100 }, 'Short');
      expect(validation.valid).toBe(false);
      expect(validation.reason).toContain('exceeds text length');
    });

    it('rejects inverted offsets where start > end', () => {
      const answer = 'Testing bounds';
      const validation = validateClaimSpan(answer, { start: 10, end: 5 }, 'test');
      expect(validation.valid).toBe(false);
      expect(validation.reason).toContain('start strictly less than end');
    });

    it('rejects mismatched raw text without leaking raw fragments in the error message', () => {
      const answer = 'Stripe charges 2.9% + 30 cents per transaction.';
      const validation = validateClaimSpan(
        answer,
        { start: 0, end: 14 },
        'Stripe charges 1.4%'
      );
      expect(validation.valid).toBe(false);
      expect(validation.reason).toBe(
        'Extracted text slice does not match expected rawText at specified span offsets'
      );
      // Ensure raw answer text is not leaked in the reason string
      expect(validation.reason).not.toContain('Stripe charges 2.9%');
    });

    it('accepts null span gracefully and marks isHighlighted as false', () => {
      const answer = 'Any answer text';
      const validation = validateClaimSpan(answer, null, 'Unanchored claim');
      expect(validation.valid).toBe(true);
      expect(validation.isHighlighted).toBe(false);
    });
  });
});
