import { describe, it, expect } from 'vitest';
import {
  inferDocumentSourceRole,
  isUserGeneratedContentUrl,
  isFirstPartyDomainForEntity,
  extractEntityTokens,
} from '@/server/jobs/worker';
import { SUPPORTED_MAX_CLAIMS_PER_RUN } from '@/lib/contracts/dag';
import { decideClaim } from '@/server/verify/decide';
import type { DecideClaimInput } from '@/lib/contracts/decision';
import type { ClaimTicket } from '@/lib/contracts/claim-ticket';

describe('Round 3 Engine Enhancements: First-Party Paths, Secondary Corroboration & Claim Ceiling', () => {
  describe('Fix 1: First-Party Path Default-Allow + Negative Exclusion', () => {
    it('promotes official vendor paths under product or localized routes to primary_authority', () => {
      const appleTokens = ['apple'];
      const githubTokens = ['github'];

      expect(
        inferDocumentSourceRole(
          'https://developer.apple.com/app-store/small-business-program',
          'Apple Developer',
          appleTokens
        )
      ).toBe('primary_authority');

      expect(
        inferDocumentSourceRole(
          'https://apple.com/app-store/small-business-program',
          'Apple Inc',
          appleTokens
        )
      ).toBe('primary_authority');

      expect(
        inferDocumentSourceRole(
          'https://docs.github.com/en/billing/managing-billing-for-your-github-account/about-billing-for-github-actions',
          'GitHub Docs',
          githubTokens
        )
      ).toBe('primary_authority');

      expect(
        inferDocumentSourceRole(
          'https://github.com/pricing',
          'GitHub Pricing',
          githubTokens
        )
      ).toBe('primary_authority');
    });

    it('negatively excludes marketing/recruitment paths (/careers, /customer-stories) on vendor domains', () => {
      const appleTokens = ['apple'];

      expect(
        inferDocumentSourceRole('https://apple.com/careers/us', 'Apple Careers', appleTokens)
      ).not.toBe('primary_authority');

      expect(
        inferDocumentSourceRole(
          'https://apple.com/customer-stories/healthcare',
          'Apple Stories',
          appleTokens
        )
      ).not.toBe('primary_authority');
    });

    it('identifies repo-level discussions, issues, and UGC forum routes as UGC', () => {
      expect(isUserGeneratedContentUrl('https://github.com/orgs/community/discussions/12345')).toBe(
        true
      );
      expect(isUserGeneratedContentUrl('https://github.com/facebook/react/issues/999')).toBe(true);
      expect(isUserGeneratedContentUrl('https://github.com/vercel/next.js/pull/101')).toBe(true);
      expect(isUserGeneratedContentUrl('https://gist.github.com/user/abcdef')).toBe(true);
      expect(isUserGeneratedContentUrl('https://stackoverflow.com/questions/55555')).toBe(true);
      expect(isUserGeneratedContentUrl('https://reddit.com/r/technology/comments/xyz')).toBe(true);
      expect(isUserGeneratedContentUrl('https://quora.com/What-is-GitHub-Actions')).toBe(true);
    });
  });

  describe('Fix 2: Proper Noun Extraction & Registrable Domain Label Matching', () => {
    it('extracts proper nouns while filtering generic entity stopwords', () => {
      const ticket: Partial<ClaimTicket> = {
        normalizedProposition:
          'Apple App Store Small Business Program lowers the commission rate to 15 percent.',
        verificationContext: [
          {
            key: 'program',
            label: 'Program',
            propertyType: 'string',
            value: 'Small Business Program',
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
            value: 'Apple',
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
      expect(tokens).toContain('apple');
      // Generic stopwords like "app", "store", "program" should be filtered out
      expect(tokens).not.toContain('app');
      expect(tokens).not.toContain('store');
      expect(tokens).not.toContain('program');
    });

    it('prevents substring false-positive promotions on third-party domains', () => {
      // "euaiact.com" must NOT match as first-party for "act" or "ai"
      expect(isFirstPartyDomainForEntity('https://euaiact.com/overview', ['act'])).toBe(false);
      expect(isFirstPartyDomainForEntity('https://cicdcalculator.com/team-pricing', ['team'])).toBe(
        false
      );
      expect(isFirstPartyDomainForEntity('https://pricingplanapp.com', ['plan', 'app'])).toBe(false);
    });
  });

  describe('Fix 4: Multi-Source Corroboration for Secondary Evidence', () => {
    function createBaseDecideInput(): DecideClaimInput {
      return {
        ticket: {
          ticketId: 'tkt_corroboration_test',
          claimId: 'clm_corroboration_test',
          runId: 'run_corroboration_test',
          inputHash: 'hash_test',
          revision: 1,
          originalStatement: 'Acme Cloud standard storage costs $0.02 per gigabyte.',
          normalizedProposition: 'Acme Cloud standard storage costs $0.02 per gigabyte.',
          targetTime: '2026-11-20T00:00:00Z',
          domain: 'cloud_fintech',
          verificationContext: [
            {
              key: 'vendor',
              label: 'Vendor',
              propertyType: 'string',
              value: 'Acme Cloud',
              origin: 'explicit_claim_text',
              status: 'confirmed',
              applicability: 'claim_level',
              role: 'scope_qualifier',
              sourceSpan: { start: 0, end: 10 },
              units: null,
              confidence: null,
            },
            {
              key: 'price',
              label: 'Price',
              propertyType: 'number',
              value: 0.02,
              origin: 'explicit_claim_text',
              status: 'confirmed',
              applicability: 'claim_level',
              role: 'asserted_value',
              sourceSpan: { start: 30, end: 35 },
              units: 'USD',
              confidence: null,
            },
          ],
          missingMaterialContext: [],
        },
        assessments: [],
        evidenceUnits: [],
        sourceDocuments: [],
        claimTemporalScope: {
          quantifier: 'current',
          intervalSemantics: 'existential',
        },
        assessmentGrounding: [],
        evidenceTemporalProofs: [],
        sourceAuthority: [],
        transitions: [],
        coverage: {
          researchComplete: true,
          obligations: [],
          rejectedCandidates: [],
          budgetExhausted: false,
          limitations: [],
        },
        policy: {
          policyId: 'generic',
          policyVersion: '1.0.0',
          propertyRoles: [
            { key: 'vendor', role: 'scope_qualifier', required: true },
            { key: 'price', role: 'asserted_value', required: true },
          ],
          authoritativeSourceRoles: ['primary_authority', 'regulatory_filing'],
        },
        decidedAt: '2026-11-20T00:00:00Z',
      };
    }

    function addAssessment(
      input: DecideClaimInput,
      args: {
        id: string;
        url: string;
        relationship: 'supports' | 'contradicts';
        mismatchedPrice?: boolean;
      }
    ) {
      const docId = `doc_${args.id}`;
      const eviId = `evi_${args.id}`;
      const asmId = `asm_${args.id}`;

      input.sourceDocuments.push({
        documentId: docId,
        runId: input.ticket.runId,
        url: args.url,
        finalUrl: args.url,
        retrievedContentHash: `hash_${args.id}`,
        retrievedAt: '2026-11-20T00:00:00Z',
        rawText: 'Acme Cloud storage pricing details...',
        extractionStatus: 'success',
        publicationDate: '2026-11-01',
        effectiveDate: '2026-11-01',
        sourceRole: 'reputable_secondary',
      });

      const verbatim = 'Acme Cloud storage pricing details...';
      input.evidenceUnits.push({
        evidenceId: eviId,
        documentId: docId,
        verbatimText: verbatim,
        locator: { charOffsetStart: 0, charOffsetEnd: verbatim.length },
        effectiveDate: '2026-11-01',
        extractionLimitations: [],
        surroundingHeaders: [],
        footnotes: [],
        extractedProperties: [],
      });

      input.sourceAuthority.push({
        documentId: docId,
        basis: 'independent_secondary_report',
        claimApplicability: 'applicable',
      });

      input.evidenceTemporalProofs.push({
        evidenceId: eviId,
        basis: 'current_validity_confirmed',
        applicableInterval: { start: '2026-01-01', end: '2026-12-31' },
      });

      input.assessments.push({
        assessmentId: asmId,
        claimTicketId: input.ticket.ticketId,
        claimRevision: input.ticket.revision,
        evidenceId: eviId,
        relationship: args.relationship,
        scopeMatching: 'match',
        quotationVerified: true,
        temporalApplicability: 'active_at_target_time',
        sourceSuitability: 'credible_secondary',
        reasoning: 'Grounded secondary source report on pricing.',
        propertyMatchStatus: {
          matching: args.mismatchedPrice ? ['vendor'] : ['vendor', 'price'],
          mismatched: args.mismatchedPrice ? ['price'] : [],
          missingInEvidence: [],
        },
      });

      input.assessmentGrounding.push({
        assessmentId: asmId,
        contextBasis: 'verified_context',
        limitations: [],
      });
    }

    it('single secondary support fails closed to insufficient_evidence', () => {
      const input = createBaseDecideInput();
      addAssessment(input, {
        id: 'techblog',
        url: 'https://techblog.com/acme-pricing',
        relationship: 'supports',
      });

      const outcome = decideClaim(input);
      expect(outcome.status).toBe('decided');
      if (outcome.status === 'decided') {
        expect(outcome.decision.verdict).toBe('insufficient_evidence');
        expect(outcome.decision.score).toBeNull();
        expect(outcome.decision.reasonCode).toBe('INSUFFICIENT_RETRIEVAL_DATA');
        expect(outcome.decision.limitations).toContain(
          'UNCORROBORATED_SECONDARY_SOURCE: asm_techblog'
        );
      }
    });

    it('corroborated secondary support across >= 2 independent domains yields supported at 75', () => {
      const input = createBaseDecideInput();
      addAssessment(input, {
        id: 'news1',
        url: 'https://reuters.com/acme-pricing-report',
        relationship: 'supports',
      });
      addAssessment(input, {
        id: 'news2',
        url: 'https://bloomberg.com/acme-storage-fees',
        relationship: 'supports',
      });

      const outcome = decideClaim(input);
      expect(outcome.status).toBe('decided');
      if (outcome.status === 'decided') {
        expect(outcome.decision.verdict).toBe('supported');
        expect(outcome.decision.score).toBe(75);
        expect(outcome.decision.reasonCode).toBe('INDIRECT_CREDIBLE_SUPPORT');
      }
    });

    it('single secondary contradiction fails closed to insufficient_evidence', () => {
      const input = createBaseDecideInput();
      addAssessment(input, {
        id: 'contradict1',
        url: 'https://techblog.com/acme-real-pricing',
        relationship: 'contradicts',
        mismatchedPrice: true,
      });

      const outcome = decideClaim(input);
      expect(outcome.status).toBe('decided');
      if (outcome.status === 'decided') {
        expect(outcome.decision.verdict).toBe('insufficient_evidence');
        expect(outcome.decision.score).toBeNull();
        expect(outcome.decision.reasonCode).toBe('INSUFFICIENT_RETRIEVAL_DATA');
        expect(outcome.decision.limitations).toContain(
          'UNCORROBORATED_SECONDARY_OPPOSITION: asm_contradict1'
        );
      }
    });

    it('corroborated secondary contradiction across >= 2 independent domains yields contradicted at 0', () => {
      const input = createBaseDecideInput();
      addAssessment(input, {
        id: 'contradict1',
        url: 'https://techblog.com/acme-real-pricing',
        relationship: 'contradicts',
        mismatchedPrice: true,
      });
      addAssessment(input, {
        id: 'contradict2',
        url: 'https://theregister.com/acme-costs-revealed',
        relationship: 'contradicts',
        mismatchedPrice: true,
      });

      const outcome = decideClaim(input);
      expect(outcome.status).toBe('decided');
      if (outcome.status === 'decided') {
        expect(outcome.decision.verdict).toBe('contradicted');
        expect(outcome.decision.score).toBe(0);
        expect(outcome.decision.reasonCode).toBe('DECISIVE_CONTRADICTION');
      }
    });
  });

  describe('Fix 5: Claim Budget Ceiling', () => {
    it('sets SUPPORTED_MAX_CLAIMS_PER_RUN to 8', () => {
      expect(SUPPORTED_MAX_CLAIMS_PER_RUN).toBe(8);
    });
  });
});
