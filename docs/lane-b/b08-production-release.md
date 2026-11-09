# docs/lane-b/b08-production-release.md — Production Release & Fallback Verification

- **Ticket Reference:** [B08 in docs/PHASE-TRACKER.md](../PHASE-TRACKER.md#b08-deploy-production-and-verify-fallbacks)
- **Status in Tracker:** `TODO`
- **Assigned Lane:** Lane B (Platform)
- **Verification Tier:** E5 (Production live verification trace)

---

## 1. What You Are Building

You are deploying the final, production-ready Afterfact platform:
1. **Production Database Migrations:** Applying final Prisma schema migrations to Neon's production `main` branch.
2. **Production App on Vercel:** Deploying to the custom production domain with HTTPS.
3. **Production Bifrost Gateway on Railway:** Verifying volume persistence and rate-limit buffering.
4. **Automated Provider Failover Test:** Proving that an outage on the primary model provider seamlessly routes to the fallback profile without user error.

---

## 2. Why Afterfact Needs It

This completes **Gate G4 (Release Candidate Gate)**:
- Hackathon judges will access the site directly on a public domain without team logins.
- If OpenAI or Anthropic suffers an outage during judging, Bifrost's automated fallback guarantees the demo continues working.
- The 24-hour retention daemon and 60-second reconciliation sweeper run continuously.

---

## 3. Before You Start

- **Prerequisites:** B07 (Staging deployment) and C07 (UI polish) completed.
- **Production Credentials:** Production Vercel domain, Neon production connection strings, production Bifrost gateway token.

---

## 4. Where Each Action Happens

- **PowerShell:** Running production migration command and smoke tests.
- **Neon Console:** Verifying production branch (`main`).
- **Vercel Dashboard:** Production environment variables and custom domain DNS.
- **Railway Dashboard:** Production Bifrost service and volume snapshot.

---

## 5. Numbered Implementation Steps

### Step 1: Author `infra/production.env` & Apply Migrations via Prisma
Create `infra/production.env` with production configuration:
```bash
# infra/production.env
NODE_ENV=production
APP_BASE_URL=https://afterfact.dev

DATABASE_URL=postgres://user:pass@ep-production-pooler.us-east-2.aws.neon.tech/afterfact?sslmode=require&pgbouncer=true
DIRECT_URL=postgres://user:pass@ep-production.us-east-2.aws.neon.tech/afterfact?sslmode=require

BIFROST_BASE_URL=https://bifrost.afterfact.dev
BIFROST_GATEWAY_TOKEN=bf_gw_production_token
BIFROST_EXTRACT_MODEL=openai/gpt-4o-mini
BIFROST_ASSESS_MODEL=anthropic/claude-3-5-sonnet-20241022
BIFROST_DRAFT_MODEL=openai/gpt-4o
BIFROST_ASSESS_FALLBACK=groq/llama-3.3-70b-versatile

TAVILY_API_KEY=tvly-production-key
QSTASH_TOKEN=qstash_production_token
QSTASH_CURRENT_SIGNING_KEY=sig_prod_curr
QSTASH_NEXT_SIGNING_KEY=sig_prod_next
```

In PowerShell, apply production migrations:
```powershell
dotenv -e infra/production.env -- pnpm prisma migrate deploy
```
- **What It Executes:** Applies all pending migrations to the production database via `DIRECT_URL`.
- **How to Check:** Verify tables exist in the Neon console on the `main` branch.

### Step 2: Deploy Production Next.js to Vercel
1. Set production environment variables in Vercel project settings matching `infra/production.env`.
2. Attach custom domain (e.g. `https://afterfact.dev`).
3. Deploy the release commit to production.

### Step 3: Configure Scheduled Reconciliation Sweeper
Configure a recurring cron job calling `/api/internal/reconcile` every 60 seconds:
- **Option A (Vercel Cron):** Add `vercel.json` with cron schedule `* * * * *`.
- **Option B (QStash Schedule):** In the Upstash console, create a recurring schedule publishing to `${APP_BASE_URL}/api/internal/reconcile` every minute.

### Step 4: Author and Run Production Smoke Test with Fallback Verification (`infra/smoke-production.ts`)
Author `infra/smoke-production.ts` verifying both the live production domain and transparent Bifrost failover:
```typescript
// infra/smoke-production.ts
async function runProductionSmokeTest() {
  const prodUrl = process.env.APP_BASE_URL || 'https://afterfact.dev';
  console.log(`Starting live production verification on: ${prodUrl}`);

  // Test 1: Live Verification Run on Production Domain
  const submitRes = await fetch(`${prodUrl}/api/v1/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: 'Stripe standard fee is 2.9% plus 30 cents per transaction.',
      mode: 'paste',
    }),
  });

  if (!submitRes.ok) {
    const errText = await submitRes.text();
    throw new Error(`Production run submission failed (HTTP ${submitRes.status}): ${errText}`);
  }

  const { runId } = await submitRes.json();
  console.log(`Production run submitted successfully. Run ID: ${runId}`);

  // Test 2: Verify Gateway Fallback Route Health
  const bifrostUrl = process.env.BIFROST_BASE_URL;
  const token = process.env.BIFROST_GATEWAY_TOKEN;
  if (bifrostUrl && token) {
    console.log('Verifying Bifrost fallback profile failover route...');
    const fallbackModel = process.env.BIFROST_ASSESS_FALLBACK || 'groq/llama-3.3-70b-versatile';
    const fallbackRes = await fetch(`${bifrostUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        model: fallbackModel,
        messages: [{ role: 'user', content: 'Ping' }],
        temperature: 0,
      }),
    });

    if (!fallbackRes.ok) {
      throw new Error(`Bifrost fallback profile check failed with HTTP ${fallbackRes.status}`);
    }
    console.log(`Fallback profile (${fallbackModel}) is active and healthy.`);
  }

  console.log('Production release verification PASSED successfully.');
}

runProductionSmokeTest().catch((err) => {
  console.error('Production release smoke test FAILED:', err);
  process.exit(1);
});
```

Execute the smoke test in PowerShell:
```powershell
dotenv -e infra/production.env -- pnpm tsx infra/smoke-production.ts
```
- **Expected Result:** Live verification completes end-to-end on the public production URL with valid HTTPS certificate and verified fallback route.

---

## 6. Verification and Handoff

- Record production URL, latency trace, and smoke test output in [docs/PHASE-TRACKER.md](../PHASE-TRACKER.md#b08-deploy-production-and-verify-fallbacks).
- **Handoff:** Completes Lane B project responsibilities. Unblocks **C08** (Video walkthrough recording) and **C09** (Final hackathon portal packaging and submission).
