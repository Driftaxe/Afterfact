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

---

## 6. Design System & Visual Foundation (Task C01)

### Visual Direction: “Quiet, cinematic, precise.”
Afterfact's aesthetic emphasizes deliberate editorial typography, graphite surfaces, and quiet contrast without visual noise or generic AI gimmicks.

- **Primary Theme (Dark Mode):** First-visit default. Deepened charcoal background (`#111214`), graphite surfaces (`#18191C`), raised panels (`#202125`), subtle borders (`#2B2D32`), warm ivory text (`#E7E5E2`), secondary text (`#AAA8A5`), muted text (`#85858D`), primary CTA button (`#DEDBD6` with `#191A1D` text), and restrained secondary lavender-gray accent (`#B5AEBD`).
- **Secondary Theme (Light Mode):** Clean editorial alternative. Warm paper canvas (`#F7F5F0`), crisp off-white surfaces (`#FFFFFF`), warm stone raised surfaces (`#EDE8DF`), charcoal text (`#1A1B1E`), secondary text (`#5A5854`), muted text (`#787570`), subtle borders (`#E8E3DA`), and dusty plum-gray accent (`#5C4E68`, WCAG AA 7.65:1 contrast).
- **Typography Philosophy:** One refined sans-serif family throughout the interface (Geist Sans with Geist Mono for codes/hashes). No remote blocking font dependencies, no decorative/baroque display serifs, and no all-caps product titles:
  - **Product / Hero Heading:** Responsive 40–64px (`text-4xl sm:text-5xl md:text-6xl`), weight 400–500 (`font-normal`), tracking `-0.035em`. Product name rendered as "Afterfact".
  - **Section Titles:** 20–24px, weight 500 (`font-medium`), tracking `-0.025em`.
  - **Intro / Body:** 16–18px, line-height 1.6 (`leading-[1.6]`).
  - **Controls & Actions:** 14px (`text-sm`), weight 500 (`font-medium`). 40–44px desktop button height, 8–10px corner radius, modest horizontal padding, quiet hover feedback, no glow or oversized arrows.
  - **Supporting Metadata:** 12–13px (`text-xs`), readable contrast.
  - **Cards:** Modest 12px radius, subtle borders (`#2B2D32` / `#E8E3DA`), no gratuitous card-inside-card framing.
- **Theme Persistence & Pre-Paint Initialization:** Initial theme is resolved and applied before first paint via an inline script in `src/app/layout.tsx`. First visits default to dark. Explicit user toggles persist in `localStorage` under key `afterfact-theme`. Invalid or inaccessible storage gracefully falls back to dark without throwing errors.
- **Token Locations:**
  - CSS variables: [`src/app/globals.css`](src/app/globals.css) (`:root, [data-theme="dark"], .dark` and `[data-theme="light"]`).
  - Tailwind utilities: [`tailwind.config.ts`](tailwind.config.ts) (`bg-background`, `bg-surface`, `bg-surface-raised`, `text-primary`, `text-secondary`, `text-muted`, `border-subtle`, `border-strong`, `bg-accent`, `focus-ring`, `status-*`).
- **Shared UI Primitives (`@/components/ui`):**
  - Buttons: `Button` (`primary`, `secondary`, `quiet`, `destructive`; `sm`, `md`, `lg`; `loading`, `iconOnly`).
  - Form Fields: `Input`, `Textarea` (with character counter), `Select`, `Checkbox`, `Switch`.
  - Layout & Containers: `Card` (`default`, `raised`, `subtle`), `CardHeader`, `Divider`.
  - Status Indicators: `StatusBadge` (`supported`, `outdated`, `contradicted`, `unresolved`, `checking`, `awaiting_clarification`). Every badge couples text and an icon with WCAG AA &gt; 6.6:1 contrast.
  - Feedback: `InlineError`, `Notice`, `Skeleton` (respects `prefers-reduced-motion`), `EmptyState`.
