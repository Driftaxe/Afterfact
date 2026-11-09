# docs/SETUP-AND-DEPLOYMENT.md — Environment, Provisioning & Deployment

This document describes the environment topology, configuration settings, migration order, and operational runbooks for **Afterfact** (working name: Stale-Answer Detector).

> [!WARNING]
> **Secret Safety (P28):** Never commit actual secret keys or credentials to version control. This document lists environment variable keys and topologies only.

---

## 1. Environment Topology & Infrastructure Matrix

| Environment | Next.js Hosting | Database (Neon Postgres) | Model Gateway (Bifrost) | Queue Broker | Web Retrieval |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Local Dev** | `localhost:3000` (Node 22) | Neon Dev Branch (`afterfact-dev`) | Local Process (`pnpm bifrost` on `127.0.0.1:8080` · No Docker) | QStash via Tunnel / In-Process fallback | Tavily API |
| **Test / CI** | Vitest Runner / GitHub Actions | Neon Test Branch (`afterfact-test`) | Mock Doubles / Staging Gateway | Mock Receiver Doubles | Mock Fixtures / Tavily |
| **Staging** | Vercel Staging Alias | Neon Staging Branch (`afterfact-staging`) | Railway Hosted (`maximhq/bifrost` + Volume `/app/data`) | Upstash QStash (Staging topic) | Tavily API |
| **Production** | Vercel Production | Neon Production (`main`) | Railway Hosted (`maximhq/bifrost` + Volume `/app/data`) | Upstash QStash (Production topic) | Tavily API |

---

## 2. Environment Variables Inventory

### Next.js Application Server (.env / .env.local)
```bash
# Public Base URL
APP_BASE_URL=http://localhost:3000

# ------------------------------------------------------------------------------
# Neon Database Connections (Prisma ORM)
# ------------------------------------------------------------------------------
# Pooled connection string (PgBouncer, port 5432/6543) for application runtime queries
DATABASE_URL=postgres://user:password@ep-sample-pooler.us-east-2.aws.neon.tech/afterfact?sslmode=require&pgbouncer=true

# Direct unpooled connection string (port 5432) for Prisma DDL migrations
DIRECT_URL=postgres://user:password@ep-sample.us-east-2.aws.neon.tech/afterfact?sslmode=require

# Dedicated test database connection for automated integration tests
TEST_DATABASE_URL=postgres://user:password@ep-sample-test-pooler.us-east-2.aws.neon.tech/afterfact_test?sslmode=require&pgbouncer=true
TEST_DIRECT_URL=postgres://user:password@ep-sample-test.us-east-2.aws.neon.tech/afterfact_test?sslmode=require

# ------------------------------------------------------------------------------
# Web Intelligence
# ------------------------------------------------------------------------------
TAVILY_API_KEY=tvly-...               # Tavily search and raw passage extraction key

# ------------------------------------------------------------------------------
# Model Gateway — Bifrost (Local or Hosted)
# ------------------------------------------------------------------------------
BIFROST_BASE_URL=http://127.0.0.1:8080 # Or https://bifrost-staging.up.railway.app in staging
BIFROST_GATEWAY_TOKEN=bf_gw_...       # Bearer token for application inference route authentication
BIFROST_EXTRACT_MODEL=openai/gpt-4o-mini
BIFROST_ASSESS_MODEL=anthropic/claude-3-5-sonnet-20241022
BIFROST_DRAFT_MODEL=openai/gpt-4o
BIFROST_ASSESS_FALLBACK=groq/llama-3.3-70b-versatile

# ------------------------------------------------------------------------------
# Queue & Webhook Verification — Upstash QStash
# ------------------------------------------------------------------------------
QSTASH_TOKEN=qstash_...               # Token for server-side job publishing
QSTASH_CURRENT_SIGNING_KEY=sig_...    # Primary key to verify incoming webhook signatures
QSTASH_NEXT_SIGNING_KEY=sig_...       # Secondary key for seamless key rotation
```

