import { NextRequest, NextResponse } from 'next/server';
import { getSanitizedRunSnapshot } from '@/server/services/run-query-service';
import { resolveOwnerHash } from '@/server/services/auth-helper';
import { problemResponse } from '@/server/services/problem-details';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/runs/[id]
 * Returns the sanitized point-in-time snapshot of the run, claims, evidence, and public DAG state.
 * Strictly enforces owner isolation (404 Not Found on cross-owner or missing runs).
 * Private worker tokens and credentials are scrubbed by getSanitizedRunSnapshot.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Validate the CUID before attempting a database query.
  if (!/^c[a-z0-9]{24}$/.test(id)) {
    return problemResponse({
      status: 404,
      code: 'RUN_NOT_FOUND',
      title: 'Run Not Found',
      detail: 'The requested run was not found.',
      instance: `/api/runs/${id}`,
    });
  }

  const { ownerHash } = resolveOwnerHash(req);

  const snapshot = await getSanitizedRunSnapshot(id, ownerHash);

  if (!snapshot) {
    return problemResponse({
      status: 404,
      code: 'RUN_NOT_FOUND',
      title: 'Run Not Found',
      detail: `Run '${id}' was not found or access is not authorized.`,
      instance: `/api/runs/${id}`,
    });
  }

  return NextResponse.json(snapshot, {
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}