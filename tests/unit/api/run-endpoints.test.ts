import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { resolveOwnerHash, OWNER_COOKIE_NAME } from '@/server/services/auth-helper';
import { problemResponse } from '@/server/services/problem-details';
import { POST as verifyPost } from '@/app/api/v1/verify/route';
import { GET as snapshotGet } from '@/app/api/runs/[id]/route';
import { GET as eventsGet } from '@/app/api/runs/[id]/events/route';
import * as runQueryService from '@/server/services/run-query-service';
import { VerificationService } from '@/server/services/verify-service';
import { db } from '@/server/db/client';

describe('Unit: Auth Helper (resolveOwnerHash)', () => {
  it('extracts ownerHash from afterfact_owner cookie', () => {
    const req = new NextRequest('http://localhost:3000/api/runs/test', {
      headers: {
        cookie: `${OWNER_COOKIE_NAME}=cookie_owner_token_123`,
      },
    });

    const resolved = resolveOwnerHash(req);
    expect(resolved.ownerHash).toBe('cookie_owner_token_123');
    expect(resolved.isNew).toBe(false);
  });

  it('hashes Bearer token with SHA-256 when cookie is absent', () => {
    const req = new NextRequest('http://localhost:3000/api/runs/test', {
      headers: {
        authorization: 'Bearer secret_api_key_456',
      },
    });

    const resolved = resolveOwnerHash(req);
    expect(resolved.ownerHash).toHaveLength(64); // SHA-256 hex string
    expect(resolved.isNew).toBe(false);
  });

  it('accepts explicit x-owner-hash header for testing', () => {
    const req = new NextRequest('http://localhost:3000/api/runs/test', {
      headers: {
        'x-owner-hash': 'test_explicit_owner_hash',
      },
    });

    const resolved = resolveOwnerHash(req);
    expect(resolved.ownerHash).toBe('test_explicit_owner_hash');
    expect(resolved.isNew).toBe(false);
  });

  it('generates a fresh UUID-based hash when no credentials present', () => {
    const req = new NextRequest('http://localhost:3000/api/runs/test');

    const resolved = resolveOwnerHash(req);
    expect(resolved.ownerHash).toHaveLength(64);
    expect(resolved.isNew).toBe(true);
    expect(resolved.rawToken).toBeDefined();
  });
});

describe('Unit: Problem Details Helper', () => {
  it('formats RFC 7807 compliant error responses', async () => {
    const res = problemResponse({
      status: 400,
      code: 'INPUT_EMPTY_OR_WHITESPACE',
      title: 'Empty Input',
      detail: 'Answer text cannot be empty or whitespace-only',
      instance: '/api/v1/verify',
    });

    expect(res.status).toBe(400);
    expect(res.headers.get('content-type')).toBe('application/problem+json');
    expect(res.headers.get('cache-control')).toBe('no-store');

    const body = await res.json();
    expect(body).toEqual({
      type: 'https://afterfact.dev/errors/INPUT_EMPTY_OR_WHITESPACE',
      title: 'Empty Input',
      status: 400,
      detail: 'Answer text cannot be empty or whitespace-only',
      instance: '/api/v1/verify',
      code: 'INPUT_EMPTY_OR_WHITESPACE',
      error: 'Answer text cannot be empty or whitespace-only',
    });
  });
});

