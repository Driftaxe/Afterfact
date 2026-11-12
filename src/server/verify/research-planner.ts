import type { ClaimTicket } from '@/lib/contracts/claim-ticket';
import type { ClarificationQuestion } from '@/lib/contracts/clarification';
import {
  MAX_QUERIES_PER_PLAN,
  MAX_QUERY_LENGTH,
  MAX_RESEARCH_ROUNDS,
  PlannedQuery,
  PlannedQueryPurpose,
  PlannedQueryPurposeSchema,
  PlannedQuerySchema,
  ResearchPlan,
  ResearchPlanSchema,
  SourceRole,
  SourceRoleSchema,
} from '@/lib/contracts/research';
import { bifrostChat } from '@/server/bifrost/client';
import { getModelProfile } from '@/server/bifrost/profiles';
import {
  buildResearchPlannerUserPrompt,
  RESEARCH_PLANNER_SYSTEM_PROMPT,
} from '@/server/prompts/research';

/**
 * Context regarding unresolved research gaps from a prior research round.
 */
export interface ResearchGapContext {
  unresolvedProperties?: string[];
  missingEvidenceAspects?: string[];
  identifiedConflicts?: string[];
}

/**
 * Parameters for research plan generation.
 */
export interface GenerateResearchPlanParams {
  ticket: ClaimTicket;
  round?: number;
  remainingQueryAllowance?: number;
  priorQueries?: PlannedQuery[];
  previousGaps?: ResearchGapContext;
}

/**
 * Discriminated outcome union for research plan generation.
 */
export type ResearchPlanOutcome =
  | {
      status: 'success';
      plan: ResearchPlan;
    }
  | {
      status: 'clarification_recommended';
      claimTicketId: string;
      unresolvedProperties: string[];
      clarificationQuestions: ClarificationQuestion[];
      partialPlan?: ResearchPlan;
    }
  | {
      status: 'budget_exhausted';
      claimTicketId: string;
      round: number;
      reason: string;
    }
  | {
      status: 'plan_rejected';
      claimTicketId: string;
      error: string;
      details?: unknown;
    };

/**
 * Deterministically checks whether a claim ticket requires a counterevidence query.
 * Exclusivity, superlatives, and active validity assertions strictly require counterevidence.
 */
export function requiresCounterevidencePolicy(ticket: ClaimTicket): boolean {
  const text = `${ticket.originalStatement} ${ticket.normalizedProposition}`.toLowerCase();

  // Exclusivity markers
  if (/\b(only|sole|solely|exclusively|exclusive)\b/.test(text)) return true;

  // Superlative markers
  if (/\b(fastest|cheapest|highest|lowest|first|largest|best|most)\b/.test(text)) return true;

  // Active validity markers
  if (/\b(currently|current|active|now)\b/.test(text)) return true;

  return false;
}

/**
 * Strips markdown json fencing if present.
 */
function cleanJsonOutput(text: string): string {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenceMatch ? fenceMatch[1].trim() : trimmed;
}

/**
 * Generates an auditable ResearchPlan containing targeted search queries
 * to verify or falsify an atomic ClaimTicket against web evidence.
 */
