import { createHash } from 'node:crypto';
import { db } from '@/server/db/client';
import { createRunAndInitializeDag } from '@/server/services/dag-service';
import { dispatchDagNodeJob } from '@/server/jobs/worker';
import type { VerificationRequest } from '@/lib/contracts/request';

export interface VerificationServiceOptions {
  ownerHash: string;
  idempotencyKey?: string;
}

export interface VerificationResult {
  runId: string;
  state: string;
  createdAt: string;
  snapshotUrl: string;
  streamUrl: string;
}

export class VerificationService {
  /**
   * Orchestrates the headless verification workflow:
   * 1. Extracts deterministic input text, mode, and context qualifiers.
   * 2. Checks client idempotency key for replay or conflict.
   * 3. Enforces owner rate limit (10 runs / 10 minutes).
   * 4. Persists the VerificationRun and initial DAG nodes within a database transaction.
   * 5. Dispatches the initial root node job to QStash.
   */
  static async runVerification(
    input: VerificationRequest,
    options: VerificationServiceOptions
  ): Promise<VerificationResult> {
    const ownerHash = options.ownerHash;
    const idempotencyKey = options.idempotencyKey?.trim() || undefined;

    const text = input.mode === 'paste' ? input.answerText : input.question;
    const question =
      input.mode === 'paste' ? input.originalQuestion ?? undefined : input.question;
    const context = (input.context ?? {}) as Record<string, unknown>;

    const inputHash = createHash('sha256').update(text, 'utf8').digest('hex');

    // 1. Check idempotency if key provided
    if (idempotencyKey) {
      const existing = await db.verificationRun.findUnique({
        where: {
          ownerHash_idempotencyKey: {
            ownerHash,
            idempotencyKey,
          },
        },
      });

      if (existing) {
        if (existing.inputHash !== inputHash) {
          const err = new Error(
            `Reusing idempotency key '${idempotencyKey}' with differing input payload.`
          );
          (err as Error & { code: string; status: number }).code = 'IDEMPOTENCY_KEY_CONFLICT';
          (err as Error & { code: string; status: number }).status = 409;
          throw err;
        }

        // Return existing run idempotently
        return {
          runId: existing.id,
          state: existing.state,
          createdAt: existing.createdAt.toISOString(),
          snapshotUrl: `/api/runs/${existing.id}`,
          streamUrl: `/api/runs/${existing.id}/events`,
        };
      }
    }

    // 2. Enforce rate limiting: 10 runs per 10 minutes per ownerHash
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const recentCount = await db.verificationRun.count({
      where: {
        ownerHash,
        createdAt: { gte: tenMinutesAgo },
      },
    });

    if (recentCount >= 10) {
      const err = new Error('Owner exceeded rate limit (10 runs / 10 minutes).');
      (err as Error & { code: string; status: number }).code = 'RATE_LIMIT_EXCEEDED';
      (err as Error & { code: string; status: number }).status = 429;
      throw err;
    }

    // 3. Persist run and initialize DAG (root_extract_prep -> finalize_run)
    const { run, rootNode } = await createRunAndInitializeDag({
      ownerHash,
      inputHash,
      text,
      question,
      mode: input.mode,
      context,
      idempotencyKey,
    });

    // 4. Dispatch the root node job to QStash
    try {
      await dispatchDagNodeJob(run.id, rootNode.id);
    } catch {
      // Background dispatch errors should not fail the 202 submission response;
      // the recovery sweeper will re-dispatch pending unleased root nodes.
    }

    return {
      runId: run.id,
      state: run.state,
      createdAt: run.createdAt.toISOString(),
      snapshotUrl: `/api/runs/${run.id}`,
      streamUrl: `/api/runs/${run.id}/events`,
    };
  }
}
