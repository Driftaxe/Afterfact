import { describe, it, expect } from 'vitest';
import {
  PasteRequestSchema,
  AskRequestSchema,
  MAX_PASTE_LENGTH,
  MAX_ASK_LENGTH,
} from '@/lib/contracts/request';

describe('C02 Input Composer Validation Boundary', () => {
  it('accepts valid paste answer text without auto-trimming', () => {
    const rawInput = '  Claude Pro is $20/month.  \n\nStripe API version 2024-05.  ';
    const result = PasteRequestSchema.safeParse({
      mode: 'paste',
      answerText: rawInput,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    // Preserves original text byte-for-byte including leading/trailing whitespace
    expect(result.data.answerText).toBe(rawInput);
  });

  it('rejects empty and whitespace-only answer text with useful error message', () => {
    const emptyResult = PasteRequestSchema.safeParse({
      mode: 'paste',
      answerText: '',
    });
    expect(emptyResult.success).toBe(false);
    if (!emptyResult.success) {
      expect(emptyResult.error.issues[0].message).toContain(
        'cannot be empty or whitespace-only'
      );
    }

    const whitespaceResult = PasteRequestSchema.safeParse({
      mode: 'paste',
      answerText: '   \n\t  \r  ',
    });
    expect(whitespaceResult.success).toBe(false);
    if (!whitespaceResult.success) {
      expect(whitespaceResult.error.issues[0].message).toContain(
        'cannot be empty or whitespace-only'
      );
    }
  });

  it('enforces exact character limit boundary (8000 allowed, 8001 rejected)', () => {
    const exactMaxText = 'a'.repeat(MAX_PASTE_LENGTH);
    const validResult = PasteRequestSchema.safeParse({
      mode: 'paste',
      answerText: exactMaxText,
    });
    expect(validResult.success).toBe(true);

    const overMaxText = 'a'.repeat(MAX_PASTE_LENGTH + 1);
    const overResult = PasteRequestSchema.safeParse({
      mode: 'paste',
      answerText: overMaxText,
    });
    expect(overResult.success).toBe(false);
    if (!overResult.success) {
      expect(overResult.error.issues[0].message).toContain(
        `exceeds maximum limit of ${MAX_PASTE_LENGTH}`
      );
    }
  });

  it('preserves multi-byte Unicode characters and emojis without offset distortion', () => {
    const unicodeInput = '🚀 Fact 1: Anthropic. 💡 Fact 2: OpenAI. ⚡ Fact 3: Stripe.';
    const result = PasteRequestSchema.safeParse({
      mode: 'paste',
      answerText: unicodeInput,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.answerText).toBe(unicodeInput);
  });

  it('accepts valid optional context fields and rejects malformed dates', () => {
    const validWithContext = PasteRequestSchema.safeParse({
      mode: 'paste',
      answerText: 'Claude Pro subscription.',
      context: {
        targetDate: '2024-09-01',
        jurisdiction: 'US',
        currency: 'USD',
        version: 'v2',
      },
    });
    expect(validWithContext.success).toBe(true);

    const invalidDateContext = PasteRequestSchema.safeParse({
      mode: 'paste',
      answerText: 'Claude Pro subscription.',
      context: {
        targetDate: '2024-02-30', // Impossible leap day
      },
    });
    expect(invalidDateContext.success).toBe(false);
  });

  it('validates Ask question schema limits (800 chars)', () => {
    const validAsk = AskRequestSchema.safeParse({
      mode: 'ask',
      question: 'What is the current pricing of Claude Pro?',
    });
    expect(validAsk.success).toBe(true);

    const emptyAsk = AskRequestSchema.safeParse({
      mode: 'ask',
      question: '   ',
    });
    expect(emptyAsk.success).toBe(false);

    const overAsk = AskRequestSchema.safeParse({
      mode: 'ask',
      question: 'q'.repeat(MAX_ASK_LENGTH + 1),
    });
    expect(overAsk.success).toBe(false);
  });
});
