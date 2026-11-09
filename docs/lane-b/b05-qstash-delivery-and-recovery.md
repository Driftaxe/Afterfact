# docs/lane-b/b05-qstash-delivery-and-recovery.md — QStash Delivery, Concurrency & Recovery

- **Ticket Reference:** [B05 in docs/PHASE-TRACKER.md](../PHASE-TRACKER.md#b05-implement-signed-delivery-leases-and-recovery)
- **Status in Tracker:** `TODO`
- **Assigned Lane:** Lane B (Platform)
- **Verification Tier:** E3 (Integration race test verifying lease fencing & recovery)

---

## 1. What You Are Building

You are implementing Afterfact's distributed execution and background recovery system:
1. **QStash Webhook Ingress (`src/app/api/verify/worker/route.ts`):** Verifies cryptographic signatures on incoming webhooks from Upstash QStash.
2. **Bounded Concurrency Flow Control:** Enforces that no more than 3 claim branches run concurrently per verification run.
3. **Dynamic Graph Expansion:** Enables running workers to dynamically expand new DAG branches (e.g. secondary searches or clarification questions) after validating acyclicity (DFS cycle check).
4. **Reconciliation Sweeper (`src/app/api/internal/reconcile/route.ts`):** A background endpoint that runs every 60 seconds to reclaim expired worker leases and re-dispatch stranded jobs.

---

## 2. Why Afterfact Needs It

In real-world verification:
- External web searches and LLM passes take 5–15 seconds per claim. If 10 claims ran all at once, external APIs would rate-limit us. Capping concurrency at 3 maintains smooth throughput.
- If a serverless function crashes or times out mid-execution, the reconciliation sweeper detects the expired lease and safely re-enqueues the job.
- When an ambiguous claim needs clarification from the user, the branch pauses in `waiting_for_input` holding **zero worker leases and zero open database locks**.

---

## 3. Before You Start

- **Prerequisites:** B04b completed; Upstash QStash account from [upstash.com](https://upstash.com).
- **Credentials:**
  - `QSTASH_TOKEN`: For publishing messages.
  - `QSTASH_CURRENT_SIGNING_KEY`: For verifying incoming signatures.
  - `QSTASH_NEXT_SIGNING_KEY`: For seamless key rotation.

---

## 4. Where Each Action Happens

- **Upstash Console:** Creating QStash topic and copying signing keys.
- **VS Code:**
  - `src/server/jobs/worker.ts`
  - `src/app/api/verify/worker/route.ts`
  - `src/app/api/internal/reconcile/route.ts`
  - `src/server/services/clarification-service.ts`
  - `src/server/dag/expand.ts`
  - `tests/integration/dynamic-dag-recovery.test.ts`
- **PowerShell:** Running concurrency tests.

---

## 5. Numbered Implementation Steps

### Step 1: Implement Webhook Ingress (`src/app/api/verify/worker/route.ts`)
Verify the incoming QStash signature using the official `Receiver` before executing any code:
```typescript
// src/app/api/verify/worker/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Receiver } from '@upstash/qstash';
import { processWorkerJob } from '@/server/jobs/worker';

const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
});

export async function POST(req: NextRequest) {
  const signature = req.headers.get('upstash-signature');
  const bodyText = await req.text();

  // 1. Verify cryptographic signature
  const isValid = await receiver.verify({
    signature: signature ?? '',
    body: bodyText,
  });

  if (!isValid) {
    return NextResponse.json({ error: 'Unauthorized signature' }, { status: 401 });
  }

  // 2. Parse job and execute
  const payload = JSON.parse(bodyText);
  await processWorkerJob(payload.runId, payload.nodeId);

  return NextResponse.json({ success: true });
}
```

### Step 2: Implement Background Worker & Concurrency Flow Control (`src/server/jobs/worker.ts`)
Enforce that no more than 3 claim branches run concurrently, and execute node tasks atomically with lease fencing:
```typescript
// src/server/jobs/worker.ts
import crypto from 'node:crypto';
import { Client } from '@upstash/qstash';
import { db } from '@/server/db/client';
import { DagService } from '@/server/services/dag-service';

const qstash = new Client({ token: process.env.QSTASH_TOKEN || 'mock_token' });

export async function dispatchDagNodeJob(runId: string, nodeId: string): Promise<boolean> {
  // 1. Enforce Bounded Concurrency: count currently active (leased) claim nodes
  const activeCount = await db.dagNode.count({
    where: {
      runId,
      state: 'leased',
      leaseUntil: { gt: new Date() },
    },
  });

  if (activeCount >= 3) {
    // Capacity reached: schedule job with a 5-second backoff delay
    console.log(`Concurrency cap (3) reached for run ${runId}. Enqueueing with backoff.`);
    await qstash.publishJSON({
      url: `${process.env.APP_BASE_URL || 'http://localhost:3000'}/api/verify/worker`,
      body: { runId, nodeId },
      delay: 5,
    });
    return false;
  }

  // 2. Dispatch immediately
  await qstash.publishJSON({
    url: `${process.env.APP_BASE_URL || 'http://localhost:3000'}/api/verify/worker`,
    body: { runId, nodeId },
  });
  return true;
}

export async function processWorkerJob(runId: string, nodeId: string): Promise<void> {
  const workerToken = crypto.randomUUID();

  // Acquire lease with database clock authority (NOW() + 35s)
  const acquired = await DagService.claimNodeLease(nodeId, 'worker_' + process.pid, workerToken);
  if (!acquired) {
    console.log(`Node ${nodeId} lease could not be claimed or is already active.`);
    return;
  }

  try {
    const node = await db.dagNode.findUnique({ where: { id: nodeId } });
    if (!node) return;

    // Execute node logic based on nodeType...
    // (e.g. search_evidence, extract_evidence, assess_evidence)

    // Atomically complete node and mark state
    await db.dagNode.update({
      where: { id: nodeId },
      data: {
        state: 'completed',
        leaseToken: null,
      },
    });
  } catch (err) {
    console.error(`Worker error executing node ${nodeId}:`, err);
    await db.dagNode.update({
      where: { id: nodeId },
      data: {
        state: 'failed',
        leaseToken: null,
      },
    });
  }
}
```

### Step 3: Implement Clarification Wait Service (`src/server/services/clarification-service.ts`)
Provide non-blocking wait states holding zero worker leases when human clarification is needed:
```typescript
// src/server/services/clarification-service.ts
import { db } from '@/server/db/client';
import { dispatchDagNodeJob } from '@/server/jobs/worker';

export class ClarificationService {
  /**
   * Pauses a DAG branch for user clarification, holding zero leases and zero database locks.
   */
  static async pauseForClarification(params: {
    runId: string;
    nodeId: string;
    questionText: string;
    options?: string[];
  }) {
    const { runId, nodeId, questionText, options } = params;

    return await db.$transaction(async (tx) => {
      // 1. Create Clarification record
      const clarification = await tx.clarification.create({
        data: {
          runId,
          dagNodeId: nodeId,
          question: questionText,
          fieldType: options ? 'select' : 'short text',
          options: options ?? [],
          status: 'pending',
          expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30-minute expiration
        },
      });

      // 2. Pause node holding ZERO worker lease
      await tx.dagNode.update({
        where: { id: nodeId },
        data: {
          state: 'waiting_for_input',
          leaseToken: null,
          leaseUntil: null,
        },
      });

      // 3. Emit progress event
      await tx.runEvent.create({
        data: {
          runId,
          seq: 99,
          type: 'clarification_requested',
          payload: { clarificationId: clarification.id, question: questionText },
        },
      });

      return clarification;
    });
  }

  /**
   * Resumes a paused DAG branch when the user submits their answer.
   */
  static async resumeWithAnswer(clarificationId: string, answer: any) {
    const clarification = await db.clarification.findUnique({
      where: { id: clarificationId },
    });
    if (!clarification || clarification.status !== 'pending') {
      throw new Error('Clarification is invalid or already resolved.');
    }

    await db.$transaction(async (tx) => {
      await tx.clarification.update({
        where: { id: clarificationId },
        data: {
          answer,
          status: 'answered',
          answeredAt: new Date(),
        },
      });

      if (clarification.dagNodeId) {
        await tx.dagNode.update({
          where: { id: clarification.dagNodeId },
          data: { state: 'pending' },
        });
      }
    });

    // Re-dispatch unblocked node
    if (clarification.dagNodeId) {
      await dispatchDagNodeJob(clarification.runId, clarification.dagNodeId);
    }
  }
}
```

### Step 4: Implement Dynamic Graph Expansion & Cycle Check (`src/server/dag/expand.ts`)
Before adding any dynamic child node or edge at runtime, run cycle detection in memory:
```typescript
// src/server/dag/expand.ts
export function detectCycle(existingEdges: Array<{ pred: string; succ: string }>, newEdge: { pred: string; succ: string }): boolean {
  const adj = new Map<string, string[]>();
  for (const e of [...existingEdges, newEdge]) {
    if (!adj.has(e.pred)) adj.set(e.pred, []);
    adj.get(e.pred)!.push(e.succ);
  }

  const visited = new Set<string>();
  const inStack = new Set<string>();

  function dfs(node: string): boolean {
    visited.add(node);
    inStack.add(node);
    for (const neighbor of adj.get(node) ?? []) {
      if (!visited.has(neighbor) && dfs(neighbor)) return true;
      if (inStack.has(neighbor)) return true;
    }
    inStack.delete(node);
    return false;
  }

  for (const node of adj.keys()) {
    if (!visited.has(node) && dfs(node)) return true;
  }
  return false;
}
```

### Step 5: Implement Reconciliation Sweeper (`src/app/api/internal/reconcile/route.ts`)
Author the background sweeper route that runs every 60 seconds to reclaim expired leases, re-dispatch stranded jobs, and expire stale clarification requests:
```typescript
// src/app/api/internal/reconcile/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/server/db/client';
import { dispatchDagNodeJob } from '@/server/jobs/worker';

export async function POST(req: NextRequest) {
  const now = new Date();

  // 1. Reclaim expired leases where attempt < 3
  const recovered = await db.dagNode.updateMany({
    where: {
      state: 'leased',
      leaseUntil: { lt: now },
      attempt: { lt: 3 },
    },
    data: {
      state: 'pending',
      leaseToken: null,
      leaseUntil: null,
    },
  });

  // 2. Mark dead nodes as failed where attempt >= 3
  const failed = await db.dagNode.updateMany({
    where: {
      state: 'leased',
      leaseUntil: { lt: now },
      attempt: { gte: 3 },
    },
    data: {
      state: 'failed',
      leaseToken: null,
    },
  });

  // 3. Auto-expire unanswered clarifications past 30 minutes
  const expiredClarifications = await db.clarification.updateMany({
    where: {
      status: 'pending',
      expiresAt: { lt: now },
    },
    data: {
      status: 'expired',
    },
  });

  // 4. Re-dispatch eligible pending nodes
  const eligibleNodes = await db.dagNode.findMany({
    where: { state: 'pending' },
    take: 10,
  });

  for (const node of eligibleNodes) {
    await dispatchDagNodeJob(node.runId, node.id);
  }

  return NextResponse.json({
    recoveredCount: recovered.count,
    failedCount: failed.count,
    expiredClarificationsCount: expiredClarifications.count,
    dispatchedCount: eligibleNodes.length,
  });
}
```

### Step 6: Run Recovery Race Test
Execute the automated race and recovery test suite:
```powershell
pnpm vitest run tests/integration/dynamic-dag-recovery.test.ts
```
- **What It Proves:** Two simulated workers competing for the same node result in exactly one lease holder; duplicate webhooks are discarded cleanly without duplicate claim records; expired leases recover safely.

---

## 6. Verification and Handoff

- Record test proof in [docs/PHASE-TRACKER.md](../PHASE-TRACKER.md#b05-implement-signed-delivery-leases-and-recovery).
- **Handoff:** Completes **Gate G2** platform requirements. Unblocks **C04** (clarification form submission and unpausing).
