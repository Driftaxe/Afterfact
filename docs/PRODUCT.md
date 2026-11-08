# docs/PRODUCT.md — Product Specification & Scope

Afterfact (working name: Stale-Answer Detector) is a real-time verification and drift detection engine for AI-generated answers. It transforms stale, outdated, or hallucinated LLM responses into auditable, evidence-backed reports with exact clickable citations, historical timelines, and surgical correction diffs.

---

## 1. Core User Journeys

### Journey 1: Verify Pasted AI Text (Default Flow)
1. User navigates to the application. The default active view is **Paste Answer**.
2. User pastes an AI-generated paragraph (up to 8,000 characters) and optionally provides the original prompt/question and base context parameters (target date, jurisdiction, currency, API version).
3. User clicks **Prepare Verification**. The browser executes `startPreparationAction`, which parses claims, highlights exact UTF-16 text spans, anchors explicit qualifiers (e.g. UK currency), and proposes inferred context suggestions.
4. The user reviews the prepared claims and qualifiers in the **Preparation Review** view:
   - User may adjust target context fields (e.g. set jurisdiction to US or select billing cycle).
   - *Scope Invariant:* Explicit qualifiers extracted from the claim text (e.g. *"In the UK, Stripe charges..."*) remain permanently anchored and are never overwritten by general target context.
   - If the user edits the input text, existing preparation is invalidated, requiring fresh extraction.
5. User clicks **Confirm & Verify**. The browser calls `confirmPreparationAction`, creates the run and initial DAG nodes in PostgreSQL, dispatches root tasks to QStash, and navigates to `/runs/[id]`.
6. The client opens an SSE connection (`GET /api/runs/[id]/events`), receiving live progress:
   - `run_started`
   - `claims_identified` (atomic claims highlighted in the source text)
   - `dag_progress` (node execution progress across claim branches)
   - `clarification_requested` (if ambiguity requires user input)
   - `claim_result` (individual claims resolve sequentially)
   - `run_finished` (final summary scores and verdict distribution)
7. If the SSE connection drops, the client reconnects with `?afterSeq=N` to replay missed events or falls back to polling `GET /api/runs/[id]` snapshot every 2 seconds.
8. User inspects individual claims in the split workspace (55:45 desktop layout), viewing exact quoted evidence passages, source links, and verdict badges.

### Journey 2: Ask a Question (Draft & Verify Flow)
1. User switches to the **Ask Question** tab.
2. User enters a query (up to 800 characters), e.g. *"What is Stripe's fee structure for US card payments?"* or *"Who is the CEO of Twitter / X?"*
3. User clicks **Draft & Prepare**. Bifrost generates a candidate answer using `BIFROST_DRAFT_MODEL`.
4. The drafted text is persisted in a preparation session and immediately presented in the **Preparation Review** screen.
5. User inspects the drafted text and extracted claims, modifies target qualifiers if desired, and confirms verification into the identical dynamic DAG execution engine.

### Journey 3: Dynamic Clarification During Verification
1. During web retrieval or assessment, the verifier discovers that an essential qualifier (e.g. Claude subscription tier or Stripe card type) is open and that different values yield contradictory verdicts.
2. The specific claim branch in the DAG transitions to `waiting_for_input`, while sibling claim branches continue execution in parallel.
3. The UI presents an accessible clarification card featuring approved input types (select, short text, date, number, boolean) with clear explanations and an *"I don't know"* button.
4. User submits an answer via `submitClarificationAction`. The verifier stores the answer, updates the question version, unblocks the paused branch, and spawns targeted secondary assessment.
5. If the user selects *"I don't know"* or clarification rounds exhaust (max 2), the verifier completes gracefully with `depends_on_context` (`score: null`, `reasonCode: ESSENTIAL_CONTEXT_MISSING`).

### Journey 4: Inspect "Then vs. Now" Timeline & Scheduled Changes
1. User clicks an **Outdated** claim.
2. The Evidence Inspector displays a **Change Timeline**:
   - **Then:** Historical governing value, publication date, and cited excerpt.
   - **Transition:** Deprecation announcement, transition period, or amendment notice.
   - **Now:** Current governing value and effective date.
   - **Upcoming:** Any scheduled changes that have been announced but have not yet taken effect, highlighted with a distinct **Scheduled change** badge.

