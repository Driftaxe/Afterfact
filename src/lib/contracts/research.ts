import { z } from 'zod';

/**
 * Authority tiers for research sources.
 */
export const SourceRoleSchema = z.enum([
  'primary_authority',    // Official vendor docs, pricing catalogs, statutory registers
  'regulatory_filing',    // SEC 8-K/10-K, EUR-Lex gazette, official legal text
  'official_changelog',   // Release notes, GitHub releases, API deprecation logs
  'reputable_secondary',  // Major news outlets, recognized industry analysis
  'counter_perspective', // Investigative reports, policy audits, dispute reports
]);
export type SourceRole = z.infer<typeof SourceRoleSchema>;

/**
 * Epistemic purpose of an individual research query.
 */
export const PlannedQueryPurposeSchema = z.enum([
  'establish_current_state',                  // Discover currently active value, version, or policy
  'investigate_exceptions_or_scope',          // Discover regional, tier, or edge-case variations
  'seek_counterevidence',                     // Search for deprecation, disputes, or contradiction
  'establish_historical_state_or_transition', // Locate past validity dates or transition events
]);
export type PlannedQueryPurpose = z.infer<typeof PlannedQueryPurposeSchema>;

/**
 * Maximum queries and rounds enforced per research plan to bound API spend.
 */
export const MAX_QUERIES_PER_PLAN = 6;
export const MAX_RESEARCH_ROUNDS = 2;
export const MAX_QUERY_LENGTH = 200;

/**
 * Planned research query specification.
 */
export const PlannedQuerySchema = z.object({
  queryId: z.string().min(1, { message: 'Query ID is required' }),
  claimTicketId: z.string().min(1, { message: 'Claim ticket ID is required' }),
  query: z
    .string()
    .min(1, { message: 'Query cannot be empty' })
    .max(MAX_QUERY_LENGTH, { message: `Query cannot exceed ${MAX_QUERY_LENGTH} characters` })
    .refine((q) => q.trim().length > 0, { message: 'Query cannot be whitespace-only' }),
  purpose: PlannedQueryPurposeSchema,
  targetSourceRoles: z.array(SourceRoleSchema).min(1, { message: 'At least one target source role is required' }),
  scopeHints: z.record(z.string(), z.string()).optional(),
  round: z.number().int().min(1).max(MAX_RESEARCH_ROUNDS).default(1),
});

export type PlannedQuery = z.infer<typeof PlannedQuerySchema>;

/**
 * Structured Research Plan Schema.
 * Downstream search and extraction adapters execute against this plan.
 */
export const ResearchPlanSchema = z
  .object({
    planId: z.string().min(1, { message: 'Plan ID is required' }),
    claimTicketId: z.string().min(1, { message: 'Claim ticket ID is required' }),
    runId: z.string().min(1, { message: 'Run ID is required' }),
    revision: z.number().int().min(1, { message: 'Revision must be >= 1' }),
    round: z.number().int().min(1).max(MAX_RESEARCH_ROUNDS, {
      message: `Research rounds are bounded to at most ${MAX_RESEARCH_ROUNDS}`,
    }),
    queries: z
      .array(PlannedQuerySchema)
      .min(1, { message: 'Research plan must have at least one query' })
      .max(MAX_QUERIES_PER_PLAN, {
        message: `Research plan queries cannot exceed configured budget of ${MAX_QUERIES_PER_PLAN}`,
      }),
    materialUnknownQualifiers: z.array(z.string()).default([]),
    stoppingConditions: z.array(z.string()).min(1, { message: 'At least one stopping condition is required' }),
    requiresCounterevidenceQuery: z.boolean().default(false),
  })
  .superRefine((plan, ctx) => {
    // If plan explicitly requires counterevidence, verify at least one query is purpose 'seek_counterevidence'
    if (plan.requiresCounterevidenceQuery) {
      const hasCounterQuery = plan.queries.some((q) => q.purpose === 'seek_counterevidence');
      if (!hasCounterQuery) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['queries'],
          message: "Research plan requires at least one query with purpose 'seek_counterevidence'",
        });
      }
    }
  });

export type ResearchPlan = z.infer<typeof ResearchPlanSchema>;
