# docs/API.md — Public Server Actions, REST Routes & SSE Contracts

This document specifies the mutation and query boundaries for **Afterfact** (working name: Stale-Answer Detector), detailing both Next.js Server Actions (for browser interactions) and explicit HTTP endpoints (for worker webhooks, recovery, and programmatic API access).

> [!NOTE]
> All actions and endpoints described below represent planned architectural specifications. Shared schemas in `src/lib/contracts/` govern payload types across both browser and programmatic entry points.

---

## 1. Entry Point & Mutation Boundary Architecture

Mutations are partitioned cleanly between **Server Actions** and **HTTP Endpoints**:
1. **Server Actions (Browser Form Mutations):**
   All browser-initiated state mutations execute via thin Next.js Server Actions calling shared server-side application services (`src/server/services/*`) directly in-process. Server Actions **never** call internal HTTP endpoints to reuse business logic.
   - *Security & Isolation:* Server Actions are public network entry points. Every action validates its input against Zod schemas, authenticates the caller via the anonymous `ownerHash` HttpOnly cookie, checks rate limits, and returns minimal payloads.
2. **Explicit HTTP Routes:**
   Retained strictly for external webhooks, background recovery, data queries, and headless programmatic verification:
   - Worker webhook delivery from Upstash QStash (`POST /api/verify/worker`).
   - Signed recovery and reconciliation cron (`POST /api/internal/reconcile`).
   - Report snapshots (`GET /api/runs/{id}`).
   - Server-Sent Events progress stream with sequence replay (`GET /api/runs/{id}/events`).
   - Programmatic verification REST API (`POST /api/v1/verify`), which acts as a thin HTTP adapter to the same core services.

### Boundary Matrix

| Entry Point | Protocol / Mechanism | Access / Auth | Purpose |
| :--- | :--- | :--- | :--- |
| `startPreparationAction` | Server Action (RPC) | Anonymous Cookie (`ownerHash`) | Submit pasted text or question to extract claims and context qualifiers. |
| `confirmPreparationAction` | Server Action (RPC) | Anonymous Cookie (`ownerHash`) | Confirm reviewed claims/context and materialize the dynamic DAG run. |
| `submitClarificationAction`| Server Action (RPC) | Anonymous Cookie (`ownerHash`) | Submit answers (or "I don't know") to unblock paused DAG claim branches. |
| `compareAction` | Server Action (RPC) | Anonymous Cookie (`ownerHash`) | Spawn linked child run (`parentRunId`) under an alternate context qualifier. |
| `recheckAction` | Server Action (RPC) | Anonymous Cookie (`ownerHash`) | Spawn linked child run (`parentRunId`) with fresh live web retrieval. |
| `POST /api/v1/verify` | HTTP REST API | Bearer Token / Anonymous Session | Programmatic verification endpoint; delegates to shared `VerificationService`. |
| `GET /api/runs/{id}` | HTTP GET | Owner Scoped (`ownerHash`) | Read-back sanitized run snapshot, claims, evidence, and public DAG state. |
| `GET /api/runs/{id}/events` | HTTP SSE | Owner Scoped (`ownerHash`) | Subscribe to live Server-Sent Events with monotonic sequence replay (`?afterSeq=N`). |
| `POST /api/verify/worker` | HTTP POST (Signed Webhook) | Upstash QStash Signature | Worker execution endpoint for asynchronous DAG node tasks. |
| `POST /api/internal/reconcile` | HTTP POST (Signed Cron) | Admin Secret / Cron Signature | Background sweeper for stuck nodes, expired leases, and unclosed runs. |

---

## 2. Server Action Specifications (Browser Mutations)

### 1. `startPreparationAction`
Initiates the interactive preparation workflow. Binds extraction to `inputHash`.

```typescript
export async function startPreparationAction(
  input: StartPreparationInput
): Promise<PreparationResult>
```

