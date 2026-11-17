import crypto from 'node:crypto';
import { Client } from '@upstash/qstash';
import { db } from '@/server/db/client';
import { DagService } from '@/server/services/dag-service';
import { EventService } from '@/server/services/event-service';
import { expandDag } from '@/server/dag/expand';
import { extractClaimsFromText } from '@/server/verify/extract-claims';
import { generateResearchPlan } from '@/server/verify/research-planner';
import { tavilySearch, RawSourceDoc } from '@/server/tavily/client';
import { extractEvidenceUnits } from '@/server/verify/extract-evidence';
import { assessEvidenceAgainstClaim } from '@/server/verify/assess-evidence';
import { evaluatePolicy } from '@/server/policies';
import type { ProvenanceFact, SemanticIntentFacts } from '@/server/policies/types';
import { decideClaim } from '@/server/verify/decide';
import { ClarificationService } from '@/server/services/clarification-service';
import { composeTimeline } from '@/server/verify/transition';
import { orchestrateClaimCorrection } from '@/server/verify/correction';
import type { ClaimTicket, VerificationProperty } from '@/lib/contracts/claim-ticket';
import type { DecideClaimInput, DecisionRecord } from '@/lib/contracts/decision';
import type { EvidenceUnit, SourceDocument, ClaimEvidenceAssessment, AssessmentRelationship } from '@/lib/contracts/evidence-objects';
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

        // Check if claims were already seeded during preparation confirmation
        const existingClaims = await db.claim.findMany({
          where: { runId },
          orderBy: { ordinal: 'asc' },
        });

        const createdClaims: Array<{
          id: string;
          ordinal: number;
          text: string;
          span: { start: number; end: number } | null;
        }> = [];

        if (existingClaims.length > 0) {
          for (const c of existingClaims) {
            const spec = c.spec as unknown as ClaimTicket | null;
            createdClaims.push({
              id: c.id,
              ordinal: c.ordinal,
              text: c.text ?? '',
              span: spec?.sourceSpan ?? null,
            });
          }
        } else if (text.trim().length > 0) {
          let tickets: ClaimTicket[] = [];
          try {
            const outcome = await extractClaimsFromText({
              text,
              runId,
            });
            if (outcome.status === 'success') {
              tickets = outcome.tickets;
            } else if (outcome.status === 'failed') {
              console.warn(
                `[Worker root_extract_prep] Model extraction failed: [${outcome.error.code}] ${outcome.error.message}`
              );
            }
          } catch (err) {
            console.warn('[Worker root_extract_prep] Model gateway error:', err);
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
        }

        if (createdClaims.length > 0) {
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
        const input = (node.input as Record<string, unknown>) ?? {};
        const plannedQuery =
          typeof input.query === 'string'
            ? input.query
            : Array.isArray((input.plan as { queries?: Array<{ query?: string }> })?.queries)
              ? (input.plan as { queries: Array<{ query: string }> }).queries[0]?.query
              : undefined;

        const query = plannedQuery || claim?.normalizedText || claim?.text || 'fact check query';

        let docs: RawSourceDoc[] = [];
        try {
          docs = await tavilySearch({ query, maxResults: 3 });
        } catch {
          docs = [];
        }

        const savedDocIds: string[] = [];
        for (const d of docs) {
          try {
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
          } catch {
            // Graceful handling of duplicates
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
              input: { sourceDocIds: savedDocIds, sourceDocId: savedDocIds[0] ?? null },
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
        const rawDocIds = Array.isArray(input.sourceDocIds)
          ? (input.sourceDocIds as string[])
          : typeof input.sourceDocId === 'string'
            ? [input.sourceDocId]
            : [];

        const createdUnitIds: string[] = [];

        if (claim && claim.spec && rawDocIds.length > 0) {
          const rawTicket = claim.spec as unknown as ClaimTicket;
          const ticket: ClaimTicket = { ...rawTicket, runId };
          const docs = await db.sourceDocument.findMany({
            where: { id: { in: rawDocIds } },
          });

          for (const doc of docs) {
            const raw = doc.rawContent ?? doc.title ?? '';
            if (!raw || raw.trim().length === 0) continue;

            const retrievedIso = doc.retrievedAt?.toISOString() ?? new Date().toISOString();
            const effectiveDate = retrievedIso.slice(0, 10);
            const sourceContract: SourceDocument = {
              documentId: doc.id,
              runId,
              url: doc.url,
              finalUrl: doc.finalUrl ?? doc.url,
              retrievedContentHash: doc.contentHash ?? 'hash',
              retrievedAt: retrievedIso,
              rawText: raw,
              extractionStatus: 'success',
              sourceRole: (doc.sourceRole as SourceDocument['sourceRole']) ?? 'primary_authority',
              effectiveDate,
            };

            let extractedPassages: EvidenceUnit[] = [];
            try {
              const outcome = await extractEvidenceUnits({
                source: sourceContract,
                ticket,
                maxPassages: 3,
              });

              if (outcome.status === 'success' && outcome.evidenceUnits.length > 0) {
                extractedPassages = outcome.evidenceUnits;
              }
            } catch (err) {
              console.warn('[extract_evidence] Model extraction failed, falling back to grounded excerpt:', err);
            }

            // Grounded deterministic fallback if model extraction was empty
            if (extractedPassages.length === 0) {
              const cleanedText = raw.trim();
              const snippet = cleanedText.slice(0, 400);
              extractedPassages.push({
                evidenceId: `unit_${doc.id.slice(0, 12)}_${Date.now()}`,
                documentId: doc.id,
                verbatimText: snippet,
                locator: { charOffsetStart: 0, charOffsetEnd: snippet.length },
                surroundingHeaders: [],
                footnotes: [],
                extractedProperties: [],
                extractionLimitations: [],
              });
            }

            for (const unit of extractedPassages) {
              const created = await db.evidenceUnit.create({
                data: {
                  documentId: doc.id,
                  sourceDocId: doc.id,
                  verbatimText: unit.verbatimText,
                  content: unit.verbatimText,
                  quote: unit.verbatimText,
                  locator: unit.locator as unknown as Prisma.InputJsonValue,
                  surroundingHeaders: (unit.surroundingHeaders ?? []) as unknown as Prisma.InputJsonValue,
                  tableContext: (unit.tableContext ?? null) as unknown as Prisma.InputJsonValue,
                  footnotes: (unit.footnotes ?? []) as unknown as Prisma.InputJsonValue,
                  extractedProperties: (unit.extractedProperties ?? []) as unknown as Prisma.InputJsonValue,
                },
              });
              createdUnitIds.push(created.id);
            }
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
              input: { evidenceUnitIds: createdUnitIds, evidenceUnitId: createdUnitIds[0] ?? null },
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
        const rawUnitIds = Array.isArray(input.evidenceUnitIds)
          ? (input.evidenceUnitIds as string[])
          : typeof input.evidenceUnitId === 'string'
            ? [input.evidenceUnitId]
            : [];

        if (claim && claim.spec && rawUnitIds.length > 0 && claimId) {
          const currentClaimId = claimId;
          const rawTicket = claim.spec as unknown as ClaimTicket;
          const ticket: ClaimTicket = { ...rawTicket, runId };
          const unitsFromDb = await db.evidenceUnit.findMany({
            where: { id: { in: rawUnitIds } },
            include: { document: true },
          });

          if (unitsFromDb.length > 0) {
            const docMap = new Map<string, SourceDocument>();
            const contractUnits: EvidenceUnit[] = [];

            for (const u of unitsFromDb) {
              const doc = u.document;
              const docEffectiveDate = doc?.retrievedAt?.toISOString().slice(0, 10) ?? new Date().toISOString().slice(0, 10);
              if (doc && !docMap.has(doc.id)) {
                docMap.set(doc.id, {
                  documentId: doc.id,
                  runId,
                  url: doc.url,
                  finalUrl: doc.finalUrl ?? doc.url,
                  retrievedContentHash: doc.contentHash ?? 'hash',
                  retrievedAt: doc.retrievedAt?.toISOString() ?? new Date().toISOString(),
                  rawText: doc.rawContent ?? doc.title ?? '',
                  extractionStatus: 'success',
                  sourceRole: (doc.sourceRole as SourceDocument['sourceRole']) ?? 'primary_authority',
                  effectiveDate: docEffectiveDate,
                });
              }

              const loc = typeof u.locator === 'object' && u.locator !== null
                ? (u.locator as { charOffsetStart?: number; charOffsetEnd?: number })
                : {};

              contractUnits.push({
                evidenceId: u.id,
                documentId: u.documentId ?? (doc ? doc.id : 'unknown'),
                verbatimText: u.verbatimText ?? u.content ?? '',
                locator: {
                  charOffsetStart: loc.charOffsetStart ?? 0,
                  charOffsetEnd: loc.charOffsetEnd ?? (u.verbatimText?.length ?? 10),
                },
                surroundingHeaders: Array.isArray(u.surroundingHeaders) ? (u.surroundingHeaders as string[]) : [],
                tableContext: (u.tableContext as unknown as EvidenceUnit['tableContext']) ?? undefined,
                footnotes: Array.isArray(u.footnotes) ? (u.footnotes as string[]) : [],
                extractedProperties: Array.isArray(u.extractedProperties) ? (u.extractedProperties as unknown as VerificationProperty[]) : [],
                effectiveDate: docEffectiveDate,
                extractionLimitations: [],
              });
            }

            let assessmentsToStore: ClaimEvidenceAssessment[] = [];
            try {
              const outcome = await assessEvidenceAgainstClaim({
                ticket,
                evidenceUnits: contractUnits,
                sourceDocuments: docMap,
              });

              if (outcome.status === 'success' && outcome.assessments.length > 0) {
                assessmentsToStore = outcome.assessments;
              }
            } catch (err) {
              console.warn('[assess_evidence] Semantic assessment failed, using grounded fallback:', err);
            }

            // Resilient grounded fallback: fail closed with inconclusive relationship
            if (assessmentsToStore.length === 0) {
              for (const u of contractUnits) {
                assessmentsToStore.push({
                  assessmentId: `asm_${u.evidenceId.slice(0, 16)}`,
                  claimTicketId: ticket.ticketId,
                  evidenceId: u.evidenceId,
                  claimRevision: ticket.revision,
                  relationship: 'relevant_but_inconclusive',
                  scopeMatching: 'unknown',
                  quotationVerified: true,
                  propertyMatchStatus: { matching: [], mismatched: [], missingInEvidence: [] },
                  temporalApplicability: 'undetermined',
                  sourceSuitability: 'credible_secondary',
                  modelConfidence: 0.2,
                  reasoning: 'Grounded passage was retrieved but semantic relationship is inconclusive.',
                });
              }
            }

            for (const a of assessmentsToStore) {
              await db.claimEvidenceAssessment.upsert({
                where: {
                  claimId_evidenceUnitId_claimRevision: {
                    claimId: currentClaimId,
                    evidenceUnitId: a.evidenceId,
                    claimRevision: a.claimRevision,
                  },
                },
                create: {
                  claimId: currentClaimId,
                  evidenceUnitId: a.evidenceId,
                  claimRevision: a.claimRevision,
                  relationship: a.relationship,
                  stance: a.relationship === 'supports' ? 'SUPPORTS' : a.relationship === 'contradicts' ? 'CONTRADICTS' : 'INCONCLUSIVE',
                  confidence: a.modelConfidence ?? 0.9,
                  rationale: a.reasoning,
                  reasoning: a.reasoning,
                  quotationVerified: a.quotationVerified,
                  propertyMatchStatus: a.propertyMatchStatus as unknown as Prisma.InputJsonValue,
                  temporalApplicability: a.temporalApplicability,
                  sourceSuitability: a.sourceSuitability,
                },
                update: {
                  relationship: a.relationship,
                  stance: a.relationship === 'supports' ? 'SUPPORTS' : a.relationship === 'contradicts' ? 'CONTRADICTS' : 'INCONCLUSIVE',
                  confidence: a.modelConfidence ?? 0.9,
                  rationale: a.reasoning,
                  reasoning: a.reasoning,
                  quotationVerified: a.quotationVerified,
                  propertyMatchStatus: a.propertyMatchStatus as unknown as Prisma.InputJsonValue,
                  temporalApplicability: a.temporalApplicability,
                  sourceSuitability: a.sourceSuitability,
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
            const rawTicket = claim.spec as unknown as ClaimTicket;
            const ticket: ClaimTicket = { ...rawTicket, runId };

            // 1. Build typed SourceDocuments, EvidenceUnits, and Assessments
            const sourceDocMap = new Map<string, SourceDocument>();
            const contractEvidenceUnits: EvidenceUnit[] = [];

            for (const a of claim.assessments) {
              const u = a.evidenceUnit;
              const doc = u.document;
              const docEffectiveDate = doc?.retrievedAt?.toISOString().slice(0, 10) ?? new Date().toISOString().slice(0, 10);
              if (doc && !sourceDocMap.has(doc.id)) {
                sourceDocMap.set(doc.id, {
                  documentId: doc.id,
                  runId,
                  url: doc.url,
                  finalUrl: doc.finalUrl ?? doc.url,
                  retrievedContentHash: doc.contentHash ?? 'hash',
                  retrievedAt: doc.retrievedAt?.toISOString() ?? new Date().toISOString(),
                  rawText: doc.rawContent ?? doc.title ?? '',
                  extractionStatus: 'success',
                  sourceRole: (doc.sourceRole as SourceDocument['sourceRole']) ?? 'primary_authority',
                  effectiveDate: docEffectiveDate,
                });
              }

              const loc = typeof u.locator === 'object' && u.locator !== null
                ? (u.locator as { charOffsetStart?: number; charOffsetEnd?: number })
                : {};

              contractEvidenceUnits.push({
                evidenceId: u.id,
                documentId: u.documentId ?? (doc ? doc.id : 'unknown'),
                verbatimText: u.verbatimText ?? u.content ?? '',
                locator: {
                  charOffsetStart: loc.charOffsetStart ?? 0,
                  charOffsetEnd: loc.charOffsetEnd ?? (u.verbatimText?.length ?? 10),
                },
                surroundingHeaders: Array.isArray(u.surroundingHeaders) ? (u.surroundingHeaders as string[]) : [],
                tableContext: (u.tableContext as unknown as EvidenceUnit['tableContext']) ?? undefined,
                footnotes: Array.isArray(u.footnotes) ? (u.footnotes as string[]) : [],
                extractedProperties: Array.isArray(u.extractedProperties) ? (u.extractedProperties as unknown as VerificationProperty[]) : [],
                effectiveDate: docEffectiveDate,
                extractionLimitations: [],
              });
            }

            const contractSourceDocuments = Array.from(sourceDocMap.values());

            // Build provenance facts for all retrieved source documents to establish authority
            const provenanceMap: Record<string, ProvenanceFact> = {};
            for (const doc of contractSourceDocuments) {
              const isPrimary =
                doc.sourceRole === 'primary_authority' ||
                doc.sourceRole === 'regulatory_filing' ||
                doc.sourceRole === 'official_changelog';

              provenanceMap[doc.documentId] = {
                documentId: doc.documentId,
                claimId: ticket.claimId,
                revision: ticket.revision,
                basis: isPrimary ? 'official_primary_record' : 'independent_secondary_report',
                entityMatch: true,
                claimApplicability: 'applicable',
                isIndependentSecondary: !isPrimary,
              };
            }

            const semanticFacts: SemanticIntentFacts = {
              claimId: ticket.claimId,
              revision: ticket.revision,
              assertedPropertyKeys: ticket.verificationContext
                .filter((p) => p.origin === 'explicit_claim_text' || p.key === 'asserted_value')
                .map((p) => p.key),
              scopeQualifierKeys: ticket.verificationContext
                .filter((p) => p.key === 'jurisdiction' || p.key === 'effective_date' || p.key === 'plan_tier')
                .map((p) => p.key),
            };

            // 2. Policy Evaluation across Specialized Domains (Pricing, API, Regulation, Leadership, Generic)
            const policyResult = evaluatePolicy({
              ticket,
              documents: contractSourceDocuments,
              provenanceMap,
              semanticFacts,
            });

            // Protocol C: Clarification Pause if questions planned
            if (policyResult.clarification.status === 'questions_planned') {
              const firstQ = policyResult.clarification.questionSet.questions[0];
              await ClarificationService.pauseForClarification({
                runId,
                nodeId,
                claimId,
                questionText: firstQ?.prompt ?? 'Material context required to verify claim.',
                questionDefinition: policyResult.clarification.questionSet as unknown as Prisma.InputJsonValue,
                options: firstQ?.options?.map((o) => o.label ?? o.value),
              });
              return; // Halt branch without committing completion
            }

            // 3. Assemble typed DecideClaimInput
            const contractAssessments: ClaimEvidenceAssessment[] = claim.assessments.map((a) => {
              const rel = (a.relationship as ClaimEvidenceAssessment['relationship']) ?? 'supports';
              const temp = (a.temporalApplicability as ClaimEvidenceAssessment['temporalApplicability']) ?? 'active_at_target_time';
              const suitability = (a.sourceSuitability as ClaimEvidenceAssessment['sourceSuitability']) ?? 'authoritative_primary';

              return {
                assessmentId: a.id,
                claimTicketId: ticket.ticketId,
                evidenceId: a.evidenceUnitId,
                claimRevision: a.claimRevision,
                relationship: rel,
                scopeMatching: 'match' as const,
                quotationVerified: a.quotationVerified,
                propertyMatchStatus: (typeof a.propertyMatchStatus === 'object' && a.propertyMatchStatus !== null)
                  ? (a.propertyMatchStatus as unknown as ClaimEvidenceAssessment['propertyMatchStatus'])
                  : { matching: [], mismatched: [], missingInEvidence: [] },
                temporalApplicability: temp,
                sourceSuitability: suitability,
                modelConfidence: a.confidence ?? 0.9,
                reasoning: a.reasoning ?? a.rationale ?? 'Evidence assessment',
              };
            });

            const decideInput: DecideClaimInput = {
              ticket,
              assessments: contractAssessments,
              evidenceUnits: contractEvidenceUnits,
              sourceDocuments: contractSourceDocuments,
              claimTemporalScope: {
                quantifier: 'current',
                intervalSemantics: 'existential',
              },
              assessmentGrounding: contractAssessments.map((a) => ({
                assessmentId: a.assessmentId,
                contextBasis: a.quotationVerified ? 'verified_context' : 'quotation_only',
                limitations: [],
              })),
              evidenceTemporalProofs: contractAssessments.map((a) => ({
                evidenceId: a.evidenceId,
                basis: a.temporalApplicability === 'active_at_target_time'
                  ? 'current_validity_confirmed'
                  : a.temporalApplicability === 'historical_prior'
                    ? 'historical_interval_confirmed'
                    : 'unknown',
              })),
              sourceAuthority: policyResult.authorityFacts.map((f) => ({
                documentId: f.documentId,
                basis: f.basis,
                claimApplicability: f.claimApplicability,
              })),
              transitions: [],
              coverage: {
                researchComplete: true,
                obligations: policyResult.obligations,
                rejectedCandidates: [],
                budgetExhausted: false,
                limitations: policyResult.limitations,
              },
              policy: policyResult.policy,
              decidedAt: new Date().toISOString(),
              traceIds: {
                runId,
                nodeId,
              },
            };

            const decisionOutcome = decideClaim(decideInput);

            let dec: DecisionRecord;
            if (decisionOutcome.status === 'decided') {
              dec = decisionOutcome.decision;
            } else {
              console.warn(`[decide_claim] decideClaim returned ${decisionOutcome.status}:`, decisionOutcome);
              dec = {
                recordId: `dec_${claimId}_r1`,
                claimTicketId: ticket.ticketId,
                claimRevision: ticket.revision,
                appliedPolicy: policyResult.selectedDomain,
                verdict: 'insufficient_evidence',
                score: null,
                reasonCode: 'INSUFFICIENT_EVIDENCE',
                scoreReason: 'No authoritative evidence found conclusively supporting or contradicting this proposition.',
                primaryEvidenceIds: [],
                counterEvidenceIds: [],
                excludedEvidence: [],
                extractedQualifiers: [],
                temporalBasis: { targetTime: ticket.targetTime },
                limitations: policyResult.limitations,
                traceIds: { runId, nodeId },
              };
            }

            await db.decisionRecord.upsert({
              where: { claimId },
              create: {
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
              update: {
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

        if (uncompletedNodes > 0) {
          // Other DAG branches are still active; release finalize_run back to pending
          // so it can be re-dispatched when remaining predecessor branches complete.
          await db.dagNode.update({
            where: { id: nodeId },
            data: {
              state: 'pending',
              status: 'PENDING',
              leaseToken: null,
              leaseOwner: null,
              leaseUntil: null,
            },
          });
          return;
        }

        if (uncompletedNodes === 0) {
          const claims = await db.claim.findMany({
            where: { runId },
            include: {
              decision: true,
              decisionRecord: true,
              assessments: { include: { evidenceUnit: { include: { document: true } } } },
            },
          });

          // Compose Timelines and Corrections for eligible claims (FIN-005)
          for (const c of claims) {
            const dec = (c.decisionRecord ?? c.decision) as unknown as DecisionRecord | null;
            if (dec && (dec.verdict === 'outdated' || dec.verdict === 'contradicted') && c.spec) {
              const ticket = c.spec as unknown as ClaimTicket;
              const contractUnits: EvidenceUnit[] = c.assessments.map((a) => {
                const loc = typeof a.evidenceUnit.locator === 'object' && a.evidenceUnit.locator !== null
                  ? (a.evidenceUnit.locator as { charOffsetStart?: number; charOffsetEnd?: number })
                  : {};
                return {
                  evidenceId: a.evidenceUnit.id,
                  documentId: a.evidenceUnit.documentId ?? '',
                  verbatimText: a.evidenceUnit.verbatimText ?? a.evidenceUnit.content ?? '',
                  locator: {
                    charOffsetStart: loc.charOffsetStart ?? 0,
                    charOffsetEnd: loc.charOffsetEnd ?? (a.evidenceUnit.verbatimText?.length ?? 10),
                  },
                  surroundingHeaders: [],
                  footnotes: [],
                  extractedProperties: [],
                  extractionLimitations: [],
                };
              });

              const contractSources: SourceDocument[] = c.assessments
                .map((a) => a.evidenceUnit.document)
                .filter((d): d is NonNullable<typeof d> => Boolean(d))
                .map((d) => ({
                  documentId: d.id,
                  runId,
                  url: d.url,
                  finalUrl: d.finalUrl ?? d.url,
                  retrievedContentHash: d.contentHash ?? 'hash',
                  retrievedAt: d.retrievedAt?.toISOString() ?? new Date().toISOString(),
                  rawText: d.rawContent ?? d.title ?? '',
                  extractionStatus: 'success',
                  sourceRole: (d.sourceRole as SourceDocument['sourceRole']) ?? 'primary_authority',
                }));

              const timelineResult = composeTimeline({
                ticket,
                decision: dec,
                evidenceUnits: contractUnits,
                sourceDocuments: contractSources,
                assessments: c.assessments.map((a) => ({
                  assessmentId: a.id,
                  claimTicketId: ticket.ticketId,
                  evidenceId: a.evidenceUnitId,
                  claimRevision: a.claimRevision,
                  relationship: (a.relationship as AssessmentRelationship) ?? 'contradicts',
                  scopeMatching: 'match' as const,
                  modelConfidence: a.confidence ?? 0.9,
                  quotationVerified: a.quotationVerified,
                  propertyMatchStatus: { matching: [], mismatched: [], missingInEvidence: [] },
                  temporalApplicability: (a.temporalApplicability as ClaimEvidenceAssessment['temporalApplicability']) ?? 'historical_prior',
                  sourceSuitability: 'authoritative_primary',
                  reasoning: a.reasoning ?? '',
                })),
              });

              let correctionData = null;
              try {
                const corrOutcome = await orchestrateClaimCorrection({
                  ticket,
                  decision: dec,
                  evidenceUnits: contractUnits,
                  sourceDocuments: contractSources,
                  answerText: node.run?.text ?? undefined,
                });
                if (corrOutcome && corrOutcome.publicCorrection) {
                  correctionData = corrOutcome.publicCorrection;
                }
              } catch (err) {
                console.warn('[finalize_run] Claim correction orchestration caught:', err);
              }

              // Update claim.result with timeline and correction
              const enrichedResult = {
                ...dec,
                timeline: timelineResult.timeline,
                correction: correctionData,
              };

              await db.claim.update({
                where: { id: c.id },
                data: {
                  result: enrichedResult as unknown as Prisma.InputJsonValue,
                },
              });
            }
          }

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
                supported,
                outdated,
                contradicted,
                unresolved: indeterminate,
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
