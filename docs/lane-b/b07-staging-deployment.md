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

### Step 1: Create Neon Staging Branch & Apply Migrations
1. In the Neon console, create a new branch named `afterfact-staging`.
2. Copy `DATABASE_URL` (pooled) and `DIRECT_URL` (direct).
3. Apply migrations to staging using the deployment command (which applies pending migrations without prompting for names):
   ```powershell
   dotenv -e infra/staging.env -- pnpm prisma migrate deploy
   ```
- **How to Check:** Verify tables exist on the staging branch in Neon SQL Editor.

### Step 2: Deploy Next.js to Vercel Staging
1. In Vercel, click **Add New -> Project**, and import `Afterfact`.
2. Under **Environment Variables**, add staging values:
   - `DATABASE_URL`: Staging pooled Neon URL.
   - `DIRECT_URL`: Staging direct Neon URL.
   - `BIFROST_BASE_URL`: `https://bifrost-staging.up.railway.app`
   - `BIFROST_GATEWAY_TOKEN`: Staging virtual key.
   - `TAVILY_API_KEY`: Staging Tavily key.
   - `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY`.
3. Click **Deploy**. Note the staging deployment URL (e.g. `https://afterfact-staging.vercel.app`).

### Step 3: Configure QStash Webhook Ingress
1. In the Upstash console, set the destination webhook URL:
   `https://afterfact-staging.vercel.app/api/verify/worker`
2. If Vercel Deployment Protection is active, add the bypass secret header (`x-vercel-protection-bypass`).

### Step 4: Run Automated Staging Smoke Test (`infra/smoke-staging.ts`)
Run the end-to-end cloud smoke test:
```powershell
pnpm tsx infra/smoke-staging.ts
```
- **What It Executes:** Submits a real 1-claim verification against the staging URL, watches the SSE stream over TLS, and confirms the terminal report is generated.

---

## 6. Verification and Handoff

- Record the staging URL, deployment hash, and smoke test output in [docs/PHASE-TRACKER.md](../PHASE-TRACKER.md#b07-provision-staging-with-real-integrations).
- **Handoff:** Unblocks **B08** (Production Release) and **A09** (Benchmark evaluation on staging).
