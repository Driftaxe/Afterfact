# docs/VERIFICATION.md — Verification Engine, Evidence Architecture & Decision Gates

This document specifies the algorithmic, date resolution, preparation, research planning, evidence extraction, dynamic clarification, and scoring rules for the **Afterfact** (working name: Stale-Answer Detector) verification engine. All claim analysis is strictly grounded in empirical web evidence and deterministic TypeScript logic rather than probabilistic LLM guesswork.

> [!NOTE]
> All schemas, interfaces, and algorithms defined below represent planned architectural specifications. Shared contracts in `src/lib/contracts/` govern implementation across server services, workers, and UI components.

---

## 1. Universal Claim Ticket & Variable Typed Property Context

Verification evaluates discrete, atomic factual statements. Rather than using an unstructured text string or a rigid, domain-specific database column schema, the engine represents claims via a **Universal Claim Ticket** carrying a collection of variable, strongly typed context properties.

### A. Conceptual Model: `ClaimTicket`
The `ClaimTicket` extends the foundational `ClaimSpec` contract to support iterative revision, context evolution, and multi-round verification:

```typescript
export interface ClaimTicket {
  ticketId: string;                 // Stable unique identifier (e.g. "tkt_01j98ab7...")
  claimId: string;                  // Parent claim entity reference (e.g. "clm_01j98...")
  runId: string;                    // Associated run identifier
  inputHash: string;                // SHA-256 of original source text statement
  revision: number;                 // Monotonically increasing revision counter (starts at 1)
  originalStatement: string;        // Verbatim extracted sentence or clause
  sourceSpan: {                     // Exact UTF-16 character offsets in the input text
    start: number;
    end: number;
  };
  normalizedProposition: string;    // Disambiguated proposition for web verification
  targetTime: string;               // ISO 8601 evaluation timestamp or date (YYYY-MM-DD)
  verificationContext: VerificationProperty[]; // Strongly typed context properties
}
```

### B. Strongly Typed `VerificationProperty`
Context properties represent the factual qualifiers governing when, where, and under what conditions a claim is asserted to be true (e.g., jurisdiction, subscription tier, billing cycle, SDK version, effective date).

```typescript
export type PropertyType = 'string' | 'number' | 'boolean' | 'date' | 'selection' | 'string_list';

export interface VerificationProperty {
  key: string;                      // Stable qualifier identifier (e.g. "jurisdiction", "subscriptionTier")
  label: string;                    // Human-readable label for UI rendering (e.g. "Geographic Jurisdiction")
  propertyType: PropertyType;       // Discriminated primitive type
  value: string | number | boolean | string[] | null; // Typed value matching propertyType
  units?: string;                   // Optional unit (e.g. "USD", "seats", "requests/min")
  origin:                           // Mutually exclusive provenance category
    | 'explicit_claim_text'         // Extracted directly from input text (has sourceSpan)
    | 'user_target_context'         // Supplied or overridden by user during input/review
    | 'model_inferred'              // Suggested by model during preparation, pending confirmation
    | 'unknown';                    // Material qualifier currently undetermined
  sourceSpan?: {                    // UTF-16 character offsets if origin is 'explicit_claim_text'
    start: number;
    end: number;
  };
  status:                           // Operational lifecycle state
    | 'confirmed'                   // Verified by user or locked by explicit claim text
    | 'pending_review'              // Suggested by extraction pass, awaits user confirmation
    | 'clarification_needed'        // Ambiguity discovered that materially impacts verdict
    | 'system_default';             // Inferred from global run configuration
  applicability:                    // Scope boundary
    | 'claim_level'                 // Governs this specific claim ticket only
    | 'run_level';                  // Inherited across all claims in the parent run
}
```

### C. Domain Extensibility & Novel Domain Invariants
- **Pre-Known Domains:** Specialized domain modules (Pricing, APIs, Regulations, Leadership) define property catalogs (e.g., `billingCommitment`, `sdkLanguage`, `regulatoryBody`).
- **Novel Domains:** When claims fall outside pre-known domains, the extraction pass proposes novel properties conforming to the identical `VerificationProperty` meta-schema. Novel domains **never** require database DDL schema migrations, hardcoded TypeScript classes, or dynamic client-side JSX execution.
- **Scope Precedence Invariant:**
  $$\text{Explicit Claim Qualifier} \succ \text{User Target Context} \succ \text{Model Suggestion} \succ \text{Default}$$
  An explicit qualifier extracted directly from the claim text (e.g., *"In the UK, Stripe charges 1.4%..."* $\implies$ `jurisdiction: 'UK'`) is permanently anchored to that claim. It is **never** overwritten or overridden by user-supplied target context. User-provided target context applies strictly to fill in open or unspecified qualifiers.