- **Canonical Design Reference Route:**
  - Path: [`/design`](src/app/design/page.tsx)
  - Purpose: Interactive live reference workspace for all shared components, color tokens, and state variations. All claims and evidence displayed on `/design` are synthetic illustrative samples.
- **Guidance for Downstream Builders (Lanes C02/C03/C04):**
  - Import shared primitives directly from `@/components/ui` and `@/components/theme/ThemeToggle`.
  - Do not introduce ad-hoc color hex codes or duplicate custom button/card wrappers.
  - Maintain the semantic distinction where `unresolved` uses neutral stone styling and is never colored as `contradicted`/false.


---

## 7. Input Composer & Interactive Report Skeleton (Task C02)

### User Experience & Boundaries
Task C02 delivers the primary application input interface and interactive verification report experience using the validated golden fixture, operating with complete schema integrity without requiring a live backend.

### 1. Routes & Replay Honesty
- **Root Entry Point (`/`):** Hosts the primary `InputComposer`. Allows users to paste AI-generated answers, toggle progressive context fields, test sample inputs, and execute local validation. Submitting arbitrary text produces an honest notice: *"Live verification isn’t available yet. Explore a sample report to see how claims and evidence are presented."* It never silently serves the fixed fixture as if the user's text were verified.
- **Sample Report Route (`/report/demo?mode=fixture`):** Deterministic route serving the canonical golden report parsed with `ReportSchema`. Identified by a prominent human-readable badge: `Sample report · Not a live verification`.
- **Honest 404 / Unavailable State:** Requesting an unknown report ID (e.g. `/report/unknown_run`) renders a dedicated `ReportErrorState` explaining that the report was not found and inviting the user to view the sample report, rather than fabricating a response.

### 2. Highlighting & Span Integrity (`src/lib/report/spans.ts`)
- Highlight boundaries are calculated using deterministic interval segmentation against unmodified `answerText`.
- Concatenating all segment slices strictly preserves 100% of the original text byte-for-byte, including UTF-16 code units (emojis, surrogate pairs) and non-overlapping gaps.
- Spans are selected by stable claim ID offsets, preventing ambiguous collisions across identical repeated phrases.
- Highlighting is coupled to accessible buttons with `aria-pressed`, keyboard support (Enter/Space), and non-color-only indicators (outline ring, underline decoration, elevation).

### 3. Report Presentation Layout (`src/components/report/`)
- **Desktop (55:45 Grid):** Left column (55%) displays the full answer document with interactive highlights. Right column (45%) presents the filterable claim list and selected claim detail panel.
- **Summary Metrics (`ReportSummaryBar.tsx`):** Displays total claims and counts for supported, outdated, contradicted, and unresolved. Interactive filter buttons allow filtering claims by verdict. Aggregate probabilities or fake averages are strictly avoided.
- **Claim Detail Panel (`ClaimDetail.tsx`):** Shows raw claim text, status badge, freshness score (rubric-backed, clarifying it is not a probability), machine reason code, Then vs. Now chronological timeline, verified surgical correction diff, and cited evidence cards.
- **Evidence Presentation (`EvidenceCard.tsx`):** Displays publisher/domain, source type badge, quoted passage with expandable disclosure, safe external link (`rel="noopener noreferrer"`), and explicitly labeled dates (Published vs. Effective vs. Retrieved).
- **View States (`ReportStates.tsx`):** Reusable presentation states for Loading Skeleton, Empty Claims (with note that no-claims does not imply true), Partial Report, and Error / Not Found.

### 4. Integration Handoff for Task C03
- **Input Submission Boundary:** `InputComposer` accepts `onValidatedPaste?: (request: PasteRequest) => void`. C03 will pass a Server Action (`startPreparationAction`) to initiate live verifications.
- **Report Data Boundary:** `ReportView` accepts `report: Report` as a pure prop. C03 will supply parsed report data from live runs or SSE hooks (`useRun`) without modifying presentation components.
