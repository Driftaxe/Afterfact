# docs/DEMO-AND-SUBMISSION.md — Judge Script, Sponsor Integrations & Submission

This document outlines the 3-minute hackathon demonstration script, sponsor integration evidence points, live demo fallbacks, and the submission package for **Afterfact** (working name: Stale-Answer Detector).

> [!IMPORTANT]
> Target dates referenced in this document (Nov 7–15, 2026 IST) reflect internal engineering milestone targets. The official organizer submission deadline must be explicitly verified and takes absolute priority.

---

## 1. Hackathon Demonstration Walkthrough (3-Minute Script)

### Minute 0:00 – 0:45: The Problem & The Hook
- **Narrative:** "Large language models hallucinate facts, but an even more insidious problem is *temporal drift*: models stating facts that were 100% true when trained, but are now outdated, deprecated, or legally superseded. Trusting stale answers leads to broken code, pricing errors, and regulatory fines."
- **Action:** Open Afterfact production URL. The workspace displays a clean 55:45 split interface.
- **Input:** Paste a realistic AI answer covering four distinct domains:
  1. *Pricing:* Anthropic Claude Pro pricing.
  2. *API:* Stripe `payment_method_types` parameter requirement.
  3. *Regulation:* EU AI Act compliance enforcement date.
  4. *Leadership:* Twitter / X CEO.

### Minute 0:45 – 1:45: The Live Verification Engine in Action
- **Action:** Click **Verify Answer**.
- **Progress:** Live SSE stream illuminates the text. Atomic claim spans highlight in real time as QStash fans out claim jobs.
- **Result Inspection:**
  - Click on the **Leadership** claim: Parag Agrawal as Twitter CEO is marked **Outdated**.
  - Show the **Then vs. Now** timeline: Displays Parag's 2021 appointment, Elon Musk's acquisition, and Linda Yaccarino's official assumption of the CEO role.
  - Point to the **Exact Clickable Excerpt**: Highlight the quoted sentence from the official Reuters press release.
  - Show the **Correction Diff**: Click to copy the surgically corrected sentence.

### Minute 1:45 – 2:30: Context Comparison & Scheduled Changes
- **Action 1 (Scheduled Change):** Click the **Regulation** claim (EU AI Act). Point to the **Scheduled change** badge. Explain that while the act was adopted, general obligations take effect August 2025; Afterfact correctly avoids marking today's claim stale while warning the user of the upcoming change.
- **Action 2 (Context Compare):** Click the **Stripe API** claim. Open the **Compare** drawer. Change the API version from `2020-08-27` to `2024-06-20`. Show that the claim verdict flips from **Supported** to **Outdated** without modifying the user's original text.

### Minute 2:30 – 3:00: Benchmark & Architecture Transparency
- **Action:** Open the **Eval & Architecture** modal.
- **Show Sponsor Integrations:**
  - **Tavily:** Query-aware live passage extraction with zero scraper maintenance.
  - **Bifrost:** Model gateway metrics showing primary model latency and automated fallback routing.
  - **Neon & QStash:** Durable async background fan-out ensuring zero dropped jobs.
- **Show Benchmark Results:** Present paired accuracy and false reassurance reduction compared to naive single-prompt search.

---

## 2. Sponsor Integration Proof Matrix

| Sponsor / Technology | Integration Mechanism | Observable Verification in Demo |
| :--- | :--- | :--- |
| **Bifrost Gateway** | Model gateway reverse-proxied over HTTPS; handles structured JSON output for extraction and assessment with automated profile failover. | Inspection of request traces in admin logs showing model routing, fallback readiness, and token usage. |
| **Tavily API** | Direct REST integration using `/search` and `/extract` for targeted raw web passages. | Exact quoted passages on evidence cards linking directly to retrieved live URLs with publication metadata. |
| **Neon PostgreSQL** | Serverless PostgreSQL storing runs, claims, evidence, and lease outbox using Prisma ORM and connection pooling. | Durable runs that survive page reloads and browser disconnects; atomic database-clock lease fencing. |
| **Upstash QStash** | Signed webhook delivery with flow control capping concurrent claim verification jobs to 3. | Background job fan-out visible in network tab (`/api/internal/jobs` receiving signed deliveries). |

---

## 3. Labeled Replay Fallback Mode

> [!CAUTION]
> If live conference Wi-Fi fails or upstream external search APIs experience transient downtime during presentation:

1. Click the **Demo Mode** toggle in the footer or append `?mode=fixture` to the URL.
2. The UI immediately activates the local deterministic fixture suite (`fixtures/golden-mixed-report.json`).
3. The interface renders an amber header badge: **`[REPLAY MODE: Cached Fixture Data]`**.
4. All interactions (claim highlighting, Then vs. Now, Compare drawer, Correction diff) function identically, guaranteeing a flawless presentation without misrepresenting live network status.

---

## 4. Submission Checklist

- [ ] **Live Public URL:** Deployed on Vercel with HTTPS and public DNS.
- [ ] **Bifrost Gateway:** Deployed on Railway with persistent volume `/app/data` and HTTPS ingress; admin console secured.
- [ ] **Demo Video:** 3-minute screen recording demonstrating the mixed-domain answer, context compare, and correction diff.
- [ ] **GitHub Repository:** Clean repository with documentation, open-source license, and clean CI checks.
- [ ] **Benchmark Disclosure:** Denominators for paired accuracy, false reassurance rate, and p50/p95 latency recorded honestly in [docs/TESTING-AND-EVALUATION.md](TESTING-AND-EVALUATION.md).
- [ ] **Submission Receipt:** Timestamped confirmation saved from the official hackathon submission portal.
