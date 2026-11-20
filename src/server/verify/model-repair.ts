import { bifrostChat, BifrostError } from '@/server/bifrost/client';
import { getModelProfile } from '@/server/bifrost/profiles';

export interface ModelRepairRequest<T> {
  task: 'extract' | 'assess' | 'draft';
  sourceText?: string;
  untrustedCandidateText: string;
  failureReason: string;
  schemaRules: string;
  deadlineMs?: number;
  validator: (raw: string) => { success: true; data: T } | { success: false; error: string };
}

export interface ModelRepairResult<T> {
  repaired: boolean;
  data: T;
  repairAttempts: number;
}

export class ModelRepairExhaustedError extends Error {
  public readonly code = 'MODEL_REPAIR_EXHAUSTED';
  constructor(message: string) {
    super(message);
    this.name = 'ModelRepairExhaustedError';
  }
}

export class NonRepairableModelError extends Error {
  public readonly code = 'NON_REPAIRABLE_MODEL_ERROR';
  constructor(message: string) {
    super(message);
    this.name = 'NonRepairableModelError';
  }
}

/**
 * Checks whether an error is non-repairable by a model (transport failure, timeout, 429, missing server IDs).
 */
export function isNonRepairableFailure(error: unknown): boolean {
  if (error instanceof BifrostError) {
    // 429 quota, 500+ transport/provider failures are non-repairable
    if (error.statusCode === 429 || error.statusCode >= 500) {
      return true;
    }
  }
  if (error instanceof Error) {
    if (error.name === 'AbortError' || error.message.includes('timeout')) {
      return true;
    }
    if (
      error.message.includes('runId') ||
      error.message.includes('claimId') ||
      error.message.includes('claimTicketId') ||
      error.message.includes('identity')
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Executes a single bounded model repair pass (at most 1 generation).
 * Preserves existing bounds (deadlines, budgets) and validates output with the provided validator.
 */
export async function executeBoundedModelRepair<T>(
  request: ModelRepairRequest<T>
): Promise<ModelRepairResult<T>> {
  const { task, sourceText, untrustedCandidateText, failureReason, schemaRules, deadlineMs, validator } = request;

  // Rule 7.3: Check deadline budget
  if (deadlineMs !== undefined && deadlineMs <= 0) {
    throw new ModelRepairExhaustedError('Stage deadline expired; skipping model repair generation');
  }

  const systemPrompt =
    'You are a strict data repair engine for an automated verification system. ' +
    'Your sole responsibility is to correct the provided malformed or schema-violating candidate JSON output. ' +
    'Return ONLY valid JSON that strictly conforms to the schema rules. ' +
    'Do not include markdown code fences, commentary, or conversational text. ' +
    'CRITICAL: Statements and excerpts MUST be character-for-character verbatim substrings of the source text. ' +
    'Do not drop negation, change scope, invent facts, or omit claims to satisfy validation.';

  const userPrompt = [
    `Task: ${task}`,
    sourceText ? `Source Text (exact):\n"""\n${sourceText}\n"""` : null,
    `Validation Failure Reason:\n${failureReason}`,
    `Schema Rules:\n${schemaRules}`,
    `Untrusted Candidate Output:\n"""\n${untrustedCandidateText}\n"""`,
    'Please repair the candidate output to satisfy all schema rules and exact verbatim grounding requirements.',
  ]
    .filter(Boolean)
    .join('\n\n');

  let rawRepaired: string;
  try {
    rawRepaired = await bifrostChat({
      role: task,
      model: getModelProfile(task),
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      enableFallback: true,
      timeoutMs: deadlineMs ? Math.min(deadlineMs, 30000) : 30000,
    });
  } catch (err) {
    throw new NonRepairableModelError(
      `Model repair request failed due to provider error: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  // Strip markdown fencing if model included it
  const cleanRepaired = rawRepaired.trim().replace(/^```(?:json)?\s*([\s\S]*?)\s*```$/i, '$1').trim();

  // Re-run validation (Rule 7.5)
  const validation = validator(cleanRepaired);
  if (!validation.success) {
    throw new ModelRepairExhaustedError(
      `Repaired model output failed post-repair validation: ${validation.error}`
    );
  }

  return {
    repaired: true,
    data: validation.data,
    repairAttempts: 1,
  };
}