#### Input Payload
```json
{
  "mode": "paste",
  "text": "Stripe charges 2.9% + 30 cents per transaction in the US. In the UK, it charges 1.4% + 20p for European cards. Parag Agrawal is the current CEO of Twitter.",
  "originalQuestion": "What are Stripe's processing fees and who runs Twitter?",
  "baseContext": {
    "targetDate": "2026-11-08",
    "jurisdiction": "US",
    "currency": "USD"
  },
  "idempotencyKey": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d"
}
```

#### Minimal Return Payload
```json
{
  "prepId": "prep_01j98ab7cd6ef8gh9jk01lmno1",
  "inputHash": "a3f5b72c91823d4e8f17a9c8b2e1d0f5a7b9c1d3e5f7a9b1c3d5e7f9a1b3c5d7",
  "status": "ready",
  "claims": [
    {
      "id": "clm_draft_01",
      "ordinal": 0,
      "originalStatement": "Stripe charges 2.9% + 30 cents per transaction in the US.",
      "normalizedProposition": "Stripe standard processing fee is 2.9% plus $0.30 per transaction in the United States",
      "sourceSpan": { "start": 0, "end": 57 },
      "verificationContext": [
        {
          "key": "jurisdiction",
          "label": "Geographic Jurisdiction",
          "propertyType": "string",
          "value": "US",
          "origin": "explicit_claim_text",
          "sourceSpan": { "start": 54, "end": 56 },
          "status": "confirmed",
          "applicability": "claim_level"
        },
        {
          "key": "currency",
          "label": "Currency",
          "propertyType": "string",
          "value": "USD",
          "units": "cents",
          "origin": "explicit_claim_text",
          "sourceSpan": { "start": 21, "end": 29 },
          "status": "confirmed",
          "applicability": "claim_level"
        },
        {
          "key": "billingTerm",
          "label": "Billing Commitment",
          "propertyType": "selection",
          "value": "per_transaction",
          "origin": "model_inferred",
          "status": "pending_review",
          "applicability": "claim_level"
        }
      ]
    },
    {
      "id": "clm_draft_02",
      "ordinal": 1,
      "originalStatement": "Parag Agrawal is the current CEO of Twitter.",
      "normalizedProposition": "Parag Agrawal currently holds the position of Chief Executive Officer at Twitter",
      "sourceSpan": { "start": 128, "end": 172 },
      "verificationContext": [
        {
          "key": "entity",
          "label": "Corporate Entity",
          "propertyType": "string",
          "value": "Twitter",
          "origin": "explicit_claim_text",
          "sourceSpan": { "start": 164, "end": 171 },
          "status": "confirmed",
          "applicability": "claim_level"
        },
        {
          "key": "executiveRole",
          "label": "Executive Role",
          "propertyType": "string",
          "value": "CEO",
          "origin": "explicit_claim_text",
          "sourceSpan": { "start": 157, "end": 160 },
          "status": "confirmed",
          "applicability": "claim_level"
        }
      ]
    }
  ],
  "clarificationNeeded": false
}
```

---

### 2. `confirmPreparationAction`
Confirms the prepared claims, applies target context overrides to claims lacking explicit scope, creates the run and initial DAG nodes in PostgreSQL, and enqueues root tasks to QStash.

```typescript
export async function confirmPreparationAction(
  input: ConfirmPreparationInput
): Promise<ConfirmResult>
```

#### Input Payload
```json
{
  "prepId": "prep_01j98ab7cd6ef8gh9jk01lmno1",
  "inputHash": "a3f5b72c91823d4e8f17a9c8b2e1d0f5a7b9c1d3e5f7a9b1c3d5e7f9a1b3c5d7",
  "contextOverrides": {
    "targetDate": "2026-11-08",
    "jurisdiction": "US"
  }
}
```

#### Minimal Return Payload
```json
{
  "runId": "run_01j98ab7cd6ef8gh9jk01lmno2",
  "state": "running",
  "streamUrl": "/api/runs/run_01j98ab7cd6ef8gh9jk01lmno2/events"
}
```

---

### 3. `submitClarificationAction`
Submits user responses for clarification questions generated during initial preparation or discovered dynamically by a research node. Supports "I don't know" values.

```typescript
export async function submitClarificationAction(
  input: SubmitClarificationInput
): Promise<ClarificationSubmitResult>
```

