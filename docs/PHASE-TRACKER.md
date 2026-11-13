# docs/PHASE-TRACKER.md — Master Phase Tracker & Issue Registry

This document serves as the **single source of truth** for all engineering tasks, release gates, lane ownership, and evidence logs for **Afterfact** (working name: Stale-Answer Detector).

---

## 1. Team Lanes & Ownership Protocol

Tasks are strictly assigned to one of three accountable builder lanes:
- **Lane A:** `A / Verification` — Schemas, Universal Claim Tickets, research planning, context-preserving extraction, semantic assessment, date logic, domain policies, and evaluation benchmark.
- **Lane B:** `B / Platform` — Scaffolding, Neon PostgreSQL, Prisma ORM, Bifrost model gateway (Railway hosted · Docker-free local), Tavily adapter, QStash jobs, dynamic DAG runtime, API routes, and deployment.
- **Lane C:** `C / Product` — Visual design tokens, responsive UI components, split workspace, preparation review, dynamic clarification forms, SSE client, timeline, compare drawer, and demo walkthrough.

### Task Status Vocabulary
- `TODO`: Queued, pending prerequisite completion.
- `IN PROGRESS`: Actively being implemented by assigned lane on a dedicated branch.
- `BLOCKED`: Work halted due to missing credential, external provider outage, or open design question.
- `REVIEW`: Code complete, PR opened with passing automated checks, awaiting peer approval.
- `DONE`: Merged into `main` with verified E1–E5 evidence recorded in the log.

---

## 2. Phase Schedule & Parallel Lane Grid

> [!TIP]
> For complete dependency graph topologies, start vs. integration prerequisites, parallel work waves, and cross-lane handoff contracts, see **[docs/PARALLEL-WORK-PLAN.md](PARALLEL-WORK-PLAN.md)**.

