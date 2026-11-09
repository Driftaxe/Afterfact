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

### Step 1: Apply Production Migrations via Prisma
In PowerShell:
```powershell
dotenv -e infra/production.env -- pnpm prisma migrate deploy
```
- **What It Executes:** Applies all pending migrations to the production database via `DIRECT_URL`.
- **How to Check:** Verify tables exist in the Neon console on the `main` branch.

### Step 2: Deploy Production Next.js to Vercel
1. Set production environment variables in Vercel project settings.
2. Attach custom domain (e.g. `https://afterfact.dev`).
3. Deploy the release commit to production.

### Step 3: Configure Scheduled Reconciliation Sweeper
Configure a recurring cron job calling `/api/internal/reconcile` every 60 seconds:
- **Option A (Vercel Cron):** Add `vercel.json` with cron schedule `* * * * *`.
- **Option B (QStash Schedule):** In the Upstash console, create a recurring schedule publishing to `${APP_BASE_URL}/api/internal/reconcile` every minute.

### Step 4: Test Bifrost Fallback on Injected Fault
Simulate an outage on the primary model provider:
1. Temporarily configure Bifrost's primary route to return an HTTP 500 error.
2. Execute a test verification run.
3. **Expected Behavior:** Bifrost transparently fails over to `BIFROST_ASSESS_FALLBACK` (Groq Llama 3.3 70B); the run completes with score 100 or 75 and zero user-facing error banners.

### Step 5: Execute Production Smoke Test (`infra/smoke-production.ts`)
Run the end-to-end production verification script:
```powershell
pnpm tsx infra/smoke-production.ts
```
- **Expected Result:** Live verification completes end-to-end on the public production URL with valid HTTPS certificate.

---

## 6. Verification and Handoff

- Record production URL, latency trace, and smoke test output in [docs/PHASE-TRACKER.md](../PHASE-TRACKER.md#b08-deploy-production-and-verify-fallbacks).
- **Handoff:** Completes Lane B project responsibilities. Unblocks **C08** (Video walkthrough recording) and **C09** (Final hackathon portal packaging and submission).
