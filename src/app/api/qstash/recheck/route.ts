import { NextRequest, NextResponse } from 'next/server';
import { Receiver } from '@upstash/qstash';
import { z } from 'zod';
import { db } from '@/server/db/client';
import { dispatchDagNodeJob } from '@/server/jobs/worker';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const RecheckPayloadSchema = z
  .object({
    runIds: z.array(z.string()).optional(),
    maxBatch: z.number().int().min(1).max(50).default(10),
    olderThanHours: z.number().min(0).default(24),
  })
  .optional();

export async function POST(req: NextRequest) {
  const currentKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const nextKey = process.env.QSTASH_NEXT_SIGNING_KEY;

  const receiver = new Receiver({
    currentSigningKey: currentKey || 'missing_current_key',
    nextSigningKey: nextKey || 'missing_next_key',
  });

  const signature = req.headers.get('upstash-signature');
  const bodyText = await req.text();

  // 1. Verify cryptographic signature from QStash
  if (!signature) {
    return NextResponse.json(
      { error: 'Unauthorized: missing upstash-signature header', code: 'UNAUTHORIZED' },
      { status: 401 }
    );
  }

  try {
    const isValid = await receiver.verify({
      signature,
      body: bodyText,
    });

    if (!isValid) {
      return NextResponse.json(
        { error: 'Unauthorized: invalid signature', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }
  } catch {
    return NextResponse.json(
      { error: 'Unauthorized: signature verification failed', code: 'UNAUTHORIZED' },
      { status: 401 }
    );
  }

  // 2. Parse payload options
  let payload: z.infer<typeof RecheckPayloadSchema> = { maxBatch: 10, olderThanHours: 24 };
  if (bodyText.trim().length > 0) {
    try {
      const parsedJson = JSON.parse(bodyText);
      const res = RecheckPayloadSchema.safeParse(parsedJson);
      if (res.success && res.data) {
        payload = res.data;
      }
    } catch {
      // Proceed with defaults if body is not valid JSON
    }
  }

  const recheckedRunIds: string[] = [];

  try {
    const cutoffDate = new Date(Date.now() - (payload?.olderThanHours ?? 24) * 60 * 60 * 1000);

    // 3. Query stale active reports to recheck
    const runsToRecheck = payload?.runIds && payload.runIds.length > 0
      ? await db.verificationRun.findMany({
          where: {
            id: { in: payload.runIds },
          },
          take: payload.maxBatch,
        })
      : await db.verificationRun.findMany({
          where: {
            state: { in: ['completed', 'COMPLETED', 'partial', 'PARTIAL'] },
            createdAt: { lte: cutoffDate },
          },
          orderBy: { createdAt: 'asc' },
          take: payload?.maxBatch ?? 10,
        });

    // 4. Trigger background rechecks
    for (const run of runsToRecheck) {
      // Find the first DAG node to kick off the recheck pipeline
      const rootNode = await db.dagNode.findFirst({
        where: { runId: run.id },
        orderBy: { attempt: 'asc' },
      });

      // Update run status to signify active background recheck
      await db.verificationRun.update({
        where: { id: run.id },
        data: {
          state: 'RUNNING',
        },
      });

      if (rootNode) {
        try {
          await dispatchDagNodeJob(run.id, rootNode.id);
        } catch {
          // Continue processing batch even if single QStash dispatch throws
        }
      }

      recheckedRunIds.push(run.id);
    }

    return NextResponse.json({
      success: true,
      processedCount: recheckedRunIds.length,
      recheckedRunIds,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Database error during recheck execution';
    return NextResponse.json(
      {
        error: message,
        code: 'RECHECK_EXECUTION_ERROR',
        processedCount: recheckedRunIds.length,
        recheckedRunIds,
      },
      { status: 500 }
    );
  }
}
