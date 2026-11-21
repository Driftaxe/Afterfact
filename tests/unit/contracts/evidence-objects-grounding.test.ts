import { describe, it, expect } from 'vitest';
import { validateEvidenceUnitAgainstSource } from '@/lib/contracts/evidence-objects';
import type { SourceDocument, EvidenceUnit } from '@/lib/contracts/evidence-objects';

describe('Evidence Objects Grounding with Whitespace-Normalized Fallback (TC-ERA-05)', () => {
  const baseDoc: SourceDocument = {
    documentId: 'doc_statute_1',
    runId: 'run_test_1',
    url: 'https://legislation.gov.uk/ukpga/2023/1/section/10',
    finalUrl: 'https://legislation.gov.uk/ukpga/2023/1/section/10',
    retrievedContentHash: 'hash_test_123',
    retrievedAt: '2026-11-20T12:00:00Z',
    extractionStatus: 'success',
    sourceRole: 'primary_authority',
    rawText: 'Section 10.\tAdministrative fees.\n\nAll registered entities\nshall submit   an annual filing fee of £150.\u00A0Failure to remit by March 31 incurs statutory penalties.',
  };

  it('validates exact verbatim substring presence', () => {
    const verbatim = 'All registered entities\nshall submit';
    const start = baseDoc.rawText!.indexOf(verbatim);
    const unit: EvidenceUnit = {
      evidenceId: 'unit_1',
      documentId: 'doc_statute_1',
      verbatimText: verbatim,
      locator: { charOffsetStart: start, charOffsetEnd: start + verbatim.length },
      surroundingHeaders: [],
      footnotes: [],
      extractedProperties: [],
      extractionLimitations: [],
    };

    const result = validateEvidenceUnitAgainstSource(baseDoc, unit);
    expect(result.valid).toBe(true);
  });

  it('validates quote across HTML tabular breaks, tabs, and non-breaking spaces (\u00A0)', () => {
    const unit: EvidenceUnit = {
      evidenceId: 'unit_2',
      documentId: 'doc_statute_1',
      // Multi-space and \u00A0 normalized into single space
      verbatimText: 'All registered entities shall submit an annual filing fee of £150. Failure to remit by March 31',
      locator: {},
      surroundingHeaders: [],
      footnotes: [],
      extractedProperties: [],
      extractionLimitations: [],
    };

    const result = validateEvidenceUnitAgainstSource(baseDoc, unit);
    expect(result.valid).toBe(true);
  });

  it('rejects hallucinated or drifted tokens even with matching whitespace', () => {
    const unit: EvidenceUnit = {
      evidenceId: 'unit_3',
      documentId: 'doc_statute_1',
      // 'annual filing fee of £250' instead of £150
      verbatimText: 'All registered entities shall submit an annual filing fee of £250.',
      locator: {},
      surroundingHeaders: [],
      footnotes: [],
      extractedProperties: [],
      extractionLimitations: [],
    };

    const result = validateEvidenceUnitAgainstSource(baseDoc, unit);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('does not contain verbatim text excerpt');
  });
});