### Journey 5: Context Comparison (What-If Analysis)
1. On an assessed claim, the user opens the **Compare** drawer.
2. User alters a single context qualifier (e.g. changes billing commitment from *annual* to *monthly*, or API version from *Acacia* to *Basil*).
3. The browser calls `compareAction`, initiating a child run (`parentRunId` linked) evaluating the exact same claim text under the alternate context.
4. The UI displays side-by-side cards comparing the original verdict against the target context verdict without mutating the original answer.

### Journey 6: Evidence-Backed Correction Diff
1. For claims marked **Outdated** or **Contradicted**, the verifier evaluates a replacement assertion against the retrieved evidence.
2. If validated, the UI displays a **Correction Diff** highlighting the exact word-level replacement required.
3. User can click **Copy Correction** to copy the surgically updated text.

### Journey 7: Live Recheck & Expandable DAG Inspector
1. On any completed run, user clicks **Recheck Freshness**, triggering `recheckAction` to initiate fresh web retrieval as a linked child run.
2. User can expand the **Execution Details / DAG Inspector** drawer to inspect a sanitized projection of the dynamic graph: active node stages, dependency progression, Tavily queries executed, and elapsed execution time. Leases, credentials, and internal tokens are strictly excluded.

---

## 2. Release Scope Matrix

| Feature | Release Milestone | Description |
| :--- | :---: | :--- |
| **Preparation & Context Review** | **G0 / Phase 0 & G1 / Phase 1** | Text input up to 8k chars; span extraction; explicit vs inferred qualifiers; revision binding. |
| **Persisted Dynamic DAG Execution**| **G1 / Phase 1 (Minimal) & G2 / Phase 2 (Dynamic)** | Full DAG in Postgres; QStash concurrency (max 3 claims); lease fencing; strict finalization. |
| **Server Actions for Form Mutations**| **G1 / Phase 1** | Type-safe server actions for submit, confirm, clarify, compare, and recheck calling shared services. |
| **Dynamic Clarification Forms** | **G2 / Phase 2** | Accessible form renderer for select/text/date/number/bool; "I don't know" handling; max 2 rounds. |
| **Four Domain Policies** | **G2 / Phase 2** | Specialized verification modules for Pricing, APIs, Regulations, and Leadership. |
| **Generic Fallback Policy** | **G1 / Phase 1** | Broad evidence retrieval and date extraction for claims outside the four domains. |
| **Exact Clickable Citations** | **G1 / Phase 1** | Verifier quotes must match exact character spans in retrieved content; links to primary sources. |
| **Then vs. Now Timeline** | **G3 / Phase 3** | Visual chronological progression from historical state to superseding state. |
| **Scheduled Change Badges** | **G3 / Phase 3** | Explicit badge for announced changes whose effective date is in the future. |
| **Context Comparison** | **G3 / Phase 3** | Side-by-side drawer comparing claim validity under alternate context parameters. |
| **Correction Diffs** | **G3 / Phase 3** | Word-level inline diff suggesting evidence-backed corrections. |
| **Ask Question Flow** | **G3 / Phase 3** | Question input up to 800 characters; Bifrost draft generation followed by full verifier pipeline. |
| **Expandable DAG Inspector** | **G3 / Phase 3** | Sanitized client projection of dynamic DAG nodes, active stages, and execution trace. |
| **Streaming UI + Polling** | **G1 / Phase 1** | SSE live event stream with sequence replay and automatic fallback to 2s snapshot polling. |
| **Labeled Replay Mode** | **G0 / Phase 0** | Visual indicator distinguishing cached fixture playback from live web retrieval. |

---

## 3. Four Domain Policies & Acceptance Claim Examples

### 1. Pricing Policy (`pricing.ts`)
- **Governing Scope:** Product, subscription tier, billing commitment (annual vs. monthly), geographic currency, unit, and tax exclusivity.
- **Rules:** Never compare an annual prepaid rate to a monthly rate without explicit qualification. Never convert currencies dynamically unless specified.
- **Acceptance Pair Example:**
  - *Claim:* "Anthropic Claude Pro costs $20 per month."
  - *Context A (US / Monthly):* **Supported (100)** — Validated by official Anthropic pricing page.
  - *Context B (UK / Monthly):* **Contradicted (0)** or **Depends on context (null)** — UK pricing is £16 + VAT; direct currency mismatch without conversion note.