- **Inference Invariant:** A `model_inferred` property is **never** silently promoted to established fact without user confirmation or empirical evidence corroboration.

---

## 2. Verification Context vs. Search Context

The verification engine maintains a strict separation between what is being verified and how information is retrieved:

```mermaid
flowchart LR
    subgraph ClaimScope ["Verification Context (Truth Boundary)"]
        VC1["Explicit Qualifiers (jurisdiction=UK)"]
        VC2["Target Time (2026-11-08)"]
        VC3["Required Property Matches"]
    end

    subgraph SearchScope ["Search Context (Retrieval Boundary)"]
        SC1["Keyword Queries & Entity Aliases"]
        SC2["Target Domain Whitelists (gov.uk, stripe.com)"]
        SC3["Counterevidence Search Terms"]
    end

    ClaimScope -->|Deterministic Projection| SearchScope
    SearchScope -->|Web Intelligence| RawDocs["Source Documents"]
    RawDocs -->|Context-Preserving Extraction| Evidence["Evidence Units"]
    Evidence -->|Assess against Verification Context| Verdict["Verified Verdict"]
```

### A. Projection Rules
- **Verification Context:** Defines the exact logical conditions under which the claim must be judged true or false. It enforces constraints that retrieved passages *must satisfy* to grant direct support.
- **Search Context:** A derived projection of the verification context into search queries, expanding synonyms, entity aliases, vendor naming shifts (e.g., "Twitter" $\to$ "X (formerly Twitter)"), and trusted domain filters.
- Run-level context properties (e.g. `targetDate`) propagate to search queries across all claims, while claim-level properties (e.g. `currency: 'GBP'`) restrict search terms and filtering for that specific claim only.

### B. Invalidation & Revision Rules
- If a user modifies a verification context property or answers a clarification prompt, a new `ClaimTicket` revision ($R_{n+1}$) is generated.
- Downstream artifacts for that specific claim branch—including the active `ResearchPlan`, retrieved `SourceDocument` references, extracted `EvidenceUnit` items, semantic assessments, and `DecisionRecord`—are immediately marked **invalidated**.
- Sibling claim branches remain completely untouched and continue executing without interruption.

### C. Dynamic Clarification Forms & Bounded Protocol
When claim ambiguity materially threatens verification accuracy, the system engages the dynamic clarification protocol.
- **Approved primitive field types:**
  - `select` (single-select from bounded string options)
  - `short text` (single-line string, max 60 characters)
  - `date` (ISO 8601 calendar date `YYYY-MM-DD`)
  - `number` (bounded numeric value with optional units)
  - `boolean` (true / false toggle)
- Clarifications provide pure structured data to a generic, accessible form renderer. The model is strictly prohibited from returning executable JSX, client scripts, or arbitrary validation code.
- Clarification questions always include `allowUnknown: true` and are bounded to at most **2 rounds** before proceeding with `depends_on_context` (`score: null`, `reasonCode: ESSENTIAL_CONTEXT_MISSING`).

---

## 3. Structured Research Planning

Verification does not perform ad-hoc keyword searches. Every research phase begins with an explicit, auditable **`ResearchPlan`**.

### A. `ResearchPlan` Interface
```typescript
export interface ResearchPlan {
  planId: string;                   // Plan identifier (e.g. "plan_01j98ab7...")
  claimTicketId: string;            // Bound claim ticket ID and revision
  round: number;                    // Research round (1 or 2)
  queries: PlannedQuery[];          // Ordered collection of planned search operations
  materialUnknownQualifiers: string[]; // Properties targeted for discovery (e.g. ["effectiveDate"])
  stoppingConditions: string[];     // Explicit termination rules (e.g. "Conclusive primary vendor docs found")
}

export interface PlannedQuery {
  query: string;                    // Exact query string sent to search provider
  purpose:                          // Explicit epistemic role
    | 'establish_current_state'     // Discover currently active value, version, or policy
    | 'investigate_exceptions_or_scope' // Discover regional, tier, or edge-case variations
    | 'seek_counterevidence'        // Explicitly search for deprecation, disputes, or contradiction
    | 'establish_historical_state_or_transition'; // Locate past validity dates or transition events
  targetSourceRoles: SourceRole[];  // Desired authority tiers
}

export type SourceRole =
  | 'primary_authority'             // Official vendor docs, pricing catalogs, statutory registers
  | 'regulatory_filing'             // SEC 8-K/10-K, EUR-Lex gazette, court opinions
  | 'official_changelog'            // Release notes, GitHub releases, API deprecation logs
  | 'reputable_secondary'           // Major news outlets (Reuters, Bloomberg), recognized industry analysis
  | 'counter_perspective';          // Investigative reports, consumer complaints, policy audits
```

