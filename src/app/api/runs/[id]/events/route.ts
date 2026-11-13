import { NextRequest } from 'next/server';
import { db } from '@/server/db/client';
import { resolveOwnerHash } from '@/server/services/auth-helper';
import { problemResponse } from '@/server/services/problem-details';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/runs/[id]/events
 * Server-Sent Events stream emitting monotonic verification progress events.
 * Supports sequence replay via `?afterSeq=N` or `Last-Event-ID` header.
 * Strictly enforces anonymous owner isolation (404 on mismatched ownerHash).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { ownerHash } = resolveOwnerHash(req);

  // 1. Verify run exists and belongs to owner
  const run = await db.verificationRun.findUnique({
    where: { id },
    select: { id: true, ownerHash: true, state: true },
  });

  if (!run || run.ownerHash !== ownerHash) {
    return problemResponse({
      status: 404,
      code: 'RUN_NOT_FOUND',
      title: 'Run Not Found',
      detail: `Run '${id}' was not found or access is not authorized.`,
      instance: `/api/runs/${id}/events`,
    });
  }

  // 2. Parse afterSeq from query param or Last-Event-ID header
  const afterSeqParam = req.nextUrl.searchParams.get('afterSeq');
  const lastEventIdHeader = req.headers.get('last-event-id');
  const rawSeq =
    afterSeqParam !== null
      ? parseInt(afterSeqParam, 10)
      : lastEventIdHeader
        ? parseInt(lastEventIdHeader, 10)
        : 0;
  const afterSeq = Number.isNaN(rawSeq) ? 0 : rawSeq;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let lastSeenSeq = afterSeq;
      let closed = false;

      const safeClose = () => {
        if (!closed) {
          closed = true;
          try {
            controller.close();
          } catch {
            // Already closed
          }
        }
      };

      // 1. Replay missed events from PostgreSQL
      try {
        const missed = await db.runEvent.findMany({
          where: { runId: id, seq: { gt: afterSeq } },
          orderBy: { seq: 'asc' },
        });

        for (const ev of missed) {
          controller.enqueue(
            encoder.encode(`id: ${ev.seq}\ndata: ${JSON.stringify(ev.payload)}\n\n`)
          );
          lastSeenSeq = Math.max(lastSeenSeq, ev.seq);
        }

        // Check if run is already finalized
        const latestRun = await db.verificationRun.findUnique({
          where: { id },
          select: { state: true },
        });

        if (latestRun?.state === 'completed' || latestRun?.state === 'failed') {
          safeClose();
          return;
        }
      } catch (err) {
        if (!closed) {
          controller.error(err);
          closed = true;
        }
        return;
      }

      // 2. Keepalive heartbeat comment every 15 seconds
      const heartbeatTimer = setInterval(() => {
        if (closed) {
          clearInterval(heartbeatTimer);
          return;
        }
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        } catch {
          clearInterval(heartbeatTimer);
          safeClose();
        }
      }, 15000);

      // 3. Live polling for newly written events
      const pollTimer = setInterval(async () => {
        if (closed) {
          clearInterval(pollTimer);
          return;
        }
        try {
          const fresh = await db.runEvent.findMany({
            where: { runId: id, seq: { gt: lastSeenSeq } },
            orderBy: { seq: 'asc' },
          });

          for (const ev of fresh) {
            controller.enqueue(
              encoder.encode(`id: ${ev.seq}\ndata: ${JSON.stringify(ev.payload)}\n\n`)
            );
            lastSeenSeq = Math.max(lastSeenSeq, ev.seq);

            if (ev.type === 'run_finished') {
              clearInterval(pollTimer);
              clearInterval(heartbeatTimer);
              safeClose();
              return;
            }
          }

          const currentRun = await db.verificationRun.findUnique({
            where: { id },
            select: { state: true },
          });

          if (currentRun?.state === 'completed' || currentRun?.state === 'failed') {
            clearInterval(pollTimer);
            clearInterval(heartbeatTimer);
            safeClose();
          }
        } catch {
          // Soft retry on next poll tick
        }
      }, 1000);

      req.signal.addEventListener('abort', () => {
        clearInterval(heartbeatTimer);
        clearInterval(pollTimer);
        safeClose();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
