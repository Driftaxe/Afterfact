import { describe, expect, it } from 'vitest';
import {
  AtomicClaimSpec,
  validateClaimSpan,
} from '../../../src/lib/contracts/claim';
import {
  ClaimTicket,
  ClaimTicketSchema,
  createClaimTicketFromSpec,
  getContextProperty,
  resolveEffectiveContext,
  toAtomicClaimSpec,
  VerificationProperty,
  VerificationPropertySchema,
} from '../../../src/lib/contracts/claim-ticket';
import {
  ClarificationAnswersSubmission,
  ClarificationQuestion,
  ClarificationQuestionSchema,
  ClarificationQuestionSet,
  ClarificationQuestionSetSchema,
  validateClarificationAnswers,
} from '../../../src/lib/contracts/clarification';
import {
  PlannedQuery,
  ResearchPlan,
  ResearchPlanSchema,
} from '../../../src/lib/contracts/research';
import {
  ClaimEvidenceAssessment,
  ClaimEvidenceAssessmentSchema,
  EvidenceUnit,
  EvidenceUnitSchema,
  SourceDocument,
  SourceDocumentSchema,
  validateClaimEvidenceAssessmentReferences,
  validateEvidenceUnitAgainstSource,
} from '../../../src/lib/contracts/evidence-objects';
import {
  DecisionRecord,
  DecisionRecordSchema,
  SynthesisProposal,
  SynthesisProposalSchema,
  validateDecisionRecordReferences,
} from '../../../src/lib/contracts/decision';
import {
  computeMaxDagNodes,
  DagBudgetOptions,
  DagGraphSnapshot,
  DagGraphSnapshotSchema,
  DagNodeSpec,
  DagNodeSpecSchema,
  MAX_DAG_NODES_PER_RUN,
  MAX_NODES_PER_CLAIM_BRANCH,
  resolveEffectiveMaxDagNodes,
  RUN_OVERHEAD_DAG_NODES,
  SINGLE_CLAIM_MAX_DAG_NODES,
  SUPPORTED_MAX_CLAIMS_PER_RUN,
  sanitizePublicProgress,
  validateDagExpansion,
  validateDagGraph,
} from '../../../src/lib/contracts/dag';
import {
  StartPreparationActionInputSchema,
} from '../../../src/lib/contracts/actions';
import {
  AssessedClaimResultSchema,
  ReportSchema,
} from '../../../src/lib/contracts/report';
import {
  ClaimResultEventSchema,
} from '../../../src/lib/contracts/events';
import goldenReport from '../../../fixtures/golden-mixed-report.json';

