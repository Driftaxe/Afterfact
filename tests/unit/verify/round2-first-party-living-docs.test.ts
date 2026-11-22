import { describe, it, expect, vi } from 'vitest';
import * as bifrostClient from '@/server/bifrost/client';

vi.mock('@/server/bifrost/client', () => ({
  bifrostChat: vi.fn(),
  BifrostError: class BifrostError extends Error {},
}));
import {
  inferDocumentSourceRole,
  isUserGeneratedContentUrl,
  isFirstPartyDomainForEntity,
  extractEntityTokens,
} from '@/server/jobs/worker';
import { generateResearchPlan } from '@/server/verify/research-planner';
import { evaluateTemporalApplicability } from '@/server/verify/temporal';
import { sanitizePassageText } from '@/server/tavily/client';
import { decideClaim } from '@/server/verify/decide';
import type { DecideClaimInput } from '@/lib/contracts/decision';
import type { ClaimTicket } from '@/lib/contracts/claim-ticket';

describe('Round 2 Engine Enhancements: First-Party Authority, Living Docs, Ambient Provenance', () => {
  describe('1. Dynamic First-Party Entity Authority Resolution & UGC Guardrail', () => {
    it('promotes official first-party vendor paths (/pricing, /limits, /legal) to primary_authority', () => {
      const entityTokens = ['cloudcorp', 'aurora'];

      const pricingRole = inferDocumentSourceRole('https://cloudcorp.io/pricing', 'CloudCorp', entityTokens);
      const limitsRole = inferDocumentSourceRole('https://docs.cloudcorp.io/limits', 'CloudCorp', entityTokens);
      const legalRole = inferDocumentSourceRole('https://cloudcorp.io/legal/terms', 'CloudCorp', entityTokens);

      expect(pricingRole).toBe('primary_authority');
      expect(limitsRole).toBe('primary_authority');
      expect(legalRole).toBe('primary_authority');
    });

    it('strictly excludes user-generated content (community, forums, repost) from primary_authority', () => {
      const entityTokens = ['cloudcorp'];

      const communityRole = inferDocumentSourceRole('https://community.cloudcorp.io/questions/123', 'CloudCorp Community', entityTokens);
      const forumRole = inferDocumentSourceRole('https://cloudcorp.io/forum/discussions/456', 'Forum', entityTokens);
      const repostRole = inferDocumentSourceRole('https://repost.aws/questions/789', 'AWS Repost', ['aws']);
      const redditRole = inferDocumentSourceRole('https://reddit.com/r/cloudcorp/comments/abc', 'Reddit', entityTokens);

      expect(isUserGeneratedContentUrl('https://community.cloudcorp.io/questions/123')).toBe(true);
      expect(isUserGeneratedContentUrl('https://cloudcorp.io/forum/discussions/456')).toBe(true);
      expect(isUserGeneratedContentUrl('https://repost.aws/questions/789')).toBe(true);

      expect(communityRole).toBe('counter_perspective');
      expect(forumRole).toBe('counter_perspective');
      expect(repostRole).toBe('counter_perspective');
      expect(redditRole).toBe('counter_perspective');
    });

    it('correctly extracts entity tokens across diverse vendor properties', () => {
      const ticket: Partial<ClaimTicket> = {
        normalizedProposition: 'DataSphere DB enforces a maximum quota of 500 connections.',
        verificationContext: [
          {
            key: 'productName',
            label: 'Product Name',
            propertyType: 'string',
            value: 'DataSphere DB Cluster',
            origin: 'explicit_claim_text',
            status: 'confirmed',
            applicability: 'claim_level',
            role: 'scope_qualifier',
            sourceSpan: null,
            units: null,
            confidence: null,
          },
          {
            key: 'vendor',
            label: 'Vendor',
            propertyType: 'string',
            value: 'Acme Systems',
            origin: 'explicit_claim_text',
            status: 'confirmed',
            applicability: 'claim_level',
            role: 'scope_qualifier',
            sourceSpan: null,
            units: null,
            confidence: null,
          },
        ],
      };

      const tokens = extractEntityTokens(ticket as ClaimTicket);
      expect(tokens).toContain('datasphere');
      expect(tokens).toContain('cluster');
      expect(tokens).toContain('acme');
      expect(tokens).toContain('systems');

      expect(isFirstPartyDomainForEntity('https://datasphere.io/pricing', tokens)).toBe(true);
      expect(isFirstPartyDomainForEntity('https://acme.com/docs/quotas', tokens)).toBe(true);
      expect(isFirstPartyDomainForEntity('https://unrelated-third-party.com/blog', tokens)).toBe(false);
    });
  });

  describe('2. First-Party Canonical Retrieval Branch in plan_research', () => {
    it('guarantees an official canonical retrieval query for pricing claims', async () => {
      const ticket: ClaimTicket = {
        ticketId: 'tkt_pricing_test_r1',
        claimId: 'clm_pricing_test',
        runId: 'run_test',
        inputHash: 'hash',
        revision: 1,
        originalStatement: 'MegaPay charges 1.5% plus 10 cents per transaction on its standard tier.',
        normalizedProposition: 'MegaPay charges 1.5% plus 10 cents per transaction on its standard tier.',
        domain: 'pricing',
        targetTime: '2026-11-22',
        sourceSpan: { start: 0, end: 50 },
        missingMaterialContext: [],
        components: [],
        relationships: [],
        verificationContext: [
          {
            key: 'provider',
            label: 'Provider',
            propertyType: 'string',
            value: 'MegaPay',
            origin: 'explicit_claim_text',
            status: 'confirmed',
            applicability: 'claim_level',
            role: 'scope_qualifier',
            sourceSpan: null,
            units: null,
            confidence: null,
          },
        ],
      };

      vi.mocked(bifrostClient.bifrostChat).mockResolvedValueOnce(
        JSON.stringify({
          requiresCounterevidenceQuery: false,
          materialUnknownQualifiers: [],
          stoppingConditions: ['Official vendor pricing documentation found'],
          queries: [
            {
              query: 'MegaPay standard tier pricing transaction',
              purpose: 'establish_current_state',
              targetSourceRoles: ['reputable_secondary'],
            },
            {
              query: 'MegaPay transaction fee discount',
              purpose: 'investigate_exceptions_or_scope',
              targetSourceRoles: ['reputable_secondary'],
            },
          ],
        })
      );

      const plan = await generateResearchPlan({ ticket, round: 1 });
      expect(plan.status).toBe('success');
      if (plan.status === 'success') {
        const hasOfficialQuery = plan.plan.queries.some(
          (q) =>
            q.query.toLowerCase().includes('megapay') &&
            (q.query.toLowerCase().includes('official') || q.query.toLowerCase().includes('pricing')) &&
            q.targetSourceRoles.includes('primary_authority')
        );
        expect(hasOfficialQuery).toBe(true);
      }
    });
  });

  describe('3. Ambient Provenance Inheritance & Scope Matching (TC-ERA-20)', () => {
    it('satisfies ambient regulator and sovereign jurisdiction qualifiers from official document provenance', () => {
      const fcaText = 'Authorized brokerages must submit liquidity returns on a quarterly basis within 15 business days.';
      const input: DecideClaimInput = {
        ticket: {
          ticketId: 'tkt_ambient_test_r1',
          claimId: 'clm_ambient_test',
          runId: 'run_ambient',
          inputHash: 'hash',
          revision: 1,
          originalStatement: 'Financial authority FCA requires all UK brokerages to submit quarterly liquidity reports.',
          normalizedProposition: 'The FCA mandates quarterly liquidity reports for UK brokerages.',
          domain: 'regulation',
          targetTime: '2026-11-22',
          sourceSpan: { start: 0, end: 50 },
          missingMaterialContext: [],
          components: [],
          relationships: [],
          verificationContext: [
            {
              key: 'jurisdiction',
              label: 'Jurisdiction',
              propertyType: 'string',
              value: 'UK',
              origin: 'explicit_claim_text',
              status: 'confirmed',
              applicability: 'claim_level',
              role: 'scope_qualifier',
              sourceSpan: { start: 29, end: 31 },
              units: null,
              confidence: null,
            },
            {
              key: 'regulator',
              label: 'Regulator',
              propertyType: 'string',
              value: 'FCA',
              origin: 'explicit_claim_text',
              status: 'confirmed',
              applicability: 'claim_level',
              role: 'scope_qualifier',
              sourceSpan: { start: 20, end: 23 },
              units: null,
              confidence: null,
            },
            {
              key: 'filingFrequency',
              label: 'Filing Frequency',
              propertyType: 'string',
              value: 'quarterly',
              origin: 'explicit_claim_text',
              status: 'confirmed',
              applicability: 'claim_level',
              role: 'asserted_value',
              sourceSpan: { start: 57, end: 66 },
              units: null,
              confidence: null,
            },
          ],
        },
        assessments: [
          {
            assessmentId: 'asm_ambient_1',
            claimTicketId: 'tkt_ambient_test_r1',
            claimRevision: 1,
            evidenceId: 'evi_fca_1',
            relationship: 'supports',
            scopeMatching: 'match',
            sourceSuitability: 'authoritative_primary',
            modelConfidence: 0.98,
            quotationVerified: true,
            temporalApplicability: 'active_at_target_time',
            reasoning: 'Grounded passage from official FCA handbook confirming quarterly liquidity filing frequency.',
            propertyMatchStatus: {
              matching: ['filingFrequency'],
              mismatched: [],
              missingInEvidence: ['jurisdiction', 'regulator'], // Note: Snippet did not repeat words "FCA" or "UK"
            },
          },
        ],
        evidenceUnits: [
          {
            evidenceId: 'evi_fca_1',
            documentId: 'doc_fca_handbook',
            verbatimText: fcaText,
            locator: { charOffsetStart: 0, charOffsetEnd: fcaText.length },
            surroundingHeaders: ['Supervision', 'Prudential Standards'],
            footnotes: [],
            extractedProperties: [],
            extractionLimitations: [],
          },
        ],
        sourceDocuments: [
          {
            documentId: 'doc_fca_handbook',
            runId: 'run_ambient',
            url: 'https://www.handbook.fca.org.uk/handbook/SUP/16/12.html',
            finalUrl: 'https://www.handbook.fca.org.uk/handbook/SUP/16/12.html',
            retrievedContentHash: 'hash_fca',
            retrievedAt: '2026-11-22T00:00:00Z',
            rawText: fcaText,
            extractionStatus: 'success',
            sourceRole: 'primary_authority',
            effectiveDate: '2026-01-01',
          },
        ],
        sourceAuthority: [
          {
            documentId: 'doc_fca_handbook',
            basis: 'official_primary_record',
            claimApplicability: 'applicable',
          },
        ],
        claimTemporalScope: { quantifier: 'current', intervalSemantics: 'existential' },
        assessmentGrounding: [
          { assessmentId: 'asm_ambient_1', contextBasis: 'verified_context', limitations: [] },
        ],
        evidenceTemporalProofs: [
          { evidenceId: 'evi_fca_1', basis: 'current_validity_confirmed' },
        ],
        transitions: [],
        inferenceBundles: [],
        coverage: {
          researchComplete: true,
          obligations: [],
          rejectedCandidates: [],
          budgetExhausted: false,
          limitations: [],
        },
        policy: {
          policyId: 'regulation',
          policyVersion: '1.0.0',
          propertyRoles: [
            { key: 'jurisdiction', role: 'scope_qualifier', required: true },
            { key: 'regulator', role: 'scope_qualifier', required: true },
            { key: 'filingFrequency', role: 'asserted_value', required: true },
          ],
          authoritativeSourceRoles: ['primary_authority'],
        },
        decidedAt: '2026-11-22T00:00:00Z',
        traceIds: { runId: 'run_ambient', nodeId: 'node_decide_ambient' },
      };

      const outcome = decideClaim(input);
      expect(outcome.status).toBe('decided');
      if (outcome.status === 'decided') {
        expect(outcome.decision.verdict).toBe('supported');
        expect(outcome.decision.score).toBe(100);
        expect(outcome.decision.reasonCode).toBe('AUTHORITATIVE_PRIMARY_SUPPORT');
      }
    });

    it('enforces anti-conflation guardrail: does NOT ambiently inherit non-ambient regional or method qualifiers', () => {
      const input: DecideClaimInput = {
        ticket: {
          ticketId: 'tkt_conflation_test_r1',
          claimId: 'clm_conflation_test',
          runId: 'run_conflation',
          inputHash: 'hash',
          revision: 1,
          originalStatement: 'MegaCorp charges $5 for Wire Transfer in the US.',
          normalizedProposition: 'MegaCorp charges $5 for Wire Transfer.',
          domain: 'pricing',
          targetTime: '2026-11-22',
          sourceSpan: { start: 0, end: 40 },
          missingMaterialContext: [],
          components: [],
          relationships: [],
          verificationContext: [
            {
              key: 'paymentMethod',
              label: 'Payment Method',
              propertyType: 'string',
              value: 'Wire Transfer',
              origin: 'explicit_claim_text',
              status: 'confirmed',
              applicability: 'claim_level',
              role: 'scope_qualifier',
              sourceSpan: { start: 23, end: 36 },
              units: null,
              confidence: null,
            },
            {
              key: 'fee',
              label: 'Fee',
              propertyType: 'number',
              value: 5,
              origin: 'explicit_claim_text',
              status: 'confirmed',
              applicability: 'claim_level',
              role: 'asserted_value',
              sourceSpan: { start: 19, end: 21 },
              units: 'USD',
              confidence: null,
            },
          ],
        },
        assessments: [
          {
            assessmentId: 'asm_conflation_1',
            claimTicketId: 'tkt_conflation_test_r1',
            claimRevision: 1,
            evidenceId: 'evi_conflation_1',
            relationship: 'supports',
            scopeMatching: 'match',
            sourceSuitability: 'authoritative_primary',
            modelConfidence: 0.98,
            quotationVerified: true,
            temporalApplicability: 'active_at_target_time',
            reasoning: 'Excerpt states $5 fee but payment method is missing in evidence.',
            propertyMatchStatus: {
              matching: ['fee'],
              mismatched: [],
              missingInEvidence: ['paymentMethod'], // Missing non-ambient scope qualifier
            },
          },
        ],
        evidenceUnits: [
          {
            evidenceId: 'evi_conflation_1',
            documentId: 'doc_megacorp_pricing',
            verbatimText: 'Standard processing fee is $5 per item.',
            locator: { charOffsetStart: 0, charOffsetEnd: 39 },
            surroundingHeaders: ['Pricing Table'],
            footnotes: [],
            extractedProperties: [],
            extractionLimitations: [],
          },
        ],
        sourceDocuments: [
          {
            documentId: 'doc_megacorp_pricing',
            runId: 'run_conflation',
            url: 'https://megacorp.com/pricing',
            finalUrl: 'https://megacorp.com/pricing',
            retrievedContentHash: 'hash_mega',
            retrievedAt: '2026-11-22T00:00:00Z',
            rawText: 'Standard processing fee is $5 per item.',
            extractionStatus: 'success',
            sourceRole: 'primary_authority',
            effectiveDate: '2026-01-01',
          },
        ],
        sourceAuthority: [
          {
            documentId: 'doc_megacorp_pricing',
            basis: 'official_primary_record',
            claimApplicability: 'applicable',
          },
        ],
        claimTemporalScope: { quantifier: 'current', intervalSemantics: 'existential' },
        assessmentGrounding: [
          { assessmentId: 'asm_conflation_1', contextBasis: 'verified_context', limitations: [] },
        ],
        evidenceTemporalProofs: [
          { evidenceId: 'evi_conflation_1', basis: 'current_validity_confirmed' },
        ],
        transitions: [],
        inferenceBundles: [],
        coverage: {
          researchComplete: true,
          obligations: [],
          rejectedCandidates: [],
          budgetExhausted: false,
          limitations: [],
        },
        policy: {
          policyId: 'pricing',
          policyVersion: '1.0.0',
          propertyRoles: [
            { key: 'paymentMethod', role: 'scope_qualifier', required: true },
            { key: 'fee', role: 'asserted_value', required: true },
          ],
          authoritativeSourceRoles: ['primary_authority'],
        },
        decidedAt: '2026-11-22T00:00:00Z',
        traceIds: { runId: 'run_conflation', nodeId: 'node_decide_conflation' },
      };

      const outcome = decideClaim(input);
      expect(outcome.status).toBe('decided');
      if (outcome.status === 'decided') {
        expect(outcome.decision.verdict).toBe('insufficient_evidence');
        expect(outcome.decision.limitations).toContain('REQUIRED_PROPERTY_MISSING: asm_conflation_1');
      }
    });
  });

  describe('4. Contemporaneous Temporal Framing & Undated Living Reference Docs (TC-ERA-22)', () => {
    it('accepts undated living canonical reference docs as active_at_target_time for contemporaneous claims', () => {
      const result = evaluateTemporalApplicability({
        targetTime: '2026-11-22',
        retrievedAt: '2026-11-22T03:00:00Z',
        isLivingDocument: true,
      });

      expect(result.temporalApplicability).toBe('active_at_target_time');
      expect(result.reasoning).toContain('Living canonical reference document retrieved contemporaneously');
    });

    it('strictly preserves TC-ERA-22: undated living docs cannot refute historical claims from past years', () => {
      const historicalResult = evaluateTemporalApplicability({
        targetTime: '2026-11-22',
        claimTime: '2019', // Historical assertion: "In 2019..."
        retrievedAt: '2026-11-22T03:00:00Z',
        isLivingDocument: true,
      });

      // Must NOT be active_at_target_time for historical claims without contemporaneous evidence
      expect(historicalResult.temporalApplicability).not.toBe('active_at_target_time');
      expect(historicalResult.temporalApplicability).toBe('historical_prior');
    });
  });

  describe('5. Markdown Heading and Table Structure Sanitization', () => {
    it('preserves markdown headers and table rows while collapsing horizontal spaces', () => {
      const inputWithMarkdown = `
        # API Limits
        The following table outlines runtime execution limits:
        | Resource | Maximum Allocation |
        | --- | --- |
        | Timeout | 900 seconds |
        | Memory | 10240 MB |
      `;

      const sanitized = sanitizePassageText(inputWithMarkdown);
      expect(sanitized).toContain('# API Limits');
      expect(sanitized).toContain('| Resource | Maximum Allocation |');
      expect(sanitized).toContain('| Timeout | 900 seconds |');
      expect(sanitized).toContain('\n|'); // Preserves newline between rows
    });
  });
});
