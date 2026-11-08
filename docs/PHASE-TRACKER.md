# docs/PHASE-TRACKER.md — Master Phase Tracker & Issue Registry

This document serves as the **single source of truth** for all engineering tasks, release gates, lane ownership, and evidence logs for **Afterfact** (working name: Stale-Answer Detector).

---

## 1. Team Lanes & Ownership Protocol

Tasks are strictly assigned to one of three accountable builder lanes:
- **Lane A:** `A / Verification` — Schemas, claim extraction, passage assessment, date logic, domain policies, and evaluation benchmark.
- **Lane B:** `B / Platform` — Scaffolding, Neon PostgreSQL, Drizzle ORM, Bifrost model gateway, Tavily adapter, QStash jobs, API routes, and deployment.
- **Lane C:** `C / Product` — Visual design tokens, responsive UI components, split workspace, SSE client, timeline, compare drawer, and demo walkthrough.

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
| **Phase 0** (Nov 7–8) | [A01](#a01-request-and-claim-schemas)<br>[A02](#a02-report-and-event-schemas) | [B01](#b01-scaffold-and-pin-the-toolchain)<br>[B02](#b02-provision-bifrost-and-model-profiles) | [C01](#c01-visual-tokens-and-component-states)<br>[C02](#c02-input-and-report-skeleton) | **G0** (Foundation Gate) |
| **Phase 1** (Nov 8–9) | [A03](#a03-extract-and-locate-atomic-claims)<br>[A04](#a04-assess-passages-against-a-claim)<br>[A05](#a05-apply-deterministic-policy-and-score) | [B03](#b03-search-extract-and-evidence-capture)<br>[B04](#b04-migrate-the-data-model-and-wire-the-vertical-slice) | [C03](#c03-wire-real-runs-and-progress) | **G1** (Live Slice Gate) |
| **Phase 2** (Nov 9–11) | [A06](#a06-build-pricing-api-regulation-and-leadership-policies) | [B05](#b05-implement-signed-delivery-leases-and-recovery) | [C04](#c04-implement-evidence-inspection-screen) | **G2** (Broad Coverage & Durability Gate) |
| **Phase 3** (Nov 11–12) | [A07](#a07-derive-transitions-and-validate-corrections)<br>[A08](#a08-freeze-the-test-set-before-tuning) | [B06](#b06-implement-the-public-run-endpoints)<br>[B07](#b07-provision-staging-with-real-integrations) | [C05](#c05-implement-then-vs-now-and-scheduled-changes)<br>[C06](#c06-implement-compare-correction-and-recheck)<br>[C07](#c07-finish-ask-export-and-polish) | **G3** (Product Interactions Gate) |
| **Phase 4** (Nov 13–15) | [A09](#a09-run-baseline-full-pipeline-and-regressions) | [B08](#b08-deploy-production-and-verify-fallbacks) | [C08](#c08-run-the-final-product-walkthrough)<br>[C09](#c09-package-and-submit) | **G4** (Release Candidate Gate) |

---

## 3. Project Release Gates (G0–G4) vs. UPPR Gates (IPP-1–IPP-8)

### Project Release Milestones
- **Gate G0 (Foundation Checkpoint · Nov 8):** Shared fixture validates; app builds; Bifrost gateway smoke check passes; database migration executes; C renders fixture mode.
- **Gate G1 (Live Slice Checkpoint · Nov 9):** Normal Paste screen verifies 1 real claim through Bifrost and Tavily. Claim links to an exact quoted evidence excerpt.
- **Gate G2 (Broad Coverage & Durability · Nov 11):** One mixed answer verifies claims across all 4 categories. Partial results survive a failed claim and page refresh.
- **Gate G3 (Product Flows & Staging · Nov 12):** Ask, Compare, Then vs. Now, Scheduled change badges, and Recheck execute on staging via normal user entry points.
- **Gate G4 (Production Candidate & Cutoff · Nov 14–15):** Release candidate passes benchmark evaluation and production checklist. Nov 15 is submission buffer (subject to confirmed organizer cutoff).

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

## 4. Documentation Bootstrap Ticket

### DOC01: Repository Documentation and Architectural Baseline {#doc01-repository-documentation}
- **Owner:** Repository Documentation Maintainer / Planning Lead
- **Planned Date:** Nov 7, 2026 IST
- **Dependencies:** None
- **Status:** DONE
- **Deliverable & Files:**
  - Existing files: [README.md](file:///C:/Users/Mayur/Desktop/Afterfact/README.md), [.gitignore](file:///C:/Users/Mayur/Desktop/Afterfact/.gitignore)
  - Created files: [AGENTS.md](file:///C:/Users/Mayur/Desktop/Afterfact/AGENTS.md), [CONTRIBUTING.md](file:///C:/Users/Mayur/Desktop/Afterfact/CONTRIBUTING.md), [docs/PRODUCT.md](file:///C:/Users/Mayur/Desktop/Afterfact/docs/PRODUCT.md), [docs/ARCHITECTURE.md](file:///C:/Users/Mayur/Desktop/Afterfact/docs/ARCHITECTURE.md), [docs/VERIFICATION.md](file:///C:/Users/Mayur/Desktop/Afterfact/docs/VERIFICATION.md), [docs/API.md](file:///C:/Users/Mayur/Desktop/Afterfact/docs/API.md), [docs/DATA-AND-JOBS.md](file:///C:/Users/Mayur/Desktop/Afterfact/docs/DATA-AND-JOBS.md), [docs/SETUP-AND-DEPLOYMENT.md](file:///C:/Users/Mayur/Desktop/Afterfact/docs/SETUP-AND-DEPLOYMENT.md), [docs/TESTING-AND-EVALUATION.md](file:///C:/Users/Mayur/Desktop/Afterfact/docs/TESTING-AND-EVALUATION.md), [docs/DEMO-AND-SUBMISSION.md](file:///C:/Users/Mayur/Desktop/Afterfact/docs/DEMO-AND-SUBMISSION.md), [docs/DECISIONS.md](file:///C:/Users/Mayur/Desktop/Afterfact/docs/DECISIONS.md), [docs/PHASE-TRACKER.md](file:///C:/Users/Mayur/Desktop/Afterfact/docs/PHASE-TRACKER.md), [.github/PULL_REQUEST_TEMPLATE.md](file:///C:/Users/Mayur/Desktop/Afterfact/.github/PULL_REQUEST_TEMPLATE.md)
- **Atomic Steps:**
  - [x] Inspect workspace root, git branch, and status.
  - [x] Ingest and analyze `pp.md` (UPPR Rev 4) and `stale-answer-detector-implementation-plan.pdf`.
  - [x] Add `pp.md` and `stale-answer-detector-implementation-plan.pdf` to `.gitignore`.
  - [x] Author comprehensive 14-document baseline documentation set.
  - [x] Cross-link documents using relative paths and verify all anchors resolve without dead links.
  - [x] Verify zero credential leakage and zero unwanted file modifications.
- **Acceptance Criteria:**
  - All 14 required documentation files exist and pass link resolution.
  - All 26 implementation tasks (A01–A09, B01–B08, C01–C09) are uniquely defined with DAG dependency integrity.
  - Negative check: Git status shows only documentation edits and `.gitignore` updates.
- **Evidence Level & Entry Point:** E1 (Static analysis of Markdown links and file existence).
- **Evidence:** 14 documentation files written, `.gitignore` updated, link validation check passed.
- **Handoff:** Unblocks Lane B to start Task B01 and Lane A to start Task A01.
- **Blocker / Decision:** Branding is undecided; working name is Stale-Answer Detector (Afterfact).

---

## 5. Detailed Ticket Registry (A01–A09, B01–B08, C01–C09)

---

### Phase 0: Foundation (Nov 7–8, 2026 IST)

#### A01: Define request and claim schemas {#a01-request-and-claim-schemas}
- **Owner:** A / Verification
- **Planned Date:** Nov 8, 2026
- **Dependencies:** B01 (scaffold)
- **Status:** REVIEW
- **Deliverable & Files:** [src/lib/contracts/dates.ts](file:///C:/Users/Mayur/Desktop/Afterfact/src/lib/contracts/dates.ts), [src/lib/contracts/request.ts](file:///C:/Users/Mayur/Desktop/Afterfact/src/lib/contracts/request.ts), [src/lib/contracts/claim.ts](file:///C:/Users/Mayur/Desktop/Afterfact/src/lib/contracts/claim.ts), [tests/unit/contracts/request-claim.test.ts](file:///C:/Users/Mayur/Desktop/Afterfact/tests/unit/contracts/request-claim.test.ts)
- **Atomic Steps:**
  - [x] Define Zod schema for paste request (up to 8,000 characters, optional originalQuestion, context object).
  - [x] Define Zod schema for ask request (up to 800 characters, question, context object).
  - [x] Define Zod tagged union for request input (`mode: 'paste' | 'ask'`).
  - [x] Define Zod schema for atomic claim spec (entity, attribute, assertedValue, timeSensitivity, UTF-16 span offsets).
  - [x] Implement span validation helper ensuring `answer.slice(span.start, span.end) === claim.rawText`.
- **Acceptance Criteria:**
  - Whitespace-only input fails validation (`400 Bad Request`).
  - Extracted UTF-16 spans match unmodified input slice exactly.
  - Explicit scope stated in text is stored independently of requested search context.
- **Evidence Level & Entry Point:** E2 (vitest test suite: `tests/unit/contracts/request-claim.test.ts`).
- **Evidence:** Verified natively via repository Vitest suite (`pnpm test`, 25 tests passing in `tests/unit/contracts/request-claim.test.ts`: strict wrong-mode rejection, 8000/800 character limits, complete calendar dates, non-trimmed raw text, UTF-16 emoji offset, fractional/empty/inverted/negative bounds checks, diagnostic text privacy). B01 toolchain prerequisite now resolved.
- **Handoff:** Downstream to A02 (report/event schemas) and C01/C02 (UI component types).
- **Blocker / Decision:** None (B01 toolchain scaffold landed; native `pnpm test` and `pnpm typecheck` passing).

#### A02: Define report and event schemas and create shared fixture {#a02-report-and-event-schemas}
- **Owner:** A / Verification
- **Planned Date:** Nov 8, 2026
- **Dependencies:** A01
- **Status:** REVIEW
- **Deliverable & Files:** [src/lib/contracts/evidence.ts](file:///C:/Users/Mayur/Desktop/Afterfact/src/lib/contracts/evidence.ts), [src/lib/contracts/report.ts](file:///C:/Users/Mayur/Desktop/Afterfact/src/lib/contracts/report.ts), [src/lib/contracts/events.ts](file:///C:/Users/Mayur/Desktop/Afterfact/src/lib/contracts/events.ts), [fixtures/golden-mixed-report.json](file:///C:/Users/Mayur/Desktop/Afterfact/fixtures/golden-mixed-report.json), [tests/unit/contracts/report-fixture.test.ts](file:///C:/Users/Mayur/Desktop/Afterfact/tests/unit/contracts/report-fixture.test.ts)
- **Atomic Steps:**
  - [x] Define Zod schema for evidence metadata (url, title, publisher, passage, retrievedAt, publicationDate, effectiveDate).
  - [x] Define Zod schema for claim result (verdict enum, score heuristic, scoreReason, reasonCode, timeline, correction).
  - [x] Define discriminated union for SSE progress events (`run_started`, `claims_identified`, `claim_result`, `claim_failed`, `run_finished`).
  - [x] Construct `fixtures/golden-mixed-report.json` covering pricing, API, regulation, and leadership, including at least 1 future-effective event and 1 unknown/unresolved claim.
- **Acceptance Criteria:**
  - Golden fixture passes validation against Zod report schema without errors.
  - UI imports types from the exact same schema files that API route handlers validate.
- **Evidence Level & Entry Point:** E2 (vitest test suite: `tests/unit/contracts/report-fixture.test.ts`).
- **Evidence:** Verified natively via repository Vitest suite (`pnpm test`, 30 tests passing in `tests/unit/contracts/report-fixture.test.ts`: full golden fixture validation; supported 100/75 accepted, supported 42 rejected at both report and event boundaries; outdated 0 accepted, outdated null rejected at both boundaries; unresolved null with machine reason accepted, numeric scores rejected; INV-01 claimId uniqueness; INV-02 Ask answerText and highlight span bounds; INV-03 timezone offsets; INV-04 summary counter parity). B01 toolchain prerequisite now resolved.
- **Handoff:** Downstream to C01/C02 (design tokens & report skeleton) and B03/B04 (Tavily adapter & DB migrations).
- **Blocker / Decision:** None (B01 toolchain scaffold landed; native `pnpm test` and `pnpm typecheck` passing).

#### B01: Scaffold and pin the toolchain {#b01-scaffold-and-pin-the-toolchain}
- **Owner:** B / Platform
- **Planned Date:** Nov 8, 2026
- **Dependencies:** None
- **Status:** REVIEW
- **Deliverable & Files:** [package.json](package.json), [pnpm-lock.yaml](pnpm-lock.yaml), [pnpm-workspace.yaml](pnpm-workspace.yaml), [.nvmrc](.nvmrc), [tsconfig.json](tsconfig.json), [next.config.ts](next.config.ts), [postcss.config.mjs](postcss.config.mjs), [tailwind.config.ts](tailwind.config.ts), [eslint.config.mjs](eslint.config.mjs), [vitest.config.ts](vitest.config.ts), [playwright.config.ts](playwright.config.ts), [.github/workflows/ci.yml](.github/workflows/ci.yml), [.env.example](.env.example), [src/app/layout.tsx](src/app/layout.tsx), [src/app/page.tsx](src/app/page.tsx), [src/app/globals.css](src/app/globals.css), [tests/e2e/smoke.spec.ts](tests/e2e/smoke.spec.ts)
- **Atomic Steps:**
  - [x] Initialize Next.js 15 App Router with TypeScript, Tailwind CSS, ESLint, `src/` directory, and `@/*` alias.
  - [x] Pin Node 22 in `.nvmrc` and pnpm in `packageManager` field of `package.json`.
  - [x] Install dependencies: `zod`, `drizzle-orm`, `pg`, `@upstash/qstash`.
  - [x] Install dev dependencies: `drizzle-kit`, `@types/pg`, `vitest`, `@playwright/test`, `tsx`.
  - [x] Configure GitHub Actions CI workflow for lint, typecheck, unit test, and build with frozen lockfile.
- **Acceptance Criteria:**
  - Clean clone executes `pnpm install`, `pnpm dev`, `pnpm typecheck`, `pnpm test`, and `pnpm build` without errors.
  - Negative check: CI fails if dependencies are added without updating lockfile.
- **Evidence Level & Entry Point:** E1 (Static analysis & build), E2 (Vitest unit tests), E5 (Playwright Chromium browser smoke test).
- **Evidence:** Next.js 15.5.29 App Router scaffolded on Node 22.18.0 / pnpm 11.9.0 with TypeScript strict mode, Tailwind CSS v3, and ESLint flat config. All scripts verified locally: `pnpm install --frozen-lockfile` (1.5s), `pnpm lint` (0 errors, 0 warnings), `pnpm typecheck` (0 errors), `pnpm test` (55/55 tests passing across 2 suites), `pnpm build` (compiled in 11.5s, 4 static pages generated), and `pnpm test:e2e` (Playwright Chromium smoke test passed). Clean installation and build independently validated in disposable working copy. GitHub Actions CI workflow authored at `.github/workflows/ci.yml`.
- **Handoff:** Unblocks A01, B02, and C01.
- **Blocker / Decision:** None.

#### B02: Configure Bifrost and smoke-test model profiles {#b02-provision-bifrost-and-model-profiles}
- **Owner:** B / Platform
- **Planned Date:** Nov 8, 2026
- **Dependencies:** B01
- **Status:** TODO
- **Deliverable & Files:** `docker-compose.yml` (proposed), `src/server/bifrost/client.ts` (proposed), `src/server/bifrost/profiles.ts` (proposed)
- **Atomic Steps:**
  - [ ] Create `docker-compose.yml` for Bifrost container pinning tested tag, bound to `127.0.0.1:8080`.
  - [ ] Configure model profiles: `BIFROST_EXTRACT_MODEL`, `BIFROST_ASSESS_MODEL`, `BIFROST_DRAFT_MODEL`, and `BIFROST_ASSESS_FALLBACK`.
  - [ ] Implement server client in `bifrost/client.ts` using `fetch` with AbortSignal, auth headers, and typed error handling.
  - [ ] Execute smoke test verifying inference call on each profile.
- **Acceptance Criteria:**
  - One test request per profile returns valid response with `x-request-id` and served model metadata.
  - No provider API keys exist in client bundles or public git repository.
- **Evidence Level & Entry Point:** E3 (Integration script: `pnpm tsx infra/smoke-bifrost.ts`).
- **Evidence:** *Pending execution*
- **Handoff:** Downstream to A03 (claim extraction) and B04 (vertical slice).
- **Blocker / Decision:** B confirms access to Docker host and two compatible model providers.

#### C01: Set visual tokens and component states {#c01-visual-tokens-and-component-states}
- **Owner:** C / Product
- **Planned Date:** Nov 8, 2026
- **Dependencies:** A02 draft (or A01)
- **Status:** TODO
- **Deliverable & Files:** `src/app/globals.css` (proposed), `tailwind.config.ts` (proposed)
- **Atomic Steps:**
  - [ ] Configure Tailwind color tokens: Ink (`#182431`), Paper (`#FAFBF8`), Panel (`#FFFFFF`), Line (`#DFE7E3`), Accent (`#006F63`).
  - [ ] Set typography fonts: Geist for UI body, Geist Mono for codes, URLs, and date metadata.
  - [ ] Define spacing tokens (4/8/12/16/24/32 px), 12px border radius, and accessible `:focus-visible` outlines.
  - [ ] Define styling states for normal, hover, focused, disabled, loading, and reduced-motion.
- **Acceptance Criteria:**
  - Verdict chips render with distinct text labels in addition to colors (accessible for colorblindness).
  - Reduced-motion media query disables animations.
- **Evidence Level & Entry Point:** E1 (CSS linter and Playwright screenshot test).
- **Evidence:** *Pending execution*
- **Handoff:** Downstream to C02 (input & report skeleton).
- **Blocker / Decision:** None.

#### C02: Implement input and report skeleton {#c02-input-and-report-skeleton}
- **Owner:** C / Product
- **Planned Date:** Nov 8, 2026
- **Dependencies:** C01, A02
- **Status:** TODO
- **Deliverable & Files:** `src/components/InputComposer.tsx` (proposed), `src/components/ContextFields.tsx` (proposed), `src/components/AnswerDocument.tsx` (proposed), `src/components/ReportSkeleton.tsx` (proposed)
- **Atomic Steps:**
  - [ ] Build `InputComposer` with Paste (default) and Ask tabs, character count, and sample picker.
  - [ ] Implement expandable `ContextFields` drawer for optional target date, jurisdiction, and version.
  - [ ] Build `AnswerDocument` to render source text with highlight placeholder spans.
  - [ ] Build `ReportSkeleton` with loading shimmer states and visible `[REPLAY MODE]` banner support.
- **Acceptance Criteria:**
  - Full keyboard accessibility: tab navigation reaches all mode controls and submit button.
  - Fixture preview is prominently labeled; long inputs (8,000 chars) render without page overflow.
- **Evidence Level & Entry Point:** E2 (Playwright component test: `tests/e2e/input-composer.spec.ts`).
- **Evidence:** *Pending execution*
- **Handoff:** Completes Gate G0 when paired with B01, B02, and A02; unblocks C03.
- **Blocker / Decision:** None.

---

### Phase 1: Live Slice (Nov 8–9, 2026 IST)

#### A03: Extract and locate atomic claims {#a03-extract-and-locate-atomic-claims}
- **Owner:** A / Verification
- **Planned Date:** Nov 9, 2026
- **Dependencies:** A01, A02, B02
- **Status:** TODO
- **Deliverable & Files:** `src/server/verify/extract-claims.ts` (proposed), `src/server/prompts/extract.ts` (proposed)
- **Atomic Steps:**
  - [ ] Author claim extraction system prompt requesting atomic claims, entities, attributes, asserted values, and explicit scopes.
  - [ ] Implement Bifrost structured extraction call parsing output into `ClaimSpec[]`.
  - [ ] Implement exact UTF-16 substring matching against input text.
  - [ ] Handle duplicate text occurrences using sentence offset disambiguation.
- **Acceptance Criteria:**
  - Compound statements split into distinct claims.
  - Highlighting does not alter the source text.
  - Negative check: Ambiguous spans that cannot be uniquely grounded fail highlight creation but keep the claim text.
- **Evidence Level & Entry Point:** E2 (vitest test suite: `tests/unit/verify/extract-claims.test.ts`).
- **Evidence:** *Pending execution*
- **Handoff:** Downstream to A04 (passage assessment) and B04 (vertical slice).
- **Blocker / Decision:** None.

#### A04: Assess passages against a claim {#a04-assess-passages-against-a-claim}
- **Owner:** A / Verification
- **Planned Date:** Nov 9, 2026
- **Dependencies:** A03, B03
- **Status:** TODO
- **Deliverable & Files:** `src/server/verify/assess-evidence.ts` (proposed), `src/server/prompts/assess.ts` (proposed)
- **Atomic Steps:**
  - [ ] Author passage assessment prompt sending only claim spec, normalized scope, target time, and numbered passages.
  - [ ] Require model to return matching excerpt span, scope classification, temporal applicability, and relation (`supports`, `contradicts`, `insufficient`).
  - [ ] Validate that cited text exists verbatim in the provided passage.
  - [ ] Implement single retry on malformed JSON output within worker budget.
- **Acceptance Criteria:**
  - An invented quote fails validation and is discarded.
  - Evidence with mismatching year, currency, or jurisdiction is classified as wrong-scope.
- **Evidence Level & Entry Point:** E2 (vitest test suite: `tests/unit/verify/assess-evidence.test.ts`).
- **Evidence:** *Pending execution*
- **Handoff:** Downstream to A05 (policy & scoring).
- **Blocker / Decision:** None.

#### A05: Apply deterministic policy and score {#a05-apply-deterministic-policy-and-score}
- **Owner:** A / Verification
- **Planned Date:** Nov 9, 2026
- **Dependencies:** A04
- **Status:** TODO
- **Deliverable & Files:** `src/server/verify/decide.ts` (proposed)
- **Atomic Steps:**
  - [ ] Filter candidate passages by scope compatibility.
  - [ ] Evaluate `depends_on_context` if scope is essential and undetermined.
  - [ ] Evaluate `conflicting_evidence` if credible passages from the same period conflict.
  - [ ] Determine `outdated` only when both prior validity and superseding change are proven.
  - [ ] Assign deterministic score: 100 (direct authoritative), 75 (indirect credible), 0 (contradiction), `null` (unresolved).
- **Acceptance Criteria:**
  - Direct authoritative support yields score 100.
  - Decisive contradiction yields score 0.
  - Outdated claims lacking proof of prior validity are marked contradicted, not outdated.
- **Evidence Level & Entry Point:** E2 (vitest test suite: `tests/unit/verify/decide.test.ts`).
- **Evidence:** *Pending execution*
- **Handoff:** Downstream to A06 (domain policies), B04 (vertical slice), and C04.
- **Blocker / Decision:** None.

#### B03: Implement search, extract and evidence capture {#b03-search-extract-and-evidence-capture}
- **Owner:** B / Platform
- **Planned Date:** Nov 9, 2026
- **Dependencies:** A01, A02
- **Status:** TODO
- **Deliverable & Files:** `src/server/tavily/client.ts` (proposed), `src/server/tavily/queries.ts` (proposed)
- **Atomic Steps:**
  - [ ] Implement Tavily API client with Bearer auth for `POST /search` and `POST /extract`.
  - [ ] Implement query generator producing current-state query and historical/change query from claim attributes.
  - [ ] Execute search retrieving up to 4 hits, filter by trusted domains, and extract top 3 URLs.
  - [ ] Sanitize raw HTML passages into clean text bounded by worker prompt budget.
- **Acceptance Criteria:**
  - Search and extract metadata captured on live test run.
  - Retains exact excerpts and source URL query parameters (version anchors).
- **Evidence Level & Entry Point:** E4 (Staging integration test: `tests/integration/tavily-live.test.ts`).
- **Evidence:** *Pending execution*
- **Handoff:** Downstream to A04, B04, and A06.
- **Blocker / Decision:** B confirms active Tavily API key.

#### B04: Migrate data model and wire live vertical slice {#b04-migrate-the-data-model-and-wire-the-vertical-slice}
- **Owner:** B / Platform
- **Planned Date:** Nov 9, 2026
- **Dependencies:** A01, A02, B02, B03 (and A05 for live slice integration)
- **Status:** TODO
- **Deliverable & Files:** `src/server/db/schema.ts` (proposed), `src/server/db/client.ts` (proposed), `drizzle.config.ts` (proposed), `src/app/api/verify/route.ts` (proposed)
- **Atomic Steps:**
  - [ ] Define Drizzle relational tables: `runs`, `claims`, `evidence`, `events`, `jobs`.
  - [ ] Configure Neon database client with pooler URL for runtime and direct URL for migrations.
  - [ ] Run initial migration creating all tables, indexes, and foreign keys.
  - [ ] Wire bounded synchronous vertical slice behind `POST /api/verify` (Paste $\to$ Bifrost $\to$ Tavily $\to$ Bifrost $\to$ Report).
- **Acceptance Criteria:**
  - From fresh database, migrations run cleanly; submitting a live claim persists and returns report.
  - Gate G1 verified: Live claim links to an exact evidence excerpt.
- **Evidence Level & Entry Point:** E3 (Integration test: `tests/integration/vertical-slice.test.ts`).
- **Evidence:** *Pending execution*
- **Handoff:** Unblocks C03 and Gate G1.
- **Blocker / Decision:** B confirms Neon project credentials.

#### C03: Wire real runs and progress {#c03-wire-real-runs-and-progress}
- **Owner:** C / Product
- **Planned Date:** Nov 9, 2026
- **Dependencies:** C02, B04 (B06 for final SSE)
- **Status:** TODO
- **Deliverable & Files:** `src/hooks/useRun.ts` (proposed), `src/app/runs/[id]/page.tsx` (proposed)
- **Atomic Steps:**
  - [ ] Implement `useRun` hook managing submission, snapshot polling, and navigation to `/runs/[id]`.
  - [ ] Display step progress badges: "Drafting", "Identifying claims", "Checking sources", "Evaluating evidence".
  - [ ] Handle single-claim failure gracefully without clearing completed siblings.
- **Acceptance Criteria:**
  - Page refresh on `/runs/[id]` reloads the persisted state correctly.
  - Unresolved claims render with machine reason code instead of hanging.
- **Evidence Level & Entry Point:** E2 (Playwright browser test: `tests/e2e/run-progress.spec.ts`).
- **Evidence:** *Pending execution*
- **Handoff:** Completes Gate G1; unblocks C04.
- **Blocker / Decision:** None.

---

### Phase 2: Broad Coverage & Durability (Nov 9–11, 2026 IST)

#### A06: Build pricing, API, regulation and leadership policies {#a06-build-pricing-api-regulation-and-leadership-policies}
- **Owner:** A / Verification
- **Planned Date:** Nov 10, 2026
- **Dependencies:** A05, B03
- **Status:** TODO
- **Deliverable & Files:** `src/server/policies/index.ts` (proposed), `src/server/policies/pricing.ts` (proposed), `src/server/policies/api.ts` (proposed), `src/server/policies/regulation.ts` (proposed), `src/server/policies/leadership.ts` (proposed)
- **Atomic Steps:**
  - [ ] Build policy registry mapping extracted claim attributes to domain policies.
  - [ ] Implement `pricing.ts` (match tier, currency, billing commitment, tax terms).
  - [ ] Implement `api.ts` (match vendor, REST vs SDK, version string, deprecated vs removed).
  - [ ] Implement `regulation.ts` (match jurisdiction, covered group, effective date).
  - [ ] Implement `leadership.ts` (match entity, office, acting vs permanent, handover date).
- **Acceptance Criteria:**
  - One mixed answer successfully validates claims across all 4 domains.
  - Unsupported or ambiguous claims remain inspectable with reason codes.
- **Evidence Level & Entry Point:** E2 (vitest test suite: `tests/unit/policies/domain-policies.test.ts`).
- **Evidence:** *Pending execution*
- **Handoff:** Downstream to A07, A08, and B06.
- **Blocker / Decision:** None.

#### B05: Implement signed delivery, leases and recovery {#b05-implement-signed-delivery-leases-and-recovery}
- **Owner:** B / Platform
- **Planned Date:** Nov 10, 2026
- **Dependencies:** B04
- **Status:** TODO
- **Deliverable & Files:** `src/server/jobs/worker.ts` (proposed), `src/app/api/internal/jobs/route.ts` (proposed), `src/app/api/internal/reconcile/route.ts` (proposed)
- **Atomic Steps:**
  - [ ] Implement QStash webhook verification in `/api/internal/jobs` via `verifySignatureAppRouter`.
  - [ ] Implement atomic lease acquisition and fencing token (`leaseToken`, `leaseUntil = NOW() + 35s`).
  - [ ] Enforce QStash flow control capping concurrent claim jobs to 3.
  - [ ] Implement reconciliation route `/api/internal/reconcile` to recover expired leases and timed-out jobs.
- **Acceptance Criteria:**
  - Duplicate delivery of identical webhook cannot insert duplicate claim records.
  - Worker losing its lease fails closed upon completion attempt (`409 Conflict`).
- **Evidence Level & Entry Point:** E3 (Integration race test: `tests/integration/lease-fencing.test.ts`).
- **Evidence:** *Pending execution*
- **Handoff:** Downstream to B06, B07; completes Gate G2 platform requirement.
- **Blocker / Decision:** B confirms QStash project credentials and signing keys.

#### C04: Implement evidence inspection screen {#c04-implement-evidence-inspection-screen}
- **Owner:** C / Product
- **Planned Date:** Nov 10, 2026
- **Dependencies:** C03, A02
- **Status:** TODO
- **Deliverable & Files:** `src/components/ClaimMarker.tsx` (proposed), `src/components/ClaimSummary.tsx` (proposed), `src/components/VerdictChip.tsx` (proposed), `src/components/EvidenceCard.tsx` (proposed)
- **Atomic Steps:**
  - [ ] Build 55:45 desktop split screen (source text left, evidence inspector right).
  - [ ] Build responsive bottom sheet for mobile viewports (< 768px).
  - [ ] Implement `ClaimMarker` with click and keyboard focus handlers.
  - [ ] Implement `EvidenceCard` displaying publisher, publication date, effective date, exact excerpt, and outbound link.
- **Acceptance Criteria:**
  - Activating a claim highlights the claim and populates matching evidence cards.
  - Mobile layout at 360px viewport has zero horizontal scroll.
- **Evidence Level & Entry Point:** E2 (Playwright visual regression: `tests/e2e/evidence-inspection.spec.ts`).
- **Evidence:** *Pending execution*
- **Handoff:** Completes Gate G2; unblocks C05 and C06.
- **Blocker / Decision:** None.

---

### Phase 3: Product Interactions & Staging (Nov 11–12, 2026 IST)

#### A07: Derive transitions and validate corrections {#a07-derive-transitions-and-validate-corrections}
- **Owner:** A / Verification
- **Planned Date:** Nov 11, 2026
- **Dependencies:** A05, A06
- **Status:** TODO
- **Deliverable & Files:** `src/server/verify/transition.ts` (proposed), `src/server/verify/correction.ts` (proposed)
- **Atomic Steps:**
  - [ ] Implement chronology composer assembling then, transition, now, and upcoming timeline entries.
  - [ ] Separate announced date from effective date; flag future-effective changes with `Scheduled change`.
  - [ ] Implement surgical correction generator replacing only verified attributes.
  - [ ] Run verifier against replacement text; withhold correction if score < 100.
- **Acceptance Criteria:**
  - Future-effective event maintains today's valid verdict and attaches `Scheduled change` badge.
  - Withheld correction is marked `correction_unverified` rather than emitting speculative text.
- **Evidence Level & Entry Point:** E2 (vitest test suite: `tests/unit/verify/transition-correction.test.ts`).
- **Evidence:** *Pending execution*
- **Handoff:** Downstream to C05, C06, and A09.
- **Blocker / Decision:** None.

#### A08: Freeze test set before tuning {#a08-freeze-the-test-set-before-tuning}
- **Owner:** A / Verification
- **Planned Date:** Nov 12, 2026
- **Dependencies:** A02, A06
- **Status:** TODO
- **Deliverable & Files:** `eval/cases.jsonl` (proposed), `eval/schema.ts` (proposed)
- **Atomic Steps:**
  - [ ] Curate 30 claims across pricing, APIs, regulations, and leadership.
  - [ ] Include at least 3 context pairs per domain where changing one qualifier flips ground truth.
  - [ ] Include negative cases: fabricated values, wrong jurisdiction, future effective date, missing history.
  - [ ] Split dataset: 20 cases for dev tuning, 10 held-out cases reserved exclusively for final benchmark.
- **Acceptance Criteria:**
  - Dataset committed and frozen before prompt tuning begins.
  - Held-out cases remain uninspected during prompt modifications.
- **Evidence Level & Entry Point:** E1 (Static schema validation of `eval/cases.jsonl`).
- **Evidence:** *Pending execution*
- **Handoff:** Downstream to A09.
- **Blocker / Decision:** None.

#### B06: Implement public run endpoints and SSE {#b06-implement-the-public-run-endpoints}
- **Owner:** B / Platform
- **Planned Date:** Nov 11, 2026
- **Dependencies:** B04, B05, A06
- **Status:** TODO
- **Deliverable & Files:** `src/app/api/runs/[id]/route.ts` (proposed), `src/app/api/runs/[id]/events/route.ts` (proposed), `src/app/api/runs/[id]/compare/route.ts` (proposed), `src/app/api/runs/[id]/recheck/route.ts` (proposed)
- **Atomic Steps:**
  - [ ] Implement `GET /api/runs/[id]` snapshot route with `Cache-Control: no-store`.
  - [ ] Implement `GET /api/runs/[id]/events` SSE stream with sequence replay (`?afterSeq=N`).
  - [ ] Implement `POST /api/runs/[id]/compare` creating linked child run (`parentRunId`).
  - [ ] Implement `POST /api/runs/[id]/recheck` creating child run with fresh retrieval.
  - [ ] Enforce anonymous cookie ownership (`ownerHash`) across all routes.
- **Acceptance Criteria:**
  - SSE disconnect replays missed events from specified sequence number.
  - Request with unowned run ID returns `404 Not Found`.
- **Evidence Level & Entry Point:** E3 (Integration API test suite: `tests/integration/run-endpoints.test.ts`).
- **Evidence:** *Pending execution*
- **Handoff:** Downstream to C05, C06, C07, and B07.
- **Blocker / Decision:** None.

#### B07: Provision staging with real integrations {#b07-provision-staging-with-real-integrations}
- **Owner:** B / Platform
- **Planned Date:** Nov 12, 2026
- **Dependencies:** B05, B06
- **Status:** TODO
- **Deliverable & Files:** `infra/staging.env` (proposed), `infra/smoke-staging.ts` (proposed)
- **Atomic Steps:**
  - [ ] Deploy Next.js staging build to Vercel with dedicated staging environment variables.
  - [ ] Configure separate Neon staging database branch.
  - [ ] Configure QStash topic pointing to staging URL with webhook bypass token.
  - [ ] Run automated fault injection test verifying Bifrost fallback and lease recovery on staging.
- **Acceptance Criteria:**
  - Vercel staging deployment reaches Neon, Tavily, and Bifrost over TLS.
  - Signed background jobs complete end-to-end on staging domain.
- **Evidence Level & Entry Point:** E4 (Staging automated smoke run).
- **Evidence:** *Pending execution*
- **Handoff:** Completes Gate G3; unblocks B08.
- **Blocker / Decision:** B confirms Vercel staging deployment URL.

#### C05: Implement Then vs. Now and scheduled changes {#c05-implement-then-vs-now-and-scheduled-changes}
- **Owner:** C / Product
- **Planned Date:** Nov 11, 2026
- **Dependencies:** C04, A07
- **Status:** TODO
- **Deliverable & Files:** `src/components/ChangeTimeline.tsx` (proposed), `src/components/ScheduledChangeBadge.tsx` (proposed)
- **Atomic Steps:**
  - [ ] Build `ChangeTimeline` displaying historical state, transition event, current state, and upcoming changes.
  - [ ] Link each timeline entry directly to its supporting evidence passage.
  - [ ] Implement `ScheduledChangeBadge` for future-effective regulations or API deprecations.
  - [ ] Display honest fallback message when historical transitions are unverified.
- **Acceptance Criteria:**
  - Current fact with a future-effective event displays a distinct `Scheduled change` badge without marking the claim outdated.
- **Evidence Level & Entry Point:** E2 (Playwright component test: `tests/e2e/timeline.spec.ts`).
- **Evidence:** *Pending execution*
- **Handoff:** Downstream to C06.
- **Blocker / Decision:** None.

#### C06: Implement Compare, correction and Recheck {#c06-implement-compare-correction-and-recheck}
- **Owner:** C / Product
- **Planned Date:** Nov 11, 2026
- **Dependencies:** C04, C05, B06
- **Status:** TODO
- **Deliverable & Files:** `src/components/CompareDrawer.tsx` (proposed), `src/components/CorrectionDiff.tsx` (proposed)
- **Atomic Steps:**
  - [ ] Build `CompareDrawer` allowing user to change one context qualifier and trigger `POST /compare`.
  - [ ] Render side-by-side comparison cards for original context vs target context.
  - [ ] Build `CorrectionDiff` component rendering inline word diff with "Copy Correction" button.
  - [ ] Wire "Recheck Freshness" button to `POST /recheck` preserving original run reference.
- **Acceptance Criteria:**
  - Context comparison flips verdict on paired Stripe case without mutating original text.
  - Failed recheck retains previous completed report intact.
- **Evidence Level & Entry Point:** E2 (Playwright interaction test: `tests/e2e/compare-correction.spec.ts`).
- **Evidence:** *Pending execution*
- **Handoff:** Completes Gate G3; unblocks C07.
- **Blocker / Decision:** None.

#### C07: Finish Ask, export and polish {#c07-finish-ask-export-and-polish}
- **Owner:** C / Product
- **Planned Date:** Nov 12, 2026
- **Dependencies:** B06, C03, C04, C05, C06
- **Status:** TODO
- **Deliverable & Files:** `src/components/AskFlow.tsx` (proposed), `src/components/ExportReport.tsx` (proposed), `src/components/TraceViewer.tsx` (proposed)
- **Atomic Steps:**
  - [ ] Complete Ask workflow: user asks question $\to$ Bifrost drafts initial answer $\to$ verifier runs.
  - [ ] Add "Copy Report" and "Download JSON" export actions using public report schema.
  - [ ] Add collapsible trace viewer displaying Tavily query count and Bifrost model profile.
  - [ ] Perform WCAG AA accessibility audit (contrast, aria-live regions, focus rings).
- **Acceptance Criteria:**
  - Ask flow shares identical verification workspace as Paste flow.
  - Exported JSON contains zero private tokens, internal database IDs, or secrets.
- **Evidence Level & Entry Point:** E2 (Playwright e2e test suite: `tests/e2e/ask-export.spec.ts`).
- **Evidence:** *Pending execution*
- **Handoff:** Completes Gate G3; unblocks C08, B08.
- **Blocker / Decision:** None.

---

### Phase 4: Evaluation, Hardening & Submission (Nov 13–15, 2026 IST)

#### A09: Run baseline, full verifier evaluation and regressions {#a09-run-baseline-full-pipeline-and-regressions}
- **Owner:** A / Verification
- **Planned Date:** Nov 13, 2026
- **Dependencies:** A07, A08, B06
- **Status:** TODO
- **Deliverable & Files:** `eval/run-benchmark.ts` (proposed), `docs/BENCHMARK-RESULTS.md` (proposed)
- **Atomic Steps:**
  - [ ] Implement evaluation harness executing baseline system (evaluator model + single Tavily search).
  - [ ] Execute full Afterfact verification engine across all 30 cases (20 dev + 10 held-out).
  - [ ] Calculate paired accuracy, false reassurance rate, decisive coverage, and p50/p95 latency.
  - [ ] Document at least 1 observed failure case with root cause analysis.
- **Acceptance Criteria:**
  - Evaluation results logged with exact denominators; no fabricated statistics.
  - False reassurance rate on held-out split is strictly measured.
- **Evidence Level & Entry Point:** E4 (Evaluation script execution output).
- **Evidence:** *Pending execution*
- **Handoff:** Downstream to C08.
- **Blocker / Decision:** None.

#### B08: Deploy production and verify fallbacks {#b08-deploy-production-and-verify-fallbacks}
- **Owner:** B / Platform
- **Planned Date:** Nov 13, 2026
- **Dependencies:** B07, C07
- **Status:** TODO
- **Deliverable & Files:** `infra/production.env` (proposed), `infra/smoke-production.ts` (proposed)
- **Atomic Steps:**
  - [ ] Apply final Drizzle migrations to Neon production database.
  - [ ] Deploy production Next.js application to Vercel on custom domain.
  - [ ] Point production QStash topic to live domain and enable recurring reconciliation schedule.
  - [ ] Perform live smoke test with mixed-domain answer on fresh browser session.
- **Acceptance Criteria:**
  - Production URL loads with HTTPS; end-to-end verification succeeds on fresh device.
  - Previous Vercel build can be redeployed without database schema incompatibilities.
- **Evidence Level & Entry Point:** E5 (Production live verification trace).
- **Evidence:** *Pending execution*
- **Handoff:** Completes Gate G4; unblocks C08.
- **Blocker / Decision:** B confirms production domain DNS configuration.

#### C08: Run final product walkthrough and recording {#c08-run-the-final-product-walkthrough}
- **Owner:** C / Product
- **Planned Date:** Nov 13–14, 2026
- **Dependencies:** C07, B08, A09
- **Status:** TODO
- **Deliverable & Files:** `public/demo.mp4` (proposed), `docs/WALKTHROUGH.md` (proposed)
- **Atomic Steps:**
  - [ ] Execute 3-minute judge script on production domain.
  - [ ] Demonstrate: mixed live answer, clickable evidence, Then vs. Now, scheduled change badge, context compare, correction diff, and eval modal.
  - [ ] Record high-resolution screen demo with voiceover.
  - [ ] Capture verified replay mode fallback in case of live judging network failure.
- **Acceptance Criteria:**
  - Independent builder can reproduce entire walkthrough following README.
  - Video length is under 3 minutes and covers all sponsor requirements.
- **Evidence Level & Entry Point:** E5 (Completed video file and walkthrough transcript).
- **Evidence:** *Pending execution*
- **Handoff:** Downstream to C09.
- **Blocker / Decision:** None.

#### C09: Package and submit {#c09-package-and-submit}
- **Owner:** C / Product
- **Planned Date:** Nov 14–15, 2026
- **Dependencies:** C08
- **Status:** TODO
- **Deliverable & Files:** Hackathon submission portal entry, `submission-receipt.png` (proposed)
- **Atomic Steps:**
  - [ ] Verify public URL accessibility without authentication or team login.
  - [ ] Check repository completeness, license, and public visibility.
  - [ ] Assemble submission fields: public URL, video URL, GitHub link, benchmark summary, sponsor tags.
  - [ ] Submit before organizer cutoff time and archive confirmation receipt.
- **Acceptance Criteria:**
  - Submission receipt confirmed and stored in repository.
- **Evidence Level & Entry Point:** E5 (Official platform confirmation receipt).
- **Evidence:** *Pending execution*
- **Handoff:** Project Complete.
- **Blocker / Decision:** Confirmation of official organizer cutoff deadline.

---

## 6. Comprehensive Evidence Log

| Date | Task ID | Command / Walkthrough | Environment | Observed Result | Link / Path |
| :---: | :---: | :--- | :---: | :--- | :--- |
| 2026-11-07 | DOC01 | `Select-String`, Markdown link validation, Git status check | Local Dev | All 14 markdown files created; `.gitignore` updated; link integrity verified; zero secrets exposed. | [DOC01](#doc01-repository-documentation) |
| 2026-11-08 | A01 | `pnpm test` (vitest run `tests/unit/contracts/request-claim.test.ts`) | Local Dev | 25/25 tests passing natively under repository toolchain. | [A01](#a01-request-and-claim-schemas) |
| 2026-11-08 | A02 | `pnpm test` (vitest run `tests/unit/contracts/report-fixture.test.ts`) | Local Dev | 30/30 tests passing natively under repository toolchain; full golden fixture validated. | [A02](#a02-report-and-event-schemas) |
| 2026-11-08 | B01 | `pnpm install --frozen-lockfile && pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm test:e2e` | Local Dev & Disposable Copy | All 6 checks passed cleanly (0 lint/type errors, 55 vitest tests, production build 4/4 static pages, 1/1 Playwright Chromium smoke test). | [B01](#b01-scaffold-and-pin-the-toolchain) |
| *Pending* | B02 | `pnpm tsx infra/smoke-bifrost.ts` | Local Docker | *Pending execution* | [B02](#b02-provision-bifrost-and-model-profiles) |
| *Pending* | B04 | `pnpm vitest run tests/integration/vertical-slice.test.ts` | Neon Test DB | *Pending execution* | [B04](#b04-migrate-the-data-model-and-wire-the-vertical-slice) |
| *Pending* | B07 | `pnpm tsx infra/smoke-staging.ts` | Vercel Staging | *Pending execution* | [B07](#b07-provision-staging-with-real-integrations) |
| *Pending* | B08 | `pnpm tsx infra/smoke-production.ts` | Production | *Pending execution* | [B08](#b08-deploy-production-and-verify-fallbacks) |
| *Pending* | A09 | `pnpm tsx eval/run-benchmark.ts` | Staging / Eval | *Pending execution* | [A09](#a09-run-baseline-full-pipeline-and-regressions) |
| *Pending* | C08 | 3-minute video recording | Production | *Pending execution* | [C08](#c08-run-the-final-product-walkthrough) |
