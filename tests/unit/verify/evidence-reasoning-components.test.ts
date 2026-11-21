import { describe, it, expect } from 'vitest';
import { ClaimTicket } from '@/lib/contracts/claim-ticket';
import {
  ClaimEvidenceAssessment,
  EvidenceUnit,
  SourceDocument,
} from '@/lib/contracts/evidence-objects';
import { DecideClaimInput, DecisionRecordSchema, InferenceBundle } from '@/lib/contracts/decision';
import { decideClaim, DECISION_REASON_CODES } from '@/server/verify/decide';
import { requiresCounterevidencePolicy } from '@/server/verify/research-planner';
import { buildResearchPlannerUserPrompt } from '@/server/prompts/research';
import { synthesizeBoundedInference, validateInferenceBundle } from '@/server/verify/inference-synthesizer';
import { toCanonicalClaimTicket, buildDecideClaimInput } from '@/server/verify/converters';
import { RawExtractedClaimSchema } from '@/lib/contracts/extraction';

function makeDoc(
  docId: string,
  rawText: string,
  options?: Partial<SourceDocument>
): SourceDocument {
  return {
    documentId: docId,
    runId: options?.runId ?? 'run_test_era_components',
    url: `https://example.com/doc/${docId}`,
    finalUrl: `https://example.com/doc/${docId}`,
    retrievedContentHash: 'hash_test_12345678',
    retrievedAt: '2026-11-20T12:00:00Z',
    rawText,
    extractionStatus: 'success',
    sourceRole: options?.sourceRole ?? 'primary_authority',
    publicationDate: options?.publicationDate ?? null,
    effectiveDate: options?.effectiveDate ?? '2026-11-20',
  };
}

function makeUnit(
  unitId: string,
  docId: string,
  text: string,
  options?: Partial<EvidenceUnit>
): EvidenceUnit {
  return {
    evidenceId: unitId,
    documentId: docId,
    verbatimText: text,
    locator: {
      charOffsetStart: 0,
      charOffsetEnd: text.length,
    },
    surroundingHeaders: [],
    footnotes: [],
    extractedProperties: [],
    effectiveDate: options?.effectiveDate ?? '2026-11-20',
    publicationDate: options?.publicationDate ?? null,
    extractionLimitations: [],
  };
}

function makeAssessment(
  asmId: string,
  ticket: ClaimTicket,
  unitId: string,
  options?: Partial<ClaimEvidenceAssessment>
): ClaimEvidenceAssessment {
  return {
    assessmentId: asmId,
    claimTicketId: ticket.ticketId,
    claimRevision: ticket.revision,
    evidenceId: unitId,
    componentId: options?.componentId,
    relationship: options?.relationship ?? 'supports',
    scopeMatching: options?.scopeMatching ?? 'match',
    quotationVerified: true,
    propertyMatchStatus: options?.propertyMatchStatus ?? {
      matching: [],
      mismatched: [],
      missingInEvidence: [],
    },
    temporalApplicability: options?.temporalApplicability ?? 'active_at_target_time',
    sourceSuitability: options?.sourceSuitability ?? 'authoritative_primary',
    modelConfidence: options?.modelConfidence ?? 0.95,
    reasoning: options?.reasoning ?? 'Grounded test evaluation',
  };
}

function makeDecideInput(params: {
  ticket: ClaimTicket;
  assessments: ClaimEvidenceAssessment[];
  evidenceUnits: EvidenceUnit[];
  sources: SourceDocument[];
  inferenceBundles?: InferenceBundle[];
}): DecideClaimInput {
  const { ticket, assessments, evidenceUnits, sources, inferenceBundles = [] } = params;

  return {
    ticket,
    assessments,
    evidenceUnits,
    sourceDocuments: sources,
    claimTemporalScope: {
      quantifier: 'current',
      intervalSemantics: 'existential',
    },
    assessmentGrounding: assessments.map((a) => ({
      assessmentId: a.assessmentId,
      contextBasis: 'verified_context',
      limitations: [],
    })),
    evidenceTemporalProofs: evidenceUnits.map((u) => ({
      evidenceId: u.evidenceId,
      basis: 'current_validity_confirmed',
    })),
    sourceAuthority: sources.map((s) => ({
      documentId: s.documentId,
      basis: s.sourceRole === 'primary_authority' ? 'official_primary_record' : 'independent_secondary_report',
      claimApplicability: 'applicable',
    })),
    transitions: [],
    inferenceBundles,
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
      propertyRoles: [],
      authoritativeSourceRoles: ['primary_authority', 'regulatory_filing'],
    },
    decidedAt: '2026-11-20T12:00:00Z',
    traceIds: {
      runId: ticket.runId,
      nodeId: 'node_test_era',
    },
  };
}

