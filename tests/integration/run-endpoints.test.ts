import './setup-env';
import { hasTestDb } from './setup-env';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '@/server/db/client';
import { createRunAndInitializeDag } from '@/server/services/dag-service';
import { EventService } from '@/server/services/event-service';
import { NextRequest } from 'next/server';
import { GET as snapshotGet } from '@/app/api/runs/[id]/route';
import { GET as eventsGet } from '@/app/api/runs/[id]/events/route';
import { POST as verifyPost } from '@/app/api/v1/verify/route';
import { OWNER_COOKIE_NAME } from '@/server/services/auth-helper';

describe.skipIf(!hasTestDb)('B06 Public Endpoints, SSE Replay & REST Adapter Integration (E3)', () => {
  const testRunIds: string[] = [];

  beforeEach(() => {
    // Isolated per-test setup
  });

  afterEach(async () => {
    if (testRunIds.length > 0) {
      await db.verificationRun.deleteMany({
        where: { id: { in: testRunIds } },
      });
      testRunIds.length = 0;
    }
  });

  it('GET /api/runs/[id]: returns sanitized snapshot with public fields and strictly scrubs private worker leases', async () => {
    const ownerHash = 'test_owner_snapshot_' + Date.now();
    const { run } = await createRunAndInitializeDag({
      ownerHash,
      inputHash: 'hash_snapshot_' + Date.now(),
      text: 'Stripe charges 2.9% + 30 cents per transaction in the US.',
      mode: 'paste',
    });
    testRunIds.push(run.id);

    // Update node with sensitive internal worker lease info
    const testNode = await db.dagNode.findFirst({ where: { runId: run.id } });
    if (testNode) {
      await db.dagNode.update({
        where: { id: testNode.id },
        data: {
          leaseToken: 'super-secret-lease-token',
          leaseOwner: 'worker-instance-42',
          leaseUntil: new Date(Date.now() + 60000),
          outputReference: { bucket: 'private-s3', key: 'internal/ref.json' },
        },
      });
    }

    // 1. Authorized read with matching cookie
    const authReq = new NextRequest(`http://localhost:3000/api/runs/${run.id}`, {
      headers: {
        cookie: `${OWNER_COOKIE_NAME}=${ownerHash}`,
      },
    });

    const res = await snapshotGet(authReq, {
      params: Promise.resolve({ id: run.id }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');

    const data = await res.json();
    expect(data.id).toBe(run.id);
    expect(data.reportId).toBe(run.id);
    expect(data.answerText).toBe(run.text);
    expect(data.mode).toBe('paste');
    expect(data.dag).toBeDefined();
    expect(data.dag.totalNodes).toBeGreaterThanOrEqual(1);

    // STRICT PRIVACY CHECK: Verify private worker fields are NOT present
    for (const node of data.dagNodes) {
      expect(node.leaseToken).toBeUndefined();
      expect(node.leaseUntil).toBeUndefined();
      expect(node.leaseOwner).toBeUndefined();
      expect(node.outputReference).toBeUndefined();
      expect(node.input).toBeUndefined();
      expect(node.output).toBeUndefined();
    }

    // 2. Cross-owner privacy isolation check: Mismatched cookie returns 404 Not Found
    const unauthReq = new NextRequest(`http://localhost:3000/api/runs/${run.id}`, {
      headers: {
        cookie: `${OWNER_COOKIE_NAME}=different_adversary_owner`,
      },
    });

    const unauthRes = await snapshotGet(unauthReq, {
      params: Promise.resolve({ id: run.id }),
    });

    expect(unauthRes.status).toBe(404);
    const errBody = await unauthRes.json();
    expect(errBody.code).toBe('RUN_NOT_FOUND');
  });

  it('GET /api/runs/[id]/events: replays missed events with ?afterSeq=N and enforces owner isolation', async () => {
    const ownerHash = 'test_owner_events_' + Date.now();
    const { run } = await createRunAndInitializeDag({
      ownerHash,
      inputHash: 'hash_events_' + Date.now(),
      text: 'Test run for SSE sequence replay.',
      mode: 'paste',
    });
    testRunIds.push(run.id);

    // Initial run event was seq: 1 (run_started). Add seq: 2, 3, 4
    await db.$transaction(async (tx) => {
      await EventService.recordEvent(tx, run.id, {
        type: 'claims_identified',
        claims: [
          { id: 'clm_1', ordinal: 0, text: 'Test claim 1' },
          { id: 'clm_2', ordinal: 1, text: 'Test claim 2' },
        ],
      });
      await EventService.recordEvent(tx, run.id, {
        type: 'claim_result',
        claimId: 'clm_1',
        verdict: 'supported',
        score: 100,
        reasonCode: 'DIRECT_PRIMARY_GROUNDING',
      });
      await EventService.recordEvent(tx, run.id, {
        type: 'run_finished',
        state: 'completed',
        summary: {
          totalClaims: 2,
          supportedClaims: 1,
          contradictedClaims: 0,
          outdatedClaims: 0,
          indeterminateClaims: 1,
          truthScore: 100,
        },
      });
    });

    // 1. Replay with ?afterSeq=2 -> Should receive only events 3 and 4
    const sseReq = new NextRequest(`http://localhost:3000/api/runs/${run.id}/events?afterSeq=2`, {
      headers: {
        cookie: `${OWNER_COOKIE_NAME}=${ownerHash}`,
      },
    });

    const sseRes = await eventsGet(sseReq, {
      params: Promise.resolve({ id: run.id }),
    });

    expect(sseRes.status).toBe(200);
    expect(sseRes.headers.get('content-type')).toBe('text/event-stream');

    const reader = sseRes.body?.getReader();
    expect(reader).toBeDefined();

    const decoder = new TextDecoder();
    let text = '';
    while (true) {
      const { done, value } = await reader!.read();
      if (done) break;
      text += decoder.decode(value);
    }

    // Must contain id: 3 and id: 4, but NOT id: 1 or id: 2
    expect(text).toContain('id: 3');
    expect(text).toContain('id: 4');
    expect(text).not.toContain('id: 1\n');
    expect(text).not.toContain('id: 2\n');
    expect(text).toContain('claim_result');
    expect(text).toContain('run_finished');

    // 2. Cross-owner check for SSE endpoint
    const unauthReq = new NextRequest(`http://localhost:3000/api/runs/${run.id}/events?afterSeq=0`, {
      headers: {
        cookie: `${OWNER_COOKIE_NAME}=adversary_cookie`,
      },
    });

    const unauthRes = await eventsGet(unauthReq, {
      params: Promise.resolve({ id: run.id }),
    });

    expect(unauthRes.status).toBe(404);
  });

  it('POST /api/v1/verify: validates input, enforces idempotency conflict, and sets cookie', async () => {
    const ownerHash = 'test_owner_v1_' + Date.now();
    const idempotencyKey = 'idemp_key_' + Date.now();

    // 1. Submit valid verification request
    const postReq = new NextRequest('http://localhost:3000/api/v1/verify', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-owner-hash': ownerHash,
        'idempotency-key': idempotencyKey,
      },
      body: JSON.stringify({
        mode: 'paste',
        answerText: 'Stripe charges 2.9% + 30 cents per transaction in the US.',
        originalQuestion: 'What are Stripe fees?',
        autoConfirm: true,
      }),
    });

    const res = await verifyPost(postReq);
    expect(res.status).toBe(202);
    const data = await res.json();

    expect(data.runId).toBeDefined();
    testRunIds.push(data.runId);
    expect(data.state).toBe('running');
    expect(data.snapshotUrl).toBe(`/api/runs/${data.runId}`);
    expect(data.streamUrl).toBe(`/api/runs/${data.runId}/events`);

    // 2. Replay with identical payload and same idempotency key -> Idempotent 202
    const replayReq = new NextRequest('http://localhost:3000/api/v1/verify', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-owner-hash': ownerHash,
        'idempotency-key': idempotencyKey,
      },
      body: JSON.stringify({
        mode: 'paste',
        answerText: 'Stripe charges 2.9% + 30 cents per transaction in the US.',
        originalQuestion: 'What are Stripe fees?',
      }),
    });

    const replayRes = await verifyPost(replayReq);
    expect(replayRes.status).toBe(202);
    const replayData = await replayRes.json();
    expect(replayData.runId).toBe(data.runId);

    // 3. Reusing idempotency key with DIFFERENT payload -> 409 IDEMPOTENCY_KEY_CONFLICT
    const conflictReq = new NextRequest('http://localhost:3000/api/v1/verify', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-owner-hash': ownerHash,
        'idempotency-key': idempotencyKey,
      },
      body: JSON.stringify({
        mode: 'paste',
        answerText: 'Different conflicting text with same key.',
      }),
    });

    const conflictRes = await verifyPost(conflictReq);
    expect(conflictRes.status).toBe(409);
    const conflictData = await conflictRes.json();
    expect(conflictData.code).toBe('IDEMPOTENCY_KEY_CONFLICT');
  });

  it('POST /api/v1/verify: enforces rate limiting (10 runs / 10 minutes)', async () => {
    const rateLimitOwner = 'test_owner_ratelimit_' + Date.now();

    // Create 10 runs in DB for this owner
    for (let i = 0; i < 10; i++) {
      const { run } = await createRunAndInitializeDag({
        ownerHash: rateLimitOwner,
        inputHash: `hash_rl_${i}_${Date.now()}`,
        text: `Run number ${i}`,
        mode: 'paste',
      });
      testRunIds.push(run.id);
    }

    // 11th request must fail with 429 RATE_LIMIT_EXCEEDED
    const eleventhReq = new NextRequest('http://localhost:3000/api/v1/verify', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-owner-hash': rateLimitOwner,
      },
      body: JSON.stringify({
        mode: 'paste',
        answerText: 'Eleventh attempt should be blocked by rate limit.',
      }),
    });

    const res = await verifyPost(eleventhReq);
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.code).toBe('RATE_LIMIT_EXCEEDED');
  });
});
