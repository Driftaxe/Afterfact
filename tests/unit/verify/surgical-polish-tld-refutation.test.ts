import { describe, it, expect } from 'vitest';
import { isBareTldSuffix, generateResearchPlan } from '@/server/verify/research-planner';
import { sanitizeTavilyIncludeDomains, extractEntityTokens } from '@/server/jobs/worker';
import { synthesizeBoundedInference } from '@/server/verify/inference-synthesizer';
import { decideClaim } from '@/server/verify/decide';
import type { ClaimTicket } from '@/lib/contracts/claim-ticket';
import type { DecideClaimInput } from '@/lib/contracts/decision';
import type { EvidenceUnit, SourceDocument, ClaimEvidenceAssessment } from '@/lib/contracts/evidence-objects';

describe('Surgical Polish: Sovereign TLD Retrieval & Active-Status Refutation', () => {
  describe('Gate 1: Bare Public-Suffix TLD Sanitization & Concrete Sovereign Retrieval', () => {
    it('identifies bare multi-tenant public suffixes while preserving concrete websites', () => {
      // Bare TLD namespaces must be recognized
      expect(isBareTldSuffix('gov')).toBe(true);
      expect(isBareTldSuffix('gov.in')).toBe(true);
      expect(isBareTldSuffix('nic.in')).toBe(true);
      expect(isBareTldSuffix('gov.au')).toBe(true);
      expect(isBareTldSuffix('gob.es')).toBe(true);
      expect(isBareTldSuffix('gouv.fr')).toBe(true);
      expect(isBareTldSuffix('admin.ch')).toBe(true);
      expect(isBareTldSuffix('edu')).toBe(true);
      expect(isBareTldSuffix('ac.uk')).toBe(true);
      expect(isBareTldSuffix('co.in')).toBe(true);

      // Concrete hosts and portal websites must NOT be flagged as bare TLD suffixes
      expect(isBareTldSuffix('gov.uk')).toBe(false); // gov.uk is an actual portal website
      expect(isBareTldSuffix('indiacode.nic.in')).toBe(false);
      expect(isBareTldSuffix('egazette.gov.in')).toBe(false);
      expect(isBareTldSuffix('pib.gov.in')).toBe(false);
      expect(isBareTldSuffix('federalregister.gov')).toBe(false);
      expect(isBareTldSuffix('ecfr.gov')).toBe(false);
      expect(isBareTldSuffix('eur-lex.europa.eu')).toBe(false);
      expect(isBareTldSuffix('apple.com')).toBe(false);
      expect(isBareTldSuffix('rbi.org.in')).toBe(false);
      expect(isBareTldSuffix('npci.org.in')).toBe(false);
    });

    it('sanitizeTavilyIncludeDomains strips bare TLDs and separates them for site: query enrichment', () => {
      const inputDomains = ['gov.in', 'nic.in', 'indiacode.nic.in', 'egazette.gov.in'];
      const result = sanitizeTavilyIncludeDomains(inputDomains);

      expect(result.validDomains).toEqual(['indiacode.nic.in', 'egazette.gov.in']);
      expect(result.strippedTlds).toEqual(['gov.in', 'nic.in']);
    });

    it('generates research plans using concrete hostnames and site: operators rather than bare TLDs in includeDomains', async () => {
      const ticket: ClaimTicket = {
        ticketId: 'tkt_statute_1',
        claimId: 'clm_1',
        runId: 'run_test_tld',
        inputHash: 'hash_tld',
        revision: 1,
        originalStatement: 'SEBI mandates compulsory same-day settlement across all exchanges under 2026 regulations.',
        normalizedProposition: 'SEBI mandates compulsory same-day settlement across all exchanges under 2026 regulations.',
        domain: 'regulation',
        targetTime: '2026-11-20',
        verificationContext: [
          {
            key: 'jurisdiction',
            label: 'Jurisdiction',
            propertyType: 'string',
            value: 'India',
            origin: 'explicit_claim_text',
            status: 'confirmed',
            applicability: 'claim_level',
            role: 'scope_qualifier',
            sourceSpan: { start: 0, end: 5 },
            units: null,
            confidence: null,
          },
          {
            key: 'agency',
            label: 'Agency',
            propertyType: 'string',
            value: 'Securities and Exchange Board of India',
            origin: 'explicit_claim_text',
            status: 'confirmed',
            applicability: 'claim_level',
            role: 'scope_qualifier',
            sourceSpan: { start: 0, end: 4 },
            units: null,
            confidence: null,
          },
        ],
        missingMaterialContext: [],
      };

      const outcome = await generateResearchPlan({ ticket, round: 1 });
      expect(outcome.status).toBe('success');
      if (outcome.status === 'success') {
        const q1 = outcome.plan.queries[1];
        if (q1?.includeDomains) {
          for (const domain of q1.includeDomains) {
            expect(isBareTldSuffix(domain)).toBe(false);
          }
          expect(q1.includeDomains).toContain('indiacode.nic.in');
        }
      }
    });

    it('extractEntityTokens generates acronyms for multi-word statutory agencies', () => {
      const ticket: Partial<ClaimTicket> = {
        originalStatement: 'Transfer regulations issued by Reserve Bank of India.',
        verificationContext: [
          {
            key: 'agency',
            label: 'Agency',
            propertyType: 'string',
            value: 'Reserve Bank of India',
            origin: 'explicit_claim_text',
            status: 'confirmed',
            applicability: 'claim_level',
            role: 'scope_qualifier',
            sourceSpan: { start: 31, end: 53 },
            units: null,
            confidence: null,
          },
        ],
      };

      const tokens = extractEntityTokens(ticket as ClaimTicket);
      expect(tokens).toContain('rbi');
    });
  });

  describe('Gate 2: Active Zero-Fee Refutation with TC-ERA-22 Enforcement', () => {
    function createFeeTicket(allegedDate: string): ClaimTicket {
      return {
        ticketId: 'tkt_fee_test',
        claimId: 'clm_fee_1',
        runId: 'run_fee_test',
        inputHash: 'hash_fee',
        revision: 1,
        originalStatement: `Platform introduced a 1.5% fee on all transfers exceeding $1,000 in ${allegedDate}.`,
        normalizedProposition: `Platform introduced a 1.5% fee on all transfers exceeding $1,000 in ${allegedDate}.`,
        domain: 'pricing',
        targetTime: '2026-11-20',
        verificationContext: [
          {
            key: 'feePercentage',
            label: 'Fee Percentage',
            propertyType: 'number',
            value: 1.5,
            origin: 'explicit_claim_text',
            status: 'confirmed',
            applicability: 'claim_level',
            role: 'asserted_value',
            sourceSpan: { start: 22, end: 26 },
            units: '%',
            confidence: null,
          },
          {
            key: 'threshold',
            label: 'Threshold',
            propertyType: 'number',
            value: 1000,
            origin: 'explicit_claim_text',
            status: 'confirmed',
            applicability: 'claim_level',
            role: 'scope_qualifier',
            sourceSpan: { start: 59, end: 65 },
            units: 'USD',
            confidence: null,
          },
          {
            key: 'statedEffectiveDate',
            label: 'Effective Date',
            propertyType: 'string',
            value: allegedDate,
            origin: 'explicit_claim_text',
            status: 'confirmed',
            applicability: 'claim_level',
            role: 'scope_qualifier',
            sourceSpan: { start: 69, end: 79 },
            units: null,
            confidence: null,
          },
        ],
        missingMaterialContext: [],
      };
    }

    it('synthesizes a contradiction bundle when contemporaneous/post-enactment evidence confirms service remains 100% free', () => {
      const ticket = createFeeTicket('2026-09-01');

      const verbatim = 'Official statement: transfers remain 100% free with zero fees for all users regardless of transaction amount.';

      const doc: SourceDocument = {
        documentId: 'doc_portal_1',
        runId: 'run_fee_test',
        url: 'https://bank.org/press/2026-09-10-fee-clarification',
        finalUrl: 'https://bank.org/press/2026-09-10-fee-clarification',
        retrievedContentHash: 'hash_zero_fee',
        retrievedAt: '2026-11-20T00:00:00Z',
        rawText: verbatim,
        extractionStatus: 'success',
        publicationDate: '2026-09-10',
        effectiveDate: '2026-09-10',
        sourceRole: 'primary_authority',
      };

      const unit: EvidenceUnit = {
        evidenceId: 'evi_zero_fee_1',
        documentId: 'doc_portal_1',
        verbatimText: verbatim,
        locator: { charOffsetStart: 0, charOffsetEnd: verbatim.length },
        publicationDate: '2026-09-10',
        effectiveDate: '2026-09-10',
        extractionLimitations: [],
        surroundingHeaders: [],
        footnotes: [],
        extractedProperties: [],
      };

      const asm: ClaimEvidenceAssessment = {
        assessmentId: 'asm_zero_fee_1',
        claimTicketId: ticket.ticketId,
        claimRevision: ticket.revision,
        evidenceId: 'evi_zero_fee_1',
        relationship: 'contradicts',
        scopeMatching: 'match',
        quotationVerified: true,
        temporalApplicability: 'active_at_target_time',
        sourceSuitability: 'authoritative_primary',
        reasoning: 'Contemporaneous official clarification confirms transfers remain 100% free with zero fees regardless of transaction amount.',
        propertyMatchStatus: {
          matching: ['threshold'],
          mismatched: ['feePercentage'],
          missingInEvidence: [],
        },
      };

      const result = synthesizeBoundedInference({
        ticket,
        evidenceUnits: [unit],
        sourceDocuments: [doc],
        assessments: [asm],
      });

      expect(result.bundles.length).toBeGreaterThanOrEqual(1);
      const zeroFeeBundle = result.bundles.find((b) => b.bundleId.startsWith('inf_zero_fee_'));
      expect(zeroFeeBundle).toBeDefined();
      expect(zeroFeeBundle?.relationship).toBe('contradicts');

      // Run decideClaim with this bundle and assessment
      const decideInput: DecideClaimInput = {
        ticket,
        assessments: [asm],
        evidenceUnits: [unit],
        sourceDocuments: [doc],
        claimTemporalScope: {
          quantifier: 'current',
          intervalSemantics: 'existential',
        },
        sourceAuthority: [
          {
            documentId: 'doc_portal_1',
            basis: 'official_primary_record',
            claimApplicability: 'applicable',
          },
        ],
        evidenceTemporalProofs: [
          {
            evidenceId: 'evi_zero_fee_1',
            basis: 'current_validity_confirmed',
            applicableInterval: { start: '2026-09-01', end: '2026-12-31' },
          },
        ],
        assessmentGrounding: [
          {
            assessmentId: 'asm_zero_fee_1',
            contextBasis: 'verified_context',
            limitations: [],
          },
        ],
        transitions: [],
        coverage: {
          researchComplete: true,
          budgetExhausted: false,
          obligations: [],
          rejectedCandidates: [],
          limitations: [],
        },
        policy: {
          policyId: 'pol_pricing',
          policyVersion: '1.0.0',
          propertyRoles: [
            { key: 'feePercentage', role: 'asserted_value', required: true },
            { key: 'threshold', role: 'scope_qualifier', required: true },
            { key: 'statedEffectiveDate', role: 'scope_qualifier', required: true },
          ],
          authoritativeSourceRoles: ['primary_authority'],
        },
        inferenceBundles: result.bundles,
        decidedAt: '2026-11-20T00:00:00Z',
      };

      const decisionOutcome = decideClaim(decideInput);
      expect(decisionOutcome.status).toBe('decided');
      if (decisionOutcome.status === 'decided') {
        expect(decisionOutcome.decision.verdict).toBe('contradicted');
        expect(decisionOutcome.decision.score).toBe(0);
        expect(decisionOutcome.decision.reasonCode).toBe('DECISIVE_CONTRADICTION');
      }
    });

    it('fails closed when zero-fee evidence strictly predates the alleged enactment date (TC-ERA-22 Invariant)', () => {
      const ticket = createFeeTicket('2026-09-01');

      const verbatim = 'Transfers are free of charge for all customers.';

      const doc: SourceDocument = {
        documentId: 'doc_old_1',
        runId: 'run_fee_test',
        url: 'https://bank.org/old-2024-faq',
        finalUrl: 'https://bank.org/old-2024-faq',
        retrievedContentHash: 'hash_old_fee',
        retrievedAt: '2026-11-20T00:00:00Z',
        rawText: verbatim,
        extractionStatus: 'success',
        publicationDate: '2024-05-01',
        effectiveDate: '2024-05-01',
        sourceRole: 'primary_authority',
      };

      const unit: EvidenceUnit = {
        evidenceId: 'evi_old_fee_1',
        documentId: 'doc_old_1',
        verbatimText: verbatim,
        locator: { charOffsetStart: 0, charOffsetEnd: verbatim.length },
        publicationDate: '2024-05-01',
        effectiveDate: '2024-05-01',
        extractionLimitations: [],
        surroundingHeaders: [],
        footnotes: [],
        extractedProperties: [],
      };

      const asm: ClaimEvidenceAssessment = {
        assessmentId: 'asm_old_fee_1',
        claimTicketId: ticket.ticketId,
        claimRevision: ticket.revision,
        evidenceId: 'evi_old_fee_1',
        relationship: 'contradicts',
        scopeMatching: 'match',
        quotationVerified: true,
        temporalApplicability: 'historical_prior',
        sourceSuitability: 'authoritative_primary',
        reasoning: 'Historical 2024 document notes transfers were free.',
        propertyMatchStatus: {
          matching: ['threshold'],
          mismatched: ['feePercentage'],
          missingInEvidence: [],
        },
      };

      const result = synthesizeBoundedInference({
        ticket,
        evidenceUnits: [unit],
        sourceDocuments: [doc],
        assessments: [asm],
      });

      // Must NOT synthesize a contradiction bundle because the evidence pre-dates the alleged enactment
      const zeroFeeBundle = result.bundles.find((b) => b.bundleId.startsWith('inf_zero_fee_'));
      expect(zeroFeeBundle).toBeUndefined();
      expect(result.limitations.some((l) => l.includes('TEMPORAL_PRE_ENACTMENT_CANNOT_REFUTE_LATER_ALLEGATION'))).toBe(true);
    });
  });

  describe('Gate 3: Permissive / Disclosure-Only Statute Refutation', () => {
    it('refutes a fabricated mandatory guarantee when statutory evidence proves the rule is disclosure-only', () => {
      const ticket: ClaimTicket = {
        ticketId: 'tkt_mandate_1',
        claimId: 'clm_mandate_1',
        runId: 'run_mandate_test',
        inputHash: 'hash_mandate',
        revision: 1,
        originalStatement: 'Regulations under 21 CFR 800.30 require manufacturers of medical aids to include a mandatory 90-day return policy on every device sold.',
        normalizedProposition: 'Regulations under 21 CFR 800.30 require manufacturers of medical aids to include a mandatory 90-day return policy on every device sold.',
        domain: 'regulation',
        targetTime: '2026-11-20',
        verificationContext: [
          {
            key: 'mandatoryReturnWindow',
            label: 'Mandatory Return Window',
            propertyType: 'string',
            value: '90-day return policy',
            origin: 'explicit_claim_text',
            status: 'confirmed',
            applicability: 'claim_level',
            role: 'asserted_value',
            sourceSpan: { start: 83, end: 103 },
            units: null,
            confidence: null,
          },
          {
            key: 'regulation',
            label: 'Regulation',
            propertyType: 'string',
            value: '21 CFR 800.30',
            origin: 'explicit_claim_text',
            status: 'confirmed',
            applicability: 'claim_level',
            role: 'scope_qualifier',
            sourceSpan: { start: 18, end: 32 },
            units: null,
            confidence: null,
          },
        ],
        missingMaterialContext: [],
      };

      const verbatim = 'The regulation does not mandate a minimum return policy or warranty duration; sellers may choose to offer no return period, provided the terms of the return policy, if any, are clearly disclosed on the packaging.';

      const doc: SourceDocument = {
        documentId: 'doc_cfr_1',
        runId: 'run_mandate_test',
        url: 'https://ecfr.gov/current/title-21/section-800.30',
        finalUrl: 'https://ecfr.gov/current/title-21/section-800.30',
        retrievedContentHash: 'hash_cfr',
        retrievedAt: '2026-11-20T00:00:00Z',
        rawText: verbatim,
        extractionStatus: 'success',
        publicationDate: '2026-01-01',
        effectiveDate: '2026-01-01',
        sourceRole: 'primary_authority',
      };

      const unit: EvidenceUnit = {
        evidenceId: 'evi_cfr_1',
        documentId: 'doc_cfr_1',
        verbatimText: verbatim,
        locator: { charOffsetStart: 0, charOffsetEnd: verbatim.length },
        publicationDate: '2026-01-01',
        effectiveDate: '2026-01-01',
        extractionLimitations: [],
        surroundingHeaders: [],
        footnotes: [],
        extractedProperties: [],
      };

      const asm: ClaimEvidenceAssessment = {
        assessmentId: 'asm_cfr_1',
        claimTicketId: ticket.ticketId,
        claimRevision: ticket.revision,
        evidenceId: 'evi_cfr_1',
        relationship: 'contradicts',
        scopeMatching: 'match',
        quotationVerified: true,
        temporalApplicability: 'active_at_target_time',
        sourceSuitability: 'authoritative_primary',
        reasoning: 'Statute establishes a disclosure-only rule where sellers may choose to offer no return period, refuting the asserted mandatory 90-day guarantee.',
        propertyMatchStatus: {
          matching: ['regulation'],
          mismatched: ['mandatoryReturnWindow'],
          missingInEvidence: [],
        },
      };

      const synthResult = synthesizeBoundedInference({
        ticket,
        evidenceUnits: [unit],
        sourceDocuments: [doc],
        assessments: [asm],
      });

      expect(synthResult.bundles.length).toBeGreaterThanOrEqual(1);
      const permissiveBundle = synthResult.bundles.find((b) => b.bundleId.startsWith('inf_permissive_statute_'));
      expect(permissiveBundle).toBeDefined();
      expect(permissiveBundle?.relationship).toBe('contradicts');

      const decideInput: DecideClaimInput = {
        ticket,
        assessments: [asm],
        evidenceUnits: [unit],
        sourceDocuments: [doc],
        claimTemporalScope: {
          quantifier: 'current',
          intervalSemantics: 'existential',
        },
        sourceAuthority: [
          {
            documentId: 'doc_cfr_1',
            basis: 'official_primary_record',
            claimApplicability: 'applicable',
          },
        ],
        evidenceTemporalProofs: [
          {
            evidenceId: 'evi_cfr_1',
            basis: 'current_validity_confirmed',
            applicableInterval: { start: '2026-01-01', end: '2026-12-31' },
          },
        ],
        assessmentGrounding: [
          {
            assessmentId: 'asm_cfr_1',
            contextBasis: 'verified_context',
            limitations: [],
          },
        ],
        transitions: [],
        coverage: {
          researchComplete: true,
          budgetExhausted: false,
          obligations: [],
          rejectedCandidates: [],
          limitations: [],
        },
        policy: {
          policyId: 'pol_statute',
          policyVersion: '1.0.0',
          propertyRoles: [
            { key: 'mandatoryReturnWindow', role: 'asserted_value', required: true },
            { key: 'regulation', role: 'scope_qualifier', required: true },
          ],
          authoritativeSourceRoles: ['primary_authority'],
        },
        inferenceBundles: synthResult.bundles,
        decidedAt: '2026-11-20T00:00:00Z',
      };

      const decisionOutcome = decideClaim(decideInput);
      expect(decisionOutcome.status).toBe('decided');
      if (decisionOutcome.status === 'decided') {
        expect(decisionOutcome.decision.verdict).toBe('contradicted');
        expect(decisionOutcome.decision.score).toBe(0);
        expect(decisionOutcome.decision.reasonCode).toBe('DECISIVE_CONTRADICTION');
      }
    });
  });
});
