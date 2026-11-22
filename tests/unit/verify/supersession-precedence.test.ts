import { describe, it, expect } from 'vitest';
import {
  sanitizeQueryText,
  validateAuthoritativeDomain,
} from '@/server/verify/research-planner';
import {
  extractRegistrableDomainLabel,
  extractEntityTokens,
  inferDocumentSourceRole,
} from '@/server/jobs/worker';
import { decideClaim, DECISION_REASON_CODES } from '@/server/verify/decide';
import type { DecideClaimInput } from '@/lib/contracts/decision';
import type { ClaimTicket } from '@/lib/contracts/claim-ticket';

describe('Surgical Engine Refinement: Supersession Precedence & Concrete Agency includeDomains', () => {
  describe('Requirement 1: Concrete Agency Hostname Validation & site: Query Sanitization', () => {
    it('sanitizes raw site: operators from query text without degrading keywords', () => {
      expect(sanitizeQueryText('UPI Lite rules gazette site:gov.in')).toBe(
        'UPI Lite rules gazette'
      );
      expect(sanitizeQueryText('site:irs.gov 401k contribution limits 2026')).toBe(
        '401k contribution limits 2026'
      );
      expect(sanitizeQueryText('TSA REAL ID enforcement site:tsa.gov site:dhs.gov')).toBe(
        'TSA REAL ID enforcement'
      );
      expect(sanitizeQueryText('PostgreSQL identifier length site:postgresql.org')).toBe(
        'PostgreSQL identifier length'
      );
    });

    it('validates concrete authoritative hostnames and strips protocols/paths/www', () => {
      expect(validateAuthoritativeDomain('irs.gov')).toBe('irs.gov');
      expect(validateAuthoritativeDomain('https://www.tsa.gov/travel')).toBe('tsa.gov');
      expect(validateAuthoritativeDomain('rbi.org.in')).toBe('rbi.org.in');
      expect(validateAuthoritativeDomain('https://eur-lex.europa.eu/legal-content')).toBe(
        'eur-lex.europa.eu'
      );
      expect(validateAuthoritativeDomain('vercel.com/docs')).toBe('vercel.com');
      expect(validateAuthoritativeDomain('postgresql.org')).toBe('postgresql.org');
    });

    it('rejects bare public-suffix TLD namespaces and UGC domains', () => {
      expect(validateAuthoritativeDomain('gov')).toBeNull();
      expect(validateAuthoritativeDomain('gov.in')).toBeNull();
      expect(validateAuthoritativeDomain('nic.in')).toBeNull();
      expect(validateAuthoritativeDomain('co.uk')).toBeNull();
      expect(validateAuthoritativeDomain('org.in')).toBeNull();
      expect(validateAuthoritativeDomain('reddit.com')).toBeNull();
      expect(validateAuthoritativeDomain('https://quora.com/topic')).toBeNull();
      expect(validateAuthoritativeDomain('stackoverflow.com')).toBeNull();
      expect(validateAuthoritativeDomain('')).toBeNull();
      expect(validateAuthoritativeDomain('not a domain')).toBeNull();
    });

    it('extracts correct registrable domain label without collision on multi-part suffixes (.bank.in, .org.in)', () => {
      const kotak = extractRegistrableDomainLabel('kotak.bank.in');
      expect(kotak.registrableLabel).toBe('kotak');

      const rbi = extractRegistrableDomainLabel('rbi.org.in');
      expect(rbi.registrableLabel).toBe('rbi');

      const vercel = extractRegistrableDomainLabel('vercel.com');
      expect(vercel.registrableLabel).toBe('vercel');

      const pg = extractRegistrableDomainLabel('docs.postgresql.org');
      expect(pg.registrableLabel).toBe('postgresql');
    });

    it('generates multi-word agency acronym (Reserve Bank of India -> rbi) without generic noun collision', () => {
      const ticketProps = [
        {
          key: 'regulator',
          label: 'Regulator',
          value: 'Reserve Bank of India',
          propertyType: 'string' as const,
          origin: 'explicit_claim_text' as const,
          status: 'confirmed' as const,
          applicability: 'claim_level' as const,
          role: 'scope_qualifier' as const,
        },
      ];
      const tokens = extractEntityTokens(ticketProps);
      expect(tokens).toContain('rbi');
      expect(tokens).toContain('reserve');
      // Generic stopwords 'bank' and 'india' must NOT be in tokens
      expect(tokens).not.toContain('bank');
      expect(tokens).not.toContain('india');

      // RBI official domain matches primary_authority
      expect(
        inferDocumentSourceRole(
          'https://rbi.org.in/Scripts/BS_PressReleaseDisplay.aspx?prid=58814',
          'Reserve Bank of India',
          tokens
        )
      ).toBe('primary_authority');

      // Third-party commercial bank or news does NOT get promoted to primary_authority
      expect(
        inferDocumentSourceRole(
          'https://kotak.bank.in/upi-lite-faqs',
          'Kotak Bank',
          tokens
        )
      ).not.toBe('primary_authority');

      expect(
        inferDocumentSourceRole(
          'https://timesofindia.indiatimes.com/business/india-business/upi-lite-rules',
          'Times of India',
          tokens
        )
      ).toBe('reputable_secondary');
    });
  });

  describe('Requirement 2: Authority Hierarchy & Supersession Transition Precedence in decideClaim()', () => {
    function makeBaseTicket(): ClaimTicket {
      return {
        ticketId: 'tkt_upi_lite_limit',
        claimId: 'clm_upi_lite',
        runId: 'run_test_supersession',
        inputHash: 'hash_test',
        revision: 1,
        originalStatement: 'Under Reserve Bank of India (RBI) offline payment guidelines, UPI Lite remains capped at ₹500 per transaction.',
        normalizedProposition: 'UPI Lite transaction limit remains capped at ₹500 per transaction',
        domain: 'regulation',
        timeSensitivity: 'medium',
        targetTime: '2026-11-20T00:00:00Z',
        verificationContext: [
          {
            key: 'regulator',
            label: 'Regulator',
            value: 'Reserve Bank of India',
            propertyType: 'string',
            origin: 'explicit_claim_text',
            sourceSpan: { start: 0, end: 32 },
            status: 'confirmed',
            applicability: 'claim_level',
            role: 'scope_qualifier',
          },
          {
            key: 'transactionLimit',
            label: 'Transaction Limit',
            value: 500,
            units: 'INR',
            propertyType: 'number',
            origin: 'explicit_claim_text',
            sourceSpan: { start: 70, end: 74 },
            status: 'confirmed',
            applicability: 'claim_level',
            role: 'asserted_value',
          },
        ],
        missingMaterialContext: [],
      };
    }

    it('resolves primary_authority opposition over reputable_secondary support without false conflicting_evidence', () => {
      const ticket = makeBaseTicket();

      const input: DecideClaimInput = {
        ticket,
        assessments: [
          {
            assessmentId: 'asm_support_secondary',
            claimTicketId: ticket.ticketId,
            evidenceId: 'ev_support',
            claimRevision: 1,
            relationship: 'supports',
            scopeMatching: 'match',
            modelConfidence: 0.85,
            quotationVerified: true,
            propertyMatchStatus: { matching: ['transactionLimit', 'regulator'], mismatched: [], missingInEvidence: [] },
            temporalApplicability: 'active_at_target_time',
            sourceSuitability: 'credible_secondary',
            reasoning: 'Legacy fintech blog mentions UPI Lite cap of Rs 500.',
          },
          {
            assessmentId: 'asm_oppose_primary',
            claimTicketId: ticket.ticketId,
            evidenceId: 'ev_oppose',
            claimRevision: 1,
            relationship: 'contradicts',
            scopeMatching: 'match',
            modelConfidence: 0.95,
            quotationVerified: true,
            propertyMatchStatus: { matching: ['regulator'], mismatched: ['transactionLimit'], missingInEvidence: [] },
            temporalApplicability: 'active_at_target_time',
            sourceSuitability: 'authoritative_primary',
            reasoning: 'RBI circular confirms the transaction limit is ₹1,000.',
          },
        ],
        evidenceUnits: [
          {
            evidenceId: 'ev_support',
            documentId: 'doc_support',
            verbatimText: 'The UPI Lite transaction limit is currently ₹500.',
            extractionLimitations: [],
            surroundingHeaders: [],
            footnotes: [],
            extractedProperties: [],
            locator: { charOffsetStart: 0, charOffsetEnd: 'The UPI Lite transaction limit is currently ₹500.'.length },
          },
          {
            evidenceId: 'ev_oppose',
            documentId: 'doc_oppose',
            verbatimText: 'The Reserve Bank of India has fixed the transaction limit for UPI Lite at ₹1,000.',
            extractionLimitations: [],
            surroundingHeaders: [],
            footnotes: [],
            extractedProperties: [],
            locator: { charOffsetStart: 0, charOffsetEnd: 'The Reserve Bank of India has fixed the transaction limit for UPI Lite at ₹1,000.'.length },
          },
        ],
        sourceDocuments: [
          {
            documentId: 'doc_support',
            runId: 'run_test_supersession',
            url: 'https://fintechblog.com/upi-lite',
            finalUrl: 'https://fintechblog.com/upi-lite',
            retrievedContentHash: 'h_sup',
            retrievedAt: '2026-11-20T00:00:00Z',
            rawText: 'The UPI Lite transaction limit is currently ₹500.',
            extractionStatus: 'success',
            sourceRole: 'reputable_secondary',
          },
          {
            documentId: 'doc_oppose',
            runId: 'run_test_supersession',
            url: 'https://rbi.org.in/circulars/upi-lite',
            finalUrl: 'https://rbi.org.in/circulars/upi-lite',
            retrievedContentHash: 'h_opp',
            retrievedAt: '2026-11-20T00:00:00Z',
            rawText: 'The Reserve Bank of India has fixed the transaction limit for UPI Lite at ₹1,000.',
            extractionStatus: 'success',
            sourceRole: 'primary_authority',
          },
        ],
        claimTemporalScope: { quantifier: 'current', intervalSemantics: 'existential' },
        assessmentGrounding: [
          { assessmentId: 'asm_support_secondary', contextBasis: 'verified_context', limitations: [] },
          { assessmentId: 'asm_oppose_primary', contextBasis: 'verified_context', limitations: [] },
        ],
        evidenceTemporalProofs: [
          { evidenceId: 'ev_support', basis: 'current_validity_confirmed' },
          { evidenceId: 'ev_oppose', basis: 'current_validity_confirmed' },
        ],
        sourceAuthority: [
          { documentId: 'doc_support', basis: 'independent_secondary_report', claimApplicability: 'applicable' },
          { documentId: 'doc_oppose', basis: 'official_primary_record', claimApplicability: 'applicable' },
        ],
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
            { key: 'regulator', role: 'scope_qualifier', required: true },
            { key: 'transactionLimit', role: 'asserted_value', required: true },
          ],
          authoritativeSourceRoles: ['primary_authority', 'reputable_secondary'],
        },
        decidedAt: '2026-11-20T00:00:00Z',
        traceIds: { runId: 'run_test_supersession', nodeId: 'node_decide' },
      };

      const outcome = decideClaim(input);
      expect(outcome.status).toBe('decided');
      if (outcome.status !== 'decided') return;

      // Primary authority must override secondary without deadlocking into conflicting_evidence
      expect(outcome.decision.verdict).toBe('contradicted');
      expect(outcome.decision.score).toBe(0);
      expect(outcome.decision.reasonCode).toBe(DECISION_REASON_CODES.DECISIVE_CONTRADICTION);
    });

    it('resolves documented V_old -> V_new supersession + undated V_old page to outdated (PROVEN_OUTDATED_BY_SUPERSEDING)', () => {
      const ticket = makeBaseTicket();

      const input: DecideClaimInput = {
        ticket,
        assessments: [
          {
            assessmentId: 'asm_support_stale',
            claimTicketId: ticket.ticketId,
            evidenceId: 'ev_support_stale',
            claimRevision: 1,
            relationship: 'supports',
            scopeMatching: 'match',
            modelConfidence: 0.9,
            quotationVerified: true,
            propertyMatchStatus: { matching: ['transactionLimit', 'regulator'], mismatched: [], missingInEvidence: [] },
            temporalApplicability: 'active_at_target_time',
            sourceSuitability: 'credible_secondary',
            reasoning: 'Commercial page lists UPI Lite transaction limit as ₹500.',
          },
          {
            assessmentId: 'asm_oppose_transition',
            claimTicketId: ticket.ticketId,
            evidenceId: 'ev_oppose_transition',
            claimRevision: 1,
            relationship: 'contradicts',
            scopeMatching: 'match',
            modelConfidence: 0.95,
            quotationVerified: true,
            propertyMatchStatus: { matching: ['regulator'], mismatched: ['transactionLimit'], missingInEvidence: [] },
            temporalApplicability: 'active_at_target_time',
            sourceSuitability: 'credible_secondary',
            reasoning: 'News report confirms RBI increased UPI Lite transaction limit from ₹500 to ₹1,000 on October 9, 2024.',
          },
        ],
        evidenceUnits: [
          {
            evidenceId: 'ev_support_stale',
            documentId: 'doc_support_stale',
            verbatimText: 'Under the current norms, the limit for UPI Lite transactions is ₹500.',
            extractionLimitations: [],
            surroundingHeaders: [],
            footnotes: [],
            extractedProperties: [],
            locator: { charOffsetStart: 0, charOffsetEnd: 'Under the current norms, the limit for UPI Lite transactions is ₹500.'.length },
          },
          {
            evidenceId: 'ev_oppose_transition',
            documentId: 'doc_oppose_transition',
            verbatimText: 'The Reserve Bank of India has enhanced the UPI Lite per-transaction limit from ₹500 to ₹1,000 effective October 9, 2024.',
            extractionLimitations: [],
            surroundingHeaders: [],
            footnotes: [],
            extractedProperties: [],
            locator: { charOffsetStart: 0, charOffsetEnd: 'The Reserve Bank of India has enhanced the UPI Lite per-transaction limit from ₹500 to ₹1,000 effective October 9, 2024.'.length },
          },
        ],
        sourceDocuments: [
          {
            documentId: 'doc_support_stale',
            runId: 'run_test_supersession',
            url: 'https://bankguide.in/upi-lite',
            finalUrl: 'https://bankguide.in/upi-lite',
            retrievedContentHash: 'h_sup_stale',
            retrievedAt: '2026-11-20T00:00:00Z',
            rawText: 'Under the current norms, the limit for UPI Lite transactions is ₹500.',
            extractionStatus: 'success',
            sourceRole: 'reputable_secondary',
          },
          {
            documentId: 'doc_oppose_transition',
            runId: 'run_test_supersession',
            url: 'https://financialexpress.com/upi-lite-limit-raised',
            finalUrl: 'https://financialexpress.com/upi-lite-limit-raised',
            retrievedContentHash: 'h_opp_trans',
            retrievedAt: '2026-11-20T00:00:00Z',
            rawText: 'The Reserve Bank of India has enhanced the UPI Lite per-transaction limit from ₹500 to ₹1,000 effective October 9, 2024.',
            extractionStatus: 'success',
            sourceRole: 'reputable_secondary',
          },
        ],
        claimTemporalScope: { quantifier: 'current', intervalSemantics: 'existential' },
        assessmentGrounding: [
          { assessmentId: 'asm_support_stale', contextBasis: 'verified_context', limitations: [] },
          { assessmentId: 'asm_oppose_transition', contextBasis: 'verified_context', limitations: [] },
        ],
        evidenceTemporalProofs: [
          { evidenceId: 'ev_support_stale', basis: 'current_validity_confirmed' },
          { evidenceId: 'ev_oppose_transition', basis: 'current_validity_confirmed' },
        ],
        sourceAuthority: [
          { documentId: 'doc_support_stale', basis: 'independent_secondary_report', claimApplicability: 'applicable' },
          { documentId: 'doc_oppose_transition', basis: 'independent_secondary_report', claimApplicability: 'applicable' },
        ],
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
            { key: 'regulator', role: 'scope_qualifier', required: true },
            { key: 'transactionLimit', role: 'asserted_value', required: true },
          ],
          authoritativeSourceRoles: ['primary_authority', 'reputable_secondary'],
        },
        decidedAt: '2026-11-20T00:00:00Z',
        traceIds: { runId: 'run_test_supersession', nodeId: 'node_decide' },
      };

      const outcome = decideClaim(input);
      expect(outcome.status).toBe('decided');
      if (outcome.status !== 'decided') return;

      // Equal rank (both rank 1) with documented transition from ₹500 must resolve to outdated, not conflicting_evidence
      expect(outcome.decision.verdict).toBe('outdated');
      expect(outcome.decision.score).toBe(0);
      expect(outcome.decision.reasonCode).toBe(DECISION_REASON_CODES.PROVEN_OUTDATED_BY_SUPERSEDING);
      expect(outcome.decision.temporalBasis.transitionEventDate).toBe('2024-10-09');
    });

    it('preserves conflicting_evidence when equal-authority sources genuinely dispute contemporaneous facts without a transition', () => {
      const ticket = makeBaseTicket();

      const input: DecideClaimInput = {
        ticket,
        assessments: [
          {
            assessmentId: 'asm_support_dispute',
            claimTicketId: ticket.ticketId,
            evidenceId: 'ev_support_dispute',
            claimRevision: 1,
            relationship: 'supports',
            scopeMatching: 'match',
            modelConfidence: 0.9,
            quotationVerified: true,
            propertyMatchStatus: { matching: ['transactionLimit', 'regulator'], mismatched: [], missingInEvidence: [] },
            temporalApplicability: 'active_at_target_time',
            sourceSuitability: 'credible_secondary',
            reasoning: 'News source affirms limit is ₹500.',
          },
          {
            assessmentId: 'asm_oppose_dispute',
            claimTicketId: ticket.ticketId,
            evidenceId: 'ev_oppose_dispute',
            claimRevision: 1,
            relationship: 'contradicts',
            scopeMatching: 'match',
            modelConfidence: 0.9,
            quotationVerified: true,
            propertyMatchStatus: { matching: ['regulator'], mismatched: ['transactionLimit'], missingInEvidence: [] },
            temporalApplicability: 'active_at_target_time',
            sourceSuitability: 'credible_secondary',
            reasoning: 'News source affirms limit is ₹200.',
          },
        ],
        evidenceUnits: [
          {
            evidenceId: 'ev_support_dispute',
            documentId: 'doc_support_dispute',
            verbatimText: 'The official per-transaction limit for UPI Lite is ₹500.',
            extractionLimitations: [],
            surroundingHeaders: [],
            footnotes: [],
            extractedProperties: [],
            locator: { charOffsetStart: 0, charOffsetEnd: 'The official per-transaction limit for UPI Lite is ₹500.'.length },
          },
          {
            evidenceId: 'ev_oppose_dispute',
            documentId: 'doc_oppose_dispute',
            verbatimText: 'The official per-transaction limit for UPI Lite is ₹200.',
            extractionLimitations: [],
            surroundingHeaders: [],
            footnotes: [],
            extractedProperties: [],
            locator: { charOffsetStart: 0, charOffsetEnd: 'The official per-transaction limit for UPI Lite is ₹200.'.length },
          },
        ],
        sourceDocuments: [
          {
            documentId: 'doc_support_dispute',
            runId: 'run_test_supersession',
            url: 'https://newsoutlet-a.com/upi-lite',
            finalUrl: 'https://newsoutlet-a.com/upi-lite',
            retrievedContentHash: 'h_a',
            retrievedAt: '2026-11-20T00:00:00Z',
            rawText: 'The official per-transaction limit for UPI Lite is ₹500.',
            extractionStatus: 'success',
            sourceRole: 'reputable_secondary',
          },
          {
            documentId: 'doc_oppose_dispute',
            runId: 'run_test_supersession',
            url: 'https://newsoutlet-b.com/upi-lite',
            finalUrl: 'https://newsoutlet-b.com/upi-lite',
            retrievedContentHash: 'h_b',
            retrievedAt: '2026-11-20T00:00:00Z',
            rawText: 'The official per-transaction limit for UPI Lite is ₹200.',
            extractionStatus: 'success',
            sourceRole: 'reputable_secondary',
          },
        ],
        claimTemporalScope: { quantifier: 'current', intervalSemantics: 'existential' },
        assessmentGrounding: [
          { assessmentId: 'asm_support_dispute', contextBasis: 'verified_context', limitations: [] },
          { assessmentId: 'asm_oppose_dispute', contextBasis: 'verified_context', limitations: [] },
        ],
        evidenceTemporalProofs: [
          { evidenceId: 'ev_support_dispute', basis: 'current_validity_confirmed' },
          { evidenceId: 'ev_oppose_dispute', basis: 'current_validity_confirmed' },
        ],
        sourceAuthority: [
          { documentId: 'doc_support_dispute', basis: 'independent_secondary_report', claimApplicability: 'applicable' },
          { documentId: 'doc_oppose_dispute', basis: 'independent_secondary_report', claimApplicability: 'applicable' },
        ],
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
            { key: 'regulator', role: 'scope_qualifier', required: true },
            { key: 'transactionLimit', role: 'asserted_value', required: true },
          ],
          authoritativeSourceRoles: ['primary_authority', 'reputable_secondary'],
        },
        decidedAt: '2026-11-20T00:00:00Z',
        traceIds: { runId: 'run_test_supersession', nodeId: 'node_decide' },
      };

      const outcome = decideClaim(input);
      expect(outcome.status).toBe('decided');
      if (outcome.status !== 'decided') return;

      // Without a documented superseding transition, equal-authority disagreement must remain conflicting_evidence
      expect(outcome.decision.verdict).toBe('conflicting_evidence');
      expect(outcome.decision.score).toBeNull();
      expect(outcome.decision.reasonCode).toBe(DECISION_REASON_CODES.CREDIBLE_SOURCES_DISAGREE);
    });
  });
});
