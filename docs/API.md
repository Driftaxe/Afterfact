# docs/API.md — Public & Internal HTTP Route Contracts

This document specifies the REST and Server-Sent Events (SSE) interfaces for **Afterfact** (working name: Stale-Answer Detector).

> [!NOTE]
> All endpoints described below represent **proposed** specifications to be implemented in Tasks B04, B05, and B06.

---

## 1. Endpoint & Ownership Matrix

| Endpoint | Method | Access / Auth | Purpose |
| :--- | :---: | :--- | :--- |
| `/api/verify` | `POST` | Public (Anonymous Cookie Session) | Submit pasted text or question for asynchronous verification. |
| `/api/runs/{id}` | `GET` | Owner Scoped (`ownerHash`) | Retrieve full run snapshot, terminal state, and latest sequence. |
| `/api/runs/{id}/events` | `GET` | Owner Scoped (`ownerHash`) | Subscribe to live Server-Sent Events with sequence replay. |
| `/api/runs/{id}/compare` | `POST` | Owner Scoped (`ownerHash`) | Launch context comparison child run on a specific claim. |
| `/api/runs/{id}/recheck` | `POST` | Owner Scoped (`ownerHash`) | Trigger fresh live retrieval child run on an existing report. |
| `/api/internal/jobs` | `POST` | Signed QStash Webhook | Worker execution endpoint for coordinator and claim jobs. |
| `/api/internal/reconcile` | `POST` | Signed Cron / Admin Secret | Periodic sweeper for stuck jobs, lost deliveries, and expired leases. |

---

## 2. Public API Specifications

### `POST /api/verify`
Submits text or a question to start a verification run. Supports client idempotency.

#### Headers
- `Content-Type: application/json`
- `Idempotency-Key: <UUID>` *(Optional client-generated key)*

#### Request Body (Tagged Union)
```json
// Paste Variant (Max 8,000 characters)
{
  "mode": "paste",
  "answerText": "Stripe charges 2.9% + 30 cents per transaction in the US. In the UK, it charges 1.4% + 20p for European cards. Parag Agrawal is the current CEO of Twitter.",
  "originalQuestion": "What are Stripe's processing fees and who runs Twitter?",
  "context": {
    "targetDate": "2026-11-08",
    "jurisdiction": "US",
    "currency": "USD"
  }
}

// Ask Variant (Max 800 characters)
{
  "mode": "ask",
  "question": "What is OpenAI's API pricing for GPT-4o?",
  "context": {
    "targetDate": "2026-11-08",
    "currency": "USD"
  }
}
```

#### Response (`202 Accepted`)
```json
{
  "runId": "run_01j98ab7cd6ef8gh9jk01lmno2",
  "state": "queued",
  "createdAt": "2026-11-08T00:00:00Z",
  "streamUrl": "/api/runs/run_01j98ab7cd6ef8gh9jk01lmno2/events"
}
```

---

### `GET /api/runs/{id}`
Returns the point-in-time snapshot of the run, all claims, and extracted evidence.

#### Headers
- `Cache-Control: no-store`

#### Response (`200 OK`)
```json
{
  "id": "run_01j98ab7cd6ef8gh9jk01lmno2",
  "parentRunId": null,
  "mode": "paste",
  "state": "completed",
  "answerText": "Stripe charges 2.9% + 30 cents per transaction in the US. In the UK, it charges 1.4% + 20p for European cards. Parag Agrawal is the current CEO of Twitter.",
  "context": {
    "targetDate": "2026-11-08",
    "jurisdiction": "US",
    "currency": "USD"
  },
  "asOfDate": "2026-11-08",
  "createdAt": "2026-11-08T00:00:00Z",
  "finishedAt": "2026-11-08T00:00:14Z",
  "latestSeq": 5,
  "summary": {
    "totalClaims": 3,
    "supported": 1,
    "outdated": 1,
    "contradicted": 1,
    "unresolved": 0,
    "failed": 0,
    "pending": 0
  },
  "claims": [
    {
      "id": "res_01j98ab8e1",
      "claimId": "clm_01j98ab8e1",
      "parentClaimId": null,
      "ordinal": 0,
      "rawText": "Parag Agrawal is the current CEO of Twitter.",
      "span": { "start": 128, "end": 172 },
      "state": "assessed",
      "verdict": "outdated",
      "score": 0,
      "scoreReason": "Historical validity confirmed (Nov 2021). Superseded by acquisition and Linda Yaccarino appointment.",
      "reasonCode": "SUPERSEDED_HISTORICAL_CLAIM",
      "evidenceIds": ["evi_01j98ab9f1", "evi_01j98ab9f2"],
      "timeline": [
        {
          "state": "historical",
          "effectiveDate": "2021-11-29",
          "summary": "Parag Agrawal named CEO of Twitter.",
          "evidenceId": "evi_01j98ab9f1"
        },
        {
          "state": "current",
          "effectiveDate": "2023-06-05",
          "summary": "Linda Yaccarino officially assumes role as CEO of Twitter / X.",
          "evidenceId": "evi_01j98ab9f2"
        }
      ],
      "correction": {
        "originalText": "Parag Agrawal is the current CEO of Twitter",
        "replacementText": "Linda Yaccarino is the CEO of X (formerly Twitter)",
        "diff": "- Parag Agrawal is the current CEO of Twitter\n+ Linda Yaccarino is the CEO of X (formerly Twitter)",
        "verified": true,
        "evidenceIds": ["evi_01j98ab9f2"]
      }
    }
  ],
  "evidence": [
    {
      "id": "evi_01j98ab9f2",
      "url": "https://www.reuters.com/technology/linda-yaccarino-starts-new-role-twitter-ceo-2023-06-06/",
      "title": "Linda Yaccarino starts as Twitter CEO",
      "publisher": "Reuters",
      "passage": "Linda Yaccarino officially took over as chief executive of Twitter on Monday, roughly a month after Elon Musk announced her appointment.",
      "retrievedAt": "2026-11-08T00:00:08Z",
      "publicationDate": "2023-06-06",
      "effectiveDate": "2023-06-05"
    }
  ]
}
```