export async function generateResearchPlan(
  params: GenerateResearchPlanParams
): Promise<ResearchPlanOutcome> {
  const {
    ticket,
    round = 1,
    remainingQueryAllowance = MAX_QUERIES_PER_PLAN,
    priorQueries,
    previousGaps,
  } = params;

  // 1. Check research round limits
  if (round > MAX_RESEARCH_ROUNDS || round < 1) {
    return {
      status: 'budget_exhausted',
      claimTicketId: ticket.ticketId,
      round,
      reason: `Research round ${round} exceeds maximum allowed budget of ${MAX_RESEARCH_ROUNDS}`,
    };
  }

  // 2. Check remaining query allowance
  if (remainingQueryAllowance <= 0) {
    return {
      status: 'budget_exhausted',
      claimTicketId: ticket.ticketId,
      round,
      reason: `Remaining query allowance is exhausted (allowance: ${remainingQueryAllowance})`,
    };
  }

  // 3. Check for missing essential qualifiers that prevent meaningful research
  const unknownProperties = ticket.verificationContext.filter((p) => p.origin === 'unknown');
  const materialGaps = [
    ...(previousGaps?.unresolvedProperties ?? []),
    ...unknownProperties.map((p) => p.key),
  ];

  // 4. Deterministic policy check for counterevidence
  const requiresCounterevidence = requiresCounterevidencePolicy(ticket);

  // 5. Invoke Bifrost to generate planned queries
  const effectiveAllowance = Math.min(remainingQueryAllowance, MAX_QUERIES_PER_PLAN);
  const userPrompt = buildResearchPlannerUserPrompt({
    ticket,
    round,
    remainingQueryAllowance: effectiveAllowance,
    priorQueries,
    unresolvedGaps: materialGaps,
    requiresCounterevidence,
  });

  let rawModelOutput: string;
  try {
    rawModelOutput = await bifrostChat({
      messages: [
        { role: 'system', content: RESEARCH_PLANNER_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      model: getModelProfile('assess'),
      temperature: 0.1,
      response_format: { type: 'json_object' },
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      status: 'plan_rejected',
      claimTicketId: ticket.ticketId,
      error: `Bifrost model invocation failed: ${errorMsg}`,
      details: err,
    };
  }

  // 6. Parse and validate candidate plan
  let parsedPayload: Record<string, unknown>;
  try {
    parsedPayload = JSON.parse(cleanJsonOutput(rawModelOutput));
  } catch {
    return {
      status: 'plan_rejected',
      claimTicketId: ticket.ticketId,
      error: 'Model returned malformed JSON output',
      details: rawModelOutput,
    };
  }

  // 7. Validate and bind queries
  const rawQueries = Array.isArray(parsedPayload.queries) ? parsedPayload.queries : [];
  if (rawQueries.length === 0) {
    return {
      status: 'plan_rejected',
      claimTicketId: ticket.ticketId,
      error: 'Model proposed zero research queries',
      details: parsedPayload,
    };
  }

  // Bound queries to remaining allowance
  const boundedRawQueries = rawQueries.slice(0, effectiveAllowance);

  const queries: PlannedQuery[] = [];
  for (let idx = 0; idx < boundedRawQueries.length; idx++) {
    const rawQ = boundedRawQueries[idx];
    const queryString = String(rawQ.query || '').trim().slice(0, MAX_QUERY_LENGTH);
    if (!queryString) continue;

    // Validate purpose
    const purposeParse = PlannedQueryPurposeSchema.safeParse(rawQ.purpose);
    const purpose: PlannedQueryPurpose = purposeParse.success
      ? purposeParse.data
      : 'establish_current_state';

    // Validate target source roles
    const rawRoles = Array.isArray(rawQ.targetSourceRoles) ? rawQ.targetSourceRoles : [];
    const validRoles: SourceRole[] = [];
    for (const r of rawRoles) {
      const parsedRole = SourceRoleSchema.safeParse(r);
      if (parsedRole.success) validRoles.push(parsedRole.data);
    }
    const targetSourceRoles: SourceRole[] =
      validRoles.length > 0 ? validRoles : ['primary_authority', 'reputable_secondary'];

    const plannedQuery: PlannedQuery = {
      queryId: `qry_${ticket.ticketId}_r${round}_${idx + 1}`,
      claimTicketId: ticket.ticketId,
      query: queryString,
      purpose,
      targetSourceRoles,
      round,
      scopeHints: typeof rawQ.scopeHints === 'object' && rawQ.scopeHints !== null
        ? (rawQ.scopeHints as Record<string, string>)
        : undefined,
    };

    const validatedQ = PlannedQuerySchema.safeParse(plannedQuery);
    if (validatedQ.success) {
      queries.push(validatedQ.data);
    }
  }

  if (queries.length === 0) {
    return {
      status: 'plan_rejected',
      claimTicketId: ticket.ticketId,
      error: 'All proposed queries failed schema validation or were empty',
      details: parsedPayload,
    };
  }

  // 8. Deterministic counterevidence guarantee
  if (requiresCounterevidence) {
    const hasCounter = queries.some((q) => q.purpose === 'seek_counterevidence');
    if (!hasCounter) {
      // Deterministically adapt the last query or inject counterevidence query
      const counterQueryText = `${ticket.originalStatement.slice(0, 120)} alternative dispute price change superseded`.trim();
      queries[queries.length - 1] = {
        queryId: `qry_${ticket.ticketId}_r${round}_${queries.length}`,
        claimTicketId: ticket.ticketId,
        query: counterQueryText.slice(0, MAX_QUERY_LENGTH),
        purpose: 'seek_counterevidence',
        targetSourceRoles: ['primary_authority', 'official_changelog', 'counter_perspective'],
        round,
      };
    }
  }

  const rawStopping = Array.isArray(parsedPayload.stoppingConditions)
    ? parsedPayload.stoppingConditions.filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
    : [];
  const stoppingConditions =
    rawStopping.length > 0
      ? rawStopping
      : ['Authoritative primary source confirming proposition found', 'Official deprecation record found'];

  // 9. Build and superRefine candidate ResearchPlan
  const planCandidate = {
    planId: `pln_${ticket.ticketId}_r${round}_${Date.now().toString(36)}`,
    claimTicketId: ticket.ticketId,
    runId: ticket.runId,
    revision: ticket.revision,
    round,
    queries,
    materialUnknownQualifiers: materialGaps,
    stoppingConditions,
    requiresCounterevidenceQuery: requiresCounterevidence,
  };

  const validation = ResearchPlanSchema.safeParse(planCandidate);
  if (!validation.success) {
    return {
      status: 'plan_rejected',
      claimTicketId: ticket.ticketId,
      error: `Constructed research plan failed contract validation: ${validation.error.message}`,
      details: validation.error.format(),
    };
  }

  return {
    status: 'success',
    plan: validation.data,
  };
}