### Bifrost Gateway Credentials & Secret Separation
Bifrost uses four distinct credential categories:
1. **`BIFROST_SETUP_TOKEN`:** Bootstrap token used on initial container launch to configure the administrator account.
2. **Dashboard Administrator Credentials:** Email and password used by humans to log in to the web console at `https://<bifrost-domain>/`.
3. **`BIFROST_GATEWAY_TOKEN`:** Application virtual key created inside the Bifrost dashboard for Afterfact client access. Passed by Next.js in `Authorization: Bearer <token>` headers to `/v1/chat/completions`.
4. **Upstream Provider API Keys (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GROQ_API_KEY`):** Stored securely inside Bifrost's encrypted vault or Railway environment variables. Never exposed to Next.js or the browser.

### Railway Bifrost Service Configuration
```bash
# Railway Container Environment Variables
PORT=8080
DATA_DIR=/app/data
BIFROST_SETUP_TOKEN=...
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...
GROQ_API_KEY=...
```

---

## 3. Neon Development & Test Database Isolation

### Branching Architecture
Neon provides instant copy-on-write branching for PostgreSQL:
- **`main` (Production):** Protected branch connected to Vercel production. Migrations applied via `pnpm prisma migrate deploy`.
- **`afterfact-staging`:** Staging branch connected to Vercel staging.
- **`afterfact-dev`:** Shared development branch for feature development and migration authoring (`pnpm prisma migrate dev`).
- **`afterfact-test`:** Dedicated integration test branch for automated E3 test execution.

### Safe Test Database Guard & Isolation
To prevent tests from accidentally mutating development or production data:
1. **Positive Test Target Identification:** Integration test harnesses must assert:
   ```typescript
   if (process.env.NODE_ENV !== 'test') {
     throw new Error('Integration tests must run with NODE_ENV=test');
   }
   const dbUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || '';
   if (!dbUrl.includes('-test') && !dbUrl.includes('afterfact_test')) {
     throw new Error('Refusing to run integration tests against non-test database: ' + dbUrl);
   }
   ```
2. **Deterministic Teardown via Guarded Table Truncation:**
   Because multiple connections run in integration tests (worker dispatches, reconciliation), transaction rollback cannot isolate separate connections. Instead, tests use fast table truncation in test hooks:
   ```typescript
   await db.$executeRawUnsafe(`
     TRUNCATE TABLE "events", "claim_evidence_assessments", "evidence_units",
                    "source_documents", "claims", "dag_edges", "dag_nodes",
                    "clarifications", "runs", "preparations" CASCADE;
   `);
   ```
3. **Serialized Integration Suite Execution:**
   In Vitest, database integration tests run with file serialization (`--no-file-parallelism`) to prevent concurrent test files from racing on truncated tables.

---

## 4. Provisioning & Deployment Sequence

Execute all infrastructure rollouts in this strict chronological order:

```mermaid
flowchart TD
    Step1["Step 1: Deploy Bifrost Gateway on Railway with Volume /app/data"] --> Step2["Step 2: Provision Neon Branches & Execute Prisma Migrations"]
    Step2 --> Step3["Step 3: Deploy Next.js to Vercel with Environment Secrets"]
    Step3 --> Step4["Step 4: Configure Upstash QStash Webhook Endpoint"]
    Step4 --> Step5["Step 5: Run Provider & Queue Smoke Tests"]
    Step5 --> Step6["Step 6: Activate Scheduled Reconciliation Daemon"]
```

### Step 1: Deploy Bifrost Gateway on Railway
1. In the Railway dashboard, create a new service deploying the prebuilt container `maximhq/bifrost:<pinned-version>`.
2. Add a persistent volume mounted at `/app/data` (size: 5 GB). This volume retains Bifrost's internal SQLite database (`bifrost.db`), routing rules, and virtual keys across container restarts.
3. Configure environment variables (`PORT=8080`, `DATA_DIR=/app/data`, `BIFROST_SETUP_TOKEN`, upstream provider keys).
4. Generate a public Railway domain (e.g. `https://bifrost-staging.up.railway.app`) exposing port 8080 over TLS.
5. Access the web console using `BIFROST_SETUP_TOKEN` to initialize the admin account, configure model fallback profiles, and generate `BIFROST_GATEWAY_TOKEN`.

### Step 2: Database Provisioning & Prisma Migrations
1. In the Neon console, create project `afterfact` and create branches `afterfact-dev` and `afterfact-test`.
2. Obtain connection-pooled (`DATABASE_URL`) and direct (`DIRECT_URL`) connection strings.
3. Apply migrations to the development database:
   ```powershell
   pnpm prisma migrate dev --name init
   ```
4. For staging/production deployment, apply migrations using:
   ```powershell
   pnpm prisma migrate deploy
   ```

### Step 3: Deploy Next.js to Vercel
1. Link GitHub repository to Vercel.
2. Populate environment variables in Vercel project settings (`DATABASE_URL`, `DIRECT_URL`, `BIFROST_BASE_URL`, `BIFROST_GATEWAY_TOKEN`, `TAVILY_API_KEY`, `QSTASH_*`).
3. If Vercel Deployment Protection is active, configure a bypass token for QStash webhook ingress.

### Step 4: Configure Upstash QStash
1. In the Upstash console, configure QStash topic and signing keys.
2. Set webhook target to `${APP_BASE_URL}/api/verify/worker`.
3. Set default retry policy to 3 attempts with exponential backoff.

### Step 5: Smoke Testing Entry Points
Before routing user traffic, run end-to-end smoke verification:
```bash
# Check Bifrost gateway health and model availability
curl -H "Authorization: Bearer ${BIFROST_GATEWAY_TOKEN}" ${BIFROST_BASE_URL}/v1/models

# Check Tavily search API
curl -X POST https://api.tavily.com/search -H "Authorization: Bearer ${TAVILY_API_KEY}" -d '{"query":"test"}'
```

---

## 5. Rollback and Disaster Recovery

1. **Vercel Rollback:**
   Vercel allows instant 1-click redeployment of previous immutable deployment artifacts. All Prisma database migrations must maintain backwards compatibility (additive columns only) so earlier application builds can query the current database schema without crashing.
2. **Neon Point-in-Time Recovery:**
   Neon supports instant branching and point-in-time recovery. In the event of data corruption, restore from a point-in-time branch within the 24-hour retention window.
3. **Railway Volume Backup:**
   Bifrost's internal SQLite database and routing rules are persisted on Railway's volume (`/app/data`). Take periodic volume snapshots before major gateway upgrades.
4. **Queue Drain:**
   If an unhandled bug causes poison-pill jobs in QStash, purge the pending queue topic via the Upstash dashboard and trigger `/api/internal/reconcile` to mark pending jobs as failed.