describe('Unit: POST /api/v1/verify', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 400 INVALID_PAYLOAD_SHAPE for invalid JSON', async () => {
    const req = new NextRequest('http://localhost:3000/api/v1/verify', {
      method: 'POST',
      body: 'invalid-json{',
      headers: { 'content-type': 'application/json' },
    });

    const res = await verifyPost(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('INVALID_PAYLOAD_SHAPE');
  });

  it('returns 400 INPUT_EMPTY_OR_WHITESPACE for whitespace-only answerText', async () => {
    const req = new NextRequest('http://localhost:3000/api/v1/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        mode: 'paste',
        answerText: '   \n\t  ',
      }),
    });

    const res = await verifyPost(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('INPUT_EMPTY_OR_WHITESPACE');
  });

  it('returns 400 INPUT_EXCEEDS_MAX_LENGTH for answerText exceeding 8000 characters', async () => {
    const req = new NextRequest('http://localhost:3000/api/v1/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        mode: 'paste',
        answerText: 'a'.repeat(8001),
      }),
    });

    const res = await verifyPost(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('INPUT_EXCEEDS_MAX_LENGTH');
  });

  it('returns 202 Accepted on valid payload and sets cookie when owner is new', async () => {
    const mockRunResult = {
      runId: 'run_mock_123',
      state: 'running',
      createdAt: '2026-11-12T00:00:00.000Z',
      snapshotUrl: '/api/runs/run_mock_123',
      streamUrl: '/api/runs/run_mock_123/events',
    };

    vi.spyOn(VerificationService, 'runVerification').mockResolvedValue(mockRunResult);

    const req = new NextRequest('http://localhost:3000/api/v1/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        mode: 'paste',
        answerText: 'Stripe charges 2.9% + 30 cents per transaction in the US.',
        originalQuestion: 'What are Stripe fees?',
        autoConfirm: true,
      }),
    });

    const res = await verifyPost(req);
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body).toEqual(mockRunResult);

    // Verify afterfact_owner cookie was set for new caller
    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).toContain(OWNER_COOKIE_NAME);
  });
});

describe('Unit: GET /api/runs/[id]', () => {
  it('returns 404 when run does not exist or owner mismatch', async () => {
    vi.spyOn(runQueryService, 'getSanitizedRunSnapshot').mockResolvedValue(null);

    const req = new NextRequest('http://localhost:3000/api/runs/run_unknown', {
      headers: {
        cookie: `${OWNER_COOKIE_NAME}=test_owner`,
      },
    });

    const res = await snapshotGet(req, {
      params: Promise.resolve({ id: 'run_unknown' }),
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.code).toBe('RUN_NOT_FOUND');
  });

  it('returns 200 with Cache-Control: no-store when snapshot found', async () => {
    const mockSnapshot = {
      id: 'run_mock_456',
      reportId: 'run_mock_456',
      parentRunId: null,
      mode: 'paste',
      state: 'running',
      answerText: 'Sample text',
      question: null,
      context: {},
      createdAt: '2026-11-12T00:00:00.000Z',
      finishedAt: null,
      latestSeq: 2,
      summary: { totalClaims: 1, supported: 0, outdated: 0, contradicted: 0, unresolved: 1, failed: 0 },
      claims: [],
      sourceDocuments: [],
      dagNodes: [],
      dag: { totalNodes: 2, completedNodes: 1, activeStage: 'evaluating', clarificationAwaiting: false },
    };

    vi.spyOn(runQueryService, 'getSanitizedRunSnapshot').mockResolvedValue(mockSnapshot as unknown as Awaited<ReturnType<typeof runQueryService.getSanitizedRunSnapshot>>);

    const req = new NextRequest('http://localhost:3000/api/runs/run_mock_456', {
      headers: {
        cookie: `${OWNER_COOKIE_NAME}=test_owner`,
      },
    });

    const res = await snapshotGet(req, {
      params: Promise.resolve({ id: 'run_mock_456' }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const body = await res.json();
    expect(body.id).toBe('run_mock_456');
    expect(body.reportId).toBe('run_mock_456');
  });
});

describe('Unit: GET /api/runs/[id]/events', () => {
  it('returns 404 when run does not match ownerHash', async () => {
    vi.spyOn(db.verificationRun, 'findUnique').mockResolvedValue(null);

    const req = new NextRequest('http://localhost:3000/api/runs/run_unauthorized/events', {
      headers: {
        cookie: `${OWNER_COOKIE_NAME}=wrong_owner`,
      },
    });

    const res = await eventsGet(req, {
      params: Promise.resolve({ id: 'run_unauthorized' }),
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.code).toBe('RUN_NOT_FOUND');
  });
});
