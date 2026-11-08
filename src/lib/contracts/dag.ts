import { z } from 'zod';
import { IsoTimestampSchema } from './dates';

/**
 * Stages in the dynamic verification Directed Acyclic Graph (DAG).
 */
export const DagStageSchema = z.enum([
  'root_extract_prep', // Extract atomic claims & qualifiers from answer text
  'plan_research',     // Formulate query strategy & counterevidence requirements
  'search_evidence',   // Execute web retrieval via Tavily search
  'extract_evidence',  // Context-preserving passage extraction
  'rank_evidence',     // Candidate ranking (optional vector shortlisting)
  'assess_evidence',   // Semantic & temporal relation assessment
  'clarification_wait',// Paused awaiting user answer to clarification question
  'reassess_evidence', // Targeted reassessment after clarification
  'decide_claim',      // Deterministic decision gate and score assignment
  'finalize_run',      // Aggregate rollup and run completion
]);
export type DagStage = z.infer<typeof DagStageSchema>;

/**
 * Execution states for an individual DAG node.
 */
export const DagNodeStateSchema = z.enum([
  'pending',           // Ready for worker lease acquisition
  'leased',            // Currently held by worker under database lease
  'waiting_for_input', // Paused awaiting user clarification (leaseToken cleared)
  'completed',         // Successfully executed with recorded outputReference
  'failed',            // Terminal failure after exhaustion of retries
  'skipped',           // Bypassed due to early stopping or predecessor failure
]);
export type DagNodeState = z.infer<typeof DagNodeStateSchema>;

/**
 * Discriminated Stage Payloads.
 */
export const PlanResearchPayloadSchema = z.object({
  stage: z.literal('plan_research'),
  claimTicketId: z.string().min(1),
  round: z.number().int().min(1).max(2).default(1),
});

export const SearchEvidencePayloadSchema = z.object({
  stage: z.literal('search_evidence'),
  planId: z.string().min(1),
  query: z.string().min(1),
});

export const ExtractEvidencePayloadSchema = z.object({
  stage: z.literal('extract_evidence'),
  sourceDocumentId: z.string().min(1),
  claimTicketId: z.string().min(1),
});

export const RankEvidencePayloadSchema = z.object({
  stage: z.literal('rank_evidence'),
  claimTicketId: z.string().min(1),
  candidateEvidenceIds: z.array(z.string()).default([]),
  vectorShortlistingApplied: z.boolean().default(false),
  similarityRankings: z
    .array(
      z.object({
        evidenceId: z.string(),
        candidateScore: z.number(),
      })
    )
    .optional(),
});

export const AssessEvidencePayloadSchema = z.object({
  stage: z.literal('assess_evidence'),
  claimTicketId: z.string().min(1),
  evidenceUnitIds: z.array(z.string()).min(1),
});

export const ClarificationWaitPayloadSchema = z.object({
  stage: z.literal('clarification_wait'),
  claimTicketId: z.string().min(1),
  questionSetId: z.string().min(1),
});

export const DecideClaimPayloadSchema = z.object({
  stage: z.literal('decide_claim'),
  claimTicketId: z.string().min(1),
  assessmentIds: z.array(z.string()).min(1),
});

export const FinalizeRunPayloadSchema = z.object({
  stage: z.literal('finalize_run'),
  runId: z.string().min(1),
});

export const DagStagePayloadSchema = z.discriminatedUnion('stage', [
  PlanResearchPayloadSchema,
  SearchEvidencePayloadSchema,
  ExtractEvidencePayloadSchema,
  RankEvidencePayloadSchema,
  AssessEvidencePayloadSchema,
  ClarificationWaitPayloadSchema,
  DecideClaimPayloadSchema,
  FinalizeRunPayloadSchema,
]);
export type DagStagePayload = z.infer<typeof DagStagePayloadSchema>;

/**
 * Structured error metadata for failed nodes.
 */
