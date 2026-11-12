import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

import { describe, it, expect } from 'vitest';
import { extractClaimsFromText } from '@/server/verify/extract-claims';
import { ClaimTicketSchema } from '@/lib/contracts/claim-ticket';
import { DEMO_TEXT_INPUT, DEMO_SUBJECTIVE_INPUT } from '../fixtures/demo-text';

// The live integration test runs when a live gateway is configured.
const isLiveGatewayConfigured = Boolean(
  process.env.BIFROST_GATEWAY_TOKEN ||
  process.env.BIFROST_ADMIN_PASSWORD ||
  (process.env.BIFROST_BASE_URL && !process.env.BIFROST_BASE_URL.includes('127.0.0.1'))
);

describe.skipIf(!isLiveGatewayConfigured)(
  'Live Bifrost Model Extraction Integration Test (E4)',
  () => {
    it(
      'extracts, grounds, and normalizes atomic claims from multi-domain demo text using the live model',
      { timeout: 30000, retry: 2 },
      async () => {
        const runId = `live_demo_test_${Date.now()}`;
        const outcome = await extractClaimsFromText({
          text: DEMO_TEXT_INPUT,
          runId,
          revision: 1,
        });

        // 1. Verify outcome status
        if (outcome.status === 'failed') {
          console.error('Live extraction failure details:', outcome.error);
        }
        expect(outcome.status).toBe('success');
        if (outcome.status !== 'success') return;

        // 2. Multi-claim extraction fidelity
        expect(outcome.tickets.length).toBeGreaterThanOrEqual(3);
        expect(outcome.rawCount).toBe(outcome.tickets.length);
        expect(outcome.inputHash).toBeDefined();

        // 3. Inspect and assert on every extracted ClaimTicket
        for (const [index, ticket] of outcome.tickets.entries()) {
          // Validate against canonical Zod schema
          const validationResult = ClaimTicketSchema.safeParse(ticket);
          expect(
            validationResult.success,
            `Ticket at index ${index} failed ClaimTicketSchema validation`
          ).toBe(true);

          // Verify execution-aware identity formula
          expect(ticket.claimId).toMatch(/^clm_[a-f0-9]{8}_\d+_[a-f0-9]{8}$/);
          expect(ticket.claimId.length).toBeLessThanOrEqual(25);
          expect(ticket.ticketId).toBe(`tkt_${ticket.claimId}_r1`);
          expect(ticket.runId).toBe(runId);
          expect(ticket.revision).toBe(1);

          // Verify atomic proposition fields
          expect(ticket.originalStatement.length).toBeGreaterThan(0);
          expect(ticket.normalizedProposition.length).toBeGreaterThan(0);
          expect(typeof ticket.domain).toBe('string');

          // Verify verbatim UTF-16 character grounding
          if (ticket.sourceSpan) {
            const sliced = DEMO_TEXT_INPUT.slice(ticket.sourceSpan.start, ticket.sourceSpan.end);
            expect(sliced).toBe(ticket.originalStatement);
          }

          // Verify context property grounding and validation
          for (const prop of ticket.verificationContext) {
            expect(prop.key.length).toBeGreaterThan(0);
            expect(prop.label.length).toBeGreaterThan(0);
            expect(prop.status).toBe('confirmed');

            // If qualifier is from explicit text, ensure valid span and match
            if (prop.origin === 'explicit_claim_text' && prop.sourceSpan) {
              expect(prop.sourceSpan.start).toBeLessThan(prop.sourceSpan.end);
              const propSlice = DEMO_TEXT_INPUT.slice(
                prop.sourceSpan.start,
                prop.sourceSpan.end
              );
              expect(propSlice.length).toBeGreaterThan(0);
            }

            // If property is a date, ensure it is normalized to ISO calendar format
            if (prop.propertyType === 'date' && typeof prop.value === 'string') {
              expect(prop.value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
            }
          }
        }
      }
    );

    it(
      'returns no_claims outcome for purely subjective demo input without fabricating claims',
      { timeout: 30000, retry: 2 },
      async () => {
        const runId = `live_subjective_test_${Date.now()}`;
        const outcome = await extractClaimsFromText({
          text: DEMO_SUBJECTIVE_INPUT,
          runId,
          revision: 1,
        });

        if (outcome.status === 'failed') {
          console.error('Subjective test failure details:', outcome.error);
        }
        expect(outcome.status).toBe('no_claims');
        if (outcome.status === 'no_claims') {
          expect(outcome.tickets).toHaveLength(0);
          expect(outcome.reason).toContain('no verifiable factual propositions');
        }
      }
    );
  }
);
