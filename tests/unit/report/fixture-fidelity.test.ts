import { describe, it, expect } from 'vitest';
import { getGoldenReport, getReportById } from '@/lib/fixtures/golden-report';

describe('C02 Report Fixture Fidelity & Validation Boundary', () => {
  it('parses golden fixture with 100% schema fidelity', () => {
    const result = getGoldenReport();
    expect(result.success).toBe(true);
    if (!result.success) return;

    const report = result.report;
    expect(report.id).toBe('run_golden_fixture_mixed_001');
    expect(report.mode).toBe('paste');
    expect(report.isReplay).toBe(true);
    expect(report.claims).toHaveLength(5);
    expect(report.evidence).toHaveLength(7);

    // Summary fidelity
    expect(report.summary.totalClaims).toBe(5);
    expect(report.summary.supported).toBe(2);
    expect(report.summary.outdated).toBe(1);
    expect(report.summary.contradicted).toBe(1);
    expect(report.summary.unresolved).toBe(1);
  });

  it('resolves stable demo route aliases', () => {
    const demoResult = getReportById('demo');
    expect(demoResult.success).toBe(true);

    const canonicalResult = getReportById('run_golden_fixture_mixed_001');
    expect(canonicalResult.success).toBe(true);
  });

  it('honestly rejects unknown report IDs with notFound, never silently substituting the fixture', () => {
    const unknownResult = getReportById('arbitrary_fake_id_999');
    expect(unknownResult.success).toBe(false);
    if (!unknownResult.success) {
      expect(unknownResult.notFound).toBe(true);
      expect(unknownResult.error).toContain('arbitrary_fake_id_999');
    }
  });

  it('ensures null score is never 0 for unresolved claims', () => {
    const result = getGoldenReport();
    if (!result.success) throw new Error('Fixture failed to load');

    const unresolvedClaim = result.report.claims.find(
      (c) => c.state === 'assessed' && c.verdict === 'depends_on_context'
    );
    expect(unresolvedClaim).toBeDefined();
    if (unresolvedClaim?.state === 'assessed') {
      expect(unresolvedClaim.score).toBeNull();
      expect(unresolvedClaim.score).not.toBe(0);
      expect(unresolvedClaim.scoreReason).toBeTruthy();
    }
  });

  it('confirms every cited evidence ID exists in report.evidence collection', () => {
    const result = getGoldenReport();
    if (!result.success) throw new Error('Fixture failed to load');

    const allEvidenceIds = new Set(result.report.evidence.map((e) => e.id));
    for (const claim of result.report.claims) {
      for (const eviId of claim.evidenceIds) {
        expect(allEvidenceIds.has(eviId)).toBe(true);
      }
    }
  });
});
