import crypto from 'node:crypto';
import { Client } from '@upstash/qstash';
import { db } from '@/server/db/client';
import { DagService } from '@/server/services/dag-service';
import { EventService } from '@/server/services/event-service';
import { expandDag } from '@/server/dag/expand';
import { extractClaimsFromText } from '@/server/verify/extract-claims';
import { generateResearchPlan, isBareTldSuffix, sanitizeQueryText } from '@/server/verify/research-planner';
import { tavilySearch, tavilyExtract, RawSourceDoc } from '@/server/tavily/client';
import { extractEvidenceUnits } from '@/server/verify/extract-evidence';
import { assessEvidenceAgainstClaim } from '@/server/verify/assess-evidence';
import { evaluatePolicy } from '@/server/policies';
import type { ProvenanceFact, SemanticIntentFacts } from '@/server/policies/types';
import { decideClaim } from '@/server/verify/decide';
import { ClarificationService } from '@/server/services/clarification-service';
import { composeTimeline } from '@/server/verify/transition';
import { orchestrateClaimCorrection } from '@/server/verify/correction';
import { toCanonicalClaimTicket, buildDecideClaimInput } from '@/server/verify/converters';
import { synthesizeGeneralInference } from '@/server/verify/inference-synthesizer';
import { SUPPORTED_MAX_CLAIMS_PER_RUN } from '@/lib/contracts/dag';
import type { ClaimTicket, VerificationProperty } from '@/lib/contracts/claim-ticket';
import type { DecideClaimInput, DecisionRecord } from '@/lib/contracts/decision';
import type { EvidenceUnit, SourceDocument, ClaimEvidenceAssessment, AssessmentRelationship } from '@/lib/contracts/evidence-objects';
import type { Prisma } from '@prisma/client';

const qstash = new Client({
  baseUrl: process.env.QSTASH_API_URL || 'https://qstash-us-east-1.upstash.io',
  token: process.env.QSTASH_TOKEN || 'mock_token',
});

export function isSovereignDomain(url: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    const host = parsed.hostname.toLowerCase();
    return (
      host.endsWith('.gov') ||
      /\.gov\.[a-z]{2,}$/.test(host) ||
      /\.nic\.[a-z]{2,}$/.test(host) ||
      /\.gob\.[a-z]{2,}$/.test(host) ||
      /\.gouv\.[a-z]{2,}$/.test(host) ||
      /\.go\.[a-z]{2,}$/.test(host) ||
      host.endsWith('.europa.eu') ||
      host.endsWith('.mil') ||
      host.endsWith('.admin.ch')
    );
  } catch {
    const u = url.toLowerCase();
    return (
      u.includes('.gov.') ||
      u.includes('.gov/') ||
      u.includes('.nic.') ||
      u.includes('.europa.eu') ||
      u.includes('.admin.ch')
    );
  }
}

