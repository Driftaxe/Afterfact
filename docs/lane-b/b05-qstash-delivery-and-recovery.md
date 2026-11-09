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
  - `src/app/api/verify/worker/route.ts`
  - `src/app/api/internal/reconcile/route.ts`
  - `src/server/dag/expand.ts`
  - `tests/integration/dynamic-dag-recovery.test.ts`
- **PowerShell:** Running concurrency tests.

---

## 5. Numbered Implementation Steps

### Step 1: Implement Webhook Ingress (`src/app/api/verify/worker/route.ts`)
Verify the incoming QStash signature before executing any code:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { Receiver } from '@upstash/qstash';
import { executeDagNode } from '@/server/dag/executor';

const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
});

export async function POST(req: NextRequest) {
  const signature = req.headers.get('upstash-signature');
  const bodyText = await req.text();

  // 1. Verify signature
  const isValid = await receiver.verify({
    signature: signature ?? '',
    body: bodyText,
  });

  if (!isValid) {
    return NextResponse.json({ error: 'Unauthorized signature' }, { status: 401 });
  }

  // 2. Parse job and execute
  const payload = JSON.parse(bodyText);
  await executeDagNode(payload.nodeId, payload.runId);

  return NextResponse.json({ success: true });
}
```

### Step 2: Implement Dynamic Graph Expansion & Cycle Check (`src/server/dag/expand.ts`)
Before adding any child node or edge, run cycle detection in memory:
```typescript
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

### Step 3: Implement Reconciliation Sweeper (`src/app/api/internal/reconcile/route.ts`)
Performs 4 automated checks every 60 seconds:
1. Re-enqueues expired leases (`state = 'leased' AND leaseUntil < NOW()`) if `attempt < 3`.
2. Marks nodes as `'failed'` if `attempt >= 3`.
3. Dispatches eligible undispatched `'pending'` nodes.
4. Auto-expires clarifications unanswered after 30 minutes.

### Step 4: Run Recovery Race Test
```powershell
pnpm vitest run tests/integration/dynamic-dag-recovery.test.ts
```
- **What It Proves:** Two simulated workers competing for the same node result in exactly one lease holder; duplicate webhooks are discarded cleanly without duplicate claim records.

---

## 6. Verification and Handoff

- Record test proof in [docs/PHASE-TRACKER.md](../PHASE-TRACKER.md#b05-implement-signed-delivery-leases-and-recovery).
- **Handoff:** Completes **Gate G2** platform requirements. Unblocks **C04** (clarification form submission and unpausing).