export const DagNodeErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  retryable: z.boolean().default(false),
});
export type DagNodeError = z.infer<typeof DagNodeErrorSchema>;

/**
 * Maximum node limits per run to bound execution graphs and prevent runaway DAG recursion.
 *
 * Scope, Policy & Budget Derivation:
 * - Common run overhead: root_extract_prep + finalize_run = 2 nodes.
 * - Single-claim baseline (DATA-AND-JOBS.md §3.5): 16 nodes maximum.
 *   Covers: 2 run nodes + up to 14 branch nodes.
 * - Intentional Execution Budget (MAX_DAG_NODES_PER_RUN = 52):
 *   52 is an intentional execution/cost budget for this release to protect serverless function
 *   execution durations and QStash worker delivery, NOT a claim that every branch can exhaust
 *   every optional research and clarification allowance simultaneously.
 * - Relationship to Input & Claim Extraction Rules:
 *   Extraction scope is governed by character boundaries (MAX_PASTE_LENGTH = 8,000 chars,
 *   MAX_ASK_LENGTH = 800 chars in request.ts). There is no artificial product-level limit of 5 claims.
 *   The 5-claim baseline (Golden Mixed Report benchmark) calibrates the nominal budget allocation:
 *   2 run overhead + 5 claims * 10 nodes per branch = 52 nodes.
 * - Upper Bounds vs Shared Budget:
 *   Individual stage upper bounds per claim (max 2 research rounds per VERIFICATION.md §3.C,
 *   max 2 clarification rounds per VERIFICATION.md §2, max 1 rank node per ARCHITECTURE.md §4.1)
 *   define individual branch capabilities. The shared node budget can stop optional expansion
 *   before those individual upper bounds are reached.
 *   The complete theoretical combination of all optional stages across multiple branches can exceed 52.
 * - Reaching the budget does NOT mean a claim is false or missing context.
 *
 * Platform Runtime Ownership (B04b / B05):
 * - Platform workers must check proposed expansion against the authoritative persisted graph
 *   and applicable budget before accepting it.
 * - Platform workers must reserve capacity for required decision/finalization work, or account for
 *   those nodes in the graph before allocating optional work.
 * - Budget rejection must fail closed safely and not strand the run.
 * - If evidence is insufficient when budget is exhausted, the verifier assigns an appropriate
 *   unresolved verdict with a null score, recording BUDGET_EXHAUSTED as the limitation/reason.
 * - ESSENTIAL_CONTEXT_MISSING is used only when essential context is actually missing;
 *   the two conditions may coexist but are not interchangeable.
 * - Database atomicity, concurrency, scheduling and terminal recovery remain platform responsibilities.
 */
export const RUN_OVERHEAD_DAG_NODES = 2;
export const MAX_NODES_PER_CLAIM_BRANCH = 10;
export const BENCHMARK_CLAIM_COUNT = 5;
export const SUPPORTED_MAX_CLAIMS_PER_RUN = 5; // Retained alias for benchmark mixed report capacity
export const SINGLE_CLAIM_MAX_DAG_NODES = 16;
export const MAX_DAG_NODES_PER_RUN = 52;
export const MAX_DAG_DEPTH = 5;
export const MAX_NODE_ATTEMPTS = 3;

/**
 * Calculates the maximum allowable DAG nodes for a run with N claims based on documented budgets.
 * - claimCount = 0 adheres to the documented empty-run policy (root_extract_prep + finalize_run = 2 nodes).
 * - claimCount = 1 retains the documented baseline of SINGLE_CLAIM_MAX_DAG_NODES (16).
 * - claimCount >= 2 scales by RUN_OVERHEAD_DAG_NODES + N * MAX_NODES_PER_CLAIM_BRANCH.
 * - All results are clamped so they cannot exceed the hard ceiling MAX_DAG_NODES_PER_RUN (52).
 * - Validates input: rejects NaN, Infinity, negative values, and non-integers.
 */