---

### `GET /api/runs/{id}/events`
Server-Sent Events stream for progressive result streaming.

#### Query Parameters
- `afterSeq`: Integer indicating the client's last observed event sequence number.

#### Event Stream Protocol
```
event: run_started
data: {"runId":"run_01j98ab7cd6ef8gh9jk01lmno2","seq":1,"mode":"paste","textLength":172}

event: claims_identified
data: {"runId":"run_01j98ab7cd6ef8gh9jk01lmno2","seq":2,"claims":[{"id":"clm_01j98ab8e1","ordinal":0,"span":{"start":128,"end":172},"text":"Parag Agrawal is the current CEO of Twitter."}]}

event: claim_result
data: {"runId":"run_01j98ab7cd6ef8gh9jk01lmno2","seq":3,"claimId":"clm_01j98ab8e1","verdict":"outdated","score":0,"reasonCode":"SUPERSEDED_HISTORICAL_CLAIM"}

event: run_finished
data: {"runId":"run_01j98ab7cd6ef8gh9jk01lmno2","seq":4,"state":"completed","summary":{"totalClaims":1,"supported":0,"outdated":1}}
```

#### Client Reconnection Rules
1. If the connection terminates unexpectedly, the client reconnects passing `?afterSeq=<latestSeq>`.
2. The server replays any missing events from the `events` table where `seq > afterSeq`.
3. If the stream cannot be re-established after 3 retries, the client drops back to polling `GET /api/runs/{id}` every 2,000ms until terminal state.

---

### `POST /api/runs/{id}/compare`
Initiates a what-if context comparison for a specific claim.

#### Request Body
```json
{
  "claimId": "clm_01j98ab8e1",
  "targetContext": {
    "jurisdiction": "UK",
    "currency": "GBP",
    "billingTerm": "annual"
  }
}
```

#### Response (`202 Accepted`)
```json
{
  "parentRunId": "run_01j98ab7cd6ef8gh9jk01lmno2",
  "childRunId": "run_child_0294810293",
  "state": "queued"
}
```

---

### `POST /api/runs/{id}/recheck`
Triggers fresh real-time retrieval on an existing run.

#### Response (`202 Accepted`)
```json
{
  "parentRunId": "run_01j98ab7cd6ef8gh9jk01lmno2",
  "childRunId": "run_recheck_9837198273",
  "state": "queued"
}
```

---

## 3. Error Handling and Status Codes

All errors conform to RFC 7807 Problem Details:

```json
{
  "type": "https://afterfact.dev/errors/validation-failed",
  "title": "Validation Failed",
  "status": 400,
  "detail": "Input exceeds maximum limit of 8,000 characters.",
  "code": "INPUT_EXCEEDS_MAX_LENGTH",
  "instance": "/api/verify"
}
```

| HTTP Status | Reason Code | Trigger Condition |
| :---: | :--- | :--- |
| `400` | `INVALID_PAYLOAD_SHAPE` | Request failed Zod schema parsing. |
| `400` | `INPUT_EMPTY_OR_WHITESPACE` | Input text contains only spaces or newlines. |
| `404` | `RUN_NOT_FOUND` | Run ID does not exist or cookie does not match `ownerHash`. |
| `409` | `IDEMPOTENCY_KEY_CONFLICT` | Same `Idempotency-Key` submitted with differing body content. |
| `429` | `RATE_LIMIT_EXCEEDED` | Owner exceeded rate limit (max 10 runs per 10 minutes). |
| `500` | `INTERNAL_GATEWAY_ERROR` | Sanitized system failure; raw provider errors are never exposed. |
