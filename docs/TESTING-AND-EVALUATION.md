# docs/TESTING-AND-EVALUATION.md — Quality Gates, Invariant Proofs & Benchmark

This document establishes the verification matrix, integration proof protocol, test suites, and evaluation benchmark for **Afterfact** (working name: Stale-Answer Detector), applying **UPPR Revision 4** standards.

---

## 1. Five-Tier Evidence Taxonomy (E1–E5)

Every test, check, and pull request must declare its evidence tier:

| Level | Name | Scope & Authority | Test Mechanism |
| :---: | :--- | :--- | :--- |
| **E1** | **Static Verification** | Syntax correctness, types, schema shape validation. | `pnpm lint`, `pnpm typecheck`, Zod schema validation. |
| **E2** | **Unit & Logic Proof** | Deterministic business rules, date resolution, score calculation. | Vitest unit tests with frozen mock inputs. |
| **E3** | **Disposable Integration** | Relational transactions, lease CAS, foreign keys, outbox. | Neon Postgres test database / ephemeral containers. |
| **E4** | **Staging Sandbox** | Real cloud providers, QStash signed webhooks, Bifrost fallback. | Staging environment with live provider keys and webhooks. |
| **E5** | **Production Operations** | End-to-end user workflows on live web data. | Live site walkthrough, latency benchmarks, trace audits. |

---

## 2. Invariant-to-Proof Verification Chains (IPP Gates 1–8)

Every critical architectural invariant is mapped through the mandatory chain:  
$$\text{INVARIANT} \longrightarrow \text{ENTRY POINT} \longrightarrow \text{HANDLER} \longrightarrow \text{AUTHORITY} \longrightarrow \text{ENFORCEMENT} \longrightarrow \text{REQUIRED TEST} \longrightarrow \text{EVIDENCE}$$

| Invariant | Production Entry Point | Planned Handler | Authority | Concrete Enforcement | Required Test (Level) | Observed Evidence |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Unsupported Citation** | `POST /api/internal/jobs` (claim job) | `assess-evidence.ts` | Retrieved Tavily passages | Citation span must exist in retrieved raw text (`passage.includes(citation)`). | Unit test with injected hallucinated excerpt (E2). | Pending execution |
| **Wrong-Scope Evidence** | `POST /api/internal/jobs` (claim job) | `decide.ts` | Extracted claim scope | Passages with conflicting scope (e.g. UK vs US pricing, Python vs REST) cannot grant support. | Test with matching price but differing currency/region (E2). | Pending execution |
| **Future Effective Date** | `POST /api/internal/jobs` (claim job) | `transition.ts` | Temporal policy | If $T_{\text{effective}} > T_{\text{current}}$, maintain current verdict and attach `Scheduled change` badge. | Test regulation claim with future enforcement date (E2). | Pending execution |
| **No Past Proof** | `POST /api/internal/jobs` (claim job) | `decide.ts` | Temporal policy | Outdated verdict strictly requires verified evidence of both past validity and superseding change. | Test newer fact lacking proof of prior state $\to$ mark contradicted, not outdated (E2). | Pending execution |
| **Cross-Owner Access** | `GET /api/runs/{id}` | `runs/[id]/route.ts` | Cookie session | `WHERE id = $id AND ownerHash = $cookieHash`. Return 404 if mismatch. | API test querying run with different session cookie (E3). | Pending execution |
| **Duplicate Delivery** | `POST /api/internal/jobs` | `jobs/worker.ts` | PostgreSQL DB | Atomic CAS on `jobs.leaseToken` and `UNIQUE (runId, ordinal)`. | Race test dispatching identical webhook payload concurrently (E3). | Pending execution |
| **Stale Lease Commit** | `POST /api/internal/jobs` | `jobs/worker.ts` | PostgreSQL clock | Updates conditioned on `WHERE leaseToken = $token`. Fails if lease expired or stolen. | Test simulating 40s worker delay with lease stolen by daemon (E3). | Pending execution |
| **Partial Provider Failure** | `POST /api/internal/jobs` (claim job) | `bifrost/client.ts` | Bifrost Gateway | Fallback profile activated on primary timeout/error; sibling claims unaffected. | Mock primary LLM 500 $\to$ assert fallback succeeds and siblings pass (E4). | Pending execution |
| **SSE Reconnect** | `GET /api/runs/{id}/events` | `events/route.ts` | `events` table | Query `WHERE runId = $id AND seq > $afterSeq ORDER BY seq ASC`. | Test dropping connection and resuming with `?afterSeq=2` (E3). | Pending execution |

---

## 3. Frozen vs. Live Evidence Test Suites

1. **Frozen Replay Suite (`fixtures/replay-suite.json`):**
   - Contains 10 deterministic golden runs with pre-cached Tavily HTML passages and Bifrost model outputs.
   - Runs in CI without network connectivity or API credentials.
   - Validates that span matching, date comparison, and score rubrics never regress.
2. **Live Integration Suite (`eval/live-suite.ts`):**
   - Executes live web searches against fresh URLs using staging credentials (`E4`).
   - Verifies that real-world provider contracts (Tavily JSON formats, Bifrost latency, QStash signature headers) remain compatible.

---

## 4. Evaluation Benchmark Methodology

The verifier's epistemic performance is quantitatively benchmarked against a naive single-prompt LLM baseline:

- **Benchmark Dataset (`eval/cases.jsonl`):**
  - **Size:** 30 curated test claims across Pricing, APIs, Regulations, and Leadership.
  - **Holdout Split:** 20 development cases for prompt tuning; 10 held-out cases reserved exclusively for final evaluation (never seen during development).
  - **Context-Paired Cases:** At least 3 pairs per domain where changing one parameter (e.g. Stripe API version, annual vs monthly commitment) flips the ground truth verdict.
- **Baseline System:**
  - Evaluator model (`BIFROST_ASSESS_MODEL`) provided the claim, context, and the top 3 snippets from a single standard Tavily search query, prompted to output a verdict.
- **Metrics Evaluated:**
  - **Paired Accuracy:** Percentage of context pairs where both contexts are evaluated correctly.
  - **False Reassurance Rate:** Incorrect claims falsely labeled as `supported` divided by total gold incorrect claims. (Target: $< 5\%$).
  - **Decisive Coverage:** Percentage of claims receiving a decisive verdict (`supported`, `outdated`, `contradicted`) vs. abstaining (`null`).
  - **Latency (p50 / p95):** End-to-end wall-clock time from submission to terminal report.

---

## 5. Release Gate Checklist (G0–G4)

- [ ] **G0 (Foundation Gate):** Contract schemas validate; Next.js builds cleanly; Bifrost Docker smoke test passes; Drizzle migrations execute against Neon.
- [ ] **G1 (Live Slice Gate):** Real paste submission verifies at least 1 live claim end-to-end via Bifrost and Tavily; claim links to an exact quoted excerpt.
- [ ] **G2 (Coverage & Durability Gate):** Multi-claim answer covering all 4 domains verifies successfully; failed claim leaves completed siblings visible; refresh preserves state.
- [ ] **G3 (Product Flow Gate):** Ask question flow, Then vs. Now timeline, Scheduled change badge, Context comparison, and Live recheck function seamlessly on staging.
- [ ] **G4 (Release Candidate Gate):** Candidate passes frozen replay suite, live evaluation benchmark, mobile responsive check (360px), and production smoke test.
