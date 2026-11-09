# CONTRIBUTING.md — Team Execution & Development Workflow

Welcome to **Afterfact** (working name: Stale-Answer Detector). We are a three-builder hackathon team operating under high velocity with strict evidence standards. This document outlines our division of labor, branch management, and definition of Done.

---

## 1. Lane Ownership & Responsibilities

The codebase is strictly divided into three parallel engineering lanes:

| Lane | Focus | Primary Responsibilities | File & Directory Ownership |
| :---: | :--- | :--- | :--- |
| **A** | **Verification** | Claim extraction, passage assessment, date logic, domain policies, and evaluation benchmark. | `src/lib/contracts/*`<br>`src/server/verify/*`<br>`src/server/policies/*`<br>`src/server/prompts/*`<br>`fixtures/*`, `eval/*` |
| **B** | **Platform** | Toolchain, Neon DB, Prisma migrations, QStash jobs, dynamic DAG engine, Bifrost gateway, API routes, and deployment. | `src/server/db/*`<br>`src/server/jobs/*`<br>`src/server/services/*`<br>`src/server/bifrost/*`<br>`src/server/tavily/*`<br>`src/app/api/*`, `infra/*` |
| **C** | **Product** | Design system, UI components, split workspace, Server Actions, progress SSE, context comparison, and demo polish. | `src/app/page.tsx`<br>`src/app/runs/[id]/page.tsx`<br>`src/components/*`<br>`src/actions/*`<br>`src/hooks/*`, `public/*` |

Shared files (e.g., `package.json`, `docs/*`) require explicit cross-lane alignment.

---

## 2. Branch & Review Workflow

1. **One Branch Per Ticket:**
   Branch naming convention: `feat/<ticket-id>-<short-description>`, e.g.,
   - `feat/a01-schemas`
   - `feat/b01-scaffold`
   - `feat/c01-visual-tokens`
2. **Small Deployable Pull Requests:**
   Every PR should map directly to exactly one ticket in [docs/PHASE-TRACKER.md](docs/PHASE-TRACKER.md). Avoid large batch PRs.
3. **Mandatory Peer Review:**
   At least one peer builder must review and approve each PR before merging to `main`.
4. **Pull Request Description:**
   Always use [.github/PULL_REQUEST_TEMPLATE.md](.github/PULL_REQUEST_TEMPLATE.md). PRs without verified evidence logs will be rejected.

---

## 3. Task Claiming and Handoffs

1. **Check Dependencies & Readiness:**
   Before claiming a ticket in [docs/PHASE-TRACKER.md](docs/PHASE-TRACKER.md), inspect [docs/PARALLEL-WORK-PLAN.md](docs/PARALLEL-WORK-PLAN.md) to verify whether all start prerequisites and external integrations are satisfied, or if partial preparatory development is authorized.
2. **Claiming:**
   Change status to `IN PROGRESS` in the tracker with your branch link.
3. **Completing Handoffs:**
   When a ticket completes:
   - Verify downstream tickets waiting on your output using the handoff matrix in [docs/PARALLEL-WORK-PLAN.md](docs/PARALLEL-WORK-PLAN.md).
   - Post a concise handoff notice in chat/PR: deliverable path, exported types/routes, and verified test command.
   - Update ticket status to `DONE` in [docs/PHASE-TRACKER.md](docs/PHASE-TRACKER.md).

---

## 4. Definition of Done (DoD)

A ticket is considered **DONE** only when all of the following criteria are satisfied:
- [ ] **Code Quality:** All code compiles with zero TypeScript errors (`pnpm typecheck`) and passes linting (`pnpm lint`).
- [ ] **Acceptance Criteria Met:** All bulleted acceptance criteria on the ticket are satisfied, including negative tests.
- [ ] **Evidence Recorded:** Concrete test output, build command logs, or walkthrough screenshots are logged in the ticket's `Evidence` field at the calibrated tier (E1–E5).
- [ ] **Contract Fidelity:** Public APIs, database columns, and schemas match [docs/API.md](docs/API.md) and [docs/DATA-AND-JOBS.md](docs/DATA-AND-JOBS.md).
- [ ] **Secret Safety:** No credentials, access tokens, or private URLs are committed or logged.
- [ ] **Tracker Synchronized:** [docs/PHASE-TRACKER.md](docs/PHASE-TRACKER.md) is updated with the resolution and commit hash.

---

## 5. Logging Blockers & Evidence

- **Blockers:** If blocked by an external provider, missing credential, or API mismatch, mark status as `BLOCKED` in [docs/PHASE-TRACKER.md](docs/PHASE-TRACKER.md) and record the exact blocker in the ticket's `Blocker / Decision` field.
- **Evidence Format:** In PR descriptions and the tracker evidence log:
  ```markdown
  - **Date:** 2026-11-08
  - **Task ID:** B01
  - **Level:** E1 (Static) / E2 (Unit) / E3 (Integration) / E4 (Staging) / E5 (Production)
  - **Command:** `pnpm build && pnpm test`
  - **Result:** Build succeeded in 4.2s. 12/12 unit tests passing.
  ```
