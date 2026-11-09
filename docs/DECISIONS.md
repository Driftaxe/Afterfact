# docs/DECISIONS.md — Architectural Decision Records (ADRs)

This document tracks the foundational architectural decisions made for **Afterfact** (working name: Stale-Answer Detector).

---

### ADR-001: Next.js App Router Full-Stack Architecture
- **Status:** Approved
- **Date:** 2026-11-07
- **Choice:** Use Next.js 15+ App Router with TypeScript and Tailwind CSS on Node 22 with pnpm.
- **Rationale:** Minimizes operational complexity for a 3-person hackathon team by co-locating serverless API endpoints, worker handlers, and React Server/Client Components in a unified TypeScript repository.
- **Unresolved Questions:** Vercel function execution timeout on hobby/free plans (15–60s) requires strict enforcement of the 35s job budget or splitting work across multiple QStash jobs.

---

### ADR-002: Dual-Tier Relational Persistence with Neon PostgreSQL
- **Status:** Superseded by [ADR-022](#adr-022-prisma-orm-for-application-persistence-and-migrations)
- **Date:** 2026-11-07
- **Choice:** Use Neon PostgreSQL with Drizzle ORM and `pg` connection pooling.
- **Rationale:** Verification runs require relational consistency (foreign keys, atomic multi-table commits, monotonic event sequencing) and transactional lease fencing. Neon provides instant serverless branching and pooling.
- **Unresolved Questions:** Ensuring direct connection URL (`DATABASE_MIGRATION_URL`) is strictly isolated from pooled runtime traffic (`DATABASE_URL`).

---

### ADR-003: Model Gateway Isolation with Bifrost in Docker
- **Status:** Superseded by [ADR-023](#adr-023-railway-hosted-bifrost-and-docker-free-local-development)
- **Date:** 2026-11-07
- **Choice:** Deploy Bifrost gateway on a dedicated always-on Docker host behind HTTPS; configure automated fallback profiles.
- **Rationale:** Prevents exposing model provider API keys in application bundles; centralizes rate limiting, latency metrics, and seamless failover between LLM providers during live evaluation.
- **Unresolved Questions:** Need confirmation from Builder B on the hosting provider and static IP for the Docker host.

---

### ADR-004: Direct Web Grounding via Tavily Search & Extract
- **Status:** Approved
- **Date:** 2026-11-07
- **Choice:** Integrate Tavily Cloud REST API for web search and query-aware raw passage extraction.
- **Rationale:** Eliminates the burden of building custom scrapers, headless browsers, or HTML cleaners. Tavily provides fresh, query-relevant passages and reliable publisher metadata.
- **Unresolved Questions:** Rate limits and credit quotas on the hackathon plan under sustained benchmark evaluation.

---

### ADR-005: Deterministic TypeScript Rules Over Probabilistic LLM Scoring
- **Status:** Approved
- **Date:** 2026-11-07
- **Choice:** LLMs extract atomic claims and evaluate passage relevance; deterministic TypeScript code evaluates dates, checks scope, determines verdicts, and assigns scores: `supported` -> 100 or 75; `outdated` or `contradicted` -> 0; unresolved (`depends_on_context`, `conflicting_evidence`, `insufficient_evidence`) -> `null` with machine reason code and explanation.
- **Rationale:** LLMs are notoriously unreliable at arithmetic, temporal math, and consistent scoring rubrics. Deterministic code guarantees reproducibility, zero score drift, and auditable decision trees.
- **Unresolved Questions:** None. Validated in UPPR Rev 4 experiments.

---

### ADR-006: Asynchronous Job Outbox with Upstash QStash
- **Status:** Approved
- **Date:** 2026-11-07
- **Choice:** Employ transactional outbox in PostgreSQL with QStash signed HTTP delivery and concurrency flow control (cap at 3 concurrent claims).
- **Rationale:** Web search and LLM evaluation take 5–15 seconds per claim. Synchronous HTTP requests would exceed Vercel gateway timeouts and drop state upon client disconnection.
- **Unresolved Questions:** Verifying QStash signature validation behavior behind reverse proxies or Vercel deployment protection.

---

### ADR-007: Anonymous Cookie-Based Run Ownership & 24-Hour Retention
- **Status:** Approved
- **Date:** 2026-11-07
- **Choice:** Issue an anonymous `ownerHash` HttpOnly cookie for session tracking; enforce 24-hour expiration on all runs with cascading deletion.
- **Rationale:** Eliminates authentication friction for hackathon judges while strictly preventing cross-user data leakage. Ephemeral retention minimizes database storage costs.
- **Unresolved Questions:** Whether to offer an explicit "Share Report" public permalink mode in future releases.

---

### ADR-008: Preserving Original Input Text with UTF-16 Spans
- **Status:** Approved
- **Date:** 2026-11-07
- **Choice:** Store claim highlights as exact UTF-16 character offsets into the unmodified source text.
- **Rationale:** Guarantees that rendering highlights on the frontend never alters or corrupts the user's input text, and ensures unambiguous text alignment.
- **Unresolved Questions:** Handling whitespace edge cases in multiline copy-pasted blocks.

---

### ADR-009: Strict Three-Date Separation Invariant
- **Status:** Approved
- **Date:** 2026-11-07
- **Choice:** Explicitly differentiate between Publication Date ($T_{\text{pub}}$), Announcement Date ($T_{\text{announce}}$), and Effective Date ($T_{\text{effective}}$).
- **Rationale:** Prevents the major failure mode of marking current facts outdated simply because a future replacement or deprecation has been announced.
- **Unresolved Questions:** None. Enforced via `transition.ts`.

---

### ADR-010: Explicit Separation of Live Production and Labeled Replay Mode
- **Status:** Approved
- **Date:** 2026-11-07
- **Choice:** Live web retrieval is the production default. Cached fixture replay is supported but must display a prominent `[REPLAY MODE]` banner.
- **Rationale:** Ensures complete intellectual honesty during judging while providing a reliable fallback in case of conference network outages.
- **Unresolved Questions:** None.

---

### ADR-011: Server Actions for Web Mutations with Dedicated Endpoints for Infrastructure & Streaming
- **Status:** Approved
- **Date:** 2026-11-08
- **Choice:** Implement browser mutations (start preparation, confirm preparation, submit clarification answers, compare context, recheck run) via thin Next.js Server Actions that call shared server-side application services (`src/server/services/*`). Keep dedicated HTTP endpoints for QStash delivery, signed recovery cron, SSE progress streaming, report snapshots, and the programmatic REST API adapter.
- **Rationale:** Server Actions eliminate boilerplate client-side fetching code and provide type-safe RPC semantics for the Next.js frontend, while calling shared server services directly in-process without making unnecessary self-referential HTTP loopback requests. Server Actions are treated as untrusted public network entry points enforcing input schema validation, anonymous cookie ownership (`ownerHash`), client idempotency, and rate limits.
- **Unresolved Questions:** None.

---

### ADR-012: Bounded Reconnectable SSE Progress Transport (Rejecting Pusher)
- **Status:** Approved
- **Date:** 2026-11-08
- **Choice:** Stream live progress through Next.js Server-Sent Events (`GET /api/runs/[id]/events`) backed by an append-only `events` database table with sequence numbers (`seq`), replay support (`?afterSeq=N`), and automatic 2-second snapshot polling fallback. Explicitly reject Pusher or third-party WebSocket hosted services.
- **Rationale:** SSE runs natively over HTTP/2 with zero third-party dependencies, vendor accounts, or billing surprises. Persisting ordered events in PostgreSQL guarantees that clients can reconnect and replay missed events after transient network disconnects. Crucially, the lifetime of an SSE connection is completely decoupled from job execution: workers execute and commit state asynchronously regardless of whether a browser is actively connected.
- **Unresolved Questions:** None.

---

### ADR-013: Full Persisted Dynamic DAG in PostgreSQL with QStash Bounded Concurrency
- **Status:** Approved (Supersedes static pipeline assumption in ADR-006)
- **Date:** 2026-11-08
- **Choice:** Manage verification execution via a full dynamic Directed Acyclic Graph (DAG) persisted in PostgreSQL (`dag_nodes` / unified `jobs` and `dag_edges`). Graph nodes represent discrete work units (extraction, search, assessment, scoring, clarification wait, finalization) that execute with bounded concurrency (up to 3 parallel claim branches) via Upstash QStash.
- **Rationale:** Real-world verification cannot be modeled as a rigid, static 2-step pipeline. Complex claims require runtime graph expansion (e.g. discovering ambiguous facts that trigger clarification subgraphs or targeted secondary searches), dependency conditions (`on_success` vs `on_terminal`), pausing for human clarification without holding active worker leases, and deterministic failure propagation with skipped descendants. Storing the graph and execution state in PostgreSQL provides ACID transaction guarantees, lease-fenced commits, cycle rejection, and auditability.
- **Unresolved Questions:** Ensuring QStash fan-out dispatch records commit within the same transaction as node status updates before external message delivery.

---

### ADR-014: Interactive Preparation, Context Review, and Revision Binding Workflow
- **Status:** Approved
- **Date:** 2026-11-08
- **Choice:** Introduce an explicit interactive preparation phase prior to verification execution: `Submit Input` $\longrightarrow$ `Extract Claims & Context` $\longrightarrow$ `Review / Correct Context` $\longrightarrow$ `Clarify Ambiguity (if needed)` $\longrightarrow$ `Confirm & Begin Verification`. Preparation is persisted and cryptographically bound to an `inputHash` (SHA-256 of text + prompt).
- **Rationale:** Running expensive web retrieval and multi-model evaluations against misextracted claims or incorrect default contexts wastes budget and frustrates users. Explicitly separating (1) explicit extracted values with text spans, (2) model-inferred suggestions, (3) user-provided target context, and (4) unknown values gives the user ownership over what is verified. Crucially, the engine enforces the invariant that user-supplied target context never overwrites or mutates an explicit qualifier extracted directly from the claim text. Editing input text immediately invalidates stale preparation.
- **Unresolved Questions:** None.

---

### ADR-015: Generic Dynamic Clarification Forms and Bounded Clarification Protocol
- **Status:** Approved
- **Date:** 2026-11-08
- **Choice:** Standardize domain clarifications through a generic, accessible form renderer accepting five approved field types: `select`, `short text`, `date`, `number`, and `boolean`. Known domains use predefined qualifier schemas; novel domains use model-proposed qualifiers validated against a strict meta-schema. Clarifications support "I don't know" options and are bounded to at most 2 rounds before proceeding with unresolved verdicts.
- **Rationale:** Clarification questions must provide pure structured data, never executable JSX, client scripts, or arbitrary validation code. Questions and submitted answers are validated server-side against stored version numbers and owner hashes. Unaffected claim branches in the DAG continue executing in parallel while a paused branch awaits clarification, preventing one ambiguous claim from blocking the entire report.
- **Unresolved Questions:** None.

---

### ADR-016: Explicit Multi-Pass Model Responsibilities and Budget Fencing
- **Status:** Approved
- **Date:** 2026-11-08
- **Choice:** Partition LLM interactions into six strictly bounded functional passes: (1) Drafting for Ask mode, (2) Claim/context extraction and preparation, (3) Conditional clarification planning, (4) Passage relevance assessment, (5) Conditional targeted reassessment, and (6) Correction generation and verification. Extraction and context preparation share a single invocation.
- **Rationale:** Decoupling model responsibilities prevents prompt bloat and eliminates conflicting instructions. Each pass operates under fixed prompt budgets, isolated execution timeouts, single retry limits, and dedicated Bifrost fallback profiles. Deterministic TypeScript code retains absolute authority over dates, scoring rubrics, graph scheduling, and verdicts.
- **Unresolved Questions:** None.

---

### ADR-017: Sanitized Public UI Projection and Expandable Execution Graph
- **Status:** Approved
- **Date:** 2026-11-08
- **Choice:** Expose a sanitized public projection of process and run state to the client: active preparation review, stage indicators, awaiting-clarification modals, per-claim outcomes, and final report summaries, accompanied by an optional expandable DAG / run-details inspector.
- **Rationale:** Prevents security and intellectual property leakage by strictly scrubbing worker lease tokens, QStash message IDs, database connection strings, and raw upstream provider stack traces before payloads reach the browser. Raw node counts are projected as progress milestones, never misleadingly presented as estimated remaining time.
- **Unresolved Questions:** None.

---

### ADR-018: Universal Claim Ticket with Variable Typed Property Context
- **Status:** Approved
- **Date:** 2026-11-08
- **Choice:** Model claims using a Universal Claim Ticket (`ClaimTicket`) holding an array of strongly typed context properties (`VerificationProperty`), supporting primitive types (`string`, `number`, `boolean`, `date`, `selection`, `string_list`) and explicit provenance tracking (`explicit_claim_text`, `user_target_context`, `model_inferred`, `unknown`). Novel domains define arbitrary qualifiers using this identical contract without global DDL migrations or executable model code. Explicit claim qualifiers permanently take precedence over user target context.
- **Rationale:** Fixed database schemas fail across diverse domains (pricing vs API versioning vs corporate leadership). Generic unvalidated JSON blobs lead to silent typing errors and uncontrolled prompt drift. A strongly typed property array with explicit provenance guarantees type safety, dynamic domain extensibility, and strict enforcement of the scope precedence invariant.
- **Unresolved Questions:** None.

---

### ADR-019: Decoupled Evidence Architecture (`SourceDocument`, `EvidenceUnit`, `ClaimEvidenceAssessment`)
- **Status:** Approved
- **Date:** 2026-11-08
- **Choice:** Decouple evidence into three distinct persisted entities: `SourceDocument` (document metadata, crawl hash, provenance, publication/effective dates, source role), `EvidenceUnit` (localized extracted passage, locators, header hierarchy, table structures, footnotes, direct properties), and `ClaimEvidenceAssessment` (relational semantic assessment between one specific ClaimTicket revision and an evidence unit, with verbatim quote verification and property matching).
- **Rationale:** Support or contradiction is not an inherent property of a web document or raw passage; it is a relational property between a specific claim revision and an extracted piece of evidence. Conflating document provenance with relational assessment causes duplicate retrieval, corrupts recheck/compare workflows, and prevents surgical auditability. Verbatim quotation verification in TypeScript prevents hallucinated evidence citations.
- **Unresolved Questions:** None.

---

### ADR-020: Vector Similarity Fenced to Candidate Shortlisting (Strictly Excluded from Truth Scoring)
- **Status:** Approved
- **Date:** 2026-11-08
- **Choice:** Strictly confine vector similarity to candidate passage shortlisting and relevance pre-ranking when candidate sets exceed 4 items. Bypassed entirely for candidate sets $\le 4$. Stored simply via in-memory cosine ranking over cached embeddings in PostgreSQL, without an external vector database. Strictly prohibit vector similarity from contributing to or being averaged into public truth scores. Treat counter-hypothesis similarity as experimental and non-blocking.
- **Rationale:** Vector embeddings capture topical relatedness, not epistemic truth or logical consistency. High vector similarity routinely occurs between contradictory assertions (e.g. differing pricing numbers or conflicting dates). Truth scoring in Afterfact is an epistemic certainty heuristic governed by deterministic TypeScript decision gates, primary source authority, and temporal validity, not floating-point cosine similarity.
- **Unresolved Questions:** Evaluation of embedding provider latency under Bifrost vs local embeddings.

---

### ADR-021: Auditable Decision Records and Deterministic Synthesis Decision Gate
- **Status:** Approved
- **Date:** 2026-11-08
- **Choice:** Formalize claim verdict synthesis through an immutable `DecisionRecord` produced by a deterministic TypeScript decision gate executing a strict precedence hierarchy (Scope Filter $\to$ Essential Ambiguity $\to$ Contradiction / Outdated $\to$ Irreconcilable Conflict $\to$ Primary Support $\to$ Secondary Support $\to$ Fallback). Preserve the categorical 100 / 75 / 0 / null score rubric, explicit reason codes, evaluated evidence IDs, counterevidence IDs, and excluded evidence rationales.
- **Rationale:** Asking an LLM to generate the final confidence score or verdict introduces nondeterministic drift, hallucinated compromises, and uncalibrated probabilities. Storing full decision records ensures end-to-end transparency, enables automated regression auditing, and satisfies UPPR Revision 4 invariant-to-proof verification requirements.
- **Unresolved Questions:** None.

---

### ADR-022: Prisma ORM for Application Persistence & Schema Migrations
- **Status:** Approved (Supersedes ADR-002)
- **Date:** 2026-11-10
- **Choice:** Replace Drizzle ORM with Prisma (`@prisma/client` and `prisma` CLI v6.x) as the sole application data layer, schema definition authority (`prisma/schema.prisma`), and migration engine. Configure a dual-connection model in `schema.prisma` targeting Neon PostgreSQL: connection-pooled `DATABASE_URL` (PgBouncer) for runtime queries in Server Actions and QStash workers, and direct unpooled `DIRECT_URL` for DDL migrations (`prisma migrate dev` / `prisma migrate deploy`). Use a global client singleton in `src/server/db/client.ts` for Next.js hot module reloading safety.
- **Rationale:** Drizzle was previously listed as a dependency in `package.json`, but zero Drizzle schema files, migrations, or database queries existed in `src/` (Case A clean replacement). Prisma provides robust declarative schema modeling, strongly typed query builders, automated client generation, migration tracking, and visual database inspection via `prisma studio`. In Vercel's Node.js 22 runtime, standard `@prisma/client` binary engine provides fast in-process query execution. Atomic lease fencing and database-clock calculations (`NOW() + INTERVAL '35 seconds'`) execute cleanly via parameterized raw SQL (`db.$executeRaw` / `db.$queryRaw`), while status updates use Prisma's atomic conditional `updateMany` API.
- **Unresolved Questions:** None.

---

### ADR-023: Railway-Hosted Bifrost and Docker-Free Local Development
- **Status:** Approved (Supersedes ADR-003)
- **Date:** 2026-11-10
- **Choice:** Deploy the Bifrost Model Gateway in staging and production on Railway using the official Maxim AI prebuilt container image (`maximhq/bifrost`), backed by a persistent Railway volume mounted at `/app/data` for Bifrost's internal SQLite database and configuration. Retain a Docker-free local development workflow using the repository's `pnpm bifrost` script (`dotenv -e .env -- pnpm dlx @maximhq/bifrost`) running on `127.0.0.1:8080`.
- **Rationale:** Eliminates the operational overhead and single-point-of-failure of maintaining a custom Ubuntu VM or self-managed Docker host. Railway provides automated container lifecycle management, public HTTPS termination on port 8080, and persistent volume storage ensuring that Bifrost routing rules, API keys, and virtual credentials persist across restarts. Local developers do not need Docker installed, avoiding platform-specific daemon issues on Windows while maintaining full compatibility with the gateway contract.
- **Unresolved Questions:** None.
