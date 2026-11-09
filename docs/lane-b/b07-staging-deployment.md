# docs/lane-b/b07-staging-deployment.md — Staging Cloud Deployment

- **Ticket Reference:** [B07 in docs/PHASE-TRACKER.md](../PHASE-TRACKER.md#b07-provision-staging-with-real-integrations)
- **Status in Tracker:** `TODO`
- **Assigned Lane:** Lane B (Platform)
- **Verification Tier:** E4 (Staging automated cloud smoke run)

---

## 1. What You Are Building

You are deploying Afterfact to a live cloud staging environment connecting real providers over HTTPS/TLS:
- Next.js running on **Vercel Staging**.
- Relational database running on **Neon (`afterfact-staging` branch)**.
- Bifrost Gateway running on **Railway (`https://bifrost-staging.up.railway.app`)**.
- Asynchronous jobs delivered over TLS by **Upstash QStash**.

---

## 2. Why Afterfact Needs It

This satisfies **Gate G3 (Product Interactions & Staging Gate)**.
Mock tests cannot prove that:
- Vercel serverless function timeouts allow workers to finish.
- Upstash QStash signatures validate across public HTTPS proxies.
- Neon connection poolers handle concurrent background connections under load.
- Bifrost's persistent volume survives cloud container restarts.

---

## 3. Before You Start

- **Prerequisites:** B05 (QStash delivery) and B06 (Public endpoints) completed.
- **Accounts:** Vercel, Neon, Railway, Upstash.

---

## 4. Where Each Action Happens

- **Neon Console:** Creating `afterfact-staging` branch and copying connection strings.
- **Vercel Dashboard:** Linking repository, setting environment variables, and triggering deployment.
- **Upstash Console:** Creating staging QStash topic and configuring webhook endpoint URL.
- **PowerShell:** Running deployment migrations and staging smoke test.

---

## 5. Numbered Implementation Steps

### Step 1: Create Neon Staging Branch & Author `infra/staging.env`
1. In the Neon console, create a new branch named `afterfact-staging`.
2. Copy `DATABASE_URL` (pooled) and `DIRECT_URL` (direct).
3. Create `infra/staging.env` with staging configuration:
   ```bash
   # infra/staging.env
   NODE_ENV=staging
   APP_BASE_URL=https://afterfact-staging.vercel.app

   DATABASE_URL=postgres://user:pass@ep-staging-pooler.us-east-2.aws.neon.tech/afterfact?sslmode=require&pgbouncer=true
   DIRECT_URL=postgres://user:pass@ep-staging.us-east-2.aws.neon.tech/afterfact?sslmode=require

   BIFROST_BASE_URL=https://bifrost-staging.up.railway.app
   BIFROST_GATEWAY_TOKEN=bf_gw_staging_token
   BIFROST_EXTRACT_MODEL=openai/gpt-4o-mini
   BIFROST_ASSESS_MODEL=anthropic/claude-3-5-sonnet-20241022
   BIFROST_DRAFT_MODEL=openai/gpt-4o
   BIFROST_ASSESS_FALLBACK=groq/llama-3.3-70b-versatile

   TAVILY_API_KEY=tvly-staging-key
   QSTASH_TOKEN=qstash_staging_token
   QSTASH_CURRENT_SIGNING_KEY=sig_staging_curr
   QSTASH_NEXT_SIGNING_KEY=sig_staging_next
   ```
4. Apply migrations to staging using the deployment command (which applies pending migrations without prompting for names):
   ```powershell
   dotenv -e infra/staging.env -- pnpm prisma migrate deploy
   ```
- **How to Check:** Verify tables exist on the staging branch in Neon SQL Editor.

### Step 2: Deploy Next.js to Vercel Staging
1. In Vercel, click **Add New -> Project**, and import `Afterfact`.
2. Under **Environment Variables**, add staging values matching `infra/staging.env`.
3. Click **Deploy**. Note the staging deployment URL (e.g. `https://afterfact-staging.vercel.app`).

### Step 3: Configure QStash Webhook Ingress
1. In the Upstash console, set the destination webhook URL:
   `https://afterfact-staging.vercel.app/api/verify/worker`
2. If Vercel Deployment Protection is active, add the bypass secret header (`x-vercel-protection-bypass`).

### Step 4: Author and Run Staging Smoke Test (`infra/smoke-staging.ts`)
Author `infra/smoke-staging.ts` verifying end-to-end cloud execution and Bifrost fallback:
```typescript
// infra/smoke-staging.ts
async function runStagingSmokeTest() {
  const stagingUrl = process.env.APP_BASE_URL || 'https://afterfact-staging.vercel.app';
  console.log(`Starting cloud smoke test against: ${stagingUrl}`);

  // 1. Submit verification request via public API
  const submitRes = await fetch(`${stagingUrl}/api/v1/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: 'Stripe standard transaction processing fee is 2.9% plus 30 cents.',
      mode: 'paste',
    }),
  });

  if (!submitRes.ok) {
    const errText = await submitRes.text();
    throw new Error(`Staging submission failed (HTTP ${submitRes.status}): ${errText}`);
  }

  const { runId } = await submitRes.json();
  console.log(`Run submitted successfully. Run ID: ${runId}`);

  // 2. Poll snapshot endpoint until terminal state or timeout
  const startTime = Date.now();
  let state = 'running';
  let score: number | null = null;

  while (Date.now() - startTime < 60000) { // 60s timeout
    await new Promise((r) => setTimeout(r, 3000));
    const snapshotRes = await fetch(`${stagingUrl}/api/runs/${runId}`);
    if (!snapshotRes.ok) continue;

    const data = await snapshotRes.json();
    state = data.state;
    if (state === 'completed' || state === 'failed') {
      score = data.score ?? null;
      break;
    }
    console.log(`Run ${runId} in progress... (state: ${state})`);
  }

  console.log(`Staging run completed with state: ${state}, score: ${score}`);
  if (state !== 'completed') {
    throw new Error(`Staging smoke test failed: run did not reach 'completed' state.`);
  }

  console.log('Staging cloud smoke test PASSED successfully.');
}

runStagingSmokeTest().catch((err) => {
  console.error('Staging smoke test FAILED:', err);
  process.exit(1);
});
```

Run the smoke test in PowerShell:
```powershell
dotenv -e infra/staging.env -- pnpm tsx infra/smoke-staging.ts
```
- **What It Executes:** Submits a real 1-claim verification against the staging URL, watches progress over TLS, and confirms the terminal report is generated.

---

## 6. Verification and Handoff

- Record the staging URL, deployment hash, and smoke test output in [docs/PHASE-TRACKER.md](../PHASE-TRACKER.md#b07-provision-staging-with-real-integrations).
- **Handoff:** Unblocks **B08** (Production Release) and **A09** (Benchmark evaluation on staging).
