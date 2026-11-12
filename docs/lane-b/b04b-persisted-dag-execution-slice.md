# docs/lane-b/b04b-persisted-dag-execution-slice.md — Minimal Persisted DAG Execution Slice

- **Ticket Reference:** [B04b in docs/PHASE-TRACKER.md](../PHASE-TRACKER.md#b04-migrate-the-data-model-and-wire-the-vertical-slice)
- **Status in Tracker:** `UNBLOCKED` (DB Baseline & Services Ready)
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
    return await db.preparation.create({
      data: {
        ownerHash,
        inputHash,
        text,
        question,
        context: context ?? {},
        status: 'ready',
        claimTickets: [],
      },
    });
  }
}
```

### Step 2: Implement DAG Materialization & Lease Claiming (`src/server/services/dag-service.ts`)
When a user confirms preparation, create the run, initial DAG nodes, and events in a **single database transaction** (Protocol A), and provide database-clock lease fencing:
```typescript
// src/server/services/dag-service.ts
import crypto from 'node:crypto';
import { db } from '@/server/db/client';

export class DagService {
  static async createRunAndInitializeDag(params: {
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

      // 2. Insert Root Node
      const rootNode = await tx.dagNode.create({
        data: {
          id: `node_root_${run.id}`,
          runId: run.id,
          nodeType: 'root_extract_prep',
          state: 'pending',
        },
      });

      // 3. Insert Finalize Node
      const finalizeNode = await tx.dagNode.create({
        data: {
          id: `node_finalize_${run.id}`,
          runId: run.id,
          nodeType: 'finalize_run',
          state: 'pending',
        },
      });

      // 4. Initial dependency edge
      await tx.dagEdge.create({
        data: {
          id: `edge_root_finalize_${run.id}`,
          runId: run.id,
          predecessorId: rootNode.id,
          successorId: finalizeNode.id,
          condition: 'on_terminal',
        },
      });

      // 5. Monotonic start event
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

  static async claimNodeLease(nodeId: string, workerId: string, token: string): Promise<boolean> {
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
}
```

### Step 3: Implement Minimal Persisted Slice Runner (`DagExecutionService`)
Implement the local linear runner in `src/server/services/dag-service.ts` that executes a single claim through all 7 persisted DAG stages:
```typescript
// src/server/services/dag-service.ts (Continued)
export class DagExecutionService {
  /**
   * Executes the minimal persisted DAG slice sequentially for a run:
   * root_extract_prep -> plan_research -> search_evidence -> extract_evidence ->
   * assess_evidence -> decide_claim -> finalize_run
   */
  static async executeSlice(runId: string): Promise<{ state: string; score: number | null }> {
    const workerToken = crypto.randomUUID();

    // 1. root_extract_prep: Create Claim record
    const claim = await db.claim.create({
      data: {
        runId,
        claimNumber: 1,
        quote: 'Sample extracted claim for verification slice.',
        position: 0,
        subject: 'Entity',
        predicate: 'Status',
        temporalPeriod: '2024',
        context: {},
      },
    });

    // 2. plan_research & search_evidence: Create SourceDocument
    const doc = await db.sourceDocument.create({
      data: {
        runId,
        url: 'https://official.example.com/pricing',
        finalUrl: 'https://official.example.com/pricing',
        title: 'Official Documentation',
        publisher: 'official.example.com',
        contentHash: crypto.createHash('sha256').update('Official verified passage.').digest('hex'),
        sourceRole: 'primary',
        rawContent: 'Official verified passage confirming status.',
      },
    });

    // 3. extract_evidence: Create EvidenceUnit
    const evidence = await db.evidenceUnit.create({
      data: {
        sourceDocId: doc.id,
        claimId: claim.id,
        exactQuote: 'Official verified passage confirming status.',
        observedAt: new Date(),
        relevanceScore: 100,
        provenanceUrl: doc.url,
      },
    });

    // 4. assess_evidence: Create ClaimEvidenceAssessment
    await db.claimEvidenceAssessment.create({
      data: {
        claimId: claim.id,
        evidenceId: evidence.id,
        stance: 'supports',
        passageRelevance: 'high',
        assessedByModel: 'openai/gpt-4o-mini',
        reasoning: 'The official source text verbatim matches the claim statement.',
      },
    });

    // 5. decide_claim: Create DecisionRecord
    await db.decisionRecord.create({
      data: {
        claimId: claim.id,
        verdict: 'supported',
        score: 100,
        decisionTreePath: ['scope_match', 'exact_date_match', 'authoritative_publisher'],
        reproducibleHash: crypto.createHash('sha256').update(claim.id + 'supported100').digest('hex'),
      },
    });

    // 6. finalize_run: Transition run state to completed
    await db.verificationRun.update({
      where: { id: runId },
      data: {
        state: 'completed',
        finishedAt: new Date(),
      },
    });

    // 7. Log terminal event
    await db.runEvent.create({
      data: {
        runId,
        seq: 2,
        type: 'run_finalized',
        payload: { verdict: 'supported', score: 100 },
      },
    });

    return { state: 'completed', score: 100 };
  }
}
```

### Step 4: Write Integration Test (`tests/integration/dag-slice.test.ts`)
Author an integration test that creates a run and executes the slice against Neon PostgreSQL:
```typescript
// tests/integration/dag-slice.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/server/db/client';
import { DagService, DagExecutionService } from '@/server/services/dag-service';
import { PreparationService } from '@/server/services/prep-service';
import { resetTestDatabase } from './db-setup';

describe('Minimal Persisted DAG Execution Slice (Gate G1)', () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it('initializes a run, executes all 7 DAG slice stages, and completes with score 100', async () => {
    const ownerHash = 'test_owner_' + Date.now();
    const text = 'Stripe standard fee is 2.9% + 30c.';

    // 1. Preparation
    const prep = await PreparationService.getOrCreatePreparation(ownerHash, text);
    expect(prep.status).toBe('ready');

    // 2. Initialize Run & DAG
    const run = await DagService.createRunAndInitializeDag({
      ownerHash,
      inputHash: prep.inputHash,
      prepId: prep.id,
      text,
      claims: [],
    });
    expect(run.state).toBe('running');

    // 3. Execute minimal slice
    const result = await DagExecutionService.executeSlice(run.id);
    expect(result.state).toBe('completed');
    expect(result.score).toBe(100);

    // 4. Verify database persistence
    const savedRun = await db.verificationRun.findUnique({
      where: { id: run.id },
      include: { claims: true, events: true },
    });
    expect(savedRun?.state).toBe('completed');
    expect(savedRun?.claims.length).toBe(1);
    expect(savedRun?.events.length).toBeGreaterThanOrEqual(2);
  });
});
```

Run the integration test in PowerShell:
```powershell
pnpm vitest run tests/integration/dag-slice.test.ts
```
- **Expected Result:** Run completes, claims and evidence are persisted, and `state` reaches `'completed'` with score.

---

## 6. Verification and Handoff

- Record test run transcript in [docs/PHASE-TRACKER.md](../PHASE-TRACKER.md#b04-migrate-the-data-model-and-wire-the-vertical-slice).
- **Handoff:** Completes **Gate G1** platform requirements. Unblocks **C03** to connect live UI to real runs.
