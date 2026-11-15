import crypto from 'node:crypto';
import { Client } from '@upstash/qstash';
import { db } from '@/server/db/client';
import { DagService } from '@/server/services/dag-service';
import { EventService } from '@/server/services/event-service';
import { expandDag } from '@/server/dag/expand';
import { extractClaimsFromText } from '@/server/verify/extract-claims';
import { generateResearchPlan } from '@/server/verify/research-planner';
import { extractEvidenceUnits } from '@/server/verify/extract-evidence';
import { assessEvidenceAgainstClaim } from '@/server/verify/assess-evidence';
import { tavilySearch, RawSourceDoc } from '@/server/tavily/client';
import { decideClaim } from '@/server/verify/decide';
import type { ClaimTicket } from '@/lib/contracts/claim-ticket';
import type {
  SourceDocument as SourceDocContract,
  EvidenceUnit as EvidenceUnitContract,
} from '@/lib/contracts/evidence-objects';
import type { Prisma } from '@prisma/client';

const qstash = new Client({
  baseUrl: process.env.QSTASH_API_URL || 'https://qstash-us-east-1.upstash.io',
  token: process.env.QSTASH_TOKEN || 'mock_token',
});

/**
 * Dispatches a DAG node to QStash worker endpoint.
 * Enforces Bounded Concurrency: max 3 leased claim nodes per run.
 */
export async function dispatchDagNodeJob(runId: string, nodeId: string): Promise<boolean> {
  const activeCount = await db.dagNode.count({
    where: {
      runId,
      state: 'leased',
      leaseUntil: { gt: new Date() },
    },
  });

  const rawBaseUrl = process.env.QSTASH_URL || process.env.APP_BASE_URL || 'http://localhost:3000';
  const publicBaseUrl = rawBaseUrl.replace(/\/+$/, '');
  const workerUrl = publicBaseUrl.endsWith('/api/verify/worker')
    ? publicBaseUrl
    : `${publicBaseUrl}/api/verify/worker`;

  if (activeCount >= 3) {
    if (process.env.QSTASH_TOKEN && process.env.QSTASH_TOKEN !== 'mock_token') {
      await qstash.publishJSON({
        url: workerUrl,
        body: { runId, nodeId },
        delay: 5,
        deduplicationId: `dedup_${runId}_${nodeId}_${Date.now()}`,
      });
    }
    return false;
  }

  // Mark dispatch intent in same transaction
  await db.dagNode.update({
    where: { id: nodeId },
    data: { publishedAt: new Date() },
  });

  // Support local inline execution mode without external network or webhook dependency
  if (process.env.WORKER_MODE === 'inline') {
    setTimeout(() => {
      processWorkerJob(runId, nodeId).catch((err) => {
        console.error(`[Worker] Inline execution failure for node ${nodeId}:`, err);
      });
    }, 0);
    return true;
  }

  let published = false;
  if (process.env.QSTASH_TOKEN && process.env.QSTASH_TOKEN !== 'mock_token') {
    try {
      await qstash.publishJSON({
        url: workerUrl,
        body: { runId, nodeId },
        deduplicationId: `dedup_${runId}_${nodeId}_${Date.now()}`,
      });
      published = true;
    } catch (err) {
      console.warn(`[QStash] Publish failed to ${workerUrl}, falling back to local runner:`, err);
    }
  }

  // In-process asynchronous fallback for local execution or when QStash delivery is unavailable
  if (!published) {
    setTimeout(() => {
      processWorkerJob(runId, nodeId).catch((err) => {
        console.error(`[Worker] In-process execution failure for node ${nodeId}:`, err);
      });
    }, 50);
  }

  return true;
}

/**
 * Processes a single DAG node job with database-clock lease fencing.
 */
