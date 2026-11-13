'use server';

import { createHash } from 'node:crypto';
import { z } from 'zod';
import {
  StartPreparationActionInputSchema,
  StartPreparationActionResultSchema,
  ConfirmPreparationActionInputSchema,
  ConfirmPreparationActionResultSchema,
  type StartPreparationActionInput,
  type StartPreparationActionResult,
  type ConfirmPreparationActionInput,
  type ConfirmPreparationActionResult,
} from '@/lib/contracts/actions';
import type { ClaimTicket, VerificationProperty } from '@/lib/contracts/claim-ticket';

export type StartPreparationActionRawInput = z.input<typeof StartPreparationActionInputSchema>;
export type ConfirmPreparationActionRawInput = z.input<typeof ConfirmPreparationActionInputSchema>;

export type ActionResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string; code: string; issues?: z.ZodIssue[] };

/**
 * In-memory preparation revision store to enforce revision binding (TC-08)
 * until replaced by persistent Neon PostgreSQL storage in Task B04b.
 */
const preparationStore = new Map<string, { inputHash: string; revision: number }>();

/**
 * Initiates the interactive preparation workflow.
 * Validates the input payload, computes the deterministic inputHash, and extracts candidate claim tickets.
 */
export async function startPreparationAction(
  input: StartPreparationActionRawInput
): Promise<ActionResponse<StartPreparationActionResult>> {
  const parsed = StartPreparationActionInputSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    let code = 'INVALID_PAYLOAD_SHAPE';
    if (issue?.message?.includes('exceeds maximum length')) {
      code = 'INPUT_EXCEEDS_MAX_LENGTH';
    } else if (issue?.message?.includes('cannot be empty')) {
      code = 'INPUT_EMPTY_OR_WHITESPACE';
    }
    return {
      success: false,
      error: issue?.message || 'Invalid input payload',
      code,
      issues: parsed.error.issues,
    };
  }

  if (parsed.data.text.trim().length === 0) {
    return {
      success: false,
      error: 'Input text cannot be empty or whitespace-only',
      code: 'INPUT_EMPTY_OR_WHITESPACE',
    };
  }

  // Simulate minimal async processing latency
  await new Promise((resolve) => setTimeout(resolve, 30));

  // TODO(B04b): Replace mock with PreparationService / DagService
  const inputHash = createHash('sha256').update(parsed.data.text, 'utf8').digest('hex');
  const preparationId = `prep_${inputHash.slice(0, 16)}`;
  const revision = 1;

  // Split input text into atomic candidate sentences (up to 3 for preparation preview)
  const rawSentences = parsed.data.text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .slice(0, 3);

  const sentences = rawSentences.length > 0 ? rawSentences : [parsed.data.text.trim()];

  const claims: ClaimTicket[] = sentences.map((sentence, idx) => {
    const claimId = `clm_prep_${idx + 1}`;
    const startIdx = parsed.data.text.indexOf(sentence);
    const sourceSpan = startIdx >= 0 ? { start: startIdx, end: startIdx + sentence.length } : null;

    const verificationContext: VerificationProperty[] = [];
    if (parsed.data.context?.jurisdiction) {
      verificationContext.push({
        key: 'jurisdiction',
        label: 'Geographic Jurisdiction',
        propertyType: 'string',
        value: parsed.data.context.jurisdiction,
        origin: 'user_target_context',
        status: 'confirmed',
        applicability: 'claim_level',
      });
    }
    if (parsed.data.context?.targetDate) {
      verificationContext.push({
        key: 'targetDate',
        label: 'Target Evaluation Date',
        propertyType: 'date',
        value: parsed.data.context.targetDate,
        origin: 'user_target_context',
        status: 'confirmed',
        applicability: 'run_level',
      });
    }

    return {
      ticketId: `tkt_${claimId}_r${revision}`,
      claimId,
      runId: `run_${inputHash.slice(0, 12)}`,
      inputHash,
      revision,
      originalStatement: sentence,
      sourceSpan,
      normalizedProposition: sentence,
      domain: 'generic',
      targetTime: parsed.data.context?.targetDate ?? '2026-11-12',
      verificationContext,
      missingMaterialContext: [],
    };
  });

  // Register preparation revision in store for revision binding checks
  preparationStore.set(preparationId, { inputHash, revision });

  const result: StartPreparationActionResult = {
    preparationId,
    inputHash,
    revision,
    status: 'ready',
    claims,
  };

  StartPreparationActionResultSchema.parse(result);

  return {
    success: true,
    data: result,
  };
}

/**
 * Confirms the prepared claims and materializes the DAG run.
 * Enforces revision binding (TC-08) by verifying inputHash matches the preparation snapshot.
 */
export async function confirmPreparationAction(
  input: ConfirmPreparationActionRawInput
): Promise<ActionResponse<ConfirmPreparationActionResult>> {
  const parsed = ConfirmPreparationActionInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || 'Invalid confirmation payload',
      code: 'INVALID_PAYLOAD_SHAPE',
      issues: parsed.error.issues,
    };
  }

  // Simulate minimal async processing latency
  await new Promise((resolve) => setTimeout(resolve, 30));

  // Enforce revision binding (TC-08): reject mismatched inputHash values
  const stored = preparationStore.get(parsed.data.preparationId);
  const hasHashMismatch =
    (stored && stored.inputHash !== parsed.data.inputHash) ||
    parsed.data.confirmedClaims.some((claim) => claim.inputHash !== parsed.data.inputHash);

  if (hasHashMismatch) {
    return {
      success: false,
      error: 'Text was edited after preparation; requires fresh extraction.',
      code: 'STALE_PREPARATION_REVISION',
    };
  }

  // TODO(B04b): Replace mock with PreparationService / DagService
  const runId = `run_${parsed.data.inputHash.slice(0, 16)}`;
  const result: ConfirmPreparationActionResult = {
    runId,
    status: 'running',
    graphVersion: 1,
    streamUrl: `/api/v1/runs/${runId}/stream`,
  };

  ConfirmPreparationActionResultSchema.parse(result);

  return {
    success: true,
    data: result,
  };
}

/**
 * Test utility helpers for managing the preparation in-memory store.
 */
export async function _clearPreparationStore(): Promise<void> {
  preparationStore.clear();
}

export async function _setPreparationStore(
  preparationId: string,
  record: { inputHash: string; revision: number }
): Promise<void> {
  preparationStore.set(preparationId, record);
}

/**
 * Submits user clarification answers to resume a paused DAG branch.
 * Uses dynamic import of ClarificationService to avoid bundling heavy DB/QStash
 * dependencies into the initial Server Action module (keeps cold starts fast).
 * When B04b is not live, the dynamic import throws → error is caught cleanly.
 */
export async function submitClarificationAction(input: {
  clarificationId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  answer: any;
}): Promise<ActionResponse<{ accepted: true }>> {
  try {
    // Dynamic import prevents bundling DB client into the initial Server Action module
    const { ClarificationService } = await import(
      '@/server/services/clarification-service'
    );

    await ClarificationService.resumeWithAnswer(
      input.clarificationId,
      input.answer
    );

    return { success: true, data: { accepted: true } };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Clarification submission failed';
    const code =
      err instanceof Error && 'code' in err
        ? String((err as Error & { code?: string }).code)
        : 'CLARIFICATION_SUBMISSION_FAILED';
    return { success: false, error: message, code };
  }
}

export type {
  StartPreparationActionInput,
  StartPreparationActionResult,
  ConfirmPreparationActionInput,
  ConfirmPreparationActionResult,
};
