# AGENTS.md — Agent Operating Guidelines

This repository enforces disciplined, evidence-based engineering standards adapted from the **Universal Prompt Patterns Registry (UPPR) Revision 4**. All autonomous coding agents, assistants, and pair-programming sessions must strictly adhere to these rules.

---

## 1. Core Operating Principles

1. **Repository-First Grounding (P1):**  
   Always inspect existing files, git status, and branch context before planning or writing code. Never hallucinate nonexistent tools, packages, or architectural patterns.
2. **Respect Task Ownership & Lane Scopes (P4):**  
   Work is partitioned across three distinct lanes:
   - **Lane A (Verification):** Core verifier logic, schemas, prompts, policies, and evaluation benchmark.
   - **Lane B (Platform):** Toolchain, database, QStash worker delivery, Bifrost gateway, and deployment.
   - **Lane C (Product):** Frontend UI, design tokens, client state, comparison drawer, and demo polish.  
   Do not cross lane boundaries or edit files outside your assigned ticket without explicit coordination.
3. **Secret Safety Baseline (P28):**  
   **Never** read, print, output, or commit secret keys or environment variables (`.env`, `.env.local`, API tokens). Use variable names only.
4. **Proportionality & Complexity Bounding (P20):**  
   Implement the leanest viable solution that satisfies ticket requirements. Do not add speculative abstractions, microservices, or external libraries beyond the agreed stack.
5. **Reference-Grounded Design Selection (P29):**  
   Rely on authoritative, version-relevant documentation for external dependencies:
   - Next.js 15 App Router & Vercel serverless duration
   - Upstash QStash webhook signature verification & flow control
   - Neon PostgreSQL connection pooling (`DATABASE_URL` vs. `DATABASE_MIGRATION_URL`)
   - Bifrost Model Gateway HTTP API and fallback routing
   - Tavily Search & Extract endpoints

---

## 2. Evidence-Based Verification Hierarchy (P7, P17)

Every pull request, task completion claim, and status transition must be supported by verifiable proof corresponding to the appropriate evidence tier:

| Level | Classification | Scope & Meaning | Required Verification |
| :---: | :--- | :--- | :--- |
| **E1** | Static Analysis | Code compiles, formats, types resolve, schema validates. | `pnpm lint`, `pnpm typecheck`, Zod schema checks. |
| **E2** | Unit / Logic Test | Pure business logic, isolated deterministic routines. | `pnpm test` (vitest with pure fixtures or mock doubles). |
| **E3** | Disposable Integration | Real relational database, migrations, transactions. | Test execution against live Neon test branch / container. |
| **E4** | Staging / Sandbox | Real cloud providers, signed webhooks, gateway fallback. | Live runs on staging environment with valid test keys. |
| **E5** | Production Operations | Full end-to-end user workflows on live domains. | Real web retrieval, live judge walkthrough, latency traces. |

> [!CRITICAL]
> **A unit test passing with mock data (E2) cannot satisfy a live provider or database integration gate (E3/E4).**  
> Never declare a task `DONE` without providing concrete execution logs or command output.

---

## 3. Invariant-to-Proof Verification Chain (P10)

For stateful, transactional, or distributed tickets (e.g., job processing, claim persistence, lease locking), you must document the full verification chain:
$$\text{INVARIANT} \longrightarrow \text{PRODUCTION ENTRY POINT} \longrightarrow \text{HANDLER} \longrightarrow \text{AUTHORITY} \longrightarrow \text{ENFORCEMENT} \longrightarrow \text{TEST} \longrightarrow \text{EVIDENCE}$$

Required invariants that must be enforced:
- **Unsupported Citation:** Claims referencing text not found in retrieved excerpts must fail closed.
- **Wrong-Scope Evidence:** Passages from differing regions, years, or SDK versions cannot grant direct support.
- **Future Effective Date:** Announcements with pending effective dates must not mark current facts stale.
- **Cross-Owner Access:** Runs must be strictly partitioned by anonymous owner hash (`404 Not Found`).
- **Duplicate Delivery:** Repeated QStash webhook dispatches must never produce duplicate claim records.
- **Stale Lease Commit:** Workers losing their database lease must fail closed on completion (`409 Conflict`).

---

## 4. Task Claiming and Tracker Updates

1. Read your ticket in [docs/PHASE-TRACKER.md](docs/PHASE-TRACKER.md) before writing code.
2. Verify all listed dependencies are marked `DONE`.
3. Update ticket status to `IN PROGRESS`.
4. Implement atomic changes with test coverage.
5. Fill the ticket's `Evidence` field with real CLI command transcripts and observed results.
6. Submit a pull request using [.github/PULL_REQUEST_TEMPLATE.md](.github/PULL_REQUEST_TEMPLATE.md).
7. Once merged, update ticket status to `DONE` and notify downstream builders.

---

## 5. Authoritative References

- **Architecture:** [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- **API Contracts:** [docs/API.md](docs/API.md)
- **Data & Jobs:** [docs/DATA-AND-JOBS.md](docs/DATA-AND-JOBS.md)
- **Verification Engine:** [docs/VERIFICATION.md](docs/VERIFICATION.md)
- **Testing & Eval:** [docs/TESTING-AND-EVALUATION.md](docs/TESTING-AND-EVALUATION.md)
- **Setup & Infrastructure:** [docs/SETUP-AND-DEPLOYMENT.md](docs/SETUP-AND-DEPLOYMENT.md)
- **Master Plan:** [docs/PHASE-TRACKER.md](docs/PHASE-TRACKER.md)