export function computeMaxDagNodes(claimCount: number = 1): number {
  if (
    typeof claimCount !== 'number' ||
    Number.isNaN(claimCount) ||
    !Number.isFinite(claimCount) ||
    !Number.isInteger(claimCount) ||
    claimCount < 0
  ) {
    throw new RangeError(
      `Invalid claimCount: must be a non-negative finite integer >= 0 (received: ${claimCount})`
    );
  }

  if (claimCount === 0) {
    return RUN_OVERHEAD_DAG_NODES;
  }

  const calculated = Math.max(
    SINGLE_CLAIM_MAX_DAG_NODES,
    RUN_OVERHEAD_DAG_NODES + claimCount * MAX_NODES_PER_CLAIM_BRANCH
  );
  return Math.min(MAX_DAG_NODES_PER_RUN, calculated);
}

/**
 * Options for DAG validation and expansion budget enforcement.
 */
export interface DagBudgetOptions {
  maxNodes?: number;
  claimCount?: number;
}

/**
 * Resolves the effective maximum DAG nodes enforcing the authoritative budget policy.
 * When both claimCount and maxNodes are supplied, neither constraint may silently override the tighter one.
 *
 * effectiveMax = minimum of:
 * - the hard run ceiling (MAX_DAG_NODES_PER_RUN = 52);
 * - the claim-count-derived budget, when supplied (computeMaxDagNodes(claimCount));
 * - the explicit maxNodes limit, when supplied.
 *
 * Validates options at the exported boundary: rejects NaN, Infinity, fractional counts/limits,
 * negative values, and zero node limits (maxNodes <= 0).
 */
export function resolveEffectiveMaxDagNodes(options?: DagBudgetOptions): number {
  let effectiveMax = MAX_DAG_NODES_PER_RUN;

  if (!options) {
    return effectiveMax;
  }

  if (options.claimCount !== undefined) {
    const claimBudget = computeMaxDagNodes(options.claimCount);
    effectiveMax = Math.min(effectiveMax, claimBudget);
  }

  if (options.maxNodes !== undefined) {
    if (
      typeof options.maxNodes !== 'number' ||
      Number.isNaN(options.maxNodes) ||
      !Number.isFinite(options.maxNodes) ||
      !Number.isInteger(options.maxNodes) ||
      options.maxNodes < 1
    ) {
      throw new RangeError(
        `Invalid maxNodes: must be a positive finite integer >= 1 (received: ${options.maxNodes})`
      );
    }
    effectiveMax = Math.min(effectiveMax, options.maxNodes);
  }

  return effectiveMax;
}

/**
 * Specification of an individual DAG node.
 */
export const DagNodeSpecSchema = z
  .object({
    id: z.string().min(1, { message: 'Node ID is required' }),
    runId: z.string().min(1, { message: 'Run ID is required' }),
    claimId: z.string().nullable().optional(),
    stage: DagStageSchema,
    state: DagNodeStateSchema,
    dependencies: z.array(z.string()).default([]),
    attempt: z.number().int().min(0).max(MAX_NODE_ATTEMPTS).default(0),
    leaseToken: z.string().nullable().optional(),
    leaseUntil: IsoTimestampSchema.nullable().optional(),
    outputReference: z.record(z.string(), z.any()).nullable().optional(),
    error: DagNodeErrorSchema.nullable().optional(),
    stagePayload: DagStagePayloadSchema.nullable().optional(),
    // Internal fields that must never leak to public progress
    internalPrompt: z.string().optional(),
    rawProviderError: z.string().optional(),
  })
  .superRefine((node, ctx) => {
    // 1. Terminal completed state requires outputReference
    if (node.state === 'completed' && (!node.outputReference || Object.keys(node.outputReference).length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['outputReference'],
        message: "Completed DAG node requires a non-empty outputReference",
      });
    }

    // 2. Terminal failed state requires error details
    if (node.state === 'failed' && !node.error) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['error'],
        message: "Failed DAG node requires structured error metadata",
      });
    }

    // 3. Waiting for input state must explicitly clear leaseToken and leaseUntil
    if (node.state === 'waiting_for_input') {
      if (node.leaseToken !== null && node.leaseToken !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['leaseToken'],
          message: "Node in 'waiting_for_input' state must have leaseToken set to null",
        });
      }
    }
  });