#### Input Payload
```json
{
  "runId": "run_01j98ab7cd6ef8gh9jk01lmno2",
  "questionId": "clar_01j98ab8q1",
  "questionVersion": 1,
  "answers": {
    "tier": "enterprise",
    "billingCycle": "unknown"
  }
}
```

#### Minimal Return Payload
```json
{
  "runId": "run_01j98ab7cd6ef8gh9jk01lmno2",
  "questionId": "clar_01j98ab8q1",
  "status": "unblocked",
  "unblockedNodes": ["node_assess_01j98ab8e2"]
}
```

---

### 4. `compareAction` & `recheckAction`
- `compareAction`: Accepts `{ runId, claimId, targetContext }`, creates a child run linked via `parentRunId`, materializes the comparison DAG, and returns `{ parentRunId, childRunId, streamUrl }`.
- `recheckAction`: Accepts `{ runId }`, triggers fresh web retrieval across the run's claims, and returns `{ parentRunId, childRunId, streamUrl }`.

---

## 3. Explicit HTTP Route Contracts

### `POST /api/v1/verify` (Programmatic Verification API)
Headless REST endpoint for developers and automated testing. Calls `VerificationService` directly.

#### Headers
- `Content-Type: application/json`
- `Idempotency-Key: <UUID>` *(Optional client idempotency key)*

#### Request Body
```json
{
  "mode": "paste",
  "answerText": "Stripe charges 2.9% + 30 cents per transaction in the US.",
  "originalQuestion": "What are Stripe's US fees?",
  "context": {
    "targetDate": "2026-11-08",
    "jurisdiction": "US",
    "currency": "USD"
  },
  "autoConfirm": true
}
```

#### Response (`202 Accepted`)
```json
{
  "runId": "run_01j98ab7cd6ef8gh9jk01lmno2",
  "state": "running",
  "createdAt": "2026-11-08T00:00:00Z",
  "snapshotUrl": "/api/runs/run_01j98ab7cd6ef8gh9jk01lmno2",
  "streamUrl": "/api/runs/run_01j98ab7cd6ef8gh9jk01lmno2/events"
}
```

---

### `GET /api/runs/{id}`
Returns a point-in-time snapshot of the run, all claims, extracted evidence, and the sanitized public DAG state.

#### Headers
- `Cache-Control: no-store`

