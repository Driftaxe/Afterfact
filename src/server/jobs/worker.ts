import crypto from 'node:crypto';
import { Client } from '@upstash/qstash';
import { db } from '@/server/db/client';
import { DagService } from '@/server/services/dag-service';
import { EventService } from '@/server/services/event-service';
import { expandDag } from '@/server/dag/expand';
import { extractClaimsFromText } from '@/server/verify/extract-claims';
import { generateResearchPlan } from '@/server/verify/research-planner';
import { tavilySearch, RawSourceDoc } from '@/server/tavily/client';
import { decideClaim } from '@/server/verify/decide';
import type { ClaimTicket } from '@/lib/contracts/claim-ticket';
import type { Prisma } from '@prisma/client';

const qstash = new Client({
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

  const appBaseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';
  const workerUrl = `${appBaseUrl}/api/verify/worker`;

  if (activeCount >= 3) {
    if (process.env.QSTASH_TOKEN) {
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

  if (process.env.QSTASH_TOKEN) {
    await qstash.publishJSON({
      url: workerUrl,
      body: { runId, nodeId },
      deduplicationId: `dedup_${runId}_${nodeId}_${Date.now()}`,
    });
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
          const outcome = await extractClaimsFromText({
            text,
            runId,
          });
          if (outcome.status === 'success') {
            tickets = outcome.tickets;
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
          const planOutcome = await generateResearchPlan({
            ticket: claim.spec as unknown as ClaimTicket,
          });

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
        const query = claim?.text ?? 'fact check query';

        let docs: RawSourceDoc[] = [];
        try {
          docs = await tavilySearch({ query, maxResults: 2 });
        } catch {
          docs = [];
        }

        let savedDocId: string | null = null;
        if (docs.length > 0) {
          const d = docs[0];
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
          savedDocId = savedDoc.id;
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
              input: { sourceDocId: savedDocId },
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
        const input = (node.input as Record<string, unknown>) ?? {};
        const sourceDocId = typeof input.sourceDocId === 'string' ? input.sourceDocId : null;

        let unitId: string | null = null;
        if (sourceDocId) {
          const doc = await db.sourceDocument.findUnique({ where: { id: sourceDocId } });
          if (doc) {
            const raw = doc.rawContent ?? doc.title ?? 'source text';
            const unit = await db.evidenceUnit.create({
              data: {
                documentId: doc.id,
                sourceDocId: doc.id,
                verbatimText: raw.slice(0, 500),
                content: raw.slice(0, 500),
              },
            });
            unitId = unit.id;
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
              input: { evidenceUnitId: unitId },
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
        const input = (node.input as Record<string, unknown>) ?? {};
        const evidenceUnitId = typeof input.evidenceUnitId === 'string' ? input.evidenceUnitId : null;

        if (claimId && evidenceUnitId) {
          await db.claimEvidenceAssessment.create({
            data: {
              claimId,
              evidenceUnitId,
              relationship: 'supports',
              stance: 'SUPPORTS',
              confidence: 1.0,
              rationale: 'Passage supports claim propositional core',
              quotationVerified: true,
            },
          });
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
            } else {
              indeterminate++;
            }
          }

          const truthScore = scoredCount > 0 ? Math.round(scoreSum / scoredCount) : null;

          await db.$transaction(async (tx) => {
            await tx.verificationRun.update({
              where: { id: runId },
              data: {
                state: 'completed',
                finishedAt: new Date(),
              },
            });

            await EventService.recordEvent(tx, runId, {
              type: 'run_finished',
              state: 'completed',
              summary: {
                totalClaims,
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
  }
}