### B. Counterevidence & Invalidation Search
The research planner is strictly required to generate at least one query with `purpose: 'seek_counterevidence'` for claims asserting exclusivity, superlative performance, or active validity (e.g., appending terms such as *"deprecated"*, *"removed"*, *"price increase"*, *"resigned"*, or *"superseded"*).

### C. Budget, Deduplication & Stopping Bounds
- **Query Budget:** Maximum **6 queries** per claim across all research rounds.
- **Round Limit:** Maximum **2 research rounds** per claim branch.
- **Deduplication:** When multiple sibling claims target the same entity or URL domain, the execution planner deduplicates identical queries to conserve search quota.
- **Early Stopping:** If Round 1 returns an authoritative primary source with conclusive support or contradiction, the planner terminates further research rounds immediately.

---

## 4. Three Distinct Evidence Objects

The architecture strictly decouples document provenance, passage extraction, and relationship semantics into three separate, persisted abstractions:

```mermaid
classDiagram
    class SourceDocument {
        +string documentId
        +string url
        +string finalUrl
        +string title
        +string publisher
        +string contentHash
        +SourceRole sourceRole
        +Date publicationDate
        +Date effectiveDate
        +Date retrievedAt
    }

    class EvidenceUnit {
        +string evidenceId
        +string documentId
        +string verbatimText
        +string locator
        +string surroundingHeaders
        +string tableContext
        +string footnotes
        +VerificationProperty[] extractedProperties
    }

    class ClaimEvidenceAssessment {
        +string assessmentId
        +string claimTicketId
        +string evidenceId
        +AssessmentRelationship relationship
        +boolean quotationVerified
        +string propertyMatchStatus
        +string reasoning
    }

    SourceDocument "1" *-- "many" EvidenceUnit : extracts
    EvidenceUnit "1" *-- "many" ClaimEvidenceAssessment : evaluated by
```

### A. `SourceDocument` (Document Provenance)
Represents a retrieved web page or external publication.
```typescript
export interface SourceDocument {
  documentId: string;               // Unique document hash/ID (e.g. "doc_01j98ab7...")
  url: string;                      // Initial target URL
  finalUrl: string;                 // Final URL after following HTTP redirects
  title: string;                    // Document page title
  publisher: string;                // Organization or domain authority (e.g. "Stripe", "SEC")
  retrievedContentHash: string;     // SHA-256 of raw HTML/text retrieved from provider
  retrievedAt: string;              // ISO 8601 UTC timestamp of retrieval
  publicationDate: string | null;   // Extracted publication date (T_pub)
  effectiveDate: string | null;     // Extracted legal/technical effective date (T_effective)
  sourceRole: SourceRole;           // Assigned authority tier
}
```

### B. `EvidenceUnit` (Context-Preserving Extracted Passage)
Represents a discrete, localized passage extracted verbatim from a `SourceDocument`.
```typescript
export interface EvidenceUnit {
  evidenceId: string;               // Unique evidence unit ID (e.g. "evi_01j98ab8...")
  documentId: string;               // Reference to parent SourceDocument
  verbatimText: string;             // Exact character sequence extracted from source
  locator: {                        // Exact document location
    xpath?: string;
    cssSelector?: string;
    charOffsetStart?: number;
    charOffsetEnd?: number;
  };
  surroundingHeaders: string[];     // Hierarchy of H1, H2, H3 headers framing the passage
  tableContext?: {                  // Column headers, row headers, and unit labels if from a table
    tableTitle?: string;
    columnHeader?: string;
    rowHeader?: string;
  };
  footnotes?: string[];             // Associated asterisks, small-print notes, or caveats
  extractedProperties: VerificationProperty[]; // Properties stated directly in this passage
  extractionLimitations?: string[]; // Truncation or parsing caveats
}
```