### 2. API Policy (`api.ts`)
- **Governing Scope:** Vendor, language SDK vs. REST endpoint, API version string, field path, parameter names, deprecation vs. removal.
- **Rules:** Versioned documentation takes absolute precedence over generic blog posts. Deprecated endpoints remain functional until officially decommissioned; do not mark "Removed" until decommission effective date.
- **Acceptance Pair Example:**
  - *Claim:* "Stripe's payment intent requires the `payment_method_types` parameter."
  - *Context A (Stripe API 2020-08-27):* **Supported (100)** — Parameter required in older schemas.
  - *Context B (Stripe API 2024-06-20+):* **Outdated (0)** — Superseded by automatic payment methods configuration (`automatic_payment_methods[enabled]=true`).

### 3. Regulation Policy (`regulation.ts`)
- **Governing Scope:** Legal jurisdiction, covered entities, announcement date, enforcement/effective date, grace periods, penalty clauses.
- **Rules:** Never treat a legislative proposal or press announcement as an active law until its stated effective date.
- **Acceptance Pair Example:**
  - *Claim:* "AI models with systemic risk must comply with the EU AI Act transparency rules."
  - *Context A (Target Date: May 1, 2024):* **Upcoming / Supported with Scheduled Change (100)** — Act adopted, but obligations for General Purpose AI take effect August 2, 2025.
  - *Context B (Target Date: September 1, 2025):* **Supported (100)** — Act actively in force for covered models.

### 4. Leadership Policy (`leadership.ts`)
- **Governing Scope:** Entity / company, executive office, acting vs. permanent appointment, announcement date, official handover date.
- **Rules:** Distinguish announced successor from sitting executive until the effective transition date.
- **Acceptance Pair Example:**
  - *Claim:* "Parag Agrawal is the CEO of Twitter."
  - *Context (Target Date: Present):* **Outdated (0)** — Prior validity proven (appointed Nov 2021); superseding event proven (acquisition and termination by Elon Musk, Oct 2022; later appointment of Linda Yaccarino).

---

## 4. Score Interpretation & Reason Rubric

The verification engine produces a deterministic heuristic score (not an LLM-hallucinated probability):

| Score | Meaning | Condition | Reason Code |
| :---: | :--- | :--- | :--- |
| **100** | **Direct Authoritative Support** | Authoritative primary source directly affirms entity, attribute, value, and scope. | `AUTHORITATIVE_PRIMARY_SUPPORT` |
| **75** | **Indirect Applicable Support** | Secondary trusted source or indirect reference affirms claim under valid scope. | `INDIRECT_CREDIBLE_SUPPORT` |
| **0** | **Decisive Contradiction** | Governing primary source explicitly disproves asserted value or affirms opposite. | `DECISIVE_CONTRADICTION` |
| **0** | **Outdated (Prior Valid, Superseded)** | Evidence proves claim was once valid but has been explicitly superseded. | `SUPERSEDED_HISTORICAL_CLAIM` |
| `null` | **Depends on Context** | Claim accuracy depends on missing qualifier (version, region, billing term). | `ESSENTIAL_CONTEXT_MISSING` |
| `null` | **Conflicting Evidence** | Multiple credible sources from the same period provide contradictory facts. | `CREDIBLE_SOURCES_DISAGREE` |
| `null` | **Insufficient Evidence** | Available search results do not contain relevant or authoritative proof. | `INSUFFICIENT_RETRIEVAL_DATA` |

---

## 5. Release Checklist

- [ ] All four domain policies (`pricing`, `api`, `regulation`, `leadership`) execute within one multi-claim report.
- [ ] Every non-null score provides exact character-matched citations and URLs.
- [ ] Scheduled future changes render with a `Scheduled change` badge without marking current facts outdated.
- [ ] Context comparison drawer allows changing one field and displaying diffs without mutating the base report.
- [ ] Verification fails closed when passage quotes do not match raw retrieved excerpts.
- [ ] Live runs default to real Tavily and Bifrost calls; fixture mode is explicitly labeled.
- [ ] Mobile viewport (360px) passes inspection without horizontal scrolling.
