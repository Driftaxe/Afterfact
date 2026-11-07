# docs/VERIFICATION.md — Verification Engine & Policy Rules

This document specifies the algorithmic, date resolution, and scoring rules for the **Afterfact** verification engine. All claim analysis is strictly grounded in empirical evidence and deterministic TypeScript logic rather than probabilistic LLM guesswork.

---

## 1. Claim Extraction & Span Matching (`extract-claims.ts`)

1. **Atomic Claim Decomposition:**  
   Compound sentences are split into atomic assertions containing:
   - `entity`: Normalized subject (e.g., `Stripe`, `EU Commission`, `Anthropic`).
   - `attribute`: Property being asserted (e.g., `fee_percentage`, `compliance_deadline`, `ceo`).
   - `assertedValue`: Exact value claimed in text (e.g., `2.9% + 30¢`, `August 2, 2026`, `Parag Agrawal`).
   - `timeSensitivity`: Level of temporal drift vulnerability (`high`, `medium`, `low`).
   - `sourceScope`: Explicit qualifiers stated in the text (jurisdiction, currency, tier, version).
2. **UTF-16 Span Grounding:**  
   Spans are stored as raw UTF-16 character offsets into the unmodified input text:
   $$\text{Span Validation Invariant: } \texttt{input.slice(span.start, span.end) === claim.rawText}$$
   - If repeated phrases exist, resolution binds to the exact sentence offset.
   - Ambiguous highlights that cannot be grounded unambiguously fail validation and are rejected from the highlight overlay while keeping the claim text inspectable.
3. **Scope Precedence Rule:**  
   An explicit qualifier in the original text (e.g., *"In the UK, Stripe charges..."*) is permanently anchored to the claim. It is never overwritten or merged with the user's requested search scope.

---

## 2. Four Domain Verification Policies

Each domain module implements a dedicated policy interface (`PolicyModule`):

### A. Pricing Policy (`src/server/policies/pricing.ts`)
- **Required Qualifiers:** Product name, subscription tier, billing commitment (`annual_prepaid` vs. `monthly`), geographic currency, tax status (VAT inclusive/exclusive), and pricing unit (per-seat vs. per-token).
- **Comparison Invariants:**
  - Annual rates cannot validate monthly assertions, even if the effective monthly average is identical.
  - Currency values are never converted dynamically via floating exchange rates; pricing must match in native currency.
- **Trusted Sources:** Official vendor pricing pages, Stripe/Braintree pricing catalogs, official billing docs.

### B. API Policy (`src/server/policies/api.ts`)
- **Required Qualifiers:** Vendor, SDK language vs. REST API, version string/date, endpoint path, parameter name, field status (`active`, `deprecated`, `removed`).
- **Comparison Invariants:**
  - Deprecated parameters remain functionally valid until officially removed.
  - A claim stating an endpoint is "removed" when it is merely "deprecated" is marked **Contradicted (0)**.
- **Trusted Sources:** Official developer reference documentation, versioned API changelogs, official GitHub release tags.

### C. Regulation Policy (`src/server/policies/regulation.ts`)
- **Required Qualifiers:** Governing jurisdiction (e.g., EU, US Federal, California), covered organization threshold, announcement/passage date, effective/enforcement date, grace period rules.
- **Comparison Invariants:**
  - An announcement or legislative vote does not make a regulation active.
  - A claim asserting an obligation is currently in force before its effective date is marked **Contradicted (0)** or **Upcoming / Scheduled Change (100)** depending on phrasing.
- **Trusted Sources:** Official government gazettes, EUR-Lex, regulatory agency rulings, statutory registers.

### D. Leadership Policy (`src/server/policies/leadership.ts`)
- **Required Qualifiers:** Corporate entity, executive office, transition role (`acting`, `interim`, `incoming`, `current`), handover date.
- **Comparison Invariants:**
  - An announced executive handover with a future transition date preserves the incumbent as the current officeholder.
- **Trusted Sources:** SEC filings (Form 8-K), official company press releases, corporate leadership directories.

### E. Generic Fallback Policy
Claims falling outside the four specialized domains are evaluated with general web evidence:
- Queries target the normalized entity, attribute, and stated timeframe.
- Evidence must meet the same quote-matching and date-attribution standards as specialized policies.

---

