import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

import { describe, it, expect } from 'vitest';
import type { ClaimTicket } from '@/lib/contracts/claim-ticket';
import type {
  EvidenceUnit,
  SourceDocument,
} from '@/lib/contracts/evidence-objects';
import { assessEvidenceAgainstClaim } from '@/server/verify/assess-evidence';
import goldenReportJson from '../../fixtures/golden-mixed-report.json';

const isLiveGatewayConfigured = Boolean(
  process.env.BIFROST_GATEWAY_TOKEN ||
  process.env.BIFROST_ADMIN_PASSWORD ||
  (process.env.BIFROST_BASE_URL && !process.env.BIFROST_BASE_URL.includes('127.0.0.1'))
);

describe.skipIf(!isLiveGatewayConfigured)(
  'Reproducibility Audit: Mode B — Frozen-Source Model Evaluation (Live Bifrost Gateway)',
  () => {
    const TARGET_TIME = goldenReportJson.asOfDate; // '2024-09-01'

    // =========================================================================
    // Claim 0: Anthropic Claude Pro ($20/month US)
    // =========================================================================
    it('Mode B - Claim 0 (Pricing): live Bifrost assessment against frozen passage', async () => {
      const rawPassage = goldenReportJson.evidence[0].passage;
      const ticket: ClaimTicket = {
        ticketId: 'tkt_b_pricing_01',
        claimId: 'clm_b_pricing_01',
        runId: 'run_mode_b_01',
        inputHash: 'hash_b_pricing_01',
        revision: 1,
        originalStatement: goldenReportJson.claims[0].rawText,
        normalizedProposition: 'Anthropic Claude Pro subscription costs $20 per month in the United States.',
        domain: 'pricing',
        targetTime: TARGET_TIME,
        verificationContext: [
          {
            key: 'plan_tier',
            label: 'Plan tier',
            propertyType: 'string',
            value: 'Pro',
            origin: 'explicit_claim_text',
            sourceSpan: { start: 17, end: 20 },
            status: 'confirmed',
            applicability: 'claim_level',
          },
          {
            key: 'price',
            label: 'Price',
            propertyType: 'number',
            value: 20,
            units: 'USD',
            origin: 'explicit_claim_text',
            sourceSpan: { start: 27, end: 30 },
            status: 'confirmed',
            applicability: 'claim_level',
          },
          {
            key: 'jurisdiction',
            label: 'Jurisdiction',
            propertyType: 'string',
            value: 'US',
            origin: 'user_target_context',
            status: 'confirmed',
            applicability: 'run_level',
          },
          {
            key: 'billing_term',
            label: 'Billing term',
            propertyType: 'selection',
            value: 'monthly',
            origin: 'explicit_claim_text',
            sourceSpan: { start: 35, end: 44 },
            status: 'confirmed',
            applicability: 'claim_level',
          },
        ],
        missingMaterialContext: [],
      };

      const doc: SourceDocument = {
        documentId: 'doc_b_pricing_01',
        runId: 'run_mode_b_01',
        url: goldenReportJson.evidence[0].url,
        finalUrl: goldenReportJson.evidence[0].url,
        retrievedContentHash: 'hash_doc_b_01',
        retrievedAt: goldenReportJson.evidence[0].retrievedAt,
        rawText: rawPassage,
        extractionStatus: 'success',
        publicationDate: goldenReportJson.evidence[0].publicationDate,
        effectiveDate: goldenReportJson.evidence[0].effectiveDate,
        sourceRole: 'primary_authority',
      };

      const unit: EvidenceUnit = {
        evidenceId: 'evi_pricing_01',
        documentId: 'doc_b_pricing_01',
        verbatimText: rawPassage,
        locator: { charOffsetStart: 0, charOffsetEnd: rawPassage.length },
        surroundingHeaders: ['Subscription Plans'],
        extractedProperties: ticket.verificationContext,
        extractionLimitations: [], footnotes: [],
      };

      const outcome = await assessEvidenceAgainstClaim({
        ticket,
        evidenceUnits: [unit],
        sourceDocuments: new Map([[doc.documentId, doc]]),
      });

      console.log('Mode B Claim 0 Assessment Outcome:', JSON.stringify(outcome, null, 2));

      expect(outcome.status).toBe('success');
      if (outcome.status === 'success') {
        expect(outcome.assessments.length).toBeGreaterThanOrEqual(1);
        const asm = outcome.assessments[0];
        expect(asm.relationship).toBe('supports');
        expect(asm.quotationVerified).toBe(true);
      }
    }, 30000);

    // =========================================================================
    // Claim 1: Stripe payment_method_types deprecated
    // =========================================================================
    it('Mode B - Claim 1 (API): live Bifrost assessment against frozen passage', async () => {
      const rawPassage = goldenReportJson.evidence[1].passage;
      const ticket: ClaimTicket = {
        ticketId: 'tkt_b_api_01',
        claimId: 'clm_b_api_01',
        runId: 'run_mode_b_01',
        inputHash: 'hash_b_api_01',
        revision: 1,
        originalStatement: goldenReportJson.claims[1].rawText,
        normalizedProposition: "Stripe's payment intent requires specifying payment_method_types manually on modern API versions.",
        domain: 'api',
        targetTime: TARGET_TIME,
        verificationContext: [
          {
            key: 'vendor',
            label: 'Vendor',
            propertyType: 'string',
            value: 'Stripe',
            origin: 'explicit_claim_text',
            sourceSpan: { start: 0, end: 6 },
            status: 'confirmed',
            applicability: 'claim_level',
          },
          {
            key: 'api_parameter',
            label: 'API Parameter',
            propertyType: 'string',
            value: 'payment_method_types',
            origin: 'explicit_claim_text',
            sourceSpan: { start: 53, end: 73 },
            status: 'confirmed',
            applicability: 'claim_level',
          },
          {
            key: 'status',
            label: 'Requirement status',
            propertyType: 'string',
            value: 'required',
            origin: 'explicit_claim_text',
            sourceSpan: { start: 24, end: 32 },
            status: 'confirmed',
            applicability: 'claim_level',
          },
        ],
        missingMaterialContext: [],
      };

      const doc: SourceDocument = {
        documentId: 'doc_b_api_01',
        runId: 'run_mode_b_01',
        url: goldenReportJson.evidence[1].url,
        finalUrl: goldenReportJson.evidence[1].url,
        retrievedContentHash: 'hash_doc_b_api',
        retrievedAt: goldenReportJson.evidence[1].retrievedAt,
        rawText: rawPassage,
        extractionStatus: 'success',
        publicationDate: goldenReportJson.evidence[1].publicationDate,
        effectiveDate: goldenReportJson.evidence[1].effectiveDate,
        sourceRole: 'primary_authority',
      };

      const unit: EvidenceUnit = {
        evidenceId: 'evi_api_01',
        documentId: 'doc_b_api_01',
        verbatimText: rawPassage,
        locator: { charOffsetStart: 0, charOffsetEnd: rawPassage.length },
        surroundingHeaders: ['Payment Intents API'],
        extractedProperties: ticket.verificationContext,
        extractionLimitations: [], footnotes: [],
      };

      const outcome = await assessEvidenceAgainstClaim({
        ticket,
        evidenceUnits: [unit],
        sourceDocuments: new Map([[doc.documentId, doc]]),
      });

      console.log('Mode B Claim 1 Assessment Outcome:', JSON.stringify(outcome, null, 2));

      expect(outcome.status).toBe('success');
      if (outcome.status === 'success') {
        expect(outcome.assessments.length).toBeGreaterThanOrEqual(1);
        const asm = outcome.assessments[0];
        expect(asm.relationship).toBe('contradicts');
      }
    }, 30000);

    // =========================================================================
    // Claim 2: EU AI Act Systemic Risk
    // =========================================================================
    it('Mode B - Claim 2 (Regulation): live Bifrost assessment against frozen passages', async () => {
      const rawPassage1 = goldenReportJson.evidence[2].passage;
      const rawPassage2 = goldenReportJson.evidence[3].passage;

      const ticket: ClaimTicket = {
        ticketId: 'tkt_b_reg_01',
        claimId: 'clm_b_reg_01',
        runId: 'run_mode_b_01',
        inputHash: 'hash_b_reg_01',
        revision: 1,
        originalStatement: goldenReportJson.claims[2].rawText,
        normalizedProposition: 'The EU AI Act classifies general-purpose AI models with systemic risk under transparency and evaluation rules.',
        domain: 'regulation',
        targetTime: TARGET_TIME,
        verificationContext: [
          {
            key: 'jurisdiction',
            label: 'Jurisdiction',
            propertyType: 'string',
            value: 'EU',
            origin: 'explicit_claim_text',
            sourceSpan: { start: 4, end: 13 },
            status: 'confirmed',
            applicability: 'claim_level',
          },
          {
            key: 'requirement',
            label: 'Regulatory requirement',
            propertyType: 'string',
            value: 'transparency and evaluation rules for systemic risk',
            origin: 'explicit_claim_text',
            sourceSpan: { start: 67, end: 109 },
            status: 'confirmed',
            applicability: 'claim_level',
          },
        ],
        missingMaterialContext: [],
      };

      const doc1: SourceDocument = {
        documentId: 'doc_b_reg_01',
        runId: 'run_mode_b_01',
        url: goldenReportJson.evidence[2].url,
        finalUrl: goldenReportJson.evidence[2].url,
        retrievedContentHash: 'hash_doc_b_reg1',
        retrievedAt: goldenReportJson.evidence[2].retrievedAt,
        rawText: rawPassage1,
        extractionStatus: 'success',
        publicationDate: goldenReportJson.evidence[2].publicationDate,
        effectiveDate: goldenReportJson.evidence[2].effectiveDate,
        sourceRole: 'regulatory_filing',
      };

      const doc2: SourceDocument = {
        documentId: 'doc_b_reg_02',
        runId: 'run_mode_b_01',
        url: goldenReportJson.evidence[3].url,
        finalUrl: goldenReportJson.evidence[3].url,
        retrievedContentHash: 'hash_doc_b_reg2',
        retrievedAt: goldenReportJson.evidence[3].retrievedAt,
        rawText: rawPassage2,
        extractionStatus: 'success',
        publicationDate: goldenReportJson.evidence[3].publicationDate,
        effectiveDate: goldenReportJson.evidence[3].effectiveDate,
        sourceRole: 'primary_authority',
      };

      const unit1: EvidenceUnit = {
        evidenceId: 'evi_regulation_01',
        documentId: 'doc_b_reg_01',
        verbatimText: rawPassage1,
        locator: { charOffsetStart: 0, charOffsetEnd: rawPassage1.length },
        surroundingHeaders: ['Entry into Force'],
        extractedProperties: ticket.verificationContext,
        extractionLimitations: [], footnotes: [],
      };

      const unit2: EvidenceUnit = {
        evidenceId: 'evi_regulation_02',
        documentId: 'doc_b_reg_02',
        verbatimText: rawPassage2,
        locator: { charOffsetStart: 0, charOffsetEnd: rawPassage2.length },
        surroundingHeaders: ['AI Office Guidelines'],
        extractedProperties: ticket.verificationContext,
        extractionLimitations: [], footnotes: [],
      };

      const outcome = await assessEvidenceAgainstClaim({
        ticket,
        evidenceUnits: [unit1, unit2],
        sourceDocuments: new Map([
          [doc1.documentId, doc1],
          [doc2.documentId, doc2],
        ]),
      });

      console.log('Mode B Claim 2 Assessment Outcome:', JSON.stringify(outcome, null, 2));

      expect(outcome.status).toBe('success');
      if (outcome.status === 'success') {
        expect(outcome.assessments.length).toBeGreaterThanOrEqual(1);
      }
    }, 30000);

    // =========================================================================
    // Claim 3: Parag Agrawal CEO of Twitter
    // =========================================================================
    it('Mode B - Claim 3 (Leadership): live Bifrost assessment against frozen historical & superseding passages', async () => {
      const rawPassage1 = goldenReportJson.evidence[4].passage; // Agrawal 2021
      const rawPassage2 = goldenReportJson.evidence[5].passage; // Yaccarino 2023

      const ticket: ClaimTicket = {
        ticketId: 'tkt_b_lead_01',
        claimId: 'clm_b_lead_01',
        runId: 'run_mode_b_01',
        inputHash: 'hash_b_lead_01',
        revision: 1,
        originalStatement: goldenReportJson.claims[3].rawText,
        normalizedProposition: 'Parag Agrawal is the current Chief Executive Officer of Twitter.',
        domain: 'leadership',
        targetTime: TARGET_TIME,
        verificationContext: [
          {
            key: 'person',
            label: 'Person',
            propertyType: 'string',
            value: 'Parag Agrawal',
            origin: 'explicit_claim_text',
            sourceSpan: { start: 0, end: 13 },
            status: 'confirmed',
            applicability: 'claim_level',
          },
          {
            key: 'role',
            label: 'Role',
            propertyType: 'string',
            value: 'CEO',
            origin: 'explicit_claim_text',
            sourceSpan: { start: 28, end: 31 },
            status: 'confirmed',
            applicability: 'claim_level',
          },
          {
            key: 'entity',
            label: 'Entity',
            propertyType: 'string',
            value: 'Twitter',
            origin: 'explicit_claim_text',
            sourceSpan: { start: 35, end: 42 },
            status: 'confirmed',
            applicability: 'claim_level',
          },
        ],
        missingMaterialContext: [],
      };

      const doc1: SourceDocument = {
        documentId: 'doc_b_lead_01',
        runId: 'run_mode_b_01',
        url: goldenReportJson.evidence[4].url,
        finalUrl: goldenReportJson.evidence[4].url,
        retrievedContentHash: 'hash_doc_b_lead1',
        retrievedAt: goldenReportJson.evidence[4].retrievedAt,
        rawText: rawPassage1,
        extractionStatus: 'success',
        publicationDate: goldenReportJson.evidence[4].publicationDate,
        effectiveDate: goldenReportJson.evidence[4].effectiveDate,
        sourceRole: 'regulatory_filing',
      };

      const doc2: SourceDocument = {
        documentId: 'doc_b_lead_02',
        runId: 'run_mode_b_01',
        url: goldenReportJson.evidence[5].url,
        finalUrl: goldenReportJson.evidence[5].url,
        retrievedContentHash: 'hash_doc_b_lead2',
        retrievedAt: goldenReportJson.evidence[5].retrievedAt,
        rawText: rawPassage2,
        extractionStatus: 'success',
        publicationDate: goldenReportJson.evidence[5].publicationDate,
        effectiveDate: goldenReportJson.evidence[5].effectiveDate,
        sourceRole: 'primary_authority',
      };

      const unit1: EvidenceUnit = {
        evidenceId: 'evi_leadership_01',
        documentId: 'doc_b_lead_01',
        verbatimText: rawPassage1,
        locator: { charOffsetStart: 0, charOffsetEnd: rawPassage1.length },
        surroundingHeaders: ['Executive Officers'],
        extractedProperties: ticket.verificationContext,
        extractionLimitations: [], footnotes: [],
      };

      const unit2: EvidenceUnit = {
        evidenceId: 'evi_leadership_02',
        documentId: 'doc_b_lead_02',
        verbatimText: rawPassage2,
        locator: { charOffsetStart: 0, charOffsetEnd: rawPassage2.length },
        surroundingHeaders: ['Leadership Changes'],
        extractedProperties: [
          { key: 'person', label: 'Person', propertyType: 'string', value: 'Linda Yaccarino', origin: 'user_target_context', status: 'confirmed', applicability: 'claim_level' },
          { key: 'role', label: 'Role', propertyType: 'string', value: 'CEO', origin: 'user_target_context', status: 'confirmed', applicability: 'claim_level' },
        ],
        extractionLimitations: [], footnotes: [],
      };

      const outcome = await assessEvidenceAgainstClaim({
        ticket,
        evidenceUnits: [unit1, unit2],
        sourceDocuments: new Map([
          [doc1.documentId, doc1],
          [doc2.documentId, doc2],
        ]),
      });

      console.log('Mode B Claim 3 Assessment Outcome:', JSON.stringify(outcome, null, 2));

      expect(outcome.status).toBe('success');
      if (outcome.status === 'success') {
        expect(outcome.assessments.length).toBeGreaterThanOrEqual(1);
      }
    }, 30000);

    // =========================================================================
    // Claim 4: Cloudflare Workers 50ms limit
    // =========================================================================
    it('Mode B - Claim 4 (Context): live Bifrost assessment against frozen passage', async () => {
      const rawPassage = goldenReportJson.evidence[6].passage;
      const ticket: ClaimTicket = {
        ticketId: 'tkt_b_ctx_01',
        claimId: 'clm_b_ctx_01',
        runId: 'run_mode_b_01',
        inputHash: 'hash_b_ctx_01',
        revision: 1,
        originalStatement: goldenReportJson.claims[4].rawText,
        normalizedProposition: 'Cloudflare Workers enforce a strict maximum limit of 50 milliseconds of CPU execution time.',
        domain: 'generic',
        targetTime: TARGET_TIME,
        verificationContext: [
          {
            key: 'vendor',
            label: 'Vendor',
            propertyType: 'string',
            value: 'Cloudflare',
            origin: 'explicit_claim_text',
            sourceSpan: { start: 0, end: 10 },
            status: 'confirmed',
            applicability: 'claim_level',
          },
          {
            key: 'limit_type',
            label: 'Limit type',
            propertyType: 'string',
            value: 'CPU execution time',
            origin: 'explicit_claim_text',
            sourceSpan: { start: 67, end: 85 },
            status: 'confirmed',
            applicability: 'claim_level',
          },
          {
            key: 'limit_value',
            label: 'Limit value',
            propertyType: 'number',
            value: 50,
            units: 'milliseconds',
            origin: 'explicit_claim_text',
            sourceSpan: { start: 49, end: 64 },
            status: 'confirmed',
            applicability: 'claim_level',
          },
        ],
        missingMaterialContext: ['plan_tier'],
      };

      const doc: SourceDocument = {
        documentId: 'doc_b_ctx_01',
        runId: 'run_mode_b_01',
        url: goldenReportJson.evidence[6].url,
        finalUrl: goldenReportJson.evidence[6].url,
        retrievedContentHash: 'hash_doc_b_ctx',
        retrievedAt: goldenReportJson.evidence[6].retrievedAt,
        rawText: rawPassage,
        extractionStatus: 'success',
        publicationDate: goldenReportJson.evidence[6].publicationDate,
        effectiveDate: goldenReportJson.evidence[6].effectiveDate,
        sourceRole: 'primary_authority',
      };

      const unit: EvidenceUnit = {
        evidenceId: 'evi_context_01',
        documentId: 'doc_b_ctx_01',
        verbatimText: rawPassage,
        locator: { charOffsetStart: 0, charOffsetEnd: rawPassage.length },
        surroundingHeaders: ['CPU Time Limits'],
        extractedProperties: ticket.verificationContext,
        extractionLimitations: [], footnotes: [],
      };

      const outcome = await assessEvidenceAgainstClaim({
        ticket,
        evidenceUnits: [unit],
        sourceDocuments: new Map([[doc.documentId, doc]]),
      });

      console.log('Mode B Claim 4 Assessment Outcome:', JSON.stringify(outcome, null, 2));

      expect(outcome.status).toBe('success');
      if (outcome.status === 'success') {
        expect(outcome.assessments.length).toBeGreaterThanOrEqual(1);
      }
    }, 30000);
  }
);
