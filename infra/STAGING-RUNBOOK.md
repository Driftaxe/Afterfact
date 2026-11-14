# Afterfact — Staging Deployment Runbook & Cloud Checklist (Ticket B07)

This runbook guides the human operator through provisioning, configuring, and verifying the **Afterfact Staging Environment** across Vercel, Neon, Railway, and Upstash.

---

## 1. Architecture Overview (Staging Topology)

| Component | Provider & Tier | Configuration Target | Purpose |
| :--- | :--- | :--- | :--- |
| **Frontend & API** | Vercel Serverless (Next.js 15) | `https://afterfact-staging.vercel.app` | UI, Server Actions, Public REST, SSE stream |
| **Relational Database** | Neon PostgreSQL | Branch `afterfact-staging` | Persisted DAG runs, claims, evidence, events |
| **Model Gateway** | Railway (`maximhq/bifrost`) | `https://bifrost-staging.up.railway.app` | LLM router with persistent volume `/app/data` |
| **Queue / Webhooks** | Upstash QStash | Topic targeting `/api/verify/worker` | Signed asynchronous background job delivery |
| **Web Retrieval** | Tavily Search API | Production tier key | Contextual web evidence grounding |

---

## 2. Cloud Provisioning Step-by-Step

### Phase 1: Neon Database Setup (Branch `afterfact-staging`)
1. Open the [Neon Console](https://console.neon.tech/).
2. Select the `afterfact` project.
3. Click **Branches -> New Branch**:
   - **Branch Name:** `afterfact-staging`
   - **Parent Branch:** `main` (or root)
4. From the **Connection Details** widget, copy:
   - **Pooled connection string (`DATABASE_URL`):** (Port `5432` or `6543` with `?sslmode=require&pgbouncer=true`)
   - **Direct connection string (`DIRECT_URL`):** (Port `5432` unpooled with `?sslmode=require`)
5. In your local terminal, apply the schema migrations to the staging branch:
   ```powershell
   # Apply all migrations non-destructively:
   $env:DATABASE_URL="<staging-pooled-url>"
   $env:DIRECT_URL="<staging-direct-url>"
   pnpm prisma migrate deploy
   ```
6. In the Neon SQL Editor, verify tables exist:
   ```sql
   SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
   -- Expect: runs, claims, events, dag_nodes, dag_edges, clarifications, source_documents, evidence_units
   ```

---

### Phase 2: Bifrost Gateway on Railway
1. Open the [Railway Dashboard](https://railway.app/).
2. Confirm the Bifrost service is active with a public HTTPS domain:
   - **URL:** `https://bifrost-staging.up.railway.app` (or your chosen Railway domain).
3. Ensure a persistent volume is mounted at `/app/data` so configuration survives container redeploys.
4. Verify provider API keys (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GROQ_API_KEY`) are saved inside Bifrost.
5. Obtain or create the **`BIFROST_GATEWAY_TOKEN`** for application inference calls.

---

### Phase 3: Upstash QStash Configuration
1. Open the [Upstash Console](https://console.upstash.com/) and navigate to **QStash**.
2. Note your credentials:
   - `QSTASH_TOKEN`
   - `QSTASH_CURRENT_SIGNING_KEY`
   - `QSTASH_NEXT_SIGNING_KEY`
3. Configure the webhook destination URL:
   - **Target URL:** `https://afterfact-staging.vercel.app/api/verify/worker`
   - **Retry Policy:** 3 retries with exponential backoff.
4. If Vercel Deployment Protection is enabled, add a custom header:
   - Header: `x-vercel-protection-bypass`
   - Value: `<your-secret-bypass-token>`

---

### Phase 4: Vercel Staging Deployment
1. Open the [Vercel Dashboard](https://vercel.com/) and select the `Afterfact` project.
2. Under **Settings -> Environment Variables**, configure the following for the **Preview / Staging** environment:

| Variable Name | Required Value Description |
| :--- | :--- |
| `APP_ENV` | `staging` |
| `APP_BASE_URL` | `https://afterfact-staging.vercel.app` |
| `DATABASE_URL` | Neon `afterfact-staging` pooled connection string |
| `DIRECT_URL` | Neon `afterfact-staging` direct connection string |
| `BIFROST_BASE_URL` | `https://bifrost-staging.up.railway.app` |
| `BIFROST_GATEWAY_TOKEN` | Virtual key created in Bifrost dashboard |
| `BIFROST_EXTRACT_MODEL` | `openai/gpt-4o-mini` |
| `BIFROST_ASSESS_MODEL` | `anthropic/claude-3-5-sonnet-20241022` |
| `BIFROST_DRAFT_MODEL` | `openai/gpt-4o` |
| `BIFROST_ASSESS_FALLBACK`| `groq/llama-3.3-70b-versatile` |
| `TAVILY_API_KEY` | Real Tavily Search API key |
| `QSTASH_TOKEN` | Upstash QStash publishing token |
| `QSTASH_CURRENT_SIGNING_KEY`| Upstash primary signing key |
| `QSTASH_NEXT_SIGNING_KEY` | Upstash rotation signing key |
| `INTERNAL_CRON_SECRET` | Secret token guarding `/api/internal/reconcile` |
| `VERCEL_PROTECTION_BYPASS`| (Optional) If deployment protection is active |

3. Trigger deployment from GitHub branch or run:
   ```bash
   vercel --prod=false
   ```
4. Confirm build succeeds and routes are live:
   - `GET https://afterfact-staging.vercel.app/api/runs/test` -> returns HTTP 404 (Route is alive)

---

## 3. End-to-End Smoke Verification

Once cloud services are configured, execute the automated smoke test script:

```powershell
# Using environment file:
dotenv -e infra/staging.env -- pnpm smoke:staging

# Or passing target URL directly:
pnpm smoke:staging https://afterfact-staging.vercel.app
```

### Expected Output:
```text
======================================================================
[SMOKE-STAGING] Starting Afterfact Cloud Smoke Test
[SMOKE-STAGING] Target Base URL: https://afterfact-staging.vercel.app
======================================================================

[Step 1] Probing public endpoint availability...
[PASS] Server is live and responding (HTTP 404)

[Step 2] Submitting verification job via POST /api/v1/verify...
[PASS] Verification job accepted (HTTP 202)
       Run ID:       c...
       State:        running
       Snapshot URL: /api/runs/c...
       Stream URL:   /api/runs/c.../events

[Step 3] Polling run snapshot for execution progress (timeout: 60s)...
  [Poll #1 @ +3s] State: running | Nodes: 1/2
  [Poll #2 @ +6s] State: completed | Nodes: 2/2

[PASS] Run reached terminal state: 'completed'
       Summary: totalClaims=1, supported=1, outdated=0

[Step 4] Checking SSE progress stream endpoint replay...
[PASS] SSE stream endpoint is active (HTTP 200, Content-Type: text/event-stream)

======================================================================
[SMOKE-STAGING] Cloud Smoke Test COMPLETED successfully.
======================================================================
```
