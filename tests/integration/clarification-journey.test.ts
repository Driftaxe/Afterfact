import './setup-env';
import { hasTestDb } from './setup-env';
import { describe, it, expect, afterEach } from 'vitest';
import { db } from '@/server/db/client';
import { createRunAndInitializeDag } from '@/server/services/dag-service';
import { ClarificationService } from '@/server/services/clarification-service';
import { submitClarificationAction } from '@/actions/run-actions';
import { getSanitizedRunSnapshot } from '@/server/services/run-query-service';
import { processWorkerJob } from '@/server/jobs/worker';
import type { Prisma } from '@prisma/client';

describe.skipIf(!hasTestDb)('Clarification Journey Integration (Case 24)', () => {
  const testRunIds: string[] = [];

  afterEach(async () => {
    if (testRunIds.length > 0) {
      await db.verificationRun.deleteMany({
        where: { id: { in: testRunIds } },
      });
      testRunIds.length = 0;
    }
  });

  it('Case 24: Input -> question -> waiting -> refresh -> answer action -> revised context -> resumed job -> visible final state', async () => {
    const ownerHash = 'test_owner_journey_' + Date.now();
    const inputHash = 'test_hash_journey_' + Date.now();

    // 1. Input: create synthetic verification run
    const { run, rootNode } = await createRunAndInitializeDag({
      ownerHash,
      inputHash,
      text: 'Cloudflare Workers CPU time limit is 50ms max.',
    });
    testRunIds.push(run.id);

    // Create claim with missing material context
    const claim = await db.claim.create({
      data: {
        runId: run.id,
        ordinal: 0,
        text: 'Cloudflare Workers CPU time limit is 50ms max',
        normalizedText: 'Cloudflare Workers CPU execution time limit is 50ms max',
        state: 'pending',
        status: 'PENDING',
        spec: {
          domain: 'cloud',
          timeSensitivity: 'medium',
          targetTime: '2026-11-19',
          verificationContext: [],
          missingMaterialContext: ['plan_tier'],
        } as unknown as Prisma.InputJsonValue,
      },
    });

    // 2. Question: DAG branch pauses for clarification
    const questionDefinition = {
      questionSetId: `qs_${claim.id}_r1`,
      runId: run.id,
      revision: 1,
      round: 1,
      questions: [
        {
          questionId: `q_plan_tier_${claim.id}`,
          propertyKey: 'plan_tier',
          prompt: 'Which Cloudflare Workers plan are you asking about?',
          reason: 'CPU time limits differ between Free and Paid plans.',
          fieldType: 'select',
          required: true,
          allowUnknown: true,
          options: [
            { label: 'Free Plan (10ms)', value: 'free' },
            { label: 'Paid Plan (50ms)', value: 'paid' },
          ],
        },
      ],
    };

    const clar = await ClarificationService.pauseForClarification({
      runId: run.id,
      nodeId: rootNode.id,
      claimId: claim.id,
      questionText: 'Which Cloudflare Workers plan are you asking about?',
      questionDefinition: questionDefinition as unknown as Prisma.InputJsonValue,
      options: ['Free Plan (10ms)', 'Paid Plan (50ms)'],
    });

    expect(clar.id).toBeDefined();
    expect(clar.status).toBe('pending');

    // 3. Waiting & Refresh: Check snapshot before answer
    const pausedNode = await db.dagNode.findUnique({ where: { id: rootNode.id } });
    expect(pausedNode?.state).toBe('waiting_for_input');
    expect(pausedNode?.leaseToken).toBeNull();

    const snapshotBefore = await getSanitizedRunSnapshot(run.id, ownerHash);
    expect(snapshotBefore).not.toBeNull();
    const waitingNode = snapshotBefore?.dagNodes.find((n) => n.id === rootNode.id);
    expect(waitingNode?.state).toBe('waiting_for_input');

    // 4. Answer: User submits answer through actual authorized action
    const actionResult = await submitClarificationAction({
      clarificationId: clar.id,
      runId: run.id,
      revision: 1,
      answers: [
        {
          questionId: `q_plan_tier_${claim.id}`,
          value: 'paid',
        },
      ],
    });

    expect(actionResult.success).toBe(true);

    // Verify unblocked state
    const answeredClar = await db.clarification.findUnique({ where: { id: clar.id } });
    expect(answeredClar?.status).toBe('answered');

    const unblockedNode = await db.dagNode.findUnique({ where: { id: rootNode.id } });
    expect(unblockedNode?.state).toBe('pending');

    // 5. Revised context reaches DAG node: execute the resumed node
    // Update node to decide_claim type with claimId
    await db.dagNode.update({
      where: { id: rootNode.id },
      data: {
        nodeType: 'decide_claim',
        claimId: claim.id,
      },
    });

    await processWorkerJob(run.id, rootNode.id);

    // 6. Visible Final State: check snapshot after resumption
    const snapshotAfter = await getSanitizedRunSnapshot(run.id, ownerHash);
    expect(snapshotAfter).not.toBeNull();
    const assessedClaim = snapshotAfter?.claims.find((c) => c.id === claim.id);
    expect(assessedClaim).toBeDefined();

    // Context continuity: plan_tier was incorporated into verificationContext
    const planTierProp = (assessedClaim?.verificationContext as Array<{ key: string; value: unknown }>)?.find(
      (p) => p.key === 'plan_tier'
    );
    expect(planTierProp).toBeDefined();
    expect(planTierProp?.value).toBe('paid');

    // missingMaterialContext was cleared and did not loop!
    expect(assessedClaim?.missingMaterialContext).toEqual([]);
  });
});