### C. `ClaimEvidenceAssessment` (Semantic & Logical Relationship)
Represents the evaluated relationship between **one specific ClaimTicket revision** and an `EvidenceUnit`.
```typescript
export type AssessmentRelationship =
  | 'supports'                      // Directly confirms the asserted proposition and qualifiers
  | 'contradicts'                   // Directly refutes the asserted proposition under matching scope
  | 'relevant_but_inconclusive'     // Mentions entity/attribute but lacks decisive qualifiers
  | 'unrelated'                     // Retrieved excerpt lacks semantic relevance
  | 'historical_state'              // Confirms claim was valid in past, but since superseded
  | 'future_scheduled_change';      // Confirms change announced but effective date is in the future

export interface ClaimEvidenceAssessment {
  assessmentId: string;             // Assessment identifier (e.g. "asm_01j98ab9...")
  claimTicketId: string;            // Bound ClaimTicket ID and revision
  evidenceId: string;               // Bound EvidenceUnit ID
  relationship: AssessmentRelationship; // Evaluated semantic relationship
  quotationVerified: boolean;       // Deterministic proof that excerpt exists in SourceDocument
  propertyMatchStatus: {            // Comparison of claim properties vs evidence properties
    matching: string[];             // Keys with identical values
    mismatched: string[];           // Keys with conflicting values (scope mismatch)
    missingInEvidence: string[];    // Keys not mentioned in evidence
  };
  temporalApplicability:            // Temporal classification
    | 'active_at_target_time'
    | 'historical_prior'
    | 'future_pending'
    | 'undetermined';
  sourceSuitability: 'authoritative_primary' | 'credible_secondary' | 'insufficient_authority';
  reasoning: string;                // Epistemic justification for this relationship
}
```

### D. Architectural Invariants for Evidence Objects
1. **Relationship Independence:** Support or contradiction is **not** a property of a web document; it belongs strictly to the relational `ClaimEvidenceAssessment` between a specific claim revision and a specific evidence passage.
2. **Grounding vs. Truth:** A verbatim quote inside an `EvidenceUnit` proves empirical grounding in the source document; it does **not** prove that the assertion is universally true. Truth requires synthesis against scope and authority.
3. **Untrusted Data Boundary:** Source document content is untrusted data. Verifier prompts strictly treat retrieved passages as passive strings, never executing embedded markup, scripts, or prompt injections.

---

## 5. Context-Preserving Extraction

Naive text splitting strips surrounding context, leading to catastrophic misinterpretation (e.g., missing a section header titled *"Deprecated Features"* or a table footnote stating *"Rates apply to UK cards only"*).

The extraction pipeline adheres to context-preserving rules:
1. **Negation & Scope Boundary Preservation:** Negative qualifiers (*"not"*, *"never"*, *"excluding"*, *"except for"*) must never be detached from the predicate clause.
2. **Header Hierarchy Retention:** Every extracted passage preserves its enclosing header trail (e.g. `["Developers", "Payments API", "v1.2", "Deprecated Parameters"]`).
3. **Table Structural Integrity:** Passages extracted from HTML/Markdown tables retain table titles, associated column headers, row labels, and unit cells.
4. **Footnotes & Disclaimers:** Asterisks, numerical footnote references, and trailing disclaimers on pricing or regulatory pages are parsed and explicitly bound to the `EvidenceUnit.footnotes` collection.
5. **Version & Region Anchors:** If a document contains explicit version banners (e.g. *"Viewing documentation for SDK v2 (Legacy)"*), the banner is extracted as a governing property.

---

## 6. Vector Similarity Boundary: Candidate Shortlisting Only

Vector embeddings provide high-recall discovery over unstructured passages, but vector similarity **cannot judge factual truth**. High semantic similarity regularly occurs between contradictory claims (e.g., *"Stripe charges 2.9%"* vs *"Stripe charges 1.4%"* have $>90\%$ cosine similarity).

```
   ┌────────────────────────────────────────────────────────┐
   │         VECTOR SIMILARITY SCOPE & BOUNDARY             │
   ├───────────────────────────┬────────────────────────────┤
   │  PERMITTED USAGE          │  STRICTLY PROHIBITED       │
   ├───────────────────────────┼────────────────────────────┤
   │  • Candidate shortlisting │  • Public truth scoring    │
   │  • Relevance pre-ranking  │  • Verdict calculation     │
   │  • Redundancy clustering  │  • Weighted score averages │
   └───────────────────────────┴────────────────────────────┘
```

