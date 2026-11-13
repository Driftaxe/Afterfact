import { db } from '@/server/db/client';

export async function getSanitizedRunSnapshot(runId: string, ownerHash: string) {
  if (!runId || !ownerHash) {
    return null;
  }

  const run = await db.verificationRun.findUnique({
    where: { id: runId },
    include: {
      claims: {
        include: {
          decisionRecord: true,
        },
        orderBy: { ordinal: 'asc' },
      },
      dagNodes: {
        select: {
          id: true,
          nodeType: true,
          nodeKey: true,
          claimId: true,
          state: true,
          status: true,
          attempt: true,
          errorMessage: true,
          startedAt: true,
          finishedAt: true,
          // leaseToken, leaseUntil, outputReference, leaseOwner, input, output are STRICTLY EXCLUDED!
        },
      },
      sourceDocs: {
        select: {
          id: true,
          url: true,
          finalUrl: true,
          title: true,
          publisher: true,
          domain: true,
          sourceRole: true,
          publicationDate: true,
          effectiveDate: true,
        },
      },
    },
  });

  if (!run || run.ownerHash !== ownerHash) {
    return null; // Return null to trigger 404 Not Found (privacy isolation)
  }

  const totalNodes = run.dagNodes.length;
  const completedNodes = run.dagNodes.filter(
    (n) => n.state === 'completed' || n.status === 'COMPLETED'
  ).length;

  // Calculate summary metrics across claims
  const totalClaims = run.claims.length;
  let supported = 0;
  let outdated = 0;
  let contradicted = 0;
  let unresolved = 0;
  let failed = 0;

  for (const claim of run.claims) {
    const verdict =
      claim.decisionRecord?.verdict ||
      (claim.result as { verdict?: string } | null)?.verdict;

    if (verdict === 'supported') supported++;
    else if (verdict === 'outdated') outdated++;
    else if (verdict === 'contradicted') contradicted++;
    else if (claim.state === 'failed' || claim.status === 'FAILED') failed++;
    else unresolved++;
  }

  return {
    id: run.id,
    reportId: run.id, // For useRun.ts hook compatibility
    parentRunId: run.parentRunId ?? null,
    mode: run.mode,
    state: run.state,
    answerText: run.text,
    question: run.question ?? null,
    context: run.context ?? {},
    createdAt: run.createdAt.toISOString(),
    finishedAt: run.finishedAt ? run.finishedAt.toISOString() : null,
    latestSeq: Math.max(0, run.nextEventSeq - 1),
    summary: {
      totalClaims,
      supported,
      outdated,
      contradicted,
      unresolved,
      failed,
    },
    claims: run.claims,
    sourceDocuments: run.sourceDocs,
    dagNodes: run.dagNodes,
    dag: {
      totalNodes,
      completedNodes,
      activeStage: run.state === 'completed' ? 'finalized' : 'evaluating',
      clarificationAwaiting: run.dagNodes.some((n) => n.state === 'paused'),
    },
  };
}