| Phase / Target (IST) | Lane A (Verification) | Lane B (Platform) | Lane C (Product) | Release Gates |
| :--- | :--- | :--- | :--- | :--- |
| **Bootstrap** (Nov 7) | — | — | — | **DOC01** (Docs Baseline) |
| **Phase 0** (Nov 7–8) | [A01](#a01-request-and-claim-schemas)<br>[A02](#a02-report-and-event-schemas)<br>[A10](#a10-define-preparation-clarification-and-dynamic-dag-schemas) | [B01](#b01-scaffold-and-pin-the-toolchain)<br>[B02](#b02-provision-bifrost-and-model-profiles)<br>[B04a](#b04-migrate-the-data-model-and-wire-the-vertical-slice) | [C01](#c01-visual-tokens-and-component-states)<br>[C02](#c02-input-and-report-skeleton) | **G0** (Foundation Gate) |
| **Phase 1** (Nov 8–9) | [A03](#a03-extract-and-locate-atomic-claims)<br>[A04](#a04-assess-passages-against-a-claim)<br>[A05](#a05-apply-deterministic-policy-and-score) | [B03](#b03-search-extract-and-evidence-capture)<br>[B04b](#b04-migrate-the-data-model-and-wire-the-vertical-slice) | [C03](#c03-wire-real-runs-and-progress) | **G1** (Live Slice Gate) |
| **Phase 2** (Nov 9–11) | [A06](#a06-build-pricing-api-regulation-and-leadership-policies)<br>[A11](#a11-explore-optional-vector-shortlisting-and-counter-hypothesis-experiments) | [B05](#b05-implement-signed-delivery-leases-and-recovery) | [C04](#c04-implement-evidence-inspection-screen) | **G2** (Broad Coverage & Durability Gate) |
| **Phase 3** (Nov 11–12) | [A07](#a07-derive-transitions-and-validate-corrections)<br>[A08](#a08-freeze-the-test-set-before-tuning) | [B06](#b06-implement-the-public-run-endpoints)<br>[B07](#b07-provision-staging-with-real-integrations) | [C05](#c05-implement-then-vs-now-and-scheduled-changes)<br>[C06](#c06-implement-compare-correction-and-recheck)<br>[C07](#c07-finish-ask-export-and-polish) | **G3** (Product Interactions Gate) |
| **Phase 4** (Nov 13–15) | [A09](#a09-run-baseline-full-pipeline-and-regressions) | [B08](#b08-deploy-production-and-verify-fallbacks) | [C08](#c08-run-the-final-product-walkthrough)<br>[C09](#c09-package-and-submit) | **G4** (Release Candidate Gate) |

---

## 3. Project Release Gates (G0–G4) vs. UPPR Gates (IPP-1–IPP-8)

### Project Release Milestones
- **Gate G0 (Foundation Checkpoint · Nov 8–12 · PASSED):**
  - Contract schemas validate cleanly across request, claim, evidence, preparation, clarification, and DAG contracts (`A01`, `A02`, `A10`).
  - Next.js application builds cleanly (`pnpm build`, `B01`).
  - Bifrost model gateway smoke test succeeds via local Docker-free script (`pnpm bifrost`) or Railway deployment (`B02`).
  - Prisma relational baseline schema and migrations execute cleanly against Neon PostgreSQL (`B04a`, internal milestone of `B04`).
  - Lane C renders input composer, preparation review, and report skeleton in fixture replay mode (`C01`, `C02`).
  - Owning tickets: `A01` (DONE), `A02` (DONE), `A10` (DONE), `B01` (DONE), `B02` (DONE), `B04a` (DONE), `C01` (DONE), `C02` (DONE).
  - **Verdict:** PASSED. All 8 foundational tickets completed, verified, and merged into `main`.
- **Gate G1 (Live Slice via Persisted DAG · Nov 9):**
  - Pasting text verifies 1 real claim end-to-end via real persisted DAG execution in PostgreSQL (`root_extract_prep` $\to$ `plan_research` $\to$ `search_evidence` $\to$ `extract_evidence` $\to$ `assess_evidence` $\to$ `decide_claim` $\to$ `finalize_run`), completely retiring temporary synchronous shortcuts (`B04b`).
  - Server Actions `startPreparationAction` and `confirmPreparationAction` initiate and step the run (`C03`).
  - Tavily web search captures `SourceDocument` provenance (`B03`); context-preserving extraction produces `EvidenceUnit` records (`A04`).
  - Deterministic quotation verification (`SourceDocument.text.includes(quote)`) validates empirical grounding (`A04`).
  - Deterministic synthesis judge executes sequential decision gates, producing an auditable `DecisionRecord` (`A05`).
  - UI displays live progress and renders verified claim linking to exact quoted excerpt (`C03`).
  - Optional vector shortlisting is explicitly NOT a prerequisite for Gate G1.
  - Owning tickets: `A03`, `A04`, `A05`, `B03`, `B04b`, `C03`.
- **Gate G2 (Broad Coverage, Dynamic Expansion & Durability · Nov 11):**
  - One mixed answer verifies claims across all 4 domains (Pricing, APIs, Regulations, Leadership) via dynamic DAG expansion (`A06`).
  - Ambiguous qualifiers trigger generic clarification forms; paused branch transitions to `waiting_for_input`, holding zero worker leases and executing zero jobs while waiting (`C04`, `B05`).
  - Submitting answers unblocks the branch; selecting "I don't know" proceeds with honest `depends_on_context` fallback (`C04`, `B05`).
  - Upstash QStash flow control enforces bounded concurrency (max 3 active claim branches) (`B05`).
  - Database clock lease fencing prevents double-commit; reconciliation sweeper re-enqueues stranded work (`B05`).
  - Sibling claims execute independently; partial results survive single-claim failure and page refresh (`B05`, `C04`).
  - Non-blocking experimental `A11` (vector shortlisting) develops in parallel.
  - Owning tickets: `A06`, `B05`, `C04`.
- **Gate G3 (Product Flows & Staging · Nov 12):**
  - Ask mode, Compare drawer, Then vs. Now timeline, Scheduled change badges, Recheck freshness, and Expandable DAG Inspector execute on Vercel/Neon staging over TLS (`C05`, `C06`, `C07`, `B07`).
  - Server Actions for browser mutations call shared server services directly in-process.
  - Headless programmatic REST API adapter (`POST /api/v1/verify`) executes the identical verification workflow (`B06`).
  - Signed QStash webhook delivery verified over TLS (`B07`).
  - Benchmark evaluation dataset frozen at 30 curated claims in `eval/cases.jsonl` (`A08`).
  - Owning tickets: `A07`, `A08`, `B06`, `B07`, `C05`, `C06`, `C07`.
- **Gate G4 (Release Candidate & Submission · Nov 14–15):**
  - Release candidate passes benchmark evaluation on held-out test split with false reassurance rate $< 5\%$ (`A09`).
  - Production Next.js deployment on Vercel with custom domain and HTTPS proxy for Bifrost passes security runbook (`B08`).
  - Automated model fallback profiles succeed on injected provider fault (`B08`).
  - Mobile responsive verification passes at 360px viewport with zero horizontal scroll (`C08`).
  - 3-minute video walkthrough recorded and hosted at `public/demo.mp4` (`C08`).
  - Judge link opens without authentication or login; submission receipt archived (`C09`).
  - Owning tickets: `A09`, `B08`, `C08`, `C09`.

### UPPR Integration Proof Protocol (IPP) Standards
IPP gates govern code correctness across stateful, distributed, and external integration points:
- **IPP-1 (Entry-Point Mapping):** Production routes directly map to handler logic.
- **IPP-2 (Integration Invocation Proof):** Production tests verify helper execution.
- **IPP-3 (Transaction Boundary Proof):** Durable intent commits atomically; rollback leaves zero leaked records.
- **IPP-4 (Failure & Interleaving Proof):** Concurrency tests cover lease expiration, duplicate webhooks, and worker races.
- **IPP-5 (End-to-End Workflow Proof):** Mutation $\to$ queue $\to$ worker $\to$ persistence tested end-to-end.
- **IPP-6 (Contract Conformance Proof):** Exact character limits, schemas, and error codes match specification.
- **IPP-7 (Independent Acceptance Review):** Adversarial verification against declared invariants.
- **IPP-8 (Evidence-Based Release Decision):** Formal PASS/FAIL/BLOCKED verdict rendered with evidence log.

---

## 4. Old-to-New Scope Mapping

The following mapping documents the evolution from the initial planning baseline to the authoritative architecture:

| Existing Ticket | Preserved Work | Revised / Follow-Up Scope | Architectural Reason |
| :--- | :--- | :--- | :--- |
| **A01** | `request.ts`, `claim.ts`, `dates.ts` validated natively (25 vitest tests passing). | Status preserved as `REVIEW`. Extended claim representation handled in follow-up **A10** and **A03**. | Preserves verified repository baseline; avoids modifying completed code in branch review. |
| **A02** | `evidence.ts`, `report.ts`, `events.ts`, `golden-mixed-report.json` validated natively (30 tests passing). | Status preserved as `REVIEW`. Extended decoupled evidence contracts (`SourceDocument`, `EvidenceUnit`, `ClaimEvidenceAssessment`) and `DecisionRecord` authored in follow-up **A10**. | Keeps baseline report schema valid for fixture mode while introducing decoupled abstractions for multi-round DAG verifier. |
| **A10** *(New)* | None (new ticket). | Contract definitions for `ClaimTicket`, `VerificationProperty`, `SourceDocument`, `EvidenceUnit`, `ClaimEvidenceAssessment`, `ResearchPlan`, `DecisionRecord`, `PreparationRecord`, `ClarificationQuestion`, `DagNodeSpec`, `DagEdgeSpec`, and Server Actions. | Status: `DONE` (PR #8 & #9 merged into `main`). Unified contract foundation for full dynamic DAG, interactive preparation, and decoupled evidence architecture. |
| **B01** | Next.js 15 App Router, pnpm 11, Node 22, ESLint, Tailwind, Vitest, Playwright, CI scaffolded and verified. | Status preserved as `REVIEW`. | Foundation toolchain successfully pinned and tested across 55 unit tests and Playwright smoke test. |
| **B02** | Bifrost gateway setup (Railway container & local Docker-free `pnpm bifrost` script), model profile configs (`BIFROST_*`). | Focuses on Bifrost client fetch wrapper, fallback profiles, persistent volume configuration on Railway, and local Docker-free execution. | Independent workstream; adapter outputs remain compatible with new contract schemas. |
| **C01** | Visual design tokens in `globals.css` (Ink, Paper, Panel, Line, Accent). | Remains focused on tokens, card states, typography, and reduced-motion accessibility. | Visual foundation is independent of backend DAG changes. |
| **C02** | Input composer skeleton with character counter and mode tabs. | Adds `PreparationReview` component displaying extracted claims, UTF-16 highlight spans, explicit qualifiers vs inferred suggestions, and editable target context fields. | Interactive preparation requires human review before verification confirms and materializes the DAG. |
| **A03** | Text extraction logic and UTF-16 substring matching. | Parses text into `ClaimTicket[]` carrying strongly typed `VerificationProperty[]` context properties; enforces scope precedence invariant. | Claims must carry variable typed factual qualifiers rather than rigid dictionary fields or unvalidated JSON. |
| **A04** | Passage relevance prompt and quote validation. | Implements `ResearchPlan` query generation (current-state, exceptions, counterevidence, historical), context-preserving extraction (`EvidenceUnit[]`), candidate shortlisting, and semantic assessment (`ClaimEvidenceAssessment[]`). | Decouples document retrieval from localized passage extraction and semantic assessment. |
| **A05** | Precedence decision tree and scoring rubric. | Deterministic synthesis judge executing sequential decision gates; validates the full claim/evidence aggregate; emits immutable `DecisionRecord`; enforces categorical 100/75/0/null rubric. | Epistemic truth scoring is governed by deterministic TypeScript decision gates, not LLM confidence guesswork or floating-point similarity. |
| **A11** *(New)* | None (new ticket). | Optional vector similarity ranking over cached embeddings in PostgreSQL (active only when candidates $> 4$) and experimental counter-hypothesis testing. | Explicitly isolated as an optional, non-blocking ablation; strictly prohibited from contributing to public freshness scores. |
| **B03** | Tavily REST client and query execution. | Executes queries formulated by `ResearchPlan`; captures `SourceDocument` provenance (URL, final redirected URL, title, publisher, crawl hash, pub/effective dates, source role). | Captures full document provenance and redirect history required for evidence decoupling. |
| **B04** | Relational schema and initial execution slice. | Explicitly partitioned into internal milestones: **B04a** (Neon DDL baseline: `runs`, `preparations`, `claims`, `source_documents`, `evidence_units`, `claim_evidence_assessments`, `decision_records`, `events`, `dag_nodes`, `dag_edges`, `clarifications`) and **B04b** (wire minimal persisted DAG execution slice, retiring temporary synchronous orchestration). | Resolves the database migration vs live integration split without creating phase cycles or false synchronous paths. |
| **C03** | Progress hooks and status display. | Implements Server Actions (`startPreparationAction`, `confirmPreparationAction`), `useRun` hook managing preparation review, SSE progress stream with sequence replay (`?afterSeq=N`), and snapshot polling fallback. | Connects browser mutations directly to shared server services via type-safe Server Actions. |
| **A06** | 4 domain policies (pricing, API, regulation, leadership). | Enforces required qualifier schemas per domain; generates structured `ClarificationQuestion[]` for material ambiguities. | Generic clarification meta-schema requires domain-specific ambiguity triggers. |
| **B05** | QStash webhook delivery and lease CAS. | Adds bounded concurrency (max 3 active claim branches), dynamic runtime graph expansion protocol with cycle detection, zero-lease clarification wait states (`waiting_for_input`), and reconciliation sweeper. | Full dynamic DAG requires atomic runtime expansion and non-blocking human-in-the-loop pauses. |
| **C04** | Evidence inspection workspace screen. | Implements 55:45 split workspace, evidence inspection with clickable locators & counterevidence tabs, and generic accessible `ClarificationForm` rendering approved primitive types with "I don't know" button. | Clarifications require pure structured forms without client-side script execution. |
| **A07** | Then vs. Now timeline and surgical diff generator. | Chronological timeline derivation ($T_{\text{pub}}, T_{\text{announce}}, T_{\text{effective}}$); surgical correction generation validated through recursive verifier pass requiring score 100. | Corrections must achieve verified primary authority support before presentation to the user. |
| **A08** | Curation of 30 test claims in `eval/cases.jsonl`. | Incorporates context pairs across 4 domains, negative failure cases, and frozen 20 dev / 10 held-out split. | Prevents prompt over-tuning by freezing held-out test cases. |
| **B06** | Snapshot endpoint, SSE streaming route, programmatic API. | Implements `GET /api/runs/[id]` returning sanitized DAG projection, `GET /api/runs/[id]/events` with `?afterSeq=N` replay, and `POST /api/v1/verify` headless REST adapter calling shared server services. | Decouples SSE stream lifetime from job execution; exposes type-safe headless verification API. |
| **B07** | Staging cloud deployment. | Deploys Next.js to Vercel staging, connects Neon staging branch, verifies QStash signed webhooks over TLS. | E4 staging integration gate required before production deployment. |
| **C05** | Chronology cards and scheduled change badges. | Displays Then vs. Now transition timeline and `Scheduled change` badge for future-effective dates without falsely marking current assertions outdated. | Enforces three-date separation on the frontend. |
| **C06** | Context comparison drawer and diff view. | Adds side-by-side comparison drawer calling `compareAction`, inline word diff with copy button, recheck freshness calling `recheckAction`, and expandable public `DagInspector`. | Allows user inspection of dynamic execution milestones without leaking private lease tokens or credentials. |
| **C07** | Ask tab and export utilities. | Implements Ask workflow sharing verification workspace, Markdown/JSON export formats, trace metadata viewer, and WCAG AA accessibility audit. | Unifies Ask mode with Paste mode; ensures export payloads scrub internal IDs. |
| **A09** | Benchmark runner and accuracy calculations. | Executes baseline vs full Afterfact engine across all 30 benchmark cases; reports paired accuracy, false reassurance rate ($< 5\%$), decisive coverage, and latency traces. | Empirical validation of epistemic verifier performance against naive LLM baseline. |
| **B08** | Production Vercel deployment. | Deploys production Next.js application, configures custom domain and HTTPS reverse proxy for Bifrost, verifies automated model fallback profiles. | E5 production release gate. |
| **C08** | Video demo and walkthrough documentation. | Records 3-minute screen demonstration of mixed live answer, Then vs. Now, context comparison, and eval modal. | Satisfies hackathon submission criteria with reproducible judge script. |
| **C09** | Packaging and submission. | Verifies public URL accessibility without authentication, packages repository assets, archives submission receipt before organizer deadline. | Final project milestone and release candidate closure. |

---

## 5. Documentation Bootstrap Ticket

### DOC01: Repository Documentation and Architectural Baseline {#doc01-repository-documentation}
- **Owner:** Repository Documentation Maintainer / Planning Lead
- **Plain-Language Outcome:** Author comprehensive 14-document architecture and planning specification baseline.
- **Planned Date:** Nov 7, 2026 IST
- **Status:** DONE
- **Phase & Gate Contribution:** Bootstrap Phase / Gate G0 prerequisite.
- **Canonical Design References:** [AGENTS.md](file:///C:/Users/Mayur/Desktop/Afterfact/AGENTS.md), [ARCHITECTURE.md](file:///C:/Users/Mayur/Desktop/Afterfact/docs/ARCHITECTURE.md).
- **Allowed Scope & Expected Files:** 14 baseline markdown files across root and `docs/`.
- **Atomic Implementation Checklist:**
  - [x] Inspect workspace root, git branch, and status.
  - [x] Ingest and analyze `pp.md` (UPPR Rev 4) and `stale-answer-detector-implementation-plan.pdf`.
  - [x] Add `pp.md` and `stale-answer-detector-implementation-plan.pdf` to `.gitignore`.
  - [x] Author comprehensive 14-document baseline documentation set.
  - [x] Cross-link documents using relative paths and verify all anchors resolve without dead links.
  - [x] Verify zero credential leakage and zero unwanted file modifications.
- **Prerequisites:**
  - **Start Prerequisites:** None.
  - **Integration / Completion Prerequisites:** None.
  - **External Prerequisites:** None.
  - **What Can Start Early:** Entire task.
- **Deliverable & Interface Handoff:** Unblocks Lane B to start Task B01 and Lane A to start Task A01.
- **Positive Acceptance Examples:** All 14 baseline documentation files exist and pass link resolution.
- **Relevant Negative / Failure Cases:** Git status shows only documentation edits and `.gitignore` updates.
- **Verification Commands & Checks:** `node scratch/verify_parallel_plan.mjs`.
- **Evidence Level & Required Proof:** E1 (Static analysis of Markdown links and file existence).
- **Observed Evidence:** 14 documentation files written, `.gitignore` updated, link validation check passed.
- **Explicit Exclusions:** Application code, schemas, and runtime configuration.
- **Blocker / Decision:** Branding is undecided; working name is Stale-Answer Detector (Afterfact).

---

## 6. Detailed Ticket Registry (A01–A11, B01–B08, C01–C09)

---

### Phase 0: Foundation (Nov 7–8, 2026 IST)

#### A01: Define request and claim schemas {#a01-request-and-claim-schemas}
- **Owner:** A / Verification
- **Plain-Language Outcome:** Define Zod contracts for paste and ask requests, calendar date resolution, atomic claim specs, and UTF-16 character span validation.
- **Planned Date:** Nov 8, 2026 IST
- **Status:** REVIEW
- **Phase & Gate Contribution:** Phase 0 foundation deliverable; contributes directly to Gate G0.
- **Canonical Design References:** [docs/ARCHITECTURE.md §3](docs/ARCHITECTURE.md), [docs/VERIFICATION.md §1](docs/VERIFICATION.md), [docs/DECISIONS.md#adr-008](docs/DECISIONS.md).
- **Allowed Scope & Expected Files:** [src/lib/contracts/dates.ts](src/lib/contracts/dates.ts), [src/lib/contracts/request.ts](src/lib/contracts/request.ts), [src/lib/contracts/claim.ts](src/lib/contracts/claim.ts), [tests/unit/contracts/request-claim.test.ts](tests/unit/contracts/request-claim.test.ts).
- **Atomic Implementation Checklist:**
  - [x] Define Zod schema for paste request (up to 8,000 characters, optional originalQuestion, context object).
  - [x] Define Zod schema for ask request (up to 800 characters, question, context object).
  - [x] Define Zod tagged union for request input (`mode: 'paste' | 'ask'`).
  - [x] Define Zod schema for atomic claim spec (entity, attribute, assertedValue, timeSensitivity, UTF-16 span offsets).
  - [x] Implement span validation helper ensuring `answer.slice(span.start, span.end) === claim.rawText`.
- **Prerequisites:**
  - **Start Prerequisites:** B01 (toolchain scaffold).
  - **Integration / Completion Prerequisites:** None.
  - **External Prerequisites:** None.
  - **What Can Start Early:** Entire task (completed in branch review).
- **Deliverable & Interface Handoff:** Handed downstream to A02 (report/event schemas), A10 (contract extensions), and C01/C02 (UI component types).
- **Positive Acceptance Examples:** Valid paste input with 3 claims validates cleanly; UTF-16 spans match unmodified string slice.
- **Relevant Negative / Failure Cases:** Whitespace-only input fails validation (`400 Bad Request`); negative offsets or out-of-bounds spans fail validation.
- **Verification Commands & Checks:** `pnpm vitest run tests/unit/contracts/request-claim.test.ts`.
- **Evidence Level & Required Proof:** E2 (Vitest unit suite with frozen assertions).
- **Observed Evidence:** Verified natively via repository Vitest suite (`pnpm test`, 25 tests passing in `tests/unit/contracts/request-claim.test.ts`: strict wrong-mode rejection, 8000/800 character limits, complete calendar dates, non-trimmed raw text, UTF-16 emoji offset, fractional/empty/inverted/negative bounds checks, diagnostic text privacy). B01 toolchain prerequisite resolved.
- **Explicit Exclusions:** Web retrieval logic, database persistence, and LLM prompting.
- **Blocker / Decision:** None.

#### A02: Define report and event schemas and create shared fixture {#a02-report-and-event-schemas}
- **Owner:** A / Verification
- **Plain-Language Outcome:** Define Zod schemas for verifier reports, timeline entries, categorical score heuristics, ordered progress events, and author a comprehensive golden fixture.
- **Planned Date:** Nov 8, 2026 IST
- **Status:** REVIEW
- **Phase & Gate Contribution:** Phase 0 foundation deliverable; contributes directly to Gate G0.
- **Canonical Design References:** [docs/API.md §3](docs/API.md), [docs/VERIFICATION.md §7](docs/VERIFICATION.md), [docs/DECISIONS.md#adr-005](docs/DECISIONS.md).
- **Allowed Scope & Expected Files:** [src/lib/contracts/evidence.ts](src/lib/contracts/evidence.ts), [src/lib/contracts/report.ts](src/lib/contracts/report.ts), [src/lib/contracts/events.ts](src/lib/contracts/events.ts), [fixtures/golden-mixed-report.json](fixtures/golden-mixed-report.json), [tests/unit/contracts/report-fixture.test.ts](tests/unit/contracts/report-fixture.test.ts).
- **Atomic Implementation Checklist:**
  - [x] Define Zod schema for evidence metadata (url, title, publisher, passage, retrievedAt, publicationDate, effectiveDate).
  - [x] Define Zod schema for claim result (verdict enum, score heuristic, scoreReason, reasonCode, timeline, correction).
  - [x] Define discriminated union for SSE progress events (`run_started`, `claims_identified`, `claim_result`, `claim_failed`, `run_finished`).
  - [x] Construct `fixtures/golden-mixed-report.json` covering pricing, API, regulation, and leadership, including at least 1 future-effective event and 1 unknown/unresolved claim.
- **Prerequisites:**
  - **Start Prerequisites:** A01.
  - **Integration / Completion Prerequisites:** None.
  - **External Prerequisites:** None.
  - **What Can Start Early:** Entire task (completed in branch review).
- **Deliverable & Interface Handoff:** Handed downstream to C01/C02 (design tokens & report skeleton), B03/B04 (Tavily adapter & DB migrations), and A10.
- **Positive Acceptance Examples:** Golden fixture passes validation against Zod report schema without errors; supported claims with scores 100/75 validate.
- **Relevant Negative / Failure Cases:** Numeric scores on unresolved claims are rejected; continuous float scores (e.g. 84.2%) fail schema validation.
- **Verification Commands & Checks:** `pnpm vitest run tests/unit/contracts/report-fixture.test.ts`.
- **Evidence Level & Required Proof:** E2 (Vitest unit suite validating report and event schemas).
- **Observed Evidence:** Verified natively via repository Vitest suite (`pnpm test`, 30 tests passing in `tests/unit/contracts/report-fixture.test.ts`: full golden fixture validation; supported 100/75 accepted, supported 42 rejected at both report and event boundaries; outdated 0 accepted, outdated null rejected at both boundaries; unresolved null with machine reason accepted, numeric scores rejected; INV-01 claimId uniqueness; INV-02 Ask answerText and highlight span bounds; INV-03 timezone offsets; INV-04 summary counter parity). B01 toolchain prerequisite resolved.
- **Explicit Exclusions:** Dynamic DAG execution nodes and live database tables.
- **Blocker / Decision:** None.

#### A10: Define preparation, clarification, Universal Claim Ticket & evidence contracts {#a10-define-preparation-clarification-and-dynamic-dag-schemas}
- **Owner:** A / Verification
- **Plain-Language Outcome:** Author Zod schemas for Universal Claim Tickets with typed context properties, decoupled evidence abstractions (SourceDocument, EvidenceUnit, ClaimEvidenceAssessment), ResearchPlan, DecisionRecord, preparation reviews, clarification forms, and dynamic DAG execution structures.
- **Planned Date:** Nov 8, 2026 IST
- **Status:** DONE
- **Phase & Gate Contribution:** Phase 0 foundation deliverable; mandatory prerequisite for Gate G0, B04a, and C02. Merged into `main` via PR #8 (commit `45c0ea2`) and PR #9 (commit `04a8081`).
- **Canonical Design References:** [docs/VERIFICATION.md §1, §3, §4, §10](docs/VERIFICATION.md), [docs/DATA-AND-JOBS.md §1](docs/DATA-AND-JOBS.md), [docs/DECISIONS.md#adr-018](docs/DECISIONS.md), [docs/DECISIONS.md#adr-019](docs/DECISIONS.md), [docs/DECISIONS.md#adr-021](docs/DECISIONS.md).
- **Allowed Scope & Expected Files:** [src/lib/contracts/claim-ticket.ts](src/lib/contracts/claim-ticket.ts), [src/lib/contracts/evidence-objects.ts](src/lib/contracts/evidence-objects.ts), [src/lib/contracts/preparation.ts](src/lib/contracts/preparation.ts), [src/lib/contracts/clarification.ts](src/lib/contracts/clarification.ts), [src/lib/contracts/research.ts](src/lib/contracts/research.ts), [src/lib/contracts/decision.ts](src/lib/contracts/decision.ts), [src/lib/contracts/dag.ts](src/lib/contracts/dag.ts), [src/lib/contracts/actions.ts](src/lib/contracts/actions.ts), [src/lib/contracts/index.ts](src/lib/contracts/index.ts), [tests/unit/contracts/dag-prep-contracts.test.ts](tests/unit/contracts/dag-prep-contracts.test.ts).
- **Atomic Implementation Checklist:**
  - [x] Author Zod schemas for `ClaimTicket` and `VerificationProperty` supporting discriminated primitive property types (`string`, `number`, `boolean`, `date`, `selection`, `string_list`), origin tracking (`explicit_claim_text`, `user_target_context`, `model_inferred`, `unknown`), and scope precedence.
  - [x] Author Zod schemas for the three decoupled evidence entities: `SourceDocument` (provenance, final redirected URL, crawl hash, pub/effective dates, source role), `EvidenceUnit` (verbatim passage, locators, header hierarchy, table context, footnotes), and `ClaimEvidenceAssessment` (relational semantics, quotation verification, property matching).
  - [x] Author Zod schemas for `ResearchPlan` (planned queries, explicit purposes, target source roles, counterevidence requirement, stopping conditions) and `DecisionRecord` (categorical score rubric 100/75/0/null, reason code, primary/counter/excluded evidence IDs, temporal basis, trace IDs).
  - [x] Author Zod schema for `PreparationRecord`: input hash binding, explicit qualifiers with text spans, inferred suggestions, and preparation status (`drafting`, `ready`, `superseded`).
  - [x] Author Zod schema for `ClarificationQuestion` and `ClarificationAnswers` supporting approved primitive field types (`select`, `short text`, `date`, `number`, `boolean`) and `allowUnknown: true`.
  - [x] Author Zod schemas for `DagNodeSpec`, `DagEdgeSpec`, and DAG node state transitions (`pending`, `leased`, `waiting_for_input`, `completed`, `failed`, `skipped`).
  - [x] Author typed input and return payloads for Next.js Server Actions (`startPreparationAction`, `confirmPreparationAction`, `submitClarificationAction`, `compareAction`, `recheckAction`).
  - [x] Author unit test suite verifying valid contract fixtures and rejecting illegal mutations (unapproved field types, executable scripts, negative offsets, ungrounded quotes).
- **Prerequisites:**
  - **Start Prerequisites:** A01, A02, B01.
  - **Integration / Completion Prerequisites:** None.
  - **External Prerequisites:** None.
  - **What Can Start Early:** Full schema authoring and unit test fixtures.
- **Deliverable & Interface Handoff:** Handed downstream to B04a (database baseline DDL), C02 (preparation review UI), A03 (extraction logic), and B04b/B05 (dynamic DAG execution & budget exhaustion protocol: check proposed expansion against authoritative persisted graph and effective budget before accepting; reserve capacity for required decision/finalizer nodes; budget rejection fails closed to terminal outcome without stranding run; record BUDGET_EXHAUSTED as limitation when evidence is insufficient).
- **Positive Acceptance Examples:** Valid `ClaimTicket` with typed context properties validates cleanly; `DecisionRecord` validates categorical score and trace IDs; clarification questions with approved primitive field types pass schema checks; effective budget resolver enforces tighter constraint across all combinations (BUD-01–BUD-04).
- **Relevant Negative / Failure Cases:** Questions proposing unapproved field types fail validation; invalid numeric options (NaN, Infinity, negative, zero limit, fractional) fail explicitly; graphs exceeding effective budget fail validation.
- **Verification Commands & Checks:** `pnpm vitest run tests/unit/contracts/dag-prep-contracts.test.ts && pnpm typecheck && pnpm lint && pnpm build`.
- **Evidence Level & Required Proof:** E1 (Static typecheck & lint) + E2 (Vitest unit suite).
- **Observed Evidence:** Executed all verification checks cleanly. `pnpm vitest run tests/unit/contracts/dag-prep-contracts.test.ts` passed 66/66 tests in 66ms; full test suite `pnpm test` passed 121/121 tests across 3 files; `pnpm typecheck` passed with 0 errors; `pnpm lint` passed with 0 errors and 0 warnings; `pnpm build` completed successfully with 4/4 static pages generated. Merged to `origin/main` via PR #8 (`45c0ea2`) and PR #9 (`04a8081`).
- **Explicit Exclusions:** Database migrations, active worker leases, and API route implementations.
- **Blocker / Decision:** None. Fixed policy: 52-node run ceiling is an intentional execution/cost budget, not a claim that every branch can exhaust every optional allowance simultaneously. Runtime exhaustion handling owned by B04b/B05.

#### B01: Scaffold and pin the toolchain {#b01-scaffold-and-pin-the-toolchain}
- **Owner:** B / Platform
- **Plain-Language Outcome:** Initialize the Next.js 15 App Router codebase with strict TypeScript, Tailwind CSS, pnpm package management, Vitest, Playwright, and GitHub Actions CI.
- **Planned Date:** Nov 8, 2026 IST
- **Status:** DONE
- **Phase & Gate Contribution:** Phase 0 platform baseline; core prerequisite for Gate G0.
- **Canonical Design References:** [AGENTS.md §1](AGENTS.md), [docs/ARCHITECTURE.md §2](docs/ARCHITECTURE.md), [docs/DECISIONS.md#adr-001](docs/DECISIONS.md).
- **Allowed Scope & Expected Files:** [package.json](package.json), [pnpm-lock.yaml](pnpm-lock.yaml), [pnpm-workspace.yaml](pnpm-workspace.yaml), [.nvmrc](.nvmrc), [tsconfig.json](tsconfig.json), [next.config.ts](next.config.ts), [postcss.config.mjs](postcss.config.mjs), [tailwind.config.ts](tailwind.config.ts), [eslint.config.mjs](eslint.config.mjs), [vitest.config.ts](vitest.config.ts), [playwright.config.ts](playwright.config.ts), [.github/workflows/ci.yml](.github/workflows/ci.yml), [.env.example](.env.example), [src/app/layout.tsx](src/app/layout.tsx), [src/app/page.tsx](src/app/page.tsx), [src/app/globals.css](src/app/globals.css), [tests/e2e/smoke.spec.ts](tests/e2e/smoke.spec.ts).
- **Atomic Implementation Checklist:**
  - [x] Initialize Next.js 15 App Router with TypeScript strict mode, Tailwind CSS, ESLint, `src/` directory, and `@/*` alias.
  - [x] Pin Node 22 in `.nvmrc` and pnpm in `packageManager` field of `package.json`.
  - [x] Install runtime dependencies: `zod`, `drizzle-orm`, `pg`, `@upstash/qstash`.
  - [x] Install dev dependencies: `drizzle-kit`, `@types/pg`, `vitest`, `@playwright/test`, `tsx`.
  - [x] Configure GitHub Actions CI workflow for lint, typecheck, unit test, and build with frozen lockfile.
  - [x] Follow-up migration: Swap Drizzle packages (`drizzle-orm`, `drizzle-kit`) for Prisma packages (`@prisma/client`, `prisma`), verify `dotenv-cli` and `pnpm bifrost` script without modifying accepted foundation.
- **Prerequisites:**
  - **Start Prerequisites:** DOC01.
  - **Integration / Completion Prerequisites:** None.
  - **External Prerequisites:** None.
  - **What Can Start Early:** Entire task (completed in branch review).
- **Deliverable & Interface Handoff:** Unblocks A01, A10, B02, and C01.
- **Positive Acceptance Examples:** Clean clone executes `pnpm install`, `pnpm typecheck`, `pnpm test`, and `pnpm build` without errors.
- **Relevant Negative / Failure Cases:** CI fails if package.json dependencies are added without updating lockfile.
- **Verification Commands & Checks:** `pnpm install --frozen-lockfile && pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm test:e2e`.
- **Evidence Level & Required Proof:** E1 (Static analysis & build), E2 (Vitest unit tests), E5 (Playwright Chromium browser smoke test).
- **Observed Evidence:** Next.js 15.5.29 App Router scaffolded on Node 22.18.0 / pnpm 11.9.0 with TypeScript strict mode, Tailwind CSS v3, and ESLint flat config. Drizzle replaced cleanly with Prisma v6.19.3. All scripts verified locally on Windows PowerShell: `pnpm lint` (0 errors, 0 warnings), `pnpm typecheck` (0 errors), `pnpm test` (147/147 tests passing across 7 suites), and `pnpm build` (compiled in 4.1s, 5/5 static pages generated). Merged into `main` (DONE).
- **Explicit Exclusions:** Domain verification policies and production database provisioning.
- **Blocker / Decision:** None.

#### B02: Configure Bifrost and smoke-test model profiles {#b02-provision-bifrost-and-model-profiles}
- **Owner:** B / Platform
- **Plain-Language Outcome:** Deploy Bifrost model gateway on Railway using the official prebuilt container image (`maximhq/bifrost`) with persistent volume `/app/data`, verify local Docker-free `pnpm bifrost` script, configure model profiles, implement client wrapper, and verify inference failover.
- **Planned Date:** Nov 8, 2026 IST
- **Status:** DONE
- **Phase & Gate Contribution:** Phase 0 platform deliverable; mandatory prerequisite for Gate G0 and A03.
- **Canonical Design References:** [docs/ARCHITECTURE.md §2](docs/ARCHITECTURE.md), [docs/SETUP-AND-DEPLOYMENT.md §4](docs/SETUP-AND-DEPLOYMENT.md), [docs/DECISIONS.md#adr-023](docs/DECISIONS.md).
- **Allowed Scope & Expected Files:** `src/server/bifrost/client.ts`, `src/server/bifrost/profiles.ts`, `infra/smoke-bifrost.ts`.
- **Atomic Implementation Checklist:**
  - [x] Deploy official container `maximhq/bifrost` on Railway with persistent volume mounted at `/app/data` and port 8080 HTTPS ingress.
  - [x] Verify local Bifrost startup via `pnpm bifrost` without requiring local Docker.
  - [x] Configure model profiles: `BIFROST_EXTRACT_MODEL`, `BIFROST_ASSESS_MODEL`, `BIFROST_DRAFT_MODEL`, and `BIFROST_ASSESS_FALLBACK`.
  - [x] Generate application virtual key `BIFROST_GATEWAY_TOKEN` and initialize admin credentials with `BIFROST_SETUP_TOKEN`.
  - [x] Implement server client in `src/server/bifrost/client.ts` using `fetch` with AbortSignal, auth headers, and typed error handling.
  - [x] Execute smoke test verifying inference call on each profile.
- **Prerequisites:**
  - **Start Prerequisites:** B01.
  - **Integration / Completion Prerequisites:** None.
  - **External Prerequisites:** Railway project with persistent volume `/app/data` or local Node runtime; LLM provider API keys (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GROQ_API_KEY`).
  - **What Can Start Early:** Client fetch wrapper, typed error handling, and mock provider doubles.
- **Deliverable & Interface Handoff:** Handed downstream to A03 (claim extraction) and B04b (DAG slice).
- **Positive Acceptance Examples:** One test request per profile returns valid response with `x-request-id` and served model metadata over HTTPS; local `pnpm bifrost` starts on `127.0.0.1:8080` without Docker.
- **Relevant Negative / Failure Cases:** Primary provider failure or 500 error transparently fails over to configured fallback profile.
- **Verification Commands & Checks:** `pnpm tsx infra/smoke-bifrost.ts`.
- **Evidence Level & Required Proof:** E4 (Staging integration script against live Railway Bifrost gateway) / E2 (Local mock double).
- **Observed Evidence:** Implemented `src/server/bifrost/client.ts` with `bifrostChat`, `BifrostError`, timeout AbortController, and automated fallback failover. Implemented `src/server/bifrost/profiles.ts` resolving `extract`, `assess`, `draft`, and `fallback` model roles with safe defaults. Authored `infra/smoke-bifrost.ts` verifying gateway connectivity and profile resolution. Merged to `main` via PR #17 (`4cd5e5a`) (DONE).
- **Explicit Exclusions:** Browser client bundles (API keys strictly isolated on server).
- **Blocker / Decision:** B confirms Railway deployment URL or local Bifrost startup and provider API keys.

#### B04: Migrate data model and wire minimal persisted DAG execution slice {#b04-migrate-the-data-model-and-wire-the-vertical-slice}
- **Owner:** B / Platform
- **Plain-Language Outcome:** Define Prisma relational models in PostgreSQL, run migrations, and wire the minimal persisted DAG execution slice connecting preparation, retrieval, assessment, and terminal decision records.
- **Planned Date:** Nov 8–9, 2026 IST
- **Status:** IN PROGRESS (Milestone B04a DONE, Milestone B04b TODO)
- **Phase & Gate Contribution:** Internal Milestone B04a satisfies Gate G0 (Foundation). Internal Milestone B04b satisfies Gate G1 (Live Slice).
- **Canonical Design References:** [docs/DATA-AND-JOBS.md §1, §2](docs/DATA-AND-JOBS.md), [docs/ARCHITECTURE.md §4](docs/ARCHITECTURE.md), [docs/DECISIONS.md#adr-013](docs/DECISIONS.md), [docs/DECISIONS.md#adr-022](docs/DECISIONS.md).
- **Allowed Scope & Expected Files:** `prisma/schema.prisma`, `src/server/db/client.ts`, `src/server/services/prep-service.ts` (proposed), `src/server/services/dag-service.ts` (proposed), `src/server/services/claim.service.ts`, `src/server/services/dag.service.ts`, `src/server/services/run.service.ts`, `tests/integration/dag-slice.test.ts` (proposed).
- **Atomic Implementation Checklist:**
  - [x] **Internal Milestone B04a (Database Baseline & DDL Migrations · Phase 0 / Gate G0):**
    - [x] Define Prisma relational models: `VerificationRun`, `Preparation`, `Claim`, `SourceDocument`, `EvidenceUnit`, `ClaimEvidenceAssessment`, `DecisionRecord`, `RunEvent`, `DagNode`, `DagEdge`, `Clarification`.
    - [x] Configure Prisma with pooled `DATABASE_URL` (PgBouncer) for runtime queries and direct `DIRECT_URL` for DDL migrations.
    - [x] Run baseline migration (`pnpm prisma migrate dev --name init`) creating all tables, indexes, unique constraints, and foreign keys against Neon dev branch (`Apex1`).
    - [x] Implement Prisma client singleton in `src/server/db/client.ts` with Next.js hot module reloading guard.
  - [ ] **Internal Milestone B04b (Wire Minimal Persisted DAG Slice · Phase 1 / Gate G1):**
    - [ ] Implement `PreparationService` (input hash binding and claim ticket/qualifier persistence).
    - [ ] Implement local `DagExecutionService` executing a single-claim paste through real persisted DAG nodes (`root_extract_prep` $\to$ `plan_research` $\to$ `search_evidence` $\to$ `extract_evidence` $\to$ `assess_evidence` $\to$ `decide_claim` $\to$ `finalize_run`).
    - [ ] Enforce atomic node completion transaction and lease-fenced status updates using Prisma interactive transactions, completely retiring temporary synchronous orchestration.
- **Prerequisites:**
  - **Start Prerequisites (for B04a):** B01, A01, A02, A10.
  - **Integration / Completion Prerequisites (for B04b):** B02, B03, A03, A04, A05.
  - **External Prerequisites:** Neon PostgreSQL account (`DATABASE_URL`, `DIRECT_URL`).
  - **What Can Start Early:** Prisma schema definitions and local unit tests with mocked client.
- **Deliverable & Interface Handoff:** B04a unblocks C02 and satisfies Gate G0. B04b unblocks C03 and completes Gate G1.
- **Positive Acceptance Examples:** From fresh database, migrations run cleanly via `pnpm prisma migrate dev`; submitting a live claim persists real DAG nodes and returns terminal report with an auditable decision record.
- **Relevant Negative / Failure Cases:** Premature finalization attempt while nodes are pending rolls back; stale lease update matches 0 rows and aborts (`409 Conflict`).
- **Verification Commands & Checks:** `pnpm prisma migrate dev && pnpm vitest run tests/integration/dag-slice.test.ts`.
- **Evidence Level & Required Proof:** E3 (Integration test against live Neon PostgreSQL database).
- **Observed Evidence:** Milestone B04a completed. Prisma schema authored at `prisma/schema.prisma` with 11 relational models. Baseline migration `20261112004717_apex_hardik` executed against Neon dev branch `Apex1`. Prisma client singleton implemented at `src/server/db/client.ts`. Services authored at `src/server/services/claim.service.ts`, `src/server/services/dag.service.ts`, `src/server/services/run.service.ts`. Merged to `main` via PR #18 (`4c74622`). Milestone B04b is currently pending.
- **Explicit Exclusions:** External QStash message broker dispatch (handled in B05).
- **Blocker / Decision:** B confirms Neon project credentials.

#### C01: Set visual tokens and component states {#c01-visual-tokens-and-component-states}
- **Owner:** C / Product
- **Plain-Language Outcome:** Configure Tailwind CSS semantic color tokens, paired dark/light themes with dark-first default, accessible ThemeToggle with localStorage persistence, reusable foundational UI primitives, and an interactive `/design` reference route.
- **Planned Date:** Nov 8, 2026 IST
- **Status:** DONE
- **Phase & Gate Contribution:** Phase 0 UI foundation; contributes directly to Gate G0.
- **Canonical Design References:** [docs/PRODUCT.md §1, §6](docs/PRODUCT.md), [CONTRIBUTING.md §2](CONTRIBUTING.md).
- **Allowed Scope & Expected Files:** [src/app/globals.css](src/app/globals.css), [tailwind.config.ts](tailwind.config.ts), [src/components/theme/ThemeProvider.tsx](src/components/theme/ThemeProvider.tsx), [src/components/theme/ThemeToggle.tsx](src/components/theme/ThemeToggle.tsx), [src/components/ui/Button.tsx](src/components/ui/Button.tsx), [src/components/ui/Input.tsx](src/components/ui/Input.tsx), [src/components/ui/Textarea.tsx](src/components/ui/Textarea.tsx), [src/components/ui/Select.tsx](src/components/ui/Select.tsx), [src/components/ui/Checkbox.tsx](src/components/ui/Checkbox.tsx), [src/components/ui/Switch.tsx](src/components/ui/Switch.tsx), [src/components/ui/Card.tsx](src/components/ui/Card.tsx), [src/components/ui/Divider.tsx](src/components/ui/Divider.tsx), [src/components/ui/StatusBadge.tsx](src/components/ui/StatusBadge.tsx), [src/components/ui/Feedback.tsx](src/components/ui/Feedback.tsx), [src/components/ui/index.ts](src/components/ui/index.ts), [src/app/design/page.tsx](src/app/design/page.tsx), [src/app/layout.tsx](src/app/layout.tsx), [tests/unit/theme.test.ts](tests/unit/theme.test.ts), [tests/e2e/design-reference.spec.ts](tests/e2e/design-reference.spec.ts).
- **Atomic Implementation Checklist:**
  - [x] Configure Tailwind paired semantic color tokens: background (`#111214` / `#F7F5F0`), surface (`#18191C` / `#FFFFFF`), raised surface (`#202125` / `#EDE8DF`), text primary (`#E7E5E2` / `#1A1B1E`), text secondary (`#AAA8A5` / `#5A5854`), text muted (`#85858D` / `#787570`), border subtle (`#2B2D32` / `#E8E3DA`), border strong (`#3A3C44` / `#DCD6CB`), primary CTA button (`#DEDBD6` with `#191A1D` text / `#1A1B1E`), accent (`#B5AEBD` / `#5C4E68`), and 6 distinct status tokens.
  - [x] Set deliberate typography stacks: Single refined sans-serif family (Geist) throughout interface, responsive 40-64px heading with -0.035em tracking, 16-18px body copy (1.6 line-height), 14px controls, and 12-13px metadata (Geist Mono). No remote blocking font dependencies or baroque display serifs.
  - [x] Define spacing, 4/8/10/12/16px border radius, and accessible `:focus-visible` outlines.
  - [x] Define styling states for normal, hover, focused, disabled, loading, and reduced-motion.
  - [x] Build dark-first theme initialization script in `layout.tsx` and accessible `ThemeToggle` with `localStorage` persistence.
  - [x] Implement shared foundational UI primitives: `Button`, `Input`, `Textarea`, `Select`, `Checkbox`, `Switch`, `Card`, `Divider`, `StatusBadge`, `Feedback`.
  - [x] Build interactive `/design` route with local demo form validation, claim expansion, loading state, and retry simulation.
  - [x] Author comprehensive unit and Playwright E2E tests capturing responsive visual screenshots at desktop and mobile viewports.
- **Prerequisites:**
  - **Start Prerequisites:** B01, A02.
  - **Integration / Completion Prerequisites:** None.
  - **External Prerequisites:** None.
  - **What Can Start Early:** Entire task.
- **Deliverable & Interface Handoff:** Handed downstream to C02 (input & report skeleton) and C04 (clarification forms). Reusable components exported from `@/components/ui` and theme controls from `@/components/theme`.
- **Positive Acceptance Examples:** Verdict chips render with distinct text labels and understandable icons with WCAG AA &gt; 6.6:1 contrast in both themes; interactive form validates locally in browser state.
- **Relevant Negative / Failure Cases:** Reduced-motion media query disables animations; missing focus rings fail accessibility check; corrupted theme storage falls back safely to dark.
- **Verification Commands & Checks:** `pnpm test && pnpm typecheck && pnpm lint && pnpm build && pnpm test:e2e`.
- **Evidence Level & Required Proof:** E1 (Static analysis & linting) + E2 (Vitest unit suite & Playwright E2E with screenshots).
- **Observed Evidence:** All checks executed and passed cleanly: `pnpm test` (131/131 unit tests passing), `pnpm typecheck` (0 errors), `pnpm lint` (0 errors/warnings), `pnpm build` (5/5 static pages generated), `pnpm test:e2e` (11/11 Playwright tests passing). Responsive screenshots archived in artifact directory: `landing-desktop-dark.png`, `landing-desktop-light.png`, `landing-mobile-dark.png`, `landing-mobile-light.png`, `desktop-dark.png`, `desktop-light.png`, `mobile-dark.png`, `mobile-light.png`.
- **Explicit Exclusions:** Live web retrieval, verification Server Actions, database queries, full C02 workspace implementation.
- **Blocker / Decision:** None. Fixed user-approved design direction: "Quiet, cinematic, precise" dark-first theme with warm paper light alternative.

#### C02: Implement input, preparation review and report skeleton {#c02-input-and-report-skeleton}
- **Owner:** C / Product
- **Plain-Language Outcome:** Build the primary input composer, interactive preparation review screen displaying extracted claims and typed qualifiers, and report skeleton rendering fixture playback.
- **Planned Date:** Nov 8, 2026 IST
- **Status:** DONE
- **Phase & Gate Contribution:** Completes Phase 0 UI requirement; completes Gate G0 when paired with B01, B02, A10, and B04a.
- **Canonical Design References:** [docs/PRODUCT.md §2, §7](docs/PRODUCT.md), [docs/VERIFICATION.md §1](docs/VERIFICATION.md), [docs/DECISIONS.md#adr-014](docs/DECISIONS.md).
- **Allowed Scope & Expected Files:** [src/components/composer/InputComposer.tsx](src/components/composer/InputComposer.tsx), [src/components/composer/ContextFields.tsx](src/components/composer/ContextFields.tsx), [src/components/report/AnswerDocument.tsx](src/components/report/AnswerDocument.tsx), [src/components/report/ClaimList.tsx](src/components/report/ClaimList.tsx), [src/components/report/ClaimDetail.tsx](src/components/report/ClaimDetail.tsx), [src/components/report/EvidenceCard.tsx](src/components/report/EvidenceCard.tsx), [src/components/report/ReportSummaryBar.tsx](src/components/report/ReportSummaryBar.tsx), [src/components/report/ReportStates.tsx](src/components/report/ReportStates.tsx), [src/components/report/ReportView.tsx](src/components/report/ReportView.tsx), [src/app/report/[id]/page.tsx](src/app/report/[id]/page.tsx), [src/app/page.tsx](src/app/page.tsx), [src/lib/report/spans.ts](src/lib/report/spans.ts), [src/lib/fixtures/golden-report.ts](src/lib/fixtures/golden-report.ts), [tests/unit/composer/input-validation.test.ts](tests/unit/composer/input-validation.test.ts), [tests/unit/report/highlight-spans.test.ts](tests/unit/report/highlight-spans.test.ts), [tests/unit/report/fixture-fidelity.test.ts](tests/unit/report/fixture-fidelity.test.ts), [tests/e2e/input-composer.spec.ts](tests/e2e/input-composer.spec.ts), [tests/e2e/report-viewer.spec.ts](tests/e2e/report-viewer.spec.ts).
- **Atomic Implementation Checklist:**
  - [x] Build `InputComposer` with Paste (default) and Ask tabs, character count (8000 max for paste, 800 max for ask), sample picker, and honest validation notices.
  - [x] Implement progressive disclosure `ContextFields` component supporting `targetDate`, `jurisdiction`, `currency`, and `version` while preserving user input across accordion toggle.
  - [x] Build `AnswerDocument` rendering source text with UTF-16 highlight spans, selection synchronization, keyboard accessibility, and zero text mutation or truncation.
  - [x] Build `ReportView`, `ClaimList`, `ClaimDetail`, and `EvidenceCard` displaying summary counts, verdict filters, Then vs. Now transition timeline, verified surgical correction diffs, and evidence citations with distinct dates.
  - [x] Implement presentation view states (`ReportLoadingSkeleton`, `ReportEmptyClaimsState`, `ReportErrorState`, `ReportPartialBanner`) and showcase them in `/design`.
  - [x] Create deterministic sample replay route `/report/[id]` parsing `fixtures/golden-mixed-report.json` with schema validation and honest not-found rejection for unknown IDs.
- **Prerequisites:**
  - **Start Prerequisites:** C01, A02, A10.
  - **Integration / Completion Prerequisites:** B04a (for persistent preparation).
  - **External Prerequisites:** None.
  - **What Can Start Early:** Component layout, visual design, and fixture playback mode.
- **Deliverable & Interface Handoff:** Handed downstream to C03 (wiring real runs & progress). Report presentation takes parsed `Report` contract directly via props, ready for C03 Server Actions and SSE hooks.
- **Positive Acceptance Examples:** User enters input, clicks verify, sees honest validation feedback without fake report; sample report route `/report/demo?mode=fixture` parses golden fixture cleanly and synchronizes highlights with claim details.
- **Relevant Negative / Failure Cases:** Empty/whitespace-only input or text over 8,000 characters displays helpful field error; unknown report IDs render honest Report Not Found state; null scores are never displayed as 0.
- **Verification Commands & Checks:** `pnpm test && pnpm typecheck && pnpm lint && pnpm build && pnpm test:e2e`.
- **Evidence Level & Required Proof:** E1 (Static analysis, lint, build) + E2 (Vitest unit suite & Playwright E2E with screenshots).
- **Observed Evidence:** All checks executed and passed cleanly: `pnpm test` (147/147 unit tests passing across 7 files), `pnpm typecheck` (0 errors), `pnpm lint` (0 errors/warnings), `pnpm build` (5 static + 1 dynamic route compiled cleanly), `pnpm test:e2e` (23/23 Playwright tests passing across composer, report viewer, design reference, and smoke suites). Responsive screenshots archived: `composer-desktop-dark.png`, `composer-desktop-light.png`, `composer-mobile-dark.png`, `composer-mobile-light.png`, `report-desktop-dark.png`, `report-desktop-light.png`, `report-tablet-dark.png`, `report-mobile-dark.png`, `report-mobile-light.png`.
- **Explicit Exclusions:** Active Server Action execution (wired in C03) and live web search API execution (wired in B03).
- **Blocker / Decision:** None. Fixed visual direction from C01; honest replay behavior verified.

---

### Phase 1: Live Slice via Persisted DAG (Nov 8–9, 2026 IST)

#### A03: Extract and locate atomic claims into Universal Claim Tickets {#a03-extract-and-locate-atomic-claims}
- **Owner:** A / Verification
- **Plain-Language Outcome:** Author extraction prompts and logic to parse input text into atomic ClaimTicket records carrying variable typed VerificationProperty collections with exact UTF-16 spans.
- **Planned Date:** Nov 9, 2026 IST
- **Status:** REVIEW
- **Phase & Gate Contribution:** Core Phase 1 verifier component; mandatory prerequisite for Gate G1 and B04b.
- **Canonical Design References:** [docs/VERIFICATION.md §1](docs/VERIFICATION.md), [docs/ARCHITECTURE.md §3](docs/ARCHITECTURE.md), [docs/DECISIONS.md#adr-018](docs/DECISIONS.md).
- **Allowed Scope & Expected Files:** `src/server/verify/extract-claims.ts`, `src/server/verify/identity.ts`, `src/server/verify/span-resolver.ts`, `src/server/verify/context-resolver.ts`, `src/server/verify/index.ts`, `src/server/prompts/extract.ts`, `src/lib/contracts/extraction.ts`, `tests/unit/verify/extract-claims.test.ts`, `tests/integration/extract-claims.live.test.ts`, `tests/fixtures/demo-text.ts`, `infra/test-live-extraction.ts`.
- **Atomic Implementation Checklist:**
  - [x] Author claim extraction system prompt requesting atomic claims, entities, attributes, asserted values, and explicit scopes.
  - [x] Implement Bifrost structured extraction call parsing output into `ClaimTicket[]` with variable typed `VerificationProperty[]` context properties.
  - [x] Implement exact UTF-16 substring matching against input text, preserving character offsets and surrogate emoji safety.
  - [x] Enforce scope precedence invariant: explicit claim qualifiers permanently anchor to the claim and cannot be overwritten by user target context.
  - [x] Handle duplicate text occurrences using sentence offset, candidate span, and prefix/suffix disambiguation.
  - [x] Generate execution-aware claim identities (`clm_${execHash}_${ordinal}_${stmtHash}`) satisfying PostgreSQL `VARCHAR(36)` bounds.
  - [x] Decompose verifier into cohesive modular domain helpers connected through imports and barrel exports.
  - [x] Implement live model integration tests (E4) and standalone CLI smoke test (`pnpm test:live`, `pnpm smoke:extract`).
- **Decision-Fact Producer Follow-up (bounded; required for live A05 integration, not part of A03's original REVIEW scope):**
  - [ ] Emit an explicit `ClaimTemporalScope` (`quantifier`, `assertedTime`, `intervalSemantics`) alongside each `ClaimTicket` so A05 can distinguish current from historical assertions. A03 must not rely on A05 or Lane B to infer claim temporal meaning.
- **Prerequisites:**
  - **Start Prerequisites:** A01, A02, A10.
  - **Integration / Completion Prerequisites:** B02 (Bifrost model gateway).
  - **External Prerequisites:** Model provider credentials via Bifrost (`BIFROST_GATEWAY_TOKEN`, `BIFROST_BASE_URL`).
  - **What Can Start Early:** Sentence splitting, span math, extraction prompt authoring, unit test fixtures with frozen mock model outputs.
- **Deliverable & Interface Handoff:** Handed downstream to A04 (research planning & evidence extraction) and B04b (vertical slice). Extracted claims, proposition normalization, and span resolvers ready for immediate use.
- **Positive Acceptance Examples:** Compound statements split cleanly into distinct atomic claims; extracted properties carry explicit provenance tags (`explicit_claim_text` vs `model_inferred`).
- **Relevant Negative / Failure Cases:** Ambiguous spans that cannot be uniquely grounded fail highlight creation but keep the claim text; text with zero verifiable assertions returns empty array (`status: 'no_claims'`).
- **Verification Commands & Checks:** `pnpm vitest run tests/unit/verify/extract-claims.test.ts` (E2 unit), `pnpm test:live` (E4 live integration), `pnpm smoke:extract` (E4 CLI smoke).
- **Evidence Level & Required Proof:** E2 (Vitest unit suite with frozen model fixtures) & E4 (Live Railway Bifrost gateway integration).
- **Observed Evidence:** Implemented `src/lib/contracts/extraction.ts` (`ExtractClaimsInputSchema`, `ExtractClaimsOutcomeSchema`), `src/server/prompts/extract.ts` (`EXTRACTION_SYSTEM_PROMPT`, `SYNTHETIC_EXTRACTION_EXAMPLES`), and decomposed verifier modules in `src/server/verify/` (`extract-claims.ts`, `identity.ts`, `span-resolver.ts`, `context-resolver.ts`, `index.ts`). Executed 32 focused unit tests in `tests/unit/verify/extract-claims.test.ts` covering acceptance matrix A03-01 through A03-17: compound decomposition, span math with surrogate emojis, duplicate text disambiguation, explicit qualifier grounding, scope precedence invariant (ADR-018), missing context reconciliation, novel domains, zero-claim inputs, malformed JSON, provider failures, timeout aborts, model refusal, execution-aware ID formula within `VARCHAR(36)` bounds, and in-run determinism vs cross-run differentiation. Executed live model extraction integration tests against Railway Bifrost (`gemini-3.5-flash-lite`) via `tests/integration/extract-claims.live.test.ts` (`pnpm test:live`, 2/2 passed) and CLI runner `infra/test-live-extraction.ts` (`pnpm smoke:extract`, extracting 6 claims from multi-domain demo text with 4.5s latency). All repository checks clean: `pnpm test` (179/179 unit tests passed across 8 suites), `pnpm typecheck` (0 errors), `pnpm lint` (0 errors, 0 warnings), `pnpm build` (clean). Status updated to REVIEW.
- **Explicit Exclusions:** Web retrieval and evidence synthesis.
- **Blocker / Decision:** None. Ready for scoped review.

#### A04: Research planning, context-preserving extraction and semantic assessment {#a04-assess-passages-against-a-claim}
- **Owner:** A / Verification
- **Plain-Language Outcome:** Formulate structured ResearchPlan queries, execute context-preserving extraction of EvidenceUnits, and perform semantic assessment producing ClaimEvidenceAssessments with deterministic quotation verification.
- **Planned Date:** Nov 9, 2026 IST
- **Status:** DONE
- **Phase & Gate Contribution:** Core Phase 1 evidence evaluation component; mandatory prerequisite for Gate G1 and A05.
- **Canonical Design References:** [docs/VERIFICATION.md §3, §4, §5, §7](docs/VERIFICATION.md), [docs/DECISIONS.md#adr-019](docs/DECISIONS.md).
- **Allowed Scope & Expected Files:** `src/server/verify/research-planner.ts`, `src/server/verify/extract-evidence.ts`, `src/server/verify/assess-evidence.ts`, `src/server/verify/temporal.ts`, `src/server/prompts/research.ts`, `src/server/prompts/extract-evidence.ts`, `src/server/prompts/assess.ts`, `tests/unit/verify/research-planner.test.ts`, `tests/unit/verify/extract-evidence.test.ts`, `tests/unit/verify/assess-evidence.test.ts`, `tests/unit/verify/temporal.test.ts`, `tests/integration/assess-evidence.live.test.ts`.
- **Atomic Implementation Checklist:**
  - [x] Fix partial-date normalization prerequisite: export `isValidCalendarDateOrPartial` and `CalendarDateOrPartialDateSchema` in `dates.ts`, permit partial dates in `VerificationPropertySchema`, and remove artificial date padding from `normalizePropertyValue`.
  - [x] Implement `research-planner.ts` generating structured `ResearchPlan` queries with explicit purposes (`establish_current_state`, `investigate_exceptions_or_scope`, `seek_counterevidence`, `establish_historical_state_or_transition`), target source roles, remaining allowance enforcement, and early stopping bounds.
  - [x] Enforce deterministic policy counterevidence requirement for exclusivity, superlatives, and active validity assertions.
  - [x] Implement context-preserving extraction in `extract-evidence.ts` to produce `EvidenceUnit[]` retaining negation markers, header trails, table structures, and footnotes.
  - [x] Execute deterministic TypeScript quotation verification (`SourceDocument.rawText.includes(quote)`) and re-anchor character offsets using context headers.
  - [x] Validate `surroundingHeaders` against `SourceDocument.rawText`, discarding fabricated headers while preserving genuine quotes and verified offsets.
  - [x] Implement candidate budgeting (bypassed when candidate passages $\le 4$; bounded to top 8; lexical/date sort baseline).
  - [x] Author semantic assessment prompt sending normalized proposition and candidate `EvidenceUnit[]` to Bifrost.
  - [x] Require model to return candidate `ClaimEvidenceAssessment[]` with matching quotes, property match status, and temporal tags.
  - [x] Enforce deterministic invariants: scope mismatch clamped to `relevant_but_inconclusive`, future effective change classified as `future_scheduled_change` / `future_pending`, historical validity preserved without false contradiction.
  - [x] Correct publication date fallback in `temporal.ts` to return `undetermined` (publication date alone never proves active validity at target time); prevent unjustified model temporal overrides in `assess-evidence.ts`.
  - [x] Enforce deterministic 1:1 mapping in `assess-evidence.ts` by discarding duplicate assessments for the same `evidenceId` into `discardedAssessments`.
  - [x] Preserve valid conflicting assessments for downstream A05 synthesis judge without artificial consensus.
  - [x] Implement live Bifrost integration test suite (`tests/integration/assess-evidence.live.test.ts`).
- **Decision-Fact Producer Follow-up (bounded; required for live A05 integration, not part of A04's original DONE scope):**
  - [ ] Emit `AssessmentGrounding` (`contextBasis`, `limitations`) for each assessment so A05 does not infer whether structural context was verified.
  - [ ] Emit `EvidenceTemporalProof` (`basis`, `applicableInterval`) instead of only a coarse `temporalApplicability` label; distinguish effective-start-only, publication-only, current, and historical validity.
  - [ ] Emit the initial documented `TransitionProof` when historical and current assessments plus an effective date and matching entity/scope corroborate a supersession. This proof must exist before the first `decide_claim`; A07 may consume/present it but must not be its sole producer.
  - [ ] Emit typed coverage facts from the research/assessment loop: rejected candidates with materiality and unresolved obligations with claim/evidence scope and affected assessment IDs. Budget exhaustion remains a B05 flow fact.
- **Prerequisites:**
  - **Start Prerequisites:** A01, A02, A10.
  - **Integration / Completion Prerequisites:** A03, B02, B03 (mocked for unit testing; live Tavily integration deferred to B03).
  - **External Prerequisites:** Model provider credentials via Bifrost.
  - **What Can Start Early:** Research planner templates, context-preserving extraction helpers, quotation verifier logic, unit tests with mocked Tavily documents.
- **Deliverable & Interface Handoff:** Handed downstream to A05 (policy, synthesis judge & decision records) and B04b. Callable stages `generateResearchPlan`, `extractEvidenceUnits`, and `assessEvidenceAgainstClaim` ready for immediate DAG node wiring. The bounded decision-fact producer follow-up above is required before the live `decide_claim` path can supply grounding, temporal proofs, transition proofs, or typed coverage to A05.
- **Positive Acceptance Examples:** An authoritative passage confirming entity, attribute, and scope is classified as `supports` with `quotationVerified: true`; table footnotes are captured into evidence unit; partial dates retain verbatim precision; duplicate assessment proposals for the same evidence unit are discarded with audit trails.
- **Relevant Negative / Failure Cases:** An invented or hallucinated quote fails deterministic quotation verification and is discarded; fabricated section headers are filtered out; evidence with conflicting jurisdiction or currency is classified as wrong-scope.
- **Verification Commands & Checks:** `pnpm test` (228 unit tests passing across 13 suites), `pnpm test:live` (live Bifrost E4 integration), `pnpm typecheck` (0 errors), `pnpm lint` (0 errors), `pnpm build` (clean in 5.0s).
- **Evidence Level & Required Proof:** E1 (Static analysis, compiler, lint, build) + E2 (Vitest unit suite with 49 focused A04/date/temporal tests) + E4 (Live Railway Bifrost gateway integration).
- **Observed Evidence:** Implemented partial-date preservation in `src/lib/contracts/dates.ts` and `src/lib/contracts/claim-ticket.ts`, retiring artificial padding in `src/server/verify/context-resolver.ts`. Implemented temporal interval evaluation in `src/server/verify/temporal.ts` with publication date fallback corrected to `undetermined`. Implemented prompt builders in `src/server/prompts/` (`research.ts`, `extract-evidence.ts`, `assess.ts`). Implemented modular verifier stages in `src/server/verify/` (`research-planner.ts`, `extract-evidence.ts`, `assess-evidence.ts`, `index.ts`) with fabricated header filtration, duplicate assessment deduplication, and model temporal judgment preservation. Authored 49 unit tests across `tests/unit/contracts/partial-dates.test.ts` (12 tests), `tests/unit/verify/temporal.test.ts` (14 tests), `tests/unit/verify/research-planner.test.ts` (7 tests), `tests/unit/verify/extract-evidence.test.ts` (7 tests), and `tests/unit/verify/assess-evidence.test.ts` (9 tests), bringing the total unit test suite to 228/228 passing tests. Executed live model integration tests against Railway Bifrost (`gemini-3.5-flash-lite`) via `tests/integration/assess-evidence.live.test.ts` (1/1 passed end-to-end with automated 503 backoff recovery). All static checks clean: `pnpm typecheck` (0 errors), `pnpm lint` (0 errors, 0 warnings), `pnpm build` (compiled in 5.0s, 5/5 static pages generated). Acceptance audit completed with follow-up corrections applied and verified. Status updated to DONE.
- **Explicit Exclusions:** Vector embedding shortlisting (isolated in experimental A11), final score calculation (owned by A05), and Bifrost composite outer deadline management (owned by Lane B / B04b).
- **Blocker / Decision:** None for A04's original scope. The bounded decision-fact producer follow-up is an integration dependency for A05 and B04b; it does not reopen A04's accepted E2/E4 evidence.

#### A05: Apply deterministic policy, synthesis judge and decision gates {#a05-apply-deterministic-policy-and-score}
- **Owner:** A / Verification
- **Plain-Language Outcome:** Implement a pure deterministic decision boundary that validates a complete claim/evidence aggregate, applies documented gates, and emits an immutable auditable `DecisionRecord` with categorical score heuristics (100, 75, 0, null).
- **Planned Date:** Nov 9, 2026 IST
- **Status:** DONE (A05 deterministic service accepted at E1/E2; integration tracked separately)
- **Phase & Gate Contribution:** Core Phase 1 decision authority; mandatory prerequisite for Gate G1 and B04b. A05's scoped acceptance does not complete Gate G1: production worker wiring, persistence alignment, and semantic producers remain open.
- **Canonical Design References:** [docs/VERIFICATION.md §8, §9, §10](docs/VERIFICATION.md), [docs/DECISIONS.md#adr-005](docs/DECISIONS.md), [docs/DECISIONS.md#adr-021](docs/DECISIONS.md).
- **Allowed Scope & Expected Files:** `src/server/verify/decide.ts`, `src/lib/contracts/decision.ts` (input/policy contracts), `tests/unit/verify/decide.test.ts`, `src/server/verify/index.ts` (barrel export). `src/server/verify/correction.ts` is **not** in A05 scope.
- **Atomic Implementation Checklist:**
  - [x] Validate and index the complete aggregate before deciding: claim binding, current revision, dangling references, duplicate IDs, one-assessment-per-evidence, source grounding, policy roles, and timestamps.
  - [x] Apply eligibility and exclusions: unverifiable quotations, wrong-scope qualifiers, incomplete property matches, unverified structural context, and insufficient authority.
  - [x] Execute the documented gate sequence: validate → eligibility/exclusions → context ambiguity → unresolved equal-authority conflict → contradiction/outdated → support → `insufficient_evidence`.
  - [x] Emit an immutable `DecisionRecord` with verdict, categorical score, machine reason code, deterministic explanation, primary/counter/excluded evidence IDs, temporal basis, limitations, and trace references.
  - [x] Enforce the categorical rubric: `supported` 100/75, `contradicted`/`outdated` 0, and `depends_on_context`/`conflicting_evidence`/`insufficient_evidence` null.
  - [x] Keep the boundary pure: no model calls, Tavily/Bifrost calls, database access, `Date.now()`, environment-driven verdicts, or input mutation.
  - [x] Add focused deterministic E2 coverage for support, authority qualification, scope versus value, equal-authority conflict, outdated/contradicted/incomplete transitions, historical truth, future announcements, publication versus event time, context, optional unknowns, coverage, duplicates, truth-signal fencing, schema validity, determinism, ordering, and immutability.
  - [x] Preserve an independently sufficient current contradiction when earlier validity lacks a complete transition proof; return `outdated` only for a complete applicable chain and retain prior validity as a `PRIOR_VALIDITY_TRANSITION_UNESTABLISHED` limitation.
  - [x] Apply typed coverage obligations by claim/evidence scope: material unresolved gaps block only affected support, independent evidence may still decide, 75 remains qualifying credible-secondary support, unrelated/non-material rejections do not block, and budget exhaustion alone is not a material factual gap.
  - [ ] Persist and wire the decision into the DAG worker once B04b provides a production entry point.
- **Prerequisites:**
  - **Start Prerequisites:** A04, A10.
  - **Integration / Completion Prerequisites:** B04b (typed aggregate loading, worker invocation, and persistence), A06 (domain-specific property roles and source-role narrowing), A03/A04 bounded decision-fact producer follow-ups (claim temporal scope, grounding, temporal proofs, initial transition proof, coverage facts), and B05 (budget/research-completion facts).
  - **External Prerequisites:** None for A05 itself.
  - **What Can Start Early:** Entire decision tree logic, temporal comparator, reason code registry, and unit test suite.
- **Deliverable & Interface Handoff:** `decideClaim(input): DecideClaimOutcome` is exported from `src/server/verify/index.ts` for A06, A07, and B04b. A06 supplies domain policy facts (property roles, authoritative source roles, `SourceAuthorityFact` applicability). A07 calls `decideClaim` re-entrantly for candidate corrections and may consume `TransitionProof`, but the initial transition proof must be produced upstream by A04/A06. B04b must assemble the full typed aggregate (including grounding, temporal proofs, authority, transitions, and typed coverage), persist the `DecisionRecord` fields, and treat `invalid_input` as a non-persisted failure. The field-by-field producer handoff is recorded in [docs/VERIFICATION.md §10.2](VERIFICATION.md).
- **Positive Acceptance Examples:** Direct primary support with claim-specific provenance yields score 100 (`AUTHORITATIVE_PRIMARY_SUPPORT`); credible-secondary support yields 75 (`INDIRECT_CREDIBLE_SUPPORT`); decisive primary contradiction yields 0 (`DECISIVE_CONTRADICTION`); a documented matching-scope supersession yields 0 (`SUPERSEDED_HISTORICAL_CLAIM`); equal-authority unresolved opposition yields `conflicting_evidence`/null (`CREDIBLE_SOURCES_DISAGREE`).
- **Relevant Negative / Failure Cases:** A role label or `sourceSuitability` without claim-applicable provenance cannot grant 100; a different jurisdiction is `wrong_scope`, not a value contradiction; a newer publication date alone does not resolve a conflict or prove supersession; an old effective-start or publication date alone does not prove current validity; unverified structural context cannot independently decide; a current primary contradiction with earlier validity but no complete transition remains `contradicted`/0 and retains `PRIOR_VALIDITY_TRANSITION_UNESTABLISHED`; a material unresolved coverage gap affecting every support prevents `supported`; malformed aggregates return `invalid_input` without a partial verdict.
- **Verification Commands & Checks:** `pnpm vitest run tests/unit/verify/decide.test.ts`; `pnpm test`; `pnpm typecheck`; `pnpm lint`; `pnpm build`.
- **Evidence Level & Required Proof:** E1 (typecheck/lint/build) + E2 (41 focused Vitest decision cases, 269 total unit tests). No E3/E4/E5 evidence is claimed for A05. Integration remains blocked by B04b (no worker/API entry point, ID-only `DecideClaimPayloadSchema`, simplified Prisma `DecisionRecord`) and by missing semantic producers (A03/A04/A06/B05).
- **Observed Evidence:** Implemented `src/server/verify/decide.ts` with `decideClaim`, `DECISION_REASON_CODES`, the `decided`/`invalid_input`/`internal_error` outcome union, aggregate validation/indexing, eligibility and exclusion evaluation, canonical ordering, deterministic record hashing, and `DecisionRecordSchema` plus `validateDecisionRecordReferences` validation. Extended `src/lib/contracts/decision.ts` with `DecideClaimInputSchema`, property-role policy, claim temporal scope, assessment grounding basis, evidence temporal proofs, source authority facts, transition proofs, typed coverage obligations (`scope`, `affectedAssessmentIds`, `resolvedByAssessmentIds`, `resolutionBasis`), and rejection records. Corrected the contradiction gate so missing transition proof no longer downgrades an independently sufficient current contradiction, and replaced the coarse coverage penalty with evidence-aware support blocking. Exported the gate from `src/server/verify/index.ts`. Expanded `tests/unit/verify/decide.test.ts` to 41 tests, including the required coverage regressions and the contradicted-versus-outdated transition pair. Executed `pnpm vitest run tests/unit/verify/decide.test.ts` → 41/41 passed; `pnpm test` → 14 suites / 269 tests passed; `pnpm typecheck` → 0 errors; `pnpm lint` → 0 errors and 0 warnings; `pnpm build` → clean production build (5/5 static pages). No live provider, database, or staged environment evidence is claimed.
- **Explicit Exclusions:** Correction text generation, replacement formatting, bounded re-verification scheduling, and withholding unverified corrections (owned exclusively by A07); full A06 domain policy collection; LLM/research calls; database transactions, queue delivery, and persistence (owned by B04b); UI rendering; vector/embedding or `modelConfidence` truth signals.
- **Blocker / Decision:** **A05 deterministic service accepted at E1/E2; integration tracked separately.** Production integration is blocked by B04b: no `src/app/api/**` route or worker entry exists, `DecideClaimPayloadSchema` carries only IDs, and the Prisma `DecisionRecord` model lacks score/reason/evidence/temporal/limitation fields. Semantic producer gaps remain under A03 (claim temporal scope), A04 (grounding, temporal proof, initial transition proof, coverage facts), A06 (authority applicability and property roles), and B05 (budget/research-completion facts). Do not wire persistence or treat Gate G1 as complete until those owners deliver.

#### B03: Implement search, extract and evidence capture {#b03-search-extract-and-evidence-capture}
- **Owner:** B / Platform
- **Plain-Language Outcome:** Implement Tavily API client executing queries formulated by ResearchPlans, capturing SourceDocument records with final redirected URLs, raw crawl hashes, publication dates, and authority tiers.
- **Planned Date:** Nov 9, 2026 IST
- **Status:** TODO
- **Phase & Gate Contribution:** Phase 1 web intelligence deliverable; mandatory prerequisite for Gate G1 and B04b.
- **Canonical Design References:** [docs/ARCHITECTURE.md §2](docs/ARCHITECTURE.md), [docs/VERIFICATION.md §3, §4](docs/VERIFICATION.md), [docs/DECISIONS.md#adr-004](docs/DECISIONS.md).
- **Allowed Scope & Expected Files:** `src/server/tavily/client.ts` (proposed), `src/server/tavily/queries.ts` (proposed), `tests/integration/tavily-live.test.ts` (proposed).
- **Atomic Implementation Checklist:**
  - [ ] Implement Tavily API client with Bearer auth for `POST /search` and `POST /extract`.
  - [ ] Execute search operations derived from `ResearchPlan` queries (current-state, counterevidence, and historical/change queries).
  - [ ] Capture retrieved web intelligence into `SourceDocument` records: URL, final redirected URL, title, publisher, raw content hash, publication date, effective date, and assigned source role.
  - [ ] Sanitize raw HTML passages into clean, structured text bounded by worker prompt budget.
- **Prerequisites:**
  - **Start Prerequisites:** A01, A02.
  - **Integration / Completion Prerequisites:** A10 (for typed ResearchPlan & SourceDocument capture).
  - **External Prerequisites:** Tavily API Key (`TAVILY_API_KEY`).
  - **What Can Start Early:** Client implementation, query formatting, mock response fixtures, and rate-limit retry logic.
- **Deliverable & Interface Handoff:** Handed downstream to A04 (evidence extraction & assessment) and B04b.
- **Positive Acceptance Examples:** Search and extract operations return structured SourceDocuments with verified publisher metadata and verbatim raw text.
- **Relevant Negative / Failure Cases:** HTTP 429 rate limit triggers exponential backoff; inaccessible URLs log crawl errors without aborting sibling queries.
- **Verification Commands & Checks:** `pnpm vitest run tests/integration/tavily-live.test.ts`.
- **Evidence Level & Required Proof:** E4 (Staging integration test against live Tavily API).
- **Observed Evidence:** *Pending execution*
- **Explicit Exclusions:** Direct client-side Tavily calls (browser never calls Tavily directly).
- **Blocker / Decision:** B confirms active Tavily API key.

#### C03: Wire real runs, Server Actions and live progress {#c03-wire-real-runs-and-progress}
- **Owner:** C / Product
- **Plain-Language Outcome:** Implement Server Actions for input submission and confirmation, useRun hook managing preparation review, live SSE progress streaming, and snapshot polling fallback.
- **Planned Date:** Nov 9, 2026 IST
- **Status:** REVIEW
- **Phase & Gate Contribution:** Phase 1 product deliverable; completes Gate G1 when paired with B04b.
- **Canonical Design References:** [docs/API.md §1, §2](docs/API.md), [docs/ARCHITECTURE.md §3](docs/ARCHITECTURE.md), [docs/DECISIONS.md#adr-011](docs/DECISIONS.md), [docs/DECISIONS.md#adr-012](docs/DECISIONS.md).
- **Allowed Scope & Expected Files:** `src/actions/run-actions.ts`, `src/hooks/useRun.ts`, `src/app/report/[id]/page.tsx`, `src/components/report/LiveReportViewer.tsx`, `tests/unit/actions/run-actions.test.ts`.
- **Atomic Implementation Checklist:**
  - [x] Implement Server Actions `startPreparationAction` and `confirmPreparationAction` calling backend server services directly in-process.
  - [x] Implement `useRun` hook managing preparation review, confirmation, SSE subscription (`/api/runs/[id]/events`), and snapshot polling fallback.
  - [x] Display step progress badges reflecting dynamic DAG stages ("Extracting", "Planning", "Searching", "Assessing", "Scoring", "Finalized").
  - [x] Handle single-claim failure gracefully without clearing completed siblings.
- **Prerequisites:**
  - **Start Prerequisites:** C02, B04b.
  - **Integration / Completion Prerequisites:** None (polling fallback satisfies Gate G1; live SSE streaming is a Phase 3 non-blocking enhancement via B06).
  - **External Prerequisites:** None.
  - **What Can Start Early:** Server Action wrappers, React hooks with mock SSE generator, and state machine tests.
- **Deliverable & Interface Handoff:** Handed downstream to C04 (split workspace & evidence inspection).
- **Positive Acceptance Examples:** User submits paste, reviews preparation qualifiers, confirms, and watches live DAG progress on `/runs/[id]`; page refresh reloads state from snapshot.
- **Relevant Negative / Failure Cases:** Network disconnect falls back gracefully to 2-second snapshot polling; stale preparation revision is rejected with error banner.
- **Verification Commands & Checks:** `cmd /c pnpm typecheck && cmd /c pnpm test`.
- **Evidence Level & Required Proof:** E1/E2 (Typecheck, Vitest unit suite covering actions and state machine).
- **Observed Evidence:** Verified via static typecheck (`tsc --noEmit` exited 0), ESLint (`eslint .` exited 0), Vitest unit suite (`vitest run`, 14 test files passed, 238 tests passed, 4 skipped; including 10/10 in `tests/unit/actions/run-actions.test.ts`), and Next.js production build (`next build` exited 0). Revision binding invariant (TC-08) verified returning `STALE_PREPARATION_REVISION` upon input hash mismatch.
- **Explicit Exclusions:** Advanced domain clarification forms (handled in C04).
- **Blocker / Decision:** None.

---

### Phase 2: Dynamic Execution, Broad Coverage & Durability (Nov 9–11, 2026 IST)

#### A06: Build pricing, API, regulation and leadership policies {#a06-build-pricing-api-regulation-and-leadership-policies}
- **Owner:** A / Verification
- **Plain-Language Outcome:** Implement specialized domain verification policies for Pricing, APIs, Regulations, and Leadership, enforcing qualifier constraints and triggering structured clarification questions.
- **Planned Date:** Nov 10, 2026 IST
- **Status:** DONE
- **Phase & Gate Contribution:** Phase 2 verifier deliverable; mandatory prerequisite for Gate G2 and B05.
- **Canonical Design References:** [docs/VERIFICATION.md §4](docs/VERIFICATION.md), [docs/DECISIONS.md#adr-015](docs/DECISIONS.md).
- **Allowed Scope & Expected Files:** `src/server/policies/index.ts`, `src/server/policies/pricing.ts`, `src/server/policies/api.ts`, `src/server/policies/regulation.ts`, `src/server/policies/leadership.ts`, `src/server/policies/generic.ts`, `src/server/policies/types.ts`, `tests/unit/policies/domain-policies.test.ts`.
- **Atomic Implementation Checklist:**
  - [x] Build policy registry mapping extracted claim attributes and domain semantics to domain policies.
  - [x] Implement `pricing.ts` (match tier, currency, billing commitment, tax terms; resolve price as asserted_value).
  - [x] Implement `api.ts` (distinguish version-as-scope vs version-as-asserted-value; match vendor, SDK, version, deprecated vs removed).
  - [x] Implement `regulation.ts` (match jurisdiction, covered group, effective status, statutory provisions).
  - [x] Implement `leadership.ts` (match entity, office, interim vs permanent; resolve leader name as asserted_value).
  - [x] Implement `generic.ts` (conservative universal fallback preserving typed metadata without arbitrary position-based guessing).
  - [x] Implement domain-specific clarification question planning for material ambiguities within ADR-015 bounds with explicit round exhaustion (`ClarificationPlanResult`).
  - [x] Emit `SourceAuthorityFact` facts (provenance basis plus claim applicability) with explicit provenance validation and declare `DecisionPropertyRole[]` scope-qualifier versus asserted-value roles for the A05 aggregate.
- **Prerequisites:**
  - **Start Prerequisites:** A05, B03.
  - **Integration / Completion Prerequisites:** None.
  - **External Prerequisites:** None.
  - **What Can Start Early:** Policy interface definitions, qualifier matching algorithms, and unit test suites.
- **Deliverable & Interface Handoff:** Handed downstream to B05 (dynamic DAG expansion), C04 (clarification form), A07, and A08. Supplies A05 with `SourceAuthorityFact` applicability and `DecisionPropertyRole[]`; it does not manufacture temporal or supersession facts.
- **Positive Acceptance Examples:** One mixed answer successfully validates claims across all 4 domains; pricing policy rejects monthly assertion matched against annual rate.
- **Relevant Negative / Failure Cases:** Deprecated API parameter claimed to be "removed" is marked contradicted; regulation claimed in force before effective date is flagged as upcoming change.
- **Verification Commands & Checks:** `pnpm vitest run tests/unit/policies/domain-policies.test.ts && pnpm typecheck && pnpm lint && pnpm build`.
- **Evidence Level & Required Proof:** E1 (Static analysis, compiler, lint, build) + E2 (Vitest unit suite covering all 4 domain policies, generic fallback, and A05 integration).
- **Observed Evidence:** A06 deterministic policy services accepted at E1/E2; upstream semantic/provenance producers and production integration tracked separately. Implemented `src/server/policies/` (`types.ts`, `pricing.ts`, `api.ts`, `regulation.ts`, `leadership.ts`, `generic.ts`, `index.ts`). Resolved specific acceptance criteria: (1) explicit clarification round exhaustion via `ClarificationPlanResult` (`not_needed`, `questions_planned`, `rounds_exhausted`, `invalid_input`) with A05 ambiguity gate integration (`depends_on_context`), (2) generic property-role resolution without position-dependent guessing, (3) source authority qualification requiring explicit provenance basis and claim applicability binding, (4) clear separation between user-context clarification and research obligations. Authored 31-test unit suite in `tests/unit/policies/domain-policies.test.ts`. Full test suite: 300/300 passed across 15 suites in 7.26s. Static verification: `pnpm typecheck` (0 errors), `pnpm lint` (0 errors), `pnpm build` (compiled clean in 8.7s). Status updated to DONE.
- **Explicit Exclusions:** UI rendering of clarification forms (handled in C04), live web crawling/provenance pipeline (B03/A04).
- **Blocker / Decision:** None. Deterministic E1/E2 service complete and accepted.

#### A11: Explore optional vector shortlisting and counter-hypothesis experiments (Experimental) {#a11-explore-optional-vector-shortlisting-and-counter-hypothesis-experiments}
- **Owner:** A / Verification
- **Plain-Language Outcome:** Implement and benchmark in-memory cosine shortlisting for large candidate sets (> 4 passages) and experimental counter-hypothesis testing, strictly validating that vector similarity never leaks into public truth scores and does not block core verifier operation.
- **Planned Date:** Nov 10, 2026 IST
- **Status:** TODO
- **Phase & Gate Contribution:** Phase 2 experimental study; strictly non-blocking for Gate G1, G2, or G3; evaluated as an ablation in A09.
- **Canonical Design References:** [docs/VERIFICATION.md §6](docs/VERIFICATION.md), [docs/DECISIONS.md#adr-020](docs/DECISIONS.md).
- **Allowed Scope & Expected Files:** `src/server/verify/vector-ranker.ts` (proposed), `tests/unit/verify/vector-ranker.test.ts` (proposed).
- **Atomic Implementation Checklist:**
  - [ ] Implement in-memory cosine similarity ranking over cached candidate embeddings in PostgreSQL or memory.
  - [ ] Enforce bypass guard: if candidate passages count is $\le 4$, vector shortlisting is completely bypassed.
  - [ ] Implement counter-hypothesis similarity experiment comparing candidate text against an inverted proposition.
  - [ ] Verify score fencing: vector similarity metrics are strictly excluded from `DecisionRecord.score` and public outputs.
- **Prerequisites:**
  - **Start Prerequisites:** A04, B02.
  - **Integration / Completion Prerequisites:** None.
  - **External Prerequisites:** Embedding model profile via Bifrost.
  - **What Can Start Early:** Cosine similarity math, unit test suite with mock vectors, and score fencing assertion tests.
- **Deliverable & Interface Handoff:** Handed downstream to A09 as an optional retrieval ablation.
- **Positive Acceptance Examples:** When candidate count is 10, ranker shortlists top 4 passages for model assessment; cosine scores remain strictly internal.
- **Relevant Negative / Failure Cases:** Injected test confirms that high vector similarity between contradictory claims never alters the deterministic contradicted verdict.
- **Verification Commands & Checks:** `pnpm vitest run tests/unit/verify/vector-ranker.test.ts`.
- **Evidence Level & Required Proof:** E2 (Vitest unit suite proving score fencing and shortlisting behavior).
- **Observed Evidence:** *Pending execution*
- **Explicit Exclusions:** Core verdict generation and public scoring (strictly forbidden from affecting truth scores).
- **Blocker / Decision:** None.

#### B05: Implement signed delivery, bounded concurrency, dynamic graph expansion and recovery {#b05-implement-signed-delivery-leases-and-recovery}
- **Owner:** B / Platform
- **Plain-Language Outcome:** Implement QStash webhook delivery with signature verification, bounded concurrency (max 3 claims), dynamic runtime graph expansion, zero-lease clarification pauses, and reconciliation sweeper.
- **Planned Date:** Nov 10, 2026 IST
- **Status:** TODO
- **Phase & Gate Contribution:** Phase 2 platform deliverable; mandatory prerequisite for Gate G2 and C04.
- **Canonical Design References:** [docs/ARCHITECTURE.md §4, §5](docs/ARCHITECTURE.md), [docs/DATA-AND-JOBS.md §2, §3](docs/DATA-AND-JOBS.md), [docs/DECISIONS.md#adr-013](docs/DECISIONS.md).
- **Allowed Scope & Expected Files:** `src/server/jobs/worker.ts` (proposed), `src/app/api/verify/worker/route.ts` (proposed), `src/app/api/internal/reconcile/route.ts` (proposed), `src/server/services/clarification-service.ts` (proposed), `tests/integration/dynamic-dag-recovery.test.ts` (proposed).
- **Atomic Implementation Checklist:**
  - [ ] Implement QStash webhook verification in `/api/verify/worker` via `verifySignatureAppRouter`.
  - [ ] Enforce QStash flow control capping concurrent active claim branches to 3.
  - [ ] Implement dynamic runtime graph expansion protocol (DFS cycle check $\to$ atomic commit of node outcome, newly expanded nodes/edges, and events).
  - [ ] Implement non-blocking clarification wait states in `dag_nodes` (`waiting_for_input`) holding zero worker leases.
  - [ ] Implement reconciliation route `/api/internal/reconcile` to recover expired leases, dispatch stranded eligible nodes, and handle clarification timeouts.
  - [ ] Emit typed `DecisionCoverage` facts for `decide_claim`: research completion, material obligations with claim/evidence scope, and budget exhaustion. Lane B transports these facts; it must not manufacture semantic authority or supersession.
- **Prerequisites:**
  - **Start Prerequisites:** B04b.
  - **Integration / Completion Prerequisites:** A06 (for multi-domain execution).
  - **External Prerequisites:** Upstash QStash account, token, and signing keys (`QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`).
  - **What Can Start Early:** Signature verification helpers, DFS cycle detection algorithm, and lease expiration logic.
- **Deliverable & Interface Handoff:** Handed downstream to B06, B07, and C04; completes Gate G2 platform requirement. Supplies budget/research-completion coverage facts to the `decide_claim` aggregate through B04b; semantic authority, temporal applicability, and supersession remain upstream A04/A06 facts.
- **Positive Acceptance Examples:** Sibling claims fan out across QStash with max 3 concurrent branches; paused clarification branch holds zero leases; reconciliation sweeper re-enqueues timed-out nodes.
- **Relevant Negative / Failure Cases:** Duplicate delivery of identical webhook cannot insert duplicate claim records; worker losing its lease fails closed upon completion attempt (`409 Conflict`).
- **Verification Commands & Checks:** `pnpm vitest run tests/integration/dynamic-dag-recovery.test.ts`.
- **Evidence Level & Required Proof:** E3 (Integration race test verifying lease fencing and recovery).
- **Observed Evidence:** *Pending execution*
- **Explicit Exclusions:** UI form rendering.
- **Blocker / Decision:** B confirms QStash project credentials and signing keys.

#### C04: Implement evidence inspection screen and dynamic clarification form {#c04-implement-evidence-inspection-screen}
- **Owner:** C / Product
- **Plain-Language Outcome:** Build the 55:45 split desktop workspace with responsive mobile sheet, interactive evidence inspection cards with counterevidence tabs, and generic accessible clarification form with 'I don't know' support.
- **Planned Date:** Nov 10, 2026 IST
- **Status:** TODO
- **Phase & Gate Contribution:** Phase 2 product deliverable; completes Gate G2 when paired with A06 and B05.
- **Canonical Design References:** [docs/PRODUCT.md §2](docs/PRODUCT.md), [docs/VERIFICATION.md §2](docs/VERIFICATION.md), [docs/DECISIONS.md#adr-015](docs/DECISIONS.md).
- **Allowed Scope & Expected Files:** `src/components/ClaimMarker.tsx` (proposed), `src/components/ClaimSummary.tsx` (proposed), `src/components/VerdictChip.tsx` (proposed), `src/components/EvidenceCard.tsx` (proposed), `src/components/ClarificationForm.tsx` (proposed), `tests/e2e/evidence-inspection.spec.ts` (proposed).
- **Atomic Implementation Checklist:**
  - [ ] Build 55:45 desktop split screen (source text left, evidence inspector right).
  - [ ] Build responsive bottom sheet for mobile viewports (< 768px).
  - [ ] Implement `ClaimMarker` with click and keyboard focus handlers.
  - [ ] Implement `EvidenceCard` displaying publisher, publication date, effective date, exact excerpt, and outbound link.
  - [ ] Implement accessible `ClarificationForm` rendering approved primitive types (select, short text, date, number, boolean) with "I don't know" button and calling `submitClarificationAction`.
- **Prerequisites:**
  - **Start Prerequisites:** C03, A10.
  - **Integration / Completion Prerequisites:** B05 (clarification unpause), A06 (policy qualifiers).
  - **External Prerequisites:** None.
  - **What Can Start Early:** 55:45 split layout, keyboard navigation, accessible form controls, and mock clarification state.
- **Deliverable & Interface Handoff:** Handed downstream to C05 and C06; completes Gate G2 UI requirement.
- **Positive Acceptance Examples:** Activating a claim highlights the source span and populates matching evidence cards; submitting clarification answer unblocks paused DAG branch; selecting "I don't know" proceeds with unresolved status.
- **Relevant Negative / Failure Cases:** Mobile layout at 360px viewport has zero horizontal scroll; submitting stale question version renders conflict error banner.
- **Verification Commands & Checks:** `pnpm playwright test tests/e2e/evidence-inspection.spec.ts`.
- **Evidence Level & Required Proof:** E2 (Playwright visual regression and interaction test).
- **Observed Evidence:** *Pending execution*
- **Explicit Exclusions:** Advanced timeline visualization (handled in C05).
- **Blocker / Decision:** None.

---

### Phase 3: Product Interactions & Staging (Nov 11–12, 2026 IST)

#### A07: Derive transitions and validate corrections {#a07-derive-transitions-and-validate-corrections}
- **Owner:** A / Verification
- **Plain-Language Outcome:** Implement Then vs. Now chronological transition composer and surgical correction generator validated through a recursive verifier pass requiring score 100.
- **Planned Date:** Nov 11, 2026 IST
- **Status:** TODO
- **Phase & Gate Contribution:** Phase 3 verifier deliverable; mandatory prerequisite for Gate G3 and C05.
- **Canonical Design References:** [docs/VERIFICATION.md §5, §11](docs/VERIFICATION.md), [docs/ARCHITECTURE.md §3](docs/ARCHITECTURE.md), [docs/DECISIONS.md#adr-009](docs/DECISIONS.md).
- **Allowed Scope & Expected Files:** `src/server/verify/transition.ts` (proposed), `src/server/verify/correction.ts` (proposed), `tests/unit/verify/transition-correction.test.ts` (proposed). A07 exclusively owns `correction.ts`; A05 provides the re-entrant `decideClaim` decision boundary only.
- **Atomic Implementation Checklist:**
  - [ ] Implement chronology composer assembling then, transition, now, and upcoming timeline entries.
  - [ ] Separate announced date from effective date; flag future-effective changes with `Scheduled change`.
  - [ ] Consume the initial `TransitionProof` produced upstream by A04/A06; A07 may present and enrich the timeline but must not be the sole producer of the proof required for the first `outdated` verdict.
  - [ ] Implement surgical correction generator replacing only verified attributes, consuming A05's `DecisionRecord` and never generating a correction for an unresolved or conflicting verdict.
  - [ ] Run the recursive verifier (`decideClaim`) against replacement text; withhold the diff unless the new decision is `supported` with score 100.
- **Prerequisites:**
  - **Start Prerequisites:** A05, A06.
  - **Integration / Completion Prerequisites:** None.
  - **External Prerequisites:** None.
  - **What Can Start Early:** Timeline composer, date separation logic, and unit test suite.
- **Deliverable & Interface Handoff:** Handed downstream to C05, C06, and A09. Consumes A05's `DecisionRecord`, upstream `TransitionProof` facts, and re-entrant `decideClaim` outcome; does not duplicate deterministic verdict logic and does not own the initial transition proof.
- **Positive Acceptance Examples:** Outdated claim produces structured Then vs. Now chronology; valid replacement achieves score 100 and emits clean diff.
- **Relevant Negative / Failure Cases:** Future-effective event maintains today's valid verdict and attaches `Scheduled change` badge; withheld correction is marked `correction_unverified` rather than emitting speculative text; a replacement that reaches only score 75, 0, or null is suppressed.
- **Verification Commands & Checks:** `pnpm vitest run tests/unit/verify/transition-correction.test.ts`.
- **Evidence Level & Required Proof:** E2 (Vitest unit suite).
- **Observed Evidence:** *Pending execution*
- **Explicit Exclusions:** UI rendering of timeline cards.
- **Blocker / Decision:** None.

#### A08: Freeze test set before tuning {#a08-freeze-the-test-set-before-tuning}
- **Owner:** A / Verification
- **Plain-Language Outcome:** Curate 30 factual test claims across the 4 domains, freeze context-paired test cases, and partition into 20 development cases and 10 held-out cases.
- **Planned Date:** Nov 12, 2026 IST
- **Status:** TODO
- **Phase & Gate Contribution:** Phase 3 evaluation deliverable; mandatory prerequisite for Gate G3 and A09.
- **Canonical Design References:** [docs/TESTING-AND-EVALUATION.md §4, §5](docs/TESTING-AND-EVALUATION.md), [docs/DECISIONS.md#adr-010](docs/DECISIONS.md).
- **Allowed Scope & Expected Files:** `eval/cases.jsonl` (proposed), `eval/schema.ts` (proposed), `tests/unit/eval/test-set.test.ts` (proposed).
- **Atomic Implementation Checklist:**
  - [ ] Curate 30 claims across pricing, APIs, regulations, and leadership.
  - [ ] Include at least 3 context pairs per domain where changing one qualifier flips ground truth.
  - [ ] Include negative cases: fabricated values, wrong jurisdiction, future effective date, missing history.
  - [ ] Split dataset: 20 cases for dev tuning, 10 held-out cases reserved exclusively for final benchmark.
  - [ ] Commit and freeze `eval/cases.jsonl` before prompt tuning begins.
- **Prerequisites:**
  - **Start Prerequisites:** A02.
  - **Integration / Completion Prerequisites:** A06 (domain policies finalize gold labels).
  - **External Prerequisites:** None.
  - **What Can Start Early:** Collecting candidate URLs, drafting context pairs, and authoring schema.
- **Deliverable & Interface Handoff:** Handed downstream to A09 for formal benchmark execution.
- **Positive Acceptance Examples:** All 30 claims validate against `eval/schema.ts`; at least 3 context pairs per domain are present.
- **Relevant Negative / Failure Cases:** Duplicate claims or ungrounded gold verdicts fail test set validation.
- **Verification Commands & Checks:** `pnpm vitest run tests/unit/eval/test-set.test.ts`.
- **Evidence Level & Required Proof:** E1 (Static schema validation of `eval/cases.jsonl`).
- **Observed Evidence:** *Pending execution*
- **Explicit Exclusions:** Modifying held-out cases after prompt tuning starts.
- **Blocker / Decision:** None.

#### B06: Implement public run endpoints, SSE replay and programmatic API adapter {#b06-implement-the-public-run-endpoints}
- **Owner:** B / Platform
- **Plain-Language Outcome:** Implement public run snapshot route, reconnectable SSE progress stream with sequence replay (?afterSeq=N), and headless programmatic REST API adapter (POST /api/v1/verify) calling shared application services.
- **Planned Date:** Nov 11, 2026 IST
- **Status:** TODO
- **Phase & Gate Contribution:** Phase 3 platform deliverable; mandatory prerequisite for Gate G3, C06, and B07.
- **Canonical Design References:** [docs/API.md §3](docs/API.md), [docs/ARCHITECTURE.md §2](docs/ARCHITECTURE.md), [docs/DECISIONS.md#adr-011](docs/DECISIONS.md), [docs/DECISIONS.md#adr-012](docs/DECISIONS.md).
- **Allowed Scope & Expected Files:** `src/app/api/runs/[id]/route.ts` (proposed), `src/app/api/runs/[id]/events/route.ts` (proposed), `src/app/api/v1/verify/route.ts` (proposed), `src/server/services/run-query-service.ts` (proposed), `tests/integration/run-endpoints.test.ts` (proposed).
- **Atomic Implementation Checklist:**
  - [ ] Implement `GET /api/runs/[id]` snapshot route with sanitized projection and `Cache-Control: no-store`.
  - [ ] Implement `GET /api/runs/[id]/events` SSE stream with sequence replay (`?afterSeq=N`).
  - [ ] Implement `POST /api/v1/verify` programmatic REST verification adapter calling shared `VerificationService`.
  - [ ] Enforce anonymous cookie ownership (`ownerHash`) and input schema validation across all routes.
- **Prerequisites:**
  - **Start Prerequisites:** B04b, B05.
  - **Integration / Completion Prerequisites:** A06 (for multi-domain snapshots).
  - **External Prerequisites:** None.
  - **What Can Start Early:** Route skeletons, cookie hashing logic, and integration test doubles.
- **Deliverable & Interface Handoff:** Handed downstream to C05, C06, C07, and B07; satisfies Gate G3 public API requirement.
- **Positive Acceptance Examples:** SSE disconnect replays missed events from specified sequence number; snapshot polling provides reliable fallback; programmatic API verifies headlessly without bypassing validation.
- **Relevant Negative / Failure Cases:** Request with mismatched `ownerHash` returns `404 Not Found` (cross-owner privacy isolation).
- **Verification Commands & Checks:** `pnpm vitest run tests/integration/run-endpoints.test.ts`.
- **Evidence Level & Required Proof:** E3 (Integration API test suite).
- **Observed Evidence:** *Pending execution*
- **Explicit Exclusions:** UI presentation components.
- **Blocker / Decision:** None.

#### B07: Provision staging with real integrations {#b07-provision-staging-with-real-integrations}
- **Owner:** B / Platform
- **Plain-Language Outcome:** Deploy Next.js to Vercel staging, connect Neon staging branch, configure QStash signed webhooks over TLS, and verify end-to-end integration.
- **Planned Date:** Nov 12, 2026 IST
- **Status:** TODO
- **Phase & Gate Contribution:** Phase 3 infrastructure deliverable; completes Gate G3 when paired with C07.
- **Canonical Design References:** [docs/SETUP-AND-DEPLOYMENT.md §4](docs/SETUP-AND-DEPLOYMENT.md), [docs/ARCHITECTURE.md §2](docs/ARCHITECTURE.md).
- **Allowed Scope & Expected Files:** `infra/staging.env` (proposed), `infra/smoke-staging.ts` (proposed).
- **Atomic Implementation Checklist:**
  - [ ] Deploy Next.js staging build to Vercel with dedicated staging environment variables.
  - [ ] Configure separate Neon staging database branch.
  - [ ] Configure QStash topic pointing to staging URL with webhook bypass token.
  - [ ] Run automated fault injection test verifying Bifrost fallback and lease recovery on staging.
- **Prerequisites:**
  - **Start Prerequisites:** B05, B06.
  - **Integration / Completion Prerequisites:** None.
  - **External Prerequisites:** Vercel staging project, Neon branch, QStash webhook endpoint.
  - **What Can Start Early:** Infrastructure scripts, smoke test runner, and environment variable audits.
- **Deliverable & Interface Handoff:** Handed downstream to B08 (production deployment); satisfies Gate G3 staging requirement.
- **Positive Acceptance Examples:** Vercel staging deployment reaches Neon, Tavily, and Bifrost over TLS; signed background jobs complete end-to-end.
- **Relevant Negative / Failure Cases:** Unauthenticated or unsigned webhook delivery to `/api/verify/worker` fails with `401 Unauthorized`.
- **Verification Commands & Checks:** `pnpm tsx infra/smoke-staging.ts`.
- **Evidence Level & Required Proof:** E4 (Staging automated smoke run).
- **Observed Evidence:** *Pending execution*
- **Explicit Exclusions:** Production custom domains and public DNS cutover.
- **Blocker / Decision:** B confirms Vercel staging deployment URL.

#### C05: Implement Then vs. Now and scheduled changes {#c05-implement-then-vs-now-and-scheduled-changes}
- **Owner:** C / Product
- **Plain-Language Outcome:** Build the Then vs. Now chronological transition cards linking to supporting evidence passages and render Scheduled change badges on future-effective events.
- **Planned Date:** Nov 11, 2026 IST
- **Status:** TODO
- **Phase & Gate Contribution:** Phase 3 product deliverable; contributes directly to Gate G3.
- **Canonical Design References:** [docs/PRODUCT.md §3](docs/PRODUCT.md), [docs/VERIFICATION.md §5](docs/VERIFICATION.md), [docs/DECISIONS.md#adr-009](docs/DECISIONS.md).
- **Allowed Scope & Expected Files:** `src/components/ChangeTimeline.tsx` (proposed), `src/components/ScheduledChangeBadge.tsx` (proposed), `tests/e2e/timeline.spec.ts` (proposed).
- **Atomic Implementation Checklist:**
  - [ ] Build `ChangeTimeline` displaying historical state, transition event, current state, and upcoming changes.
  - [ ] Link each timeline entry directly to its supporting evidence passage.
  - [ ] Implement `ScheduledChangeBadge` for future-effective regulations or API deprecations.
  - [ ] Display honest fallback message when historical transitions are unverified.
- **Prerequisites:**
  - **Start Prerequisites:** C04, A07.
  - **Integration / Completion Prerequisites:** None.
  - **External Prerequisites:** None.
  - **What Can Start Early:** Component mockups, timeline layout, and fixture-driven rendering tests.
- **Deliverable & Interface Handoff:** Handed downstream to C06.
- **Positive Acceptance Examples:** Current fact with a future-effective event displays a distinct `Scheduled change` badge without marking the claim outdated.
- **Relevant Negative / Failure Cases:** Claims lacking proof of prior validity omit the transition card and render contradicted verdict.
- **Verification Commands & Checks:** `pnpm playwright test tests/e2e/timeline.spec.ts`.
- **Evidence Level & Required Proof:** E2 (Playwright component test).
- **Observed Evidence:** *Pending execution*
- **Explicit Exclusions:** Context comparison drawer (handled in C06).
- **Blocker / Decision:** None.

#### C06: Implement Compare, correction, recheck and Expandable DAG Inspector {#c06-implement-compare-correction-and-recheck}
- **Owner:** C / Product
- **Plain-Language Outcome:** Implement side-by-side context comparison drawer, inline surgical correction diffs with copy button, recheck freshness button, and expandable sanitized DAG inspector.
- **Planned Date:** Nov 11, 2026 IST
- **Status:** TODO
- **Phase & Gate Contribution:** Phase 3 product deliverable; contributes directly to Gate G3.
- **Canonical Design References:** [docs/PRODUCT.md §4](docs/PRODUCT.md), [docs/ARCHITECTURE.md §4](docs/ARCHITECTURE.md), [docs/DECISIONS.md#adr-017](docs/DECISIONS.md).
- **Allowed Scope & Expected Files:** `src/components/CompareDrawer.tsx` (proposed), `src/components/CorrectionDiff.tsx` (proposed), `src/components/DagInspector.tsx` (proposed), `tests/e2e/compare-dag.spec.ts` (proposed).
- **Atomic Implementation Checklist:**
  - [ ] Build `CompareDrawer` allowing user to change one context qualifier and trigger `compareAction`.
  - [ ] Render side-by-side comparison cards for original context vs target context.
  - [ ] Build `CorrectionDiff` component rendering inline word diff with "Copy Correction" button.
  - [ ] Wire "Recheck Freshness" button to `recheckAction` preserving original run reference.
  - [ ] Implement expandable `DagInspector` component displaying sanitized public projection of dynamic DAG nodes, active stage, and Tavily queries executed (scrubbing internal leases and tokens).
- **Prerequisites:**
  - **Start Prerequisites:** C04, C05, B06.
  - **Integration / Completion Prerequisites:** None.
  - **External Prerequisites:** None.
  - **What Can Start Early:** Drawer component layout, diff visualizer, and DAG viewer using mock graph data.
- **Deliverable & Interface Handoff:** Handed downstream to C07; satisfies Gate G3 interactive comparison requirement.
- **Positive Acceptance Examples:** Context comparison flips verdict on paired Stripe case without mutating original text; expandable DAG view displays active stages without exposing internal leases.
- **Relevant Negative / Failure Cases:** Failed recheck retains previous completed report intact without data loss.
- **Verification Commands & Checks:** `pnpm playwright test tests/e2e/compare-dag.spec.ts`.
- **Evidence Level & Required Proof:** E2 (Playwright interaction test).
- **Observed Evidence:** *Pending execution*
- **Explicit Exclusions:** Export formats and Ask drafting flow (handled in C07).
- **Blocker / Decision:** None.

#### C07: Finish Ask, export and polish {#c07-finish-ask-export-and-polish}
- **Owner:** C / Product
- **Plain-Language Outcome:** Complete the Ask workflow tab, add Copy Report and Download JSON export actions, implement token trace viewer, and conduct full WCAG AA accessibility audit.
- **Planned Date:** Nov 12, 2026 IST
- **Status:** TODO
- **Phase & Gate Contribution:** Phase 3 product completion deliverable; completes Gate G3 when paired with B07.
- **Canonical Design References:** [docs/PRODUCT.md §2, §5](docs/PRODUCT.md), [CONTRIBUTING.md §2](CONTRIBUTING.md).
- **Allowed Scope & Expected Files:** `src/components/AskFlow.tsx` (proposed), `src/components/ExportReport.tsx` (proposed), `src/components/TraceViewer.tsx` (proposed), `tests/e2e/ask-export.spec.ts` (proposed).
- **Atomic Implementation Checklist:**
  - [ ] Complete Ask workflow: user asks question $\to$ Bifrost drafts initial answer $	o$ verifier runs.
  - [ ] Add "Copy Report" and "Download JSON" export actions using public report schema.
  - [ ] Add collapsible trace viewer displaying Tavily query count and Bifrost model profile.
  - [ ] Perform WCAG AA accessibility audit (contrast, aria-live regions, focus rings).
- **Prerequisites:**
  - **Start Prerequisites:** B06, C03, C04, C05, C06.
  - **Integration / Completion Prerequisites:** None.
  - **External Prerequisites:** None.
  - **What Can Start Early:** Export formatting logic, accessibility audit checklist, and trace viewer layout.
- **Deliverable & Interface Handoff:** Handed downstream to C08 and B08; satisfies Gate G3 product completion requirement.
- **Positive Acceptance Examples:** Ask flow shares identical verification workspace as Paste flow; exported JSON contains zero private tokens or secrets.
- **Relevant Negative / Failure Cases:** Keyboard tab navigation reaches all controls without trapping focus; screen reader announces live DAG progress updates.
- **Verification Commands & Checks:** `pnpm playwright test tests/e2e/ask-export.spec.ts`.
- **Evidence Level & Required Proof:** E2 (Playwright e2e test suite).
- **Observed Evidence:** *Pending execution*
- **Explicit Exclusions:** Video walkthrough recording (owned by C08).
- **Blocker / Decision:** None.

---

### Phase 4: Evaluation, Hardening & Submission (Nov 13–15, 2026 IST)

#### A09: Run baseline, full verifier evaluation and regressions {#a09-run-baseline-full-pipeline-and-regressions}
- **Owner:** A / Verification
- **Plain-Language Outcome:** Execute benchmark evaluation comparing Afterfact against naive LLM baseline on 30 frozen cases, calculate metrics (paired accuracy, false reassurance < 5%, decisive coverage), and document findings.
- **Planned Date:** Nov 13, 2026 IST
- **Status:** TODO
- **Phase & Gate Contribution:** Core Phase 4 evaluation deliverable; mandatory prerequisite for Gate G4.
- **Canonical Design References:** [docs/TESTING-AND-EVALUATION.md §4, §5](docs/TESTING-AND-EVALUATION.md).
- **Allowed Scope & Expected Files:** `eval/run-benchmark.ts` (proposed), `docs/BENCHMARK-RESULTS.md` (proposed).
- **Atomic Implementation Checklist:**
  - [ ] Implement evaluation harness executing baseline system (evaluator model + single Tavily search).
  - [ ] Execute full Afterfact verification engine across all 30 cases (20 dev + 10 held-out).
  - [ ] Calculate paired accuracy, false reassurance rate, decisive coverage, and p50/p95 latency.
  - [ ] Document at least 1 observed failure case with root cause analysis.
- **Prerequisites:**
  - **Start Prerequisites:** A07, A08, B06.
  - **Integration / Completion Prerequisites:** None.
  - **External Prerequisites:** Active Tavily and Bifrost model provider credits.
  - **What Can Start Early:** Eval harness scaffolding, metric calculation formulas, and markdown report generator.
- **Deliverable & Interface Handoff:** Handed downstream to C08 for walkthrough presentation.
- **Positive Acceptance Examples:** Full Afterfact pipeline achieves false reassurance rate $< 5\%$ on held-out split, outperforming baseline on paired context cases.
- **Relevant Negative / Failure Cases:** Any failure case is documented honestly with root-cause analysis; no fabricated statistics.
- **Verification Commands & Checks:** `pnpm tsx eval/run-benchmark.ts`.
- **Evidence Level & Required Proof:** E4 (Evaluation script execution output against live staging environment).
- **Observed Evidence:** *Pending execution*
- **Explicit Exclusions:** Prompt tuning on the held-out split (strictly forbidden).
- **Blocker / Decision:** None.

#### B08: Deploy production and verify fallbacks {#b08-deploy-production-and-verify-fallbacks}
- **Owner:** B / Platform
- **Plain-Language Outcome:** Apply production database migrations, deploy Next.js application to Vercel on custom domain, secure Bifrost behind HTTPS, and verify automated model fallback failover.
- **Planned Date:** Nov 13, 2026 IST
- **Status:** TODO
- **Phase & Gate Contribution:** Core Phase 4 platform release deliverable; mandatory prerequisite for Gate G4.
- **Canonical Design References:** [docs/SETUP-AND-DEPLOYMENT.md §5](docs/SETUP-AND-DEPLOYMENT.md), [docs/ARCHITECTURE.md §2](docs/ARCHITECTURE.md).
- **Allowed Scope & Expected Files:** `infra/production.env` (proposed), `infra/smoke-production.ts` (proposed).
- **Atomic Implementation Checklist:**
  - [ ] Apply final Prisma migrations to Neon production database (`pnpm prisma migrate deploy`).
  - [ ] Deploy production Next.js application to Vercel on custom domain.
  - [ ] Point production QStash topic to live domain and enable recurring reconciliation schedule.
  - [ ] Perform live smoke test with mixed-domain answer on fresh browser session.
  - [ ] Test Bifrost primary model failure failover to fallback profile.
- **Prerequisites:**
  - **Start Prerequisites:** B07, C07.
  - **Integration / Completion Prerequisites:** None.
  - **External Prerequisites:** Production Vercel domain, DNS records, HTTPS reverse proxy for Bifrost.
  - **What Can Start Early:** Production configuration audit, SSH tunnel setup, and deployment runbooks.
- **Deliverable & Interface Handoff:** Handed downstream to C08 and C09; completes Gate G4 platform requirement.
- **Positive Acceptance Examples:** Production URL loads with HTTPS; end-to-end verification succeeds on fresh unauthenticated device.
- **Relevant Negative / Failure Cases:** Primary provider outage transparently routes to secondary fallback without user error.
- **Verification Commands & Checks:** `pnpm tsx infra/smoke-production.ts`.
- **Evidence Level & Required Proof:** E5 (Production live verification trace).
- **Observed Evidence:** *Pending execution*
- **Explicit Exclusions:** Hackathon portal submission packaging (owned by C09).
- **Blocker / Decision:** B confirms production domain DNS configuration.

#### C08: Run final product walkthrough and recording {#c08-run-the-final-product-walkthrough}
- **Owner:** C / Product
- **Plain-Language Outcome:** Execute 3-minute judge script on production domain, record high-resolution video walkthrough with voiceover, and author reproducible demonstration runbook.
- **Planned Date:** Nov 13–14, 2026 IST
- **Status:** TODO
- **Phase & Gate Contribution:** Phase 4 demonstration deliverable; mandatory prerequisite for Gate G4.
- **Canonical Design References:** [docs/DEMO-AND-SUBMISSION.md §1, §2](docs/DEMO-AND-SUBMISSION.md).
- **Allowed Scope & Expected Files:** `public/demo.mp4` (proposed), `docs/WALKTHROUGH.md` (proposed).
- **Atomic Implementation Checklist:**
  - [ ] Execute 3-minute judge script on production domain.
  - [ ] Demonstrate: mixed live answer, clickable evidence, Then vs. Now, scheduled change badge, context compare, correction diff, and eval modal.
  - [ ] Record high-resolution screen demo with voiceover.
  - [ ] Capture verified replay mode fallback in case of live judging network failure.
- **Prerequisites:**
  - **Start Prerequisites:** C07, B08, A09.
  - **Integration / Completion Prerequisites:** None.
  - **External Prerequisites:** Screen recording software, microphone.
  - **What Can Start Early:** Script authoring, slide deck, demo outline, and walkthrough timing rehearsal.
- **Deliverable & Interface Handoff:** Handed downstream to C09 for portal submission.
- **Positive Acceptance Examples:** Independent builder can reproduce entire walkthrough following README; video length is under 3 minutes.
- **Relevant Negative / Failure Cases:** Live network failure falls back cleanly to `[REPLAY MODE]` banner without crashing demo.
- **Verification Commands & Checks:** Visual review of `public/demo.mp4` and execution of `docs/WALKTHROUGH.md`.
- **Evidence Level & Required Proof:** E5 (Completed video file and walkthrough transcript).
- **Observed Evidence:** *Pending execution*
- **Explicit Exclusions:** Hackathon portal form submission (owned by C09).
- **Blocker / Decision:** None.

#### C09: Package and submit {#c09-package-and-submit}
- **Owner:** C / Product
- **Plain-Language Outcome:** Verify public accessibility without login, package repository submission assets, complete hackathon platform entry, and archive submission confirmation receipt.
- **Planned Date:** Nov 14–15, 2026 IST
- **Status:** TODO
- **Phase & Gate Contribution:** Project terminal milestone; closes Gate G4 and completes project lifecycle.
- **Canonical Design References:** [docs/DEMO-AND-SUBMISSION.md §3](docs/DEMO-AND-SUBMISSION.md).
- **Allowed Scope & Expected Files:** Hackathon submission portal entry, `submission-receipt.png` (proposed).
- **Atomic Implementation Checklist:**
  - [ ] Verify public URL accessibility without authentication or team login.
  - [ ] Check repository completeness, license, and public visibility.
  - [ ] Assemble submission fields: public URL, video URL, GitHub link, benchmark summary, sponsor tags.
  - [ ] Submit before organizer cutoff time and archive confirmation receipt.
- **Prerequisites:**
  - **Start Prerequisites:** C08.
  - **Integration / Completion Prerequisites:** None.
  - **External Prerequisites:** Hackathon submission portal credentials.
  - **What Can Start Early:** Draft submission text, repository cleanup, and license audit.
- **Deliverable & Interface Handoff:** Project Complete.
- **Positive Acceptance Examples:** Submission receipt confirmed and stored in repository; judge link opens directly.
- **Relevant Negative / Failure Cases:** Submission blocked if repository contains private secrets or broken URLs.
- **Verification Commands & Checks:** Final URL smoke check and visual inspection of `submission-receipt.png`.
- **Evidence Level & Required Proof:** E5 (Official platform confirmation receipt).
- **Observed Evidence:** *Pending execution*
- **Explicit Exclusions:** Post-submission feature development.
- **Blocker / Decision:** Confirmation of official organizer cutoff deadline.

---

## 7. Comprehensive Evidence Log

| Date | Task ID | Command / Walkthrough | Environment | Observed Result | Link / Path |
| :---: | :---: | :--- | :---: | :--- | :--- |
| 2026-11-07 | DOC01 | `Select-String`, Markdown link validation, Git status check | Local Dev | All 14 markdown files created; `.gitignore` updated; link integrity verified; zero secrets exposed. | [DOC01](#doc01-repository-documentation) |
| 2026-11-08 | A01 | `pnpm test` (vitest run `tests/unit/contracts/request-claim.test.ts`) | Local Dev | 25/25 tests passing natively under repository toolchain. | [A01](#a01-request-and-claim-schemas) |
| 2026-11-08 | A02 | `pnpm test` (vitest run `tests/unit/contracts/report-fixture.test.ts`) | Local Dev | 30/30 tests passing natively under repository toolchain; full golden fixture validated. | [A02](#a02-report-and-event-schemas) |
| 2026-11-08 | B01 | `pnpm install --frozen-lockfile && pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm test:e2e` | Local Dev & Disposable Copy | All checks passed cleanly (0 lint/type errors, 147 vitest tests, production build 5/5 static pages, Prisma v6.19.3 verified). | [B01](#b01-scaffold-and-pin-the-toolchain) |
| 2026-11-08 | A10 | `pnpm vitest run tests/unit/contracts/dag-prep-contracts.test.ts && pnpm typecheck && pnpm lint && pnpm build` | Local Dev | 66/66 contract tests passing; 121/121 overall tests passing; 0 type errors; 0 lint errors/warnings; production build succeeded with 4/4 static pages. Merged into `main` via PR #8 & #9 (DONE). | [A10](#a10-define-preparation-clarification-and-dynamic-dag-schemas) |
| 2026-11-12 | B02 | `pnpm tsx infra/smoke-bifrost.ts` | Local Dev / Railway | Model profiles configured (`extract`, `assess`, `draft`, `fallback`); client fetch wrapper with automated fallback failover; smoke script verified. Merged in PR #17 (DONE). | [B02](#b02-provision-bifrost-and-model-profiles) |
| 2026-11-12 | B04a | `pnpm prisma migrate dev` | Neon Dev DB (`Apex1`) | Baseline migration `20261112004717_apex_hardik` executed against Neon; 11 tables created; Prisma client singleton and initial services implemented. Merged in PR #18 (DONE). | [B04](#b04-migrate-the-data-model-and-wire-the-vertical-slice) |
| *Pending* | B04b | `pnpm vitest run tests/integration/dag-slice.test.ts` | Neon Dev DB | *Pending execution* | [B04](#b04-migrate-the-data-model-and-wire-the-vertical-slice) |
| 2026-11-09 | C01 | `pnpm test && pnpm typecheck && pnpm lint && pnpm build && pnpm test:e2e` | Local Dev | 131/131 unit tests passed; 0 type/lint errors; production build 5/5 static pages; 11/11 Playwright E2E tests passed; dark/light theme toggle, local validation demo, and responsive screenshots verified. | [C01](#c01-visual-tokens-and-component-states) |
| 2026-11-09 | C02 | `pnpm test && pnpm typecheck && pnpm lint && pnpm build && pnpm test:e2e` | Local Dev | 147/147 unit tests passed; 0 type/lint errors; 23/23 Playwright tests passed; input composer validation, span segmentation, honest replay labeling, and sample report experience verified. Accepted by user for documented scope. | [C02](#c02-input-and-report-skeleton) |
| 2026-11-12 | Gate G0 | Full build, migration, and fixture test suite | Local Dev & Cloud | Gate G0 passed: All contract schemas, Prisma DB baseline, Bifrost gateway, and UI fixture replay mode verified. | [Gate G0](#project-release-milestones) |
| 2026-11-12 | A03 | `pnpm vitest run tests/unit/verify/extract-claims.test.ts` & `pnpm test:live` | Local / Railway Bifrost | 32/32 unit tests passed (E2); 2/2 live integration tests passed (E4); compound decomposition, UTF-16 span math, scope precedence invariant (ADR-018), missing context reconciliation, execution-aware ID formula within VARCHAR(36), date normalization, and live Railway Bifrost gateway model extraction verified. (REVIEW). | [A03](#a03-extract-and-locate-atomic-claims) |
| 2026-11-13 | A04 | `pnpm test && pnpm typecheck && pnpm lint && pnpm build` | Local Dev / Railway Bifrost | 228/228 unit tests passed (E2); live Bifrost E4 integration passed; research planner query budgeting, quote grounding, fabricated header rejection, 1:1 duplicate assessment filtering, publication date fallback correction, and partial date precision verified. DONE. | [A04](#a04-assess-passages-against-a-claim) |
| *Pending* | A05 | `pnpm vitest run tests/unit/verify/decide.test.ts` | Local Dev | *Pending execution* | [A05](#a05-apply-deterministic-policy-and-score) |
| *Pending* | B03 | `pnpm vitest run tests/integration/tavily-live.test.ts` | Staging / External | *Pending execution* | [B03](#b03-search-extract-and-evidence-capture) |
| *Pending* | C03 | `pnpm playwright test tests/e2e/run-progress.spec.ts` | Local Dev | *Pending execution* | [C03](#c03-wire-real-runs-and-progress) |
| *Pending* | A06 | `pnpm vitest run tests/unit/policies/domain-policies.test.ts` | Local Dev | *Pending execution* | [A06](#a06-build-pricing-api-regulation-and-leadership-policies) |
| *Pending* | A11 | `pnpm vitest run tests/unit/verify/vector-ranker.test.ts` | Local Dev | *Pending execution* | [A11](#a11-explore-optional-vector-shortlisting-and-counter-hypothesis-experiments) |
| *Pending* | B05 | `pnpm vitest run tests/integration/dynamic-dag-recovery.test.ts` | Staging / QStash | *Pending execution* | [B05](#b05-implement-signed-delivery-leases-and-recovery) |
| *Pending* | C04 | `pnpm playwright test tests/e2e/evidence-inspection.spec.ts` | Local Dev | *Pending execution* | [C04](#c04-implement-evidence-inspection-screen) |
| *Pending* | A07 | `pnpm vitest run tests/unit/verify/transition-correction.test.ts` | Local Dev | *Pending execution* | [A07](#a07-derive-transitions-and-validate-corrections) |
| *Pending* | A08 | `pnpm vitest run tests/unit/eval/test-set.test.ts` | Local Dev | *Pending execution* | [A08](#a08-freeze-the-test-set-before-tuning) |
| *Pending* | B06 | `pnpm vitest run tests/integration/run-endpoints.test.ts` | Local Dev | *Pending execution* | [B06](#b06-implement-the-public-run-endpoints) |
| *Pending* | B07 | `pnpm tsx infra/smoke-staging.ts` | Vercel Staging | *Pending execution* | [B07](#b07-provision-staging-with-real-integrations) |
| *Pending* | C05 | `pnpm playwright test tests/e2e/timeline.spec.ts` | Local Dev | *Pending execution* | [C05](#c05-implement-then-vs-now-and-scheduled-changes) |
| *Pending* | C06 | `pnpm playwright test tests/e2e/compare-dag.spec.ts` | Local Dev | *Pending execution* | [C06](#c06-implement-compare-correction-and-recheck) |
| *Pending* | C07 | `pnpm playwright test tests/e2e/ask-export.spec.ts` | Local Dev | *Pending execution* | [C07](#c07-finish-ask-export-and-polish) |
| *Pending* | A09 | `pnpm tsx eval/run-benchmark.ts` | Staging / Eval | *Pending execution* | [A09](#a09-run-baseline-full-pipeline-and-regressions) |
| *Pending* | B08 | `pnpm tsx infra/smoke-production.ts` | Production | *Pending execution* | [B08](#b08-deploy-production-and-verify-fallbacks) |
| *Pending* | C08 | 3-minute video recording | Production | *Pending execution* | [C08](#c08-run-the-final-product-walkthrough) |
| *Pending* | C09 | Platform submission receipt | Production | *Pending execution* | [C09](#c09-package-and-submit) |
