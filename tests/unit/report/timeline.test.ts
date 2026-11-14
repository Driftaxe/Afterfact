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
});
