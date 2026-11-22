import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { ScheduledChangeBadge } from '@/components/report/ScheduledChangeBadge';
import { ChangeTimeline } from '@/components/report/ChangeTimeline';
import { ClaimDetail } from '@/components/report/ClaimDetail';
import type { TimelineEntry } from '@/lib/contracts/report';
import type { EvidenceItem } from '@/lib/contracts/evidence';
import { getGoldenReport } from '@/lib/fixtures/golden-report';

// Mock EvidenceCard to isolate ClaimDetail timeline tests from EvidenceCard's client hook
vi.mock('@/components/report/EvidenceCard', () => ({
  EvidenceCard: ({ evidence }: { evidence: EvidenceItem }) =>
    React.createElement('div', { id: `evidence-${evidence.id}` }, evidence.passage),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

// Mock ContextComparison to isolate ClaimDetail from interactive hook-based diff component
vi.mock('@/components/ContextComparison', () => ({
  ContextComparison: ({ originalText, discoveredText }: { originalText?: string; discoveredText?: string }) =>
    React.createElement('div', { 'data-testid': 'context-comparison' },
      originalText ? React.createElement('span', null, originalText) : null,
      discoveredText ? React.createElement('span', null, discoveredText) : null,
    ),
}));

describe('Task C05: Then vs. Now Timeline & Scheduled Changes', () => {
  describe('ScheduledChangeBadge', () => {
    it('renders scheduled change badge with explicit effective date', () => {
      const html = renderToString(
        React.createElement(ScheduledChangeBadge, {
          effectiveDate: '2025-08-02',
          announcementDate: '2024-07-12',
          label: 'Scheduled change',
        })
      );

      expect(html).toContain('Scheduled change');
      expect(html).toContain('(2025-08-02)');
      expect(html).toContain('role="status"');
      expect(html).toContain('Scheduled change effective on 2025-08-02');
    });

    it('hides date when showDate is false', () => {
      const html = renderToString(
        React.createElement(ScheduledChangeBadge, {
          effectiveDate: '2025-08-02',
          showDate: false,
        })
      );

      expect(html).toContain('Scheduled change');
      expect(html).not.toContain('(2025-08-02)');
    });

    it('renders with announcement date tooltip when effective date is missing', () => {
      const html = renderToString(
        React.createElement(ScheduledChangeBadge, {
          announcementDate: '2024-07-12',
          label: 'Scheduled change',
        })
      );

      expect(html).toContain('Scheduled change announced on 2024-07-12');
    });
  });

  describe('ChangeTimeline', () => {
    const mockEvidenceMap = new Map<string, EvidenceItem>([
      [
        'evi_lead_01',
        {
          id: 'evi_lead_01',
          url: 'https://investor.twitterinc.com/press-releases/2021/ceo',
          title: 'Twitter Investor Relations',
          publisher: 'Twitter, Inc.',
          sourceType: 'press_release',
          passage: 'Twitter announces Parag Agrawal as Chief Executive Officer.',
          retrievedAt: '2024-09-01T00:00:00Z',
          publicationDate: '2021-11-29',
          announcementDate: '2021-11-29',
          effectiveDate: '2021-11-29',
        },
      ],
      [
        'evi_lead_02',
        {
          id: 'evi_lead_02',
          url: 'https://www.sec.gov/edgar/data/twitter-8k',
          title: 'SEC Form 8-K',
          publisher: 'U.S. SEC',
          sourceType: 'sec_filing',
          passage: 'Linda Yaccarino appointed as Chief Executive Officer of X Corp.',
          retrievedAt: '2024-09-01T00:00:00Z',
          publicationDate: '2023-05-15',
          announcementDate: '2023-05-12',
          effectiveDate: '2023-06-05',
        },
      ],
    ]);

    const mockTimeline: TimelineEntry[] = [
      {
        state: 'historical',
        effectiveDate: '2021-11-29',
        announcementDate: '2021-11-29',
        summary: 'Twitter announces Parag Agrawal as Chief Executive Officer.',
        evidenceId: 'evi_lead_01',
      },
      {
        state: 'transition',
        effectiveDate: '2022-10-27',
        announcementDate: '2022-10-27',
        summary: 'Elon Musk completes acquisition of Twitter, Inc.',
        evidenceId: null,
      },
      {
        state: 'current',
        effectiveDate: '2023-06-05',
        announcementDate: '2023-05-12',
        summary: 'Linda Yaccarino begins role as CEO of X / Twitter.',
        evidenceId: 'evi_lead_02',
      },
    ];

    it('renders chronological Then vs. Now progression cards', () => {
      const html = renderToString(
        React.createElement(ChangeTimeline, {
          timeline: mockTimeline,
          evidenceMap: mockEvidenceMap,
        })
      );

      // Asserts presence of phase labels
      expect(html).toContain('Then (Prior State)');
      expect(html).toContain('Transition Event');
      expect(html).toContain('Now (Active Truth)');

      // Asserts summary texts
      expect(html).toContain('Twitter announces Parag Agrawal as Chief Executive Officer');
      expect(html).toContain('Elon Musk completes acquisition of Twitter, Inc.');
      expect(html).toContain('Linda Yaccarino begins role as CEO of X / Twitter.');
    });

    it('enforces strict Three-Date Separation on timeline entries', () => {
      const html = renderToString(
        React.createElement(ChangeTimeline, {
          timeline: mockTimeline,
          evidenceMap: mockEvidenceMap,
        })
      );

      // Effective dates explicitly labeled
      expect(html).toContain('Effective:');
      expect(html).toContain('2021-11-29');
      expect(html).toContain('2022-10-27');
      expect(html).toContain('2023-06-05');

      // Announcement date explicitly labeled
      expect(html).toContain('Announced:');
      expect(html).toContain('2023-05-12');

      // Publication date explicitly labeled from linked evidence
      expect(html).toContain('Published:');
      expect(html).toContain('2023-05-15');
    });

    it('links timeline entries directly to supporting evidence passages', () => {
      const html = renderToString(
        React.createElement(ChangeTimeline, {
          timeline: mockTimeline,
          evidenceMap: mockEvidenceMap,
        })
      );

      expect(html).toContain('href="#evidence-evi_lead_01"');
      expect(html).toContain('href="#evidence-evi_lead_02"');
      expect(html).toContain('Inspect Evidence');
    });

    it('displays honest fallback message when transitions are unverified or absent', () => {
      const html = renderToString(
        React.createElement(ChangeTimeline, { timeline: [] })
      );

      expect(html).toContain('Historical transitions unverified');
    });

    it('renders upcoming scheduled change state badge and header indicator', () => {
      const upcomingTimeline: TimelineEntry[] = [
        {
          state: 'transition',
          effectiveDate: '2024-08-01',
          announcementDate: '2024-07-12',
          summary: 'EU AI Act enters into force across member states.',
          evidenceId: null,
        },
        {
          state: 'upcoming',
          effectiveDate: '2025-08-02',
          announcementDate: '2024-07-12',
          summary: 'General-Purpose AI governance obligations take full effect.',
          evidenceId: null,
        },
      ];

      const html = renderToString(
        React.createElement(ChangeTimeline, { timeline: upcomingTimeline })
      );

      expect(html).toContain('Upcoming (Scheduled Change)');
      expect(html).toContain('Scheduled change');
      expect(html).toContain('Effective:');
      expect(html).toContain('2025-08-02');
      expect(html).toContain('Announced:');
      expect(html).toContain('2024-07-12');
    });
  });

  describe('ClaimDetail Integration', () => {
    it('integrates ChangeTimeline in ClaimDetail for outdated claims', () => {
      const reportRes = getGoldenReport();
      expect(reportRes.success).toBe(true);
      if (!reportRes.success) return;

      const outdatedClaim = reportRes.report.claims.find((c) => c.verdict === 'outdated');
      expect(outdatedClaim).toBeDefined();
      if (!outdatedClaim) return;

      const evidenceMap = new Map<string, EvidenceItem>(
        reportRes.report.evidence.map((e) => [e.id, e])
      );

      const html = renderToString(
        React.createElement(ClaimDetail, {
          claim: outdatedClaim,
          evidenceMap: evidenceMap,
        })
      );

      expect(html).toContain('Then vs. Now Chronology');
      expect(html).toContain('Then (Prior State)');
      expect(html).toContain('Now (Active Truth)');
      expect(html).toContain('Twitter announces Parag Agrawal');
      expect(html).toContain('Linda Yaccarino officially begins role as Chief Executive Officer');
    });

    it('renders ScheduledChangeBadge alongside StatusBadge for current facts with pending changes', () => {
      const reportRes = getGoldenReport();
      expect(reportRes.success).toBe(true);
      if (!reportRes.success) return;

      const regClaim = reportRes.report.claims.find((c) => c.id === 'res_reg_01');
      expect(regClaim).toBeDefined();
      if (!regClaim) return;

      // Invariant: current fact remains Supported with score 100
      expect(regClaim.verdict).toBe('supported');
      expect(regClaim.score).toBe(100);

      const evidenceMap = new Map<string, EvidenceItem>(
        reportRes.report.evidence.map((e) => [e.id, e])
      );

      const html = renderToString(
        React.createElement(ClaimDetail, {
          claim: regClaim,
          evidenceMap: evidenceMap,
        })
      );

      // Verifies Supported badge AND ScheduledChangeBadge coexist cleanly
      expect(html).toContain('Supported');
      expect(html).toContain('Scheduled change');
      expect(html).toContain('(2025-08-02)');
      expect(html).toContain('Then vs. Now Chronology');
      expect(html).toContain('Upcoming (Scheduled Change)');
    });
  });

  describe('ClaimDetail Context Form & Proposition Visibility Gate', () => {
    const baseClaim = {
      id: 'test_claim_1',
      claimId: 'test_claim_1',
      parentClaimId: null,
      ordinal: 0,
      rawText: 'Sam altman is the wife of salman khan',
      statement: 'Sam altman is the wife of salman khan',
      state: 'assessed' as const,
      evidenceIds: [],
    };

    it('does NOT show "More Context Needed" on insufficient_evidence without missing context', () => {
      const claim = {
        ...baseClaim,
        verdict: 'insufficient_evidence' as const,
        score: null,
        reasonCode: 'INSUFFICIENT_RETRIEVAL_DATA',
        scoreReason: 'No eligible assessment satisfied conditions.',
        missingMaterialContext: [],
      };

      const html = renderToString(
        React.createElement(ClaimDetail, {
          claim,
          evidenceMap: new Map(),
        })
      );

      expect(html).not.toContain('More Context Needed');
      expect(html).not.toContain('Expand Context Form');
    });

    it('does NOT show "More Context Needed" on contradicted claims', () => {
      const claim = {
        ...baseClaim,
        rawText: 'most Korean hates ramen noodles',
        verdict: 'contradicted' as const,
        score: 0 as const,
        reasonCode: 'DECISIVE_CONTRADICTION',
        scoreReason: 'Refuted by consumption statistics.',
        missingMaterialContext: [],
      };

      const html = renderToString(
        React.createElement(ClaimDetail, {
          claim,
          evidenceMap: new Map(),
        })
      );

      expect(html).not.toContain('More Context Needed');
      expect(html).not.toContain('Expand Context Form');
    });

    it('DOES show "More Context Needed" when verdict is depends_on_context with ESSENTIAL_CONTEXT_MISSING', () => {
      const claim = {
        ...baseClaim,
        rawText: 'Cloudflare Workers CPU execution time limit is 10ms',
        verdict: 'depends_on_context' as const,
        score: null,
        reasonCode: 'ESSENTIAL_CONTEXT_MISSING',
        scoreReason: 'Material context plan_tier is required.',
        missingMaterialContext: ['plan_tier'],
      };

      const html = renderToString(
        React.createElement(ClaimDetail, {
          claim,
          evidenceMap: new Map(),
        })
      );

      expect(html).toContain('More Context Needed');
      expect(html).toContain('Collapse Form');
    });

    it('displays Evaluated Proposition and Attached Verification Context chips when present', () => {
      const claim = {
        ...baseClaim,
        rawText: 'most Korean hates ramen noodles',
        normalizedProposition: 'The majority of Korean people hold negative feelings toward ramen noodles.',
        verificationContext: [
          { category: 'demographic', value: 'Korean', origin: 'explicit_claim_text' },
          { category: 'geographicRegion', value: 'standard', origin: 'user_target_context' },
        ],
        verdict: 'contradicted' as const,
        score: 0 as const,
        reasonCode: 'DECISIVE_CONTRADICTION',
        scoreReason: 'Refuted by authoritative consumption statistics.',
      };

      const html = renderToString(
        React.createElement(ClaimDetail, {
          claim,
          evidenceMap: new Map(),
        })
      );

      expect(html).toContain('Evaluated Proposition (Normalized)');
      expect(html).toContain('The majority of Korean people hold negative feelings toward ramen noodles.');
      expect(html).toContain('Attached Verification Context');
      expect(html).toContain('demographic');
      expect(html).toContain('Korean');
      expect(html).toContain('(User Context)');
    });

    it('lists both supporting and contradicting evidence for insufficient_evidence claims', () => {
      const claim = {
        ...baseClaim,
        rawText: 'Sam altman is gay and married to salman khan',
        verdict: 'insufficient_evidence' as const,
        score: null,
        reasonCode: 'INSUFFICIENT_RETRIEVAL_DATA',
        scoreReason: 'No decisive evidence.',
        evidenceIds: ['evi_sup_1', 'evi_con_1'],
        missingMaterialContext: [],
      };

      const evidenceMap = new Map<string, EvidenceItem>([
        [
          'evi_sup_1',
          {
            id: 'evi_sup_1',
            url: 'https://example.com/source1',
            title: 'Marriage Rumors Article',
            publisher: 'Tech Daily',
            sourceType: 'news_report',
            passage: 'Some blog claimed they were married.',
            retrievedAt: '2026-11-19T00:00:00Z',
            relationship: 'supports',
          },
        ],
        [
          'evi_con_1',
          {
            id: 'evi_con_1',
            url: 'https://example.com/source2',
            title: 'Biographical Register',
            publisher: 'Official Bio',
            sourceType: 'official_documentation',
            passage: 'Sam Altman is married to Oliver Mulherin.',
            retrievedAt: '2026-11-19T00:00:00Z',
            relationship: 'contradicts',
          },
        ],
      ]);

      const html = renderToString(
        React.createElement(ClaimDetail, {
          claim,
          evidenceMap,
        })
      );

      expect(html).toContain('Supporting Passages');
      expect(html).toContain('Some blog claimed they were married.');
      expect(html).toContain('Contradicting / Counter Passages');
      expect(html).toContain('Sam Altman is married to Oliver Mulherin.');
      expect(html).toContain('Mixed / Inconclusive Authority');
    });
  });

  describe('ClaimDetail Side-by-Side Diff Loading & Decision Reason Decoupling', () => {
    const baseClaim = {
      id: 'test_diff_1',
      claimId: 'test_diff_1',
      parentClaimId: null,
      ordinal: 0,
      rawText: 'MegaPay charges 1.5% plus 10 cents per transaction on its standard tier.',
      statement: 'MegaPay charges 1.5% plus 10 cents per transaction on its standard tier.',
      state: 'assessed' as const,
      verdict: 'contradicted' as const,
      score: 0 as const,
      reasonCode: 'DECISIVE_CONTRADICTION',
      scoreReason: 'A grounded claim-applicable primary assessment directly contradicts the proposition under matching scope and applicable time; no equal-authority support remained unresolved.',
      evidenceIds: [],
    };

    it('renders the "Synthesizing verified diff..." loading skeleton during active runs and NEVER leaks scoreReason into the diff viewer', () => {
      const html = renderToString(
        React.createElement(ClaimDetail, {
          claim: baseClaim,
          evidenceMap: new Map(),
          runState: 'running',
        })
      );

      // Decision reason box must still display the scoreReason
      expect(html).toContain('Decision Reason');
      expect(html).toContain('A grounded claim-applicable primary assessment directly contradicts');

      // The diff loading skeleton must be displayed
      expect(html).toContain('Synthesizing verified diff...');
      expect(html).toContain('Evaluating verified replacement proposition and computing surgical token diff...');

      // Invariant: ContextComparison mock MUST NOT render with scoreReason as discoveredText
      expect(html).not.toContain('data-testid="context-comparison"');
    });

    it('renders ContextComparison with verified replacementText once correction is populated', () => {
      const claimWithCorrection = {
        ...baseClaim,
        correction: {
          originalText: 'MegaPay charges 1.5% plus 10 cents per transaction on its standard tier.',
          replacementText: 'MegaPay charges 2.9% plus 30 cents per transaction on its standard tier.',
          diff: '- 1.5% plus 10 cents\n+ 2.9% plus 30 cents',
          explanation: 'Official pricing schedule confirms 2.9% + 30c.',
          verified: true,
          evidenceIds: [],
        },
      };

      const html = renderToString(
        React.createElement(ClaimDetail, {
          claim: claimWithCorrection,
          evidenceMap: new Map(),
          runState: 'running',
        })
      );

      // Loading skeleton must be gone
      expect(html).not.toContain('Synthesizing verified diff...');

      // ContextComparison must render with genuine replacementText
      expect(html).toContain('data-testid="context-comparison"');
      expect(html).toContain('MegaPay charges 2.9% plus 30 cents');
    });

    it('suppresses diff on completed runs when no replacement proposition could be verified', () => {
      const html = renderToString(
        React.createElement(ClaimDetail, {
          claim: baseClaim,
          evidenceMap: new Map(),
          runState: 'completed',
        })
      );

      // Invariant: No loading skeleton and no ContextComparison diff with scoreReason
      expect(html).not.toContain('Synthesizing verified diff...');
      expect(html).not.toContain('data-testid="context-comparison"');
      // Decision reason is still present in its own card
      expect(html).toContain('Decision Reason');
    });
  });
});
