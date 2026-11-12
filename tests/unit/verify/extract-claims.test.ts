import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractClaimsFromText, computeInputHash } from '@/server/verify/extract-claims';
import {
  ExtractClaimsOutcomeSchema,
  ExtractClaimsOutcome,
} from '@/lib/contracts/extraction';
import { ClaimTicketSchema } from '@/lib/contracts/claim-ticket';
import { MAX_PASTE_LENGTH } from '@/lib/contracts/request';
import { bifrostChat, BifrostError } from '@/server/bifrost/client';

// Mock Bifrost client dependency
vi.mock('@/server/bifrost/client', () => {
  return {
    bifrostChat: vi.fn(),
    BifrostError: class BifrostError extends Error {
      constructor(
        public readonly statusCode: number,
        public readonly responseBody: string,
        message: string
      ) {
        super(message);
        this.name = 'BifrostError';
      }
    },
  };
});

const mockedBifrostChat = vi.mocked(bifrostChat);

describe('Ticket A03 — Claim Extraction Service & Acceptance Matrix', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // A03-01: Input boundary validation
  describe('A03-01 — Input Boundary Validation', () => {
    it('rejects empty string input before calling Bifrost', async () => {
      const outcome = await extractClaimsFromText({
        text: '',
        runId: 'prep_test_01',
      });

      expect(outcome.status).toBe('failed');
      if (outcome.status === 'failed') {
        expect(outcome.error.code).toBe('INVALID_INPUT');
      }
      expect(mockedBifrostChat).not.toHaveBeenCalled();
    });

    it('rejects whitespace-only input before calling Bifrost', async () => {
      const outcome = await extractClaimsFromText({
        text: '   \n\t   ',
        runId: 'prep_test_01',
      });

      expect(outcome.status).toBe('failed');
      if (outcome.status === 'failed') {
        expect(outcome.error.code).toBe('INVALID_INPUT');
      }
      expect(mockedBifrostChat).not.toHaveBeenCalled();
    });

    it('rejects text exceeding MAX_PASTE_LENGTH (8000 UTF-16 code units)', async () => {
      const outcome = await extractClaimsFromText({
        text: 'x'.repeat(MAX_PASTE_LENGTH + 1),
        runId: 'prep_test_01',
      });

      expect(outcome.status).toBe('failed');
      if (outcome.status === 'failed') {
        expect(outcome.error.code).toBe('INVALID_INPUT');
        expect(outcome.error.message).toContain('exceeds maximum limit');
      }
      expect(mockedBifrostChat).not.toHaveBeenCalled();
    });

    it('rejects invalid revision (< 1)', async () => {
      const outcome = await extractClaimsFromText({
        text: 'Valid answer text',
        runId: 'prep_test_01',
        revision: 0,
      });

      expect(outcome.status).toBe('failed');
      if (outcome.status === 'failed') {
        expect(outcome.error.code).toBe('INVALID_INPUT');
      }
      expect(mockedBifrostChat).not.toHaveBeenCalled();
    });

    it('rejects caller-supplied inputHash that does not match computed SHA-256 hash', async () => {
      const text = 'SolisDB v2 is fast.';
      const outcome = await extractClaimsFromText({
        text,
        runId: 'prep_test_01',
        inputHash: 'incorrect_bogus_sha256_hash',
      });

      expect(outcome.status).toBe('failed');
      if (outcome.status === 'failed') {
        expect(outcome.error.code).toBe('INVALID_INPUT');
        expect(outcome.error.message).toContain('does not match computed SHA-256 hash');
        expect(outcome.inputHash).toBe(computeInputHash(text));
      }
      expect(mockedBifrostChat).not.toHaveBeenCalled();
    });
  });

  // A03-02: Real client boundary
  describe('A03-02 — Bifrost Client Boundary & Invocation Configuration', () => {
    it('invokes bifrostChat with extraction role and json_object response format', async () => {
      const text = 'Nimbus Pro costs £12 per month.';
      mockedBifrostChat.mockResolvedValueOnce(
        JSON.stringify({
          claims: [
            {
              statement: 'Nimbus Pro costs £12 per month',
              normalizedProposition: 'Nimbus Pro costs £12 per month.',
              domain: 'pricing',
            },
          ],
        })
      );

      const outcome = await extractClaimsFromText({
        text,
        runId: 'prep_client_check_01',
      });

      expect(outcome.status).toBe('success');
      expect(mockedBifrostChat).toHaveBeenCalledTimes(1);
      const callArgs = mockedBifrostChat.mock.calls[0][0];
      expect(callArgs.role).toBe('extract');
      expect(callArgs.response_format).toEqual({ type: 'json_object' });
      expect(callArgs.messages.length).toBe(2);
      expect(callArgs.messages[0].role).toBe('system');
      expect(callArgs.messages[1].role).toBe('user');
    });
  });

  // A03-03: Compound extraction handling
  describe('A03-03 — Compound Sentence Decomposition', () => {
    it('splits a compound sentence into distinct atomic ClaimTickets', async () => {
      const text = 'In the UK, Nimbus Pro costs £12 per month and includes unlimited exports.';
      mockedBifrostChat.mockResolvedValueOnce(
        JSON.stringify({
          claims: [
            {
              statement: 'Nimbus Pro costs £12 per month',
              normalizedProposition: 'Nimbus Pro subscription costs £12 per month in the UK.',
              domain: 'pricing',
              timeSensitivity: 'high',
              explicitQualifiers: [
                {
                  key: 'currency',
                  label: 'Currency',
                  value: 'GBP',
                  propertyType: 'string',
                  exactExcerpt: '£',
                },
              ],
            },
            {
              statement: 'includes unlimited exports',
              normalizedProposition: 'Nimbus Pro includes unlimited exports in the UK.',
              domain: 'software_feature',
              timeSensitivity: 'medium',
            },
          ],
        })
      );

      const outcome = await extractClaimsFromText({
        text,
        runId: 'run_compound_01',
      });

      expect(outcome.status).toBe('success');
      if (outcome.status === 'success') {
        expect(outcome.tickets.length).toBe(2);
        expect(outcome.tickets[0].originalStatement).toBe('Nimbus Pro costs £12 per month');
        expect(outcome.tickets[1].originalStatement).toBe('includes unlimited exports');
        expect(outcome.tickets[0].claimId).not.toBe(outcome.tickets[1].claimId);
        expect(outcome.tickets[0].sourceSpan).toEqual({ start: 11, end: 41 });
        expect(outcome.tickets[1].sourceSpan).toEqual({ start: 46, end: 72 });
      }
    });
  });

  // A03-04: Shared context
  describe('A03-04 — Shared Sentence Context Retention', () => {
    it('grounds shared qualifiers from outside the atomic statement clause', async () => {
      const text = 'In the UK, Nimbus Pro costs £12 per month and includes unlimited exports.';
      mockedBifrostChat.mockResolvedValueOnce(
        JSON.stringify({
          claims: [
            {
              statement: 'includes unlimited exports',
              normalizedProposition: 'Nimbus Pro includes unlimited exports in the United Kingdom.',
              domain: 'software_feature',
              explicitQualifiers: [
                {
                  key: 'jurisdiction',
                  label: 'Geographic Jurisdiction',
                  value: 'UK',
                  propertyType: 'string',
                  exactExcerpt: 'UK',
                },
              ],
            },
          ],
        })
      );

      const outcome = await extractClaimsFromText({
        text,
        runId: 'run_shared_ctx_01',
      });

      expect(outcome.status).toBe('success');
      if (outcome.status === 'success') {
        const ticket = outcome.tickets[0];
        const ukProp = ticket.verificationContext.find((p) => p.key === 'jurisdiction');
        expect(ukProp).toBeDefined();
        expect(ukProp?.origin).toBe('explicit_claim_text');
        expect(ukProp?.value).toBe('UK');
        expect(ukProp?.sourceSpan).toEqual({ start: 7, end: 9 });
        expect(text.slice(ukProp!.sourceSpan!.start, ukProp!.sourceSpan!.end)).toBe('UK');
      }
    });
  });

  // A03-05: Context precedence
  describe('A03-05 — Context Precedence Invariant (ADR-018)', () => {
    it('prevents user target context from overwriting explicit text qualifiers while populating open qualifiers', async () => {
      const text = 'In the UK, Nimbus Pro costs £12 per month.';
      mockedBifrostChat.mockResolvedValueOnce(
        JSON.stringify({
          claims: [
            {
              statement: 'Nimbus Pro costs £12 per month',
              normalizedProposition: 'Nimbus Pro costs £12 per month in the UK.',
              domain: 'pricing',
              explicitQualifiers: [
                {
                  key: 'jurisdiction',
                  label: 'Geographic Jurisdiction',
                  value: 'UK',
                  propertyType: 'string',
                  exactExcerpt: 'UK',
                },
              ],
              inferredQualifiers: [
                {
                  key: 'billingTerm',
                  label: 'Billing Commitment',
                  value: 'monthly',
                  propertyType: 'selection',
                  rationale: 'Inferred from "per month"',
                },
              ],
            },
          ],
        })
      );

      // User provides conflicting jurisdiction (US) and additional unstated qualifier (currency: USD)
      const outcome = await extractClaimsFromText({
        text,
        runId: 'run_precedence_01',
        contextOverrides: {
          jurisdiction: 'US', // Conflicting: must NOT override explicit UK
          currency: 'USD',    // Open qualifier: should populate
        },
      });

      expect(outcome.status).toBe('success');
      if (outcome.status === 'success') {
        const ticket = outcome.tickets[0];
        const jurisdictionProp = ticket.verificationContext.find((p) => p.key === 'jurisdiction');
        expect(jurisdictionProp?.value).toBe('UK');
        expect(jurisdictionProp?.origin).toBe('explicit_claim_text');

        const currencyProp = ticket.verificationContext.find((p) => p.key === 'currency');
        expect(currencyProp?.value).toBe('USD');
        expect(currencyProp?.origin).toBe('user_target_context');

        const billingProp = ticket.verificationContext.find((p) => p.key === 'billingTerm');
        expect(billingProp?.origin).toBe('model_inferred');
        expect(billingProp?.status).toBe('pending_review');
      }
    });
  });

  // A03-06: Missing context
  describe('A03-06 — Missing Material Context & Reconciliation', () => {
    it('reconciles missingMaterialContext when user supplies the missing property, while retaining genuinely missing keys', async () => {
      const text = 'The standard plan costs 15 credits.';
      mockedBifrostChat.mockResolvedValueOnce(
        JSON.stringify({
          claims: [
            {
              statement: 'The standard plan costs 15 credits',
              normalizedProposition: 'The standard plan costs 15 credits.',
              domain: 'pricing',
              missingMaterialQualifiers: ['jurisdiction', 'billingTerm'],
            },
          ],
        })
      );

      // User supplies jurisdiction only
      const outcome = await extractClaimsFromText({
        text,
        runId: 'run_missing_ctx_01',
        contextOverrides: {
          jurisdiction: 'US',
        },
      });

      expect(outcome.status).toBe('success');
      if (outcome.status === 'success') {
        const ticket = outcome.tickets[0];
        // jurisdiction was satisfied by user target context, so it should be removed from missing
        expect(ticket.missingMaterialContext).not.toContain('jurisdiction');
        // billingTerm is still missing
        expect(ticket.missingMaterialContext).toContain('billingTerm');
      }
    });
  });

  // A03-07: Span integrity
  describe('A03-07 — Exact UTF-16 Character Offsets & Edge Cases', () => {
    it('correctly calculates UTF-16 code unit offset when preceded by a 2-unit surrogate pair emoji', async () => {
      const text = '🚀 Parag Agrawal is the current CEO of Twitter.';
      const statement = 'Parag Agrawal is the current CEO of Twitter';
      mockedBifrostChat.mockResolvedValueOnce(
        JSON.stringify({
          claims: [
            {
              statement,
              normalizedProposition: 'Parag Agrawal is the Chief Executive Officer of Twitter.',
              domain: 'leadership',
            },
          ],
        })
      );

      const outcome = await extractClaimsFromText({
        text,
        runId: 'run_emoji_01',
      });

      expect(outcome.status).toBe('success');
      if (outcome.status === 'success') {
        const ticket = outcome.tickets[0];
        expect(ticket.sourceSpan).toEqual({ start: 3, end: 46 });
        expect(text.slice(ticket.sourceSpan!.start, ticket.sourceSpan!.end)).toBe(statement);
      }
    });

    it('disambiguates repeated occurrences using location hints', async () => {
      const text = 'Apple costs $2. Orange costs $3. Apple costs $2.';
      const statement = 'Apple costs $2';
      mockedBifrostChat.mockResolvedValueOnce(
        JSON.stringify({
          claims: [
            {
              statement,
              normalizedProposition: 'First apple costs $2.',
              locationHint: { occurrence: 0 },
            },
            {
              statement,
              normalizedProposition: 'Second apple costs $2.',
              locationHint: { occurrence: 1 },
            },
          ],
        })
      );

      const outcome = await extractClaimsFromText({
        text,
        runId: 'run_repeat_01',
      });

      expect(outcome.status).toBe('success');
      if (outcome.status === 'success') {
        expect(outcome.tickets.length).toBe(2);
        expect(outcome.tickets[0].sourceSpan).toEqual({ start: 0, end: 14 });
        expect(outcome.tickets[1].sourceSpan).toEqual({ start: 33, end: 47 });
        expect(outcome.tickets[0].claimId).not.toBe(outcome.tickets[1].claimId);
      }
    });

    it('emits sourceSpan: null when repeated excerpt has no conclusive location hint', async () => {
      const text = 'Alpha beta. Gamma delta. Alpha beta.';
      mockedBifrostChat.mockResolvedValueOnce(
        JSON.stringify({
          claims: [
            {
              statement: 'Alpha beta',
              normalizedProposition: 'Alpha beta is asserted.',
              // No locationHint provided
            },
          ],
        })
      );

      const outcome = await extractClaimsFromText({
        text,
        runId: 'run_ambig_01',
      });

      expect(outcome.status).toBe('success');
      if (outcome.status === 'success') {
        expect(outcome.tickets[0].sourceSpan).toBeNull();
      }
    });

    it('fails closed with GROUNDING_FAILURE when statement is completely absent from source text', async () => {
      const text = 'Stripe charges 2.9% + 30c.';
      mockedBifrostChat.mockResolvedValueOnce(
        JSON.stringify({
          claims: [
            {
              statement: 'PayPal charges 3.49% + 49c', // Completely fabricated/hallucinated
              normalizedProposition: 'PayPal processing fee is 3.49% plus 49 cents.',
            },
          ],
        })
      );

      const outcome = await extractClaimsFromText({
        text,
        runId: 'run_ungrounded_01',
      });

      expect(outcome.status).toBe('failed');
      if (outcome.status === 'failed') {
        expect(outcome.error.code).toBe('GROUNDING_FAILURE');
        expect(outcome.error.message).toContain('Claim statement could not be grounded');
      }
    });
  });

  // A03-08: Qualifier provenance
  describe('A03-08 — Qualifier Provenance & Excerpt Grounding', () => {
    it('fails closed when explicit qualifier excerpt is absent from source text', async () => {
      const text = 'Cloudflare Workers limit CPU time to 50 milliseconds.';
      mockedBifrostChat.mockResolvedValueOnce(
        JSON.stringify({
          claims: [
            {
              statement: 'Cloudflare Workers limit CPU time to 50 milliseconds',
              normalizedProposition: 'Cloudflare Workers enforce a 50ms CPU limit.',
              explicitQualifiers: [
                {
                  key: 'subscriptionTier',
                  label: 'Subscription Tier',
                  value: 'Enterprise',
                  propertyType: 'string',
                  exactExcerpt: 'Enterprise Tier', // Not in source text!
                },
              ],
            },
          ],
        })
      );

      const outcome = await extractClaimsFromText({
        text,
        runId: 'run_bad_qual_01',
      });

      expect(outcome.status).toBe('failed');
      if (outcome.status === 'failed') {
        expect(outcome.error.code).toBe('GROUNDING_FAILURE');
        expect(outcome.error.message).toContain('Explicit qualifier excerpt not found in source text');
      }
    });
  });

  // A03-09: Identity
  describe('A03-09 — Claim and Ticket Identity Uniqueness', () => {
    it('ensures repeated identical statements in the same text produce distinct collision-free IDs', async () => {
      const text = 'API rate limit is 100 req/min. Later: API rate limit is 100 req/min.';
      const statement = 'API rate limit is 100 req/min';
      mockedBifrostChat.mockResolvedValueOnce(
        JSON.stringify({
          claims: [
            {
              statement,
              normalizedProposition: 'API limit is 100.',
              locationHint: { occurrence: 0 },
            },
            {
              statement,
              normalizedProposition: 'API limit is 100.',
              locationHint: { occurrence: 1 },
            },
          ],
        })
      );

      const outcome = await extractClaimsFromText({
        text,
        runId: 'run_ident_01',
        revision: 2,
      });

      expect(outcome.status).toBe('success');
      if (outcome.status === 'success') {
        const [ticketA, ticketB] = outcome.tickets;
        expect(ticketA.ticketId).not.toBe(ticketB.ticketId);
        expect(ticketA.claimId).not.toBe(ticketB.claimId);
        expect(ticketA.revision).toBe(2);
        expect(ticketA.ticketId).toContain('_r2');
      }
    });
  });

  // A03-10: Domain generality
  describe('A03-10 — Extensibility for Unfamiliar Domains', () => {
    it('accepts novel domains and properties without requiring DDL or pre-known catalogs', async () => {
      const text = 'The JWST spectrometer observes at 28.5 microns with NIRSpec in high-resolution mode.';
      mockedBifrostChat.mockResolvedValueOnce(
        JSON.stringify({
          claims: [
            {
              statement: 'The JWST spectrometer observes at 28.5 microns with NIRSpec in high-resolution mode',
              normalizedProposition: 'James Webb Space Telescope NIRSpec observes wavelengths up to 28.5 microns in high-resolution mode.',
              domain: 'astrophysics_instrumentation',
              explicitQualifiers: [
                {
                  key: 'instrumentName',
                  label: 'Science Instrument',
                  value: 'NIRSpec',
                  propertyType: 'string',
                  exactExcerpt: 'NIRSpec',
                },
                {
                  key: 'wavelength',
                  label: 'Observation Wavelength',
                  value: 28.5,
                  propertyType: 'number',
                  exactExcerpt: '28.5 microns',
                  units: 'microns',
                },
              ],
            },
          ],
        })
      );

      const outcome = await extractClaimsFromText({
        text,
        runId: 'run_novel_01',
      });

      expect(outcome.status).toBe('success');
      if (outcome.status === 'success') {
        const ticket = outcome.tickets[0];
        expect(ticket.domain).toBe('astrophysics_instrumentation');
        expect(ticket.verificationContext.length).toBe(2);
        expect(ticket.verificationContext[1].value).toBe(28.5);
        expect(ticket.verificationContext[1].units).toBe('microns');
      }
    });
  });

  // A03-11: Outcome union
  describe('A03-11 — Discriminated Outcome Union Semantics', () => {
    it('returns status: no_claims when source text contains zero factual assertions', async () => {
      const text = 'Hello world! I simply love programming and beautiful sunny days.';
      mockedBifrostChat.mockResolvedValueOnce(
        JSON.stringify({
          claims: [],
        })
      );

      const outcome = await extractClaimsFromText({
        text,
        runId: 'run_zero_01',
      });

      expect(outcome.status).toBe('no_claims');
      if (outcome.status === 'no_claims') {
        expect(outcome.tickets).toEqual([]);
        expect(outcome.reason).toContain('no verifiable factual propositions');
        expect(outcome.inputHash).toBe(computeInputHash(text));
      }
    });

    it('runtime outcome schema rejects success status containing empty tickets', () => {
      const invalidSuccess = {
        status: 'success',
        tickets: [],
        inputHash: 'hash123',
        rawCount: 0,
      };

      const result = ExtractClaimsOutcomeSchema.safeParse(invalidSuccess);
      expect(result.success).toBe(false);
    });
  });

  // A03-12: Invalid model response
  describe('A03-12 — Handling Invalid Model Outputs', () => {
    it('returns status: failed with MALFORMED_OUTPUT on invalid JSON', async () => {
      mockedBifrostChat.mockResolvedValueOnce('This is not valid JSON string at all { unclosed');

      const outcome = await extractClaimsFromText({
        text: 'Some input text',
        runId: 'run_malformed_01',
      });

      expect(outcome.status).toBe('failed');
      if (outcome.status === 'failed') {
        expect(outcome.error.code).toBe('MALFORMED_OUTPUT');
        expect(outcome.error.retryable).toBe(false);
      }
    });

    it('returns status: failed with SCHEMA_VIOLATION when model output misses required fields', async () => {
      mockedBifrostChat.mockResolvedValueOnce(
        JSON.stringify({
          notClaimsKey: [{ foo: 'bar' }],
        })
      );

      const outcome = await extractClaimsFromText({
        text: 'Some input text',
        runId: 'run_schema_viol_01',
      });

      expect(outcome.status).toBe('failed');
      if (outcome.status === 'failed') {
        expect(outcome.error.code).toBe('SCHEMA_VIOLATION');
      }
    });

    it('fails the entire batch explicitly when one candidate is ungrounded (no silent partials)', async () => {
      const text = 'Stripe charges 2.9% in the US.';
      mockedBifrostChat.mockResolvedValueOnce(
        JSON.stringify({
          claims: [
            {
              statement: 'Stripe charges 2.9% in the US',
              normalizedProposition: 'Stripe standard fee is 2.9% in US.',
            },
            {
              statement: 'Phantom ungrounded claim', // Ungrounded second claim
              normalizedProposition: 'Phantom proposition.',
            },
          ],
        })
      );

      const outcome = await extractClaimsFromText({
        text,
        runId: 'run_mixed_01',
      });

      expect(outcome.status).toBe('failed');
      if (outcome.status === 'failed') {
        expect(outcome.error.code).toBe('GROUNDING_FAILURE');
        expect(outcome.tickets).toEqual([]);
      }
    });
  });

  // A03-13: Provider failures
  describe('A03-13 — Model Gateway and Provider Failures', () => {
    it('maps BifrostError HTTP 500 to retryable PROVIDER_ERROR', async () => {
      mockedBifrostChat.mockRejectedValueOnce(
        new BifrostError(500, 'Internal Server Error', 'Bifrost HTTP 500')
      );

      const outcome = await extractClaimsFromText({
        text: 'Some input text',
        runId: 'run_err_500',
      });

      expect(outcome.status).toBe('failed');
      if (outcome.status === 'failed') {
        expect(outcome.error.code).toBe('PROVIDER_ERROR');
        expect(outcome.error.retryable).toBe(true);
        expect(outcome.error.message).toContain('HTTP 500');
      }
    });

    it('maps BifrostError HTTP 400 to non-retryable PROVIDER_ERROR', async () => {
      mockedBifrostChat.mockRejectedValueOnce(
        new BifrostError(400, 'Bad Request', 'Bifrost HTTP 400')
      );

      const outcome = await extractClaimsFromText({
        text: 'Some input text',
        runId: 'run_err_400',
      });

      expect(outcome.status).toBe('failed');
      if (outcome.status === 'failed') {
        expect(outcome.error.code).toBe('PROVIDER_ERROR');
        expect(outcome.error.retryable).toBe(false);
      }
    });

    it('maps gateway timeout / abort to retryable TIMEOUT', async () => {
      const abortError = new Error('The operation was aborted due to timeout');
      abortError.name = 'AbortError';
      mockedBifrostChat.mockRejectedValueOnce(abortError);

      const outcome = await extractClaimsFromText({
        text: 'Some input text',
        runId: 'run_timeout',
      });

      expect(outcome.status).toBe('failed');
      if (outcome.status === 'failed') {
        expect(outcome.error.code).toBe('TIMEOUT');
        expect(outcome.error.retryable).toBe(true);
      }
    });

    it('handles model provider refusal', async () => {
      mockedBifrostChat.mockResolvedValueOnce(
        JSON.stringify({
          claims: [],
          refusal: 'I cannot process content related to this query',
        })
      );

      const outcome = await extractClaimsFromText({
        text: 'Some input text',
        runId: 'run_refusal',
      });

      expect(outcome.status).toBe('failed');
      if (outcome.status === 'failed') {
        expect(outcome.error.code).toBe('PROVIDER_REFUSAL');
        expect(outcome.error.retryable).toBe(false);
      }
    });
  });

  // A03-14: Semantic preservation
  describe('A03-14 — Semantic Preservation of Negation and Quantifiers', () => {
    it('preserves negation and boundary quantifiers without inversion', async () => {
      const text = 'ZephyrPay does not charge refund processing fees up to $500.';
      mockedBifrostChat.mockResolvedValueOnce(
        JSON.stringify({
          claims: [
            {
              statement: 'ZephyrPay does not charge refund processing fees up to $500',
              normalizedProposition: 'ZephyrPay does not charge refund processing fees for transactions up to $500.',
              domain: 'pricing',
            },
          ],
        })
      );

      const outcome = await extractClaimsFromText({
        text,
        runId: 'run_negation_01',
      });

      expect(outcome.status).toBe('success');
      if (outcome.status === 'success') {
        const ticket = outcome.tickets[0];
        expect(ticket.normalizedProposition).toContain('does not charge');
        expect(ticket.normalizedProposition).toContain('up to $500');
      }
    });
  });

  // A03-15: Canonical output validation
  describe('A03-15 — Canonical ClaimTicket Schema Conformance', () => {
    it('guarantees all emitted tickets parse cleanly through ClaimTicketSchema', async () => {
      const text = 'PostgreSQL 17 was released in September 2024.';
      mockedBifrostChat.mockResolvedValueOnce(
        JSON.stringify({
          claims: [
            {
              statement: 'PostgreSQL 17 was released in September 2024',
              normalizedProposition: 'PostgreSQL 17 was officially released in September 2024.',
              domain: 'software_release',
              timeSensitivity: 'low',
              explicitQualifiers: [
                {
                  key: 'version',
                  label: 'Software Version',
                  value: '17',
                  propertyType: 'string',
                  exactExcerpt: '17',
                },
              ],
            },
          ],
        })
      );

      const outcome = await extractClaimsFromText({
        text,
        runId: 'run_canonical_01',
      });

      expect(outcome.status).toBe('success');
      if (outcome.status === 'success') {
        for (const ticket of outcome.tickets) {
          const validated = ClaimTicketSchema.safeParse(ticket);
          expect(validated.success).toBe(true);
        }
      }
    });
  });

  // A03-16: Secret-safe failure
  describe('A03-16 — Secret-Safe Error Sanitization', () => {
    it('ensures canary user text and provider secrets never appear in error messages', async () => {
      const canarySensitiveText = 'CANARY_USER_SECRET_PASSWORD_12345';
      const text = `User sensitive note with ${canarySensitiveText}.`;

      // Simulate a Bifrost error echoing sensitive input
      mockedBifrostChat.mockRejectedValueOnce(
        new BifrostError(
          500,
          `Error processing prompt containing ${canarySensitiveText} with bearer token sk-123456789`,
          'Internal Error'
        )
      );

      const outcome = await extractClaimsFromText({
        text,
        runId: 'run_canary_01',
      });

      expect(outcome.status).toBe('failed');
      if (outcome.status === 'failed') {
        expect(outcome.error.message).not.toContain(canarySensitiveText);
        expect(outcome.error.message).not.toContain('sk-123456789');
        expect(outcome.error.message).toBe('Model provider returned error HTTP 500');
      }
    });
  });

  // A03-17: Exhaustive consumer branching
  describe('A03-17 — Downstream Consumer Exhaustive Branching', () => {
    it('supports exhaustive type-safe pattern matching on ExtractClaimsOutcome', async () => {
      const text = 'Nimbus Pro costs £12 per month.';
      mockedBifrostChat.mockResolvedValueOnce(
        JSON.stringify({
          claims: [
            {
              statement: 'Nimbus Pro costs £12 per month',
              normalizedProposition: 'Nimbus Pro costs £12 per month.',
            },
          ],
        })
      );

      const outcome: ExtractClaimsOutcome = await extractClaimsFromText({
        text,
        runId: 'run_consumer_01',
      });

      let consumerBranch = '';
      switch (outcome.status) {
        case 'success':
          consumerBranch = `success:${outcome.tickets.length}`;
          break;
        case 'no_claims':
          consumerBranch = `no_claims:${outcome.reason}`;
          break;
        case 'failed':
          consumerBranch = `failed:${outcome.error.code}`;
          break;
        default: {
          const _exhaustive: never = outcome;
          throw new Error(`Unhandled outcome: ${_exhaustive}`);
        }
      }

      expect(consumerBranch).toBe('success:1');
    });
  });
});