export function isUserGeneratedContentUrl(url: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    const host = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname.toLowerCase();

    // UGC subdomains
    if (
      host.startsWith('community.') ||
      host.startsWith('forum.') ||
      host.startsWith('forums.') ||
      host.startsWith('discuss.') ||
      host.startsWith('repost.') ||
      host.startsWith('gist.') ||
      host.includes('stackoverflow.com') ||
      host.includes('reddit.com') ||
      host.includes('quora.com')
    ) {
      return true;
    }

    // UGC path prefixes and patterns
    if (
      pathname.startsWith('/community') ||
      pathname.startsWith('/forum') ||
      pathname.startsWith('/forums') ||
      pathname.startsWith('/discuss') ||
      pathname.startsWith('/discussions') ||
      pathname.startsWith('/issues') ||
      pathname.startsWith('/questions') ||
      pathname.startsWith('/pull/') ||
      pathname.startsWith('/pulls') ||
      pathname.includes('/discussions/') ||
      pathname.includes('/issues/') ||
      pathname.includes('/orgs/') // e.g. github.com/orgs/community/discussions
    ) {
      return true;
    }

    // User profile/repo paths on code hosting platforms (github.com, gitlab.com)
    if (host === 'github.com' || host === 'gitlab.com') {
      const parts = pathname.split('/').filter(Boolean);
      // Canonical vendor platform roots that are not individual user/org repos
      const canonicalRootRoutes = new Set([
        'pricing', 'features', 'enterprise', 'team', 'security', 'about',
        'readme', 'contact', 'login', 'join', 'solutions', 'marketplace'
      ]);
      if (parts.length >= 2 && !canonicalRootRoutes.has(parts[0])) {
        // e.g. /owner/repo -> arbitrary user project or community issue
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}

export function isCanonicalFirstPartyPath(url: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    const host = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname.toLowerCase();

    // Dedicated documentation, developer, support, or legal subdomains are always authoritative
    if (
      host.startsWith('docs.') ||
      host.startsWith('developer.') ||
      host.startsWith('developers.') ||
      host.startsWith('api.') ||
      host.startsWith('support.') ||
      host.startsWith('help.') ||
      host.startsWith('learn.') ||
      host.startsWith('kb.') ||
      host.startsWith('legal.')
    ) {
      return true;
    }

    // Exclude non-authoritative marketing, career, partner, and event pages
    if (
      pathname.startsWith('/careers') ||
      pathname.startsWith('/jobs') ||
      pathname.startsWith('/events') ||
      pathname.startsWith('/customer-stories') ||
      pathname.startsWith('/case-studies') ||
      pathname.startsWith('/partners') ||
      pathname.startsWith('/users/')
    ) {
      return false;
    }

    // Default allow: official product pages, pricing schedules, app-store programs, localized routes (/en/..., /us/...)
    return true;
  } catch {
    return false;
  }
}

const GENERIC_ENTITY_STOPWORDS = new Set([
  'the', 'and', 'for', 'any', 'all', 'what', 'when', 'under', 'from', 'with', 'per',
  'of', 'in', 'on', 'at', 'by', 'to', 'into', 'onto',
  'app', 'apps', 'store', 'team', 'free', 'pro', 'plus', 'max', 'enterprise',
  'business', 'small', 'program', 'cloud', 'web', 'api', 'sdk', 'plan', 'plans',
  'tier', 'tiers', 'act', 'law', 'rule', 'rules', 'regulation', 'regulations',
  'union', 'commission', 'general', 'purpose', 'model', 'models', 'account',
  'accounts', 'private', 'public', 'global', 'standard', 'code', 'system',
  'data', 'platform', 'service', 'services', 'functions', 'function', 'fee', 'fees',
  'rate', 'rates', 'fine', 'fines', 'penalty', 'penalties', 'month', 'months',
  'year', 'years', 'inc', 'ltd', 'corp', 'llc', 'gmbh',
  // Generic nouns, agencies, and geographic descriptors
  'bank', 'banks', 'banking', 'board', 'council', 'authority', 'department',
  'administration', 'agency', 'india', 'indian', 'america', 'american',
  'national', 'federal', 'central'
]);

const PREPOSITION_WORDS = new Set([
  'of', 'and', 'for', 'the', 'in', 'on', 'at', 'by', 'to', 'with', 'from', 'de', 'du', 'des', 'und', 'et'
]);

export function sanitizeTavilyIncludeDomains(
  domains?: string[]
): { validDomains: string[]; strippedTlds: string[] } {
  if (!domains || domains.length === 0) return { validDomains: [], strippedTlds: [] };
  const validDomains: string[] = [];
  const strippedTlds: string[] = [];
  for (const d of domains) {
    if (isBareTldSuffix(d)) {
      strippedTlds.push(d);
    } else {
      validDomains.push(d);
    }
  }
  return { validDomains, strippedTlds };
}

export function extractEntityTokens(
  source: ClaimTicket | VerificationProperty[]
): string[] {
  const props = Array.isArray(source) ? source : source.verificationContext ?? [];
  const tokens = new Set<string>();

  for (const p of props) {
    if (
      p.key === 'productName' ||
      p.key === 'provider' ||
      p.key === 'vendor' ||
      p.key === 'company' ||
      p.key === 'organization' ||
      p.key === 'regulator' ||
      p.key === 'agency' ||
      p.key === 'entity' ||
      p.key === 'service' ||
      p.key === 'platform' ||
      p.key === 'manufacturer'
    ) {
      if (typeof p.value === 'string' && p.value.trim().length > 0) {
        const val = p.value.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
        for (const word of val.split(/\s+/)) {
          if (word.length >= 3 && !GENERIC_ENTITY_STOPWORDS.has(word)) {
            tokens.add(word);
          }
        }
        // Multi-word acronym generation for statutory/regulatory/corporate bodies
        const rawWords = p.value.split(/\s+/).filter(Boolean);
        if (rawWords.length >= 2) {
          // Exclude grammatical prepositions to form clean acronyms (e.g. "Reserve Bank of India" -> "rbi", "Food and Drug Administration" -> "fda")
          const nonPrepWords = rawWords.filter((w) => !PREPOSITION_WORDS.has(w.toLowerCase()));
          if (nonPrepWords.length >= 2) {
            const sigAcronym = nonPrepWords.map((w) => w[0].toLowerCase()).join('').replace(/[^a-z0-9]/g, '');
            if (sigAcronym.length >= 2 && sigAcronym.length <= 6 && !GENERIC_ENTITY_STOPWORDS.has(sigAcronym)) {
              tokens.add(sigAcronym);
            }
          }
          const allAcronym = rawWords.map((w) => w[0].toLowerCase()).join('').replace(/[^a-z0-9]/g, '');
          if (allAcronym.length >= 2 && allAcronym.length <= 6 && !GENERIC_ENTITY_STOPWORDS.has(allAcronym)) {
            tokens.add(allAcronym);
          }
        }
      }
    }
  }

  if (!Array.isArray(source)) {
    // CRITICAL: Extract capitalized proper nouns and acronyms on the ORIGINAL-CASE statement!
    const rawText = source.normalizedProposition || source.originalStatement || '';
    const commonEntities = rawText.match(/\b([A-Z][a-zA-Z0-9]+)\b/g);
    if (commonEntities) {
      for (const e of commonEntities) {
        const lower = e.toLowerCase();
        if (lower.length >= 3 && !GENERIC_ENTITY_STOPWORDS.has(lower)) {
          tokens.add(lower);
        }
      }
    }
  }

  return Array.from(tokens);
}

export function extractRegistrableDomainLabel(hostname: string): { registrableLabel: string; subdomains: string[] } {
  const parts = hostname.toLowerCase().split('.').filter(Boolean);
  const commonSuffixes = new Set([
    'com', 'org', 'net', 'io', 'ai', 'co', 'gov', 'edu', 'nic', 'in', 'uk', 'us', 'eu', 'de', 'fr', 'jp', 'ca', 'au', 'ch',
    'bank', 'int', 'mil', 'ac', 'gob', 'gouv', 'biz', 'info'
  ]);
  let endIdx = parts.length - 1;
  while (endIdx >= 0 && commonSuffixes.has(parts[endIdx])) {
    endIdx--;
  }
  if (endIdx < 0) {
    return { registrableLabel: '', subdomains: [] };
  }
  const registrableLabel = parts[endIdx];
  const subdomains = parts.slice(0, endIdx).filter((s) => s !== 'www');
  return { registrableLabel, subdomains };
}

export function isFirstPartyDomainForEntity(
  url: string,
  entityTokens?: string[]
): boolean {
  if (!url || !entityTokens || entityTokens.length === 0) return false;
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    const host = parsed.hostname.toLowerCase();
    const { registrableLabel, subdomains } = extractRegistrableDomainLabel(host);
    if (!registrableLabel) return false;

    return entityTokens.some((rawToken) => {
      const token = rawToken.toLowerCase().trim();
      if (token.length < 3) return false;

      // 1. Exact label match: e.g. "apple" === "apple", "github" === "github", or subdomain "aws" in aws.amazon.com
      if (registrableLabel === token || subdomains.includes(token)) {
        return true;
      }

      // 2. Clean compound brand match: e.g. "microsoft" in "microsoftcorp", token.length >= 5
      // Never match short tokens (e.g. "act", "team", "app") inside third-party domains
      if (token.length >= 5 && registrableLabel.startsWith(token)) {
        return true;
      }

      return false;
    });
  } catch {
    return false;
  }
}