#### Response (`200 OK`)
```json
{
  "id": "run_01j98ab7cd6ef8gh9jk01lmno2",
  "parentRunId": null,
  "mode": "paste",
  "state": "completed",
  "answerText": "Stripe charges 2.9% + 30 cents per transaction in the US. Parag Agrawal is the current CEO of Twitter.",
  "context": {
    "targetDate": "2026-11-08",
    "jurisdiction": "US",
    "currency": "USD"
  },
  "asOfDate": "2026-11-08",
  "createdAt": "2026-11-08T00:00:00Z",
  "finishedAt": "2026-11-08T00:00:14Z",
  "latestSeq": 6,
  "summary": {
    "totalClaims": 2,
    "supported": 1,
    "outdated": 1,
    "contradicted": 0,
    "unresolved": 0,
    "failed": 0
  },
  "claims": [
    {
      "id": "res_01j98ab8e1",
      "claimId": "clm_01j98ab8e1",
      "ordinal": 0,
      "originalStatement": "Parag Agrawal is the current CEO of Twitter.",
      "normalizedProposition": "Parag Agrawal currently holds the position of Chief Executive Officer at Twitter",
      "sourceSpan": { "start": 58, "end": 102 },
      "state": "assessed",
      "verdict": "outdated",
      "score": 0,
      "scoreReason": "Historical validity confirmed (Nov 2021). Superseded by acquisition and Linda Yaccarino appointment in June 2023.",
      "reasonCode": "SUPERSEDED_HISTORICAL_CLAIM",
      "decisionRecord": {
        "recordId": "dec_01j98ab9d1",
        "appliedPolicy": "leadership",
        "verdict": "outdated",
        "score": 0,
        "reasonCode": "SUPERSEDED_HISTORICAL_CLAIM",
        "scoreReason": "Verified past validity as CEO from 2021-11-29. Decisive superseding evidence establishes Linda Yaccarino took office on 2023-06-05.",
        "primaryEvidenceIds": ["asm_01j98ab9a1", "asm_01j98ab9a2"],
        "counterEvidenceIds": ["asm_01j98ab9a2"],
        "excludedEvidence": [],
        "temporalBasis": {
          "targetTime": "2026-11-08",
          "effectiveDate": "2023-06-05",
          "publicationDate": "2023-06-06",
          "transitionEventDate": "2023-06-05"
        },
        "limitations": []
      },
      "timeline": [
        {
          "state": "historical",
          "effectiveDate": "2021-11-29",
          "summary": "Parag Agrawal appointed Chief Executive Officer of Twitter.",
          "evidenceUnitId": "evi_01j98ab9f1"
        },
        {
          "state": "current",
          "effectiveDate": "2023-06-05",
          "summary": "Linda Yaccarino officially assumes role as CEO of Twitter / X.",
          "evidenceUnitId": "evi_01j98ab9f2"
        }
      ],
      "correction": {
        "originalText": "Parag Agrawal is the current CEO of Twitter",
        "replacementText": "Linda Yaccarino is the CEO of X (formerly Twitter)",
        "diff": "- Parag Agrawal is the current CEO of Twitter\n+ Linda Yaccarino is the CEO of X (formerly Twitter)",
        "verified": true,
        "evidenceUnitIds": ["evi_01j98ab9f2"]
      }
    }
  ],
  "sourceDocuments": [
    {
      "id": "doc_01j98ab9d2",
      "url": "https://www.reuters.com/technology/linda-yaccarino-starts-new-role-twitter-ceo-2023-06-06/",
      "finalUrl": "https://www.reuters.com/technology/linda-yaccarino-starts-new-role-twitter-ceo-2023-06-06/",
      "title": "Linda Yaccarino starts as Twitter CEO",
      "publisher": "Reuters",
      "publicationDate": "2023-06-06",
      "effectiveDate": "2023-06-05",
      "sourceRole": "reputable_secondary"
    }
  ],
  "evidenceUnits": [
    {
      "id": "evi_01j98ab9f2",
      "documentId": "doc_01j98ab9d2",
      "verbatimText": "Linda Yaccarino officially took over as chief executive of Twitter on Monday, roughly a month after Elon Musk announced her appointment.",
      "locator": { "charOffsetStart": 142, "charOffsetEnd": 273 },
      "surroundingHeaders": ["Technology", "Twitter Leadership Handover"],
      "extractedProperties": [
        { "key": "executiveRole", "value": "chief executive", "propertyType": "string", "origin": "explicit_claim_text" },
        { "key": "entity", "value": "Twitter", "propertyType": "string", "origin": "explicit_claim_text" }
      ]
    }
  ],
  "claimEvidenceAssessments": [
    {
      "id": "asm_01j98ab9a2",
      "claimId": "clm_01j98ab8e1",
      "evidenceUnitId": "evi_01j98ab9f2",
      "claimRevision": 1,
      "relationship": "contradicts",
      "quotationVerified": true,
      "temporalApplicability": "active_at_target_time",
      "sourceSuitability": "credible_secondary",
      "reasoning": "Passage directly refutes assertion that Parag Agrawal is current CEO, confirming Linda Yaccarino assumed the role on 2023-06-05."
    }
  ],
  "dag": {
    "totalNodes": 8,
    "completedNodes": 8,
    "activeStage": "finalized",
    "clarificationAwaiting": false
  }
}
```

---

### `GET /api/runs/{id}/events` (SSE Progress Stream)
Server-Sent Events endpoint streaming ordered progress records.

#### Query Parameters
- `afterSeq`: Integer representing the client's last observed event sequence number.

