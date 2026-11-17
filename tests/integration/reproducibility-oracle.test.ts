import { describe, expect, it } from 'vitest';
import type { ClaimTicket } from '@/lib/contracts/claim-ticket';
import type {
  ClaimEvidenceAssessment,
  EvidenceUnit,
  SourceDocument,
} from '@/lib/contracts/evidence-objects';
import type { DecideClaimInput } from '@/lib/contracts/decision';
import { decideClaim } from '@/server/verify/decide';
import { evaluatePolicy } from '@/server/policies';
import { composeTimeline } from '@/server/verify/transition';
import goldenReportJson from '../../fixtures/golden-mixed-report.json';

describe('Reproducibility Audit: Mode A — Deterministic Contract Replay (Frozen Evidence)', () => {
  const TARGET_TIME = goldenReportJson.asOfDate; // '2024-09-01'

  // =========================================================================
  // Claim 0: Anthropic Claude Pro ($20/mo US)
  // Expected: supported, score 100, AUTHORITATIVE_PRIMARY_SUPPORT
  // =========================================================================
  it('Claim 0 (Pricing): reproduces verdict=supported, score=100 from frozen evidence', async () => {
    const rawPassage = goldenReportJson.evidence[0].passage;
    const ticket: ClaimTicket = {
      ticketId: 'tkt_pricing_01',
      claimId: 'clm_pricing_01',
      runId: 'run_oracle_01',
      inputHash: 'hash_pricing_01',
      revision: 1,
      originalStatement: goldenReportJson.claims[0].rawText,
      normalizedProposition: 'Anthropic Claude Pro subscription costs $20 per month in the United States.',
      domain: 'pricing',
      targetTime: TARGET_TIME,
      verificationContext: [
        {
          key: 'plan_tier',
          label: 'Plan tier',
          propertyType: 'string',
          value: 'Pro',
          origin: 'explicit_claim_text',
          sourceSpan: { start: 17, end: 20 },
          status: 'confirmed',
          applicability: 'claim_level',
        },
        {
          key: 'price',
          label: 'Price',
          propertyType: 'number',
          value: 20,
          units: 'USD',
          origin: 'explicit_claim_text',
          sourceSpan: { start: 27, end: 30 },
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
        {
          key: 'billing_term',
          label: 'Billing term',
          propertyType: 'selection',
          value: 'monthly',
          origin: 'explicit_claim_text',
          sourceSpan: { start: 35, end: 44 },
          status: 'confirmed',
          applicability: 'claim_level',
        },
      ],
      missingMaterialContext: [],
    };

    const doc: SourceDocument = {
      documentId: 'doc_pricing_01',
      runId: 'run_oracle_01',
      url: goldenReportJson.evidence[0].url,
      finalUrl: goldenReportJson.evidence[0].url,
      retrievedContentHash: 'hash_doc_01',
      retrievedAt: goldenReportJson.evidence[0].retrievedAt,
      rawText: rawPassage,
      extractionStatus: 'success',
      publicationDate: goldenReportJson.evidence[0].publicationDate,
      effectiveDate: goldenReportJson.evidence[0].effectiveDate,
      sourceRole: 'primary_authority',
    };

    const unit: EvidenceUnit = {
      evidenceId: 'evi_pricing_01',
      documentId: 'doc_pricing_01',
      verbatimText: rawPassage,
      locator: { charOffsetStart: 0, charOffsetEnd: rawPassage.length },
      surroundingHeaders: ['Subscription Plans'],
      extractedProperties: ticket.verificationContext,
      extractionLimitations: [], footnotes: [],
    };

    const policyResult = evaluatePolicy({
      ticket,
      documents: [doc],
      provenanceMap: {
        [doc.documentId]: {
          documentId: doc.documentId,
          basis: 'official_primary_record',
          entityMatch: true,
          claimApplicability: 'applicable',
        },
      },
    });
    expect(policyResult.selectedDomain).toBe('pricing');

    const assessment: ClaimEvidenceAssessment = {
      assessmentId: 'asm_pricing_01',
      claimTicketId: ticket.ticketId,
      evidenceId: unit.evidenceId,
      claimRevision: 1,
      relationship: 'supports',
      scopeMatching: 'match',
      quotationVerified: true,
      propertyMatchStatus: { matching: ['price', 'plan_tier', 'jurisdiction', 'billing_term'], mismatched: [], missingInEvidence: [] },
      temporalApplicability: 'active_at_target_time',
      sourceSuitability: 'authoritative_primary',
      modelConfidence: 0.98,
      reasoning: 'Primary source directly confirms Claude Pro is $20/month for US customers.',
    };

    const decideInput: DecideClaimInput = {
      ticket,
      assessments: [assessment],
      evidenceUnits: [unit],
      sourceDocuments: [doc],
      claimTemporalScope: { quantifier: 'current', intervalSemantics: 'existential' },
      assessmentGrounding: [{ assessmentId: assessment.assessmentId, contextBasis: 'verified_context', limitations: [] }],
      evidenceTemporalProofs: [{ evidenceId: unit.evidenceId, basis: 'current_validity_confirmed' }],
      sourceAuthority: policyResult.authorityFacts.map((f) => ({ documentId: f.documentId, basis: f.basis, claimApplicability: f.claimApplicability })),
      transitions: [],
      coverage: {
        researchComplete: true,
        obligations: policyResult.obligations.map((obl) => ({
          ...obl,
          status: 'satisfied' as const,
          resolvedByAssessmentIds: [assessment.assessmentId],
          resolutionBasis: 'Primary source documentation directly confirms Claude Pro subscription pricing.',
        })),
        rejectedCandidates: [],
        budgetExhausted: false,
        limitations: [],
      },
      policy: policyResult.policy,
      decidedAt: new Date().toISOString(),
    };

    const outcome = decideClaim(decideInput);
    expect(outcome.status).toBe('decided');
    if (outcome.status === 'decided') {
      expect(outcome.decision.verdict).toBe('supported');
      expect(outcome.decision.score).toBe(100);
      expect(outcome.decision.reasonCode).toBe('AUTHORITATIVE_PRIMARY_SUPPORT');
    }
  });

  // =========================================================================
  // Claim 1: Stripe payment_method_types deprecated
  // Expected: contradicted, score 0, DECISIVE_CONTRADICTION
  // =========================================================================
  it('Claim 1 (API): reproduces verdict=contradicted, score=0 from frozen evidence', async () => {
    const rawPassage = goldenReportJson.evidence[1].passage;
    const ticket: ClaimTicket = {
      ticketId: 'tkt_api_01',
      claimId: 'clm_api_01',
      runId: 'run_oracle_01',
      inputHash: 'hash_api_01',
      revision: 1,
      originalStatement: goldenReportJson.claims[1].rawText,
      normalizedProposition: "Stripe's payment intent requires specifying payment_method_types manually on modern API versions.",
      domain: 'api',
      targetTime: TARGET_TIME,
      verificationContext: [
        {
          key: 'vendor',
          label: 'Vendor',
          propertyType: 'string',
          value: 'Stripe',
          origin: 'explicit_claim_text',
          sourceSpan: { start: 0, end: 6 },
          status: 'confirmed',
          applicability: 'claim_level',
        },
        {
          key: 'api_parameter',
          label: 'API Parameter',
          propertyType: 'string',
          value: 'payment_method_types',
          origin: 'explicit_claim_text',
          sourceSpan: { start: 53, end: 73 },
          status: 'confirmed',
          applicability: 'claim_level',
        },
        {
          key: 'status',
          label: 'Requirement status',
          propertyType: 'string',
          value: 'required',
          origin: 'explicit_claim_text',
          sourceSpan: { start: 24, end: 32 },
          status: 'confirmed',
          applicability: 'claim_level',
        },
      ],
      missingMaterialContext: [],
    };

    const doc: SourceDocument = {
      documentId: 'doc_api_01',
      runId: 'run_oracle_01',
      url: goldenReportJson.evidence[1].url,
      finalUrl: goldenReportJson.evidence[1].url,
      retrievedContentHash: 'hash_doc_api',
      retrievedAt: goldenReportJson.evidence[1].retrievedAt,
      rawText: rawPassage,
      extractionStatus: 'success',
      publicationDate: goldenReportJson.evidence[1].publicationDate,
      effectiveDate: goldenReportJson.evidence[1].effectiveDate,
      sourceRole: 'primary_authority',
    };

    const unit: EvidenceUnit = {
      evidenceId: 'evi_api_01',
      documentId: 'doc_api_01',
      verbatimText: rawPassage,
      locator: { charOffsetStart: 0, charOffsetEnd: rawPassage.length },
      surroundingHeaders: ['Payment Intents API'],
      extractedProperties: ticket.verificationContext,
      extractionLimitations: [], footnotes: [],
    };

    const policyResult = evaluatePolicy({
      ticket,
      documents: [doc],
      provenanceMap: {
        [doc.documentId]: {
          documentId: doc.documentId,
          basis: 'official_primary_record',
          entityMatch: true,
          claimApplicability: 'applicable',
        },
      },
    });
    expect(policyResult.selectedDomain).toBe('api');

    const assessment: ClaimEvidenceAssessment = {
      assessmentId: 'asm_api_01',
      claimTicketId: ticket.ticketId,
      evidenceId: unit.evidenceId,
      claimRevision: 1,
      relationship: 'contradicts',
      scopeMatching: 'match',
      quotationVerified: true,
      propertyMatchStatus: { matching: ['vendor', 'api_parameter'], mismatched: ['status'], missingInEvidence: [] },
      temporalApplicability: 'active_at_target_time',
      sourceSuitability: 'authoritative_primary',
      modelConfidence: 0.95,
      reasoning: 'Official documentation explicitly recommends automatic_payment_methods and notes payment_method_types is deprecated.',
    };

    const decideInput: DecideClaimInput = {
      ticket,
      assessments: [assessment],
      evidenceUnits: [unit],
      sourceDocuments: [doc],
      claimTemporalScope: { quantifier: 'current', intervalSemantics: 'existential' },
      assessmentGrounding: [{ assessmentId: assessment.assessmentId, contextBasis: 'verified_context', limitations: [] }],
      evidenceTemporalProofs: [{ evidenceId: unit.evidenceId, basis: 'current_validity_confirmed' }],
      sourceAuthority: policyResult.authorityFacts.map((f) => ({ documentId: f.documentId, basis: f.basis, claimApplicability: f.claimApplicability })),
      transitions: [],
      coverage: {
        researchComplete: true,
        obligations: policyResult.obligations.map((obl) => ({
          ...obl,
          status: 'satisfied' as const,
          resolvedByAssessmentIds: [assessment.assessmentId],
          resolutionBasis: 'Stripe API documentation resolves parameter requirement status.',
        })),
        rejectedCandidates: [],
        budgetExhausted: false,
        limitations: [],
      },
      policy: policyResult.policy,
      decidedAt: new Date().toISOString(),
    };

    const outcome = decideClaim(decideInput);
    expect(outcome.status).toBe('decided');
    if (outcome.status === 'decided') {
      expect(outcome.decision.verdict).toBe('contradicted');
      expect(outcome.decision.score).toBe(0);
      expect(outcome.decision.reasonCode).toBe('DECISIVE_CONTRADICTION');
    }
  });

  // =========================================================================
  // Claim 2: EU AI Act Systemic Risk
  // Expected: supported, score 100, in-force framework confirmation
  // =========================================================================
  it('Claim 2 (Regulation): reproduces verdict=supported, score=100 from frozen evidence', async () => {
    const rawPassage1 = goldenReportJson.evidence[2].passage;
    const rawPassage2 = goldenReportJson.evidence[3].passage;

    const ticket: ClaimTicket = {
      ticketId: 'tkt_reg_01',
      claimId: 'clm_reg_01',
      runId: 'run_oracle_01',
      inputHash: 'hash_reg_01',
      revision: 1,
      originalStatement: goldenReportJson.claims[2].rawText,
      normalizedProposition: 'The EU AI Act classifies general-purpose AI models with systemic risk under transparency and evaluation rules.',
      domain: 'regulation',
      targetTime: TARGET_TIME, // '2024-09-01'
      verificationContext: [
        {
          key: 'jurisdiction',
          label: 'Jurisdiction',
          propertyType: 'string',
          value: 'EU',
          origin: 'explicit_claim_text',
          sourceSpan: { start: 4, end: 13 },
          status: 'confirmed',
          applicability: 'claim_level',
        },
        {
          key: 'requirement',
          label: 'Regulatory requirement',
          propertyType: 'string',
          value: 'transparency and evaluation rules for systemic risk',
          origin: 'explicit_claim_text',
          sourceSpan: { start: 67, end: 109 },
          status: 'confirmed',
          applicability: 'claim_level',
        },
      ],
      missingMaterialContext: [],
    };

    const doc1: SourceDocument = {
      documentId: 'doc_reg_01',
      runId: 'run_oracle_01',
      url: goldenReportJson.evidence[2].url,
      finalUrl: goldenReportJson.evidence[2].url,
      retrievedContentHash: 'hash_doc_reg1',
      retrievedAt: goldenReportJson.evidence[2].retrievedAt,
      rawText: rawPassage1,
      extractionStatus: 'success',
      publicationDate: goldenReportJson.evidence[2].publicationDate,
      effectiveDate: goldenReportJson.evidence[2].effectiveDate, // '2024-08-01' (in force as of 2024-09-01)
      sourceRole: 'regulatory_filing',
    };

    const doc2: SourceDocument = {
      documentId: 'doc_reg_02',
      runId: 'run_oracle_01',
      url: goldenReportJson.evidence[3].url,
      finalUrl: goldenReportJson.evidence[3].url,
      retrievedContentHash: 'hash_doc_reg2',
      retrievedAt: goldenReportJson.evidence[3].retrievedAt,
      rawText: rawPassage2,
      extractionStatus: 'success',
      publicationDate: goldenReportJson.evidence[3].publicationDate,
      effectiveDate: goldenReportJson.evidence[3].effectiveDate, // '2025-08-02' (future scheduled)
      sourceRole: 'primary_authority',
    };

    const unit1: EvidenceUnit = {
      evidenceId: 'evi_regulation_01',
      documentId: 'doc_reg_01',
      verbatimText: rawPassage1,
      locator: { charOffsetStart: 0, charOffsetEnd: rawPassage1.length },
      surroundingHeaders: ['Entry into Force'],
      extractedProperties: ticket.verificationContext,
      extractionLimitations: [], footnotes: [],
    };

    const unit2: EvidenceUnit = {
      evidenceId: 'evi_regulation_02',
      documentId: 'doc_reg_02',
      verbatimText: rawPassage2,
      locator: { charOffsetStart: 0, charOffsetEnd: rawPassage2.length },
      surroundingHeaders: ['AI Office Guidelines'],
      extractedProperties: ticket.verificationContext,
      extractionLimitations: [], footnotes: [],
    };

    const policyResult = evaluatePolicy({
      ticket,
      documents: [doc1, doc2],
      provenanceMap: {
        [doc1.documentId]: {
          documentId: doc1.documentId,
          basis: 'regulatory_filing',
          entityMatch: true,
          claimApplicability: 'applicable',
        },
        [doc2.documentId]: {
          documentId: doc2.documentId,
          basis: 'official_primary_record',
          entityMatch: true,
          claimApplicability: 'applicable',
        },
      },
    });
    expect(policyResult.selectedDomain).toBe('regulation');

    // Regulation entered into force on 2024-08-01, confirming classification rules
    const assessment1: ClaimEvidenceAssessment = {
      assessmentId: 'asm_reg_01',
      claimTicketId: ticket.ticketId,
      evidenceId: unit1.evidenceId,
      claimRevision: 1,
      relationship: 'supports',
      scopeMatching: 'match',
      quotationVerified: true,
      propertyMatchStatus: { matching: ['jurisdiction', 'requirement'], mismatched: [], missingInEvidence: [] },
      temporalApplicability: 'active_at_target_time',
      sourceSuitability: 'authoritative_primary',
      modelConfidence: 0.99,
      reasoning: 'EU AI Act entered into force on 2024-08-01 establishing systemic risk framework.',
    };

    const decideInput: DecideClaimInput = {
      ticket,
      assessments: [assessment1],
      evidenceUnits: [unit1, unit2],
      sourceDocuments: [doc1, doc2],
      claimTemporalScope: { quantifier: 'current', intervalSemantics: 'existential' },
      assessmentGrounding: [{ assessmentId: assessment1.assessmentId, contextBasis: 'verified_context', limitations: [] }],
      evidenceTemporalProofs: [{ evidenceId: unit1.evidenceId, basis: 'current_validity_confirmed' }],
      sourceAuthority: policyResult.authorityFacts.map((f) => ({ documentId: f.documentId, basis: f.basis, claimApplicability: f.claimApplicability })),
      transitions: [],
      coverage: {
        researchComplete: true,
        obligations: policyResult.obligations.map((obl) => ({
          ...obl,
          status: 'satisfied' as const,
          resolvedByAssessmentIds: [assessment1.assessmentId],
          resolutionBasis: 'Official EU regulatory filing establishes statutory text and entry into force.',
        })),
        rejectedCandidates: [],
        budgetExhausted: false,
        limitations: [],
      },
      policy: policyResult.policy,
      decidedAt: new Date().toISOString(),
    };

    const outcome = decideClaim(decideInput);
    expect(outcome.status).toBe('decided');
    if (outcome.status === 'decided') {
      expect(outcome.decision.verdict).toBe('supported');
      expect(outcome.decision.score).toBe(100);
    }
  });

  // =========================================================================
  // Claim 3: Parag Agrawal CEO of Twitter
  // Expected: outdated, score 0, SUPERSEDED_HISTORICAL_CLAIM, correction: Linda Yaccarino
  // =========================================================================
  it('Claim 3 (Leadership): reproduces verdict=outdated, score=0, and derives timeline + correction', async () => {
    const rawPassage1 = goldenReportJson.evidence[4].passage; // Agrawal 2021
    const rawPassage2 = goldenReportJson.evidence[5].passage; // Yaccarino 2023

    const ticket: ClaimTicket = {
      ticketId: 'tkt_lead_01',
      claimId: 'clm_lead_01',
      runId: 'run_oracle_01',
      inputHash: 'hash_lead_01',
      revision: 1,
      originalStatement: goldenReportJson.claims[3].rawText,
      normalizedProposition: 'Parag Agrawal is the current Chief Executive Officer of Twitter.',
      domain: 'leadership',
      targetTime: TARGET_TIME, // '2024-09-01'
      verificationContext: [
        {
          key: 'person',
          label: 'Person',
          propertyType: 'string',
          value: 'Parag Agrawal',
          origin: 'explicit_claim_text',
          sourceSpan: { start: 0, end: 13 },
          status: 'confirmed',
          applicability: 'claim_level',
        },
        {
          key: 'role',
          label: 'Role',
          propertyType: 'string',
          value: 'CEO',
          origin: 'explicit_claim_text',
          sourceSpan: { start: 28, end: 31 },
          status: 'confirmed',
          applicability: 'claim_level',
        },
        {
          key: 'entity',
          label: 'Entity',
          propertyType: 'string',
          value: 'Twitter',
          origin: 'explicit_claim_text',
          sourceSpan: { start: 35, end: 42 },
          status: 'confirmed',
          applicability: 'claim_level',
        },
      ],
      missingMaterialContext: [],
    };

    const doc1: SourceDocument = {
      documentId: 'doc_lead_01',
      runId: 'run_oracle_01',
      url: goldenReportJson.evidence[4].url,
      finalUrl: goldenReportJson.evidence[4].url,
      retrievedContentHash: 'hash_doc_lead1',
      retrievedAt: goldenReportJson.evidence[4].retrievedAt,
      rawText: rawPassage1,
      extractionStatus: 'success',
      publicationDate: goldenReportJson.evidence[4].publicationDate,
      effectiveDate: goldenReportJson.evidence[4].effectiveDate, // '2021-11-29' (historical)
      sourceRole: 'regulatory_filing',
    };

    const doc2: SourceDocument = {
      documentId: 'doc_lead_02',
      runId: 'run_oracle_01',
      url: goldenReportJson.evidence[5].url,
      finalUrl: goldenReportJson.evidence[5].url,
      retrievedContentHash: 'hash_doc_lead2',
      retrievedAt: goldenReportJson.evidence[5].retrievedAt,
      rawText: rawPassage2,
      extractionStatus: 'success',
      publicationDate: goldenReportJson.evidence[5].publicationDate,
      effectiveDate: goldenReportJson.evidence[5].effectiveDate, // '2023-06-05' (superseding)
      sourceRole: 'primary_authority',
    };

    const unit1: EvidenceUnit = {
      evidenceId: 'evi_leadership_01',
      documentId: 'doc_lead_01',
      verbatimText: rawPassage1,
      locator: { charOffsetStart: 0, charOffsetEnd: rawPassage1.length },
      surroundingHeaders: ['Executive Officers'],
      extractedProperties: ticket.verificationContext,
      extractionLimitations: [], footnotes: [],
    };

    const unit2: EvidenceUnit = {
      evidenceId: 'evi_leadership_02',
      documentId: 'doc_lead_02',
      verbatimText: rawPassage2,
      locator: { charOffsetStart: 0, charOffsetEnd: rawPassage2.length },
      surroundingHeaders: ['Leadership Changes'],
      extractedProperties: [
        { key: 'person', label: 'Person', propertyType: 'string', value: 'Linda Yaccarino', origin: 'user_target_context', status: 'confirmed', applicability: 'claim_level' },
        { key: 'role', label: 'Role', propertyType: 'string', value: 'CEO', origin: 'user_target_context', status: 'confirmed', applicability: 'claim_level' },
      ],
      extractionLimitations: [], footnotes: [],
    };

    const policyResult = evaluatePolicy({
      ticket,
      documents: [doc1, doc2],
      provenanceMap: {
        [doc1.documentId]: {
          documentId: doc1.documentId,
          basis: 'regulatory_filing',
          entityMatch: true,
          claimApplicability: 'applicable',
        },
        [doc2.documentId]: {
          documentId: doc2.documentId,
          basis: 'official_primary_record',
          entityMatch: true,
          claimApplicability: 'applicable',
        },
      },
    });
    expect(policyResult.selectedDomain).toBe('leadership');

    // Assessment for doc 1: confirms Parag Agrawal was historically CEO (historical_state)
    const assessment1: ClaimEvidenceAssessment = {
      assessmentId: 'evi_leadership_01',
      claimTicketId: ticket.ticketId,
      evidenceId: unit1.evidenceId,
      claimRevision: 1,
      relationship: 'historical_state',
      scopeMatching: 'match',
      quotationVerified: true,
      propertyMatchStatus: { matching: ['person', 'role', 'entity'], mismatched: [], missingInEvidence: [] },
      temporalApplicability: 'historical_prior',
      sourceSuitability: 'authoritative_primary',
      modelConfidence: 0.99,
      reasoning: 'Form 8-K confirms Agrawal appointed CEO in Nov 2021.',
    };

    // Assessment for doc 2: contradicts Agrawal as current CEO because Yaccarino is current CEO
    const assessment2: ClaimEvidenceAssessment = {
      assessmentId: 'evi_leadership_02',
      claimTicketId: ticket.ticketId,
      evidenceId: unit2.evidenceId,
      claimRevision: 1,
      relationship: 'contradicts',
      scopeMatching: 'match',
      quotationVerified: true,
      propertyMatchStatus: { matching: ['role', 'entity'], mismatched: ['person'], missingInEvidence: [] },
      temporalApplicability: 'active_at_target_time',
      sourceSuitability: 'authoritative_primary',
      modelConfidence: 0.99,
      reasoning: 'Linda Yaccarino assumed CEO role on June 5, 2023, superseding Parag Agrawal.',
    };

    const decideInput: DecideClaimInput = {
      ticket,
      assessments: [assessment1, assessment2],
      evidenceUnits: [unit1, unit2],
      sourceDocuments: [doc1, doc2],
      claimTemporalScope: { quantifier: 'current', intervalSemantics: 'existential' },
      assessmentGrounding: [
        { assessmentId: assessment1.assessmentId, contextBasis: 'verified_context', limitations: [] },
        { assessmentId: assessment2.assessmentId, contextBasis: 'verified_context', limitations: [] },
      ],
      evidenceTemporalProofs: [
        { evidenceId: unit1.evidenceId, basis: 'historical_interval_confirmed', applicableInterval: { start: '2021-11-29', end: '2022-10-27' } },
        { evidenceId: unit2.evidenceId, basis: 'current_validity_confirmed' },
      ],
      sourceAuthority: policyResult.authorityFacts.map((f) => ({ documentId: f.documentId, basis: f.basis, claimApplicability: f.claimApplicability })),
      transitions: [
        {
          transitionId: 'trans_lead_01',
          claimTicketId: ticket.ticketId,
          claimRevision: 1,
          priorAssessmentId: assessment1.assessmentId,
          supersedingAssessmentId: assessment2.assessmentId,
          effectiveDate: '2023-06-05',
          entityAndScopeMatch: 'match',
          basis: 'documented_effective_change',
        },
      ],
      coverage: {
        researchComplete: true,
        obligations: policyResult.obligations.map((obl) => ({
          ...obl,
          status: 'satisfied' as const,
          resolvedByAssessmentIds: [assessment1.assessmentId],
          resolutionBasis: 'SEC filings and primary notices resolve leadership appointment obligations.',
        })),
        rejectedCandidates: [],
        budgetExhausted: false,
        limitations: [],
      },
      policy: policyResult.policy,
      decidedAt: new Date().toISOString(),
    };

    const outcome = decideClaim(decideInput);
    expect(outcome.status).toBe('decided');
    if (outcome.status === 'decided') {
      expect(outcome.decision.verdict).toBe('outdated');
      expect(outcome.decision.score).toBe(0);
      expect(outcome.decision.reasonCode).toBe('SUPERSEDED_HISTORICAL_CLAIM');

      // Timeline composition
      const timelineResult = composeTimeline({
        ticket,
        decision: outcome.decision,
        evidenceUnits: [unit1, unit2],
        sourceDocuments: [doc1, doc2],
        assessments: [assessment1, assessment2],
        transitions: decideInput.transitions,
      });

      expect(Array.isArray(timelineResult.timeline)).toBe(true);
      expect(timelineResult.timeline.length).toBeGreaterThanOrEqual(1);
    }
  });

  // =========================================================================
  // Claim 4: Cloudflare Workers 50ms limit (Missing Context / CPU vs Wall time)
  // Expected: depends_on_context, score null, ESSENTIAL_CONTEXT_MISSING
  // =========================================================================
  it('Claim 4 (Context): reproduces verdict=depends_on_context, score=null when plan_tier is unspecified', async () => {
    const rawPassage = goldenReportJson.evidence[6].passage;

    const ticket: ClaimTicket = {
      ticketId: 'tkt_context_01',
      claimId: 'clm_context_01',
      runId: 'run_oracle_01',
      inputHash: 'hash_ctx_01',
      revision: 1,
      originalStatement: goldenReportJson.claims[4].rawText,
      normalizedProposition: 'Cloudflare Workers enforce a strict maximum limit of 50 milliseconds of CPU execution time.',
      domain: 'generic',
      targetTime: TARGET_TIME, // '2024-09-01'
      verificationContext: [
        {
          key: 'vendor',
          label: 'Vendor',
          propertyType: 'string',
          value: 'Cloudflare',
          origin: 'explicit_claim_text',
          sourceSpan: { start: 0, end: 10 },
          status: 'confirmed',
          applicability: 'claim_level',
        },
        {
          key: 'limit_type',
          label: 'Limit type',
          propertyType: 'string',
          value: 'CPU execution time',
          origin: 'explicit_claim_text',
          sourceSpan: { start: 67, end: 85 },
          status: 'confirmed',
          applicability: 'claim_level',
        },
        {
          key: 'limit_value',
          label: 'Limit value',
          propertyType: 'number',
          value: 50,
          units: 'milliseconds',
          origin: 'explicit_claim_text',
          sourceSpan: { start: 49, end: 64 },
          status: 'confirmed',
          applicability: 'claim_level',
        },
      ],
      missingMaterialContext: ['plan_tier'], // Key required qualifier missing
    };

    const doc: SourceDocument = {
      documentId: 'doc_ctx_01',
      runId: 'run_oracle_01',
      url: goldenReportJson.evidence[6].url,
      finalUrl: goldenReportJson.evidence[6].url,
      retrievedContentHash: 'hash_doc_ctx',
      retrievedAt: goldenReportJson.evidence[6].retrievedAt,
      rawText: rawPassage,
      extractionStatus: 'success',
      publicationDate: goldenReportJson.evidence[6].publicationDate,
      effectiveDate: goldenReportJson.evidence[6].effectiveDate,
      sourceRole: 'primary_authority',
    };

    const unit: EvidenceUnit = {
      evidenceId: 'evi_context_01',
      documentId: 'doc_ctx_01',
      verbatimText: rawPassage,
      locator: { charOffsetStart: 0, charOffsetEnd: rawPassage.length },
      surroundingHeaders: ['CPU Time Limits'],
      extractedProperties: ticket.verificationContext,
      extractionLimitations: [], footnotes: [],
    };

    const policyResult = evaluatePolicy({ ticket, documents: [doc] });

    // Assessment: relevant but missing material context (Free vs Paid plan tier)
    const assessment: ClaimEvidenceAssessment = {
      assessmentId: 'asm_ctx_01',
      claimTicketId: ticket.ticketId,
      evidenceId: unit.evidenceId,
      claimRevision: 1,
      relationship: 'relevant_but_inconclusive',
      scopeMatching: 'mismatch',
      quotationVerified: true,
      propertyMatchStatus: { matching: ['limit_type'], mismatched: [], missingInEvidence: ['plan_tier'] },
      temporalApplicability: 'active_at_target_time',
      sourceSuitability: 'authoritative_primary',
      modelConfidence: 0.85,
      reasoning: 'Passage shows Free plans receive 10ms CPU time while Paid plans receive 50ms CPU time. Missing plan tier prevents definitive confirmation.',
    };

    const decideInput: DecideClaimInput = {
      ticket,
      assessments: [assessment],
      evidenceUnits: [unit],
      sourceDocuments: [doc],
      claimTemporalScope: { quantifier: 'current', intervalSemantics: 'existential' },
      assessmentGrounding: [{ assessmentId: assessment.assessmentId, contextBasis: 'verified_context', limitations: [] }],
      evidenceTemporalProofs: [{ evidenceId: unit.evidenceId, basis: 'current_validity_confirmed' }],
      sourceAuthority: policyResult.authorityFacts.map((f) => ({ documentId: f.documentId, basis: f.basis, claimApplicability: f.claimApplicability })),
      transitions: [],
      coverage: {
        researchComplete: true,
        obligations: policyResult.obligations.map((obl) => ({
          ...obl,
          status: 'satisfied' as const,
          resolvedByAssessmentIds: [assessment.assessmentId],
          resolutionBasis: 'Cloudflare documentation captures platform execution limits.',
        })),
        rejectedCandidates: [],
        budgetExhausted: false,
        limitations: [],
      },
      policy: policyResult.policy,
      decidedAt: new Date().toISOString(),
    };

    const outcome = decideClaim(decideInput);
    expect(outcome.status).toBe('decided');
    if (outcome.status === 'decided') {
      expect(outcome.decision.verdict).toBe('depends_on_context');
      expect(outcome.decision.score).toBeNull();
      expect(outcome.decision.reasonCode).toBe('ESSENTIAL_CONTEXT_MISSING');
    }
  });

  it('Claim 4 (Context Clarified): reproduces verdict=supported, score=100 when plan_tier is clarified to Workers Paid', async () => {
    const rawPassage = goldenReportJson.evidence[6].passage;

    const clarifiedTicket: ClaimTicket = {
      ticketId: 'tkt_context_01_r2',
      claimId: 'clm_context_01',
      runId: 'run_oracle_01',
      inputHash: 'hash_ctx_01',
      revision: 2,
      originalStatement: goldenReportJson.claims[4].rawText,
      normalizedProposition: 'Cloudflare Workers on Workers Paid plan enforce a maximum limit of 50 milliseconds of CPU execution time.',
      domain: 'generic',
      targetTime: TARGET_TIME,
      verificationContext: [
        {
          key: 'vendor',
          label: 'Vendor',
          propertyType: 'string',
          value: 'Cloudflare',
          origin: 'explicit_claim_text',
          sourceSpan: { start: 0, end: 10 },
          status: 'confirmed',
          applicability: 'claim_level',
        },
        {
          key: 'limit_type',
          label: 'Limit type',
          propertyType: 'string',
          value: 'CPU execution time',
          origin: 'explicit_claim_text',
          sourceSpan: { start: 67, end: 85 },
          status: 'confirmed',
          applicability: 'claim_level',
        },
        {
          key: 'limit_value',
          label: 'Limit value',
          propertyType: 'number',
          value: 50,
          units: 'milliseconds',
          origin: 'explicit_claim_text',
          sourceSpan: { start: 49, end: 64 },
          status: 'confirmed',
          applicability: 'claim_level',
        },
        {
          key: 'plan_tier',
          label: 'Plan tier',
          propertyType: 'string',
          value: 'Workers Paid',
          origin: 'user_target_context',
          status: 'confirmed',
          applicability: 'claim_level',
        },
      ],
      missingMaterialContext: [], // Clarified!
    };

    const doc: SourceDocument = {
      documentId: 'doc_ctx_01',
      runId: 'run_oracle_01',
      url: goldenReportJson.evidence[6].url,
      finalUrl: goldenReportJson.evidence[6].url,
      retrievedContentHash: 'hash_doc_ctx',
      retrievedAt: goldenReportJson.evidence[6].retrievedAt,
      rawText: rawPassage,
      extractionStatus: 'success',
      publicationDate: goldenReportJson.evidence[6].publicationDate,
      effectiveDate: goldenReportJson.evidence[6].effectiveDate,
      sourceRole: 'primary_authority',
    };

    const unit: EvidenceUnit = {
      evidenceId: 'evi_context_01',
      documentId: 'doc_ctx_01',
      verbatimText: rawPassage,
      locator: { charOffsetStart: 0, charOffsetEnd: rawPassage.length },
      surroundingHeaders: ['CPU Time Limits'],
      extractedProperties: clarifiedTicket.verificationContext,
      extractionLimitations: [],
      footnotes: [],
    };

    const policyResult = evaluatePolicy({
      ticket: clarifiedTicket,
      documents: [doc],
      provenanceMap: {
        [doc.documentId]: {
          documentId: doc.documentId,
          basis: 'official_primary_record',
          entityMatch: true,
          claimApplicability: 'applicable',
        },
      },
    });

    const assessment: ClaimEvidenceAssessment = {
      assessmentId: 'asm_ctx_02',
      claimTicketId: clarifiedTicket.ticketId,
      evidenceId: unit.evidenceId,
      claimRevision: 2,
      relationship: 'supports',
      scopeMatching: 'match',
      quotationVerified: true,
      propertyMatchStatus: {
        matching: ['vendor', 'limit_type', 'limit_value', 'plan_tier'],
        mismatched: [],
        missingInEvidence: [],
      },
      temporalApplicability: 'active_at_target_time',
      sourceSuitability: 'authoritative_primary',
      modelConfidence: 0.99,
      reasoning: 'Official documentation confirms Workers Paid plans receive up to 50ms of CPU time per request.',
    };

    const decideInput: DecideClaimInput = {
      ticket: clarifiedTicket,
      assessments: [assessment],
      evidenceUnits: [unit],
      sourceDocuments: [doc],
      claimTemporalScope: { quantifier: 'current', intervalSemantics: 'existential' },
      assessmentGrounding: [{ assessmentId: assessment.assessmentId, contextBasis: 'verified_context', limitations: [] }],
      evidenceTemporalProofs: [{ evidenceId: unit.evidenceId, basis: 'current_validity_confirmed' }],
      sourceAuthority: policyResult.authorityFacts.map((f) => ({ documentId: f.documentId, basis: f.basis, claimApplicability: f.claimApplicability })),
      transitions: [],
      coverage: {
        researchComplete: true,
        obligations: policyResult.obligations.map((obl) => ({
          ...obl,
          status: 'satisfied' as const,
          resolvedByAssessmentIds: [assessment.assessmentId],
          resolutionBasis: 'Cloudflare documentation establishes execution limits for clarified Paid tier.',
        })),
        rejectedCandidates: [],
        budgetExhausted: false,
        limitations: [],
      },
      policy: policyResult.policy,
      decidedAt: new Date().toISOString(),
    };

    const outcome = decideClaim(decideInput);
    expect(outcome.status).toBe('decided');
    if (outcome.status === 'decided') {
      expect(outcome.decision.verdict).toBe('supported');
      expect(outcome.decision.score).toBe(100);
      expect(outcome.decision.reasonCode).toBe('AUTHORITATIVE_PRIMARY_SUPPORT');
    }
  });
});
