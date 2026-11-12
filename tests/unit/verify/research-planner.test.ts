import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { ClaimTicket } from '@/lib/contracts/claim-ticket';
import {
  generateResearchPlan,
  requiresCounterevidencePolicy,
} from '@/server/verify/research-planner';
import * as bifrostClient from '@/server/bifrost/client';

vi.mock('@/server/bifrost/client', () => ({
  bifrostChat: vi.fn(),
  BifrostError: class BifrostError extends Error {},
}));

describe('Stage 1: Research Planner (generateResearchPlan)', () => {
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
    verificationContext: [
      {
        key: 'jurisdiction',
        label: 'Geographic Jurisdiction',
        propertyType: 'string',
        value: 'EU',
        origin: 'explicit_claim_text',
        sourceSpan: { start: 45, end: 47 },
        status: 'confirmed',
        applicability: 'claim_level',
      },
      {
        key: 'version',
        label: 'Product Version',
        propertyType: 'string',
        value: 'v2',
        origin: 'explicit_claim_text',
        sourceSpan: { start: 8, end: 10 },
        status: 'confirmed',
        applicability: 'claim_level',
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('generates a valid ResearchPlan with success status and bound references', async () => {
    const mockModelPlan = {
      requiresCounterevidenceQuery: false,
      materialUnknownQualifiers: [],
      stoppingConditions: ['Official vendor pricing documentation found'],
      queries: [
        {
          query: 'SolisDB v2 pricing EU node month official',
          purpose: 'establish_current_state',
          targetSourceRoles: ['primary_authority'],
        },
        {
          query: 'SolisDB v2 price exceptions tiers regional',
          purpose: 'investigate_exceptions_or_scope',
          targetSourceRoles: ['primary_authority', 'reputable_secondary'],
        },
      ],
    };

    vi.mocked(bifrostClient.bifrostChat).mockResolvedValueOnce(JSON.stringify(mockModelPlan));

    const result = await generateResearchPlan({
      ticket: baseTicket,
      round: 1,
      remainingQueryAllowance: 6,
    });

    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.plan.claimTicketId).toBe(baseTicket.ticketId);
      expect(result.plan.runId).toBe(baseTicket.runId);
      expect(result.plan.revision).toBe(1);
      expect(result.plan.round).toBe(1);
      expect(result.plan.queries.length).toBe(2);
      expect(result.plan.queries[0].queryId).toContain(baseTicket.ticketId);
      expect(result.plan.queries[0].query).toBe('SolisDB v2 pricing EU node month official');
    }
  });

  it('enforces remaining query allowance and does not call Bifrost when exhausted', async () => {
    const result = await generateResearchPlan({
      ticket: baseTicket,
      round: 1,
      remainingQueryAllowance: 0,
    });

    expect(result.status).toBe('budget_exhausted');
    expect(bifrostClient.bifrostChat).not.toHaveBeenCalled();
  });

  it('enforces maximum research round limit (<= 2)', async () => {
    const result = await generateResearchPlan({
      ticket: baseTicket,
      round: 3,
      remainingQueryAllowance: 4,
    });

    expect(result.status).toBe('budget_exhausted');
    expect(bifrostClient.bifrostChat).not.toHaveBeenCalled();
  });

  it('deterministically enforces counterevidence requirement for exclusivity assertions', async () => {
    const exclusiveTicket: ClaimTicket = {
      ...baseTicket,
      originalStatement: 'Stripe is the only payment provider in Antarctica.',
      normalizedProposition: 'Stripe is the sole payment gateway provider operating in Antarctica.',
    };

    expect(requiresCounterevidencePolicy(exclusiveTicket)).toBe(true);

    // Model attempts to omit counterevidence query
    const modelOmittingCounter = {
      requiresCounterevidenceQuery: false,
      stoppingConditions: ['Vendor list found'],
      queries: [
        {
          query: 'payment providers operating in Antarctica',
          purpose: 'establish_current_state',
          targetSourceRoles: ['primary_authority'],
        },
      ],
    };

    vi.mocked(bifrostClient.bifrostChat).mockResolvedValueOnce(JSON.stringify(modelOmittingCounter));

    const result = await generateResearchPlan({
      ticket: exclusiveTicket,
      round: 1,
      remainingQueryAllowance: 4,
    });

    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.plan.requiresCounterevidenceQuery).toBe(true);
      const hasCounter = result.plan.queries.some((q) => q.purpose === 'seek_counterevidence');
      expect(hasCounter).toBe(true);
    }
  });

  it('incorporates round 1 prior queries and unresolved gaps into round 2 prompt', async () => {
    const priorQueries = [
      {
        queryId: 'qry_1',
        claimTicketId: baseTicket.ticketId,
        query: 'SolisDB v2 pricing EU',
        purpose: 'establish_current_state' as const,
        targetSourceRoles: ['primary_authority' as const],
        round: 1,
      },
    ];

    const previousGaps = {
      unresolvedProperties: ['effectiveDate'],
      missingEvidenceAspects: ['billingTerm'],
    };

    vi.mocked(bifrostClient.bifrostChat).mockResolvedValueOnce(
      JSON.stringify({
        queries: [
          {
            query: 'SolisDB v2 EU price effective date annual vs monthly',
            purpose: 'investigate_exceptions_or_scope',
            targetSourceRoles: ['primary_authority'],
          },
        ],
        stoppingConditions: ['Effective date changelog found'],
      })
    );

    const result = await generateResearchPlan({
      ticket: baseTicket,
      round: 2,
      remainingQueryAllowance: 5,
      priorQueries,
      previousGaps,
    });

    expect(result.status).toBe('success');
    expect(bifrostClient.bifrostChat).toHaveBeenCalled();
    const callArgs = vi.mocked(bifrostClient.bifrostChat).mock.calls[0][0];
    const userPromptContent = callArgs.messages[1].content;
    expect(userPromptContent).toContain('effectiveDate');
    expect(userPromptContent).toContain('SolisDB v2 pricing EU');
  });

  it('handles malformed JSON from model with typed plan_rejected outcome', async () => {
    vi.mocked(bifrostClient.bifrostChat).mockResolvedValueOnce('Sorry, I cannot formulate a search plan.');

    const result = await generateResearchPlan({
      ticket: baseTicket,
      round: 1,
      remainingQueryAllowance: 6,
    });

    expect(result.status).toBe('plan_rejected');
    if (result.status === 'plan_rejected') {
      expect(result.error).toContain('malformed JSON');
    }
  });

  it('handles Bifrost invocation failure with typed plan_rejected outcome', async () => {
    vi.mocked(bifrostClient.bifrostChat).mockRejectedValueOnce(new Error('503 Service Unavailable'));

    const result = await generateResearchPlan({
      ticket: baseTicket,
      round: 1,
      remainingQueryAllowance: 6,
    });

    expect(result.status).toBe('plan_rejected');
    if (result.status === 'plan_rejected') {
      expect(result.error).toContain('Bifrost model invocation failed');
    }
  });
});