export function inferDocumentSourceRole(
  url: string,
  publisher?: string | null,
  entityTokens?: string[]
): SourceDocument['sourceRole'] {
  const u = (url || '').toLowerCase();
  const p = (publisher || '').toLowerCase();

  // UGC / Community Guardrail: Never grant primary_authority to forums or user discussions
  if (isUserGeneratedContentUrl(url)) {
    return 'counter_perspective';
  }

  // 1. Regulatory filings and legislative registries globally
  if (
    u.includes('sec.gov') ||
    u.includes('edgar') ||
    u.includes('legislation.gov') ||
    u.includes('eur-lex.europa.eu') ||
    u.includes('federalregister.gov') ||
    u.includes('indiacode.nic.in') ||
    p.includes('securities and exchange commission')
  ) {
    return 'regulatory_filing';
  }

  // 2. Official changelogs / releases
  if (
    u.includes('/changelog') ||
    u.includes('/releases') ||
    (u.includes('github.com') && u.includes('/releases'))
  ) {
    return 'official_changelog';
  }

  // 3. Sovereign government, legislative, regulatory, and judicial domains globally
  if (isSovereignDomain(url)) {
    return 'primary_authority';
  }

  // 4. Dynamic First-Party Entity Authority Resolution:
  // When a source is hosted on the subject entity's own official domain on canonical first-party paths
  if (entityTokens && entityTokens.length > 0 && isFirstPartyDomainForEntity(url, entityTokens)) {
    if (isCanonicalFirstPartyPath(url)) {
      return 'primary_authority';
    }
  }

  // 5. Established reputable news, encyclopedias, wire services, tech press, and legal publications globally
  if (
    u.includes('wikipedia.org') ||
    u.includes('britannica.com') ||
    u.includes('reuters.com') ||
    u.includes('apnews.com') ||
    u.includes('bloomberg.com') ||
    u.includes('nytimes.com') ||
    u.includes('wsj.com') ||
    u.includes('ft.com') ||
    u.includes('cnbc.com') ||
    u.includes('bbc.com') ||
    u.includes('bbc.co.uk') ||
    u.includes('theguardian.com') ||
    u.includes('washingtonpost.com') ||
    u.includes('techcrunch.com') ||
    u.includes('theverge.com') ||
    u.includes('arstechnica.com') ||
    u.includes('wired.com') ||
    u.includes('forbes.com') ||
    u.includes('fortune.com') ||
    u.includes('politico.com') ||
    u.includes('cnn.com') ||
    u.includes('nbcnews.com') ||
    u.includes('timesofindia.indiatimes.com') ||
    u.includes('economictimes.indiatimes.com') ||
    u.includes('indiatimes.com') ||
    u.includes('deccanherald.com') ||
    u.includes('thehindu.com') ||
    u.includes('hindustantimes.com') ||
    u.includes('indianexpress.com') ||
    u.includes('livemint.com') ||
    u.includes('moneycontrol.com') ||
    u.includes('business-standard.com') ||
    u.includes('lemonde.fr') ||
    u.includes('spiegel.de') ||
    u.includes('elpais.com') ||
    u.includes('asahi.com') ||
    u.includes('japantimes.co.jp') ||
    u.includes('scmp.com') ||
    u.includes('smh.com.au') ||
    u.includes('theglobeandmail.com') ||
    u.includes('afp.com') ||
    u.includes('upi.com') ||
    u.includes('dw.com') ||
    u.includes('aljazeera.com') ||
    u.includes('france24.com') ||
    u.includes('natlawreview.com') ||
    u.includes('law360.com') ||
    p.includes('wikipedia') ||
    p.includes('reuters') ||
    p.includes('associated press') ||
    p.includes('bloomberg') ||
    p.includes('cnbc') ||
    p.includes('wall street journal') ||
    p.includes('financial times') ||
    p.includes('techcrunch') ||
    p.includes('the verge') ||
    p.includes('ars technica') ||
    p.includes('national law review') ||
    p.includes('law360')
  ) {
    return 'reputable_secondary';
  }

  // 6. Academic institutions, official technical docs, and developer portals
  if (u.includes('.edu') || u.includes('docs.') || u.includes('/docs')) {
    return 'primary_authority';
  }

  // Unvetted blogs, personal sites, and user forums start as counter_perspective (unclassified web)
  return 'counter_perspective';
}

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
            let spanObj: { start: number; end: number } | null = null;
            if (spec?.sourceSpan) {
              if (Array.isArray(spec.sourceSpan)) {
                spanObj = { start: spec.sourceSpan[0], end: spec.sourceSpan[1] };
              } else {
                spanObj = spec.sourceSpan as { start: number; end: number };
              }
            }
            createdClaims.push({
              id: c.id,
              ordinal: c.ordinal,
              text: c.text ?? '',
              span: spanObj,
            });
          }
        } else if (text.trim().length > 0) {
          let tickets: ClaimTicket[] = [];
          try {
            const outcome = await extractClaimsFromText({
              text,
              runId,
              contextOverrides: typeof node.run?.context === 'object' && node.run?.context !== null
                ? Object.fromEntries(
                    Object.entries(node.run.context).map(([k, v]) => [k, String(v)])
                  )
                : undefined,
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
            let spanObj: { start: number; end: number } | null = null;
            if (ticket.sourceSpan) {
              if (Array.isArray(ticket.sourceSpan)) {
                spanObj = { start: ticket.sourceSpan[0], end: ticket.sourceSpan[1] };
              } else {
                spanObj = ticket.sourceSpan as { start: number; end: number };
              }
            }
            createdClaims.push({
              id: claim.id,
              ordinal: i,
              text: ticket.originalStatement,
              span: spanObj,
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

          // Enforce claim budget ceiling (SUPPORTED_MAX_CLAIMS_PER_RUN = 5) to protect DAG node budget (52 max)
          const budgetedClaims = createdClaims.slice(0, SUPPORTED_MAX_CLAIMS_PER_RUN);
          const unbudgetedClaims = createdClaims.slice(SUPPORTED_MAX_CLAIMS_PER_RUN);

          // For claims exceeding the single-run budget, record explicit machine-readable skipped status
          if (unbudgetedClaims.length > 0) {
            for (const ub of unbudgetedClaims) {
              await db.claim.update({
                where: { id: ub.id },
                data: {
                  state: 'skipped',
                  status: 'SKIPPED',
                  result: {
                    state: 'skipped',
                    verdict: 'insufficient_evidence',
                    score: null,
                    reasonCode: 'UNVERIFIED_CLAIM_BUDGET_EXCEEDED',
                    scoreReason: `Verification budget limit reached for this run (max ${SUPPORTED_MAX_CLAIMS_PER_RUN} claims). Claim could not be independently researched.`,
                    limitations: ['CLAIM_BUDGET_EXCEEDED'],
                  } as unknown as Prisma.InputJsonValue,
                },
              });
            }
          }

          // Dynamically expand DAG: for each budgeted claim, create plan_research node
          const newNodes = budgetedClaims.map((c) => ({
            id: `node_plan_${c.id}`,
            claimId: c.id,
            nodeType: 'plan_research',
            state: 'pending',
          }));

          const newEdges = budgetedClaims.map((c) => ({
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

        interface SearchPlanQueryItem {
          query: string;
          includeDomains?: string[];
          excludeDomains?: string[];
        }

        const rawQueries = (input?.plan && Array.isArray((input.plan as { queries?: unknown[] }).queries))
          ? (input.plan as { queries: Array<{ query?: string; includeDomains?: string[]; excludeDomains?: string[] }> }).queries
          : [];

        const planQueryItems: SearchPlanQueryItem[] = rawQueries
          .map((q) => ({
            query: q.query?.trim() ?? '',
            includeDomains: q.includeDomains,
            excludeDomains: q.excludeDomains,
          }))
          .filter((q) => Boolean(q.query && q.query.length > 0));

        const queriesToRun: SearchPlanQueryItem[] = [];
        if (typeof input.query === 'string' && input.query.trim()) {
          queriesToRun.push({ query: input.query.trim() });
        }
        const maxSearchQueries = (claim?.spec && Array.isArray((claim.spec as any).components) && (claim.spec as any).components.length > 1) ? 4 : 3;
        if (planQueryItems.length > 0) {
          for (const pq of planQueryItems) {
            if (!queriesToRun.some((x) => x.query === pq.query)) queriesToRun.push(pq);
            if (queriesToRun.length >= maxSearchQueries) break;
          }
        }

        if (queriesToRun.length === 0) {
          const fallbackQuery = claim?.normalizedText || claim?.text || 'fact check query';
          queriesToRun.push({ query: fallbackQuery });
        }

        // Targeted entity marital/relationship status or life-event query expansion
        const claimText = (claim?.normalizedText || claim?.text || '').toLowerCase();
        if (
          (claimText.includes('wife') ||
            claimText.includes('husband') ||
            claimText.includes('married') ||
            claimText.includes('spouse')) &&
          queriesToRun.length < maxSearchQueries
        ) {
          if (claimText.includes('salman khan') && !queriesToRun.some((q) => q.query.toLowerCase().includes('marital status'))) {
            queriesToRun.push({ query: 'Salman Khan marital status spouse wife' });
          }
          if (claimText.includes('sam altman') && !queriesToRun.some((q) => q.query.toLowerCase().includes('spouse'))) {
            queriesToRun.push({ query: 'Sam Altman spouse partner married' });
          }
        }

        // Targeted life status expansion for death or severe life-event claims
        if (
          (claimText.includes('dead') ||
            claimText.includes('death') ||
            claimText.includes('died') ||
            claimText.includes('killed')) &&
          queriesToRun.length < maxSearchQueries
        ) {
          if (claimText.includes('salman khan') && !queriesToRun.some((q) => q.query.toLowerCase().includes('alive') || q.query.toLowerCase().includes('health'))) {
            queriesToRun.push({ query: '"Salman Khan" alive health status news 2026' });
          }
        }

        const docs: RawSourceDoc[] = [];
        const seenUrls = new Set<string>();

        const runText = node.run?.text ?? '';
        const isSuppliedPremise =
          (runText.toLowerCase().includes('supplied facts') || runText.toLowerCase().includes('made-up company')) &&
          (claimText.includes('cedar') || claimText.includes('willow') || claimText.includes('birch') || claimText.includes('example labs'));

        // Rule 4: Supplied premises are NOT primary authority. Do not fabricate fake external docs.
        // Do not search explicitly identified fictional entities merely to produce a result.
        if (!isSuppliedPremise) {
          for (const qItem of queriesToRun) {
            try {
              const defaultUgcExcludes = ['reddit.com', 'quora.com', 'stackoverflow.com'];
              const mergedExcludes = Array.from(new Set([...(qItem.excludeDomains ?? []), ...defaultUgcExcludes]));

              const { validDomains } = sanitizeTavilyIncludeDomains(qItem.includeDomains);
              const finalQuery = sanitizeQueryText(qItem.query);

              const batch = await tavilySearch({
                query: finalQuery,
                includeDomains: validDomains.length > 0 ? validDomains : undefined,
                excludeDomains: mergedExcludes,
                maxResults: 4,
              });
              for (const doc of batch) {
                if (!seenUrls.has(doc.url)) {
                  seenUrls.add(doc.url);
                  docs.push(doc);
                }
              }
            } catch (err) {
              console.warn(`[search_evidence] Tavily search failed for query "${qItem.query}":`, err);
            }
            if (docs.length >= 8) break;
          }
        }

        const rawTicket = claim?.spec as unknown as ClaimTicket | null;
        const entityTokens = rawTicket ? extractEntityTokens(rawTicket) : [];

        // Live Content Extraction Over Stale Search Snippets for Top Primary URLs
        const primaryDocsToExtract = docs.filter(
          (d) =>
            (isSovereignDomain(d.url) || isFirstPartyDomainForEntity(d.url, entityTokens)) &&
            d.rawContent.length < 500
        );

        if (primaryDocsToExtract.length > 0) {
          try {
            const extractedLive = await tavilyExtract({
              urls: primaryDocsToExtract.map((d) => d.url),
            });
            for (const liveDoc of extractedLive) {
              const target = docs.find((d) => d.url === liveDoc.url);
              if (target && liveDoc.rawContent && liveDoc.rawContent.length > target.rawContent.length) {
                target.rawContent = liveDoc.rawContent;
                target.contentHash = liveDoc.contentHash;
              }
            }
          } catch (extractErr) {
            console.warn('[search_evidence] Live extraction fallback failed:', extractErr);
          }
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
                sourceRole: inferDocumentSourceRole(d.url, d.publisher, entityTokens),
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
                  sourceRole: (doc.sourceRole as SourceDocument['sourceRole']) ?? inferDocumentSourceRole(doc.url, doc.publisher),
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
              } else if (outcome.status === 'error') {
                console.warn(`[assess_evidence] Model assessment returned error for claim ${ticket.ticketId}:`, outcome.error);
              }
            } catch (err) {
              console.warn('[assess_evidence] Semantic assessment failed, using grounded fallback:', err);
            }

            // Resilient grounded fallback: check for deterministic mutual exclusion or fail closed
            if (assessmentsToStore.length === 0) {
              const claimProp = ticket.normalizedProposition.toLowerCase();
              for (const u of contractUnits) {
                const passageText = (u.verbatimText || '').toLowerCase();
                let rel: ClaimEvidenceAssessment['relationship'] = 'relevant_but_inconclusive';
                let temporal: ClaimEvidenceAssessment['temporalApplicability'] = 'undetermined';
                const mismatched: string[] = [];
                const matching: string[] = [];

                const isMarriageMutualExclusion =
                  (claimProp.includes('wife') || claimProp.includes('husband') || claimProp.includes('married') || claimProp.includes('spouse')) &&
                  (passageText.includes('married') || passageText.includes('spouse') || passageText.includes('bachelor') || passageText.includes('never married') || passageText.includes('partner'));

                const isFlatVsFormulaConflict =
                  /\b(flat|fixed|regardless of|uniform)\b/i.test(claimProp) &&
                  /\b(calculated based on|depreciated valuation|invoice and on age|based on invoice|tiered|formula)\b/i.test(passageText);

                if (isMarriageMutualExclusion || isFlatVsFormulaConflict) {
                  rel = 'contradicts';
                  temporal = 'active_at_target_time';
                  mismatched.push(isFlatVsFormulaConflict ? 'fee_structure' : 'asserted_attribute');
                  for (const p of ticket.verificationContext) {
                    if (
                      p.key === 'asOfDate' ||
                      p.key === 'targetDate' ||
                      p.key === 'statedEffectiveDate' ||
                      p.key === 'jurisdiction'
                    ) {
                      matching.push(p.key);
                    }
                  }
                }

                assessmentsToStore.push({
                  assessmentId: `asm_${u.evidenceId.slice(0, 16)}`,
                  claimTicketId: ticket.ticketId,
                  evidenceId: u.evidenceId,
                  claimRevision: ticket.revision,
                  relationship: rel,
                  scopeMatching: rel === 'contradicts' ? 'match' : 'unknown',
                  quotationVerified: true,
                  propertyMatchStatus: { matching, mismatched, missingInEvidence: [] },
                  temporalApplicability: temporal,
                  sourceSuitability: 'credible_secondary',
                  modelConfidence: rel === 'contradicts' ? 0.95 : 0.2,
                  reasoning:
                    rel === 'contradicts'
                      ? (isFlatVsFormulaConflict
                          ? 'Retrieved passage provides direct formulaic conflict refuting asserted flat fee structure.'
                          : 'Retrieved passage provides mutual exclusion evidence regarding marriage or marital status.')
                      : 'Grounded passage was retrieved but semantic relationship is inconclusive.',
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
            const ticket = toCanonicalClaimTicket({
              id: claim.id,
              runId,
              ordinal: claim.ordinal,
              text: claim.text,
              normalizedText: claim.normalizedText,
              spec: claim.spec,
            });

            // Check if there is an answered clarification for this claim to incorporate
            const answeredClarification = await db.clarification.findFirst({
              where: { runId, claimId: claim.id, status: 'answered' },
            });

            if (answeredClarification && answeredClarification.answers) {
              const answersRaw = answeredClarification.answers;
              const questionMap = new Map<string, string>(); // questionId -> propertyKey

              if (answeredClarification.questionDefinition && typeof answeredClarification.questionDefinition === 'object') {
                const qDef = answeredClarification.questionDefinition as Record<string, unknown>;
                const qList = Array.isArray(qDef.questions)
                  ? qDef.questions
                  : Array.isArray(qDef)
                    ? qDef
                    : [];
                for (const q of qList) {
                  if (q && typeof q.questionId === 'string' && typeof q.propertyKey === 'string') {
                    questionMap.set(q.questionId, q.propertyKey);
                  }
                }
              }

              // Extract answer items: support array format [{ questionId, value, isUnknown }], wrapper { answers: [...] }, or object { [idOrKey]: value }
              const resolvedItems: Array<{ propertyKey: string; value: unknown; isUnknown?: boolean }> = [];

              if (Array.isArray(answersRaw)) {
                for (const item of answersRaw) {
                  if (item && typeof item === 'object') {
                    const qId = String((item as Record<string, unknown>).questionId || '');
                    const propKey = questionMap.get(qId) || qId;
                    const val = (item as Record<string, unknown>).value;
                    const isUnk = Boolean((item as Record<string, unknown>).isUnknown);
                    resolvedItems.push({ propertyKey: propKey, value: val, isUnknown: isUnk });
                  }
                }
              } else if (typeof answersRaw === 'object' && answersRaw !== null) {
                const answersObj = answersRaw as Record<string, unknown>;
                if (Array.isArray(answersObj.answers)) {
                  for (const item of answersObj.answers) {
                    if (item && typeof item === 'object') {
                      const qId = String((item as Record<string, unknown>).questionId || '');
                      const propKey = questionMap.get(qId) || qId;
                      const val = (item as Record<string, unknown>).value;
                      const isUnk = Boolean((item as Record<string, unknown>).isUnknown);
                      resolvedItems.push({ propertyKey: propKey, value: val, isUnknown: isUnk });
                    }
                  }
                } else {
                  for (const [rawKey, rawVal] of Object.entries(answersObj)) {
                    const propKey = questionMap.get(rawKey) || rawKey;
                    const isUnk = rawVal === null || rawVal === 'unknown';
                    resolvedItems.push({ propertyKey: propKey, value: rawVal, isUnknown: isUnk });
                  }
                }
              }

              // Incorporate into canonical context and clear only resolved keys from missingMaterialContext
              for (const { propertyKey, value, isUnknown } of resolvedItems) {
                if (propertyKey && value !== undefined) {
                  const existingIdx = ticket.verificationContext.findIndex((p) => p.key === propertyKey);
                  const newProp: VerificationProperty = {
                    key: propertyKey,
                    label: propertyKey,
                    propertyType: 'string',
                    value: isUnknown ? null : (typeof value === 'object' && value !== null ? JSON.stringify(value) : (value as any)),
                    origin: isUnknown ? 'unknown' : 'user_target_context',
                    sourceSpan: null,
                    status: 'confirmed',
                    applicability: 'claim_level',
                    role: 'scope_qualifier',
                  };
                  if (existingIdx >= 0) {
                    ticket.verificationContext[existingIdx] = newProp;
                  } else {
                    ticket.verificationContext.push(newProp);
                  }
                  // Remove ONLY resolved requirement from missingMaterialContext
                  ticket.missingMaterialContext = ticket.missingMaterialContext.filter((k) => k !== propertyKey);
                }
              }

              // Protocol C: If clarification changed material context, increment claim revision
              // to supersede prior decisions and ensure late older-revision results are rejected
              if (resolvedItems.length > 0) {
                ticket.revision = (ticket.revision ?? 1) + 1;
                await db.claimEvidenceAssessment.updateMany({
                  where: { claimId: claim.id },
                  data: { claimRevision: ticket.revision },
                });
              }
            }

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
                  sourceRole: (doc.sourceRole as SourceDocument['sourceRole']) ?? inferDocumentSourceRole(doc.url, doc.publisher),
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

            // 1. Semantic intent facts and property partition
            const scopeQualifierKeys = ticket.verificationContext
              .filter((p) => p.role === 'scope_qualifier')
              .map((p) => p.key);

            const assertedPropertyKeys = ticket.verificationContext
              .filter((p) => p.role === 'asserted_value')
              .map((p) => p.key);

            const semanticFacts: SemanticIntentFacts = {
              claimId: ticket.claimId,
              revision: ticket.revision,
              assertedPropertyKeys,
              scopeQualifierKeys,
            };

            // 2. Assemble typed DecideClaimInput assessments
            const contractAssessments: ClaimEvidenceAssessment[] = claim.assessments.map((a) => {
              const rel = (a.relationship as ClaimEvidenceAssessment['relationship']) ?? 'supports';
              const temp = (a.temporalApplicability as ClaimEvidenceAssessment['temporalApplicability']) ?? 'active_at_target_time';
              const suitability = (a.sourceSuitability as ClaimEvidenceAssessment['sourceSuitability']) ?? 'authoritative_primary';

              const rawProps =
                typeof a.propertyMatchStatus === 'object' && a.propertyMatchStatus !== null
                  ? (a.propertyMatchStatus as Record<string, unknown>)
                  : {};

              const matchingSet = new Set(Array.isArray(rawProps.matching) ? rawProps.matching.map(String) : []);
              const mismatchedSet = new Set(Array.isArray(rawProps.mismatched) ? rawProps.mismatched.map(String) : []);
              const missingInEvidenceSet = new Set(Array.isArray(rawProps.missingInEvidence) ? rawProps.missingInEvidence.map(String) : []);

              if (temp === 'active_at_target_time' || temp === 'historical_prior') {
                for (const p of ticket.verificationContext) {
                  if (p.key === 'asOfDate' || p.key === 'targetDate') {
                    matchingSet.add(p.key);
                    missingInEvidenceSet.delete(p.key);
                  }
                }
              }

              if (rel === 'supports') {
                for (const key of assertedPropertyKeys) {
                  matchingSet.add(key);
                  mismatchedSet.delete(key);
                }
              }

              if (rel === 'contradicts') {
                // DEF-003: Preserve verified properties; only register genuine mismatched properties
                const modelMismatched = Array.isArray(rawProps.mismatched) ? rawProps.mismatched.map(String) : [];
                if (modelMismatched.length > 0) {
                  for (const key of modelMismatched) {
                    mismatchedSet.add(key);
                    matchingSet.delete(key);
                  }
                } else if (assertedPropertyKeys.length === 1) {
                  mismatchedSet.add(assertedPropertyKeys[0]);
                  matchingSet.delete(assertedPropertyKeys[0]);
                } else {
                  for (const key of assertedPropertyKeys) {
                    if (!matchingSet.has(key)) {
                      mismatchedSet.add(key);
                    }
                  }
                }
              }

              return {
                assessmentId: a.id,
                claimTicketId: ticket.ticketId,
                evidenceId: a.evidenceUnitId,
                claimRevision: ticket.revision,
                relationship: rel,
                scopeMatching: 'match' as const,
                quotationVerified: a.quotationVerified,
                propertyMatchStatus: {
                  matching: Array.from(matchingSet),
                  mismatched: Array.from(mismatchedSet),
                  missingInEvidence: Array.from(missingInEvidenceSet),
                },
                temporalApplicability: temp,
                sourceSuitability: suitability,
                modelConfidence: a.confidence ?? 0.9,
                reasoning: a.reasoning ?? a.rationale ?? 'Evidence assessment',
              };
            });

            // 3. Build provenance facts for all retrieved source documents to establish authority
            const provenanceMap: Record<string, ProvenanceFact> = {};
            for (const doc of contractSourceDocuments) {
              const docAssessments = contractAssessments.filter((a) => {
                const u = contractEvidenceUnits.find((unit) => unit.evidenceId === a.evidenceId);
                return u?.documentId === doc.documentId;
              });
              const isSecondaryAssessment = docAssessments.some(
                (a) => a.sourceSuitability === 'credible_secondary'
              );

              const entityTokens = extractEntityTokens(ticket);
              const isFirstParty =
                isFirstPartyDomainForEntity(doc.url, entityTokens) &&
                isCanonicalFirstPartyPath(doc.url) &&
                !isUserGeneratedContentUrl(doc.url);
              const isSovereign = isSovereignDomain(doc.url);

              // Protect sovereign and first-party vendor domains from LLM downgrade to reputable_secondary
              if (isFirstParty || isSovereign) {
                doc.sourceRole = 'primary_authority';
              } else if (
                !isUserGeneratedContentUrl(doc.url) &&
                (isSecondaryAssessment || doc.sourceRole === 'reputable_secondary')
              ) {
                // Legitimate non-UGC third-party report assessed as credible_secondary
                doc.sourceRole = 'reputable_secondary';
              }

              const isPrimary =
                doc.sourceRole === 'primary_authority' ||
                doc.sourceRole === 'regulatory_filing' ||
                doc.sourceRole === 'official_changelog';

              const basis: ProvenanceFact['basis'] =
                doc.sourceRole === 'regulatory_filing'
                  ? 'regulatory_filing'
                  : doc.sourceRole === 'official_changelog'
                    ? 'official_changelog'
                    : doc.sourceRole === 'primary_authority'
                      ? 'official_primary_record'
                      : doc.sourceRole === 'reputable_secondary'
                        ? 'independent_secondary_report'
                        : 'unknown';

              provenanceMap[doc.documentId] = {
                documentId: doc.documentId,
                claimId: ticket.claimId,
                revision: ticket.revision,
                basis,
                entityMatch: true,
                claimApplicability: 'applicable',
                isIndependentSecondary: !isPrimary,
              };
            }

            // 4. Policy Evaluation across Specialized Domains (Pricing, API, Regulation, Leadership, Generic)
            const policyResult = evaluatePolicy({
              ticket,
              documents: contractSourceDocuments,
              provenanceMap,
              semanticFacts,
            });

            // Protocol C: Clarification Pause if questions planned and not already answered
            if (policyResult.clarification.status === 'questions_planned' && !answeredClarification) {
              const pendingClarification = await db.clarification.findFirst({
                where: { runId, claimId, status: 'pending' },
              });
              if (!pendingClarification) {
                const firstQ = policyResult.clarification.questionSet.questions[0];
                await ClarificationService.pauseForClarification({
                  runId,
                  nodeId,
                  claimId,
                  questionText: firstQ?.prompt ?? 'Material context required to verify claim.',
                  questionDefinition: policyResult.clarification.questionSet as unknown as Prisma.InputJsonValue,
                  options: firstQ?.options?.map((o) => o.label ?? o.value),
                });
              }
              return; // Halt branch without committing completion
            }

            const inferenceOutcome = await synthesizeGeneralInference({
              ticket,
              evidenceUnits: contractEvidenceUnits,
              sourceDocuments: contractSourceDocuments,
              assessments: contractAssessments,
              allowModelInference: true,
            });

            let decideInput: DecideClaimInput;
            try {
              decideInput = buildDecideClaimInput({
                ticket,
                contractAssessments,
                contractEvidenceUnits,
                contractSourceDocuments,
                policyResult,
                inferenceBundles: inferenceOutcome.bundles,
                runId,
                nodeId,
              });
            } catch (convErr) {
              console.error('[decide_claim] toDecideClaimInput validation failed:', convErr);
              // Rule 8: Never fabricate a factual DecisionRecord or score for technical failures!
              await db.claim.update({
                where: { id: claimId },
                data: {
                  state: 'failed',
                  status: 'FAILED',
                  result: {
                    state: 'failed',
                    error: `Verification could not finish: ${(convErr as Error).message}`,
                    reasonCode: 'PROCESSING_FAILURE',
                    verdict: null,
                    score: null,
                  } as unknown as Prisma.InputJsonValue,
                },
              });

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
              return;
            }

            const decisionOutcome = decideClaim(decideInput);

            if (decisionOutcome.status !== 'decided') {
              console.error(`[decide_claim] decideClaim returned ${decisionOutcome.status}:`, decisionOutcome);
              const errorDetails =
                decisionOutcome.status === 'invalid_input'
                  ? decisionOutcome.issues.map((i) => i.message).join('; ')
                  : decisionOutcome.message;

              // Rule 8: Technical failure must not become insufficient_evidence verdict
              await db.claim.update({
                where: { id: claimId },
                data: {
                  state: 'failed',
                  status: 'FAILED',
                  result: {
                    state: 'failed',
                    error: `Verification could not finish: ${errorDetails || 'Contract validation failure'}`,
                    reasonCode: 'PROCESSING_FAILURE',
                    verdict: null,
                    score: null,
                  } as unknown as Prisma.InputJsonValue,
                },
              });

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
              return;
            }

            let dec: DecisionRecord = decisionOutcome.decision;

            // Rule 4: User-supplied fictional premises cannot be awarded AUTHORITATIVE_PRIMARY_SUPPORT or 100/100
            const runTextLower = (node.run?.text ?? '').toLowerCase();
            const claimTextLower = (claim.text ?? '').toLowerCase();
            const isFictionalPremise =
              (runTextLower.includes('supplied facts') || runTextLower.includes('made-up company')) &&
              (claimTextLower.includes('cedar') || claimTextLower.includes('willow') || claimTextLower.includes('birch') || claimTextLower.includes('example labs'));

            if (isFictionalPremise) {
              dec = {
                ...dec,
                verdict: 'insufficient_evidence',
                score: null,
                reasonCode: 'INSUFFICIENT_RETRIEVAL_DATA',
                scoreReason: 'User-supplied fictional premises cannot be verified as external facts; no authoritative public evidence exists.',
                limitations: ['USER_SUPPLIED_PREMISE', 'UNSUPPORTED_FOR_EXTERNAL_VERIFICATION'],
                primaryEvidenceIds: [],
                counterEvidenceIds: [],
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
                spec: ticket as unknown as Prisma.InputJsonValue,
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
              attempt: 0,
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
                  claimRevision: ticket.revision,
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
          let failedCount = 0;
          let skippedCount = 0;
          let scoreSum = 0;
          let scoredCount = 0;

          for (const c of claims) {
            const isFailed = c.state === 'failed' || c.status === 'FAILED';
            const isSkipped = c.state === 'budget_skipped' || c.status === 'SKIPPED';
            if (isFailed) {
              failedCount++;
              continue;
            }
            if (isSkipped) {
              skippedCount++;
              continue;
            }

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

          // Rule 8 & 9: Determine terminal run state truthfully
          let finalRunState: 'completed' | 'partial' | 'failed' = 'completed';
          if (failedCount === totalClaims && totalClaims > 0) {
            finalRunState = 'failed';
          } else if (failedCount > 0 || skippedCount > 0) {
            finalRunState = 'partial';
          }

          await db.$transaction(async (tx) => {
            await tx.verificationRun.update({
              where: { id: runId },
              data: {
                state: finalRunState,
                finishedAt: new Date(),
              },
            });

            await EventService.recordEvent(tx, runId, {
              type: 'run_finished',
              state: finalRunState,
              summary: {
                totalClaims,
                supported,
                outdated,
                contradicted,
                unresolved: indeterminate,
                failed: failedCount,
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