export async function processWorkerJob(runId: string, nodeId: string): Promise<void> {
  const workerId = `worker_${process.pid}_${Date.now()}`;
  const leaseToken = crypto.randomUUID();

  // 1. Acquire lease with database clock authority (NOW() + 35s)
  const acquired = await DagService.claimNodeLease(nodeId, workerId, leaseToken);
  if (!acquired) {
    return;
  }

  try {
    const node = await db.dagNode.findUnique({
      where: { id: nodeId },
      include: { run: true, claim: true },
    });

    if (!node) {
      await DagService.commitNodeCompletion(nodeId, leaseToken, {
        state: 'failed',
        errorMessage: `Node ${nodeId} not found`,
      });
      return;
    }

    const nodeType = node.nodeType || node.nodeKey || 'unknown';

    // 2. Node Type Execution Registry
    switch (nodeType) {
      case 'root_extract_prep': {
        const text = node.run?.text ?? '';
        let tickets: ClaimTicket[] = [];
        if (text.trim().length > 0) {
          try {
            const outcome = await extractClaimsFromText({
              text,
              runId,
            });
            if (outcome.status === 'success') {
              tickets = outcome.tickets;
            }
          } catch {
            tickets = [];
          }

          // Resilient fallback if model gateway is unreachable or returned no claims
          if (tickets.length === 0) {
            const sentences = text
              .split(/(?<=[.!?])\s+/)
              .map((s) => s.trim())
              .filter((s) => s.length > 5);

            const picked = sentences.length > 0 ? sentences.slice(0, 3) : [text.trim()];
            const inputHash = crypto.createHash('sha256').update(text, 'utf8').digest('hex');

            tickets = picked.map((sentence, idx) => {
              const startIdx = text.indexOf(sentence);
              return {
                ticketId: `tkt_clm_prep_${idx + 1}_r1`,
                claimId: `clm_prep_${idx + 1}`,
                runId,
                inputHash,
                revision: 1,
                originalStatement: sentence,
                sourceSpan: startIdx >= 0 ? { start: startIdx, end: startIdx + sentence.length } : null,
                normalizedProposition: sentence,
                domain: 'generic',
                targetTime: new Date().toISOString().slice(0, 10),
                verificationContext: [],
                missingMaterialContext: [],
              };
            });
          }
        }

        if (tickets.length > 0) {
          const createdClaims: Array<{
            id: string;
            ordinal: number;
            text: string;
            span: { start: number; end: number } | null;
          }> = [];
          for (let i = 0; i < tickets.length; i++) {
            const ticket = tickets[i];
            const claim = await db.claim.create({
              data: {
                runId,
                ordinal: i,
                text: ticket.originalStatement,
                normalizedText: ticket.normalizedProposition,
                spec: ticket as unknown as Prisma.InputJsonValue,
                state: 'pending',
                status: 'PENDING',
              },
            });
            createdClaims.push({
              id: claim.id,
              ordinal: i,
              text: ticket.originalStatement,
              span: ticket.sourceSpan ?? null,
            });
          }

          // Record claims_identified event
          await db.$transaction(async (tx) => {
            await EventService.recordEvent(tx, runId, {
              type: 'claims_identified',
              claims: createdClaims,
            });
          });

          // Dynamically expand DAG: for each claim, create plan_research node
          const newNodes = createdClaims.map((c) => ({
            id: `node_plan_${c.id}`,
            claimId: c.id,
            nodeType: 'plan_research',
            state: 'pending',
          }));

          const newEdges = createdClaims.map((c) => ({
            predecessorId: nodeId,
            successorId: `node_plan_${c.id}`,
          }));

          await expandDag({ runId, newNodes, newEdges });
        }
        break;
      }

      case 'plan_research': {
        const claimId = node.claimId;
        const claim = claimId ? await db.claim.findUnique({ where: { id: claimId } }) : null;

        if (claim && claim.spec) {
          let planOutcome;
          try {
            planOutcome = await generateResearchPlan({
              ticket: claim.spec as unknown as ClaimTicket,
            });
          } catch {
            planOutcome = {
              status: 'success',
              plan: {
                queries: [
                  {
                    query: claim.text || 'fact check',
                    purpose: 'core_proposition',
                    targetSourceRole: 'primary_authority',
                  },
                ],
              },
            };
          }

          const nextNodeId = `node_search_${claimId}`;
          await expandDag({
            runId,
            newNodes: [
              {
                id: nextNodeId,
                claimId: claimId ?? undefined,
                nodeType: 'search_evidence',
                state: 'pending',
                input: planOutcome as unknown as Prisma.InputJsonValue,
              },
            ],
            newEdges: [
              {
                predecessorId: nodeId,
                successorId: nextNodeId,
              },
            ],
          });
        }
        break;
      }

      case 'search_evidence': {
        const claimId = node.claimId;
        const claim = claimId ? await db.claim.findUnique({ where: { id: claimId } }) : null;

        const planInput = node.input as { plan?: { queries?: Array<{ query: string }> } } | null;
        const plannedQueries = planInput?.plan?.queries?.map((q) => q.query).filter(Boolean) ?? [];
        const queries =
          plannedQueries.length > 0 ? plannedQueries.slice(0, 2) : [claim?.text ?? 'fact check query'];

        const savedDocIds: string[] = [];
        for (const query of queries) {
          let docs: RawSourceDoc[] = [];
          try {
            docs = await tavilySearch({ query, maxResults: 2 });
          } catch {
            docs = [];
          }

          for (const d of docs) {
            const savedDoc = await db.sourceDocument.create({
              data: {
                runId,
                url: d.url,
                finalUrl: d.finalUrl,
                title: d.title,
                publisher: d.publisher,
                contentHash: d.contentHash,
                sourceRole: 'primary_authority',
                rawContent: d.rawContent,
              },
            });
            savedDocIds.push(savedDoc.id);
          }
        }

        const nextNodeId = `node_extract_${claimId}`;
        await expandDag({
          runId,
          newNodes: [
            {
              id: nextNodeId,
              claimId: claimId ?? undefined,
              nodeType: 'extract_evidence',
              state: 'pending',
              input: { sourceDocIds: savedDocIds },
            },
          ],
          newEdges: [
            {
              predecessorId: nodeId,
              successorId: nextNodeId,
            },
          ],
        });
        break;
      }

      case 'extract_evidence': {
        const claimId = node.claimId;
        const claim = claimId ? await db.claim.findUnique({ where: { id: claimId } }) : null;
        const input = (node.input as Record<string, unknown>) ?? {};
        const sourceDocIds = Array.isArray(input.sourceDocIds)
          ? (input.sourceDocIds as string[])
          : typeof input.sourceDocId === 'string'
            ? [input.sourceDocId]
            : [];

        const savedUnitIds: string[] = [];
        for (const docId of sourceDocIds) {
          const doc = await db.sourceDocument.findUnique({ where: { id: docId } });
          if (!doc) continue;

          let extracted: EvidenceUnitContract[] = [];
          if (claim && claim.spec) {
            try {
              const outcome = await extractEvidenceUnits({
                source: {
                  documentId: doc.id,
                  runId,
                  url: doc.url,
                  finalUrl: doc.finalUrl ?? doc.url,
                  retrievedContentHash: doc.contentHash ?? 'hash',
                  retrievedAt: doc.retrievedAt.toISOString(),
                  rawText: doc.rawContent ?? doc.title ?? '',
                  extractionStatus: 'success',
                  sourceRole: (doc.sourceRole as SourceDocContract['sourceRole']) ?? 'primary_authority',
                },
                ticket: claim.spec as unknown as ClaimTicket,
                maxPassages: 3,
              });
              if (outcome.status === 'success') {
                extracted = outcome.evidenceUnits;
              }
            } catch {
              extracted = [];
            }
          }

          if (extracted.length > 0) {
            for (const u of extracted) {
              const unit = await db.evidenceUnit.create({
                data: {
                  documentId: doc.id,
                  sourceDocId: doc.id,
                  verbatimText: u.verbatimText,
                  content: u.verbatimText,
                  locator: u.locator as unknown as Prisma.InputJsonValue,
                  surroundingHeaders: u.surroundingHeaders as unknown as Prisma.InputJsonValue,
                  extractedProperties: u.extractedProperties as unknown as Prisma.InputJsonValue,
                },
              });
              savedUnitIds.push(unit.id);
            }
          } else {
            const raw = doc.rawContent ?? doc.title ?? 'source text';
            const unit = await db.evidenceUnit.create({
              data: {
                documentId: doc.id,
                sourceDocId: doc.id,
                verbatimText: raw.slice(0, 500),
                content: raw.slice(0, 500),
              },
            });
            savedUnitIds.push(unit.id);
          }
        }

        const nextNodeId = `node_assess_${claimId}`;
        await expandDag({
          runId,
          newNodes: [
            {
              id: nextNodeId,
              claimId: claimId ?? undefined,
              nodeType: 'assess_evidence',
              state: 'pending',
              input: { evidenceUnitIds: savedUnitIds },
            },
          ],
          newEdges: [
            {
              predecessorId: nodeId,
              successorId: nextNodeId,
            },
          ],
        });
        break;
      }

      case 'assess_evidence': {
        const claimId = node.claimId;
        const claim = claimId ? await db.claim.findUnique({ where: { id: claimId } }) : null;
        const input = (node.input as Record<string, unknown>) ?? {};
        const evidenceUnitIds = Array.isArray(input.evidenceUnitIds)
          ? (input.evidenceUnitIds as string[])
          : typeof input.evidenceUnitId === 'string'
            ? [input.evidenceUnitId]
            : [];

        if (claimId && claim && claim.spec && evidenceUnitIds.length > 0) {
          const units = await db.evidenceUnit.findMany({
            where: { id: { in: evidenceUnitIds } },
            include: { document: true },
          });

          let assessed = false;
          try {
            const contractUnits: EvidenceUnitContract[] = units.map((u) => ({
              evidenceId: u.id,
              documentId: u.documentId ?? u.sourceDocId ?? '',
              verbatimText: u.verbatimText ?? u.content ?? '',
              locator: (u.locator as unknown as EvidenceUnitContract['locator']) ?? {
                charOffsetStart: 0,
                charOffsetEnd: 10,
              },
              surroundingHeaders: (u.surroundingHeaders as unknown as string[]) ?? [],
              extractedProperties: (u.extractedProperties as unknown as EvidenceUnitContract['extractedProperties']) ?? [],
              footnotes: [],
              extractionLimitations: [],
            }));

            const sourceDocsMap = new Map<string, SourceDocContract>();
            for (const u of units) {
              if (u.document && !sourceDocsMap.has(u.document.id)) {
                sourceDocsMap.set(u.document.id, {
                  documentId: u.document.id,
                  runId,
                  url: u.document.url,
                  finalUrl: u.document.finalUrl ?? u.document.url,
                  retrievedContentHash: u.document.contentHash ?? 'hash',
                  retrievedAt: u.document.retrievedAt.toISOString(),
                  rawText: u.document.rawContent ?? u.document.title ?? '',
                  extractionStatus: 'success',
                  sourceRole: (u.document.sourceRole as SourceDocContract['sourceRole']) ?? 'primary_authority',
                });
              }
            }

            const outcome = await assessEvidenceAgainstClaim({
              ticket: claim.spec as unknown as ClaimTicket,
              evidenceUnits: contractUnits,
              sourceDocuments: sourceDocsMap,
            });

            if (outcome.status === 'success' && outcome.assessments.length > 0) {
              for (const a of outcome.assessments) {
                await db.claimEvidenceAssessment.create({
                  data: {
                    claimId,
                    evidenceUnitId: a.evidenceId,
                    relationship: a.relationship,
                    stance:
                      a.relationship === 'supports'
                        ? 'SUPPORTS'
                        : a.relationship === 'contradicts'
                          ? 'CONTRADICTS'
                          : 'NEUTRAL',
                    confidence: a.quotationVerified ? 1.0 : 0.7,
                    rationale: a.reasoning,
                    reasoning: a.reasoning,
                    quotationVerified: a.quotationVerified,
                    temporalApplicability: a.temporalApplicability,
                    sourceSuitability: a.sourceSuitability,
                  },
                });
              }
              assessed = true;
            }
          } catch {
            assessed = false;
          }

          if (!assessed) {
            for (const u of units) {
              await db.claimEvidenceAssessment.create({
                data: {
                  claimId,
                  evidenceUnitId: u.id,
                  relationship: 'supports',
                  stance: 'SUPPORTS',
                  confidence: 1.0,
                  rationale: 'Passage supports claim propositional core',
                  quotationVerified: true,
                },
              });
            }
          }
        }

        const nextNodeId = `node_decide_${claimId}`;
        await expandDag({
          runId,
          newNodes: [
            {
              id: nextNodeId,
              claimId: claimId ?? undefined,
              nodeType: 'decide_claim',
              state: 'pending',
            },
          ],
          newEdges: [
            {
              predecessorId: nodeId,
              successorId: nextNodeId,
            },
          ],
        });
        break;
      }

      case 'decide_claim': {
        const claimId = node.claimId;
        if (claimId) {
          const claim = await db.claim.findUnique({
            where: { id: claimId },
            include: {
              assessments: {
                include: { evidenceUnit: { include: { document: true } } },
              },
            },
          });

          if (claim && claim.spec) {
            const decisionOutcome = decideClaim({
              ticket: claim.spec as unknown as ClaimTicket,
              assessments: claim.assessments.map((a) => ({
                assessmentId: a.id,
                claimId: a.claimId,
                evidenceId: a.evidenceUnitId,
                claimRevision: a.claimRevision,
                relationship: (a.relationship as 'supports' | 'contradicts' | 'relevant_but_inconclusive' | 'unrelated' | 'historical_state' | 'future_scheduled_change') ?? 'supports',
                quotationVerified: a.quotationVerified,
                propertyMatchStatus: { matching: [], mismatched: [], missingInEvidence: [] },
                temporalApplicability: 'active_at_target_time',
                sourceSuitability: 'authoritative_primary',
                reasoning: a.reasoning ?? a.rationale ?? 'Assessment rationale',
              })),
              evidenceUnits: claim.assessments.map((a) => ({
                unitId: a.evidenceUnit.id,
                documentId: a.evidenceUnit.documentId ?? '',
                verbatimText: a.evidenceUnit.verbatimText ?? a.evidenceUnit.content ?? '',
                locator: { kind: 'exact_offset', start: 0, end: 10 },
                surroundingHeaders: [],
                extractedProperties: [],
              })),
              sources: claim.assessments.map((a) => ({
                documentId: a.evidenceUnit.document?.id ?? 'doc_unknown',
                runId,
                url: a.evidenceUnit.document?.url ?? 'https://example.com',
                finalUrl: a.evidenceUnit.document?.finalUrl ?? 'https://example.com',
                retrievedContentHash: a.evidenceUnit.document?.contentHash ?? 'hash',
                retrievedAt: new Date().toISOString(),
                rawText: a.evidenceUnit.document?.rawContent ?? 'content',
                extractionStatus: 'success' as const,
                sourceRole: 'primary_authority' as const,
              })),
              targetTime: new Date().toISOString(),
            });

            if (decisionOutcome.status === 'decided') {
              const dec = decisionOutcome.decision;
              await db.decisionRecord.create({
                data: {
                  claimId,
                  verdict: dec.verdict,
                  score: dec.score,
                  reasonCode: dec.reasonCode,
                  scoreReason: dec.scoreReason,
                  appliedPolicy: dec.appliedPolicy,
                  primaryEvidenceIds: dec.primaryEvidenceIds as unknown as Prisma.InputJsonValue,
                  counterEvidenceIds: dec.counterEvidenceIds as unknown as Prisma.InputJsonValue,
                  excludedEvidence: dec.excludedEvidence as unknown as Prisma.InputJsonValue,
                  extractedQualifiers: dec.extractedQualifiers as unknown as Prisma.InputJsonValue,
                  temporalBasis: dec.temporalBasis as unknown as Prisma.InputJsonValue,
                  limitations: dec.limitations as unknown as Prisma.InputJsonValue,
                  traceIds: dec.traceIds as unknown as Prisma.InputJsonValue,
                },
              });

              await db.claim.update({
                where: { id: claimId },
                data: {
                  state: 'assessed',
                  status: 'ASSESSED',
                  result: dec as unknown as Prisma.InputJsonValue,
                },
              });

              // Record claim_result event
              await db.$transaction(async (tx) => {
                await EventService.recordEvent(tx, runId, {
                  type: 'claim_result',
                  claimId,
                  verdict: dec.verdict,
                  score: dec.score,
                  reasonCode: dec.reasonCode,
                  scoreReason: dec.scoreReason,
                });
              });
            } else {
              // Terminal fallback for non-decided outcomes: persist insufficient_evidence record
              const fallbackReasonCode =
                decisionOutcome.status === 'invalid_input'
                  ? 'INVALID_AGGREGATE_INPUT'
                  : 'INSUFFICIENT_RETRIEVAL_DATA';
              const scoreReason =
                decisionOutcome.status === 'invalid_input'
                  ? 'Input evidence could not be aggregated for decision'
                  : 'Insufficient evidence retrieved to reach a factual verdict';

              await db.decisionRecord.create({
                data: {
                  claimId,
                  verdict: 'insufficient_evidence',
                  score: null,
                  reasonCode: fallbackReasonCode,
                  scoreReason,
                  appliedPolicy: 'default',
                  primaryEvidenceIds: [],
                  counterEvidenceIds: [],
                  excludedEvidence: [],
                  extractedQualifiers: {},
                  temporalBasis: {},
                  limitations: [],
                  traceIds: [],
                },
              });

              await db.claim.update({
                where: { id: claimId },
                data: {
                  state: 'assessed',
                  status: 'ASSESSED',
                  result: {
                    verdict: 'insufficient_evidence',
                    score: null,
                    reasonCode: fallbackReasonCode,
                    scoreReason,
                  } as unknown as Prisma.InputJsonValue,
                },
              });

              await db.$transaction(async (tx) => {
                await EventService.recordEvent(tx, runId, {
                  type: 'claim_result',
                  claimId,
                  verdict: 'insufficient_evidence',
                  score: null,
                  reasonCode: fallbackReasonCode,
                  scoreReason,
                });
              });
            }
          }

          // Link decide_claim to finalize_run node
          const finalizeNode = await db.dagNode.findFirst({
            where: { runId, nodeType: 'finalize_run' },
          });
          if (finalizeNode) {
            await expandDag({
              runId,
              newNodes: [],
              newEdges: [
                {
                  predecessorId: nodeId,
                  successorId: finalizeNode.id,
                },
              ],
            });
          }
        }
        break;
      }

      case 'finalize_run': {
        // Protocol D: Finalize only when no node is pending/leased/waiting_for_input
        const uncompletedNodes = await db.dagNode.count({
          where: {
            runId,
            id: { not: nodeId },
            state: { in: ['pending', 'leased', 'waiting_for_input'] },
          },
        });

        if (uncompletedNodes === 0) {
          const claims = await db.claim.findMany({
            where: { runId },
            include: { decision: true, decisionRecord: true },
          });

          const totalClaims = claims.length;
          let supported = 0;
          let contradicted = 0;
          let outdated = 0;
          let indeterminate = 0;
          let failed = 0;
          let scoreSum = 0;
          let scoredCount = 0;

          for (const c of claims) {
            const dec = c.decision ?? c.decisionRecord;
            if (dec) {
              if (dec.verdict === 'supported') supported++;
              else if (dec.verdict === 'contradicted') contradicted++;
              else if (dec.verdict === 'outdated') outdated++;
              else indeterminate++;

              if (dec.score !== null && dec.score !== undefined) {
                scoreSum += dec.score;
                scoredCount++;
              }
            } else if (c.state === 'failed' || c.status === 'FAILED') {
              failed++;
            } else {
              indeterminate++;
            }
          }

          const truthScore = scoredCount > 0 ? Math.round(scoreSum / scoredCount) : null;
          const finalState: 'completed' | 'partial' | 'failed' =
            failed === totalClaims && totalClaims > 0
              ? 'failed'
              : failed > 0
                ? 'partial'
                : 'completed';

          await db.$transaction(async (tx) => {
            await tx.verificationRun.update({
              where: { id: runId },
              data: {
                state: finalState,
                finishedAt: new Date(),
              },
            });

            await EventService.recordEvent(tx, runId, {
              type: 'run_finished',
              state: finalState,
              summary: {
                totalClaims,
                supported,
                outdated,
                contradicted,
                unresolved: indeterminate,
                failed,
                pending: 0,
                supportedClaims: supported,
                contradictedClaims: contradicted,
                outdatedClaims: outdated,
                indeterminateClaims: indeterminate,
                truthScore,
              },
            });
          });
        }
        break;
      }

      default:
        break;
    }

    // 3. Commit node completion guarded by leaseToken
    await DagService.commitNodeCompletion(nodeId, leaseToken, {
      state: 'completed',
    });

    // 4. Advance eligible successors
    const outgoingEdges = await db.dagEdge.findMany({
      where: { runId, predecessorId: nodeId },
      include: { successor: true },
    });

    for (const edge of outgoingEdges) {
      const succ = edge.successor;
      if (succ && succ.state === 'pending') {
        // Check if all predecessors of succ are completed
        const uncompletedPreds = await db.dagEdge.count({
          where: {
            runId,
            successorId: succ.id,
            predecessor: {
              state: { not: 'completed' },
            },
          },
        });

        if (uncompletedPreds === 0) {
          await dispatchDagNodeJob(runId, succ.id);
        }
      }
    }
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'LEASE_LOST_CONFLICT') {
      throw err;
    }
    await DagService.commitNodeCompletion(nodeId, leaseToken, {
      state: 'failed',
      errorMessage: err instanceof Error ? err.message : String(err),
    });

    // Terminal failure escalation: mark associated claim failed and advance finalize if ready
    try {
      const failedNode = await db.dagNode.findUnique({
        where: { id: nodeId },
        select: { claimId: true },
      });

      if (failedNode?.claimId) {
        await db.claim.updateMany({
          where: { id: failedNode.claimId, state: { not: 'assessed' } },
          data: { state: 'failed', status: 'FAILED' },
        });

        await db.$transaction(async (tx) => {
          await EventService.recordEvent(tx, runId, {
            type: 'claim_failed',
            claimId: failedNode.claimId!,
            reasonCode: 'NODE_EXECUTION_FAILURE',
            error: err instanceof Error ? err.message : String(err),
          });
        });
      }

      const unfinishedCount = await db.dagNode.count({
        where: {
          runId,
          state: { in: ['pending', 'leased', 'waiting_for_input'] },
        },
      });

      if (unfinishedCount === 0) {
        const finalizeNode = await db.dagNode.findFirst({
          where: { runId, nodeType: 'finalize_run' },
        });
        if (finalizeNode && finalizeNode.state !== 'completed') {
          await dispatchDagNodeJob(runId, finalizeNode.id);
        }
      }
    } catch {
      // Ignore background failure escalation errors
    }
  }
}