### Rules & Guardrails
1. **Exclusion from Scoring:** Vector similarity scores are **strictly prohibited** from contributing to or being averaged into the public truth score.
2. **Shortlisting Only:** When a search returns dozens of candidate passages from extracted pages, vector similarity against the claim proposition is used solely to shortlist the top candidates for model assessment.
3. **Small Candidate Sets Bypassed:** If the total candidate passage count is $\le 4$, vector similarity ranking is bypassed entirely; all candidates are submitted directly to the structured semantic assessment pass.
4. **Simple In-Memory Cosine Ranking:** Embedding storage is kept lean. Candidate embeddings are computed on-the-fly or cached in PostgreSQL vector columns; ranking uses in-memory cosine similarity without requiring an external hosted vector database.
5. **Counter-Hypothesis Comparison:** Comparing passages against an inverted counter-hypothesis (e.g. *"Stripe does not charge 2.9%"*) is classified as **experimental** and non-blocking. It is never used as an authoritative decision gate.

---

## 7. Structured Semantic Assessment & Deterministic Integrity Checks

To prevent hallucinated verdicts, assessment splits cleanly between model-driven semantic interpretation and deterministic TypeScript verification.

```mermaid
flowchart TD
    CandidatePassage["Candidate Evidence Unit"] --> ModelPass["Bifrost LLM Pass (Semantic Interpretation)"]
    ModelPass --> RawAssessment["Raw Assessment Payload<br/>(Quoted String, Properties, Temporal Tags)"]
    RawAssessment --> TSValidator["Deterministic TypeScript Integrity Checks"]

    subgraph TSValidatorChecks ["Integrity Checks"]
        C1["Quote Check: SourceDocument.text.includes(quote)"]
        C2["Date Check: T_current vs T_effective vs T_pub"]
        C3["Scope Check: Exact Qualifier Match vs Mismatch"]
    end

    TSValidator --> TSValidatorChecks
    TSValidatorChecks -->|All Checks Pass| ValidatedAssessment["Validated ClaimEvidenceAssessment"]
    TSValidatorChecks -->|Quote Missing / Date Invalid| Discard["Discard / Fail Closed"]
```

### A. Model-Driven Semantic Assessment (Pass P4)
The model receives the normalized `ClaimTicket` and candidate `EvidenceUnit` items. It outputs:
- The exact substring from the passage that justifies the relationship.
- Extracted property values observed in the passage.
- Temporal indicators ($T_{\text{pub}}, T_{\text{announce}}, T_{\text{effective}}$).
- Proposed relationship (`supports`, `contradicts`, `relevant_but_inconclusive`, `historical_state`, `future_scheduled_change`).

### B. Deterministic TypeScript Integrity Checks
Deterministic code immediately verifies the model output before accepting it:
1. **Verbatim Quotation Integrity:**
   $$\texttt{sourceDocument.text.includes(assessment.quotedText)} === \mathbf{true}$$
   If the quoted text does not exist verbatim in the raw source document, the assessment is **rejected** as an ungrounded hallucination.
2. **Scope Compatibility Check:**
   If a passage exhibits conflicting values for an explicit claim qualifier (e.g., passage is for UK pricing while claim asserts US pricing), it is automatically classified as `wrong_scope` and cannot grant support.
3. **Temporal Invariant Check:**
   Evaluates temporal relationships using exact calendar date arithmetic ($T_{\text{target}} \text{ vs } T_{\text{effective}}$).

---

## 8. Synthesis Judge & Deterministic Decision Gates

The final verdict is derived not by asking an LLM *"What is the overall score?"*, but by executing a deterministic decision gate across all validated `ClaimEvidenceAssessment` records.

