import crypto from 'node:crypto';
import { db } from '@/server/db/client';

// ==========================================
// 1. Existing Primitives (Preserved As-Is)
// ==========================================

export async function createDagNode(runId: string, nodeKey: string) {
  return await db.dagNode.create({
    data: {
      runId,
      nodeKey,
      status: 'PENDING',
    },
  });
}

export async function acquireNodeLease(nodeId: string, workerId: string, leaseDurationMs = 30000) {
  const expiresAt = new Date(Date.now() + leaseDurationMs);

  const updated = await db.dagNode.updateMany({
    where: {
      id: nodeId,
      OR: [
        { leaseOwner: null },
        { leaseExpiresAt: { lt: new Date() } },
      ],
      status: { in: ['PENDING', 'RUNNING'] },
    },
    data: {
      leaseOwner: workerId,
      leaseExpiresAt: expiresAt,
      status: 'RUNNING',
    },
  });

  return updated.count > 0;
}

// ==========================================
// 2. DAG Materialization Service
// ==========================================

export async function createRunAndInitializeDag(params: {
  ownerHash: string;
  inputHash: string;
  prepId?: string;
  text: string;
  mode?: string;
}) {
  return await db.$transaction(async (tx) => {
    const run = await tx.verificationRun.create({
      data: {
        ownerHash: params.ownerHash,
        inputHash: params.inputHash,
        prepId: params.prepId,
        mode: params.mode ?? 'paste',
        text: params.text,
        context: {},
        state: 'running',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    const rootNode = await tx.dagNode.create({
      data: {
        runId: run.id,
        nodeKey: 'root_extract_prep',
        status: 'PENDING',
      },
    });

    const finalizeNode = await tx.dagNode.create({
      data: {
        runId: run.id,
        nodeKey: 'finalize_run',
        status: 'PENDING',
      },
    });

    await tx.runEvent.create({
      data: {
        runId: run.id,
        seq: 1,
        type: 'run_started',
        payload: { runId: run.id, createdAt: new Date().toISOString() },
      },
    });

    return { run, rootNode, finalizeNode };
  });
}

// ==========================================
// 3. Minimal Persisted Slice Runner
// ==========================================

export class DagExecutionService {
  static async executeSlice(runId: string): Promise<{ state: string; confidence: number | null }> {
    const workerId = crypto.randomUUID();

    const rootNode = await db.dagNode.findFirst({
      where: { runId, nodeKey: 'root_extract_prep' },
    });

    if (!rootNode) {
      throw new Error(`Root node not found for run ${runId}`);
    }

    const acquired = await acquireNodeLease(rootNode.id, workerId);
    if (!acquired) {
      throw new Error(`Failed to acquire lease on node ${rootNode.id}`);
    }

    try {
      // 1. Create Claim matching schema fields
      const claim = await db.claim.create({
        data: {
          runId,
          text: 'Sample extracted claim for verification slice.',
          normalizedText: 'sample extracted claim for verification slice',
          status: 'PENDING',
        },
      });

      // 2. Create Source Document matching schema fields
      const doc = await db.sourceDocument.create({
        data: {
          runId,
          url: 'https://official.example.com/pricing',
          title: 'Official Documentation',
          domain: 'official.example.com',
          rawContent: 'Official verified passage confirming status.',
        },
      });

      // 3. Create Evidence Unit matching schema (linked to sourceDocId)
      const evidence = await db.evidenceUnit.create({
        data: {
          sourceDocId: doc.id,
          content: 'Official verified passage confirming status.',
          quote: 'Official verified passage confirming status.',
        },
      });

      // 4. Create Claim Evidence Assessment matching schema fields
      await db.claimEvidenceAssessment.create({
        data: {
          claimId: claim.id,
          evidenceUnitId: evidence.id,
          stance: 'supports',
          confidence: 1.0,
          rationale: 'The official source text verbatim matches the claim statement.',
        },
      });

      // 5. Create Decision Record matching schema fields
      await db.decisionRecord.create({
        data: {
          claimId: claim.id,
          verdict: 'supported',
          confidence: 1.0,
          summary: 'Claim verified successfully against official documentation.',
          reasoning: { path: ['scope_match', 'exact_date_match', 'authoritative_publisher'] },
        },
      });

      // 6. Complete the Node and clear lease
      await db.dagNode.update({
        where: { id: rootNode.id },
        data: {
          status: 'COMPLETED',
          leaseOwner: null,
          leaseExpiresAt: null,
          output: { verdict: 'supported', confidence: 1.0 },
        },
      });

      // 7. Update VerificationRun to completed
      await db.verificationRun.update({
        where: { id: runId },
        data: {
          state: 'completed',
          finishedAt: new Date(),
        },
      });

      // 8. Log run finalization event
      await db.runEvent.create({
        data: {
          runId,
          seq: 2,
          type: 'run_finalized',
          payload: { verdict: 'supported', confidence: 1.0 },
        },
      });

      return { state: 'completed', confidence: 1.0 };
    } catch (error) {
      await db.dagNode.update({
        where: { id: rootNode.id },
        data: {
          status: 'FAILED',
          leaseOwner: null,
          leaseExpiresAt: null,
          error: error instanceof Error ? error.message : String(error),
        },
      });
      throw error;
    }
  }
}