#### Event Protocol
```
event: run_started
data: {"runId":"run_01j98ab7cd6ef8gh9jk01lmno2","seq":1,"mode":"paste","textLength":102}

event: claims_identified
data: {"runId":"run_01j98ab7cd6ef8gh9jk01lmno2","seq":2,"claims":[{"id":"clm_01j98ab8e1","ordinal":0,"span":{"start":58,"end":102},"text":"Parag Agrawal is the current CEO of Twitter."}]}

event: dag_progress
data: {"runId":"run_01j98ab7cd6ef8gh9jk01lmno2","seq":3,"completedNodes":3,"totalNodes":6,"currentAction":"Evaluating web passages"}

event: clarification_requested
data: {"runId":"run_01j98ab7cd6ef8gh9jk01lmno2","seq":4,"questionId":"clar_01j98ab8q1","fieldKey":"jurisdiction","label":"Which country's pricing applies?"}

event: claim_result
data: {"runId":"run_01j98ab7cd6ef8gh9jk01lmno2","seq":5,"claimId":"clm_01j98ab8e1","verdict":"outdated","score":0,"reasonCode":"SUPERSEDED_HISTORICAL_CLAIM"}

event: run_finished
data: {"runId":"run_01j98ab7cd6ef8gh9jk01lmno2","seq":6,"state":"completed","summary":{"totalClaims":1,"supported":0,"outdated":1}}
```

#### Reconnection Protocol
1. Client tracks highest received `seq`.
2. On disconnect, reconnects with `GET /api/runs/{id}/events?afterSeq=N`.
3. Server replays missing rows from `events` table where `seq > afterSeq`.
4. If reconnect fails after 3 attempts, client falls back to 2-second snapshot polling on `GET /api/runs/{id}`.

---

### `POST /api/verify/worker` (Signed QStash Worker Delivery)
HTTP entry point for QStash webhook dispatching DAG node executions.

#### Headers
- `Upstash-Signature`: Cryptographic signature verified using `QSTASH_CURRENT_SIGNING_KEY` (or `QSTASH_NEXT_SIGNING_KEY`). Missing/invalid signatures fail with `401 Unauthorized`.

#### Request Body
```json
{
  "runId": "run_01j98ab7cd6ef8gh9jk01lmno2",
  "nodeId": "node_assess_01j98ab8e1",
  "attempt": 1
}
```

---

### `POST /api/internal/reconcile` (Signed Recovery Sweeper)
Recurring endpoint invoked via Vercel Cron or signed admin token. Sweeps expired leases, stranded unpaused nodes, and undispatched eligible successors.

---

## 4. Error Handling & Reason Codes

All error responses adhere to RFC 7807 Problem Details:

```json
{
  "type": "https://afterfact.dev/errors/validation-failed",
  "title": "Validation Failed",
  "status": 400,
  "detail": "Input exceeds maximum limit of 8,000 characters.",
  "code": "INPUT_EXCEEDS_MAX_LENGTH",
  "instance": "/api/v1/verify"
}
```

| HTTP Status | Reason Code | Trigger Condition |
| :---: | :--- | :--- |
| `400` | `INVALID_PAYLOAD_SHAPE` | Request payload fails Zod schema validation. |
| `400` | `INPUT_EMPTY_OR_WHITESPACE` | Submitted text contains only whitespace. |
| `400` | `INPUT_EXCEEDS_MAX_LENGTH` | Text exceeds 8,000 characters or question exceeds 800. |
| `404` | `RUN_NOT_FOUND` | Run does not exist or cookie does not match `ownerHash`. |
| `409` | `STALE_PREPARATION_REVISION`| Text was edited after preparation; requires fresh extraction. |
| `409` | `STALE_QUESTION_VERSION` | Clarification answer submitted for superseded question version. |
| `409` | `LEASE_LOST_CONFLICT` | Worker lease expired or stolen by recovery sweeper. |
| `409` | `IDEMPOTENCY_KEY_CONFLICT` | Reusing idempotency key with differing payload. |
| `429` | `RATE_LIMIT_EXCEEDED` | Owner exceeded rate limit (10 runs / 10 minutes). |
| `500` | `INTERNAL_GATEWAY_ERROR` | Sanitized system failure; raw credentials/traces are scrubbed. |