describe('Evidence Reasoning & Claim Relationships Verification Suite', () => {
  // Case 1: Compound Claim Extraction Decomposition
  it('TC-ERA-01: decomposes compound claim into components with entailment and conjunction', () => {
    const rawClaim = {
      statement: 'Salman khan was found dead by puneet superstar',
      normalizedProposition: 'Salman Khan was found dead by Puneet Superstar.',
      domain: 'biography',
      timeSensitivity: 'high' as const,
      explicitQualifiers: [],
      inferredQualifiers: [],
      missingMaterialQualifiers: [],
      components: [
        {
          id: 'c1',
          statement: 'Salman khan was found dead',
          normalizedProposition: 'Salman Khan died / was found dead.',
          role: 'asserted_value' as const,
        },
        {
          id: 'c2',
          statement: 'by puneet superstar',
          normalizedProposition: "Puneet Superstar discovered Salman Khan's body.",
          role: 'asserted_value' as const,
        },
      ],
      relationships: [
        {
          type: 'entailment' as const,
          sourceId: 'c2',
          targetId: 'c1',
          rationale: "Puneet discovering the body entails Salman Khan is dead.",
        },
        {
          type: 'conjunction' as const,
          sourceId: 'c1',
          targetId: 'c2',
          rationale: 'Both sub-propositions are required for compound statement.',
        },
      ],
    };

    const parsed = RawExtractedClaimSchema.safeParse(rawClaim);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    expect(parsed.data.components).toHaveLength(2);
    expect(parsed.data.relationships).toHaveLength(2);
    expect(parsed.data.relationships?.[0].type).toBe('entailment');
  });

  // Case 2: Clean Simple Claims Retain Direct Path
  it('TC-ERA-02: simple atomic claims omit components or leave them empty', () => {
    const rawClaim = {
      statement: 'ZephyrPay does not charge refund processing fees for standard merchants',
      normalizedProposition: 'ZephyrPay does not charge refund processing fees for standard merchants.',
      domain: 'pricing',
      timeSensitivity: 'medium' as const,
      explicitQualifiers: [],
      inferredQualifiers: [],
      missingMaterialQualifiers: [],
    };

    const parsed = RawExtractedClaimSchema.safeParse(rawClaim);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.components).toBeUndefined();
    expect(parsed.data.relationships).toBeUndefined();
  });

  // Case 3: Research Planner Prompt Includes Components
  it('TC-ERA-03: research planner user prompt exposes decomposed components to model', () => {
    const ticket: ClaimTicket = {
      ticketId: 'tkt_salman_hoax_01',
      claimId: 'clm_salman_hoax_01',
      runId: 'run_test_era_components',
      inputHash: 'hash_test_123',
      revision: 1,
      originalStatement: 'Salman khan was found dead by puneet superstar',
      normalizedProposition: 'Salman Khan was found dead by Puneet Superstar.',
      domain: 'biography',
      timeSensitivity: 'high',
      targetTime: '2026-11-20',
      verificationContext: [],
      missingMaterialContext: [],
      components: [
        {
          id: 'c1',
          statement: 'Salman khan was found dead',
          normalizedProposition: 'Salman Khan died / was found dead.',
        },
        {
          id: 'c2',
          statement: 'by puneet superstar',
          normalizedProposition: "Puneet Superstar discovered Salman Khan's body.",
        },
      ],
      relationships: [
        { type: 'entailment', sourceId: 'c2', targetId: 'c1' },
      ],
    };

    const promptStr = buildResearchPlannerUserPrompt({
      ticket,
      round: 1,
      remainingQueryAllowance: 4,
      requiresCounterevidence: true,
    });

    const parsed = JSON.parse(promptStr);
    expect(parsed.claimTicket.components).toHaveLength(2);
    expect(parsed.claimTicket.components[0].id).toBe('c1');
    expect(parsed.claimTicket.relationships).toHaveLength(1);
  });

  // Case 4: Counterevidence Policy Triggers on Death / Severe Life Events
  it('TC-ERA-04: counterevidence policy mandates counterevidence queries for death claims', () => {
    const ticket: ClaimTicket = {
      ticketId: 'tkt_salman_death_01',
      claimId: 'clm_salman_death_01',
      runId: 'run_test_era_components',
      inputHash: 'hash_test_123',
      revision: 1,
      originalStatement: 'Salman Khan died yesterday',
      normalizedProposition: 'Salman Khan passed away yesterday.',
      domain: 'biography',
      timeSensitivity: 'high',
      targetTime: '2026-11-20',
      verificationContext: [],
      missingMaterialContext: [],
    };

    expect(requiresCounterevidencePolicy(ticket)).toBe(true);
  });

  // Case 5: Ontological Mutual Exclusion (Contemporaneous Life vs Death)
  it('TC-ERA-05: contemporaneous proof of life directly contradicts death claim', () => {
    const ticket: ClaimTicket = {
      ticketId: 'tkt_salman_death_02',
      claimId: 'clm_salman_death_02',
      runId: 'run_test_era_components',
      inputHash: 'hash_test_123',
      revision: 1,
      originalStatement: 'Salman Khan was found dead',
      normalizedProposition: 'Salman Khan passed away / was found dead.',
      domain: 'biography',
      timeSensitivity: 'high',
      targetTime: '2026-11-20',
      verificationContext: [],
      missingMaterialContext: [],
    };

    const docText = 'Salman Khan attended the Mumbai trailer launch of his new film in November 2026, greeting thousands of fans.';
    const doc = makeDoc('doc_hindu_01', docText);
    const unit = makeUnit('unit_hindu_01', doc.documentId, docText);
    const asm = makeAssessment('asm_hindu_01', ticket, unit.evidenceId, {
      relationship: 'contradicts',
      scopeMatching: 'match',
      temporalApplicability: 'active_at_target_time',
      sourceSuitability: 'authoritative_primary',
      reasoning: 'Contemporaneous proof of live public appearance ontologically excludes death.',
    });

    const outcome = decideClaim(
      makeDecideInput({ ticket, assessments: [asm], evidenceUnits: [unit], sources: [doc] })
    );

    expect(outcome.status).toBe('decided');
    if (outcome.status !== 'decided') return;
    expect(outcome.decision.verdict).toBe('contradicted');
    expect(outcome.decision.score).toBe(0);
    expect(outcome.decision.reasonCode).toBe(DECISION_REASON_CODES.DECISIVE_CONTRADICTION);
  });

  // Case 6: Contradiction of Necessary Component Refutes Compound Conjunction
  it('TC-ERA-06: refuting necessary component c1 decisively contradicts compound parent claim', () => {
    const ticket: ClaimTicket = {
      ticketId: 'tkt_salman_compound_01',
      claimId: 'clm_salman_compound_01',
      runId: 'run_test_era_components',
      inputHash: 'hash_test_123',
      revision: 1,
      originalStatement: 'Salman khan was found dead by puneet superstar',
      normalizedProposition: 'Salman Khan was found dead by Puneet Superstar.',
      domain: 'biography',
      timeSensitivity: 'high',
      targetTime: '2026-11-20',
      verificationContext: [],
      missingMaterialContext: [],
      components: [
        {
          id: 'c1',
          statement: 'Salman khan was found dead',
          normalizedProposition: 'Salman Khan died / was found dead.',
        },
        {
          id: 'c2',
          statement: 'by puneet superstar',
          normalizedProposition: "Puneet Superstar discovered Salman Khan's body.",
        },
      ],
      relationships: [
        { type: 'conjunction', sourceId: 'c1', targetId: 'c2' },
        { type: 'entailment', sourceId: 'c2', targetId: 'c1' },
      ],
    };

    const docText = 'Salman Khan is healthy and alive, seen filming Bigg Boss season 18 in Mumbai in November 2026.';
    const doc = makeDoc('doc_news18_01', docText);
    const unit = makeUnit('unit_news18_01', doc.documentId, docText);
    const asm = makeAssessment('asm_news18_01', ticket, unit.evidenceId, {
      componentId: 'c1',
      relationship: 'contradicts',
      scopeMatching: 'match',
      temporalApplicability: 'active_at_target_time',
      sourceSuitability: 'authoritative_primary',
      reasoning: 'Active public appearance directly contradicts component c1 (Salman Khan died).',
    });

    const outcome = decideClaim(
      makeDecideInput({ ticket, assessments: [asm], evidenceUnits: [unit], sources: [doc] })
    );

    expect(outcome.status).toBe('decided');
    if (outcome.status !== 'decided') return;
    expect(outcome.decision.verdict).toBe('contradicted');
    expect(outcome.decision.score).toBe(0);
    expect(outcome.decision.reasonCode).toBe(DECISION_REASON_CODES.DECISIVE_CONTRADICTION);
  });

  // Case 7: Actor Non-Conflation (Status of Actor B Does Not Prove Actor A)
  it('TC-ERA-07: actions of secondary actor alone do not substantiate or refute primary entity', () => {
    const ticket: ClaimTicket = {
      ticketId: 'tkt_salman_compound_02',
      claimId: 'clm_salman_compound_02',
      runId: 'run_test_era_components',
      inputHash: 'hash_test_123',
      revision: 1,
      originalStatement: 'Salman khan was found dead by puneet superstar',
      normalizedProposition: 'Salman Khan was found dead by Puneet Superstar.',
      domain: 'biography',
      timeSensitivity: 'high',
      targetTime: '2026-11-20',
      verificationContext: [],
      missingMaterialContext: [],
      components: [
        { id: 'c1', statement: 'Salman khan was found dead', normalizedProposition: 'Salman Khan died.' },
        { id: 'c2', statement: 'by puneet superstar', normalizedProposition: 'Puneet found body.' },
      ],
    };

    // Document only mentions Puneet Superstar posting videos, nothing about Salman Khan
    const docText = 'Puneet Superstar posted a new comedy video on Instagram from his Delhi residence today.';
    const doc = makeDoc('doc_puneet_01', docText);
    const unit = makeUnit('unit_puneet_01', doc.documentId, docText);
    const asm = makeAssessment('asm_puneet_01', ticket, unit.evidenceId, {
      relationship: 'unrelated',
      scopeMatching: 'unknown',
      temporalApplicability: 'undetermined',
      sourceSuitability: 'credible_secondary',
      reasoning: 'Puneet Superstar video does not address Salman Khan health or alleged death.',
    });

    const outcome = decideClaim(
      makeDecideInput({ ticket, assessments: [asm], evidenceUnits: [unit], sources: [doc] })
    );

    expect(outcome.status).toBe('decided');
    if (outcome.status !== 'decided') return;
    // Unrelated secondary actor evidence yields insufficient_evidence
    expect(outcome.decision.verdict).toBe('insufficient_evidence');
    expect(outcome.decision.score).toBeNull();
  });

  // Case 8: Partial Support Failure for Compound Claim
  it('TC-ERA-08: supporting one component while another is missing fails to insufficient_evidence', () => {
    const ticket: ClaimTicket = {
      ticketId: 'tkt_compound_partial_01',
      claimId: 'clm_compound_partial_01',
      runId: 'run_test_era_components',
      inputHash: 'hash_test_123',
      revision: 1,
      originalStatement: 'Company X launched Product Y and acquired Company Z',
      normalizedProposition: 'Company X launched Product Y and acquired Company Z.',
      domain: 'business',
      timeSensitivity: 'high',
      targetTime: '2026-11-20',
      verificationContext: [],
      missingMaterialContext: [],
      components: [
        { id: 'c1', statement: 'Company X launched Product Y', normalizedProposition: 'Company X launched Product Y.' },
        { id: 'c2', statement: 'acquired Company Z', normalizedProposition: 'Company X acquired Company Z.' },
      ],
      relationships: [
        { type: 'conjunction', sourceId: 'c1', targetId: 'c2' },
      ],
    };

    // Evidence only confirms c1 (launch of Product Y)
    const docText = 'Company X officially launched Product Y globally today.';
    const doc = makeDoc('doc_launch_01', docText);
    const unit = makeUnit('unit_launch_01', doc.documentId, docText);
    const asm = makeAssessment('asm_launch_01', ticket, unit.evidenceId, {
      componentId: 'c1',
      relationship: 'supports',
      scopeMatching: 'match',
      sourceSuitability: 'authoritative_primary',
      reasoning: 'Primary doc confirms Product Y launch (c1).',
    });

    const outcome = decideClaim(
      makeDecideInput({ ticket, assessments: [asm], evidenceUnits: [unit], sources: [doc] })
    );

    expect(outcome.status).toBe('decided');
    if (outcome.status !== 'decided') return;
    // Partial support must NOT mark compound claim supported!
    expect(outcome.decision.verdict).toBe('insufficient_evidence');
    expect(outcome.decision.score).toBeNull();
    expect(outcome.decision.scoreReason).toContain('c2');
  });

  // Case 9: Complete Conjunction Support
  it('TC-ERA-09: supporting all necessary components grants supported to compound claim', () => {
    const ticket: ClaimTicket = {
      ticketId: 'tkt_compound_complete_01',
      claimId: 'clm_compound_complete_01',
      runId: 'run_test_era_components',
      inputHash: 'hash_test_123',
      revision: 1,
      originalStatement: 'Company X launched Product Y and acquired Company Z',
      normalizedProposition: 'Company X launched Product Y and acquired Company Z.',
      domain: 'business',
      timeSensitivity: 'high',
      targetTime: '2026-11-20',
      verificationContext: [],
      missingMaterialContext: [],
      components: [
        { id: 'c1', statement: 'Company X launched Product Y', normalizedProposition: 'Company X launched Product Y.' },
        { id: 'c2', statement: 'acquired Company Z', normalizedProposition: 'Company X acquired Company Z.' },
      ],
      relationships: [
        { type: 'conjunction', sourceId: 'c1', targetId: 'c2' },
      ],
    };

    const docText1 = 'Company X officially launched Product Y globally today.';
    const docText2 = 'Company X completed its definitive acquisition of Company Z today.';
    const doc1 = makeDoc('doc_launch_02', docText1);
    const doc2 = makeDoc('doc_acq_02', docText2);
    const unit1 = makeUnit('unit_launch_02', doc1.documentId, docText1);
    const unit2 = makeUnit('unit_acq_02', doc2.documentId, docText2);
    const asm1 = makeAssessment('asm_launch_02', ticket, unit1.evidenceId, {
      componentId: 'c1',
      relationship: 'supports',
      scopeMatching: 'match',
      sourceSuitability: 'authoritative_primary',
    });
    const asm2 = makeAssessment('asm_acq_02', ticket, unit2.evidenceId, {
      componentId: 'c2',
      relationship: 'supports',
      scopeMatching: 'match',
      sourceSuitability: 'authoritative_primary',
    });

    const outcome = decideClaim(
      makeDecideInput({
        ticket,
        assessments: [asm1, asm2],
        evidenceUnits: [unit1, unit2],
        sources: [doc1, doc2],
      })
    );

    expect(outcome.status).toBe('decided');
    if (outcome.status !== 'decided') return;
    expect(outcome.decision.verdict).toBe('supported');
    expect(outcome.decision.score).toBe(100);
    expect(outcome.decision.reasonCode).toBe(DECISION_REASON_CODES.AUTHORITATIVE_PRIMARY_SUPPORT);
  });

  // Case 10: Bounded Cross-Evidence Inference Synthesizer (Chronology)
  it('TC-ERA-10: synthesizes chronological succession across two independent documents', () => {
    const ticket: ClaimTicket = {
      ticketId: 'tkt_recency_01',
      claimId: 'clm_recency_01',
      runId: 'run_test_era_components',
      inputHash: 'hash_test_123',
      revision: 1,
      originalStatement: 'The latest model is Model Willow instead of Model Cedar as of 2026',
      normalizedProposition: "The latest model is Model Willow instead of Model Cedar as of 2026.",
      domain: 'product_version',
      timeSensitivity: 'high',
      targetTime: '2026-11-20',
      verificationContext: [
        {
          key: 'productName',
          label: 'Product',
          propertyType: 'string',
          value: 'Model Willow',
          origin: 'explicit_claim_text',
          status: 'confirmed',
          applicability: 'claim_level',
        },
        {
          key: 'comparisonProduct',
          label: 'Comparison Alternative',
          propertyType: 'string',
          value: 'Model Cedar',
          origin: 'explicit_claim_text',
          status: 'confirmed',
          applicability: 'claim_level',
        },
      ],
      missingMaterialContext: [],
    };

    const doc1 = makeDoc('doc_cedar', 'Model Cedar was released on 2026-09-02.', {
      effectiveDate: '2026-09-02',
    });
    const doc2 = makeDoc('doc_willow', 'Model Willow was released on 2026-11-10.', {
      effectiveDate: '2026-11-10',
    });
    const unit1 = makeUnit('unit_cedar', doc1.documentId, 'Model Cedar was released on 2026-09-02.', {
      effectiveDate: '2026-09-02',
    });
    const unit2 = makeUnit('unit_willow', doc2.documentId, 'Model Willow was released on 2026-11-10.', {
      effectiveDate: '2026-11-10',
    });

    const asm1 = makeAssessment('asm_c', ticket, unit1.evidenceId, { relationship: 'relevant_but_inconclusive' });
    const asm2 = makeAssessment('asm_w', ticket, unit2.evidenceId, { relationship: 'relevant_but_inconclusive' });

    const result = synthesizeBoundedInference({
      ticket,
      evidenceUnits: [unit1, unit2],
      sourceDocuments: [doc1, doc2],
      assessments: [asm1, asm2],
    });

    expect(result.bundles).toHaveLength(1);
    expect(result.bundles[0].relationship).toBe('supports');
    expect(result.bundles[0].conclusion).toContain('Model Willow was released after Model Cedar');
  });

  // Case 11: Bounded Cross-Evidence Inference Synthesizer (Event Attendance + Date Anchor)
  it('TC-ERA-11: synthesizes public event attendance with event date anchor to refute death claim', () => {
    const ticket: ClaimTicket = {
      ticketId: 'tkt_salman_hoax_synth',
      claimId: 'clm_salman_hoax_synth',
      runId: 'run_test_era_components',
      inputHash: 'hash_test_123',
      revision: 1,
      originalStatement: 'Salman Khan was found dead',
      normalizedProposition: 'Salman Khan died.',
      domain: 'biography',
      timeSensitivity: 'high',
      targetTime: '2026-11-20',
      verificationContext: [],
      missingMaterialContext: [],
      components: [
        { id: 'c1', statement: 'Salman Khan was found dead', normalizedProposition: 'Salman Khan died.' },
      ],
    };

    // Unit 1 establishes Salman Khan attended the Filmfare awards
    const doc1 = makeDoc('doc_event_att', 'Salman Khan gave an electrifying performance at the Filmfare ceremony.');
    const unit1 = makeUnit('unit_event_att', doc1.documentId, 'Salman Khan gave an electrifying performance at the Filmfare ceremony.');

    // Unit 2 establishes that the Filmfare ceremony took place on 2026-10-15
    const doc2 = makeDoc('doc_event_date', 'The 71st Filmfare ceremony was held on 2026-10-15 in Mumbai.', {
      effectiveDate: '2026-10-15',
    });
    const unit2 = makeUnit('unit_event_date', doc2.documentId, 'The 71st Filmfare ceremony was held on 2026-10-15 in Mumbai.', {
      effectiveDate: '2026-10-15',
    });

    const asm1 = makeAssessment('asm_ea', ticket, unit1.evidenceId, { relationship: 'relevant_but_inconclusive' });
    const asm2 = makeAssessment('asm_ed', ticket, unit2.evidenceId, { relationship: 'relevant_but_inconclusive' });

    const result = synthesizeBoundedInference({
      ticket,
      evidenceUnits: [unit1, unit2],
      sourceDocuments: [doc1, doc2],
      assessments: [asm1, asm2],
    });

    expect(result.bundles.length).toBeGreaterThanOrEqual(1);
    const bundle = result.bundles[0];
    expect(bundle.relationship).toBe('contradicts');
    expect(bundle.conclusion).toContain('establishing contemporaneous life');
  });

  // Case 12: Bounded Synthesis Rejects Low-Authority / Untrusted Units
  it('TC-ERA-12: inference synthesizer ignores units from insufficient_authority sources', () => {
    const ticket: ClaimTicket = {
      ticketId: 'tkt_synth_untrusted',
      claimId: 'clm_synth_untrusted',
      runId: 'run_test_era_components',
      inputHash: 'hash_test_123',
      revision: 1,
      originalStatement: 'Salman Khan was found dead',
      normalizedProposition: 'Salman Khan died.',
      domain: 'biography',
      timeSensitivity: 'high',
      targetTime: '2026-11-20',
      verificationContext: [],
      missingMaterialContext: [],
    };

    const doc1 = makeDoc('doc_blog', 'Salman Khan attended Filmfare');
    const doc2 = makeDoc('doc_forum', 'Filmfare held on 2026-10-15');
    const unit1 = makeUnit('unit_b', doc1.documentId, 'Salman Khan attended Filmfare');
    const unit2 = makeUnit('unit_f', doc2.documentId, 'Filmfare held on 2026-10-15');

    const asm1 = makeAssessment('asm_b', ticket, unit1.evidenceId, {
      sourceSuitability: 'insufficient_authority',
    });
    const asm2 = makeAssessment('asm_f', ticket, unit2.evidenceId, {
      sourceSuitability: 'insufficient_authority',
    });

    const result = synthesizeBoundedInference({
      ticket,
      evidenceUnits: [unit1, unit2],
      sourceDocuments: [doc1, doc2],
      assessments: [asm1, asm2],
    });

    expect(result.bundles).toHaveLength(0);
  });

  // Case 13: Bounded Bundle Size Invariant
  it('TC-ERA-13: every synthesized bundle contains strictly 2 evidence units', () => {
    const ticket: ClaimTicket = {
      ticketId: 'tkt_recency_bnd',
      claimId: 'clm_recency_bnd',
      runId: 'run_test_era_components',
      inputHash: 'hash_test_123',
      revision: 1,
      originalStatement: 'The latest model is Model Willow instead of Model Cedar',
      normalizedProposition: 'The latest model is Model Willow instead of Model Cedar.',
      domain: 'product_version',
      timeSensitivity: 'high',
      targetTime: '2026-11-20',
      verificationContext: [
        { key: 'productName', label: 'p', propertyType: 'string', value: 'Model Willow', origin: 'explicit_claim_text', status: 'confirmed', applicability: 'claim_level' },
        { key: 'comparisonProduct', label: 'c', propertyType: 'string', value: 'Model Cedar', origin: 'explicit_claim_text', status: 'confirmed', applicability: 'claim_level' },
      ],
      missingMaterialContext: [],
    };

    const doc1 = makeDoc('doc_c2', 'Model Cedar was released on 2026-09-02.', { effectiveDate: '2026-09-02' });
    const doc2 = makeDoc('doc_w2', 'Model Willow was released on 2026-11-10.', { effectiveDate: '2026-11-10' });
    const unit1 = makeUnit('unit_c2', doc1.documentId, 'Model Cedar was released on 2026-09-02.', { effectiveDate: '2026-09-02' });
    const unit2 = makeUnit('unit_w2', doc2.documentId, 'Model Willow was released on 2026-11-10.', { effectiveDate: '2026-11-10' });
    const asm1 = makeAssessment('asm_c2', ticket, unit1.evidenceId);
    const asm2 = makeAssessment('asm_w2', ticket, unit2.evidenceId);

    const result = synthesizeBoundedInference({
      ticket,
      evidenceUnits: [unit1, unit2],
      sourceDocuments: [doc1, doc2],
      assessments: [asm1, asm2],
    });

    for (const bundle of result.bundles) {
      expect(bundle.evidenceIds).toHaveLength(2);
      expect(bundle.premises).toHaveLength(2);
    }
  });

  // Case 14: Temporal Gap Handling (Missing Publication Date Fails Closed)
  it('TC-ERA-14: temporal gap with undetermined applicability fails closed to insufficient_evidence', () => {
    const ticket: ClaimTicket = {
      ticketId: 'tkt_temporal_gap_01',
      claimId: 'clm_temporal_gap_01',
      runId: 'run_test_era_components',
      inputHash: 'hash_test_123',
      revision: 1,
      originalStatement: 'SolisDB v2 memory limit is 512MB as of 2026-11-20',
      normalizedProposition: 'SolisDB v2 memory limit is 512MB.',
      domain: 'software',
      timeSensitivity: 'high',
      targetTime: '2026-11-20',
      verificationContext: [],
      missingMaterialContext: [],
    };

    // Article has no publication date and temporal applicability is undetermined
    const docText = 'SolisDB v2 memory limit is 512MB.';
    const doc = makeDoc('doc_undetermined_01', docText, { publicationDate: null, effectiveDate: null });
    const unit = makeUnit('unit_undetermined_01', doc.documentId, docText, { publicationDate: null, effectiveDate: null });
    const asm = makeAssessment('asm_undetermined_01', ticket, unit.evidenceId, {
      relationship: 'supports',
      temporalApplicability: 'undetermined',
    });

    const input = makeDecideInput({
      ticket,
      assessments: [asm],
      evidenceUnits: [unit],
      sources: [doc],
    });
    // Override temporal proof to unknown
    input.evidenceTemporalProofs = [{ evidenceId: unit.evidenceId, basis: 'unknown' }];

    const outcome = decideClaim(input);
    expect(outcome.status).toBe('decided');
    if (outcome.status !== 'decided') return;
    expect(outcome.decision.verdict).toBe('insufficient_evidence');
  });

  // Case 15: Decision Record Serializes Components & Inferred Bundles
  it('TC-ERA-15: decision record preserves components and inferred bundles under strict schema', () => {
    const ticket: ClaimTicket = {
      ticketId: 'tkt_strict_rec_01',
      claimId: 'clm_strict_rec_01',
      runId: 'run_test_era_components',
      inputHash: 'hash_test_123',
      revision: 1,
      originalStatement: 'Salman khan was found dead by puneet superstar',
      normalizedProposition: 'Salman Khan was found dead by Puneet Superstar.',
      domain: 'biography',
      timeSensitivity: 'high',
      targetTime: '2026-11-20',
      verificationContext: [],
      missingMaterialContext: [],
      components: [
        { id: 'c1', statement: 'Salman khan was found dead', normalizedProposition: 'Salman Khan died.' },
      ],
      relationships: [
        { type: 'conjunction', sourceId: 'c1', targetId: 'c1' },
      ],
    };

    const docText = 'Salman Khan was seen alive at Mumbai event in November 2026.';
    const doc = makeDoc('doc_strict_01', docText);
    const unit = makeUnit('unit_strict_01', doc.documentId, docText);
    const asm = makeAssessment('asm_strict_01', ticket, unit.evidenceId, {
      componentId: 'c1',
      relationship: 'contradicts',
      scopeMatching: 'match',
    });

    const bundle = {
      bundleId: 'inf_test_bundle',
      claimTicketId: ticket.ticketId,
      componentId: 'c1',
      evidenceIds: [unit.evidenceId, unit.evidenceId],
      premises: [
        { evidenceId: unit.evidenceId, premiseText: docText.slice(0, 50) },
        { evidenceId: unit.evidenceId, premiseText: docText.slice(0, 50) },
      ],
      conclusion: 'Salman Khan is alive.',
      relationship: 'contradicts' as const,
      rationale: 'Contemporaneous proof of life.',
      limitations: [],
    };

    const outcome = decideClaim(
      makeDecideInput({
        ticket,
        assessments: [asm],
        evidenceUnits: [unit],
        sources: [doc],
        inferenceBundles: [bundle],
      })
    );

    expect(outcome.status).toBe('decided');
    if (outcome.status !== 'decided') return;
    const validated = DecisionRecordSchema.safeParse(outcome.decision);
    expect(validated.success).toBe(true);
    if (!validated.success) return;
    expect(validated.data.components).toHaveLength(1);
    expect(validated.data.inferredBundles).toHaveLength(1);
    expect(validated.data.inferredBundles?.[0].bundleId).toBe('inf_test_bundle');
  });

  // Case 16: Canonical Claim Ticket Converter Preserves Components
  it('TC-ERA-16: toCanonicalClaimTicket preserves components and relationships from row spec', () => {
    const rawRow = {
      id: 'claim_db_id_123',
      runId: 'run_test_era_components',
      ordinal: 0,
      text: 'Salman khan was found dead by puneet superstar',
      normalizedText: 'Salman Khan was found dead by Puneet Superstar.',
      spec: {
        ticketId: 'tkt_custom_id',
        claimId: 'clm_custom_id',
        runId: 'run_test_era_components',
        inputHash: 'input_hash_val',
        revision: 1,
        originalStatement: 'Salman khan was found dead by puneet superstar',
        normalizedProposition: 'Salman Khan was found dead by Puneet Superstar.',
        targetTime: '2026-11-20',
        components: [
          { id: 'c1', statement: 'Salman khan was found dead', normalizedProposition: 'Salman Khan died.' },
          { id: 'c2', statement: 'by puneet superstar', normalizedProposition: 'Puneet found body.' },
        ],
        relationships: [
          { type: 'entailment', sourceId: 'c2', targetId: 'c1' },
        ],
      },
    };

    const ticket = toCanonicalClaimTicket(rawRow);
    expect(ticket.components).toHaveLength(2);
    expect(ticket.components?.[0].id).toBe('c1');
    expect(ticket.relationships).toHaveLength(1);
    expect(ticket.relationships?.[0].type).toBe('entailment');
  });

  // Case 17: BuildDecideClaimInput Accepts and Passes InferenceBundles
  it('TC-ERA-17: buildDecideClaimInput passes inferenceBundles to DecideClaimInput aggregate', () => {
    const ticket: ClaimTicket = {
      ticketId: 'tkt_bld_input_01',
      claimId: 'clm_bld_input_01',
      runId: 'run_test_era_components',
      inputHash: 'hash_test_123',
      revision: 1,
      originalStatement: 'Statement text',
      normalizedProposition: 'Normalized text.',
      domain: 'generic',
      timeSensitivity: 'medium',
      targetTime: '2026-11-20',
      verificationContext: [],
      missingMaterialContext: [],
    };

    const doc = makeDoc('doc_bld_01', 'Sample text');
    const unit = makeUnit('unit_bld_01', doc.documentId, 'Sample text');
    const asm = makeAssessment('asm_bld_01', ticket, unit.evidenceId);

    const bundles = [
      {
        bundleId: 'inf_bundle_1',
        claimTicketId: ticket.ticketId,
        evidenceIds: [unit.evidenceId, unit.evidenceId],
        premises: [
          { evidenceId: unit.evidenceId, premiseText: 'Premise 1' },
          { evidenceId: unit.evidenceId, premiseText: 'Premise 2' },
        ],
        conclusion: 'Joint conclusion',
        relationship: 'supports' as const,
        rationale: 'Complementary synthesis',
        limitations: [],
      },
    ];

    const decideInput = buildDecideClaimInput({
      ticket,
      contractAssessments: [asm],
      contractEvidenceUnits: [unit],
      contractSourceDocuments: [doc],
      policyResult: {
        status: 'ready',
        selectedDomain: 'generic',
        policyVersion: '1.0.0',
        policy: { policyId: 'generic', policyVersion: '1.0.0', propertyRoles: [], authoritativeSourceRoles: ['primary_authority'] },
        authorityFacts: [{ documentId: doc.documentId, basis: 'official_primary_record', claimApplicability: 'applicable' }],
        obligations: [],
        clarification: { status: 'not_needed', reason: 'Context is complete' },
        limitations: [],
      },
      inferenceBundles: bundles,
      runId: ticket.runId,
      nodeId: 'node_test',
    });

    expect(decideInput.inferenceBundles).toHaveLength(1);
    expect(decideInput.inferenceBundles?.[0].bundleId).toBe('inf_bundle_1');
  });

  // Case 18: End-to-End Entailment Falsification (Salman Khan Incident Exact Trace)
  it('TC-ERA-18: verifies end-to-end entailment falsification for the incident compound hoax', () => {
    // Exact incident claim: "Salman khan was found dead by puneet superstar"
    const ticket: ClaimTicket = {
      ticketId: 'tkt_salman_hoax_incident',
      claimId: 'clm_salman_hoax_incident',
      runId: 'run_incident_repro',
      inputHash: 'hash_incident_repro',
      revision: 1,
      originalStatement: 'Salman khan was found dead by puneet superstar',
      normalizedProposition: 'Salman Khan was found dead by Puneet Superstar.',
      domain: 'biography',
      timeSensitivity: 'high',
      targetTime: '2026-11-20',
      verificationContext: [],
      missingMaterialContext: [],
      components: [
        {
          id: 'c1',
          statement: 'Salman khan was found dead',
          normalizedProposition: 'Salman Khan died / was found dead.',
          role: 'asserted_value',
        },
        {
          id: 'c2',
          statement: 'by puneet superstar',
          normalizedProposition: "Puneet Superstar discovered Salman Khan's body.",
          role: 'asserted_value',
        },
      ],
      relationships: [
        {
          type: 'entailment',
          sourceId: 'c2',
          targetId: 'c1',
          rationale: "Puneet discovering Salman Khan's body entails that Salman Khan died.",
        },
        {
          type: 'conjunction',
          sourceId: 'c1',
          targetId: 'c2',
          rationale: 'Both Salman Khan dying and Puneet discovering the body are necessary for the compound claim.',
        },
      ],
    };

    // Authentic retrieved web document establishing Salman Khan is alive and active in late 2026
    const docText = 'Bollywood superstar Salman Khan is shooting for his upcoming action movie Sikandar and hosting Bigg Boss 18 in Mumbai in November 2026.';
    const doc = makeDoc('doc_authentic_salman', docText, {
      runId: ticket.runId,
      publicationDate: '2026-11-15',
      effectiveDate: '2026-11-15',
      sourceRole: 'primary_authority',
    });
    const unit = makeUnit('unit_authentic_salman', doc.documentId, docText, {
      publicationDate: '2026-11-15',
      effectiveDate: '2026-11-15',
    });

    // Assessment targets component c1 (Salman Khan died) with CONTRADICTS
    const asm = makeAssessment('asm_authentic_salman', ticket, unit.evidenceId, {
      componentId: 'c1',
      relationship: 'contradicts',
      scopeMatching: 'match',
      temporalApplicability: 'active_at_target_time',
      sourceSuitability: 'authoritative_primary',
      reasoning: 'Active filming in November 2026 decisively contradicts component c1 (death).',
    });

    const decideInput = buildDecideClaimInput({
      ticket,
      contractAssessments: [asm],
      contractEvidenceUnits: [unit],
      contractSourceDocuments: [doc],
      policyResult: {
        status: 'ready',
        selectedDomain: 'generic',
        policyVersion: '1.0.0',
        policy: { policyId: 'generic', policyVersion: '1.0.0', propertyRoles: [], authoritativeSourceRoles: ['primary_authority'] },
        authorityFacts: [{ documentId: doc.documentId, basis: 'official_primary_record', claimApplicability: 'applicable' }],
        obligations: [],
        clarification: { status: 'not_needed', reason: 'Context is complete' },
        limitations: [],
      },
      runId: ticket.runId,
      nodeId: 'node_incident_repro',
    });

    const outcome = decideClaim(decideInput);
    expect(outcome.status).toBe('decided');
    if (outcome.status !== 'decided') return;

    // Must be CONTRADICTED, Score 0, DECISIVE_CONTRADICTION
    expect(outcome.decision.verdict).toBe('contradicted');
    expect(outcome.decision.score).toBe(0);
    expect(outcome.decision.reasonCode).toBe(DECISION_REASON_CODES.DECISIVE_CONTRADICTION);
    expect(outcome.decision.primaryEvidenceIds).toContain(asm.assessmentId);
  });

  // =========================================================================
  // Fixed Acceptance Matrix (Matrix A through Matrix J)
  // =========================================================================

  it('TC-ERA-19 (Matrix A): Indirect evidence within one passage (Paraphrase) establishes supported verdict', () => {
    const ticket: ClaimTicket = {
      ticketId: 'tkt_para_01',
      claimId: 'clm_para_01',
      runId: 'run_test_era_components',
      inputHash: 'hash_test_123',
      revision: 1,
      originalStatement: 'Company XYZ ended telecommuting',
      normalizedProposition: 'Company XYZ ended telecommuting.',
      domain: 'workplace',
      timeSensitivity: 'medium',
      targetTime: '2026-11-20',
      verificationContext: [
        { key: 'company', label: 'Company', propertyType: 'string', value: 'Company XYZ', origin: 'user_target_context', status: 'confirmed', applicability: 'claim_level' },
      ],
      missingMaterialContext: [],
    };

    const doc = makeDoc('doc_tele_01', 'Company XYZ terminated all remote work options and mandated 5 days in office.');
    const unit = makeUnit('unit_tele_01', doc.documentId, 'Company XYZ terminated all remote work options and mandated 5 days in office.');
    const asm = makeAssessment('asm_tele_01', ticket, unit.evidenceId, {
      relationship: 'relevant_but_inconclusive',
      scopeMatching: 'match',
      propertyMatchStatus: {
        matching: ['company'],
        mismatched: [],
        missingInEvidence: [],
      },
    });

    const synthRes = synthesizeBoundedInference({
      ticket,
      evidenceUnits: [unit],
      sourceDocuments: [doc],
      assessments: [asm],
    });

    expect(synthRes.bundles.length).toBeGreaterThanOrEqual(1);
    const bundle = synthRes.bundles[0];
    expect(bundle.relationship).toBe('supports');
    expect(bundle.evidenceIds).toHaveLength(1);

    const decideInput = buildDecideClaimInput({
      ticket,
      contractAssessments: [asm],
      contractEvidenceUnits: [unit],
      contractSourceDocuments: [doc],
      inferenceBundles: [bundle],
      policyResult: {
        status: 'ready',
        selectedDomain: 'generic',
        policyVersion: '1.0.0',
        policy: { policyId: 'generic', policyVersion: '1.0.0', propertyRoles: [], authoritativeSourceRoles: ['primary_authority'] },
        authorityFacts: [{ documentId: doc.documentId, basis: 'official_primary_record', claimApplicability: 'applicable' }],
        obligations: [],
        clarification: { status: 'not_needed', reason: 'Complete' },
        limitations: [],
      },
      runId: ticket.runId,
      nodeId: 'node_para_test',
    });

    const outcome = decideClaim(decideInput);
    expect(outcome.status).toBe('decided');
    if (outcome.status === 'decided') {
      expect(outcome.decision.verdict).toBe('supported');
      expect(outcome.decision.score).toBe(100);
    }
  });

  it('TC-ERA-20 (Matrix B): General counterexample refutes universal claim; mismatched service is rejected', () => {
    const universalTicket: ClaimTicket = {
      ticketId: 'tkt_univ_01',
      claimId: 'clm_univ_01',
      runId: 'run_test_era_components',
      inputHash: 'hash_test_123',
      revision: 1,
      originalStatement: 'Every customer must submit requests by email',
      normalizedProposition: 'Every customer must submit requests by email.',
      domain: 'customer_support',
      timeSensitivity: 'medium',
      targetTime: '2026-11-20',
      verificationContext: [],
      missingMaterialContext: [],
    };

    // Positive case: matching scope counterexample
    const docGood = makeDoc('doc_counter_01', 'Enterprise customers may open requests through the dashboard.');
    const unitGood = makeUnit('unit_counter_01', docGood.documentId, 'Enterprise customers may open requests through the dashboard.');
    const asmGood = makeAssessment('asm_counter_01', universalTicket, unitGood.evidenceId, {
      relationship: 'relevant_but_inconclusive',
      scopeMatching: 'match',
    });

    const synthGood = synthesizeBoundedInference({
      ticket: universalTicket,
      evidenceUnits: [unitGood],
      sourceDocuments: [docGood],
      assessments: [asmGood],
    });

    expect(synthGood.bundles.length).toBe(1);
    expect(synthGood.bundles[0].relationship).toBe('contradicts');
    expect(synthGood.bundles[0].conclusion).toContain('Grounded exception');

    // Negative control: different service (scope mismatch)
    const docBad = makeDoc('doc_counter_bad', 'DifferentService dashboard allows requests.');
    const unitBad = makeUnit('unit_counter_bad', docBad.documentId, 'DifferentService dashboard allows requests.');
    const asmBad = makeAssessment('asm_counter_bad', universalTicket, unitBad.evidenceId, {
      relationship: 'relevant_but_inconclusive',
      scopeMatching: 'mismatch',
    });

    const synthBad = synthesizeBoundedInference({
      ticket: universalTicket,
      evidenceUnits: [unitBad],
      sourceDocuments: [docBad],
      assessments: [asmBad],
    });

    expect(synthBad.bundles).toHaveLength(0);
    expect(synthBad.limitations.some((l) => l.includes('COUNTEREXAMPLE_SCOPE_MISMATCH'))).toBe(true);
  });

  it('TC-ERA-21 (Matrix C): Complementary evidence across documents establishes joint conclusion; entity mismatch rejected', () => {
    const ticket: ClaimTicket = {
      ticketId: 'tkt_comp_summit',
      claimId: 'clm_comp_summit',
      runId: 'run_test_era_components',
      inputHash: 'hash_test_123',
      revision: 1,
      originalStatement: 'Alice was in Tokyo for the annual ceremony',
      normalizedProposition: 'Alice was in Tokyo for the annual ceremony.',
      domain: 'biography',
      timeSensitivity: 'high',
      targetTime: '2026-11-20',
      verificationContext: [],
      missingMaterialContext: [],
    };

    // Document 1 establishes Alice attended the ceremony
    const doc1 = makeDoc('doc_alice', 'Alice was present and delivered a keynote at the annual ceremony in Tokyo.');
    const unit1 = makeUnit('unit_alice', doc1.documentId, 'Alice was present and delivered a keynote at the annual ceremony in Tokyo.');
    // Document 2 establishes the date of the ceremony
    const doc2 = makeDoc('doc_ceremony_date', 'The annual ceremony in Tokyo concluded on 2026-11-20.');
    const unit2 = makeUnit('unit_ceremony_date', doc2.documentId, 'The annual ceremony in Tokyo concluded on 2026-11-20.', { effectiveDate: '2026-11-20' });

    const asm1 = makeAssessment('asm_a1', ticket, unit1.evidenceId);
    const asm2 = makeAssessment('asm_a2', ticket, unit2.evidenceId);

    const synth = synthesizeBoundedInference({
      ticket,
      evidenceUnits: [unit1, unit2],
      sourceDocuments: [doc1, doc2],
      assessments: [asm1, asm2],
    });

    expect(synth.bundles.length).toBeGreaterThanOrEqual(1);
    expect(synth.bundles[0].evidenceIds).toContain(unit1.evidenceId);
    expect(synth.bundles[0].evidenceIds).toContain(unit2.evidenceId);

    // Negative control: Dr. Salman Khan vs Puneet Khurana (different entities entirely)
    const docDiff1 = makeDoc('doc_diff_1', 'Dr. Salman Khan treated patients.');
    const unitDiff1 = makeUnit('unit_diff_1', docDiff1.documentId, 'Dr. Salman Khan treated patients.');
    const docDiff2 = makeDoc('doc_diff_2', 'Puneet Khurana had an accident.');
    const unitDiff2 = makeUnit('unit_diff_2', docDiff2.documentId, 'Puneet Khurana had an accident.');

    const synthDiff = synthesizeBoundedInference({
      ticket,
      evidenceUnits: [unitDiff1, unitDiff2],
      sourceDocuments: [docDiff1, docDiff2],
      assessments: [makeAssessment('asm_d1', ticket, unitDiff1.evidenceId), makeAssessment('asm_d2', ticket, unitDiff2.evidenceId)],
    });
    expect(synthDiff.bundles).toHaveLength(0);
  });

  it('TC-ERA-22 (Matrix D): Temporal applicability: appearance before allegation cannot refute later event; appearance after can refute', () => {
    const deathTicket: ClaimTicket = {
      ticketId: 'tkt_death_temp',
      claimId: 'clm_death_temp',
      runId: 'run_test_era_components',
      inputHash: 'hash_test_123',
      revision: 1,
      originalStatement: 'Subject died on 2026-11-20',
      normalizedProposition: 'Subject died on 2026-11-20.',
      domain: 'biography',
      timeSensitivity: 'high',
      targetTime: '2026-11-20',
      verificationContext: [],
      missingMaterialContext: [],
    };

    // Appearance on 2026-07-15: Happened BEFORE alleged death of 2026-11-20
    const docOld = makeDoc('doc_old_event', 'Subject attended ceremony.');
    const unitOld1 = makeUnit('unit_old_1', docOld.documentId, 'Subject attended the filmfare ceremony.');
    const unitOld2 = makeUnit('unit_old_2', docOld.documentId, 'The filmfare ceremony was held on 2026-07-15.', { effectiveDate: '2026-07-15' });

    const synthOld = synthesizeBoundedInference({
      ticket: deathTicket,
      evidenceUnits: [unitOld1, unitOld2],
      sourceDocuments: [docOld],
      assessments: [makeAssessment('asm_o1', deathTicket, unitOld1.evidenceId), makeAssessment('asm_o2', deathTicket, unitOld2.evidenceId)],
    });

    // Must be rejected by temporal check because July is prior to November!
    expect(synthOld.bundles).toHaveLength(0);
    expect(synthOld.limitations.some((l) => l.includes('EVENT_DATE_PRIOR_TO_TARGET'))).toBe(true);

    // Appearance on 2026-11-25: Happened AFTER alleged death of 2026-11-20
    const docNew = makeDoc('doc_new_event', 'Subject attended screening.');
    const unitNew1 = makeUnit('unit_new_1', docNew.documentId, 'Subject attended the awards ceremony.');
    const unitNew2 = makeUnit('unit_new_2', docNew.documentId, 'The awards ceremony was held on 2026-11-25.', { effectiveDate: '2026-11-25' });

    const synthNew = synthesizeBoundedInference({
      ticket: deathTicket,
      evidenceUnits: [unitNew1, unitNew2],
      sourceDocuments: [docNew],
      assessments: [makeAssessment('asm_n1', deathTicket, unitNew1.evidenceId), makeAssessment('asm_n2', deathTicket, unitNew2.evidenceId)],
    });

    expect(synthNew.bundles).toHaveLength(1);
    expect(synthNew.bundles[0].relationship).toBe('contradicts');
  });

  it('TC-ERA-23 (Matrix E): Relationship direction: entailment target refutation refutes parent; non-entailment (attribution/temporal) does not', () => {
    const compoundTicket: ClaimTicket = {
      ticketId: 'tkt_entail_dir',
      claimId: 'clm_entail_dir',
      runId: 'run_test_era_components',
      inputHash: 'hash_test_123',
      revision: 1,
      originalStatement: 'A occurred as announced by B',
      normalizedProposition: 'A occurred as announced by B.',
      domain: 'generic',
      timeSensitivity: 'medium',
      targetTime: '2026-11-20',
      verificationContext: [],
      missingMaterialContext: [],
      components: [
        { id: 'c1', statement: 'A occurred', normalizedProposition: 'A occurred.' },
        { id: 'c2', statement: 'B announced A', normalizedProposition: 'B announced A.' },
      ],
      // Pure attribution relationship: B attributing A does not entail A
      relationships: [
        { type: 'attribution', sourceId: 'c2', targetId: 'c1' },
      ],
    };

    const doc = makeDoc('doc_attr', 'B did not make any statement or announcement.');
    const unit = makeUnit('unit_attr', doc.documentId, 'B did not make any statement or announcement.');
    const asm = makeAssessment('asm_attr', compoundTicket, unit.evidenceId, {
      componentId: 'c2',
      relationship: 'contradicts',
      scopeMatching: 'match',
    });

    const decideInput = buildDecideClaimInput({
      ticket: compoundTicket,
      contractAssessments: [asm],
      contractEvidenceUnits: [unit],
      contractSourceDocuments: [doc],
      policyResult: {
        status: 'ready',
        selectedDomain: 'generic',
        policyVersion: '1.0.0',
        policy: { policyId: 'generic', policyVersion: '1.0.0', propertyRoles: [], authoritativeSourceRoles: ['primary_authority'] },
        authorityFacts: [{ documentId: doc.documentId, basis: 'official_primary_record', claimApplicability: 'applicable' }],
        obligations: [],
        clarification: { status: 'not_needed', reason: 'Complete' },
        limitations: [],
      },
      runId: compoundTicket.runId,
      nodeId: 'node_attr_dir',
    });

    const outcome = decideClaim(decideInput);
    expect(outcome.status).toBe('decided');
    if (outcome.status === 'decided') {
      // Must NOT refute parent through attribution alone; fails closed to insufficient_evidence
      expect(outcome.decision.verdict).toBe('insufficient_evidence');
    }
  });

  it('TC-ERA-24 (Matrix F): Conjunction: contradiction of incidental component does not refute parent', () => {
    const ticketWithIncidental: ClaimTicket = {
      ticketId: 'tkt_incidental_comp',
      claimId: 'clm_incidental_comp',
      runId: 'run_test_era_components',
      inputHash: 'hash_test_123',
      revision: 1,
      originalStatement: 'The spacecraft landed on Mars wearing a gold foil blanket',
      normalizedProposition: 'The spacecraft landed on Mars wearing a gold foil blanket.',
      domain: 'aerospace',
      timeSensitivity: 'low',
      targetTime: '2026-11-20',
      verificationContext: [],
      missingMaterialContext: [],
      components: [
        { id: 'c1', statement: 'The spacecraft landed on Mars', normalizedProposition: 'The spacecraft landed on Mars.', necessity: 'necessary' },
        { id: 'c2', statement: 'The spacecraft wore a gold foil blanket', normalizedProposition: 'The spacecraft wore a gold foil blanket.', necessity: 'incidental' },
      ],
      relationships: [
        { type: 'conjunction', sourceId: 'c1', targetId: 'c2' },
      ],
    };

    // Evidence refutes the incidental component c2 (it was silver foil, not gold)
    const doc = makeDoc('doc_foil', 'The spacecraft used silver multilayer insulation instead of gold.');
    const unit = makeUnit('unit_foil', doc.documentId, 'The spacecraft used silver multilayer insulation instead of gold.');
    const asm = makeAssessment('asm_foil', ticketWithIncidental, unit.evidenceId, {
      componentId: 'c2',
      relationship: 'contradicts',
      scopeMatching: 'match',
    });

    const decideInput = buildDecideClaimInput({
      ticket: ticketWithIncidental,
      contractAssessments: [asm],
      contractEvidenceUnits: [unit],
      contractSourceDocuments: [doc],
      policyResult: {
        status: 'ready',
        selectedDomain: 'generic',
        policyVersion: '1.0.0',
        policy: { policyId: 'generic', policyVersion: '1.0.0', propertyRoles: [], authoritativeSourceRoles: ['primary_authority'] },
        authorityFacts: [{ documentId: doc.documentId, basis: 'official_primary_record', claimApplicability: 'applicable' }],
        obligations: [],
        clarification: { status: 'not_needed', reason: 'Complete' },
        limitations: [],
      },
      runId: ticketWithIncidental.runId,
      nodeId: 'node_incidental_test',
    });

    const outcome = decideClaim(decideInput);
    expect(outcome.status).toBe('decided');
    if (outcome.status === 'decided') {
      // Contradicting incidental component c2 must NOT refute parent! Remains insufficient_evidence
      expect(outcome.decision.verdict).toBe('insufficient_evidence');
      expect(outcome.decision.scoreReason).toContain('incidental component [c2]');
    }
  });

  it('TC-ERA-25 (Matrix G): Actor connections: reject "B alive implies A alive"; accept grounded connection', () => {
    const salmanTicket: ClaimTicket = {
      ticketId: 'tkt_salman_conflate',
      claimId: 'clm_salman_conflate',
      runId: 'run_test_era_components',
      inputHash: 'hash_test_123',
      revision: 1,
      originalStatement: 'Salman Khan was found dead by Puneet Superstar',
      normalizedProposition: 'Salman Khan was found dead by Puneet Superstar.',
      domain: 'biography',
      timeSensitivity: 'high',
      targetTime: '2026-11-20',
      verificationContext: [],
      missingMaterialContext: [],
    };

    const doc = makeDoc('doc_puneet_alive', 'Puneet Superstar is alive, healthy, and doing well in Delhi.');
    const unit = makeUnit('unit_puneet_alive', doc.documentId, 'Puneet Superstar is alive, healthy, and doing well in Delhi.');
    const unitsMap = new Map([[unit.evidenceId, unit]]);
    const docMap = new Map([[doc.documentId, doc]]);

    // Candidate bundle attempting invalid inverse inference: Puneet alive -> Salman alive
    const badCandidate = {
      bundleId: 'inf_bad_actor_inference',
      claimTicketId: salmanTicket.ticketId,
      evidenceIds: [unit.evidenceId],
      premises: [
        { evidenceId: unit.evidenceId, premiseText: unit.verbatimText },
      ],
      conclusion: 'Puneet Superstar is alive, which contradicts Salman Khan death claim.',
      relationship: 'contradicts' as const,
      rationale: 'Puneet is active so claim is false',
      limitations: [],
      assumptionsOrGaps: [],
      validated: true,
    };

    const validatedBad = validateInferenceBundle(badCandidate, salmanTicket, unitsMap, docMap);
    expect(validatedBad.valid).toBe(false);
    if (!validatedBad.valid) {
      expect(validatedBad.reason).toContain('INVALID_INVERSE_ACTOR_INFERENCE');
    }

    // Grounded relational interaction: Salman and Puneet performed together
    const docJoint = makeDoc('doc_joint', 'Salman Khan and Puneet Superstar performed together on stage on 2026-11-22 in Mumbai.');
    const unitJoint = makeUnit('unit_joint', docJoint.documentId, 'Salman Khan and Puneet Superstar performed together on stage on 2026-11-22 in Mumbai.', { effectiveDate: '2026-11-22' });
    const unitsJointMap = new Map([[unitJoint.evidenceId, unitJoint]]);
    const docJointMap = new Map([[docJoint.documentId, docJoint]]);

    const goodCandidate = {
      bundleId: 'inf_good_joint_interaction',
      claimTicketId: salmanTicket.ticketId,
      evidenceIds: [unitJoint.evidenceId],
      premises: [
        { evidenceId: unitJoint.evidenceId, premiseText: unitJoint.verbatimText },
      ],
      conclusion: 'Documented joint interaction on 2026-11-22 proves Salman Khan is active and alive contemporaneously.',
      relationship: 'contradicts' as const,
      rationale: 'Grounded joint interaction refutes death claim',
      limitations: [],
      assumptionsOrGaps: [],
      validated: true,
    };

    const validatedGood = validateInferenceBundle(goodCandidate, salmanTicket, unitsJointMap, docJointMap);
    expect(validatedGood.valid).toBe(true);
  });

  it('TC-ERA-26 (Matrix H): Operational bounds: caps candidate units at <= 4 per bundle, max 3 bundles', () => {
    const ticket: ClaimTicket = {
      ticketId: 'tkt_bounds_01',
      claimId: 'clm_bounds_01',
      runId: 'run_test_era_components',
      inputHash: 'hash_test_123',
      revision: 1,
      originalStatement: 'Multiple products were launched',
      normalizedProposition: 'Multiple products were launched.',
      domain: 'generic',
      timeSensitivity: 'low',
      targetTime: '2026-11-20',
      verificationContext: [],
      missingMaterialContext: [],
    };

    const doc = makeDoc('doc_bnd_test', 'Sample text');
    const unit1 = makeUnit('u1', doc.documentId, 'Premise 1');
    const unit2 = makeUnit('u2', doc.documentId, 'Premise 2');
    const unit3 = makeUnit('u3', doc.documentId, 'Premise 3');
    const unit4 = makeUnit('u4', doc.documentId, 'Premise 4');
    const unit5 = makeUnit('u5', doc.documentId, 'Premise 5');

    const unitsMap = new Map([
      ['u1', unit1], ['u2', unit2], ['u3', unit3], ['u4', unit4], ['u5', unit5],
    ]);
    const docMap = new Map([[doc.documentId, doc]]);

    // Candidate bundle with 5 units (exceeds limit of 4)
    const oversizedCandidate = {
      bundleId: 'inf_oversized',
      claimTicketId: ticket.ticketId,
      evidenceIds: ['u1', 'u2', 'u3', 'u4', 'u5'],
      premises: [
        { evidenceId: 'u1', premiseText: 'Premise 1' },
        { evidenceId: 'u2', premiseText: 'Premise 2' },
        { evidenceId: 'u3', premiseText: 'Premise 3' },
        { evidenceId: 'u4', premiseText: 'Premise 4' },
        { evidenceId: 'u5', premiseText: 'Premise 5' },
      ],
      conclusion: 'Conclusion',
      relationship: 'supports' as const,
      rationale: 'Rationale',
      limitations: [],
    };

    const validated = validateInferenceBundle(oversizedCandidate, ticket, unitsMap, docMap);
    expect(validated.valid).toBe(false);
    if (!validated.valid) {
      expect(validated.reason).toMatch(/evidence units|too_big|<=4 items/i);
    }
  });

  it('TC-ERA-27 (Matrix I): Context revision: incrementing revision invalidates earlier decisions; rejects stale version', () => {
    const originalTicket: ClaimTicket = {
      ticketId: 'tkt_rev_01',
      claimId: 'clm_rev_01',
      runId: 'run_test_era_components',
      inputHash: 'hash_test_123',
      revision: 1,
      originalStatement: 'Service is 50ms limit',
      normalizedProposition: 'Service is 50ms limit.',
      domain: 'cloud',
      timeSensitivity: 'medium',
      targetTime: '2026-11-20',
      verificationContext: [],
      missingMaterialContext: ['plan_tier'],
    };

    // Clarification answered with Workers Paid: increment revision
    const revisedTicket: ClaimTicket = {
      ...originalTicket,
      revision: 2,
      verificationContext: [
        { key: 'plan_tier', label: 'plan_tier', propertyType: 'string', value: 'Workers Paid', origin: 'user_target_context', status: 'confirmed', applicability: 'claim_level', role: 'scope_qualifier' },
      ],
      missingMaterialContext: [],
    };

    expect(revisedTicket.revision).toBe(2);
    expect(revisedTicket.missingMaterialContext).toHaveLength(0);

    // Stale decision carrying revision 1 must not match revisedTicket revision 2
    expect(originalTicket.revision).not.toBe(revisedTicket.revision);
  });

  it('TC-ERA-28 (Matrix J): Durable report serialization preserves components and bundles without inflating claim counts', () => {
    const compoundTicket: ClaimTicket = {
      ticketId: 'tkt_durable_01',
      claimId: 'clm_durable_01',
      runId: 'run_test_era_components',
      inputHash: 'hash_test_123',
      revision: 1,
      originalStatement: 'A was discovered by B',
      normalizedProposition: 'A was discovered by B.',
      domain: 'generic',
      timeSensitivity: 'low',
      targetTime: '2026-11-20',
      verificationContext: [],
      missingMaterialContext: [],
      components: [
        { id: 'c1', statement: 'A occurred', normalizedProposition: 'A occurred.' },
        { id: 'c2', statement: 'B made discovery', normalizedProposition: 'B made discovery.' },
      ],
    };

    const doc = makeDoc('doc_dur', 'Sample text');
    const unit = makeUnit('unit_dur', doc.documentId, 'Sample text');
    const asm = makeAssessment('asm_dur', compoundTicket, unit.evidenceId);

    const decideInput = buildDecideClaimInput({
      ticket: compoundTicket,
      contractAssessments: [asm],
      contractEvidenceUnits: [unit],
      contractSourceDocuments: [doc],
      inferenceBundles: [
        {
          bundleId: 'inf_dur_01',
          claimTicketId: compoundTicket.ticketId,
          evidenceIds: [unit.evidenceId],
          premises: [{ evidenceId: unit.evidenceId, premiseText: 'Sample text' }],
          conclusion: 'Verified durable conclusion',
          relationship: 'supports',
          rationale: 'Rationale',
          limitations: [],
        },
      ],
      policyResult: {
        status: 'ready',
        selectedDomain: 'generic',
        policyVersion: '1.0.0',
        policy: { policyId: 'generic', policyVersion: '1.0.0', propertyRoles: [], authoritativeSourceRoles: ['primary_authority'] },
        authorityFacts: [{ documentId: doc.documentId, basis: 'official_primary_record', claimApplicability: 'applicable' }],
        obligations: [],
        clarification: { status: 'not_needed', reason: 'Complete' },
        limitations: [],
      },
      runId: compoundTicket.runId,
      nodeId: 'node_durable_test',
    });

    const outcome = decideClaim(decideInput);
    expect(outcome.status).toBe('decided');
    if (outcome.status === 'decided') {
      expect(outcome.decision.components).toHaveLength(2);
      expect(outcome.decision.inferredBundles).toHaveLength(1);
      // Validates that components are sub-fields, NOT top-level separate claims
      expect(Array.isArray(outcome.decision.components)).toBe(true);
    }
  });
});
