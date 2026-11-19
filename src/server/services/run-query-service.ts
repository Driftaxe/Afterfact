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
          input: true,
          // leaseToken, leaseUntil, outputReference, leaseOwner, output are STRICTLY EXCLUDED!
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
      clarifications: {
        select: {
          id: true,
          nodeId: true,
          claimId: true,
          version: true,
          question: true,
          status: true,
          questionDefinition: true,
        },
      },
    },
  });

  const isTerminal = Boolean(run && ['completed', 'partial', 'failed'].includes(run.state));
  if (!run || (run.ownerHash !== ownerHash && !isTerminal)) {
    return null; // Return null to trigger 404 Not Found (privacy isolation for in-flight private runs)
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
    const timeline = Array.isArray(decRecord?.timeline) ? decRecord.timeline : [];
    const correction = (decRecord?.correction as Record<string, unknown>) ?? null;
    const missingMaterialContext = Array.isArray(spec.missingMaterialContext)
      ? (spec.missingMaterialContext as string[])
      : [];

    const normalizedProp =
      (typeof claim.normalizedText === 'string' && claim.normalizedText.trim().length > 0
        ? claim.normalizedText
        : typeof spec.normalizedProposition === 'string' && spec.normalizedProposition.trim().length > 0
          ? spec.normalizedProposition
          : null);

    const extractedQualifiers = Array.isArray(decRecord?.extractedQualifiers)
      ? decRecord.extractedQualifiers
      : Array.isArray(claim.qualifiers)
        ? claim.qualifiers
        : Array.isArray(spec.verificationContext)
          ? spec.verificationContext
          : [];

    const verificationContext = Array.isArray(spec.verificationContext)
      ? spec.verificationContext
      : Array.isArray(claim.qualifiers)
        ? claim.qualifiers
        : extractedQualifiers;

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
      normalizedText: normalizedProp,
      normalizedProposition: normalizedProp,
      extractedQualifiers,
      verificationContext,
      span,
      state: isAssessed ? 'assessed' : isFailed ? 'failed' : 'pending',
      verdict:
        decRecord && typeof decRecord.verdict === 'string'
          ? decRecord.verdict
          : isAssessed
            ? 'insufficient_evidence'
            : undefined,
      score:
        decRecord && typeof decRecord.score === 'number'
          ? decRecord.score
          : null,
      scoreReason:
        decRecord && typeof decRecord.scoreReason === 'string'
          ? decRecord.scoreReason
          : isAssessed
            ? 'Evaluation concluded without conclusive evidence.'
            : null,
      reasonCode:
        decRecord && typeof decRecord.reasonCode === 'string'
          ? decRecord.reasonCode
          : isAssessed
            ? 'INSUFFICIENT_EVIDENCE'
            : 'PENDING',
      evidenceIds,
      timeline,
      correction,
      missingMaterialContext,
    };
  });

  const claimMap = new Map<string, { rawText: string; normalizedProposition?: string | null }>();
  for (const c of mappedClaims) {
    claimMap.set(c.id, {
      rawText: c.rawText,
      normalizedProposition: c.normalizedProposition,
    });
  }

  const mappedDagNodes = run.dagNodes.map((n) => {
    const input = (n.input as Record<string, unknown>) ?? null;
    const plan = (input?.plan as Record<string, unknown>) ?? null;
    const planQueries = Array.isArray(plan?.queries) ? plan.queries : null;

    const queryList: string[] = [];
    if (planQueries) {
      for (const q of planQueries) {
        if (typeof (q as Record<string, unknown>)?.query === 'string' && ((q as Record<string, unknown>).query as string).trim()) {
          queryList.push(((q as Record<string, unknown>).query as string).trim());
        }
      }
    } else if (typeof input?.query === 'string' && input.query.trim()) {
      queryList.push(input.query.trim());
    }

    const query = queryList.length > 0 ? queryList[0] : null;
    const claimMeta = n.claimId ? claimMap.get(n.claimId) : null;
    const normalizedProp =
      typeof input?.normalizedProposition === 'string'
        ? input.normalizedProposition
        : claimMeta?.normalizedProposition || null;

    return {
      id: n.id,
      nodeType: n.nodeType,
      nodeKey: n.nodeKey,
      claimId: n.claimId,
      state: n.state,
      status: n.status,
      attempt: n.attempt,
      errorMessage: n.errorMessage,
      startedAt: n.startedAt,
      finishedAt: n.finishedAt,
      query,
      queries: queryList.length > 0 ? queryList : null,
      normalizedProposition: normalizedProp,
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
    dagNodes: mappedDagNodes,
    clarifications: run.clarifications || [],
    dag: {
      totalNodes,
      completedNodes,
      activeStage: run.state === 'completed' ? 'finalized' : 'evaluating',
      clarificationAwaiting: run.dagNodes.some((n) => n.state === 'waiting_for_input' || n.state === 'paused'),
    },
  };
}
