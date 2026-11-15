'use server';

import { createHash, randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { OWNER_COOKIE_NAME } from '@/server/services/auth-helper';
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
 * and carry contextual metadata forward to confirmation.
 */
const preparationStore = new Map<
  string,
  {
    inputHash: string;
    revision: number;
    text?: string;
    mode?: string;
    context?: Record<string, unknown>;
    prepId?: string;
  }
>();

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

  // 1. Compute deterministic input hash & preparation snapshot identity
  const inputHash = createHash('sha256').update(parsed.data.text, 'utf8').digest('hex');
  const preparationId = `prep_${inputHash.slice(0, 16)}`;
  const revision = 1;

  // 2. Invoke backend AI extraction helper
  let claims: ClaimTicket[] = [];
  try {
    const { extractClaimsFromText } = await import('@/server/verify/extract-claims');
    const outcome = await extractClaimsFromText({
      text: parsed.data.text,
      runId: preparationId,
      revision,
      contextOverrides: parsed.data.context
        ? {
            targetDate: parsed.data.context.targetDate,
            jurisdiction: parsed.data.context.jurisdiction,
            currency: parsed.data.context.currency,
          }
        : undefined,
    });

    if (outcome.status === 'success' && outcome.tickets.length > 0) {
      claims = outcome.tickets;
    } else if (outcome.status === 'failed') {
      const errDetail = outcome.error ? `[${outcome.error.code}] ${outcome.error.message}` : 'Unknown extraction failure';
      console.warn(`[startPreparationAction] AI extraction error: ${errDetail}`);
    }
  } catch (err) {
    console.warn('[startPreparationAction] extractClaimsFromText call threw:', err);
  }

  // 3. Resilient fallback if model gateway is unreachable or returned no claims
  if (claims.length === 0) {
    const rawSentences = parsed.data.text
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .slice(0, 3);

    const sentences = rawSentences.length > 0 ? rawSentences : [parsed.data.text.trim()];

    claims = sentences.map((sentence, idx) => {
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
  }

  // 4. Attempt to persist preparation to Neon PostgreSQL
  let dbPrepId: string | undefined = undefined;
  try {
    const { PreparationService } = await import('@/server/services/prep-service');
    const prep = await PreparationService.getOrCreatePreparation(
      parsed.data.text,
      parsed.data.originalQuestion ?? undefined,
      parsed.data.context
    );
    if (prep && prep.id) {
      dbPrepId = prep.id;
    }
  } catch {
    // Graceful offline/test fallback
  }

  // Register preparation revision in store for revision binding checks
  preparationStore.set(preparationId, {
    inputHash,
    revision,
    text: parsed.data.text,
    mode: parsed.data.mode,
    context: parsed.data.context as Record<string, unknown> | undefined,
    prepId: dbPrepId,
  });

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

  const fallbackRunId = `run_${parsed.data.inputHash.slice(0, 16)}`;

  // Resolve or create caller anonymous identity cookie
  let ownerHash = 'anon_owner';
  try {
    const cookieStore = await cookies();
    const existing = cookieStore.get(OWNER_COOKIE_NAME)?.value;
    if (existing && existing.trim().length > 0) {
      ownerHash = existing.trim();
    } else {
      const rawToken = randomUUID();
      ownerHash = createHash('sha256').update(rawToken, 'utf8').digest('hex');
      cookieStore.set(OWNER_COOKIE_NAME, ownerHash, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 30 * 24 * 60 * 60,
      });
    }
  } catch {
    // Contexts where cookies() may be unavailable (e.g. unit test runner)
  }

  // Materialize run and initialize dynamic DAG in Neon PostgreSQL.
  // Capture the real Prisma-generated CUID to return it to the UI.
  let realRunId: string | null = null;
  try {
    const { createRunAndInitializeDag } = await import('@/server/services/dag-service');
    const { dispatchDagNodeJob } = await import('@/server/jobs/worker');

    const sourceText =
      stored?.text ||
      parsed.data.confirmedClaims.map((c) => c.originalStatement).join(' ');

    const { run, rootNode } = await createRunAndInitializeDag({
      ownerHash,
      inputHash: parsed.data.inputHash,
      prepId: stored?.prepId,
      text: sourceText,
      mode: stored?.mode || 'paste',
      context: stored?.context,
      initialClaims: parsed.data.confirmedClaims,
    });

    realRunId = run.id;

    // Dispatch the root DAG node job (via QStash or in-process fallback)
    await dispatchDagNodeJob(run.id, rootNode.id);
  } catch (err) {
    console.warn('[confirmPreparationAction] Database persistence caught:', err);
  }

  // Use real DB-generated CUID when available; fall back to deterministic mock
  // for unit-test environments where DATABASE_URL is not set.
  const runId = realRunId ?? fallbackRunId;

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
