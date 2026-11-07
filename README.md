# Afterfact (working name: Stale-Answer Detector)

> **Real-time freshness verification and drift detection for AI-generated answers.**  
> *Project status: Pre-scaffold documentation & architecture planning baseline (Task DOC01).*  
> *Current code status: Scaffolding and runtime implementation tickets are queued (`TODO`). Branding is undecided.*

---

## Pitch & Purpose

Large Language Models confidently state facts that were true at training time, but are now outdated, deprecated, or superseded. When users paste an AI answer or ask a time-sensitive question, **Afterfact** dissects the text into atomic verifiable claims, queries fresh official web evidence via **Tavily**, assesses candidate passages via **Bifrost**, and applies deterministic TypeScript policies to verify whether each claim is currently supported, outdated, contradicted, or context-dependent.

Unlike black-box LLM checkers that hallucinate verdicts or cite nonexistent sources, Afterfact:
1. **Provides exact, clickable quotes** directly from governing vendor documentation, official changelogs, and regulatory registries.
2. **Distinguishes announcement dates from effective dates**, highlighting scheduled changes that have not yet taken effect.
3. **Features "Then vs. Now" change timelines**, proving prior validity and superseding events rather than guessing.
4. **Enables context comparison**, testing how claims hold across different SDK versions, regions, currencies, or billing terms without altering the original answer.
5. **Generates evidence-backed correction diffs**, pinpointing the exact surgical edit required.
6. **Maintains a strict evidence hierarchy**, scoring claims deterministically (100 = direct support, 75 = indirect support, 0 = contradiction, `null` = unresolved) with machine reason codes.

---

## System Architecture & Workflow

```
[ User Input: Paste AI Answer or Ask Question ]
                     │
                     ▼
        [ Next.js API: POST /api/verify ]
                     │ (Persist Run & Coordinator Job)
                     ▼
       [ Neon PostgreSQL Database ] ◄───► [ QStash Queue ]
                                              │ (Signed Webhook Delivery)
                                              ▼
                                 [ Next.js Job Worker ]
                                              │
                     ┌────────────────────────┴────────────────────────┐
                     ▼                                                 ▼
        [ Bifrost Model Gateway ]                           [ Tavily Search & Extract ]
    - Ask answer drafting                                - Live official documentation
    - Atomic claim extraction                            - Query-aware passage extraction
    - Passage relevance assessment                       - Versioned vendor changelogs
                     │                                                 │
                     └────────────────────────┬────────────────────────┘
                                              ▼
                           [ TypeScript Verification Engine ]
                            - Scope & qualifier matching
                            - Temporal & effective date logic
                            - Deterministic scoring & transitions
                                              ▼
                           [ Neon Persistence & Event Outbox ]
                                              │
                                              ▼
                    [ Client: Progressive SSE Stream / Polling ]
                                              ▼
                      [ Responsive 55:45 Workspace UI ]
                       - Per-claim highlight & verdict chips
                       - Then vs. Now transition timeline
                       - Side-by-side context comparison
                       - Evidence-backed correction diff
```

---

## Tech Stack

| Layer | Technology | Role |
| :--- | :--- | :--- |
| **Framework** | Next.js 15+ (App Router, Node 22, pnpm) | Full-stack application and API route handlers |
| **Language & Styling** | TypeScript, Tailwind CSS | Strict type safety and responsive UI tokens |
| **Validation** | Zod | Shared runtime schema validation (contracts, APIs, DB) |
| **Persistence** | Neon PostgreSQL + Drizzle ORM (`pg`) | Serverless relational storage for runs, claims, evidence, and jobs |
| **Job Queue** | Upstash QStash | Durable HTTP job delivery, retries, and concurrency limits |
| **Model Gateway** | Bifrost (Docker host via HTTPS) | Authenticated LLM routing, structured outputs, and provider fallback |
| **Web Retrieval** | Tavily Search & Extract API | Authoritative, query-aware search and raw passage extraction |
| **Testing & Eval** | Vitest, Playwright, TypeScript (`tsx`) | E1–E5 verification hierarchy, regression suites, and eval harness |

---

## Core Differentiators

- **No Hallucinated Citations:** Verification fails closed if the cited passage does not match the retrieved text span.
- **Scope Awareness:** Distinguishes annual vs. month-to-month pricing, EU vs. US regulations, and Stripe API versions (`Acacia` vs. `Basil`).
- **Upcoming Changes:** Explicitly flags upcoming policy or API deprecations with a `Scheduled change` badge without falsely marking current facts as stale before their effective date.
- **Durable Async Execution:** Background worker pattern ensures client disconnects or slow provider calls never lose run state.
- **Fixture Replay vs. Live Retrieval:** Development and demo fallback modes are clearly labeled to guarantee transparency during judging.

---

## Quick Start

### Current Repository State (Planning Mode)
Documentation and planning assets are fully established. No package installations, database provisioning, or external provider calls have been executed yet.

To review project documentation and track execution:
```bash
# View implementation tickets and daily merge gates
cat docs/PHASE-TRACKER.md

# Verify documentation consistency
git status
```

### Planned Setup (Starting with Task B01)
*The commands below represent the approved implementation workflow once Task B01 initiates:*

```bash
# 1. Clone and install dependencies (Node 22 required)
pnpm install

# 2. Configure local environment variables
cp .env.example .env.local
# Edit .env.local with Neon, QStash, Bifrost, and Tavily credentials

# 3. Apply database migrations
pnpm db:migrate

# 4. Run local development server
pnpm dev

# 5. Run test and evaluation suites
pnpm test
pnpm eval:baseline
pnpm eval:full
```

---

## Documentation Map

All project engineering standards, schemas, and workflows are canonically documented below:

- [AGENTS.md](AGENTS.md): Coding agent operating manual, evidence rules, and scope boundaries.
- [CONTRIBUTING.md](CONTRIBUTING.md): Hackathon lane distribution (A/B/C), branch workflow, and definition of Done.
- [docs/PRODUCT.md](docs/PRODUCT.md): Detailed user journeys, domain policies, claim examples, and release scope.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): Component interactions, network boundaries, failure isolation, and data flows.
- [docs/VERIFICATION.md](docs/VERIFICATION.md): Claim extraction, passage assessment, date resolution, and scoring rubrics.
- [docs/API.md](docs/API.md): Public and internal API route contracts, idempotency, and SSE event streaming.
- [docs/DATA-AND-JOBS.md](docs/DATA-AND-JOBS.md): Database schema, transaction fences, QStash worker lifecycle, and retries.
- [docs/SETUP-AND-DEPLOYMENT.md](docs/SETUP-AND-DEPLOYMENT.md): Infrastructure provisioning, Docker Bifrost gateway, and environment inventory.
- [docs/TESTING-AND-EVALUATION.md](docs/TESTING-AND-EVALUATION.md): E1–E5 evidence levels, benchmark design, and release gates.
- [docs/DEMO-AND-SUBMISSION.md](docs/DEMO-AND-SUBMISSION.md): 3-minute judge script, sponsor proof, and submission checklist.
- [docs/DECISIONS.md](docs/DECISIONS.md): Architectural Decision Records (ADR-001 through ADR-010).
- [docs/PHASE-TRACKER.md](docs/PHASE-TRACKER.md): **Single source of truth for all 26 task tickets (A01–A09, B01–B08, C01–C09) and gates (G0–G4).**
- [.github/PULL_REQUEST_TEMPLATE.md](.github/PULL_REQUEST_TEMPLATE.md): Standard PR submission template requiring evidence levels.
