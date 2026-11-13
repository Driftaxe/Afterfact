import { describe, expect, it } from 'vitest';
import type { ClaimTicket } from '@/lib/contracts/claim-ticket';
import type {
  ClaimEvidenceAssessment,
  EvidenceUnit,
  SourceDocument,
} from '@/lib/contracts/evidence-objects';
import type { DecideClaimInput } from '@/lib/contracts/decision';
import { decideClaim } from '@/server/verify/decide';

import {
  buildDecisionPolicy,
  evaluateClaimClarification,
  evaluatePolicy,
  qualifySourceAuthorityForClaim,
  resolveDomainPolicy,
} from '@/server/policies';

function makeClaimTicket(overrides: Partial<ClaimTicket> = {}): ClaimTicket {
  return {
    ticketId: 'tkt_test_01',
    claimId: 'clm_test_01',
    runId: 'run_test_01',
    inputHash: 'hash_test_01',
    revision: 1,
    originalStatement: 'Acme Pro costs $20 per month',
    normalizedProposition: 'Acme Pro subscription costs $20 per month in the US.',
    domain: 'pricing',
    targetTime: '2026-11-10T00:00:00.000Z',
    verificationContext: [
      {
        key: 'plan_tier',
        label: 'Plan Tier',
        propertyType: 'string',
        value: 'Pro',
        origin: 'explicit_claim_text',
        sourceSpan: { start: 5, end: 8 },
        status: 'confirmed',
        applicability: 'claim_level',
      },
      {
        key: 'price',
        label: 'Price',
        propertyType: 'number',
        value: 20,
        origin: 'explicit_claim_text',
        sourceSpan: { start: 15, end: 18 },
        status: 'confirmed',
        applicability: 'claim_level',
      },
      {
        key: 'jurisdiction',
        label: 'Jurisdiction',
        propertyType: 'string',
        value: 'US',
        origin: 'user_target_context',
        status: 'confirmed',
        applicability: 'run_level',
      },
    ],
    missingMaterialContext: [],
    ...overrides,
  };
}

function makeSourceDocument(overrides: Partial<SourceDocument> = {}): SourceDocument {
  return {
    documentId: 'doc_acme_01',
    runId: 'run_test_01',
    url: 'https://acme.example/pricing',
    finalUrl: 'https://acme.example/pricing',
    title: 'Acme Pricing',
    publisher: 'Acme Inc.',
    retrievedContentHash: 'hash_content_01',
    retrievedAt: '2026-11-10T00:00:00.000Z',
    rawText: 'Acme Pro tier costs $20 per month in the United States.',
    extractionStatus: 'success',
    publicationDate: '2026-01-01',
    effectiveDate: '2026-01-01',
    sourceRole: 'primary_authority',
    ...overrides,
  };
}

