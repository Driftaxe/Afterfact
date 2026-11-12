import { db } from '@/server/db/client';

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