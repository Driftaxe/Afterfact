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

  // Severe life-event, death, or legal consequence markers requiring falsification check
  if (/\b(dead|death|died|killed|murdered|arrested|hospitalized)\b/.test(text)) return true;

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
/**
 * Determines whether a domain string is a bare public suffix / multi-tenant TLD namespace
 * (e.g. 'gov', 'gov.in', 'nic.in', 'gov.au', 'gob.es', 'admin.ch') rather than a concrete host.
 * Tavily's include_domains fails silently (returns 0 results) when passed bare public suffixes.
 */
export function isBareTldSuffix(domain: string): boolean {
  if (!domain) return false;
  const d = domain.toLowerCase().trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (
    d === 'gov' ||
    d === 'mil' ||
    d === 'edu' ||
    d === 'gov.in' ||
    d === 'nic.in' ||
    d === 'gov.au' ||
    d === 'gov.za' ||
    d === 'gob.es' ||
    d === 'gouv.fr' ||
    d === 'admin.ch' ||
    d === 'co.in' ||
    d === 'org.in' ||
    d === 'ac.uk' ||
    /^[a-z]{2,3}$/.test(d) ||
    (/^(gov|gob|gouv|nic|ac|co|org)\.[a-z]{2,}$/.test(d) && d !== 'gov.uk')
  ) {
    return true;
  }
  return false;
}

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

  // 8b. Deterministic canonical value-agnostic rule query guarantee
  const statementForNumbers = `${ticket.originalStatement} ${ticket.normalizedProposition}`;
  const hasNumericPredicate = /\b(\d+[\d,.]*|\$\d+|€\d+|£\d+|₹\d+)\b/.test(statementForNumbers);
  const isQuantitativeOrRegulatory = ticket.domain === 'regulation' || ticket.domain === 'pricing' || hasNumericPredicate;

  if (isQuantitativeOrRegulatory && queries.length >= 2) {
    const numbersInClaim = Array.from(statementForNumbers.matchAll(/\b\d{2,}\b/g)).map((m) => m[0]);
    const hasValueAgnosticQuery = queries.some((q) => !numbersInClaim.some((num) => q.query.includes(num)));

    if (!hasValueAgnosticQuery && numbersInClaim.length > 0) {
      const strippedQuery = queries[1].query
        .replace(/[$€£₹]?\b\d+[\d,.]*\b/g, '')
        .replace(/\b(flat|fixed|exact|only)\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim();

      let sovereignTarget = '';
      let sovereignIncludeDomains: string[] | undefined = undefined;
      const jurProp = ticket.verificationContext.find(
        (p) => p.key === 'jurisdiction' || p.key === 'country'
      )?.value;
      const jurStr = typeof jurProp === 'string' ? jurProp.toLowerCase() : '';

      if (jurStr === 'in' || jurStr.includes('india')) {
        sovereignTarget = 'official rules gazette site:gov.in';
        sovereignIncludeDomains = ['indiacode.nic.in', 'egazette.gov.in', 'pib.gov.in'];
      } else if (jurStr === 'us' || jurStr.includes('united states')) {
        sovereignTarget = 'official statutory code site:gov';
        sovereignIncludeDomains = ['federalregister.gov', 'ecfr.gov'];
      } else if (jurStr === 'uk' || jurStr.includes('united kingdom')) {
        sovereignTarget = 'legislation site:gov.uk';
        sovereignIncludeDomains = ['legislation.gov.uk', 'gov.uk'];
      } else if (jurStr === 'eu' || jurStr.includes('european union')) {
        sovereignTarget = 'directive site:europa.eu';
        sovereignIncludeDomains = ['eur-lex.europa.eu', 'ec.europa.eu', 'europa.eu'];
      }

      const canonicalSuffix = ticket.domain === 'regulation'
        ? (sovereignTarget ? `calculation rule statute ${sovereignTarget}` : 'calculation rule statute')
        : 'pricing structure calculation';

      const adaptedQuery = `${strippedQuery} ${canonicalSuffix}`.slice(0, MAX_QUERY_LENGTH).trim();

      const sanitizedInclude = sovereignIncludeDomains
        ? sovereignIncludeDomains.filter((d) => !isBareTldSuffix(d))
        : undefined;

      queries[1] = {
        ...queries[1],
        query: adaptedQuery,
        purpose: 'investigate_exceptions_or_scope',
        includeDomains: sanitizedInclude && sanitizedInclude.length > 0 ? sanitizedInclude : undefined,
        excludeDomains: ['reddit.com', 'quora.com', 'stackoverflow.com'],
      };
    }
  }

  // Attach default UGC exclusions to primary authority and regulatory queries across all queries
  for (let i = 0; i < queries.length; i++) {
    const q = queries[i];
    if (
      q.targetSourceRoles.includes('primary_authority') ||
      q.targetSourceRoles.includes('regulatory_filing')
    ) {
      if (!q.excludeDomains) {
        q.excludeDomains = ['reddit.com', 'quora.com', 'stackoverflow.com'];
      }
    }
  }

  // 8c. First-Party Canonical Retrieval Branch Guarantee
  const entityProp = ticket.verificationContext.find(
    (p) =>
      (p.key === 'productName' ||
        p.key === 'provider' ||
        p.key === 'vendor' ||
        p.key === 'company' ||
        p.key === 'organization' ||
        p.key === 'regulator' ||
        p.key === 'agency' ||
        p.key === 'entity' ||
        p.key === 'service') &&
      typeof p.value === 'string' &&
      p.value.trim().length > 0
  );

  const rawEntity = entityProp ? String(entityProp.value).trim() : null;
  if (rawEntity && rawEntity.length >= 3) {
    const hasOfficialTargetQuery = queries.some(
      (q) =>
        (q.targetSourceRoles.includes('primary_authority') || q.targetSourceRoles.includes('official_changelog')) &&
        (q.query.toLowerCase().includes('official') || q.query.toLowerCase().includes('docs') || q.query.toLowerCase().includes('pricing'))
    );

    if (!hasOfficialTargetQuery && queries.length > 0) {
      let officialSuffix = 'official documentation specification';
      if (ticket.domain === 'pricing') {
        officialSuffix = 'official pricing plans -calculator -review -blog';
      } else if (ticket.domain === 'regulation') {
        officialSuffix = 'official regulation circular gazette';
      }

      const officialQueryText = `${rawEntity} ${officialSuffix}`.slice(0, MAX_QUERY_LENGTH).trim();
      const targetIdx = queries.length >= 3 ? 0 : queries.length - 1;

      queries[targetIdx] = {
        queryId: `qry_${ticket.ticketId}_r${round}_fp`,
        claimTicketId: ticket.ticketId,
        query: officialQueryText,
        purpose: 'establish_current_state',
        targetSourceRoles: ['primary_authority'],
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
