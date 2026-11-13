import { db } from '@/server/db/client';
import { Prisma } from '@prisma/client';
import { dispatchDagNodeJob } from '@/server/jobs/worker';

export interface PauseClarificationParams {
  runId: string;
  nodeId: string;
  claimId?: string;
  questionText: string;
  questionDefinition?: Prisma.InputJsonValue;
  options?: string[];
}

export class ClarificationService {
  /**
   * Protocol C: Pauses a DAG branch for user clarification,
   * holding ZERO worker leases and ZERO open database locks.
   */
  static async pauseForClarification(params: PauseClarificationParams) {
    const { runId, nodeId, claimId, questionText, questionDefinition, options } = params;

    const def: Prisma.InputJsonValue = questionDefinition ?? {
      fieldId: 'clarification_field',
      label: questionText,
      fieldType: options && options.length > 0 ? 'select' : 'short text',
      options: options ?? [],
      allowUnknown: true,
    };

    return await db.$transaction(async (tx) => {
      // 1. Create Clarification record
      const clarification = await tx.clarification.create({
        data: {
          runId,
          nodeId,
          claimId,
          version: 1,
          question: questionText,
          status: 'pending',
          questionDefinition: def,
        },
      });

      // 2. Pause node holding ZERO worker lease and ZERO transaction lock
      await tx.dagNode.update({
        where: { id: nodeId },
        data: {
          state: 'waiting_for_input',
          status: 'WAITING_FOR_INPUT',
          leaseToken: null,
          leaseOwner: null,
          leaseUntil: null,
          leaseExpiresAt: null,
        },
      });

      return clarification;
    });
  }

  /**
   * Resumes a paused DAG branch when the user submits an answer.
   * Enforces version fencing against stale submissions.
   */
  static async resumeWithAnswer(
    clarificationId: string,
    answer: Prisma.InputJsonValue,
    expectedVersion = 1
  ) {
    const clarification = await db.clarification.findUnique({
      where: { id: clarificationId },
    });

    if (!clarification) {
      const err = new Error(`Clarification ${clarificationId} not found`);
      Object.assign(err, { code: 'CLARIFICATION_NOT_FOUND' });
      throw err;
    }

    if (clarification.version !== expectedVersion) {
      const err = new Error(
        `Stale clarification question version (expected ${expectedVersion}, found ${clarification.version})`
      );
      Object.assign(err, { code: 'STALE_QUESTION_VERSION' });
      throw err;
    }

    if (clarification.status !== 'pending') {
      const err = new Error(`Clarification is not in pending status (${clarification.status})`);
      Object.assign(err, { code: 'INVALID_CLARIFICATION_STATUS' });
      throw err;
    }

    await db.$transaction(async (tx) => {
      await tx.clarification.update({
        where: { id: clarificationId },
        data: {
          answers: answer,
          answer: typeof answer === 'string' ? answer : JSON.stringify(answer),
          status: 'answered',
          answeredAt: new Date(),
        },
      });

      if (clarification.nodeId) {
        await tx.dagNode.update({
          where: { id: clarification.nodeId },
          data: {
            state: 'pending',
            status: 'PENDING',
          },
        });
      }
    });

    // Re-dispatch unblocked node
    if (clarification.nodeId) {
      await dispatchDagNodeJob(clarification.runId, clarification.nodeId);
    }

    return { success: true };
  }
}
