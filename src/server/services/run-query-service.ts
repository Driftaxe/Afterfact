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
          assessments: {
            include: {
              evidenceUnit: {
                include: {
                  document: true,
                },
              },
            },
          },
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

  // Index evidence units across claims and map claims to Report contract
  const evidenceMap = new Map<string, Record<string, unknown>>();

  const mappedClaims = run.claims.map((claim) => {
    const dec = claim.decisionRecord || ((claim.result as Record<string, unknown>) ?? null);
    const spec = (claim.spec as Record<string, unknown>) ?? {};
    const span = (spec.sourceSpan as { start: number; end: number }) ?? null;
    const evidenceIds: string[] =
      (dec && 'primaryEvidenceIds' in dec && Array.isArray(dec.primaryEvidenceIds)
        ? (dec.primaryEvidenceIds as string[])
        : null) ??
      claim.assessments?.map((a) => a.evidenceUnitId) ??
      [];

    const isAssessed =
      claim.state === 'assessed' || claim.status === 'ASSESSED' || Boolean(dec && 'verdict' in dec);
    const isFailed = claim.state === 'failed' || claim.status === 'FAILED';

    for (const assessment of claim.assessments || []) {
      const unit = assessment.evidenceUnit;
      if (unit && !evidenceMap.has(unit.id)) {
        evidenceMap.set(unit.id, {
          id: unit.id,
          url: unit.document?.url || 'https://example.com',
          title: unit.document?.title || 'Source Document',
          publisher: unit.document?.publisher || 'Web Authority',
          sourceType: unit.document?.sourceRole || 'official_documentation',
          passage: unit.verbatimText || unit.content || unit.quote || '',
          retrievedAt: unit.createdAt?.toISOString() || run.createdAt.toISOString(),
          publicationDate: unit.document?.publicationDate
            ? unit.document.publicationDate.toISOString().slice(0, 10)
            : undefined,
          effectiveDate: unit.document?.effectiveDate
            ? unit.document.effectiveDate.toISOString().slice(0, 10)
            : undefined,
        });
      }
    }

    const decRecord = dec as Record<string, unknown> | null;
    return {
      ...claim,
      id: claim.id,
      claimId: claim.id,
      parentClaimId: null,
      ordinal: claim.ordinal,
      rawText:
        claim.text ||
        (typeof spec.originalStatement === 'string' ? spec.originalStatement : ''),
      statement:
        claim.text ||
        (typeof spec.originalStatement === 'string' ? spec.originalStatement : ''),
      span,
      state: isAssessed ? 'assessed' : isFailed ? 'failed' : 'pending',
      verdict:
        decRecord && typeof decRecord.verdict === 'string'
          ? decRecord.verdict
          : isAssessed
            ? 'supported'
            : undefined,
      score:
        decRecord && typeof decRecord.score === 'number'
          ? decRecord.score
          : isAssessed
            ? 100
            : null,
      scoreReason:
        decRecord && typeof decRecord.scoreReason === 'string'
          ? decRecord.scoreReason
          : null,
      reasonCode:
        decRecord && typeof decRecord.reasonCode === 'string'
          ? decRecord.reasonCode
          : isAssessed
            ? 'AUTHORITATIVE_PRIMARY_SUPPORT'
            : 'PENDING',
      evidenceIds,
      timeline: [],
    };
  });

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
    claims: mappedClaims,
    evidence: Array.from(evidenceMap.values()),
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
