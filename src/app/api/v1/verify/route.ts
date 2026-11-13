import { NextRequest, NextResponse } from 'next/server';
import { VerificationRequestSchema } from '@/lib/contracts/request';
import { VerificationService } from '@/server/services/verify-service';
import { resolveOwnerHash, OWNER_COOKIE_NAME } from '@/server/services/auth-helper';
import { problemResponse } from '@/server/services/problem-details';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/v1/verify
 * Programmatic REST API endpoint for headless verification and automated benchmarking.
 * Strictly validates against VerificationRequestSchema, checks client idempotency,
 * enforces owner rate limits, and enqueues DAG verification jobs.
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return problemResponse({
      status: 400,
      code: 'INVALID_PAYLOAD_SHAPE',
      title: 'Invalid JSON Payload',
      detail: 'Request body must be valid JSON.',
      instance: '/api/v1/verify',
    });
  }

  if (!body || typeof body !== 'object') {
    return problemResponse({
      status: 400,
      code: 'INVALID_PAYLOAD_SHAPE',
      title: 'Invalid Payload Shape',
      detail: 'Request payload must be an object.',
      instance: '/api/v1/verify',
    });
  }

  // Extract non-contract parameters before strict schema validation
  const rawBody = { ...(body as Record<string, unknown>) };
  delete rawBody.autoConfirm;
  const bodyIdempKey = rawBody.idempotencyKey;
  delete rawBody.idempotencyKey;

  // Validate request against canonical contract schema
  const parsed = VerificationRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    let code = 'INVALID_PAYLOAD_SHAPE';
    let title = 'Invalid Payload Shape';

    if (firstIssue?.message?.includes('cannot be empty or whitespace-only')) {
      code = 'INPUT_EMPTY_OR_WHITESPACE';
      title = 'Empty Input';
    } else if (firstIssue?.message?.includes('exceeds maximum limit')) {
      code = 'INPUT_EXCEEDS_MAX_LENGTH';
      title = 'Input Exceeds Maximum Length';
    }

    return problemResponse({
      status: 400,
      code,
      title,
      detail: firstIssue?.message || 'Request payload failed schema validation.',
      instance: '/api/v1/verify',
      issues: parsed.error.issues,
    });
  }

  const { ownerHash, isNew } = resolveOwnerHash(req);
  const idempotencyKey =
    req.headers.get('idempotency-key') ||
    (typeof bodyIdempKey === 'string' ? bodyIdempKey : undefined);

  try {
    const result = await VerificationService.runVerification(parsed.data, {
      ownerHash,
      idempotencyKey: idempotencyKey || undefined,
    });

    const response = NextResponse.json(result, {
      status: 202,
      headers: {
        'Cache-Control': 'no-store',
      },
    });

    if (isNew) {
      response.cookies.set(OWNER_COOKIE_NAME, ownerHash, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 30 * 24 * 60 * 60,
      });
    }

    return response;
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err) {
      const customErr = err as { code: string; status?: number; message?: string };
      if (customErr.code === 'IDEMPOTENCY_KEY_CONFLICT') {
        return problemResponse({
          status: 409,
          code: 'IDEMPOTENCY_KEY_CONFLICT',
          title: 'Idempotency Key Conflict',
          detail:
            customErr.message ||
            'Reusing idempotency key with differing input payload.',
          instance: '/api/v1/verify',
        });
      }
      if (customErr.code === 'RATE_LIMIT_EXCEEDED') {
        return problemResponse({
          status: 429,
          code: 'RATE_LIMIT_EXCEEDED',
          title: 'Rate Limit Exceeded',
          detail:
            customErr.message || 'Owner exceeded rate limit (10 runs / 10 minutes).',
          instance: '/api/v1/verify',
        });
      }
    }

    return problemResponse({
      status: 500,
      code: 'INTERNAL_GATEWAY_ERROR',
      title: 'Internal Server Error',
      detail:
        err instanceof Error
          ? err.message
          : 'An unexpected error occurred during verification initialization.',
      instance: '/api/v1/verify',
    });
  }
}