export type DagNodeSpec = z.infer<typeof DagNodeSpecSchema>;

/**
 * Specification of a DAG Edge.
 */
export const DagEdgeSpecSchema = z.object({
  id: z.string().optional(),
  runId: z.string().min(1),
  fromNodeId: z.string().min(1),
  toNodeId: z.string().min(1),
  condition: z.string().optional(),
});
export type DagEdgeSpec = z.infer<typeof DagEdgeSpecSchema>;

/**
 * Snapshot of a full DAG run graph.
 */
export const DagGraphSnapshotSchema = z.object({
  runId: z.string().min(1),
  revision: z.number().int().min(1),
  nodes: z
    .array(DagNodeSpecSchema)
    .min(1, { message: 'Graph must contain at least one node' })
    .max(MAX_DAG_NODES_PER_RUN, {
      message: `DAG nodes exceed maximum limit of ${MAX_DAG_NODES_PER_RUN} nodes per run`,
    }),
  edges: z.array(DagEdgeSpecSchema).optional(),
});
export type DagGraphSnapshot = z.infer<typeof DagGraphSnapshotSchema>;

/**
 * Pure graph validator enforcing structural invariants:
 * - Unique node IDs.
 * - Uniform runId across all nodes.
 * - All dependencies exist within the node set.
 * - No self-dependency (node cannot depend on itself).
 * - No directed cycles (DFS cycle detection).
 */
