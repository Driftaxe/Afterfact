import { describe, it, expect } from 'vitest';
import { synthesizeBoundedInference } from '@/server/verify/inference-synthesizer';
import type { ClaimTicket } from '@/lib/contracts/claim-ticket';
import type { EvidenceUnit, SourceDocument } from '@/lib/contracts/evidence-objects';

describe('Pattern 6: General Exhaustive Rule / Formula Conflict & Actor-Obligation Inversion', () => {
  it('synthesizes a contradiction when claim asserts a flat fee but evidence proves a variable formula or schedule', () => {
    const ticket: ClaimTicket = {
      ticketId: 'tkt_delaware_tax',
      claimId: 'c_delaware',
      runId: 'run_test_1',
      inputHash: 'hash_test_1',
      domain: 'regulation',
      revision: 1,
      originalStatement: 'Delaware corporations must pay a flat annual franchise tax fee of $500 regardless of shares',
      normalizedProposition: 'Delaware corporations pay a flat annual franchise tax fee of $500 regardless of authorized shares.',
      targetTime: '2026-11-20T12:00:00Z',
      verificationContext: [
        {
          key: 'jurisdiction',
          label: 'Jurisdiction',
          propertyType: 'string',
          value: 'Delaware',
          origin: 'explicit_claim_text',
          status: 'confirmed',
          applicability: 'claim_level',
          role: 'scope_qualifier',
        },
      ],
      missingMaterialContext: [],
    };

    const doc: SourceDocument = {
      documentId: 'doc_delaware_code',
      runId: 'run_test_1',
      url: 'https://corp.delaware.gov/franchise-tax-calculator/',
      finalUrl: 'https://corp.delaware.gov/franchise-tax-calculator/',
      retrievedContentHash: 'hash_delaware',
      retrievedAt: '2026-11-20T12:00:00Z',
      extractionStatus: 'success',
      sourceRole: 'primary_authority',
      rawText: 'Franchise tax is calculated using either the Authorized Shares Method or the Assumed Par Value Capital Method; corporations with over 5,000 shares pay based on a sliding scale formula with a minimum of $175 up to $200,000.',
    };

    const unit: EvidenceUnit = {
      evidenceId: 'unit_delaware_formula',
      documentId: 'doc_delaware_code',
      verbatimText: 'Franchise tax is calculated using either the Authorized Shares Method or the Assumed Par Value Capital Method; corporations with over 5,000 shares pay based on a sliding scale formula with a minimum of $175 up to $200,000.',
      locator: {},
      surroundingHeaders: [],
      footnotes: [],
      extractedProperties: [],
      extractionLimitations: [],
    };

    const result = synthesizeBoundedInference({
      ticket,
      evidenceUnits: [unit],
      sourceDocuments: [doc],
      assessments: [],
    });

    expect(result.bundles.length).toBeGreaterThanOrEqual(1);
    const bundle = result.bundles[0];
    expect(bundle.relationship).toBe('contradicts');
    expect(bundle.conclusion).toContain('formulaic');
  });

  it('synthesizes a contradiction when claim asserts individual compliance deadline but statute establishes authority response window', () => {
    const ticket: ClaimTicket = {
      ticketId: 'tkt_compliance_window',
      claimId: 'c_gdpr_window',
      runId: 'run_test_2',
      inputHash: 'hash_test_2',
      domain: 'regulation',
      revision: 1,
      originalStatement: 'Users must submit their data access appeal to the supervisory authority within 30 days of moving',
      normalizedProposition: 'Data subjects must submit their data access appeal to the supervisory authority within 30 days of moving.',
      targetTime: '2026-11-20T12:00:00Z',
      verificationContext: [],
      missingMaterialContext: [],
    };

    const doc: SourceDocument = {
      documentId: 'doc_gdpr_text',
      runId: 'run_test_2',
      url: 'https://eur-lex.europa.eu/eli/reg/2016/679/oj',
      finalUrl: 'https://eur-lex.europa.eu/eli/reg/2016/679/oj',
      retrievedContentHash: 'hash_gdpr',
      retrievedAt: '2026-11-20T12:00:00Z',
      extractionStatus: 'success',
      sourceRole: 'regulatory_filing',
      rawText: 'Article 12(3): The controller shall provide information on action taken on a request under Articles 15 to 22 to the data subject without undue delay and in any event within thirty days of receipt of the request.',
    };

    const unit: EvidenceUnit = {
      evidenceId: 'unit_controller_obligation',
      documentId: 'doc_gdpr_text',
      verbatimText: 'The controller shall provide information on action taken on a request under Articles 15 to 22 to the data subject without undue delay and in any event within thirty days of receipt of the request.',
      locator: {},
      surroundingHeaders: [],
      footnotes: [],
      extractedProperties: [],
      extractionLimitations: [],
    };

    const result = synthesizeBoundedInference({
      ticket,
      evidenceUnits: [unit],
      sourceDocuments: [doc],
      assessments: [],
    });

    expect(result.bundles.length).toBeGreaterThanOrEqual(1);
    const bundle = result.bundles[0];
    expect(bundle.relationship).toBe('contradicts');
    expect(bundle.conclusion).toContain('administrative authority');
  });
});
