import { NextRequest, NextResponse } from 'next/server';
import { Receiver } from '@upstash/qstash';
import { z } from 'zod';
import { processWorkerJob } from '@/server/jobs/worker';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const WorkerPayloadSchema = z
  .object({
    runId: z.string().min(1, { message: 'runId is required' }),
    nodeId: z.string().min(1, { message: 'nodeId is required' }),
    attempt: z.number().int().optional(),
  })
  .strict();

export async function POST(req: NextRequest) {
  const currentKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const nextKey = process.env.QSTASH_NEXT_SIGNING_KEY;

  const receiver = new Receiver({
    currentSigningKey: currentKey || 'missing_current_key',
    nextSigningKey: nextKey || 'missing_next_key',
  });

  const signature = req.headers.get('upstash-signature');
  const bodyText = await req.text();

  // 1. Verify cryptographic signature (bypass only in explicit unit test mock if header set)
  if (!signature) {
    return NextResponse.json(
      { error: 'Unauthorized: missing upstash-signature', code: 'UNAUTHORIZED' },
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

  // 2. Validate payload shape
  let rawJson: unknown;
  try {
    rawJson = JSON.parse(bodyText);
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body', code: 'INVALID_PAYLOAD_SHAPE' },
      { status: 400 }
    );
  }

  const parsed = WorkerPayloadSchema.safeParse(rawJson);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Invalid payload shape',
        code: 'INVALID_PAYLOAD_SHAPE',
        details: parsed.error.issues,
      },
      { status: 400 }
    );
  }

  // 3. Execute job with lease fencing
  try {
    await processWorkerJob(parsed.data.runId, parsed.data.nodeId);
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'LEASE_LOST_CONFLICT') {
      return NextResponse.json(
        { error: 'Lease lost to concurrent worker', code: 'LEASE_LOST_CONFLICT' },
        { status: 409 }
      );
    }
    console.error(`Worker execution failure on node ${parsed.data.nodeId}:`, err);
    return NextResponse.json(
      { error: 'Internal worker error', code: 'INTERNAL_GATEWAY_ERROR' },
      { status: 500 }
    );
  }
}