## 3. Date Resolution & Temporal Logic

1. **Storage Standards:**
   - All precise timestamps are stored in UTC.
   - Date-only source values (e.g., `2025-08-02`) are stored strictly as ISO 8601 date strings (`YYYY-MM-DD`). Never fabricate artificial timestamps like `00:00:00Z` or guess timezones.
2. **Three-Date Separation Invariant:**
   The engine strictly tracks three independent temporal markers:
   - **Publication Date ($T_{\text{pub}}$):** When the source document or press release was published.
   - **Announcement Date ($T_{\text{announce}}$):** When a future change or policy was publicly disclosed.
   - **Effective Date ($T_{\text{effective}}$):** The exact calendar date on which the change legally or technically takes effect.
3. **Scheduled Change Rule:**  
   $$\text{If } T_{\text{current}} < T_{\text{effective}} \implies \text{Current assertion remains valid. Badge: } \texttt{Scheduled change}$$
   *A newer announcement never constitutes proof that an event has already taken effect.*

---

## 4. Verdict Precedence & Decision Tree

When evaluating a claim against retrieved passages, `decide.ts` executes the following strict order of precedence:

```
[ Step 1: Filter Passages ]
Remove passages whose scope contradicts explicit claim scope (e.g., wrong jurisdiction, wrong SDK).
         │
         ▼
[ Step 2: Essential Scope Missing? ]
Is essential scope ambiguous and do different scopes yield conflicting values?
         ├─► YES: Return `depends_on_context` (Score: null, Code: ESSENTIAL_CONTEXT_MISSING)
         ▼ NO
[ Step 3: Direct Contradiction? ]
Does authoritative source directly contradict asserted value for the target time?
         ├─► YES:
         │   Did claim assert past validity that was historically true?
         │   ├─► YES (Prior valid + Superseded): Return `outdated` (Score: 0, Code: SUPERSEDED_HISTORICAL_CLAIM)
         │   └─► NO: Return `contradicted` (Score: 0, Code: DECISIVE_CONTRADICTION)
         ▼ NO
[ Step 4: Irreconcilable Conflict? ]
Do equally credible sources from the same period provide conflicting facts?
         ├─► YES: Return `conflicting_evidence` (Score: null, Code: CREDIBLE_SOURCES_DISAGREE)
         ▼ NO
[ Step 5: Authoritative Support? ]
Does governing source directly affirm entity, attribute, value, and scope?
         ├─► Primary Authoritative Source: Return `supported` (Score: 100, Code: AUTHORITATIVE_PRIMARY_SUPPORT)
         ├─► Indirect Credible Source: Return `supported` (Score: 75, Code: INDIRECT_CREDIBLE_SUPPORT)
         ▼ NO
[ Step 6: Fallback ]
Return `insufficient_evidence` (Score: null, Code: INSUFFICIENT_RETRIEVAL_DATA)
```

---

## 5. Scoring Rubric

Scores are deterministic heuristics representing epistemic certainty, **not statistical probabilities**:

- **`100`:** Direct primary authoritative support under matching scope and valid timeframe.
- **`75`:** Indirect but sufficient credible support; no conflicting evidence found.
- **`0`:** Decisive contradiction by governing source, or claim is outdated (prior validity proven and superseded).
- **`null`:** Unresolved claims (`depends_on_context`, `conflicting_evidence`, `insufficient_evidence`). Every `null` score is accompanied by an explicit `scoreReason` and `reasonCode`.

---

## 6. Transitions, Timelines & Correction Diff Validation

### Then vs. Now Chronology
For claims determined to be **Outdated**, the engine constructs a structured chronology:
1. **Then (Historical):** Earliest verified valid period, governing value, and source passage.
2. **Transition Event:** Date and reference of the superseding announcement or deprecation notice.
3. **Now (Current):** Currently active value, effective date, and governing source passage.
4. **Upcoming (Future):** Any pending changes whose effective date has not yet arrived.

### Surgical Correction Validation (`correction.ts`)
1. Only the asserted attribute value is eligible for replacement; the original subject and context remain untouched.
2. The candidate replacement text is fed through the verifier against the identical target context.
3. A correction diff is emitted **only** if the replacement achieves a score of **100** (`supported`).
4. If the replacement cannot be conclusively verified, the correction is withheld and marked `correction_unverified`.