export function validateDagGraph(
  graph: DagGraphSnapshot,
  options?: DagBudgetOptions
): { valid: boolean; error?: string } {
  let effectiveMax: number;
  try {
    effectiveMax = resolveEffectiveMaxDagNodes(options);
  } catch (err) {
    return {
      valid: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  if (graph.nodes.length > effectiveMax) {
    return {
      valid: false,
      error: `DAG nodes (${graph.nodes.length}) exceed maximum allowable budget of ${effectiveMax} nodes`,
    };
  }

  const nodeMap = new Map<string, DagNodeSpec>();

  // 1. Unique node IDs and uniform runId
  for (const node of graph.nodes) {
    if (node.runId !== graph.runId) {
      return {
        valid: false,
        error: `Cross-run reference detected: Node '${node.id}' has runId '${node.runId}', but graph is runId '${graph.runId}'`,
      };
    }

    if (nodeMap.has(node.id)) {
      return {
        valid: false,
        error: `Duplicate node ID in DAG graph: '${node.id}'`,
      };
    }
    nodeMap.set(node.id, node);
  }

  // 2. Check dependencies exist and no self-loops
  for (const node of graph.nodes) {
    for (const depId of node.dependencies) {
      if (depId === node.id) {
        return {
          valid: false,
          error: `Self-dependency detected: Node '${node.id}' depends on itself`,
        };
      }

      if (!nodeMap.has(depId)) {
        return {
          valid: false,
          error: `Missing dependency: Node '${node.id}' depends on unknown node '${depId}'`,
        };
      }
    }
  }

  // 3. Cycle Detection via DFS (3-color marking: 0=unvisited, 1=visiting, 2=visited)
  const visited = new Map<string, number>();
  for (const nodeId of nodeMap.keys()) {
    visited.set(nodeId, 0);
  }

  function hasCycle(nodeId: string, path: string[]): boolean {
    visited.set(nodeId, 1);
    path.push(nodeId);

    const node = nodeMap.get(nodeId);
    if (node) {
      for (const depId of node.dependencies) {
        const state = visited.get(depId);
        if (state === 1) {
          // Found cycle
          path.push(depId);
          return true;
        }
        if (state === 0) {
          if (hasCycle(depId, path)) return true;
        }
      }
    }

    visited.set(nodeId, 2);
    path.pop();
    return false;
  }

  for (const nodeId of nodeMap.keys()) {
    if (visited.get(nodeId) === 0) {
      const cyclePath: string[] = [];
      if (hasCycle(nodeId, cyclePath)) {
        return {
          valid: false,
          error: `Directed cycle detected in DAG: ${cyclePath.join(' -> ')}`,
        };
      }
    }
  }

  return { valid: true };
}

/**
 * Validates dynamic expansion of a graph by checking proposed new nodes against existing graph.
 * Enforces the authoritative budget policy:
 * - Checks combined node count against effectiveMax (from options or schema ceiling).
 * - Guarantees that expansion cannot exceed configured or schema budget limits.
 */
export function validateDagExpansion(
  existingGraph: DagGraphSnapshot,
  proposedNodes: DagNodeSpec[],
  options?: DagBudgetOptions
): { valid: boolean; error?: string } {
  let effectiveMax: number;
  try {
    effectiveMax = resolveEffectiveMaxDagNodes(options);
  } catch (err) {
    return {
      valid: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  const combinedCount = existingGraph.nodes.length + proposedNodes.length;
  if (combinedCount > effectiveMax) {
    return {
      valid: false,
      error: `Proposed expansion exceeds maximum limit of ${effectiveMax} nodes (current: ${existingGraph.nodes.length}, proposed: ${proposedNodes.length})`,
    };
  }

  const combinedNodes = [...existingGraph.nodes, ...proposedNodes];
  const combinedSnapshot: DagGraphSnapshot = {
    runId: existingGraph.runId,
    revision: existingGraph.revision + 1,
    nodes: combinedNodes,
  };

  return validateDagGraph(combinedSnapshot, options);
}

/**
 * Sanitized public progress projection schema.
 * Strictly guarantees that internal prompts, credentials, raw provider errors,
 * lease tokens, and canary strings are omitted from client exposure.
 */
export const SanitizedPublicProgressSchema = z
  .object({
    nodeId: z.string(),
    runId: z.string(),
    stage: DagStageSchema,
    state: DagNodeStateSchema,
    claimId: z.string().nullable().optional(),
    attempt: z.number().int().nonnegative(),
    isTerminal: z.boolean(),
    publicMessage: z.string(),
  })
  .strict();

export type SanitizedPublicProgress = z.infer<typeof SanitizedPublicProgressSchema>;

/**
 * Pure projection function scrubbing private internal fields from a DagNodeSpec.
 */
export function sanitizePublicProgress(node: DagNodeSpec): SanitizedPublicProgress {
  const stageLabels: Record<DagStage, string> = {
    root_extract_prep: 'Extracting claims and qualifiers',
    plan_research: 'Formulating research plan',
    search_evidence: 'Retrieving authoritative sources',
    extract_evidence: 'Extracting grounded evidence passages',
    rank_evidence: 'Shortlisting and ranking evidence',
    assess_evidence: 'Evaluating evidence against claim context',
    clarification_wait: 'Awaiting user clarification',
    reassess_evidence: 'Reassessing evidence with clarified context',
    decide_claim: 'Synthesizing final verified verdict',
    finalize_run: 'Finalizing verification report',
  };

  const isTerminal = ['completed', 'failed', 'skipped'].includes(node.state);
  const publicMessage = node.state === 'failed'
    ? 'Verification node encountered an issue'
    : stageLabels[node.stage] || 'Processing';

  return SanitizedPublicProgressSchema.parse({
    nodeId: node.id,
    runId: node.runId,
    stage: node.stage,
    state: node.state,
    claimId: node.claimId,
    attempt: node.attempt,
    isTerminal,
    publicMessage,
  });
}
