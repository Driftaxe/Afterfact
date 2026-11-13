import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/server/db/client';
import { dispatchDagNodeJob } from '@/server/jobs/worker';
import { EventService } from '@/server/services/event-service';
import { Receiver } from '@upstash/qstash';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  // 1. Authenticate endpoint via Bearer secret or QStash signature
  const cronSecret = process.env.INTERNAL_CRON_SECRET;
  const authHeader = req.headers.get('authorization');
  const secretHeader = req.headers.get('x-internal-secret');
  const qstashSignature = req.headers.get('upstash-signature');

  let authenticated = false;

  if (cronSecret) {
    if (authHeader === `Bearer ${cronSecret}` || secretHeader === cronSecret) {
      authenticated = true;
    }
  }

  if (!authenticated && qstashSignature) {
    const currentKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
    const nextKey = process.env.QSTASH_NEXT_SIGNING_KEY;
    if (currentKey) {
      const receiver = new Receiver({
        currentSigningKey: currentKey,
        nextSigningKey: nextKey || currentKey,
      });
      const bodyText = await req.clone().text();
      try {
        authenticated = await receiver.verify({
          signature: qstashSignature,
          body: bodyText,
        });
      } catch {
        authenticated = false;
      }
    }
  }

  // In test mode without secrets configured, allow if explicitly testing
  if (!authenticated && process.env.NODE_ENV === 'test' && !cronSecret) {
    authenticated = true;
  }

  if (!authenticated) {
    return NextResponse.json(
      { error: 'Unauthorized cron request', code: 'UNAUTHORIZED' },
      { status: 401 }
    );
  }

  const now = new Date();

  // 2. Reclaim expired leases where attempt < 3
  const recovered = await db.dagNode.updateMany({
    where: {
      OR: [
        { state: 'leased', leaseUntil: { lt: now }, attempt: { lt: 3 } },
        { status: 'RUNNING', leaseExpiresAt: { lt: now }, attempt: { lt: 3 } },
      ],
    },
    data: {
      state: 'pending',
      status: 'PENDING',
      leaseToken: null,
      leaseOwner: null,
      leaseUntil: null,
      leaseExpiresAt: null,
    },
  });

  // 3. Mark permanently dead nodes as failed where attempt >= 3
  const deadNodes = await db.dagNode.findMany({
    where: {
      OR: [
        { state: 'leased', leaseUntil: { lt: now }, attempt: { gte: 3 } },
        { status: 'RUNNING', leaseExpiresAt: { lt: now }, attempt: { gte: 3 } },
      ],
    },
    select: { id: true, runId: true, claimId: true },
  });

  for (const node of deadNodes) {
    await db.dagNode.update({
      where: { id: node.id },
      data: {
        state: 'failed',
        status: 'FAILED',
        leaseToken: null,
        leaseOwner: null,
        errorMessage: 'Execution attempts exhausted (max 3)',
      },
    });

    if (node.claimId) {
      await db.claim.update({
        where: { id: node.claimId },
        data: { state: 'failed', status: 'FAILED' },
      });

      await db.$transaction(async (tx) => {
        await EventService.recordEvent(tx, node.runId, {
          type: 'claim_failed',
          claimId: node.claimId!,
          reasonCode: 'ATTEMPTS_EXHAUSTED',
          error: 'Worker lease attempts exhausted without producing a verdict',
        });
      });
    }
  }

  // 4. Auto-expire stale clarifications
  const expiredClarifications = await db.clarification.updateMany({
    where: {
      status: 'pending',
      createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // 24h default
    },
    data: {
      status: 'exhausted',
    },
  });

  // 5. Re-dispatch eligible pending nodes
  const eligibleNodes = await db.dagNode.findMany({
    where: {
      state: 'pending',
      nodeType: { not: 'finalize_run' },
    },
    take: 10,
  });

  let dispatchedCount = 0;
  for (const node of eligibleNodes) {
    const uncompletedPreds = await db.dagEdge.count({
      where: {
        runId: node.runId,
        successorId: node.id,
        predecessor: {
          state: { not: 'completed' },
        },
      },
    });

    if (uncompletedPreds === 0) {
      const dispatched = await dispatchDagNodeJob(node.runId, node.id);
      if (dispatched) dispatchedCount++;
    }
  }

  return NextResponse.json({
    recoveredCount: recovered.count,
    failedCount: deadNodes.length,
    expiredClarificationsCount: expiredClarifications.count,
    dispatchedCount,
  });
}
