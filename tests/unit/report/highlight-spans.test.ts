import { describe, it, expect } from 'vitest';
import { segmentAnswerText } from '@/lib/report/spans';
import type { ClaimResultItem } from '@/lib/contracts/report';
import goldenReportJson from '../../../fixtures/golden-mixed-report.json';
import { ReportSchema } from '@/lib/contracts/report';

describe('C02 Highlight Span Segmentation Engine (segmentAnswerText)', () => {
  it('segments the canonical golden fixture and preserves 100% of characters', () => {
    const report = ReportSchema.parse(goldenReportJson);
    const result = segmentAnswerText({
      answerText: report.answerText!,
      claims: report.claims,
    });

    expect(result.hasMalformedSpans).toBe(false);
    expect(result.malformedClaimIds).toHaveLength(0);

    // Invariant: concatenated segment texts strictly equals answerText
    const reconstructed = result.segments.map((s) => s.text).join('');
    expect(reconstructed).toBe(report.answerText);

    // Verify all 5 claims from fixture are represented in segments
    const claimSegments = result.segments.filter((s) => s.claimId !== null);
    const uniqueClaimIds = new Set(claimSegments.map((s) => s.claimId));
    expect(uniqueClaimIds.size).toBe(5);

    // Check first claim
    const firstClaimSegment = result.segments.find((s) => s.claimId === 'res_pricing_01');
    expect(firstClaimSegment).toBeDefined();
    expect(firstClaimSegment?.text).toBe(
      'Anthropic Claude Pro costs $20 per month in the United States.'
    );
    expect(firstClaimSegment?.verdict).toBe('supported');
  });

  it('correctly handles an emoji placed before a claim (surrogate pair UTF-16 offset)', () => {
    // 🚀 is 2 code units: \uD83D\uDE80
    const rawText = 'Twitter CEO changed in 2022.';
    const answerText = `🚀 ${rawText}`; // 🚀 (2) + space (1) = start at 3
    const start = 3;
    const end = start + rawText.length;

    const mockClaims: ClaimResultItem[] = [
      {
        id: 'clm_emoji_test',
        claimId: 'clm_emoji_test',
        ordinal: 0,
        rawText,
        span: { start, end },
        state: 'assessed',
        verdict: 'outdated',
        score: 0,
        scoreReason: 'Historical change',
        reasonCode: 'SUPERSEDED_HISTORICAL_CLAIM',
        evidenceIds: [],
      },
    ];

    const result = segmentAnswerText({ answerText, claims: mockClaims });
    expect(result.hasMalformedSpans).toBe(false);

    const reconstructed = result.segments.map((s) => s.text).join('');
    expect(reconstructed).toBe(answerText);

    // First segment is "🚀 "
    expect(result.segments[0].text).toBe('🚀 ');
    expect(result.segments[0].claimId).toBeNull();

    // Second segment is the claim
    expect(result.segments[1].text).toBe(rawText);
    expect(result.segments[1].claimId).toBe('clm_emoji_test');
    expect(result.segments[1].verdict).toBe('outdated');
  });

  it('disambiguates identical repeated phrases by their exact stored UTF-16 offsets', () => {
    const rawText = 'This statement is repeated.';
    const answerText = `${rawText} Some middle text. ${rawText}`;
    const firstStart = 0;
    const firstEnd = rawText.length;
    const secondStart = answerText.lastIndexOf(rawText);
    const secondEnd = secondStart + rawText.length;

    const mockClaims: ClaimResultItem[] = [
      {
        id: 'claim_first',
        claimId: 'claim_first',
        ordinal: 0,
        rawText,
        span: { start: firstStart, end: firstEnd },
        state: 'assessed',
        verdict: 'supported',
        score: 100,
        scoreReason: 'First occurrence',
        reasonCode: 'AUTHORITATIVE_PRIMARY_SUPPORT',
        evidenceIds: [],
      },
      {
        id: 'claim_second',
        claimId: 'claim_second',
        ordinal: 1,
        rawText,
        span: { start: secondStart, end: secondEnd },
        state: 'assessed',
        verdict: 'contradicted',
        score: 0,
        scoreReason: 'Second occurrence contradicted',
        reasonCode: 'DECISIVE_CONTRADICTION',
        evidenceIds: [],
      },
    ];

    const result = segmentAnswerText({ answerText, claims: mockClaims });
    expect(result.hasMalformedSpans).toBe(false);

    expect(result.segments.map((s) => s.text).join('')).toBe(answerText);

    const firstSegment = result.segments.find((s) => s.claimId === 'claim_first');
    expect(firstSegment?.text).toBe(rawText);
    expect(firstSegment?.start).toBe(firstStart);
    expect(firstSegment?.verdict).toBe('supported');

    const secondSegment = result.segments.find((s) => s.claimId === 'claim_second');
    expect(secondSegment?.text).toBe(rawText);
    expect(secondSegment?.start).toBe(secondStart);
    expect(secondSegment?.verdict).toBe('contradicted');
  });

  it('safely handles malformed claim spans by omitting highlight and recording malformed IDs', () => {
    const answerText = 'Normal answer text.';
    const mockClaims: ClaimResultItem[] = [
      {
        id: 'claim_out_of_bounds',
        claimId: 'claim_out_of_bounds',
        ordinal: 0,
        rawText: 'Non-matching slice',
        span: { start: 0, end: 50 }, // Exceeds answerText.length (19)
        state: 'assessed',
        verdict: 'supported',
        score: 100,
        scoreReason: 'Out of bounds',
        reasonCode: 'AUTHORITATIVE_PRIMARY_SUPPORT',
        evidenceIds: [],
      },
    ];

    const result = segmentAnswerText({ answerText, claims: mockClaims });
    expect(result.hasMalformedSpans).toBe(true);
    expect(result.malformedClaimIds).toContain('claim_out_of_bounds');

    // Entire text returned as unhighlighted segment
    expect(result.segments).toHaveLength(1);
    expect(result.segments[0].text).toBe(answerText);
    expect(result.segments[0].claimId).toBeNull();
  });

  it('handles overlapping spans without duplicating or dropping characters', () => {
    const answerText = 'The quick brown fox jumps.';
    // Claim 1: "quick brown" (4..15)
    // Claim 2: "brown fox" (10..19) -> overlaps on "brown" (10..15)
    const mockClaims: ClaimResultItem[] = [
      {
        id: 'c1',
        claimId: 'c1',
        ordinal: 0,
        rawText: 'quick brown',
        span: { start: 4, end: 15 },
        state: 'assessed',
        verdict: 'supported',
        score: 100,
        scoreReason: 'Part 1',
        reasonCode: 'AUTHORITATIVE_PRIMARY_SUPPORT',
        evidenceIds: [],
      },
      {
        id: 'c2',
        claimId: 'c2',
        ordinal: 1,
        rawText: 'brown fox',
        span: { start: 10, end: 19 },
        state: 'assessed',
        verdict: 'outdated',
        score: 0,
        scoreReason: 'Part 2',
        reasonCode: 'SUPERSEDED_HISTORICAL_CLAIM',
        evidenceIds: [],
      },
    ];

    const result = segmentAnswerText({ answerText, claims: mockClaims });
    expect(result.hasMalformedSpans).toBe(false);

    // Invariant: character fidelity is preserved 100%
    const reconstructed = result.segments.map((s) => s.text).join('');
    expect(reconstructed).toBe(answerText);
  });
});