describe('A10 Contract Layer Test Suite', () => {
  // =========================================================================
  // AC01 — Existing Compatibility
  // =========================================================================
  describe('AC01 — Existing Compatibility', () => {
    it('preserves existing report and claim validations without regressions', () => {
      // Golden full mixed report parses cleanly
      const parsedGolden = ReportSchema.parse(goldenReport);
      expect(parsedGolden.id).toBe('run_golden_fixture_mixed_001');

      // Golden minimal report validation
      const minimalReport = {
        id: 'rep_01j98ab7cd6ef8gh9jk01lmno2',
        ownerHash: 'usr_anon_abc123',
        state: 'completed' as const,
        mode: 'paste' as const,
        answerText: 'Stripe fee is 2.9% + 30c.',
        asOfDate: '2026-11-08',
        createdAt: '2026-11-08T00:00:00Z',
        latestSeq: 1,
        claims: [
          {
            id: 'res_01',
            claimId: 'clm_01j98ab8e1',
            ordinal: 0,
            rawText: 'Stripe fee is 2.9% + 30c.',
            state: 'assessed' as const,
            verdict: 'supported' as const,
            score: 100 as const,
            scoreReason: 'Confirmed by official Stripe documentation.',
            reasonCode: 'OFFICIAL_DOCUMENTATION_CONFIRMED',
            evidenceIds: ['evi_01'],
          },
        ],
        evidence: [
          {
            id: 'evi_01',
            url: 'https://stripe.com/pricing',
            passage: 'Stripe fee is 2.9% + 30c.',
            retrievedAt: '2026-11-08T00:00:00Z',
          },
        ],
        summary: {
          totalClaims: 1,
          supported: 1,
          outdated: 0,
          contradicted: 0,
          unresolved: 0,
        },
      };

      const parsed = ReportSchema.safeParse(minimalReport);
      expect(parsed.success).toBe(true);
    });
  });

  // =========================================================================
  // AC02 — Arbitrary-Domain Ticket
  // =========================================================================
  describe('AC02 — Arbitrary-Domain Ticket', () => {
    it('accepts synthetic unfamiliar-domain claim with typed properties', () => {
      // Unfamiliar domain: Deep Sea Archaeology
      const ticket: ClaimTicket = {
        ticketId: 'tkt_archaeo_01',
        claimId: 'clm_archaeo_01',
        runId: 'run_test_01',
        inputHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        revision: 1,
        originalStatement: 'The Antikythera wreck lies at a depth of 45 meters off Point Glyphadia.',
        sourceSpan: { start: 0, end: 72 },
        normalizedProposition: 'Antikythera shipwreck depth is 45 meters off Point Glyphadia.',
        domain: 'maritime_archaeology',
        targetTime: '2026-11-08',
        verificationContext: [
          {
            key: 'depthMeters',
            label: 'Excavation Depth',
            propertyType: 'number',
            value: 45,
            units: 'meters',
            origin: 'explicit_claim_text',
            sourceSpan: { start: 38, end: 47 },
            status: 'confirmed',
            applicability: 'claim_level',
          },
          {
            key: 'locationAnchor',
            label: 'Location Anchor',
            propertyType: 'string',
            value: 'Point Glyphadia',
            origin: 'explicit_claim_text',
            sourceSpan: { start: 56, end: 71 },
            status: 'confirmed',
            applicability: 'claim_level',
          },
          {
            key: 'isProtectedSite',
            label: 'Protected Cultural Heritage',
            propertyType: 'boolean',
            value: true,
            origin: 'model_inferred',
            status: 'pending_review',
            applicability: 'claim_level',
            confidence: 0.95,
          },
          {
            key: 'expeditionYears',
            label: 'Excavation Expedition Years',
            propertyType: 'string_list',
            value: ['1900', '1976', '2012', '2024'],
            origin: 'user_target_context',
            status: 'confirmed',
            applicability: 'claim_level',
          },
        ],
        missingMaterialContext: [],
      };

      const result = ClaimTicketSchema.safeParse(ticket);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.domain).toBe('maritime_archaeology');
        const depthProp = getContextProperty(result.data, 'depthMeters');
        expect(depthProp?.value).toBe(45);
      }
    });

    it('rejects a property whose value contradicts its declared type', () => {
      const badProperty = {
        key: 'depthMeters',
        label: 'Excavation Depth',
        propertyType: 'number' as const,
        value: 'forty-five', // Contradiction: string provided for number type
        origin: 'user_target_context' as const,
        status: 'confirmed' as const,
        applicability: 'claim_level' as const,
      };

      const result = VerificationPropertySchema.safeParse(badProperty);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toMatch(/Property declared as 'number'/);
      }
    });

    it('rejects non-finite numbers in number properties', () => {
      const badProperty = {
        key: 'coherenceTime',
        label: 'Quantum Coherence Time',
        propertyType: 'number' as const,
        value: Infinity,
        origin: 'user_target_context' as const,
        status: 'confirmed' as const,
        applicability: 'claim_level' as const,
      };

      const result = VerificationPropertySchema.safeParse(badProperty);
      expect(result.success).toBe(false);
    });
  });

  // =========================================================================
  // AC03 — Exact Source Anchoring
  // =========================================================================
  describe('AC03 — Exact Source Anchoring', () => {
    it('accepts a claim after an emoji with correct UTF-16 code unit offsets', () => {
      // 🚀 emoji is 2 UTF-16 code units (\uD83D\uDE80) + 1 space = offset 3
      const text = '🚀 Stripe charges 2.9% + 30 cents in the US.';
      const rawText = 'Stripe charges 2.9% + 30 cents in the US.';
      const startIndex = text.indexOf(rawText);
      expect(startIndex).toBe(3);
      expect(text.slice(startIndex, startIndex + rawText.length)).toBe(rawText);

      const spanResult = validateClaimSpan(text, { start: startIndex, end: startIndex + rawText.length }, rawText);
      expect(spanResult.valid).toBe(true);
      expect(spanResult.isHighlighted).toBe(true);
    });

    it('rejects an isolated offset mutation or altered quote', () => {
      const text = 'Stripe charges 2.9% + 30 cents.';
      const rawText = 'charges 2.9%';
      // Correct span: start 7, end 19
      expect(text.slice(7, 19)).toBe(rawText);

      // Mutated start offset
      const mutatedResult = validateClaimSpan(text, { start: 8, end: 19 }, rawText);
      expect(mutatedResult.valid).toBe(false);
      expect(mutatedResult.reason).toMatch(/slice does not match expected rawText/);

      // Altered expected text
      const alteredResult = validateClaimSpan(text, { start: 7, end: 19 }, 'charges 3.5%');
      expect(alteredResult.valid).toBe(false);
    });
  });

  // =========================================================================
  // AC04 — Context Provenance & Scope Precedence
  // =========================================================================
  describe('AC04 — Context Provenance & Scope Precedence', () => {
    it('accepts unknown context with explicit null value', () => {
      const unknownProp: VerificationProperty = {
        key: 'jurisdiction',
        label: 'Jurisdiction',
        propertyType: 'string',
        value: null,
        origin: 'unknown',
        status: 'clarification_needed',
        applicability: 'claim_level',
      };

      const result = VerificationPropertySchema.safeParse(unknownProp);
      expect(result.success).toBe(true);
    });

    it('rejects impossible known-value/unknown-origin combination', () => {
      const badProp = {
        key: 'jurisdiction',
        label: 'Jurisdiction',
        propertyType: 'string',
        value: 'US', // Contradiction: known value with unknown origin
        origin: 'unknown' as const,
        status: 'clarification_needed' as const,
        applicability: 'claim_level' as const,
      };

      const result = VerificationPropertySchema.safeParse(badProp);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toMatch(/Property with origin 'unknown' must have value null/);
      }
    });

    it('rejects explicit_claim_text origin lacking sourceSpan', () => {
      const badProp = {
        key: 'jurisdiction',
        label: 'Jurisdiction',
        propertyType: 'string',
        value: 'US',
        origin: 'explicit_claim_text' as const,
        sourceSpan: null, // Contradiction: explicit text qualifier must identify source span
        status: 'confirmed' as const,
        applicability: 'claim_level' as const,
      };

      const result = VerificationPropertySchema.safeParse(badProp);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toMatch(/requires a valid sourceSpan/);
      }
    });

    it('enforces Scope Precedence Invariant: explicit qualifier permanently overrides user target context', () => {
      const explicitQualifiers: VerificationProperty[] = [
        {
          key: 'jurisdiction',
          label: 'Jurisdiction',
          propertyType: 'string',
          value: 'UK',
          origin: 'explicit_claim_text',
          sourceSpan: { start: 0, end: 5 },
          status: 'confirmed',
          applicability: 'claim_level',
        },
      ];

      const userTargetContext: VerificationProperty[] = [
        {
          key: 'jurisdiction',
          label: 'Jurisdiction',
          propertyType: 'string',
          value: 'US', // Attempted override by user
          origin: 'user_target_context',
          status: 'confirmed',
          applicability: 'run_level',
        },
        {
          key: 'tier',
          label: 'Subscription Tier',
          propertyType: 'string',
          value: 'enterprise', // Non-conflicting user qualifier
          origin: 'user_target_context',
          status: 'confirmed',
          applicability: 'run_level',
        },
      ];

      const effective = resolveEffectiveContext(explicitQualifiers, userTargetContext);
      expect(effective).toHaveLength(2);

      const resolvedJurisdiction = effective.find((p) => p.key === 'jurisdiction');
      expect(resolvedJurisdiction?.value).toBe('UK'); // Explicit qualifier locked!
      expect(resolvedJurisdiction?.origin).toBe('explicit_claim_text');

      const resolvedTier = effective.find((p) => p.key === 'tier');
      expect(resolvedTier?.value).toBe('enterprise'); // User context filled in missing qualifier
    });
  });

  // =========================================================================
  // AC05 — Dynamic Questions
  // =========================================================================
  describe('AC05 — Dynamic Questions', () => {
    it('accepts valid examples of all five supported field types', () => {
      const validQuestions: ClarificationQuestion[] = [
        {
          questionId: 'q_select_01',
          propertyKey: 'subscriptionTier',
          prompt: 'Which Stripe pricing tier applies?',
          reason: 'Pricing varies between Standard and Custom enterprise plans.',
          fieldType: 'select',
          required: true,
          allowUnknown: true,
          options: [
            { value: 'standard', label: 'Standard' },
            { value: 'custom_enterprise', label: 'Custom Enterprise' },
          ],
        },
        {
          questionId: 'q_text_01',
          propertyKey: 'organizationName',
          prompt: 'Enter the exact non-profit entity name:',
          reason: 'Discounted non-profit rates require 501(c)(3) verification.',
          fieldType: 'short_text',
          required: false,
          allowUnknown: true,
          constraints: { maxLength: 50 },
        },
        {
          questionId: 'q_date_01',
          propertyKey: 'agreementDate',
          prompt: 'When was this agreement executed?',
          reason: 'Fee schedule changed on 2024-04-01.',
          fieldType: 'date',
          required: true,
          allowUnknown: true,
        },
        {
          questionId: 'q_number_01',
          propertyKey: 'monthlyVolume',
          prompt: 'What is the estimated monthly transaction volume in USD?',
          reason: 'Volume discounts activate at $100,000/mo.',
          fieldType: 'number',
          required: true,
          allowUnknown: true,
          constraints: { min: 0, max: 10000000, unit: 'USD' },
        },
        {
          questionId: 'q_boolean_01',
          propertyKey: 'isInternationalCard',
          prompt: 'Does this apply to cross-border international cards?',
          reason: 'Cross-border cards incur an additional 1.5% fee.',
          fieldType: 'boolean',
          required: true,
          allowUnknown: true,
        },
      ];

      const questionSet: ClarificationQuestionSet = {
        questionSetId: 'qset_01',
        runId: 'run_01',
        revision: 1,
        round: 1,
        questions: validQuestions,
      };

      const result = ClarificationQuestionSetSchema.safeParse(questionSet);
      expect(result.success).toBe(true);
    });

    it('rejects unsupported executable field definitions and script tags', () => {
      const injectedQuestion = {
        questionId: 'q_exploit_01',
        propertyKey: 'tier',
        prompt: '<script>alert("pwned")</script> Which tier?',
        reason: 'Legitimate reason',
        fieldType: 'short_text' as const,
        required: true,
        allowUnknown: true as const,
      };

      const result = ClarificationQuestionSchema.safeParse(injectedQuestion);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toMatch(/disallowed executable scripts/);
      }
    });

    it('rejects invalid constraints where min > max', () => {
      const invalidConstraintQuestion = {
        questionId: 'q_bad_constraint',
        propertyKey: 'volume',
        prompt: 'Volume?',
        reason: 'Reason',
        fieldType: 'number' as const,
        required: true,
        allowUnknown: true as const,
        constraints: { min: 100, max: 50 }, // min exceeds max
      };

      const result = ClarificationQuestionSchema.safeParse(invalidConstraintQuestion);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toMatch(/Constraint min cannot exceed max/);
      }
    });

    it('rejects question sets with duplicate question IDs', () => {
      const duplicateSet = {
        questionSetId: 'qset_dup',
        runId: 'run_01',
        revision: 1,
        round: 1,
        questions: [
          {
            questionId: 'q_same_id',
            propertyKey: 'tier',
            prompt: 'Tier 1?',
            reason: 'R1',
            fieldType: 'boolean' as const,
            required: true,
            allowUnknown: true as const,
          },
          {
            questionId: 'q_same_id', // Duplicate!
            propertyKey: 'tier',
            prompt: 'Tier 2?',
            reason: 'R2',
            fieldType: 'boolean' as const,
            required: true,
            allowUnknown: true as const,
          },
        ],
      };

      const result = ClarificationQuestionSetSchema.safeParse(duplicateSet);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toMatch(/Duplicate question ID/);
      }
    });
  });

  // =========================================================================
  // AC06 — Answer Binding & Validation
  // =========================================================================
  describe('AC06 — Answer Binding & Validation', () => {
    const canonicalQuestionSet: ClarificationQuestionSet = {
      questionSetId: 'qset_billing',
      runId: 'run_01j98ab7',
      revision: 1,
      round: 1,
      questions: [
        {
          questionId: 'q_tier',
          propertyKey: 'tier',
          prompt: 'Select billing plan:',
          reason: 'Determines rate',
          fieldType: 'select',
          required: true,
          allowUnknown: true,
          options: [
            { value: 'starter', label: 'Starter' },
            { value: 'pro', label: 'Pro' },
          ],
        },
        {
          questionId: 'q_volume',
          propertyKey: 'volume',
          prompt: 'Monthly transactions:',
          reason: 'Tier threshold',
          fieldType: 'number',
          required: true,
          allowUnknown: true,
          constraints: { min: 0, max: 100000 },
        },
      ],
    };

    it('accepts valid answers against stored question set and declares readiness', () => {
      const validSubmission: ClarificationAnswersSubmission = {
        questionSetId: 'qset_billing',
        runId: 'run_01j98ab7',
        revision: 1,
        answers: [
          { questionId: 'q_tier', value: 'pro' },
          { questionId: 'q_volume', value: 5000 },
        ],
      };

      const res = validateClarificationAnswers(canonicalQuestionSet, validSubmission);
      expect(res.valid).toBe(true);
      expect(res.issues).toHaveLength(0);
      expect(res.isReady).toBe(true);
    });

    it('rejects stale revision submission', () => {
      const staleSubmission: ClarificationAnswersSubmission = {
        questionSetId: 'qset_billing',
        runId: 'run_01j98ab7',
        revision: 0, // Stale!
        answers: [
          { questionId: 'q_tier', value: 'pro' },
          { questionId: 'q_volume', value: 5000 },
        ],
      };

      const res = validateClarificationAnswers(canonicalQuestionSet, staleSubmission);
      expect(res.valid).toBe(false);
      expect(res.issues.some((i) => i.message.includes('Stale clarification revision'))).toBe(true);
    });

    it('rejects unknown question ID and duplicate answers', () => {
      const invalidSubmission: ClarificationAnswersSubmission = {
        questionSetId: 'qset_billing',
        runId: 'run_01j98ab7',
        revision: 1,
        answers: [
          { questionId: 'q_tier', value: 'pro' },
          { questionId: 'q_tier', value: 'starter' }, // Duplicate!
          { questionId: 'q_hacked', value: 'injected' }, // Unknown!
        ],
      };

      const res = validateClarificationAnswers(canonicalQuestionSet, invalidSubmission);
      expect(res.valid).toBe(false);
      expect(res.issues.some((i) => i.message.includes('Duplicate answer'))).toBe(true);
      expect(res.issues.some((i) => i.message.includes('Unknown question ID'))).toBe(true);
    });

    it('rejects nonexistent select option and out-of-range number', () => {
      const badValuesSubmission: ClarificationAnswersSubmission = {
        questionSetId: 'qset_billing',
        runId: 'run_01j98ab7',
        revision: 1,
        answers: [
          { questionId: 'q_tier', value: 'ultra_secret_tier' }, // Nonexistent option
          { questionId: 'q_volume', value: 200000 }, // Exceeds max 100000
        ],
      };

      const res = validateClarificationAnswers(canonicalQuestionSet, badValuesSubmission);
      expect(res.valid).toBe(false);
      expect(res.issues.some((i) => i.message.includes('Nonexistent select option'))).toBe(true);
      expect(res.issues.some((i) => i.message.includes('exceeds maximum allowed value'))).toBe(true);
    });

    it('accepts explicit unknown without automatically declaring readiness', () => {
      const unknownSubmission: ClarificationAnswersSubmission = {
        questionSetId: 'qset_billing',
        runId: 'run_01j98ab7',
        revision: 1,
        answers: [
          { questionId: 'q_tier', value: 'pro' },
          { questionId: 'q_volume', value: null, isUnknown: true }, // Explicit "I don't know"
        ],
      };

      const res = validateClarificationAnswers(canonicalQuestionSet, unknownSubmission);
      expect(res.valid).toBe(true); // Structurally valid!
      expect(res.issues).toHaveLength(0);
      expect(res.isReady).toBe(false); // But NOT ready because required context is still missing!
    });

    it('rejects wrong answer types (string provided for number field)', () => {
      const wrongTypeSubmission: ClarificationAnswersSubmission = {
        questionSetId: 'qset_billing',
        runId: 'run_01j98ab7',
        revision: 1,
        answers: [
          { questionId: 'q_tier', value: 'pro' },
          { questionId: 'q_volume', value: 'ten_thousand' as unknown as number }, // Wrong type!
        ],
      };

      const res = validateClarificationAnswers(canonicalQuestionSet, wrongTypeSubmission);
      expect(res.valid).toBe(false);
      expect(res.issues.some((i) => i.message.includes('Expected finite number'))).toBe(true);
    });

    it('rejects missing required answers when required question is omitted', () => {
      const missingSubmission: ClarificationAnswersSubmission = {
        questionSetId: 'qset_billing',
        runId: 'run_01j98ab7',
        revision: 1,
        answers: [
          { questionId: 'q_tier', value: 'pro' },
          // q_volume (required) omitted!
        ],
      };

      const res = validateClarificationAnswers(canonicalQuestionSet, missingSubmission);
      expect(res.valid).toBe(false);
      expect(res.issues.some((i) => i.message.includes('Missing required answer for question: q_volume'))).toBe(true);
    });

    it('rejects question-set identity mismatch', () => {
      const mismatchedSubmission: ClarificationAnswersSubmission = {
        questionSetId: 'qset_different_set', // Mismatched ID!
        runId: 'run_01j98ab7',
        revision: 1,
        answers: [
          { questionId: 'q_tier', value: 'pro' },
          { questionId: 'q_volume', value: 5000 },
        ],
      };

      const res = validateClarificationAnswers(canonicalQuestionSet, mismatchedSubmission);
      expect(res.valid).toBe(false);
      expect(res.issues.some((i) => i.message.includes('Question set ID mismatch'))).toBe(true);
    });
  });

  // =========================================================================
  // AC07 — Research Plans
  // =========================================================================
  describe('AC07 — Research Plans', () => {
    it('accepts valid research plan with all epistemic query purposes', () => {
      const plan: ResearchPlan = {
        planId: 'plan_01j98ab7',
        claimTicketId: 'tkt_01',
        runId: 'run_01',
        revision: 1,
        round: 1,
        queries: [
          {
            queryId: 'q1',
            claimTicketId: 'tkt_01',
            query: 'Stripe US processing fees official pricing 2026',
            purpose: 'establish_current_state',
            targetSourceRoles: ['primary_authority'],
            round: 1,
          },
          {
            queryId: 'q2',
            claimTicketId: 'tkt_01',
            query: 'Stripe interchange plus enterprise fee exceptions',
            purpose: 'investigate_exceptions_or_scope',
            targetSourceRoles: ['primary_authority', 'official_changelog'],
            round: 1,
          },
          {
            queryId: 'q3',
            claimTicketId: 'tkt_01',
            query: 'Stripe fee increase price change deprecated rates',
            purpose: 'seek_counterevidence',
            targetSourceRoles: ['official_changelog', 'counter_perspective'],
            round: 1,
          },
          {
            queryId: 'q4',
            claimTicketId: 'tkt_01',
            query: 'Stripe 2022 pricing history transition',
            purpose: 'establish_historical_state_or_transition',
            targetSourceRoles: ['official_changelog', 'reputable_secondary'],
            round: 1,
          },
        ],
        materialUnknownQualifiers: ['effectiveDate'],
        stoppingConditions: ['Conclusive official documentation found'],
        requiresCounterevidenceQuery: true,
      };

      const result = ResearchPlanSchema.safeParse(plan);
      expect(result.success).toBe(true);
    });

    it('rejects plan exceeding maximum query budget (max 6)', () => {
      const tooManyQueries: PlannedQuery[] = Array.from({ length: 7 }, (_, i) => ({
        queryId: `q_${i}`,
        claimTicketId: 'tkt_01',
        query: `query string ${i}`,
        purpose: 'establish_current_state' as const,
        targetSourceRoles: ['primary_authority' as const],
        round: 1,
      }));

      const plan = {
        planId: 'plan_overflow',
        claimTicketId: 'tkt_01',
        runId: 'run_01',
        revision: 1,
        round: 1,
        queries: tooManyQueries,
        stoppingConditions: ['done'],
      };

      const result = ResearchPlanSchema.safeParse(plan);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toMatch(/cannot exceed configured budget of 6/);
      }
    });

    it('rejects plan requiring counterevidence when no counter query is provided', () => {
      const planWithoutCounter = {
        planId: 'plan_no_counter',
        claimTicketId: 'tkt_01',
        runId: 'run_01',
        revision: 1,
        round: 1,
        queries: [
          {
            queryId: 'q1',
            claimTicketId: 'tkt_01',
            query: 'Stripe pricing',
            purpose: 'establish_current_state' as const,
            targetSourceRoles: ['primary_authority' as const],
            round: 1,
          },
        ],
        stoppingConditions: ['done'],
        requiresCounterevidenceQuery: true, // Requires counter query!
      };

      const result = ResearchPlanSchema.safeParse(planWithoutCounter);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toMatch(/requires at least one query with purpose 'seek_counterevidence'/);
      }
    });

    it('accepts research plan without counterevidence query when not required', () => {
      // Reconciles authority: non-superlative, standard factual claims do not require counter queries
      const standardPlan: ResearchPlan = {
        planId: 'plan_standard_factual',
        claimTicketId: 'tkt_01',
        runId: 'run_01',
        revision: 1,
        round: 1,
        queries: [
          {
            queryId: 'q1',
            claimTicketId: 'tkt_01',
            query: 'Python 3.12 release date official documentation',
            purpose: 'establish_current_state',
            targetSourceRoles: ['primary_authority'],
            round: 1,
          },
        ],
        materialUnknownQualifiers: [],
        stoppingConditions: ['Release notes found'],
        requiresCounterevidenceQuery: false,
      };

      const result = ResearchPlanSchema.safeParse(standardPlan);
      expect(result.success).toBe(true);
    });
  });

  // =========================================================================
  // AC08 — Source Extraction States
  // =========================================================================
  describe('AC08 — Source Extraction States', () => {
    it('accepts a usable undated source and a clearly marked partial extraction', () => {
      const undatedSource: SourceDocument = {
        documentId: 'doc_undated_01',
        runId: 'run_01',
        url: 'https://stripe.com/pricing',
        finalUrl: 'https://stripe.com/pricing',
        title: 'Stripe Pricing',
        publisher: 'Stripe',
        retrievedContentHash: 'hash123',
        retrievedAt: '2026-11-08T00:00:00Z',
        rawText: 'Standard pricing: 2.9% + 30 cents per transaction.',
        extractionStatus: 'partial', // Partial extraction
        publicationDate: null,       // Undated source is valid!
        effectiveDate: null,
        sourceRole: 'primary_authority',
      };

      const result = SourceDocumentSchema.safeParse(undatedSource);
      expect(result.success).toBe(true);
    });

    it('rejects malformed HTTP URL protocols (file:, javascript:)', () => {
      const badUrlDoc = {
        documentId: 'doc_bad_url',
        runId: 'run_01',
        url: 'file:///etc/passwd',
        finalUrl: 'javascript:alert(1)',
        retrievedContentHash: 'hash123',
        retrievedAt: '2026-11-08T00:00:00Z',
        rawText: 'content',
        extractionStatus: 'success' as const,
        sourceRole: 'primary_authority' as const,
      };

      const result = SourceDocumentSchema.safeParse(badUrlDoc);
      expect(result.success).toBe(false);
    });

    it('rejects invalid success/failure combinations (failed status with rawText)', () => {
      const invalidFailedDoc = {
        documentId: 'doc_failed_with_text',
        runId: 'run_01',
        url: 'https://stripe.com/pricing',
        finalUrl: 'https://stripe.com/pricing',
        retrievedContentHash: 'hash123',
        retrievedAt: '2026-11-08T00:00:00Z',
        rawText: 'Some extracted content that should not be here on failed extraction',
        extractionStatus: 'failed' as const,
        failureReason: '404 Not Found',
        sourceRole: 'primary_authority' as const,
      };

      const result = SourceDocumentSchema.safeParse(invalidFailedDoc);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toMatch(/Failed extraction cannot have non-empty rawText/);
      }
    });
  });

  // =========================================================================
  // AC09 — Quote & Source Integrity
  // =========================================================================
  describe('AC09 — Quote & Source Integrity', () => {
    const validSource: SourceDocument = {
      documentId: 'doc_stripe_01',
      runId: 'run_01',
      url: 'https://stripe.com/us/pricing',
      finalUrl: 'https://stripe.com/us/pricing',
      retrievedContentHash: 'hash456',
      retrievedAt: '2026-11-08T00:00:00Z',
      rawText: 'Stripe Payments Pricing: 2.9% + 30¢ per successful card charge.',
      extractionStatus: 'success',
      sourceRole: 'primary_authority',
    };

    it('accepts exact passage from stored source representation', () => {
      const verbatim = '2.9% + 30¢ per successful card charge.';
      const start = validSource.rawText!.indexOf(verbatim);
      const end = start + verbatim.length;

      const unit: EvidenceUnit = {
        evidenceId: 'evi_01',
        documentId: 'doc_stripe_01',
        verbatimText: verbatim,
        locator: { charOffsetStart: start, charOffsetEnd: end },
        surroundingHeaders: ['Payments', 'Pricing'],
        footnotes: [],
        extractedProperties: [],
        extractionLimitations: [],
      };

      const validation = validateEvidenceUnitAgainstSource(validSource, unit);
      expect(validation.valid).toBe(true);
    });

    it('rejects dangling source reference and altered quote text', () => {
      const danglingUnit: EvidenceUnit = {
        evidenceId: 'evi_02',
        documentId: 'doc_unknown_99', // Dangling!
        verbatimText: '2.9% + 30¢',
        locator: {},
        surroundingHeaders: [],
        footnotes: [],
        extractedProperties: [],
        extractionLimitations: [],
      };

      const danglingRes = validateEvidenceUnitAgainstSource(validSource, danglingUnit);
      expect(danglingRes.valid).toBe(false);
      expect(danglingRes.reason).toMatch(/Dangling source reference/);

      const alteredQuoteUnit: EvidenceUnit = {
        evidenceId: 'evi_03',
        documentId: 'doc_stripe_01',
        verbatimText: '3.5% + 50¢ per successful card charge.', // Fabricated quote!
        locator: {},
        surroundingHeaders: [],
        footnotes: [],
        extractedProperties: [],
        extractionLimitations: [],
      };

      const alteredRes = validateEvidenceUnitAgainstSource(validSource, alteredQuoteUnit);
      expect(alteredRes.valid).toBe(false);
      expect(alteredRes.reason).toMatch(/does not contain verbatim text excerpt/);
    });
  });

  // =========================================================================
  // AC10 — Assessment Relationships
  // =========================================================================
  describe('AC10 — Assessment Relationships', () => {
    it('accepts support with scope match and unknown temporal applicability', () => {
      const assessment: ClaimEvidenceAssessment = {
        assessmentId: 'asm_01',
        claimTicketId: 'tkt_01',
        claimRevision: 1,
        evidenceId: 'evi_01',
        relationship: 'supports',
        scopeMatching: 'match',
        quotationVerified: true,
        propertyMatchStatus: {
          matching: ['jurisdiction', 'feePercent'],
          mismatched: [],
          missingInEvidence: [],
        },
        temporalApplicability: 'undetermined', // Unknown applicability is permitted
        sourceSuitability: 'authoritative_primary',
        reasoning: 'Primary vendor documentation explicitly verifies fee rate.',
      };

      const result = ClaimEvidenceAssessmentSchema.safeParse(assessment);
      expect(result.success).toBe(true);
    });

    it('does not allow arbitrary strings for scopeMatching (strictly match, mismatch, unknown)', () => {
      const badAssessment = {
        assessmentId: 'asm_bad_scope',
        claimTicketId: 'tkt_01',
        claimRevision: 1,
        evidenceId: 'evi_01',
        relationship: 'supports' as const,
        scopeMatching: 'assumed_match', // Illegal scope matching string
        quotationVerified: true,
        propertyMatchStatus: { matching: [], mismatched: [], missingInEvidence: [] },
        temporalApplicability: 'active_at_target_time' as const,
        sourceSuitability: 'authoritative_primary' as const,
        reasoning: 'Reason',
      };

      const result = ClaimEvidenceAssessmentSchema.safeParse(badAssessment);
      expect(result.success).toBe(false);
    });

    it('rejects dangling evidence references and incorrect claim/context revision at the aggregate boundary', () => {
      const claim: ClaimTicket = {
        ticketId: 'tkt_ref_01',
        claimId: 'clm_ref_01',
        runId: 'run_ref_01',
        inputHash: 'hash_01',
        revision: 2, // Claim is at revision 2!
        originalStatement: 'Statement text',
        normalizedProposition: 'Normalized statement',
        domain: 'generic',
        targetTime: '2026-11-08',
        verificationContext: [],
        missingMaterialContext: [],
      };

      const evidence: EvidenceUnit = {
        evidenceId: 'evi_known_01',
        documentId: 'doc_known_01',
        verbatimText: 'Exact excerpt',
        locator: {},
        surroundingHeaders: [],
        footnotes: [],
        extractedProperties: [],
        extractionLimitations: [],
      };

      const validAssessment: ClaimEvidenceAssessment = {
        assessmentId: 'asm_01',
        claimTicketId: 'tkt_ref_01',
        claimRevision: 2,
        evidenceId: 'evi_known_01',
        relationship: 'supports',
        scopeMatching: 'match',
        quotationVerified: true,
        propertyMatchStatus: { matching: [], mismatched: [], missingInEvidence: [] },
        temporalApplicability: 'active_at_target_time',
        sourceSuitability: 'authoritative_primary',
        reasoning: 'Verified',
      };

      // Valid references pass
      const validRes = validateClaimEvidenceAssessmentReferences(validAssessment, claim, evidence);
      expect(validRes.valid).toBe(true);

      // 1. Dangling evidence reference rejected
      const danglingAsm = { ...validAssessment, evidenceId: 'evi_ghost_999' };
      const danglingRes = validateClaimEvidenceAssessmentReferences(danglingAsm, claim, evidence);
      expect(danglingRes.valid).toBe(false);
      expect(danglingRes.reason).toMatch(/Dangling evidence reference/);

      // 2. Incorrect / stale claim revision rejected
      const staleAsm = { ...validAssessment, claimRevision: 1 }; // Stale revision 1 vs claim revision 2
      const staleRes = validateClaimEvidenceAssessmentReferences(staleAsm, claim, evidence);
      expect(staleRes.valid).toBe(false);
      expect(staleRes.reason).toMatch(/Claim revision mismatch/);

      // 3. Mismatched claim ID rejected
      const wrongClaimAsm = { ...validAssessment, claimTicketId: 'tkt_alien_999' };
      const wrongClaimRes = validateClaimEvidenceAssessmentReferences(wrongClaimAsm, claim, evidence);
      expect(wrongClaimRes.valid).toBe(false);
      expect(wrongClaimRes.reason).toMatch(/Claim ticket mismatch/);
    });
  });

  // =========================================================================
  // AC11 — Decision Parity & Categorical Score Rubric
  // =========================================================================
  describe('AC11 — Decision Parity & Categorical Score Rubric', () => {
    const baseDecision = {
      recordId: 'dec_01',
      claimTicketId: 'tkt_01',
      claimRevision: 1,
      appliedPolicy: 'pricing_v1',
      scoreReason: 'Grounding verified by official documentation.',
      reasonCode: 'OFFICIAL_DOCUMENTATION_CONFIRMED',
      primaryEvidenceIds: ['asm_01'],
      counterEvidenceIds: [],
      excludedEvidence: [],
      extractedQualifiers: [],
      temporalBasis: { targetTime: '2026-11-08' },
      limitations: [],
      traceIds: {},
    };

    it('accepts supported+100 and supported+75', () => {
      const supported100 = { ...baseDecision, verdict: 'supported' as const, score: 100 as const };
      const supported75 = { ...baseDecision, verdict: 'supported' as const, score: 75 as const };

      expect(DecisionRecordSchema.safeParse(supported100).success).toBe(true);
      expect(DecisionRecordSchema.safeParse(supported75).success).toBe(true);
    });

    it('accepts outdated+0 and contradicted+0', () => {
      const outdated0 = { ...baseDecision, verdict: 'outdated' as const, score: 0 as const };
      const contradicted0 = { ...baseDecision, verdict: 'contradicted' as const, score: 0 as const };

      expect(DecisionRecordSchema.safeParse(outdated0).success).toBe(true);
      expect(DecisionRecordSchema.safeParse(contradicted0).success).toBe(true);
    });

    it('accepts unresolved verdicts with score null', () => {
      const unresolvedNull = {
        ...baseDecision,
        verdict: 'depends_on_context' as const,
        score: null,
        primaryEvidenceIds: [], // Unresolved does not require primary evidence
      };

      expect(DecisionRecordSchema.safeParse(unresolvedNull).success).toBe(true);
    });

    it('rejects invalid verdict/score combinations: supported+42, outdated+null, unresolved+0', () => {
      const supported42 = { ...baseDecision, verdict: 'supported' as const, score: 42 as unknown as 100 };
      const outdatedNull = { ...baseDecision, verdict: 'outdated' as const, score: null };
      const unresolved0 = {
        ...baseDecision,
        verdict: 'depends_on_context' as const,
        score: 0 as unknown as null,
        primaryEvidenceIds: [],
      };

      expect(DecisionRecordSchema.safeParse(supported42).success).toBe(false);
      expect(DecisionRecordSchema.safeParse(outdatedNull).success).toBe(false);
      expect(DecisionRecordSchema.safeParse(unresolved0).success).toBe(false);
    });

    it('enforces identical score rubric parity across all affected public boundaries (DecisionRecord, AssessedClaimResult, ClaimResultEvent)', () => {
      // 1. AssessedClaimResult boundary (from report.ts)
      const baseClaimResult = {
        id: 'res_audit_01',
        claimId: 'clm_01',
        ordinal: 0,
        rawText: 'Text',
        state: 'assessed' as const,
        scoreReason: 'Grounding verified.',
        reasonCode: 'VERIFIED',
        evidenceIds: ['evi_01'],
      };

      // Valid combinations pass AssessedClaimResult
      expect(AssessedClaimResultSchema.safeParse({ ...baseClaimResult, verdict: 'supported', score: 100 }).success).toBe(true);
      expect(AssessedClaimResultSchema.safeParse({ ...baseClaimResult, verdict: 'supported', score: 75 }).success).toBe(true);
      expect(AssessedClaimResultSchema.safeParse({ ...baseClaimResult, verdict: 'outdated', score: 0 }).success).toBe(true);
      expect(AssessedClaimResultSchema.safeParse({ ...baseClaimResult, verdict: 'contradicted', score: 0 }).success).toBe(true);
      expect(AssessedClaimResultSchema.safeParse({ ...baseClaimResult, verdict: 'depends_on_context', score: null }).success).toBe(true);

      // Invalid combinations fail AssessedClaimResult
      expect(AssessedClaimResultSchema.safeParse({ ...baseClaimResult, verdict: 'supported', score: 42 as unknown as 100 }).success).toBe(false);
      expect(AssessedClaimResultSchema.safeParse({ ...baseClaimResult, verdict: 'outdated', score: null }).success).toBe(false);
      expect(AssessedClaimResultSchema.safeParse({ ...baseClaimResult, verdict: 'depends_on_context', score: 0 as unknown as null }).success).toBe(false);

      // 2. ClaimResultEvent boundary (from events.ts)
      const baseEvent = {
        type: 'claim_result' as const,
        runId: 'run_audit_01',
        seq: 5,
        claimId: 'clm_01',
        scoreReason: 'Grounding verified.',
        reasonCode: 'VERIFIED',
        timestamp: '2026-11-08T00:00:00Z',
      };

      // Valid combinations pass ClaimResultEvent
      expect(ClaimResultEventSchema.safeParse({ ...baseEvent, verdict: 'supported', score: 100 }).success).toBe(true);
      expect(ClaimResultEventSchema.safeParse({ ...baseEvent, verdict: 'supported', score: 75 }).success).toBe(true);
      expect(ClaimResultEventSchema.safeParse({ ...baseEvent, verdict: 'outdated', score: 0 }).success).toBe(true);
      expect(ClaimResultEventSchema.safeParse({ ...baseEvent, verdict: 'contradicted', score: 0 }).success).toBe(true);
      expect(ClaimResultEventSchema.safeParse({ ...baseEvent, verdict: 'conflicting_evidence', score: null }).success).toBe(true);

      // Invalid combinations fail ClaimResultEvent
      expect(ClaimResultEventSchema.safeParse({ ...baseEvent, verdict: 'supported', score: 42 as unknown as 100 }).success).toBe(false);
      expect(ClaimResultEventSchema.safeParse({ ...baseEvent, verdict: 'outdated', score: null }).success).toBe(false);
      expect(ClaimResultEventSchema.safeParse({ ...baseEvent, verdict: 'conflicting_evidence', score: 0 as unknown as null }).success).toBe(false);
    });
  });

  // =========================================================================
  // AC12 — Proposal / Final Decision Separation
  // =========================================================================
  describe('AC12 — Proposal / Final Decision Separation', () => {
    it('accepts an unresolved research proposal without treating it as a final decision', () => {
      const proposal: SynthesisProposal = {
        proposalId: 'prop_01',
        claimTicketId: 'tkt_01',
        claimRevision: 1,
        recommendedVerdict: 'depends_on_context',
        recommendedScore: null,
        citedAssessmentIds: ['asm_01'],
        opposingAssessmentIds: [],
        unresolvedConflicts: ['Unclear whether UK or US entity applies'],
        requestsAdditionalResearch: false,
        requestsClarification: true,
        rationale: 'Pricing differs significantly by country jurisdiction.',
        limitations: [],
      };

      // Parses cleanly as SynthesisProposal
      const parsedProposal = SynthesisProposalSchema.safeParse(proposal);
      expect(parsedProposal.success).toBe(true);

      // Must NOT parse as DecisionRecord (fails missing required terminal decision fields)
      const parsedAsDecision = DecisionRecordSchema.safeParse(proposal);
      expect(parsedAsDecision.success).toBe(false);
    });

    it('validates referential integrity: rejects DecisionRecord with wrong-revision assessment', () => {
      const testClaim: ClaimTicket = {
        ticketId: 'tkt_01',
        claimId: 'clm_01',
        runId: 'run_01',
        inputHash: 'hash',
        revision: 2, // Claim is at revision 2!
        originalStatement: 'Statement',
        normalizedProposition: 'Statement',
        domain: 'generic',
        targetTime: '2026-11-08',
        verificationContext: [],
        missingMaterialContext: [],
      };

      const testEvidenceUnit: EvidenceUnit = {
        evidenceId: 'evi_01',
        documentId: 'doc_01',
        verbatimText: 'Statement text',
        locator: {},
        surroundingHeaders: [],
        footnotes: [],
        extractedProperties: [],
        extractionLimitations: [],
      };

      const staleAssessment: ClaimEvidenceAssessment = {
        assessmentId: 'asm_01',
        claimTicketId: 'tkt_01',
        claimRevision: 1, // Stale revision 1!
        evidenceId: 'evi_01',
        relationship: 'supports',
        scopeMatching: 'match',
        quotationVerified: true,
        propertyMatchStatus: { matching: [], mismatched: [], missingInEvidence: [] },
        temporalApplicability: 'active_at_target_time',
        sourceSuitability: 'authoritative_primary',
        reasoning: 'Reason',
      };

      const decision: DecisionRecord = {
        recordId: 'dec_01',
        claimTicketId: 'tkt_01',
        claimRevision: 2,
        appliedPolicy: 'pricing',
        verdict: 'supported',
        score: 100,
        reasonCode: 'CONFIRMED',
        scoreReason: 'Confirmed',
        primaryEvidenceIds: ['asm_01'],
        counterEvidenceIds: [],
        excludedEvidence: [],
        extractedQualifiers: [],
        temporalBasis: { targetTime: '2026-11-08' },
        limitations: [],
        traceIds: {},
      };

      const res = validateDecisionRecordReferences(
        decision,
        [staleAssessment],
        [testEvidenceUnit],
        [testClaim]
      );
      expect(res.valid).toBe(false);
      expect(res.reason).toMatch(/evaluated revision 1, not decision revision 2/);
    });
  });

  // =========================================================================
  // AC13 — Vector Boundary
  // =========================================================================
  describe('AC13 — Vector Boundary', () => {
    it('rejects vector similarity score injected into final DecisionRecord', () => {
      const vectorContaminatedDecision = {
        recordId: 'dec_01',
        claimTicketId: 'tkt_01',
        claimRevision: 1,
        appliedPolicy: 'pricing',
        verdict: 'supported' as const,
        score: 100 as const,
        reasonCode: 'CONFIRMED',
        scoreReason: 'Confirmed',
        primaryEvidenceIds: ['asm_01'],
        counterEvidenceIds: [],
        excludedEvidence: [],
        extractedQualifiers: [],
        temporalBasis: { targetTime: '2026-11-08' },
        limitations: [],
        traceIds: {},
        vectorSimilarity: 0.98, // Illegal field injection!
        embeddingConfidence: 0.95,
      };

      const result = DecisionRecordSchema.safeParse(vectorContaminatedDecision);
      expect(result.success).toBe(false);
    });
  });

  // =========================================================================
  // AC14 — DAG Structure & Cycle Detection
  // =========================================================================
  describe('AC14 — DAG Structure & Cycle Detection', () => {
    it('accepts a valid branching and joining DAG graph', () => {
      // root -> (plan1, plan2) -> search -> finalize
      const graph: DagGraphSnapshot = {
        runId: 'run_dag_01',
        revision: 1,
        nodes: [
          {
            id: 'n_root',
            runId: 'run_dag_01',
            stage: 'root_extract_prep',
            state: 'completed',
            dependencies: [],
            attempt: 1,
            outputReference: { claimsExtracted: 2 },
          },
          {
            id: 'n_plan1',
            runId: 'run_dag_01',
            stage: 'plan_research',
            state: 'completed',
            dependencies: ['n_root'],
            attempt: 1,
            outputReference: { planId: 'p1' },
          },
          {
            id: 'n_plan2',
            runId: 'run_dag_01',
            stage: 'plan_research',
            state: 'completed',
            dependencies: ['n_root'],
            attempt: 1,
            outputReference: { planId: 'p2' },
          },
          {
            id: 'n_finalize',
            runId: 'run_dag_01',
            stage: 'finalize_run',
            state: 'pending',
            dependencies: ['n_plan1', 'n_plan2'], // Joining branch
            attempt: 0,
          },
        ],
      };

      const validation = validateDagGraph(graph);
      expect(validation.valid).toBe(true);
    });

    it('rejects duplicate nodes and missing dependencies', () => {
      const dupGraph: DagGraphSnapshot = {
        runId: 'run_dag_02',
        revision: 1,
        nodes: [
          {
            id: 'n_dup',
            runId: 'run_dag_02',
            stage: 'plan_research',
            state: 'pending',
            dependencies: [],
            attempt: 0,
          },
          {
            id: 'n_dup', // Duplicate ID!
            runId: 'run_dag_02',
            stage: 'plan_research',
            state: 'pending',
            dependencies: [],
            attempt: 0,
          },
        ],
      };

      const dupRes = validateDagGraph(dupGraph);
      expect(dupRes.valid).toBe(false);
      expect(dupRes.error).toMatch(/Duplicate node ID/);

      const missingDepGraph: DagGraphSnapshot = {
        runId: 'run_dag_03',
        revision: 1,
        nodes: [
          {
            id: 'n_orphan',
            runId: 'run_dag_03',
            stage: 'plan_research',
            state: 'pending',
            dependencies: ['n_ghost'], // Nonexistent dependency
            attempt: 0,
          },
        ],
      };

      const missingRes = validateDagGraph(missingDepGraph);
      expect(missingRes.valid).toBe(false);
      expect(missingRes.error).toMatch(/depends on unknown node 'n_ghost'/);
    });

    it('rejects self-edges and multi-node directed cycles', () => {
      const selfEdgeGraph: DagGraphSnapshot = {
        runId: 'run_dag_04',
        revision: 1,
        nodes: [
          {
            id: 'n_loop',
            runId: 'run_dag_04',
            stage: 'plan_research',
            state: 'pending',
            dependencies: ['n_loop'], // Self-dependency!
            attempt: 0,
          },
        ],
      };

      const selfRes = validateDagGraph(selfEdgeGraph);
      expect(selfRes.valid).toBe(false);
      expect(selfRes.error).toMatch(/Self-dependency detected/);

      // Multi-node cycle: A -> B -> C -> A
      const cycleGraph: DagGraphSnapshot = {
        runId: 'run_dag_05',
        revision: 1,
        nodes: [
          {
            id: 'nA',
            runId: 'run_dag_05',
            stage: 'plan_research',
            state: 'pending',
            dependencies: ['nC'],
            attempt: 0,
          },
          {
            id: 'nB',
            runId: 'run_dag_05',
            stage: 'plan_research',
            state: 'pending',
            dependencies: ['nA'],
            attempt: 0,
          },
          {
            id: 'nC',
            runId: 'run_dag_05',
            stage: 'plan_research',
            state: 'pending',
            dependencies: ['nB'],
            attempt: 0,
          },
        ],
      };

      const cycleRes = validateDagGraph(cycleGraph);
      expect(cycleRes.valid).toBe(false);
      expect(cycleRes.error).toMatch(/Directed cycle detected/);
    });

    it('rejects proposed dynamic expansion that introduces a cycle into the combined graph', () => {
      const existingGraph: DagGraphSnapshot = {
        runId: 'run_expand_01',
        revision: 1,
        nodes: [
          {
            id: 'n1',
            runId: 'run_expand_01',
            stage: 'root_extract_prep',
            state: 'completed',
            dependencies: [],
            attempt: 1,
            outputReference: { ok: true },
          },
          {
            id: 'n2',
            runId: 'run_expand_01',
            stage: 'plan_research',
            state: 'completed',
            dependencies: ['n1'],
            attempt: 1,
            outputReference: { ok: true },
          },
        ],
      };

      // Proposed nodes introduce a cycle between themselves while linking to existing n2
      const badProposedNodes: DagNodeSpec[] = [
        {
          id: 'n3',
          runId: 'run_expand_01',
          stage: 'assess_evidence',
          state: 'pending',
          dependencies: ['n2', 'n4'],
          attempt: 0,
        },
        {
          id: 'n4',
          runId: 'run_expand_01',
          stage: 'plan_research',
          state: 'pending',
          dependencies: ['n3'], // n3 -> n4 -> n3 cycle!
          attempt: 0,
        },
      ];

      const cycleExpansion = validateDagExpansion(existingGraph, badProposedNodes);
      expect(cycleExpansion.valid).toBe(false);
      expect(cycleExpansion.error).toMatch(/Directed cycle detected/);
    });
  });

  // =========================================================================
  // AC15 — DAG Identity & States
  // =========================================================================
  describe('AC15 — DAG Identity & States', () => {
    it('rejects cross-run references in graph nodes', () => {
      const crossRunGraph: DagGraphSnapshot = {
        runId: 'run_alpha',
        revision: 1,
        nodes: [
          {
            id: 'node_alpha',
            runId: 'run_alpha',
            stage: 'root_extract_prep',
            state: 'completed',
            dependencies: [],
            attempt: 1,
            outputReference: { ok: true },
          },
          {
            id: 'node_beta',
            runId: 'run_beta_alien', // Different run ID!
            stage: 'plan_research',
            state: 'pending',
            dependencies: [],
            attempt: 0,
          },
        ],
      };

      const res = validateDagGraph(crossRunGraph);
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/Cross-run reference detected/);
    });

    it('requires outputReference on completed state and error on failed state', () => {
      const completedWithoutOutput = {
        id: 'n_comp',
        runId: 'run_01',
        stage: 'plan_research' as const,
        state: 'completed' as const,
        dependencies: [],
        attempt: 1,
        outputReference: null, // Illegal!
      };

      expect(DagNodeSpecSchema.safeParse(completedWithoutOutput).success).toBe(false);

      const failedWithoutError = {
        id: 'n_fail',
        runId: 'run_01',
        stage: 'plan_research' as const,
        state: 'failed' as const,
        dependencies: [],
        attempt: 3,
        error: null, // Illegal!
      };

      expect(DagNodeSpecSchema.safeParse(failedWithoutError).success).toBe(false);
    });

    it('requires leaseToken to be null when node is in waiting_for_input state', () => {
      const waitingWithLease = {
        id: 'n_wait',
        runId: 'run_01',
        stage: 'clarification_wait' as const,
        state: 'waiting_for_input' as const,
        dependencies: [],
        attempt: 1,
        leaseToken: 'lease_secret_token_123', // Illegal: lease must be explicitly released!
      };

      const result = DagNodeSpecSchema.safeParse(waitingWithLease);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toMatch(/must have leaseToken set to null/);
      }
    });
  });

  // =========================================================================
  // AC16 — Public Projection Sanitization
  // =========================================================================
  describe('AC16 — Public Projection Sanitization', () => {
    it('omits canary strings, credentials, lease tokens, and internal prompts from public progress', () => {
      const internalNode: DagNodeSpec = {
        id: 'node_assess_01',
        runId: 'run_secret_01',
        claimId: 'clm_secret_01',
        stage: 'assess_evidence',
        state: 'leased',
        dependencies: ['node_search_01'],
        attempt: 1,
        leaseToken: 'CANARY_SECRET_LEASE_TOKEN_XYZ',
        leaseUntil: '2026-11-08T00:01:00Z',
        internalPrompt: 'CANARY_SECRET_INTERNAL_PROMPT_DO_NOT_LEAK',
        rawProviderError: 'CANARY_SECRET_ANTHROPIC_500_KEY_sk-ant-api03',
        outputReference: null,
      };

      const sanitized = sanitizePublicProgress(internalNode);

      // Verify approved public fields are present
      expect(sanitized.nodeId).toBe('node_assess_01');
      expect(sanitized.runId).toBe('run_secret_01');
      expect(sanitized.stage).toBe('assess_evidence');
      expect(sanitized.state).toBe('leased');
      expect(sanitized.publicMessage).toBe('Evaluating evidence against claim context');

      // Verify no canary tokens or sensitive fields leaked
      const serialized = JSON.stringify(sanitized);
      expect(serialized).not.toContain('CANARY_SECRET_LEASE_TOKEN_XYZ');
      expect(serialized).not.toContain('CANARY_SECRET_INTERNAL_PROMPT_DO_NOT_LEAK');
      expect(serialized).not.toContain('CANARY_SECRET_ANTHROPIC_500_KEY_sk-ant-api03');
      expect(serialized).not.toContain('leaseToken');
      expect(serialized).not.toContain('internalPrompt');
      expect(serialized).not.toContain('rawProviderError');
    });
  });

  // =========================================================================
  // AC17 — Consumer Usability Examples (Compile-Checked)
  // =========================================================================
  describe('AC17 — Consumer Usability Examples (Compile-Checked)', () => {
    it('demonstrates Lane A verifier constructing and parsing a ticket and assessment', () => {
      const ticketInput: ClaimTicket = {
        ticketId: 'tkt_lane_a',
        claimId: 'clm_lane_a',
        runId: 'run_lane_a',
        inputHash: 'hash_a',
        revision: 1,
        originalStatement: 'Sample assertion',
        normalizedProposition: 'Normalized assertion',
        domain: 'generic',
        targetTime: '2026-11-08',
        verificationContext: [
          {
            key: 'jurisdiction',
            label: 'Jurisdiction',
            propertyType: 'string',
            value: 'US',
            origin: 'explicit_claim_text',
            sourceSpan: { start: 0, end: 6 },
            status: 'confirmed',
            applicability: 'claim_level',
          },
        ],
        missingMaterialContext: [],
      };

      const parsedTicket = ClaimTicketSchema.parse(ticketInput);
      expect(parsedTicket.ticketId).toBe('tkt_lane_a');

      const assessmentInput: ClaimEvidenceAssessment = {
        assessmentId: 'asm_lane_a',
        claimTicketId: parsedTicket.ticketId,
        claimRevision: parsedTicket.revision,
        evidenceId: 'evi_lane_a',
        relationship: 'supports',
        scopeMatching: 'match',
        quotationVerified: true,
        propertyMatchStatus: { matching: ['jurisdiction'], mismatched: [], missingInEvidence: [] },
        temporalApplicability: 'active_at_target_time',
        sourceSuitability: 'authoritative_primary',
        reasoning: 'Verified by primary source.',
      };

      const parsedAssessment = ClaimEvidenceAssessmentSchema.parse(assessmentInput);
      expect(parsedAssessment.relationship).toBe('supports');
    });

    it('demonstrates Lane B platform worker parsing research and DAG payloads', () => {
      const planPayload = {
        stage: 'plan_research' as const,
        claimTicketId: 'tkt_lane_b',
        round: 1,
      };

      const node: DagNodeSpec = {
        id: 'node_lane_b',
        runId: 'run_lane_b',
        stage: 'plan_research',
        state: 'pending',
        dependencies: [],
        attempt: 0,
        stagePayload: planPayload,
      };

      const parsedNode = DagNodeSpecSchema.parse(node);
      expect(parsedNode.stagePayload?.stage).toBe('plan_research');
    });

    it('demonstrates Lane C UI consuming clarification question union and public progress', () => {
      const q: ClarificationQuestion = {
        questionId: 'q_lane_c',
        propertyKey: 'currency',
        prompt: 'Select billing currency:',
        reason: 'Rate varies by currency',
        fieldType: 'select',
        required: true,
        allowUnknown: true,
        options: [
          { value: 'USD', label: 'US Dollars ($)' },
          { value: 'EUR', label: 'Euros (€)' },
        ],
      };

      const parsedQ = ClarificationQuestionSchema.parse(q);
      expect(parsedQ.options?.[0].value).toBe('USD');

      const node: DagNodeSpec = {
        id: 'node_ui',
        runId: 'run_ui',
        stage: 'search_evidence',
        state: 'leased',
        dependencies: [],
        attempt: 1,
      };

      const progress = sanitizePublicProgress(node);
      expect(progress.publicMessage).toBe('Retrieving authoritative sources');
    });
  });

  // =========================================================================
  // AC18 — Limits & JSON Round-Trip Serialization
  // =========================================================================
  describe('AC18 — Limits & JSON Round-Trip Serialization', () => {
    it('rejects oversized inputs in Server Action schemas', () => {
      const oversizedText = 'a'.repeat(8001); // MAX_PASTE_LENGTH is 8000
      const badInput = {
        mode: 'paste' as const,
        text: oversizedText,
      };

      const result = StartPreparationActionInputSchema.safeParse(badInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toMatch(/exceeds maximum length of 8000/);
      }
    });

    it('round-trips complex valid payloads through JSON without losing meaning', () => {
      const ticket: ClaimTicket = {
        ticketId: 'tkt_roundtrip',
        claimId: 'clm_roundtrip',
        runId: 'run_roundtrip',
        inputHash: 'hash_roundtrip',
        revision: 1,
        originalStatement: 'Original text assertion.',
        sourceSpan: { start: 0, end: 23 },
        normalizedProposition: 'Normalized assertion.',
        domain: 'fintech',
        targetTime: '2026-11-08',
        verificationContext: [
          {
            key: 'fee',
            label: 'Transaction Fee',
            propertyType: 'number',
            value: 2.9,
            units: '%',
            origin: 'explicit_claim_text',
            sourceSpan: { start: 0, end: 4 },
            status: 'confirmed',
            applicability: 'claim_level',
          },
        ],
        missingMaterialContext: [],
      };

      const serialized = JSON.stringify(ticket);
      const deserialized = JSON.parse(serialized);
      const reParsed = ClaimTicketSchema.parse(deserialized);

      expect(reParsed).toEqual(ticket);
    });
  });

  // =========================================================================
  // Self-Review Edge Cases (Not copied verbatim from acceptance criteria)
  // =========================================================================
  describe('Self-Review Edge Cases', () => {
    it('rejects invalid leap year calendar date (2023-02-29) in date property', () => {
      const nonLeapDateProp = {
        key: 'effectiveDate',
        label: 'Effective Date',
        propertyType: 'date' as const,
        value: '2023-02-29', // 2023 is not a leap year!
        origin: 'user_target_context' as const,
        status: 'confirmed' as const,
        applicability: 'claim_level' as const,
      };

      const result = VerificationPropertySchema.safeParse(nonLeapDateProp);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toMatch(/requires valid calendar date/);
      }
    });

    it('rejects select clarification question with only 1 option', () => {
      const singleOptionQuestion = {
        questionId: 'q_single_opt',
        propertyKey: 'tier',
        prompt: 'Choose tier:',
        reason: 'Reason',
        fieldType: 'select' as const,
        required: true,
        allowUnknown: true as const,
        options: [{ value: 'only_one', label: 'Only One' }], // Requires at least 2!
      };

      const result = ClarificationQuestionSchema.safeParse(singleOptionQuestion);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toMatch(/must provide at least 2 options/);
      }
    });

    it('validates the five-claim baseline workflow (27 nodes) within budget and schema limits', () => {
      // 5 claims * 5 baseline stages (25) + root (1) + finalizer (1) = 27 nodes
      const baselineNodes: DagNodeSpec[] = [
        {
          id: 'node_root',
          runId: 'run_baseline_5',
          stage: 'root_extract_prep',
          state: 'completed',
          dependencies: [],
          attempt: 1,
          outputReference: { claimsExtracted: 5 },
        },
      ];

      for (let i = 1; i <= 5; i++) {
        const claimId = `clm_0${i}`;
        baselineNodes.push(
          { id: `node_plan_${claimId}`, runId: 'run_baseline_5', claimId, stage: 'plan_research', state: 'completed', dependencies: ['node_root'], attempt: 1, outputReference: { planId: `p_${i}` } },
          { id: `node_search_${claimId}`, runId: 'run_baseline_5', claimId, stage: 'search_evidence', state: 'completed', dependencies: [`node_plan_${claimId}`], attempt: 1, outputReference: { docsFound: 2 } },
          { id: `node_extract_${claimId}`, runId: 'run_baseline_5', claimId, stage: 'extract_evidence', state: 'completed', dependencies: [`node_search_${claimId}`], attempt: 1, outputReference: { evidenceUnits: 3 } },
          { id: `node_assess_${claimId}`, runId: 'run_baseline_5', claimId, stage: 'assess_evidence', state: 'completed', dependencies: [`node_extract_${claimId}`], attempt: 1, outputReference: { assessments: 2 } },
          { id: `node_decide_${claimId}`, runId: 'run_baseline_5', claimId, stage: 'decide_claim', state: 'completed', dependencies: [`node_assess_${claimId}`], attempt: 1, outputReference: { recordId: `dec_${i}` } }
        );
      }

      baselineNodes.push({
        id: 'node_finalize',
        runId: 'run_baseline_5',
        stage: 'finalize_run',
        state: 'pending',
        dependencies: ['node_decide_clm_01', 'node_decide_clm_02', 'node_decide_clm_03', 'node_decide_clm_04', 'node_decide_clm_05'],
        attempt: 0,
      });

      expect(baselineNodes).toHaveLength(27);
      expect(computeMaxDagNodes(5)).toBe(52);

      const snapshot: DagGraphSnapshot = {
        runId: 'run_baseline_5',
        revision: 1,
        nodes: baselineNodes,
      };

      const validation = validateDagGraph(snapshot, { claimCount: 5 });
      expect(validation.valid).toBe(true);
      expect(DagGraphSnapshotSchema.safeParse(snapshot).success).toBe(true);
    });

    it('validates a permitted expanded run including clarification and ranking (30 nodes)', () => {
      // Start from baseline (27 nodes)
      // Expand clm_01 with optional ranking (rank_evidence: +1)
      // Expand clm_05 with dynamic clarification (clarification_wait + reassess_evidence: +2)
      // Total = 27 + 1 + 2 = 30 nodes
      const baselineNodes: DagNodeSpec[] = [
        {
          id: 'node_root',
          runId: 'run_expanded_5',
          stage: 'root_extract_prep',
          state: 'completed',
          dependencies: [],
          attempt: 1,
          outputReference: { claimsExtracted: 5 },
        },
      ];

      for (let i = 1; i <= 5; i++) {
        const claimId = `clm_0${i}`;
        baselineNodes.push(
          { id: `node_plan_${claimId}`, runId: 'run_expanded_5', claimId, stage: 'plan_research', state: 'completed', dependencies: ['node_root'], attempt: 1, outputReference: { ok: true } },
          { id: `node_search_${claimId}`, runId: 'run_expanded_5', claimId, stage: 'search_evidence', state: 'completed', dependencies: [`node_plan_${claimId}`], attempt: 1, outputReference: { ok: true } },
          { id: `node_extract_${claimId}`, runId: 'run_expanded_5', claimId, stage: 'extract_evidence', state: 'completed', dependencies: [`node_search_${claimId}`], attempt: 1, outputReference: { ok: true } },
          { id: `node_assess_${claimId}`, runId: 'run_expanded_5', claimId, stage: 'assess_evidence', state: 'completed', dependencies: [`node_extract_${claimId}`], attempt: 1, outputReference: { ok: true } },
          { id: `node_decide_${claimId}`, runId: 'run_expanded_5', claimId, stage: 'decide_claim', state: 'completed', dependencies: [`node_assess_${claimId}`], attempt: 1, outputReference: { ok: true } }
        );
      }

      baselineNodes.push({
        id: 'node_finalize',
        runId: 'run_expanded_5',
        stage: 'finalize_run',
        state: 'pending',
        dependencies: ['node_decide_clm_01', 'node_decide_clm_02', 'node_decide_clm_03', 'node_decide_clm_04', 'node_decide_clm_05'],
        attempt: 0,
      });

      const existingSnapshot: DagGraphSnapshot = {
        runId: 'run_expanded_5',
        revision: 1,
        nodes: baselineNodes,
      };

      const dynamicExpansionNodes: DagNodeSpec[] = [
        // Vector shortlisting on clm_01
        {
          id: 'node_rank_clm_01',
          runId: 'run_expanded_5',
          claimId: 'clm_01',
          stage: 'rank_evidence',
          state: 'completed',
          dependencies: ['node_extract_clm_01'],
          attempt: 1,
          outputReference: { shortlistedIds: ['evi_01'] },
        },
        // Ambiguity clarification on clm_05
        {
          id: 'node_clarify_clm_05',
          runId: 'run_expanded_5',
          claimId: 'clm_05',
          stage: 'clarification_wait',
          state: 'completed',
          dependencies: ['node_assess_clm_05'],
          attempt: 1,
          outputReference: { answered: true },
        },
        {
          id: 'node_reassess_clm_05',
          runId: 'run_expanded_5',
          claimId: 'clm_05',
          stage: 'reassess_evidence',
          state: 'completed',
          dependencies: ['node_clarify_clm_05'],
          attempt: 1,
          outputReference: { reassessed: true },
        },
      ];

      const expansionResult = validateDagExpansion(existingSnapshot, dynamicExpansionNodes, { claimCount: 5 });
      expect(expansionResult.valid).toBe(true);

      const combinedNodes = [...baselineNodes, ...dynamicExpansionNodes];
      expect(combinedNodes).toHaveLength(30);

      const combinedSnapshot: DagGraphSnapshot = {
        runId: 'run_expanded_5',
        revision: 2,
        nodes: combinedNodes,
      };
      expect(validateDagGraph(combinedSnapshot, { claimCount: 5 }).valid).toBe(true);
      expect(DagGraphSnapshotSchema.safeParse(combinedSnapshot).success).toBe(true);
    });

    it('validates the supported maximum claim count at full branch capacity (5 claims, 52 nodes)', () => {
      expect(SUPPORTED_MAX_CLAIMS_PER_RUN).toBe(5);
      expect(RUN_OVERHEAD_DAG_NODES).toBe(2);
      expect(MAX_NODES_PER_CLAIM_BRANCH).toBe(10);
      expect(MAX_DAG_NODES_PER_RUN).toBe(52);
      expect(computeMaxDagNodes(5)).toBe(52);

      const fullCapacityNodes: DagNodeSpec[] = [
        {
          id: 'node_root',
          runId: 'run_full_5',
          stage: 'root_extract_prep',
          state: 'completed',
          dependencies: [],
          attempt: 1,
          outputReference: { ok: true },
        },
      ];

      for (let i = 1; i <= 5; i++) {
        const claimId = `clm_0${i}`;
        // 10 nodes per claim branch:
        // 5 baseline + 1 rank + 2 clarify R1/reassess R1 + 2 clarify R2/reassess R2 = 10
        fullCapacityNodes.push(
          { id: `node_plan_${claimId}`, runId: 'run_full_5', claimId, stage: 'plan_research', state: 'completed', dependencies: ['node_root'], attempt: 1, outputReference: { ok: true } },
          { id: `node_search_${claimId}`, runId: 'run_full_5', claimId, stage: 'search_evidence', state: 'completed', dependencies: [`node_plan_${claimId}`], attempt: 1, outputReference: { ok: true } },
          { id: `node_extract_${claimId}`, runId: 'run_full_5', claimId, stage: 'extract_evidence', state: 'completed', dependencies: [`node_search_${claimId}`], attempt: 1, outputReference: { ok: true } },
          { id: `node_rank_${claimId}`, runId: 'run_full_5', claimId, stage: 'rank_evidence', state: 'completed', dependencies: [`node_extract_${claimId}`], attempt: 1, outputReference: { ok: true } },
          { id: `node_assess_${claimId}`, runId: 'run_full_5', claimId, stage: 'assess_evidence', state: 'completed', dependencies: [`node_rank_${claimId}`], attempt: 1, outputReference: { ok: true } },
          { id: `node_clarify1_${claimId}`, runId: 'run_full_5', claimId, stage: 'clarification_wait', state: 'completed', dependencies: [`node_assess_${claimId}`], attempt: 1, outputReference: { ok: true } },
          { id: `node_reassess1_${claimId}`, runId: 'run_full_5', claimId, stage: 'reassess_evidence', state: 'completed', dependencies: [`node_clarify1_${claimId}`], attempt: 1, outputReference: { ok: true } },
          { id: `node_clarify2_${claimId}`, runId: 'run_full_5', claimId, stage: 'clarification_wait', state: 'completed', dependencies: [`node_reassess1_${claimId}`], attempt: 1, outputReference: { ok: true } },
          { id: `node_reassess2_${claimId}`, runId: 'run_full_5', claimId, stage: 'reassess_evidence', state: 'completed', dependencies: [`node_clarify2_${claimId}`], attempt: 1, outputReference: { ok: true } },
          { id: `node_decide_${claimId}`, runId: 'run_full_5', claimId, stage: 'decide_claim', state: 'completed', dependencies: [`node_reassess2_${claimId}`], attempt: 1, outputReference: { ok: true } }
        );
      }

      fullCapacityNodes.push({
        id: 'node_finalize',
        runId: 'run_full_5',
        stage: 'finalize_run',
        state: 'pending',
        dependencies: ['node_decide_clm_01', 'node_decide_clm_02', 'node_decide_clm_03', 'node_decide_clm_04', 'node_decide_clm_05'],
        attempt: 0,
      });

      expect(fullCapacityNodes).toHaveLength(52);

      const fullSnapshot: DagGraphSnapshot = {
        runId: 'run_full_5',
        revision: 1,
        nodes: fullCapacityNodes,
      };

      const validation = validateDagGraph(fullSnapshot, { claimCount: 5 });
      expect(validation.valid).toBe(true);
      expect(DagGraphSnapshotSchema.safeParse(fullSnapshot).success).toBe(true);
    });

    it('rejects executions exceeding applicable budgets (dynamic claim budget and hard schema ceiling)', () => {
      // 1. Single claim run budget enforcement: max is SINGLE_CLAIM_MAX_DAG_NODES (16)
      expect(SINGLE_CLAIM_MAX_DAG_NODES).toBe(16);
      expect(computeMaxDagNodes(1)).toBe(16);

      const seventeenNodesSingleClaim: DagNodeSpec[] = Array.from({ length: 17 }, (_, i) => ({
        id: `node_1c_${i}`,
        runId: 'run_single_exceed',
        stage: 'plan_research',
        state: 'pending',
        dependencies: [],
        attempt: 0,
      }));

      const singleClaimGraph: DagGraphSnapshot = {
        runId: 'run_single_exceed',
        revision: 1,
        nodes: seventeenNodesSingleClaim,
      };

      // Exceeds the 1-claim budget of 16 nodes
      const budgetOpts: DagBudgetOptions = { claimCount: 1 };
      const singleClaimRes = validateDagGraph(singleClaimGraph, budgetOpts);
      expect(singleClaimRes.valid).toBe(false);
      expect(singleClaimRes.error).toMatch(/exceed maximum allowable budget of 16 nodes/);

      // Dynamic expansion on 1-claim run also rejects 17th node
      const singleClaimExpansion = validateDagExpansion(
        { runId: 'run_single_exceed', revision: 1, nodes: seventeenNodesSingleClaim.slice(0, 15) },
        seventeenNodesSingleClaim.slice(15), // 2 nodes -> 17 total > 16
        { claimCount: 1 }
      );
      expect(singleClaimExpansion.valid).toBe(false);
      expect(singleClaimExpansion.error).toMatch(/exceeds maximum limit of 16 nodes/);

      // 2. Hard schema ceiling enforcement (MAX_DAG_NODES_PER_RUN = 52)
      const fiftyThreeNodes: DagNodeSpec[] = Array.from({ length: 53 }, (_, i) => ({
        id: `node_hard_${i}`,
        runId: 'run_hard_exceed',
        stage: 'plan_research',
        state: 'pending',
        dependencies: [],
        attempt: 0,
      }));

      const hardCeilingGraph = {
        runId: 'run_hard_exceed',
        revision: 1,
        nodes: fiftyThreeNodes,
      };

      // Rejected by Zod schema ceiling
      expect(DagGraphSnapshotSchema.safeParse(hardCeilingGraph).success).toBe(false);

      // Rejected by validateDagGraph
      const hardRes = validateDagGraph(hardCeilingGraph as DagGraphSnapshot);
      expect(hardRes.valid).toBe(false);
      expect(hardRes.error).toMatch(/exceed maximum allowable budget of 52 nodes/);

      // Rejected by validateDagExpansion
      const hardExpansion = validateDagExpansion(
        { runId: 'run_hard_exceed', revision: 1, nodes: fiftyThreeNodes.slice(0, 30) },
        fiftyThreeNodes.slice(30)
      );
      expect(hardExpansion.valid).toBe(false);
      expect(hardExpansion.error).toMatch(/exceeds maximum limit of 52 nodes/);

      // 3. Guarantee configured limits cannot exceed schema ceiling
      expect(computeMaxDagNodes(100)).toBe(52);
      expect(resolveEffectiveMaxDagNodes({ maxNodes: 100 })).toBe(52);
    });

    it('resolves effectiveMax correctly across all required combinations (BUD-02)', () => {
      // 1. no options -> 52
      expect(resolveEffectiveMaxDagNodes()).toBe(52);
      expect(resolveEffectiveMaxDagNodes({})).toBe(52);

      // 2. { claimCount: 5 } -> 52
      expect(resolveEffectiveMaxDagNodes({ claimCount: 5 })).toBe(52);

      // 3. { maxNodes: 30 } -> 30
      expect(resolveEffectiveMaxDagNodes({ maxNodes: 30 })).toBe(30);

      // 4. { claimCount: 5, maxNodes: 30 } -> 30 (tighter maxNodes limit enforced)
      expect(resolveEffectiveMaxDagNodes({ claimCount: 5, maxNodes: 30 })).toBe(30);

      // 5. { claimCount: 1, maxNodes: 30 } -> 16 (tighter single-claim budget enforced)
      expect(resolveEffectiveMaxDagNodes({ claimCount: 1, maxNodes: 30 })).toBe(16);

      // 6. { claimCount: 5, maxNodes: 100 } -> 52 (hard ceiling enforced, cannot exceed 52)
      expect(resolveEffectiveMaxDagNodes({ claimCount: 5, maxNodes: 100 })).toBe(52);
    });

    it('rejects invalid numeric options explicitly and handles zero-claim empty runs (BUD-03)', () => {
      // Reject zero node limit (maxNodes <= 0)
      expect(() => resolveEffectiveMaxDagNodes({ maxNodes: 0 })).toThrow(/Invalid maxNodes/);
      expect(() => resolveEffectiveMaxDagNodes({ maxNodes: -10 })).toThrow(/Invalid maxNodes/);

      // Reject NaN and Infinity
      expect(() => resolveEffectiveMaxDagNodes({ maxNodes: NaN })).toThrow(/Invalid maxNodes/);
      expect(() => resolveEffectiveMaxDagNodes({ maxNodes: Infinity })).toThrow(/Invalid maxNodes/);
      expect(() => resolveEffectiveMaxDagNodes({ maxNodes: -Infinity })).toThrow(/Invalid maxNodes/);
      expect(() => resolveEffectiveMaxDagNodes({ claimCount: NaN })).toThrow(/Invalid claimCount/);
      expect(() => resolveEffectiveMaxDagNodes({ claimCount: Infinity })).toThrow(/Invalid claimCount/);

      // Reject fractional numbers
      expect(() => resolveEffectiveMaxDagNodes({ maxNodes: 25.5 })).toThrow(/Invalid maxNodes/);
      expect(() => resolveEffectiveMaxDagNodes({ claimCount: 2.5 })).toThrow(/Invalid claimCount/);

      // Reject negative claim counts
      expect(() => resolveEffectiveMaxDagNodes({ claimCount: -1 })).toThrow(/Invalid claimCount/);
      expect(() => computeMaxDagNodes(-1)).toThrow(/Invalid claimCount/);

      // Empty-run policy: claimCount = 0 adheres to documented empty-run budget (root + finalize = 2 nodes)
      expect(computeMaxDagNodes(0)).toBe(2);
      expect(resolveEffectiveMaxDagNodes({ claimCount: 0 })).toBe(2);
      expect(resolveEffectiveMaxDagNodes({ claimCount: 0, maxNodes: 30 })).toBe(2);
      expect(resolveEffectiveMaxDagNodes({ claimCount: 0, maxNodes: 1 })).toBe(1);

      // Empty-run graph (2 nodes) passes validation under claimCount = 0
      const emptyRunGraph: DagGraphSnapshot = {
        runId: 'run_empty_01',
        revision: 1,
        nodes: [
          { id: 'node_root', runId: 'run_empty_01', stage: 'root_extract_prep', state: 'completed', dependencies: [], attempt: 1, outputReference: { totalClaims: 0 } },
          { id: 'node_finalize', runId: 'run_empty_01', stage: 'finalize_run', state: 'pending', dependencies: ['node_root'], attempt: 0 },
        ],
      };
      expect(validateDagGraph(emptyRunGraph, { claimCount: 0 }).valid).toBe(true);

      // Adding a 3rd node to a zero-claim run fails validation
      const emptyRunWithExtra: DagGraphSnapshot = {
        runId: 'run_empty_01',
        revision: 1,
        nodes: [
          ...emptyRunGraph.nodes,
          { id: 'node_orphan', runId: 'run_empty_01', stage: 'plan_research', state: 'pending', dependencies: ['node_root'], attempt: 0 },
        ],
      };
      const emptyRes = validateDagGraph(emptyRunWithExtra, { claimCount: 0 });
      expect(emptyRes.valid).toBe(false);
      expect(emptyRes.error).toMatch(/exceed maximum allowable budget of 2 nodes/);

      // validateDagGraph / validateDagExpansion return explicit errors on invalid options
      const invalidGraphRes = validateDagGraph(emptyRunGraph, { maxNodes: 0 });
      expect(invalidGraphRes.valid).toBe(false);
      expect(invalidGraphRes.error).toMatch(/Invalid maxNodes/);

      const invalidExpandRes = validateDagExpansion(emptyRunGraph, [], { maxNodes: -5 });
      expect(invalidExpandRes.valid).toBe(false);
      expect(invalidExpandRes.error).toMatch(/Invalid maxNodes/);
    });

    it('enforces validator parity and tighter limit selection on valid graph fixtures (BUD-04)', () => {
      // Helper to generate a valid linear graph of N nodes
      function createValidChainGraph(runId: string, nodeCount: number): DagGraphSnapshot {
        const nodes: DagNodeSpec[] = [
          {
            id: `${runId}_node_0`,
            runId,
            stage: 'root_extract_prep',
            state: 'completed',
            dependencies: [],
            attempt: 1,
            outputReference: { ok: true },
          },
        ];

        for (let i = 1; i < nodeCount - 1; i++) {
          nodes.push({
            id: `${runId}_node_${i}`,
            runId,
            stage: 'plan_research',
            state: 'completed',
            dependencies: [`${runId}_node_${i - 1}`],
            attempt: 1,
            outputReference: { ok: true },
          });
        }

        if (nodeCount > 1) {
          nodes.push({
            id: `${runId}_node_final`,
            runId,
            stage: 'finalize_run',
            state: 'pending',
            dependencies: [`${runId}_node_${nodeCount - 2}`],
            attempt: 0,
          });
        }

        return { runId, revision: 1, nodes };
      }

      // 1. Tighter maxNodes enforcement: { claimCount: 5, maxNodes: 30 } -> tighter limit is 30
      // Exactly 30 nodes passes
      const graph30 = createValidChainGraph('run_test_30', 30);
      expect(validateDagGraph(graph30, { claimCount: 5, maxNodes: 30 }).valid).toBe(true);

      // Exactly 31 nodes fails
      const graph31 = createValidChainGraph('run_test_31', 31);
      const res31 = validateDagGraph(graph31, { claimCount: 5, maxNodes: 30 });
      expect(res31.valid).toBe(false);
      expect(res31.error).toMatch(/exceed maximum allowable budget of 30 nodes/);

      // Expansion parity: existing 27 nodes + proposed 3 nodes (total 30) passes
      const base27 = createValidChainGraph('run_expand_parity', 27);
      const proposed3: DagNodeSpec[] = [
        { id: 'p_1', runId: 'run_expand_parity', stage: 'plan_research', state: 'pending', dependencies: ['run_expand_parity_node_final'], attempt: 0 },
        { id: 'p_2', runId: 'run_expand_parity', stage: 'search_evidence', state: 'pending', dependencies: ['p_1'], attempt: 0 },
        { id: 'p_3', runId: 'run_expand_parity', stage: 'extract_evidence', state: 'pending', dependencies: ['p_2'], attempt: 0 },
      ];
      expect(validateDagExpansion(base27, proposed3, { claimCount: 5, maxNodes: 30 }).valid).toBe(true);

      // Expanding with 4 nodes (total 31) fails
      const proposed4: DagNodeSpec[] = [
        ...proposed3,
        { id: 'p_4', runId: 'run_expand_parity', stage: 'assess_evidence', state: 'pending', dependencies: ['p_3'], attempt: 0 },
      ];
      const expandRes31 = validateDagExpansion(base27, proposed4, { claimCount: 5, maxNodes: 30 });
      expect(expandRes31.valid).toBe(false);
      expect(expandRes31.error).toMatch(/exceeds maximum limit of 30 nodes/);

      // 2. Tighter claimCount enforcement: { claimCount: 1, maxNodes: 30 } -> tighter limit is 16
      const graph16 = createValidChainGraph('run_test_16', 16);
      expect(validateDagGraph(graph16, { claimCount: 1, maxNodes: 30 }).valid).toBe(true);

      const graph17 = createValidChainGraph('run_test_17', 17);
      const res17 = validateDagGraph(graph17, { claimCount: 1, maxNodes: 30 });
      expect(res17.valid).toBe(false);
      expect(res17.error).toMatch(/exceed maximum allowable budget of 16 nodes/);

      // Expansion parity for { claimCount: 1, maxNodes: 30 }: 14 existing + 2 proposed (total 16) passes
      const base14 = createValidChainGraph('run_expand_c1', 14);
      const proposed2: DagNodeSpec[] = [
        { id: 'c1_p1', runId: 'run_expand_c1', stage: 'plan_research', state: 'pending', dependencies: ['run_expand_c1_node_final'], attempt: 0 },
        { id: 'c1_p2', runId: 'run_expand_c1', stage: 'search_evidence', state: 'pending', dependencies: ['c1_p1'], attempt: 0 },
      ];
      expect(validateDagExpansion(base14, proposed2, { claimCount: 1, maxNodes: 30 }).valid).toBe(true);

      // Expanding with 3 nodes (total 17) fails
      const proposed3ForC1: DagNodeSpec[] = [
        ...proposed2,
        { id: 'c1_p3', runId: 'run_expand_c1', stage: 'extract_evidence', state: 'pending', dependencies: ['c1_p2'], attempt: 0 },
      ];
      const expandRes17 = validateDagExpansion(base14, proposed3ForC1, { claimCount: 1, maxNodes: 30 });
      expect(expandRes17.valid).toBe(false);
      expect(expandRes17.error).toMatch(/exceeds maximum limit of 16 nodes/);

      // 3. Documented five-claim baseline (27 nodes) still passes
      const baseline5Graph = createValidChainGraph('run_baseline_5_check', 27);
      expect(validateDagGraph(baseline5Graph).valid).toBe(true);
      expect(validateDagGraph(baseline5Graph, { claimCount: 5 }).valid).toBe(true);
    });

    it('demonstrates seamless bidirectional conversion between AtomicClaimSpec and ClaimTicket', () => {
      const spec: AtomicClaimSpec = {
        id: 'clm_pricing_01',
        rawText: 'In the US, Stripe charges 2.9% + 30 cents per transaction.',
        entity: 'Stripe',
        attribute: 'standard card processing fee',
        assertedValue: '2.9% + 30 cents',
        timeSensitivity: 'medium',
        sourceScope: { jurisdiction: 'US', currency: 'USD' },
        span: { start: 0, end: 58 },
      };

      const ticket = createClaimTicketFromSpec(spec, {
        runId: 'run_conv_01',
        inputHash: 'hash_conv_01',
        targetTime: '2026-11-08',
      });

      expect(ticket.claimId).toBe('clm_pricing_01');
      expect(ticket.ticketId).toBe('tkt_clm_pricing_01_r1');
      expect(ticket.originalStatement).toBe(spec.rawText);
      expect(ticket.verificationContext).toHaveLength(2);

      const jurisdictionProp = getContextProperty(ticket, 'jurisdiction');
      expect(jurisdictionProp?.value).toBe('US');
      expect(jurisdictionProp?.origin).toBe('explicit_claim_text');

      const convertedSpec = toAtomicClaimSpec(ticket, {
        entity: 'Stripe',
        attribute: 'standard card processing fee',
        assertedValue: '2.9% + 30 cents',
        timeSensitivity: 'medium',
      });

      expect(convertedSpec.id).toBe(spec.id);
      expect(convertedSpec.rawText).toBe(spec.rawText);
      expect(convertedSpec.sourceScope?.jurisdiction).toBe('US');
      expect(convertedSpec.span).toEqual(spec.span);
    });

    it('rejects evidence unit with inverted character offsets [50, 40]', () => {
      const invertedLocator = {
        evidenceId: 'evi_inverted',
        documentId: 'doc_01',
        verbatimText: 'text',
        locator: {
          charOffsetStart: 50,
          charOffsetEnd: 40, // Inverted!
        },
        surroundingHeaders: [],
        footnotes: [],
        extractedProperties: [],
        extractionLimitations: [],
      };

      const result = EvidenceUnitSchema.safeParse(invertedLocator);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.message.includes('strictly less than'))).toBe(true);
      }
    });
  });
});
