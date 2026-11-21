import { describe, it, expect } from 'vitest';
import { resolveDomainPolicy } from '@/server/policies';
import type { ClaimTicket } from '@/lib/contracts/claim-ticket';

function makeTicket(params: { originalStatement: string; domain?: string }): ClaimTicket {
  return {
    ticketId: 'tkt_routing_test',
    claimId: 'claim_1',
    runId: 'run_test_1',
    inputHash: 'hash_test_1',
    revision: 1,
    originalStatement: params.originalStatement,
    normalizedProposition: params.originalStatement,
    domain: params.domain ?? '',
    targetTime: '2026-11-20T12:00:00Z',
    verificationContext: [],
    missingMaterialContext: [],
  };
}

describe('Domain Policy Routing: Sovereign Statutory Levies vs Commercial Pricing', () => {
  it('routes sovereign taxes and statutory levies to RegulationPolicy across jurisdictions', () => {
    const claims = [
      'Delaware corporations must pay an annual franchise tax fee regardless of revenue',
      'The SEC filing fee for registration statements is calculated based on aggregate offering amount',
      'Under the new EU customs tariff, electronics import duties are set at 4.5%',
      'Municipal building permits require paying a standard statutory licensing fee before construction',
      'Non-compliance with GDPR data breach disclosure incurs a maximum fine of €20 million or 4% of annual turnover',
    ];

    for (const stmt of claims) {
      const ticket = makeTicket({ originalStatement: stmt });
      const policy = resolveDomainPolicy(ticket);
      expect(policy.domainId, `Statement failed to route to regulation: ${stmt}`).toBe('regulation');
    }
  });

  it('routes commercial payments, SaaS subscriptions, and cloud usage fees to PricingPolicy', () => {
    const commercialClaims = [
      'Stripe charges a 2.9% + 30¢ processing fee per successful card transaction',
      'Cloudflare Workers Paid plan costs $5 per month for 10 million requests',
      'Twilio SMS API incurs an overage fee of $0.0079 per domestic message',
      'GitHub Copilot Business seat subscription is priced at $19 per user per month',
      'Datadog infrastructure monitoring charges a flat host fee of $15 per host per month',
    ];

    for (const stmt of commercialClaims) {
      const ticket = makeTicket({ originalStatement: stmt });
      const policy = resolveDomainPolicy(ticket);
      expect(policy.domainId, `Statement failed to route to pricing: ${stmt}`).toBe('pricing');
    }
  });
});
