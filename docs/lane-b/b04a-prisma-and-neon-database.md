# docs/lane-b/b04a-prisma-and-neon-database.md — Neon Database Setup & Prisma Schema Baseline

- **Ticket Reference:** [B04a in docs/PHASE-TRACKER.md](../PHASE-TRACKER.md#b04-migrate-the-data-model-and-wire-the-vertical-slice)
- **Status in Tracker:** `TODO`
- **Assigned Lane:** Lane B (Platform)
- **Verification Tier:** E3 (Integration against live Neon test/dev branch)

---

## 1. What You Are Building

You are setting up Afterfact's relational database layer:
1. **Neon PostgreSQL Cloud Branches:** Creating `afterfact-dev` (development) and `afterfact-test` (automated integration tests).
2. **Prisma Schema (`prisma/schema.prisma`):** Defining the 11 relational models (`VerificationRun`, `Preparation`, `Claim`, `SourceDocument`, `EvidenceUnit`, `ClaimEvidenceAssessment`, `DecisionRecord`, `RunEvent`, `DagNode`, `DagEdge`, `Clarification`).
3. **Database Client Singleton (`src/server/db/client.ts`):** Ensuring Next.js serverless functions reuse database connections without leaking them.
4. **Baseline Migration:** Running `prisma migrate dev` to create tables and indexes on Neon.

---

## 2. Why Afterfact Needs It

A verification run is a stateful process. We need to:
- Store parsed claims, extracted evidence, and audit logs.
- Fulfill ACID guarantees so dynamic DAG expansion never commits partial or broken states.
- Support real-time progress events streamed to the user via SSE.
- Manage worker leases so two background workers never race to verify the same claim.

---

## 3. Before You Start

- **Prerequisites:** B01 completed; contract schemas merged from **A10** (`src/lib/contracts/`).
- **Accounts:** Neon account at [neon.tech](https://neon.tech).
- **No Local Docker:** You do **not** need Docker installed. Neon runs Postgres in the cloud.

---

## 4. Where Each Action Happens

- **Neon Console:** Project and branch creation; copying connection strings.
- **VS Code:** Creating `prisma/schema.prisma` and `src/server/db/client.ts`.
- **PowerShell:** Running Prisma migration and test commands.

---

## 5. Numbered Implementation Steps

### Step 1: Create Neon Project & Branches
1. Log in to [neon.tech](https://neon.tech) and create a project named `afterfact`.
2. Under **Branches**, verify `main` exists. Click **New Branch** and create:
   - `afterfact-dev` (parent: `main`)
   - `afterfact-test` (parent: `main`)
3. On `afterfact-dev`, copy:
   - **Pooled connection string:** Select "Connection pooling" checkbox (host has `-pooler`). This is your `DATABASE_URL`.
   - **Direct connection string:** Uncheck "Connection pooling" (host does not have `-pooler`). This is your `DIRECT_URL`.
4. Add these to your `.env.local`:
   ```bash
   DATABASE_URL=postgres://user:pass@ep-sample-pooler.us-east-2.aws.neon.tech/afterfact?sslmode=require&pgbouncer=true
   DIRECT_URL=postgres://user:pass@ep-sample.us-east-2.aws.neon.tech/afterfact?sslmode=require
   ```

### Step 2: Create `prisma/schema.prisma`
In `prisma/schema.prisma`, write the complete schema definition documented in [docs/DATA-AND-JOBS.md §1](../DATA-AND-JOBS.md#authoritative-prisma-schema-prismaschemaprisma):
```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

generator client {
  provider = "prisma-client-js"
}

model VerificationRun {
  id             String    @id @default(cuid()) @db.VarChar(36)
  ownerHash      String    @db.VarChar(64)
  inputHash      String    @db.VarChar(64)
  prepId         String?   @db.VarChar(36)
  idempotencyKey String?   @db.VarChar(64)
  mode           String    @db.VarChar(16)
  text           String    @db.Text
  question       String?   @db.Text
  context        Json      @db.JsonB
  parentRunId    String?   @db.VarChar(36)
  state          String    @db.VarChar(16)
  graphVersion   Int       @default(1)
  createdAt      DateTime  @default(now()) @db.Timestamptz
  finishedAt     DateTime? @db.Timestamptz
  expiresAt      DateTime  @db.Timestamptz
  nextEventSeq   Int       @default(1)

  preparation    Preparation?       @relation(fields: [prepId], references: [id], onDelete: SetNull)
  claims         Claim[]
  sourceDocs     SourceDocument[]
  events         RunEvent[]
  dagNodes       DagNode[]
  dagEdges       DagEdge[]
  clarifications Clarification[]

  @@unique([ownerHash, idempotencyKey])
  @@index([ownerHash, createdAt])
  @@index([expiresAt])
  @@map("runs")
}

// ... Additional models (Preparation, Claim, SourceDocument, EvidenceUnit,
// ClaimEvidenceAssessment, DecisionRecord, RunEvent, DagNode, DagEdge, Clarification)
// matching docs/DATA-AND-JOBS.md
```

### Step 3: Implement Database Client Singleton (`src/server/db/client.ts`)
```typescript
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;
```

### Step 4: Run Baseline Migration Against Neon
In PowerShell at the project root:
```powershell
pnpm prisma migrate dev --name init
```
- **What Happens:** Prisma connects via `DIRECT_URL`, creates tables and indexes on Neon `afterfact-dev`, logs migration history in `_prisma_migrations`, and generates `@prisma/client`.
- **How to Check:** Run `pnpm prisma studio`. A browser tab opens at `http://localhost:5555` displaying all 11 empty tables!

### Step 5: Test Database Teardown Guard (`tests/integration/db-setup.ts`)
Create a helper for automated tests that guards against truncating non-test databases:
```typescript
import { db } from '@/server/db/client';

export async function resetTestDatabase() {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('Refusing to truncate database outside test environment');
  }
  const url = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || '';
  if (!url.includes('-test') && !url.includes('afterfact_test')) {
    throw new Error('Refusing to truncate non-test database: ' + url);
  }
  await db.$executeRawUnsafe(`
    TRUNCATE TABLE "events", "claim_evidence_assessments", "evidence_units",
                   "source_documents", "claims", "dag_edges", "dag_nodes",
                   "clarifications", "runs", "preparations" CASCADE;
  `);
}
```

---

## 6. Verification and Handoff

- **Verification:** Run `pnpm prisma validate` and execute a simple CRUD test against Neon.
- **Record Evidence:** Note migration execution in [docs/PHASE-TRACKER.md](../PHASE-TRACKER.md#b04-migrate-the-data-model-and-wire-the-vertical-slice).
- **Handoff:** Satisfies **Gate G0** database requirement. Unblocks **C02** (preparation persistence) and **B04b** (DAG execution slice).
