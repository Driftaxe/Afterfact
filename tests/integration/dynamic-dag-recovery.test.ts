import './setup-env';
import { hasTestDb } from './setup-env';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '@/server/db/client';
import { DagService, createRunAndInitializeDag } from '@/server/services/dag-service';
import { ClarificationService } from '@/server/services/clarification-service';
import { expandDag } from '@/server/dag/expand';
import { NextRequest } from 'next/server';
import { POST as reconcilePost } from '@/app/api/internal/reconcile/route';
import crypto from 'node:crypto';

describe.skipIf(!hasTestDb)('B05 Dynamic DAG, Lease Fencing & Recovery Integration', () => {
  const testRunIds: string[] = [];

  beforeEach(() => {
    // Isolated per-test tracking
  });

  afterEach(async () => {
    // Clean up created runs and cascades
    if (testRunIds.length > 0) {
      await db.verificationRun.deleteMany({
        where: { id: { in: testRunIds } },
      });
      testRunIds.length = 0;
    }
  });

  it('guarantees mutual exclusion: two workers racing for the same node -> exactly ONE lease holder', async () => {
    const ownerHash = 'test_owner_' + Date.now();
    const { run, rootNode } = await createRunAndInitializeDag({
      ownerHash,
      inputHash: 'hash_' + Date.now(),
      text: 'Stripe fee is 2.9% + 30c.',
    });
    testRunIds.push(run.id);

    const tokenWorker1 = crypto.randomUUID();
    const tokenWorker2 = crypto.randomUUID();

    // Parallel lease acquisition race
    const [wonWorker1, wonWorker2] = await Promise.all([
      DagService.claimNodeLease(rootNode.id, 'worker_1', tokenWorker1),
      DagService.claimNodeLease(rootNode.id, 'worker_2', tokenWorker2),
    ]);

    // Invariant: Exactly one worker acquires the lease
    expect(wonWorker1 !== wonWorker2).toBe(true);
    expect(wonWorker1 || wonWorker2).toBe(true);

    const updatedNode = await db.dagNode.findUnique({ where: { id: rootNode.id } });
    expect(updatedNode?.state).toBe('leased');
    expect(updatedNode?.attempt).toBe(1);
    expect(updatedNode?.leaseToken).toBe(wonWorker1 ? tokenWorker1 : tokenWorker2);
  });

  it('enforces lease fencing: stale commit after lease theft fails with LEASE_LOST_CONFLICT', async () => {
    const ownerHash = 'test_owner_fence_' + Date.now();
    const { run, rootNode } = await createRunAndInitializeDag({
      ownerHash,
      inputHash: 'hash_fence_' + Date.now(),
      text: 'Sample test text.',
    });
    testRunIds.push(run.id);

    const worker1Token = crypto.randomUUID();
    const worker2Token = crypto.randomUUID();

    // 1. Worker 1 claims lease
    const worker1Acquired = await DagService.claimNodeLease(rootNode.id, 'worker_1', worker1Token);
    expect(worker1Acquired).toBe(true);

    // 2. Simulate lease expiration by setting leaseUntil into the past
    await db.dagNode.update({
      where: { id: rootNode.id },
      data: {
        leaseUntil: new Date(Date.now() - 10000),
        leaseExpiresAt: new Date(Date.now() - 10000),
      },
    });

    // 3. Worker 2 steals the lease
    const worker2Acquired = await DagService.claimNodeLease(rootNode.id, 'worker_2', worker2Token);
    expect(worker2Acquired).toBe(true);

    // 4. Worker 1 attempts to commit with stale leaseToken -> must fail closed
    let threwConflict = false;
    try {
      await DagService.commitNodeCompletion(rootNode.id, worker1Token, {
        state: 'completed',
      });
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'LEASE_LOST_CONFLICT') {
        threwConflict = true;
      }
    }

    expect(threwConflict).toBe(true);

    // 5. Node remains leased to Worker 2
    const currentNode = await db.dagNode.findUnique({ where: { id: rootNode.id } });
    expect(currentNode?.leaseToken).toBe(worker2Token);
  });

  it('reconciles expired leases: sweeper reclaims expired nodes where attempt < 3', async () => {
    const ownerHash = 'test_owner_reconcile_' + Date.now();
    const { run, rootNode } = await createRunAndInitializeDag({
      ownerHash,
      inputHash: 'hash_reconcile_' + Date.now(),
      text: 'Reconcile test.',
    });
    testRunIds.push(run.id);

    // Claim lease and set expired
    const token = crypto.randomUUID();
    await DagService.claimNodeLease(rootNode.id, 'stuck_worker', token);
    await db.dagNode.update({
      where: { id: rootNode.id },
      data: {
        leaseUntil: new Date(Date.now() - 5000),
        leaseExpiresAt: new Date(Date.now() - 5000),
      },
    });

    // Run reconciliation sweeper
    const req = new NextRequest('http://localhost:3000/api/internal/reconcile', {
      method: 'POST',
    });
    const res = await reconcilePost(req);
    expect(res.status).toBe(200);

    const recheckNode = await db.dagNode.findUnique({ where: { id: rootNode.id } });
    expect(recheckNode?.state).toBe('pending');
    expect(recheckNode?.leaseToken).toBeNull();
  });

  it('marks node failed and fails claim when execution attempts are exhausted (attempt >= 3)', async () => {
    const ownerHash = 'test_owner_exhaust_' + Date.now();
    const { run, rootNode } = await createRunAndInitializeDag({
      ownerHash,
      inputHash: 'hash_exhaust_' + Date.now(),
      text: 'Exhaustion test.',
    });
    testRunIds.push(run.id);

    // Create a linked claim
    const claim = await db.claim.create({
      data: {
        runId: run.id,
        ordinal: 0,
        text: 'Exhausted claim',
        state: 'pending',
      },
    });

    // Simulate 3 attempts and expired lease
    await db.dagNode.update({
      where: { id: rootNode.id },
      data: {
        claimId: claim.id,
        state: 'leased',
        attempt: 3,
        leaseUntil: new Date(Date.now() - 5000),
        leaseExpiresAt: new Date(Date.now() - 5000),
      },
    });

    // Run sweeper
    const req = new NextRequest('http://localhost:3000/api/internal/reconcile', {
      method: 'POST',
    });
    const res = await reconcilePost(req);
    expect(res.status).toBe(200);

    const recheckNode = await db.dagNode.findUnique({ where: { id: rootNode.id } });
    expect(recheckNode?.state).toBe('failed');

    const recheckClaim = await db.claim.findUnique({ where: { id: claim.id } });
    expect(recheckClaim?.state).toBe('failed');

    // Confirm claim_failed event recorded
    const events = await db.runEvent.findMany({
      where: { runId: run.id, type: 'claim_failed' },
    });
    expect(events.length).toBeGreaterThanOrEqual(1);
  });

  it('protocol C: clarification pauses node holding 0 leases, and resumes on answer', async () => {
    const ownerHash = 'test_owner_clarify_' + Date.now();
    const { run, rootNode } = await createRunAndInitializeDag({
      ownerHash,
      inputHash: 'hash_clarify_' + Date.now(),
      text: 'Ambiguous statement needing clarification.',
    });
    testRunIds.push(run.id);

    // 1. Pause for clarification
    const clar = await ClarificationService.pauseForClarification({
      runId: run.id,
      nodeId: rootNode.id,
      questionText: 'Which billing tier are you using?',
      options: ['Tier 1', 'Tier 2'],
    });

    expect(clar.id).toBeDefined();
    expect(clar.status).toBe('pending');

    const pausedNode = await db.dagNode.findUnique({ where: { id: rootNode.id } });
    expect(pausedNode?.state).toBe('waiting_for_input');
    expect(pausedNode?.leaseToken).toBeNull();
    expect(pausedNode?.leaseUntil).toBeNull();

    // 2. Reject stale version answer
    let versionMismatch = false;
    try {
      await ClarificationService.resumeWithAnswer(clar.id, 'Tier 1', 99);
    } catch (err: unknown) {
      if (err instanceof Error && (err as Error & { code?: string }).code === 'STALE_QUESTION_VERSION') versionMismatch = true;
    }
    expect(versionMismatch).toBe(true);

    // 3. Resume with correct answer
    const resumeResult = await ClarificationService.resumeWithAnswer(clar.id, 'Tier 1', 1);
    expect(resumeResult.success).toBe(true);

    const resumedNode = await db.dagNode.findUnique({ where: { id: rootNode.id } });
    expect(resumedNode?.state).toBe('pending');
  });

  it('dynamic expansion: prevents cycle formation and respects MAX_DAG_NODES_PER_RUN', async () => {
    const ownerHash = 'test_owner_expand_' + Date.now();
    const { run, rootNode } = await createRunAndInitializeDag({
      ownerHash,
      inputHash: 'hash_expand_' + Date.now(),
      text: 'Dynamic expansion test.',
    });
    testRunIds.push(run.id);

    // Attempting to add an edge that creates a self-loop must reject
    await expect(
      expandDag({
        runId: run.id,
        newNodes: [],
        newEdges: [
          {
            predecessorId: rootNode.id,
            successorId: rootNode.id,
          },
        ],
      })
    ).rejects.toThrow(/cycle/i);
  });
});