```mermaid
flowchart TD
    Start["Begin Claim Synthesis"] --> Step1["Step 1: Filter Wrong-Scope Evidence"]
    Step1 --> Step2{"Step 2: Essential Scope Missing?"}
    Step2 -- Yes --> DepContext["depends_on_context<br/>Score: null | ESSENTIAL_CONTEXT_MISSING"]
    Step2 -- No --> Step3{"Step 3: Direct Contradiction?"}

    Step3 -- Yes --> CheckOutdated{"Prior Validity Proven<br/>+ Superseding Change?"}
    CheckOutdated -- Yes --> Outdated["outdated<br/>Score: 0 | SUPERSEDED_HISTORICAL_CLAIM"]
    CheckOutdated -- No --> Contradicted["contradicted<br/>Score: 0 | DECISIVE_CONTRADICTION"]

    Step3 -- No --> Step4{"Step 4: Irreconcilable Conflict?"}
    Step4 -- Yes --> Conflict["conflicting_evidence<br/>Score: null | CREDIBLE_SOURCES_DISAGREE"]

    Step4 -- No --> Step5{"Step 5: Authoritative Support?"}
    Step5 -- Primary Authority --> Supported100["supported<br/>Score: 100 | AUTHORITATIVE_PRIMARY_SUPPORT"]
    Step5 -- Credible Secondary --> Supported75["supported<br/>Score: 75 | INDIRECT_CREDIBLE_SUPPORT"]

    Step5 -- No --> Step6["insufficient_evidence<br/>Score: null | INSUFFICIENT_RETRIEVAL_DATA"]
```

### Deterministic Gate Precedence Order
1. **Step 1 (Scope Filtering):** Discard all assessments whose extracted properties directly conflict with the explicit claim qualifiers.
2. **Step 2 (Essential Ambiguity Check):** If an essential qualifier is unknown and different valid options yield conflicting outcomes, return `depends_on_context` (`score: null`, `ESSENTIAL_CONTEXT_MISSING`).
3. **Step 3 (Contradiction & Outdated Check):**
   - If an authoritative source contradicts the asserted fact for the target time:
     - If evidence proves the claim was historically valid and subsequent evidence proves a superseding transition, return `outdated` (`score: 0`, `SUPERSEDED_HISTORICAL_CLAIM`).
     - Otherwise, return `contradicted` (`score: 0`, `DECISIVE_CONTRADICTION`).
4. **Step 4 (Conflict Check):** If multiple equally credible sources from the same timeframe provide irreconcilable values, return `conflicting_evidence` (`score: null`, `CREDIBLE_SOURCES_DISAGREE`).
5. **Step 5 (Support Check):**
   - If a primary authoritative source directly confirms the proposition and scope, return `supported` (`score: 100`, `AUTHORITATIVE_PRIMARY_SUPPORT`).
   - If only reputable secondary sources confirm the proposition without contradiction, return `supported` (`score: 75`, `INDIRECT_CREDIBLE_SUPPORT`).
6. **Step 6 (Fallback):** If no decisive evidence exists, return `insufficient_evidence` (`score: null`, `INSUFFICIENT_RETRIEVAL_DATA`).

---

## 9. Categorical Score Semantics

Scores in Afterfact represent **epistemic certainty heuristics**, not continuous statistical probabilities or machine learning confidence ratings:

| Score | Epistemic Meaning | Applicable Verdicts | Reason Code Example |
| :---: | :--- | :--- | :--- |
| **`100`** | Direct primary authoritative support under matching scope and valid target timeframe. | `supported` | `AUTHORITATIVE_PRIMARY_SUPPORT` |
| **`75`** | Indirect credible support from reputable secondary sources; no conflicting evidence found. | `supported` | `INDIRECT_CREDIBLE_SUPPORT` |
| **`0`** | Decisive contradiction by governing authority, or claim is verified to be outdated. | `contradicted`<br>`outdated` | `DECISIVE_CONTRADICTION`<br>`SUPERSEDED_HISTORICAL_CLAIM` |
| **`null`** | Epistemically unresolved; requires user clarification, exhibits source conflict, or lacks data. | `depends_on_context`<br>`conflicting_evidence`<br>`insufficient_evidence` | `ESSENTIAL_CONTEXT_MISSING`<br>`CREDIBLE_SOURCES_DISAGREE`<br>`INSUFFICIENT_RETRIEVAL_DATA` |

> [!CRITICAL]
> **No Continuous Averaging:** Under no circumstances are scores averaged into continuous floats like `84.2%`. Every `null` score is strictly accompanied by a user-facing `scoreReason` and a canonical `reasonCode`.

---

## 10. Auditable Decision Record (`DecisionRecord`)

Every claim evaluation culminates in a fully auditable, immutable **`DecisionRecord`** persisted in PostgreSQL:

