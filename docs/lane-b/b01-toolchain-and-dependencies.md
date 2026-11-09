# docs/lane-b/b01-toolchain-and-dependencies.md — Toolchain & Dependency Setup

- **Ticket Reference:** [B01 in docs/PHASE-TRACKER.md](../PHASE-TRACKER.md#b01-scaffold-and-pin-the-toolchain)
- **Status in Tracker:** `REVIEW` (Follow-up migration tasks queued)
- **Assigned Lane:** Lane B (Platform)
- **Verification Tier:** E1 (Static analysis & build) + E2 (Unit suite)

---

## 1. What You Are Building

You are setting up the foundation packages for the repository. Specifically, you are finalizing the package configuration by swapping the obsolete Drizzle packages (`drizzle-orm`, `drizzle-kit`) for **Prisma** (`@prisma/client` and `prisma` CLI), and verifying that the local Docker-free Bifrost gateway script (`pnpm bifrost`) is ready.

---

## 2. Why Afterfact Needs It

Every verifier feature—from saving extracted claims to logging real-time progress events—needs a reliable data layer. We selected Prisma for its type safety, migration tracking, and visual database explorer (`prisma studio`). We also need `dotenv-cli` so developers can run local Bifrost without installing Docker.

---

## 3. Before You Start

- **Prerequisites:** Git repository cloned on branch `feat/b01-scaffold` (or your feature branch).
- **Installed Tools:** Node `22.18.0` and pnpm `11.9.0`.
- **External Accounts:** None needed for this step.

---

## 4. Where Each Action Happens

- **Project files:** `package.json`, `pnpm-lock.yaml`, `.env.example`.
- **Terminal:** PowerShell in project root (`C:\Users\Mayur\Desktop\Afterfact`).

---

## 5. Numbered Implementation Steps

> [!NOTE]
> The commands below represent planned implementation steps to execute when claiming this ticket.

### Step 1: Remove Drizzle dependencies
In PowerShell at the project root, remove Drizzle packages:
```powershell
pnpm remove drizzle-orm drizzle-kit
```
- **Expected Result:** `package.json` updates and `pnpm-lock.yaml` removes Drizzle entries.
- **How to Check:** Run `git diff package.json` and ensure `- "drizzle-orm"` and `- "drizzle-kit"` appear in red.

### Step 2: Install Prisma packages
Install Prisma Client as a runtime dependency and Prisma CLI as a dev dependency:
```powershell
pnpm add @prisma/client@^6.4.0
pnpm add -D prisma@^6.4.0
```
- **Reason:** `@prisma/client` is used by your application code to query the database. `prisma` is the command-line tool used to create migrations and generate code.
- **How to Check:** Check `package.json` under `"dependencies"` for `@prisma/client` and under `"devDependencies"` for `prisma`.

### Step 3: Verify the Docker-Free Bifrost Script
Inspect `package.json` `"scripts"` section. Verify that `"bifrost"` is present:
```json
"scripts": {
  "bifrost": "dotenv -e .env -- pnpm dlx @maximhq/bifrost"
}
```
If `dotenv-cli` is missing, install it:
```powershell
pnpm add dotenv-cli
```
- **Reason:** This allows developers on Windows to run Bifrost with a single command without Docker.

### Step 4: Verify Clean Build and Static Analysis
Run all static verification checks:
```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```
- **Expected Result:** 0 lint errors, 0 TypeScript errors, all unit tests pass, and Next.js builds cleanly.

---

## 6. Verification and Handoff

Collect the command transcript from Step 4. Record it in the ticket's `Evidence` field in [docs/PHASE-TRACKER.md](../PHASE-TRACKER.md).

**Handoff to Teammates:**
- Downstream tickets **B02** (Bifrost Gateway) and **B04a** (Database Baseline) are now unblocked.
