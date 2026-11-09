# docs/lane-b/troubleshooting.md — Lane B Troubleshooting Handbook

This guide provides rapid fixes for common errors encountered during local development, database migrations, and cloud deployment in Lane B.

---

## 1. Database & Prisma Errors

### Problem 1: `PrismaClientInitializationError: Can't reach database server`
- **Symptom:** Running a query or migration fails with connection timeout.
- **Cause A (Neon Compute Sleeping):** Neon free-tier databases suspend compute after 5 minutes of inactivity. When a new query arrives, Neon takes 1–3 seconds to wake up.
  - **Fix:** Wait 3 seconds and retry. If still failing, open the Neon console to verify the branch is active.
- **Cause B (Missing SSL Mode):** Neon requires TLS for all connections.
  - **Fix:** Ensure your connection strings in `.env.local` end with `?sslmode=require` (and `&pgbouncer=true` for `DATABASE_URL`).

---

### Problem 2: `Error: P3005: The database schema is not empty`
- **Symptom:** Running `pnpm prisma migrate dev` fails complaining about existing tables.
- **Cause:** Tables were created manually or by another migration tool without Prisma's migration history.
  - **Fix (Dev Database):** If working on `afterfact-dev`, run:
    ```powershell
    pnpm prisma migrate reset
    ```
    *(Caution: This drops and recreates the dev database. Never run reset on production!)*
  - **Fix (Staging/Production):** Run `pnpm prisma migrate deploy` instead.

---

### Problem 3: `Error: Direct connection required for migrations`
- **Symptom:** Running `pnpm prisma migrate dev` fails over PgBouncer pooled connection.
- **Cause:** Neon's connection pooler does not support advisory locks and transactional DDL used by Prisma migrations.
  - **Fix:** Ensure `prisma/schema.prisma` contains:
    ```prisma
    datasource db {
      provider  = "postgresql"
      url       = env("DATABASE_URL")
      directUrl = env("DIRECT_URL")
    }
    ```
    And ensure `DIRECT_URL` in `.env.local` points to the direct compute endpoint (without `-pooler`).

---

## 2. Bifrost Gateway Errors

### Problem 4: `fetch failed: ECONNREFUSED 127.0.0.1:8080`
- **Symptom:** Calling `bifrostChat` fails with connection refused.
- **Cause:** The local Bifrost process is not running.
  - **Fix:** Open a separate PowerShell window, navigate to the project root, and run:
    ```powershell
    pnpm bifrost
    ```
    Keep this window open while developing!

---

### Problem 5: `Bifrost HTTP 401: Unauthorized`
- **Symptom:** Bifrost responds with 401 when sending a prompt.
- **Cause:** Missing or invalid `BIFROST_GATEWAY_TOKEN`.
  - **Fix:** Log in to your Bifrost dashboard (locally at `http://127.0.0.1:8080` or on Railway), go to **Virtual Keys**, generate a new key, and copy it into `BIFROST_GATEWAY_TOKEN` in `.env.local`.

---

### Problem 6: Port 8080 is already in use
- **Symptom:** Running `pnpm bifrost` fails saying port 8080 is bound.
- **Fix:** In PowerShell, find which process is holding port 8080 and kill it:
  ```powershell
  Get-Process -Id (Get-NetTCPConnection -LocalPort 8080).OwningProcess | Stop-Process -Force
  ```

---

## 3. QStash & Distributed Execution Errors

### Problem 7: `HTTP 401: Unauthorized signature` on `/api/verify/worker`
- **Symptom:** Worker rejects incoming QStash job webhooks.
- **Cause A (Signing Key Mismatch):** `QSTASH_CURRENT_SIGNING_KEY` in environment does not match the key in Upstash console.
  - **Fix:** Check Upstash dashboard under QStash -> Keys. Update `.env.local` or Vercel environment variables.
- **Cause B (Body Mutation):** The webhook receiver requires the **exact, unmodified raw text body** to compute the HMAC signature. Calling `await req.json()` before signature verification corrupts the signature check.
  - **Fix:** Always verify `await req.text()` first, then `JSON.parse(bodyText)`.

---

### Problem 8: `HTTP 409 Conflict: Worker lease expired or stolen`
- **Symptom:** Worker finishes processing evidence but fails to commit results.
- **Cause:** The worker took longer than 35 seconds to assess evidence, so its lease expired and was reclaimed by the sweeper or another worker.
- **Why this happens:** The system is working as intended to prevent split-brain states!
- **Fix:** Check external LLM latency. Ensure calls to Bifrost pass a 20-second timeout so workers abort before the 35-second database lease expires.

---

## 4. Windows & PowerShell Quick Fixes

### Problem 9: `File cannot be loaded because running scripts is disabled on this system`
- **Symptom:** PowerShell blocks running `pnpm` or `tsx`.
- **Fix:** Run this once in your PowerShell session:
  ```powershell
  Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
  ```

---

### Problem 10: Port 3000 is already in use
- **Symptom:** `pnpm dev` fails to start because Next.js port 3000 is occupied.
- **Fix:** Kill the orphaned Node process:
  ```powershell
  Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess | Stop-Process -Force
  ```