```typescript
export interface DecisionRecord {
  recordId: string;                 // Stable unique record ID (e.g. "dec_01j98ab...")
  claimTicketId: string;            // Bound ClaimTicket ID
  claimRevision: number;            // Evaluated revision number
  appliedPolicy: string;            // Policy module name (e.g. "pricing", "api", "generic")
  verdict:                          // Final verdict
    | 'supported'
    | 'outdated'
    | 'contradicted'
    | 'depends_on_context'
    | 'conflicting_evidence'
    | 'insufficient_evidence';
  score: 100 | 75 | 0 | null;       // Categorical score rubric
  reasonCode: string;               // Canonical machine reason code
  scoreReason: string;              // Human-readable justification paragraph
  primaryEvidenceIds: string[];     // IDs of assessments that directly granted verdict
  counterEvidenceIds: string[];     // IDs of counterevidence assessments evaluated
  excludedEvidence: Array<{         // Evidence discarded during synthesis
    evidenceId: string;
    exclusionReason: 'wrong_scope' | 'unverifiable_quote' | 'superseded_date' | 'untrusted_source';
  }>;
  extractedQualifiers: VerificationProperty[]; // Final qualifier snapshot used for decision
  temporalBasis: {                  // Evaluated temporal markers
    targetTime: string;
    effectiveDate: string | null;
    publicationDate: string | null;
    transitionEventDate: string | null;
  };
  limitations: string[];            // Explicit epistemic boundaries (e.g. "Excludes enterprise custom contracts")
  traceIds: {                       // Model execution trace references (no private CoT or secret keys)
    researchPlanTraceId?: string;
    assessmentTraceId?: string;
  };
}
```

---

## 11. Surgical Correction Verification

When a claim is determined to be **`outdated`** or **`contradicted`**, the verifier generates a minimal, surgical replacement proposition.

### Verification Lifecycle for Corrections
1. **Targeted Proposition Replacement:** The model generates a replacement phrase targeting *only* the superseded attribute value, preserving the subject and background context.
2. **Recursive Verification Loop:** The candidate replacement is packaged into a new candidate `ClaimTicket` and verified against the identical target context.
3. **Mandatory 100-Score Gate:**
   - A correction diff is emitted **if and only if** the candidate replacement achieves a score of **`100`** (`supported` by primary authority).
   - If the replacement receives score `75`, `0`, or `null`, the correction is suppressed and flagged as `correction_unverified`.
4. **Diff Formatting:** Emits standard unified diff syntax (`- originalText\n+ replacementText`).

---

## 12. Dynamic DAG Mapping & Multi-Pass Model Boundaries

Verification stages map directly to concrete nodes within the persisted Directed Acyclic Graph (DAG) in PostgreSQL:

```
[root_extract_prep] ──► [plan_research] ──► [search_evidence] ──► [extract_evidence]
                                                                          │
  ┌───────────────────────────────────────────────────────────────────────┘
  ▼
[rank_evidence] (optional vector shortlisting if candidates > 4)
  │
  ▼
[assess_evidence] ──► (Ambiguity?) ──► [clarification_wait] ──► [reassess_evidence]
  │                                                                     │
  └───────────────────────────────┬─────────────────────────────────────┘
                                  ▼
                            [decide_claim] ──► [finalize_run]
```

### Multiple Model Passes & Budget Boundaries

| Pass # | Functional Pass | Input Data | Output Contract | DAG Node Binding | Timeout / Budget | Bifrost Fallback |
| :---: | :--- | :--- | :--- | :--- | :---: | :---: |
| **P1** | **Ask Drafting** | User question (max 800 chars) | Candidate factual text | Preparation Phase | 15s / 1 retry | Yes |
| **P2** | **Claim & Property Extraction** | Stored answer text | Atomic claims, UTF-16 spans, `VerificationProperty[]` | `root_extract_prep` / Prep | 12s / 1 retry | Yes |
| **P3** | **Research Planning** | ClaimTicket + properties + target date | `ResearchPlan` (queries, roles, counterevidence) | `plan_research` | 8s / 1 retry | Yes |
| **P4** | **Semantic Assessment** | ClaimTicket + top candidate `EvidenceUnit[]` | `ClaimEvidenceAssessment[]` with quotes & temporal tags | `assess_evidence` | 15s / 1 retry | Yes |
| **P5** | **Targeted Reassessment** | Clarified property + secondary excerpts | Refined `ClaimEvidenceAssessment[]` | `reassess_evidence` | 12s / 1 retry | Yes |
| **P6** | **Correction & Verification** | Contradicted claim + authoritative excerpts | Replacement phrase + validated verification pass | `decide_claim` | 10s / 1 retry | Yes |