describe('Ticket A06: Domain Policy Services', () => {
  // =========================================================================
  // 1. POLICY SELECTION & FALLBACK
  // =========================================================================
  describe('Policy Selection', () => {
    it('selects PricingPolicy for clear pricing claims', () => {
      const ticket = makeClaimTicket({
        domain: 'pricing',
        originalStatement: 'SolisDB Pro costs $15 per month',
      });
      const resolved = resolveDomainPolicy(ticket);
      expect(resolved.domainId).toBe('pricing');
    });

    it('does NOT force a software capability claim into pricing merely because plan_tier is mentioned', () => {
      const ticket = makeClaimTicket({
        domain: 'software',
        originalStatement: 'The Enterprise tier supports streaming',
        normalizedProposition: 'The Enterprise tier of SolisDB supports response streaming.',
        verificationContext: [
          {
            key: 'plan_tier',
            label: 'Plan Tier',
            propertyType: 'string',
            value: 'Enterprise',
            origin: 'explicit_claim_text',
            sourceSpan: { start: 4, end: 14 },
            status: 'confirmed',
            applicability: 'claim_level',
          },
          {
            key: 'capability',
            label: 'Capability',
            propertyType: 'string',
            value: 'streaming',
            origin: 'explicit_claim_text',
            sourceSpan: { start: 24, end: 33 },
            status: 'confirmed',
            applicability: 'claim_level',
          },
        ],
      });
      const resolved = resolveDomainPolicy(ticket);
      expect(resolved.domainId).toBe('api');
    });

    it('selects ApiPolicy for software and SDK claims', () => {
      const ticket = makeClaimTicket({
        domain: 'developer',
        originalStatement: 'SolisDB v2.1 supports GraphQL streaming endpoint',
      });
      const resolved = resolveDomainPolicy(ticket);
      expect(resolved.domainId).toBe('api');
    });

    it('selects RegulationPolicy for compliance and legal claims', () => {
      const ticket = makeClaimTicket({
        domain: 'legal',
        originalStatement: 'The EU AI Act mandates high-risk registration by August 2026',
      });
      const resolved = resolveDomainPolicy(ticket);
      expect(resolved.domainId).toBe('regulation');
    });

    it('selects LeadershipPolicy for corporate executive governance claims', () => {
      const ticket = makeClaimTicket({
        domain: 'executive',
        originalStatement: 'Jane Doe was appointed CEO of Acme Corp',
      });
      const resolved = resolveDomainPolicy(ticket);
      expect(resolved.domainId).toBe('leadership');
    });

    it('falls back to GenericPolicy for unfamiliar domains without rejecting claim', () => {
      const ticket = makeClaimTicket({
        domain: 'geology',
        originalStatement: 'Mount Rainier is an active stratovolcano in Washington State',
        verificationContext: [
          {
            key: 'mountain',
            label: 'Mountain',
            propertyType: 'string',
            value: 'Mount Rainier',
            origin: 'explicit_claim_text',
            sourceSpan: { start: 0, end: 13 },
            status: 'confirmed',
            applicability: 'claim_level',
          },
          {
            key: 'type',
            label: 'Type',
            propertyType: 'string',
            value: 'active stratovolcano',
            origin: 'explicit_claim_text',
            sourceSpan: { start: 20, end: 40 },
            status: 'confirmed',
            applicability: 'claim_level',
          },
        ],
      });
      const resolved = resolveDomainPolicy(ticket);
      expect(resolved.domainId).toBe('generic');
    });

    it('honors upstream semantic domainHint when supplied', () => {
      const ticket = makeClaimTicket({
        domain: 'unknown',
        originalStatement: 'Ambiguous statement',
      });
      const resolved = resolveDomainPolicy(ticket, { domainHint: 'regulation' });
      expect(resolved.domainId).toBe('regulation');
    });
  });

  // =========================================================================
  // 2. PROPERTY ROLE RESOLUTION & ORDER INDEPENDENCE
  // =========================================================================
  describe('Property Role Resolution', () => {
    it('declares property roles ONLY for properties present in verificationContext (Invariant P10)', () => {
      const ticket = makeClaimTicket();
      const policy = buildDecisionPolicy(ticket);

      const ticketKeys = new Set(ticket.verificationContext.map((p) => p.key));
      for (const role of policy.propertyRoles) {
        expect(ticketKeys.has(role.key)).toBe(true);
      }
    });

    it('distinguishes API version as scope qualifier vs version as asserted value', () => {
      // 1. Version as scope qualifier
      const scopeTicket = makeClaimTicket({
        domain: 'api',
        originalStatement: 'SDK v2 supports streaming',
        verificationContext: [
          {
            key: 'version',
            label: 'Version',
            propertyType: 'string',
            value: 'v2',
            origin: 'explicit_claim_text',
            sourceSpan: { start: 4, end: 6 },
            status: 'confirmed',
            applicability: 'claim_level',
          },
          {
            key: 'capability',
            label: 'Capability',
            propertyType: 'string',
            value: 'streaming',
            origin: 'explicit_claim_text',
            sourceSpan: { start: 16, end: 25 },
            status: 'confirmed',
            applicability: 'claim_level',
          },
        ],
      });

      const scopePolicy = buildDecisionPolicy(scopeTicket);
      const versionRoleAsScope = scopePolicy.propertyRoles.find((r) => r.key === 'version');
      expect(versionRoleAsScope?.role).toBe('scope_qualifier');

      // 2. Version as asserted value
      const assertedTicket = makeClaimTicket({
        domain: 'api',
        originalStatement: 'The latest stable version is v3.4',
        verificationContext: [
          {
            key: 'version',
            label: 'Version',
            propertyType: 'string',
            value: 'v3.4',
            origin: 'explicit_claim_text',
            sourceSpan: { start: 29, end: 33 },
            status: 'confirmed',
            applicability: 'claim_level',
          },
        ],
      });

      const assertedPolicy = buildDecisionPolicy(assertedTicket);
      const versionRoleAsAsserted = assertedPolicy.propertyRoles.find((r) => r.key === 'version');
      expect(versionRoleAsAsserted?.role).toBe('asserted_value');
    });

    it('leadership policy treats organization and office as scope, and person as asserted value', () => {
      const ticket = makeClaimTicket({
        domain: 'leadership',
        originalStatement: 'Jane Doe is CEO of Acme Corp',
        verificationContext: [
          {
            key: 'organization',
            label: 'Organization',
            propertyType: 'string',
            value: 'Acme Corp',
            origin: 'explicit_claim_text',
            sourceSpan: { start: 19, end: 28 },
            status: 'confirmed',
            applicability: 'claim_level',
          },
          {
            key: 'title',
            label: 'Title',
            propertyType: 'string',
            value: 'CEO',
            origin: 'explicit_claim_text',
            sourceSpan: { start: 12, end: 15 },
            status: 'confirmed',
            applicability: 'claim_level',
          },
          {
            key: 'person',
            label: 'Person',
            propertyType: 'string',
            value: 'Jane Doe',
            origin: 'explicit_claim_text',
            sourceSpan: { start: 0, end: 8 },
            status: 'confirmed',
            applicability: 'claim_level',
          },
        ],
      });

      const policy = buildDecisionPolicy(ticket);
      const orgRole = policy.propertyRoles.find((r) => r.key === 'organization');
      const titleRole = policy.propertyRoles.find((r) => r.key === 'title');
      const personRole = policy.propertyRoles.find((r) => r.key === 'person');

      expect(orgRole?.role).toBe('scope_qualifier');
      expect(titleRole?.role).toBe('scope_qualifier');
      expect(personRole?.role).toBe('asserted_value');
    });

    it('reordering equivalent properties does NOT change role assignments in generic policy', () => {
      // Order 1: [propA, propB]
      const ticketOrder1 = makeClaimTicket({
        domain: 'generic',
        originalStatement: 'Property test',
        verificationContext: [
          {
            key: 'city',
            label: 'City',
            propertyType: 'string',
            value: 'Tokyo',
            origin: 'explicit_claim_text',
            sourceSpan: { start: 0, end: 5 },
            status: 'confirmed',
            applicability: 'claim_level',
          },
          {
            key: 'population',
            label: 'Population',
            propertyType: 'string',
            value: '14 million',
            origin: 'explicit_claim_text',
            sourceSpan: { start: 6, end: 16 },
            status: 'confirmed',
            applicability: 'claim_level',
          },
        ],
      });

      // Order 2: [propB, propA]
      const ticketOrder2 = makeClaimTicket({
        domain: 'generic',
        originalStatement: 'Property test',
        verificationContext: [
          ticketOrder1.verificationContext[1],
          ticketOrder1.verificationContext[0],
        ],
      });

      const semanticFacts = {
        assertedPropertyKeys: ['population'],
        scopeQualifierKeys: ['city'],
      };

      const policy1 = buildDecisionPolicy(ticketOrder1, { semanticFacts });
      const policy2 = buildDecisionPolicy(ticketOrder2, { semanticFacts });

      const role1City = policy1.propertyRoles.find((r) => r.key === 'city');
      const role1Pop = policy1.propertyRoles.find((r) => r.key === 'population');
      const role2City = policy2.propertyRoles.find((r) => r.key === 'city');
      const role2Pop = policy2.propertyRoles.find((r) => r.key === 'population');

      expect(role1City?.role).toBe('scope_qualifier');
      expect(role1Pop?.role).toBe('asserted_value');
      expect(role2City?.role).toBe('scope_qualifier');
      expect(role2Pop?.role).toBe('asserted_value');
    });

    it('missing semantic role stays unresolved in generic policy without guessing from array order', () => {
      const ticket = makeClaimTicket({
        domain: 'generic',
        originalStatement: 'Unspecified relation',
        verificationContext: [
          {
            key: 'alpha',
            label: 'Alpha',
            propertyType: 'string',
            value: 'X',
            origin: 'explicit_claim_text',
            sourceSpan: { start: 0, end: 1 },
            status: 'confirmed',
            applicability: 'claim_level',
          },
          {
            key: 'beta',
            label: 'Beta',
            propertyType: 'string',
            value: 'Y',
            origin: 'explicit_claim_text',
            sourceSpan: { start: 2, end: 3 },
            status: 'confirmed',
            applicability: 'claim_level',
          },
        ],
      });

      // No semantic facts provided
      const policy = buildDecisionPolicy(ticket);
      // GenericPolicy must NOT arbitrarily assign alpha or beta as asserted_value
      expect(policy.propertyRoles).toHaveLength(0);

      // Unified evaluatePolicy reports unresolved_prerequisites naming upstream producer
      const result = evaluatePolicy({ ticket });
      expect(result.status).toBe('unresolved_prerequisites');
      expect(result.unresolvedRoles).toEqual(['alpha', 'beta']);
      expect(result.limitations.some((l) => /upstream semantic producer/i.test(l))).toBe(true);
    });
  });

  // =========================================================================
  // 3. SOURCE AUTHORITY QUALIFICATION
  // =========================================================================
  describe('Source Authority Qualification', () => {
    it('.gov suffix or GitHub release path alone CANNOT establish authority without verified provenance', () => {
      const ticket = makeClaimTicket();
      const docGov = makeSourceDocument({
        documentId: 'doc_fake_gov',
        url: 'https://bogus.gov/press-release',
        sourceRole: 'primary_authority',
      });
      const docGithub = makeSourceDocument({
        documentId: 'doc_fake_gh',
        url: 'https://github.com/acme/repo/releases/tag/v2.0',
        sourceRole: 'official_changelog',
      });

      // Provenance map is empty -> no verified identity
      const facts = qualifySourceAuthorityForClaim(ticket, [docGov, docGithub], {});

      expect(facts).toHaveLength(2);
      expect(facts[0].basis).toBe('unknown');
      expect(facts[0].claimApplicability).toBe('unknown');
      expect(facts[1].basis).toBe('unknown');
      expect(facts[1].claimApplicability).toBe('unknown');
    });

    it('qualifies official corporate primary document when entityMatch and applicability are verified', () => {
      const ticket = makeClaimTicket();
      const doc = makeSourceDocument({
        documentId: 'doc_acme_official',
        sourceRole: 'primary_authority',
      });

      const facts = qualifySourceAuthorityForClaim(ticket, [doc], {
        provenanceMap: {
          doc_acme_official: {
            documentId: 'doc_acme_official',
            basis: 'official_primary_record',
            entityMatch: true,
            claimApplicability: 'applicable',
          },
        },
      });

      expect(facts).toHaveLength(1);
      expect(facts[0].basis).toBe('official_primary_record');
      expect(facts[0].claimApplicability).toBe('applicable');
    });

    it('rejects document with valid publisher identity but wrong claim applicability', () => {
      const ticket = makeClaimTicket();
      const doc = makeSourceDocument({
        documentId: 'doc_irrelevant_official',
        sourceRole: 'primary_authority',
      });

      const facts = qualifySourceAuthorityForClaim(ticket, [doc], {
        provenanceMap: {
          doc_irrelevant_official: {
            documentId: 'doc_irrelevant_official',
            basis: 'official_primary_record',
            entityMatch: true,
            claimApplicability: 'not_applicable', // Authentic source, but completely irrelevant to this claim
          },
        },
      });

      expect(facts).toHaveLength(1);
      expect(facts[0].claimApplicability).toBe('not_applicable');
    });

    it('fails closed when provenance has mismatched claimId or revision', () => {
      const ticket = makeClaimTicket({ ticketId: 'tkt_01', claimId: 'clm_01', revision: 2 });
      const doc = makeSourceDocument({ documentId: 'doc_stale' });

      const facts = qualifySourceAuthorityForClaim(ticket, [doc], {
        provenanceMap: {
          doc_stale: {
            documentId: 'doc_stale',
            claimId: 'clm_01',
            revision: 1, // Stale revision!
            basis: 'official_primary_record',
            entityMatch: true,
          },
        },
      });

      expect(facts).toHaveLength(1);
      expect(facts[0].claimApplicability).toBe('not_applicable');
    });

    it('disqualifies vendor marketing superlatives on comparative pricing claims', () => {
      const ticket = makeClaimTicket({
        originalStatement: 'Acme Pro is the cheapest cloud database worldwide',
      });

      const doc = makeSourceDocument({
        documentId: 'doc_acme_marketing',
        sourceRole: 'primary_authority',
      });

      const facts = qualifySourceAuthorityForClaim(ticket, [doc], {
        provenanceMap: {
          doc_acme_marketing: {
            documentId: 'doc_acme_marketing',
            basis: 'official_primary_record',
            entityMatch: true,
            isSelfPromotional: true,
            attributesCovered: ['marketing_superlative'],
          },
        },
      });

      expect(facts).toHaveLength(1);
      expect(facts[0].claimApplicability).toBe('not_applicable');
    });

    it('unverified primary source does NOT automatically become credible secondary', () => {
      const ticket = makeClaimTicket();
      const doc = makeSourceDocument({
        documentId: 'doc_unverified',
        sourceRole: 'primary_authority',
      });

      const facts = qualifySourceAuthorityForClaim(ticket, [doc], {
        provenanceMap: {
          doc_unverified: {
            documentId: 'doc_unverified',
            basis: 'official_primary_record',
            entityMatch: false, // Entity does not match!
          },
        },
      });

      expect(facts).toHaveLength(1);
      expect(facts[0].basis).toBe('official_primary_record');
      expect(facts[0].claimApplicability).toBe('not_applicable');
      // Must NOT silently become secondary
      expect(facts[0].basis).not.toBe('independent_secondary_report');
    });
  });

  // =========================================================================
  // 4. CLARIFICATION EXHAUSTION & AMBIGUITY
  // =========================================================================
  describe('Clarification Planning', () => {
    it('returns not_needed when no material user-context gap exists', () => {
      const ticket = makeClaimTicket({
        missingMaterialContext: [],
      });

      const plan = evaluateClaimClarification(ticket);
      expect(plan.status).toBe('not_needed');
    });

    it('plans typed questions when material user context is missing and rounds are available', () => {
      const ticket = makeClaimTicket({
        missingMaterialContext: ['billing_commitment'],
      });

      const plan = evaluateClaimClarification(ticket, {
        runId: 'run_01',
        round: 1,
      });

      expect(plan.status).toBe('questions_planned');
      if (plan.status === 'questions_planned') {
        expect(plan.questionSet.questions).toHaveLength(1);
        const q = plan.questionSet.questions[0];
        expect(q.propertyKey).toBe('billing_commitment');
        expect(q.fieldType).toBe('select');
        expect(q.options).toHaveLength(2);
        expect(q.allowUnknown).toBe(true);
      }
    });

    it('returns explicit rounds_exhausted outcome when max rounds (2) is exceeded', () => {
      const ticket = makeClaimTicket({
        missingMaterialContext: ['billing_commitment'],
      });

      const plan = evaluateClaimClarification(ticket, {
        round: 3, // Round 3 exceeds MAX_CLARIFICATION_ROUNDS = 2
      });

      expect(plan.status).toBe('rounds_exhausted');
      if (plan.status === 'rounds_exhausted') {
        expect(plan.unresolvedFields).toContain('billing_commitment');
        expect(plan.roundsAttempted).toBe(2);
        expect(plan.reason).toContain('Maximum clarification rounds (2) reached');
      }
    });

    it('clarification exhaustion does NOT clear missingMaterialContext from ticket', () => {
      const ticket = makeClaimTicket({
        missingMaterialContext: ['billing_commitment'],
      });

      const result = evaluatePolicy({
        ticket,
        clarificationState: { round: 3 },
      });

      expect(result.status).toBe('clarification_exhausted');
      // The ticket's missing context is preserved
      expect(ticket.missingMaterialContext).toContain('billing_commitment');
    });

    it('returns invalid_input when round counter is invalid', () => {
      const ticket = makeClaimTicket({
        missingMaterialContext: ['billing_commitment'],
      });

      const plan0 = evaluateClaimClarification(ticket, { round: 0 });
      expect(plan0.status).toBe('invalid_input');

      const planNeg = evaluateClaimClarification(ticket, { round: -1 });
      expect(planNeg.status).toBe('invalid_input');
    });

    it('never demands factual research answers from the user in leadership claims', () => {
      const ticket = makeClaimTicket({
        domain: 'leadership',
        missingMaterialContext: ['leader_name'], // The name of the leader is the researchable fact!
      });

      const plan = evaluateClaimClarification(ticket);
      // Leadership policy must NOT ask the user who the leader is
      expect(plan.status).toBe('not_needed');
    });

    it('unresolved material user scope reaches A05 ambiguity gate returning depends_on_context', () => {
      const ticket = makeClaimTicket({
        missingMaterialContext: ['billing_commitment'],
      });

      const policyResult = evaluatePolicy({
        ticket,
        clarificationState: { round: 3 }, // Exhausted
      });

      expect(policyResult.status).toBe('clarification_exhausted');

      // Feed into A05 decideClaim
      const decideInput: DecideClaimInput = {
        ticket,
        assessments: [],
        evidenceUnits: [],
        sourceDocuments: [],
        claimTemporalScope: { quantifier: 'current', intervalSemantics: 'existential' },
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
        policy: policyResult.policy,
        decidedAt: '2026-11-10T00:00:00.000Z',
      };

      const outcome = decideClaim(decideInput);
      expect(outcome.status).toBe('decided');
      if (outcome.status === 'decided') {
        expect(outcome.decision.verdict).toBe('depends_on_context');
        expect(outcome.decision.score).toBeNull();
        expect(outcome.decision.reasonCode).toBe('ESSENTIAL_CONTEXT_MISSING');
      }
    });
  });

  // =========================================================================
  // 5. USER CONTEXT VS RESEARCH EVIDENCE
  // =========================================================================
  describe('User Context vs Research Evidence', () => {
    it('initializes research obligations as unresolved and never marks them satisfied at policy evaluation', () => {
      const ticket = makeClaimTicket();
      const result = evaluatePolicy({ ticket });

      expect(result.obligations.length).toBeGreaterThan(0);
      for (const obl of result.obligations) {
        expect(obl.status).toBe('unresolved');
        expect(obl.resolvedByAssessmentIds).toHaveLength(0);
      }
    });

    it('unresolved material research obligation leads to insufficient_evidence in A05', () => {
      const ticket = makeClaimTicket();
      const doc = makeSourceDocument();

      const policyResult = evaluatePolicy({
        ticket,
        documents: [doc],
        provenanceMap: {
          doc_acme_01: {
            documentId: 'doc_acme_01',
            basis: 'official_primary_record',
            entityMatch: true,
            claimApplicability: 'applicable',
          },
        },
      });

      // Obligation remains unresolved
      const decideInput: DecideClaimInput = {
        ticket,
        assessments: [],
        evidenceUnits: [],
        sourceDocuments: [doc],
        claimTemporalScope: { quantifier: 'current', intervalSemantics: 'existential' },
        assessmentGrounding: [],
        evidenceTemporalProofs: [],
        sourceAuthority: policyResult.authorityFacts,
        transitions: [],
        coverage: {
          researchComplete: false,
          obligations: policyResult.obligations, // Has unresolved material obligation
          rejectedCandidates: [],
          budgetExhausted: false,
          limitations: ['Required research obligation unresolved'],
        },
        policy: policyResult.policy,
        decidedAt: '2026-11-10T00:00:00.000Z',
      };

      const outcome = decideClaim(decideInput);
      expect(outcome.status).toBe('decided');
      if (outcome.status === 'decided') {
        expect(outcome.decision.verdict).toBe('insufficient_evidence');
        expect(outcome.decision.score).toBeNull();
      }
    });
  });

  // =========================================================================
  // 6. END-TO-END A05 INTEGRATION & DECISIVE VERDICTS
  // =========================================================================
  describe('A05 Integration', () => {
    it('produces ready status and complete aggregate consumed cleanly by real A05 decideClaim', () => {
      const ticket = makeClaimTicket({
        originalStatement: 'Acme Pro costs $20 per month',
        normalizedProposition: 'Acme Pro costs $20 per month in the US.',
      });

      const doc = makeSourceDocument({
        documentId: 'doc_acme_primary',
        sourceRole: 'primary_authority',
        rawText: 'Acme Pro tier costs $20 per month in the US.',
      });

      const policyResult = evaluatePolicy({
        ticket,
        documents: [doc],
        provenanceMap: {
          doc_acme_primary: {
            documentId: 'doc_acme_primary',
            basis: 'official_primary_record',
            entityMatch: true,
            claimApplicability: 'applicable',
          },
        },
      });

      expect(policyResult.status).toBe('ready');
      expect(policyResult.selectedDomain).toBe('pricing');
      expect(policyResult.policy.propertyRoles).toHaveLength(3);
      expect(policyResult.authorityFacts).toHaveLength(1);
      expect(policyResult.authorityFacts[0].claimApplicability).toBe('applicable');

      const evidenceUnit: EvidenceUnit = {
        evidenceId: 'evi_01',
        documentId: doc.documentId,
        verbatimText: 'Acme Pro tier costs $20 per month in the US.',
        locator: { charOffsetStart: 0, charOffsetEnd: 44 },
        surroundingHeaders: [],
        footnotes: [],
        extractedProperties: ticket.verificationContext,
        publicationDate: '2026-01-01',
        effectiveDate: '2026-01-01',
        extractionLimitations: [],
      };

      const assessment: ClaimEvidenceAssessment = {
        assessmentId: 'asm_01',
        claimTicketId: ticket.ticketId,
        claimRevision: ticket.revision,
        evidenceId: evidenceUnit.evidenceId,
        relationship: 'supports',
        scopeMatching: 'match',
        quotationVerified: true,
        propertyMatchStatus: {
          matching: ['plan_tier', 'price', 'jurisdiction'],
          mismatched: [],
          missingInEvidence: [],
        },
        temporalApplicability: 'active_at_target_time',
        sourceSuitability: 'authoritative_primary',
        reasoning: 'Matches tier, rate, and jurisdiction.',
      };

      const decideInput: DecideClaimInput = {
        ticket,
        assessments: [assessment],
        evidenceUnits: [evidenceUnit],
        sourceDocuments: [doc],
        claimTemporalScope: { quantifier: 'current', intervalSemantics: 'existential' },
        assessmentGrounding: [
          { assessmentId: assessment.assessmentId, contextBasis: 'quotation_only', limitations: [] },
        ],
        evidenceTemporalProofs: [
          { evidenceId: evidenceUnit.evidenceId, basis: 'current_validity_confirmed' },
        ],
        sourceAuthority: policyResult.authorityFacts,
        transitions: [],
        coverage: {
          researchComplete: true,
          obligations: [
            {
              obligationId: policyResult.obligations[0].obligationId,
              description: policyResult.obligations[0].description,
              status: 'satisfied',
              material: true,
              scope: 'claim',
              affectedAssessmentIds: [],
              resolvedByAssessmentIds: [assessment.assessmentId],
              resolutionBasis: 'Primary documentation confirms pricing without annual commitment requirement.',
            },
          ],
          rejectedCandidates: [],
          budgetExhausted: false,
          limitations: [],
        },
        policy: policyResult.policy,
        decidedAt: '2026-11-10T00:00:00.000Z',
      };

      const outcome = decideClaim(decideInput);

      expect(outcome.status).toBe('decided');
      if (outcome.status === 'decided') {
        expect(outcome.decision.verdict).toBe('supported');
        expect(outcome.decision.score).toBe(100);
        expect(outcome.decision.appliedPolicy).toBe('pricing@1.0.0');
        expect(outcome.decision.primaryEvidenceIds).toContain('asm_01');
      }
    });

    it('demonstrates same-scope price disagreement correctly results in contradiction in A05', () => {
      const ticket = makeClaimTicket({
        originalStatement: 'Acme Pro costs $20 per month',
      });

      const doc = makeSourceDocument({
        documentId: 'doc_acme_counter',
        sourceRole: 'primary_authority',
        rawText: 'Acme Pro tier costs $30 per month in the US.',
      });

      const policyResult = evaluatePolicy({
        ticket,
        documents: [doc],
        provenanceMap: {
          doc_acme_counter: {
            documentId: 'doc_acme_counter',
            basis: 'official_primary_record',
            entityMatch: true,
            claimApplicability: 'applicable',
          },
        },
      });

      const evidenceUnit: EvidenceUnit = {
        evidenceId: 'evi_counter_01',
        documentId: doc.documentId,
        verbatimText: 'Acme Pro tier costs $30 per month in the US.',
        locator: { charOffsetStart: 0, charOffsetEnd: 44 },
        surroundingHeaders: [],
        footnotes: [],
        extractedProperties: ticket.verificationContext,
        publicationDate: '2026-01-01',
        effectiveDate: '2026-01-01',
        extractionLimitations: [],
      };

      const assessment: ClaimEvidenceAssessment = {
        assessmentId: 'asm_counter_01',
        claimTicketId: ticket.ticketId,
        claimRevision: ticket.revision,
        evidenceId: evidenceUnit.evidenceId,
        relationship: 'contradicts',
        scopeMatching: 'match',
        quotationVerified: true,
        propertyMatchStatus: {
          matching: ['plan_tier', 'jurisdiction'],
          mismatched: ['price'],
          missingInEvidence: [],
        },
        temporalApplicability: 'active_at_target_time',
        sourceSuitability: 'authoritative_primary',
        reasoning: 'Asserted value mismatch on same scope.',
      };

      const decideInput: DecideClaimInput = {
        ticket,
        assessments: [assessment],
        evidenceUnits: [evidenceUnit],
        sourceDocuments: [doc],
        claimTemporalScope: { quantifier: 'current', intervalSemantics: 'existential' },
        assessmentGrounding: [
          { assessmentId: assessment.assessmentId, contextBasis: 'quotation_only', limitations: [] },
        ],
        evidenceTemporalProofs: [
          { evidenceId: evidenceUnit.evidenceId, basis: 'current_validity_confirmed' },
        ],
        sourceAuthority: policyResult.authorityFacts,
        transitions: [],
        coverage: {
          researchComplete: true,
          obligations: [
            {
              obligationId: policyResult.obligations[0].obligationId,
              description: policyResult.obligations[0].description,
              status: 'satisfied',
              material: true,
              scope: 'claim',
              affectedAssessmentIds: [],
              resolvedByAssessmentIds: [assessment.assessmentId],
              resolutionBasis: 'Primary documentation confirms pricing terms.',
            },
          ],
          rejectedCandidates: [],
          budgetExhausted: false,
          limitations: [],
        },
        policy: policyResult.policy,
        decidedAt: '2026-11-10T00:00:00.000Z',
      };

      const outcome = decideClaim(decideInput);
      expect(outcome.status).toBe('decided');
      if (outcome.status === 'decided') {
        expect(outcome.decision.verdict).toBe('contradicted');
        expect(outcome.decision.score).toBe(0);
        expect(outcome.decision.primaryEvidenceIds).toContain('asm_counter_01');
      }
    });

    it('enables generic domain claim to reach decisive support (100) in A05 when supplied with valid semantic facts', () => {
      const ticket = makeClaimTicket({
        domain: 'geography',
        originalStatement: 'Olympus Mons has an elevation of 21.9 km',
        normalizedProposition: 'Olympus Mons on Mars has an elevation of 21.9 km.',
        verificationContext: [
          {
            key: 'mountain',
            label: 'Mountain',
            propertyType: 'string',
            value: 'Olympus Mons',
            origin: 'explicit_claim_text',
            sourceSpan: { start: 0, end: 12 },
            status: 'confirmed',
            applicability: 'claim_level',
          },
          {
            key: 'elevation',
            label: 'Elevation',
            propertyType: 'string',
            value: '21.9 km',
            origin: 'explicit_claim_text',
            sourceSpan: { start: 33, end: 40 },
            status: 'confirmed',
            applicability: 'claim_level',
          },
        ],
      });

      const doc = makeSourceDocument({
        documentId: 'doc_planetary_gazetteer',
        sourceRole: 'primary_authority',
        rawText: 'Olympus Mons has an elevation of 21.9 km.',
      });

      const policyResult = evaluatePolicy({
        ticket,
        documents: [doc],
        semanticFacts: {
          assertedPropertyKeys: ['elevation'],
          scopeQualifierKeys: ['mountain'],
        },
        provenanceMap: {
          doc_planetary_gazetteer: {
            documentId: 'doc_planetary_gazetteer',
            basis: 'official_primary_record',
            entityMatch: true,
            claimApplicability: 'applicable',
          },
        },
      });

      expect(policyResult.selectedDomain).toBe('generic');
      expect(policyResult.status).toBe('ready');

      const evidenceUnit: EvidenceUnit = {
        evidenceId: 'evi_planetary_01',
        documentId: doc.documentId,
        verbatimText: 'Olympus Mons has an elevation of 21.9 km.',
        locator: { charOffsetStart: 0, charOffsetEnd: 41 },
        surroundingHeaders: [],
        footnotes: [],
        extractedProperties: ticket.verificationContext,
        publicationDate: '2026-01-01',
        effectiveDate: '2026-01-01',
        extractionLimitations: [],
      };

      const assessment: ClaimEvidenceAssessment = {
        assessmentId: 'asm_planetary_01',
        claimTicketId: ticket.ticketId,
        claimRevision: ticket.revision,
        evidenceId: evidenceUnit.evidenceId,
        relationship: 'supports',
        scopeMatching: 'match',
        quotationVerified: true,
        propertyMatchStatus: {
          matching: ['mountain', 'elevation'],
          mismatched: [],
          missingInEvidence: [],
        },
        temporalApplicability: 'active_at_target_time',
        sourceSuitability: 'authoritative_primary',
        reasoning: 'Matches geological feature and elevation.',
      };

      const decideInput: DecideClaimInput = {
        ticket,
        assessments: [assessment],
        evidenceUnits: [evidenceUnit],
        sourceDocuments: [doc],
        claimTemporalScope: { quantifier: 'current', intervalSemantics: 'existential' },
        assessmentGrounding: [
          { assessmentId: assessment.assessmentId, contextBasis: 'quotation_only', limitations: [] },
        ],
        evidenceTemporalProofs: [
          { evidenceId: evidenceUnit.evidenceId, basis: 'current_validity_confirmed' },
        ],
        sourceAuthority: policyResult.authorityFacts,
        transitions: [],
        coverage: {
          researchComplete: true,
          obligations: [],
          rejectedCandidates: [],
          budgetExhausted: false,
          limitations: [],
        },
        policy: policyResult.policy,
        decidedAt: '2026-11-10T00:00:00.000Z',
      };

      const outcome = decideClaim(decideInput);
      expect(outcome.status).toBe('decided');
      if (outcome.status === 'decided') {
        expect(outcome.decision.verdict).toBe('supported');
        expect(outcome.decision.score).toBe(100);
        expect(outcome.decision.appliedPolicy).toBe('generic@1.0.0');
      }
    });

    it('preserves input immutability: ticket and documents are not mutated by policy evaluation', () => {
      const ticket = makeClaimTicket();
      const doc = makeSourceDocument();

      const ticketBefore = JSON.stringify(ticket);
      const docBefore = JSON.stringify(doc);

      evaluatePolicy({
        ticket,
        documents: [doc],
        provenanceMap: {
          doc_acme_01: {
            documentId: 'doc_acme_01',
            basis: 'official_primary_record',
            entityMatch: true,
          },
        },
      });

      expect(JSON.stringify(ticket)).toBe(ticketBefore);
      expect(JSON.stringify(doc)).toBe(docBefore);
    });
  });
});
