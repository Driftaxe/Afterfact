# docs/lane-b/b04b-persisted-dag-execution-slice.md — Minimal Persisted DAG Execution Slice

- **Ticket Reference:** [B04b in docs/PHASE-TRACKER.md](../PHASE-TRACKER.md#b04-migrate-the-data-model-and-wire-the-vertical-slice)
- **Status in Tracker:** `TODO`
- **Assigned Lane:** Lane B (Platform)
- **Verification Tier:** E3 (Integration test against Neon PostgreSQL)

---

## 1. What You Are Building

You are wiring the **minimal end-to-end execution slice** of Afterfact. This takes a single pasted claim and runs it through real persisted DAG nodes stored in Neon PostgreSQL:
`root_extract_prep` $\longrightarrow$ `plan_research` $\longrightarrow$ `search_evidence` $\longrightarrow$ `extract_evidence` $\longrightarrow$ `assess_evidence` $\longrightarrow$ `decide_claim` $\longrightarrow$ `finalize_run`.

Every step reads from and writes to PostgreSQL via Prisma, completely retiring any temporary synchronous shortcuts.

---

## 2. Why Afterfact Needs It

This completes **Gate G1 (Live Slice Gate)**. It proves that:
- Input preparation binds cryptographically to `inputHash`.
- Dynamic DAG nodes transition through valid states (`pending` -> `leased` -> `completed`).
- Web documents from Tavily and semantic assessments from Bifrost persist cleanly into relational tables.
- An auditable `DecisionRecord` formalizes the verdict.

---

## 3. Before You Start

- **Prerequisites:** B04a (Neon database baseline), B02 (Bifrost client), B03 (Tavily search client), A03 (claim extraction), A04 (evidence extraction), A05 (synthesis judge).
- **Database:** `afterfact-dev` or `afterfact-test` branch running on Neon.

---

## 4. Where Each Action Happens

- **VS Code:**
  - `src/server/services/prep-service.ts`
  - `src/server/services/dag-service.ts`
  - `src/server/dag/engine.ts`
  - `tests/integration/dag-slice.test.ts`
- **PowerShell:** Running integration test suite.

---

## 5. Numbered Implementation Steps

### Step 1: Implement `PreparationService` (`src/server/services/prep-service.ts`)
Handles initial claim extraction and binds it to `inputHash`:
```typescript
import crypto from 'node:crypto';
import { db } from '@/server/db/client';

export class PreparationService {
  static computeInputHash(text: string, question?: string, context?: object): string {
    return crypto
      .createHash('sha256')
      .update(JSON.stringify({ text: text.trim(), question: question?.trim(), context: context ?? {} }))
      .digest('hex');
  }

  static async getOrCreatePreparation(ownerHash: string, text: string, question?: string, context?: object) {
    const inputHash = this.computeInputHash(text, question, context);

    // 1. Check cache for identical input from this owner
    const existing = await db.preparation.findFirst({
      where: { ownerHash, inputHash, status: 'ready' },
    });
    if (existing) return existing;

    // 2. Otherwise extract claims via Bifrost / Lane A extractor
    // (Persist to db.preparation and return record)
  }
}
```

### Step 2: Implement DAG Materialization & Transaction Fencing (`src/server/services/dag-service.ts`)
When a user confirms preparation, create the run, initial DAG nodes, and events in a **single database transaction** (Protocol A):
```typescript
import { db } from '@/server/db/client';

export async function createRunAndInitializeDag(params: {
  ownerHash: string;
  inputHash: string;
  prepId: string;
  text: string;
  claims: any[];
}) {
  return await db.$transaction(async (tx) => {
    // 1. Create VerificationRun
    const run = await tx.verificationRun.create({
      data: {
        ownerHash: params.ownerHash,
        inputHash: params.inputHash,
        prepId: params.prepId,
        mode: 'paste',
        text: params.text,
        context: {},
        state: 'running',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    // 2. Insert DAG Nodes
    const rootNode = await tx.dagNode.create({
      data: {
        id: `node_root_${run.id}`,
        runId: run.id,
        nodeType: 'root_extract_prep',
        state: 'pending',
      },
    });

    const finalizeNode = await tx.dagNode.create({
      data: {
        id: `node_finalize_${run.id}`,
        runId: run.id,
        nodeType: 'finalize_run',
        state: 'pending',
      },
    });

    // 3. Connect initial dependency edge
    await tx.dagEdge.create({
      data: {
        id: `edge_root_finalize_${run.id}`,
        runId: run.id,
        predecessorId: rootNode.id,
        successorId: finalizeNode.id,
        condition: 'on_terminal',
      },
    });

    // 4. Log initial event
    await tx.runEvent.create({
      data: {
        runId: run.id,
        seq: 1,
        type: 'run_started',
        payload: { runId: run.id, createdAt: new Date().toISOString() },
      },
    });

    return run;
  });
}
```

### Step 3: Implement Database-Clock Lease Claiming
In `src/server/dag/engine.ts`, acquire worker leases using parameterized raw SQL to enforce PostgreSQL clock authority:
```typescript
export async function claimNodeLease(nodeId: string, workerId: string, token: string): Promise<boolean> {
  const count = await db.$executeRaw`
    UPDATE dag_nodes
       SET state = 'leased',
           "leaseToken" = ${token},
           "leaseUntil" = NOW() + INTERVAL '35 seconds',
           attempt = attempt + 1
     WHERE id = ${nodeId}
       AND (state = 'pending' OR (state = 'leased' AND "leaseUntil" < NOW()))
       AND attempt < 3;
  `;
  return count > 0;
}
```

### Step 4: Write Integration Test (`tests/integration/dag-slice.test.ts`)
Author a test that runs a real verification against Neon:
```powershell
pnpm vitest run tests/integration/dag-slice.test.ts
```
- **Expected Result:** Run completes, claims and evidence are persisted, and `state` reaches `'completed'` with score.

---

## 6. Verification and Handoff

- Record test run transcript in [docs/PHASE-TRACKER.md](../PHASE-TRACKER.md#b04-migrate-the-data-model-and-wire-the-vertical-slice).
- **Handoff:** Completes **Gate G1** platform requirements. Unblocks **C03** to connect live UI to real runs.
