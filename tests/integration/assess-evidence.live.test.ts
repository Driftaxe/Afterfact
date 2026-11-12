import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

import { describe, it, expect } from 'vitest';
import type { ClaimTicket } from '@/lib/contracts/claim-ticket';
import type { SourceDocument } from '@/lib/contracts/evidence-objects';
import { generateResearchPlan } from '@/server/verify/research-planner';
import { extractEvidenceUnits } from '@/server/verify/extract-evidence';
import { assessEvidenceAgainstClaim } from '@/server/verify/assess-evidence';

// The live integration test runs when a live gateway is configured.
const isLiveGatewayConfigured = Boolean(
  process.env.BIFROST_GATEWAY_TOKEN ||
  process.env.BIFROST_ADMIN_PASSWORD ||
  (process.env.BIFROST_BASE_URL && !process.env.BIFROST_BASE_URL.includes('127.0.0.1'))
);

describe.skipIf(!isLiveGatewayConfigured)(
  'Live Bifrost Verification Pipeline Integration Test (E4)',
  () => {
    const liveTicket: ClaimTicket = {
      ticketId: `tkt_live_${Date.now()}`,
      claimId: `clm_live_${Date.now()}`,
      runId: `run_live_${Date.now()}`,
      inputHash: 'hash_live_test_1234567890abcdef',
      revision: 1,
      domain: 'pricing',
      originalStatement: 'SolisDB v2 charges $15 per node per month in the EU.',
      sourceSpan: { start: 0, end: 51 },
      normalizedProposition: 'SolisDB version 2 charges 15 USD per node per month in the European Union.',
      targetTime: '2026-11-08',
      missingMaterialContext: [],
      verificationContext: [
        {
          key: 'jurisdiction',
          label: 'Geographic Jurisdiction',
          propertyType: 'string',
          value: 'EU',
          origin: 'explicit_claim_text',
          sourceSpan: { start: 45, end: 47 },
          status: 'confirmed',
          applicability: 'claim_level',
        },
      ],
    };

    const liveSourceDoc: SourceDocument = {
      documentId: `doc_live_${Date.now()}`,
      runId: liveTicket.runId,
      url: 'https://solisdb.com/pricing-eu',
      finalUrl: 'https://solisdb.com/pricing-eu',
      retrievedContentHash: 'hash_source_doc_live_test',
      retrievedAt: new Date().toISOString(),
      rawText: `# SolisDB Cloud Pricing

## European Union Rates
Standard deployments of SolisDB v2 in the European Union are billed at $15 per node per month.*

*Excludes custom enterprise SLAs.

## United States Rates
Deployments in US East are billed at $20 per node per month.`,
      extractionStatus: 'success',
      publicationDate: '2026-01-15',
      effectiveDate: '2026-02-01',
      sourceRole: 'primary_authority',
    };

    it(
      'generates a research plan, extracts grounded evidence, and performs semantic assessment against live Bifrost gateway',
      { timeout: 45000, retry: 2 },
      async () => {
        // Stage 1: Research Planning
        const planOutcome = await generateResearchPlan({
          ticket: liveTicket,
          round: 1,
          remainingQueryAllowance: 4,
        });

        expect(planOutcome.status).toBe('success');
        if (planOutcome.status !== 'success') return;
        expect(planOutcome.plan.queries.length).toBeGreaterThanOrEqual(1);
        expect(planOutcome.plan.claimTicketId).toBe(liveTicket.ticketId);

        // Stage 2: Grounded Evidence Extraction
        const extractOutcome = await extractEvidenceUnits({
          source: liveSourceDoc,
          ticket: liveTicket,
          maxPassages: 2,
        });

        expect(extractOutcome.status).toBe('success');
        if (extractOutcome.status !== 'success') return;
        expect(extractOutcome.evidenceUnits.length).toBeGreaterThanOrEqual(1);

        const firstUnit = extractOutcome.evidenceUnits[0];
        // Must be an exact substring in rawText
        expect(liveSourceDoc.rawText!.includes(firstUnit.verbatimText)).toBe(true);

        // Stage 3: Semantic Assessment
        const assessOutcome = await assessEvidenceAgainstClaim({
          ticket: liveTicket,
          evidenceUnits: extractOutcome.evidenceUnits,
          sourceDocuments: new Map([[liveSourceDoc.documentId, liveSourceDoc]]),
        });

        expect(assessOutcome.status).toBe('success');
        if (assessOutcome.status !== 'success') return;
        expect(assessOutcome.assessments.length).toBeGreaterThanOrEqual(1);
        expect(assessOutcome.assessments[0].quotationVerified).toBe(true);
        expect(assessOutcome.assessments[0].claimTicketId).toBe(liveTicket.ticketId);
      }
    );
  }
);
