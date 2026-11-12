import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { ClaimTicket } from '@/lib/contracts/claim-ticket';
import type { SourceDocument } from '@/lib/contracts/evidence-objects';
import { extractEvidenceUnits } from '@/server/verify/extract-evidence';
import * as bifrostClient from '@/server/bifrost/client';

vi.mock('@/server/bifrost/client', () => ({
  bifrostChat: vi.fn(),
  BifrostError: class BifrostError extends Error {},
}));

describe('Stage 2: Grounded Evidence Extraction (extractEvidenceUnits)', () => {
  const baseTicket: ClaimTicket = {
    ticketId: 'tkt_01j98ab7102938475610293847',
    claimId: 'clm_01j98ab7000000000000000000',
    runId: 'run_01j98ab7000000000000000000',
    inputHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    revision: 1,
    originalStatement: 'SolisDB v2 charges $15 per node per month in the EU.',
    sourceSpan: { start: 0, end: 51 },
    normalizedProposition: 'SolisDB version 2 subscription charges 15 USD per node per month in the European Union.',
    domain: 'pricing',
    targetTime: '2026-11-08',
    missingMaterialContext: [],
    verificationContext: [],
  };

  const sampleSourceText = `# SolisDB Official Documentation

## Section 1: Overview
SolisDB is a distributed database engine.

## Section 2: Pricing and Plans
In the European Union, SolisDB v2 is priced at $15 per node per month for standard deployments.*

| Region | Monthly Rate |
| EU | $15/node |

*Rates apply to annual commitments; monthly billing incurs a 10% surcharge.

## Section 3: Legal Notes
SolisDB is a distributed database engine.`;

  const validSourceDoc: SourceDocument = {
    documentId: 'doc_solis_pricing_01',
    runId: baseTicket.runId,
    url: 'https://solisdb.com/pricing',
    finalUrl: 'https://solisdb.com/pricing-eu',
    retrievedContentHash: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
    retrievedAt: '2026-11-08T10:00:00Z',
    rawText: sampleSourceText,
    extractionStatus: 'success',
    publicationDate: '2026-01-15',
    effectiveDate: '2026-02-01',
    sourceRole: 'primary_authority',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('successfully extracts grounded evidence units with exact quotation verification', async () => {
    const verbatimQuote = 'In the European Union, SolisDB v2 is priced at $15 per node per month for standard deployments.*';
    const mockModelProposal = {
      passages: [
        {
          verbatimText: verbatimQuote,
          surroundingHeaders: ['Pricing and Plans'],
          tableContext: {
            tableTitle: 'Pricing',
            columnHeader: 'Monthly Rate',
            rowHeader: 'EU',
          },
          footnotes: ['*Rates apply to annual commitments; monthly billing incurs a 10% surcharge.'],
          extractedProperties: [
            {
              key: 'monthlyPrice',
              label: 'Monthly Price',
              propertyType: 'number',
              value: 15,
            },
          ],
          effectiveDate: '2026-02-01',
        },
      ],
    };

    vi.mocked(bifrostClient.bifrostChat).mockResolvedValueOnce(JSON.stringify(mockModelProposal));

    const result = await extractEvidenceUnits({
      source: validSourceDoc,
      ticket: baseTicket,
    });

    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.evidenceUnits.length).toBe(1);
      const unit = result.evidenceUnits[0];
      expect(unit.documentId).toBe(validSourceDoc.documentId);
      expect(unit.verbatimText).toBe(verbatimQuote);
      expect(unit.locator.charOffsetStart).toBeDefined();
      expect(unit.locator.charOffsetEnd).toBeDefined();

      // Verify exact slice matches
      const sliced = validSourceDoc.rawText!.slice(unit.locator.charOffsetStart!, unit.locator.charOffsetEnd!);
      expect(sliced).toBe(verbatimQuote);

      // Verify context preservation
      expect(unit.surroundingHeaders).toEqual(['Pricing and Plans']);
      expect(unit.footnotes).toEqual(['*Rates apply to annual commitments; monthly billing incurs a 10% surcharge.']);
      expect(unit.tableContext?.columnHeader).toBe('Monthly Rate');
    }
  });

  it('rejects hallucinated quotation not present in rawText and adds to rejectedCandidates', async () => {
    const hallucinatedProposal = {
      passages: [
        {
          verbatimText: 'SolisDB v2 charges $15 in EU with zero surcharges ever.', // Not in source
          surroundingHeaders: ['Pricing'],
        },
      ],
    };

    vi.mocked(bifrostClient.bifrostChat).mockResolvedValueOnce(JSON.stringify(hallucinatedProposal));

    const result = await extractEvidenceUnits({
      source: validSourceDoc,
      ticket: baseTicket,
    });

    expect(result.status).toBe('no_usable_passages');
    if (result.status === 'no_usable_passages') {
      expect(result.reason).toContain('failed deterministic quotation verification');
    }
  });

  it('disambiguates repeated occurrences of a quote using surrounding header context', async () => {
    // "SolisDB is a distributed database engine." appears in Section 1 and Section 3
    const repeatedQuote = 'SolisDB is a distributed database engine.';
    const mockModelProposal = {
      passages: [
        {
          verbatimText: repeatedQuote,
          surroundingHeaders: ['Section 3: Legal Notes'],
        },
      ],
    };

    vi.mocked(bifrostClient.bifrostChat).mockResolvedValueOnce(JSON.stringify(mockModelProposal));

    const result = await extractEvidenceUnits({
      source: validSourceDoc,
      ticket: baseTicket,
    });

    expect(result.status).toBe('success');
    if (result.status === 'success') {
      const unit = result.evidenceUnits[0];
      // Section 3 occurs later in the text than Section 1
      const section3HeaderIndex = validSourceDoc.rawText!.indexOf('Section 3: Legal Notes');
      expect(unit.locator.charOffsetStart!).toBeGreaterThan(section3HeaderIndex);
    }
  });

  it('handles source_failed extraction status without calling Bifrost', async () => {
    const failedDoc: SourceDocument = {
      ...validSourceDoc,
      documentId: 'doc_404',
      rawText: null,
      extractionStatus: 'failed',
      failureReason: 'HTTP 404 Not Found',
    };

    const result = await extractEvidenceUnits({
      source: failedDoc,
      ticket: baseTicket,
    });

    expect(result.status).toBe('source_failed');
    if (result.status === 'source_failed') {
      expect(result.failureReason).toBe('HTTP 404 Not Found');
    }
    expect(bifrostClient.bifrostChat).not.toHaveBeenCalled();
  });

  it('handles empty source rawText with typed no_usable_passages outcome', async () => {
    const emptyDoc: SourceDocument = {
      ...validSourceDoc,
      documentId: 'doc_empty',
      rawText: '   ',
      extractionStatus: 'partial',
    };

    const result = await extractEvidenceUnits({
      source: emptyDoc,
      ticket: baseTicket,
    });

    expect(result.status).toBe('no_usable_passages');
    expect(bifrostClient.bifrostChat).not.toHaveBeenCalled();
  });

  it('bounds long source text and reports truncation coverage limitation', async () => {
    const longText = 'A'.repeat(15000) + '\nSolisDB v2 charges $15 in EU.';
    const longDoc: SourceDocument = {
      ...validSourceDoc,
      rawText: longText,
    };

    vi.mocked(bifrostClient.bifrostChat).mockResolvedValueOnce(JSON.stringify({ passages: [] }));

    const result = await extractEvidenceUnits({
      source: longDoc,
      ticket: baseTicket,
    });

    expect(result.status).toBe('no_usable_passages');
    expect(bifrostClient.bifrostChat).toHaveBeenCalled();
    const callArgs = vi.mocked(bifrostClient.bifrostChat).mock.calls[0][0];
    const userPrompt = JSON.parse(callArgs.messages[1].content);
    expect(userPrompt.sourceDocumentRawText.length).toBeLessThanOrEqual(12000);
  });
});
