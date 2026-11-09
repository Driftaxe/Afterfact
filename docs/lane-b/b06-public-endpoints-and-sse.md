# docs/lane-b/b06-public-endpoints-and-sse.md — Public Endpoints, SSE Replay & REST Adapter

- **Ticket Reference:** [B06 in docs/PHASE-TRACKER.md](../PHASE-TRACKER.md#b06-implement-the-public-run-endpoints)
- **Status in Tracker:** `TODO`
- **Assigned Lane:** Lane B (Platform)
- **Verification Tier:** E3 (Integration API test suite)

---

## 1. What You Are Building

You are implementing three public HTTP endpoints:
1. **Run Snapshot (`GET /api/runs/[id]`):** Returns the current sanitized state of a run, its claims, evidence, and public DAG progress milestones.
2. **Server-Sent Events Stream (`GET /api/runs/[id]/events`):** Streams live progress events to the browser with sequence replay (`?afterSeq=N`) and keepalive heartbeats.
3. **Programmatic REST API (`POST /api/v1/verify`):** A headless endpoint that allows external developers and benchmark evaluation scripts to run verifications headlessly.

---

## 2. Why Afterfact Needs It

- **Connection Resiliency:** If a user walks into an elevator or their Wi-Fi hiccups, the browser's SSE connection drops. When reconnecting with `?afterSeq=4`, Afterfact replays only events 5 and up, preventing duplicate UI renders or missed alerts.
- **Privacy & Security:** Internal worker lease tokens, QStash message IDs, and private database credentials must **never** reach the browser. The snapshot route sanitizes the data before returning it.
- **Headless Evaluation:** Task A09 needs to run 30 benchmark evaluation cases headlessly via `POST /api/v1/verify`.

---

## 3. Before You Start

- **Prerequisites:** B04b and B05 completed.
- **Schemas:** Contract schemas for events and reports in `src/lib/contracts/`.

---

## 4. Where Each Action Happens

- **VS Code:**
  - `src/server/services/run-query-service.ts`
  - `src/app/api/runs/[id]/route.ts`
  - `src/app/api/runs/[id]/events/route.ts`
  - `src/app/api/v1/verify/route.ts`
  - `tests/integration/run-endpoints.test.ts`
- **PowerShell:** Running API tests.

---

## 5. Numbered Implementation Steps

### Step 1: Implement Sanitized Projection (`src/server/services/run-query-service.ts`)
Query Prisma and scrub private fields:
```typescript
import { db } from '@/server/db/client';

export async function getSanitizedRunSnapshot(runId: string, ownerHash: string) {
  const run = await db.verificationRun.findUnique({
    where: { id: runId },
    include: {
      claims: true,
      dagNodes: {
        select: {
          id: true,
          nodeType: true,
          state: true,
          // leaseToken, leaseUntil, outputReference are STRICTLY EXCLUDED!
        },
      },
    },
  });

  if (!run || run.ownerHash !== ownerHash) {
    return null; // Return null to trigger 404 Not Found (privacy isolation)
  }

  return run;
}
```

### Step 2: Implement Snapshot Route (`src/app/api/runs/[id]/route.ts`)
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getSanitizedRunSnapshot } from '@/server/services/run-query-service';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ownerHash = req.cookies.get('afterfact_owner')?.value ?? '';

  const snapshot = await getSanitizedRunSnapshot(id, ownerHash);
  if (!snapshot) {
    return NextResponse.json({ error: 'Run not found' }, { status: 404 });
  }

  return NextResponse.json(snapshot, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
```

### Step 3: Implement SSE Stream Route (`src/app/api/runs/[id]/events/route.ts`)
Stream `RunEvent` records from PostgreSQL with sequence replay:
```typescript
import { NextRequest } from 'next/server';
import { db } from '@/server/db/client';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const afterSeq = parseInt(req.nextUrl.searchParams.get('afterSeq') ?? '0', 10);
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      // 1. Replay missed events
      const missed = await db.runEvent.findMany({
        where: { runId: id, seq: { gt: afterSeq } },
        orderBy: { seq: 'asc' },
      });

      for (const ev of missed) {
        controller.enqueue(encoder.encode(`id: ${ev.seq}\nevent: ${ev.type}\ndata: ${JSON.stringify(ev.payload)}\n\n`));
      }

      // 2. Keepalive heartbeat
      const heartbeatTimer = setInterval(() => {
        controller.enqueue(encoder.encode(': heartbeat\n\n'));
      }, 15000);

      req.signal.addEventListener('abort', () => {
        clearInterval(heartbeatTimer);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
```

### Step 4: Implement Programmatic REST Adapter (`src/app/api/v1/verify/route.ts`)
Thin adapter wrapping `VerificationService`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { VerificationService } from '@/server/services/verify-service';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const result = await VerificationService.runVerification(body);
  return NextResponse.json(result);
}
```

### Step 5: Run Integration Tests
```powershell
pnpm vitest run tests/integration/run-endpoints.test.ts
```
- **What It Proves:** Replaying with `?afterSeq=2` returns only events $\ge 3$; requests with mismatched cookies return 404.

---

## 6. Verification and Handoff

- Record test results in [docs/PHASE-TRACKER.md](../PHASE-TRACKER.md#b06-implement-the-public-run-endpoints).
- **Handoff:** Satisfies **Gate G3** public API requirement. Unblocks **C06** (Compare drawer) and **A09** (eval benchmark).
