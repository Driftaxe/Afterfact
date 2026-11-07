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
- **Status:** Approved
- **Date:** 2026-11-07
- **Choice:** Use Neon PostgreSQL with Drizzle ORM and `pg` connection pooling.
- **Rationale:** Verification runs require relational consistency (foreign keys, atomic multi-table commits, monotonic event sequencing) and transactional lease fencing. Neon provides instant serverless branching and pooling.
- **Unresolved Questions:** Ensuring direct connection URL (`DATABASE_MIGRATION_URL`) is strictly isolated from pooled runtime traffic (`DATABASE_URL`).

---

### ADR-003: Model Gateway Isolation with Bifrost in Docker
- **Status:** Approved
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
- **Choice:** LLMs extract atomic claims and evaluate passage relevance; deterministic TypeScript code evaluates dates, checks scope, determines verdicts, and assigns scores.
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
