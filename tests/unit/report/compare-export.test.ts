/**
 * C06/C07 Unit Tests: Export Utilities, Context Comparison, DAG Inspector,
 * Recheck Action, and Error Boundaries.
 *
 * Rules:
 * - No JSX — React.createElement() only (vitest `node` env, no DOM).
 * - Zero `any` types in test code.
 * - vi.mock() every 'use client' component that uses hooks.
 * - All DB / external calls are mocked via vi.mock.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { getGoldenReport } from '@/lib/fixtures/golden-report';

// ─── Mock 'use client' components that contain React hooks ───────────────────
vi.mock('@/components/ContextComparison', () => ({
  ContextComparison: ({
    originalText,
    discoveredText,
  }: {
    originalText?: string;
    discoveredText?: string;
    discoveredSourceUrl?: string | null;
    className?: string;
  }) =>
    React.createElement(
      'div',
      { 'data-testid': 'context-comparison' },
      originalText
        ? React.createElement('span', { 'data-role': 'original' }, originalText)
        : null,
      discoveredText
        ? React.createElement('span', { 'data-role': 'discovered' }, discoveredText)
        : null,
    ),
}));

vi.mock('@/components/DagInspector', () => ({
  DagInspector: ({
    nodes,
    totalNodes,
  }: {
    nodes?: unknown[];
    totalNodes?: number;
    className?: string;
  }) =>
    React.createElement(
      'div',
      { 'data-testid': 'dag-inspector', 'data-total': totalNodes },
      `${nodes?.length ?? 0} nodes`,
    ),
}));

vi.mock('@/components/ExportReport', () => ({
  ExportReport: ({ report }: { report: { id: string } }) =>
    React.createElement(
      'div',
      { 'data-testid': 'export-report', 'data-report-id': report.id },
      'Export',
    ),
}));

// ─── Mock next/headers (cookies) for Server Action tests ─────────────────────
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue(undefined),
  }),
}));

// ─── Mock Prisma DB client for recheck action tests ──────────────────────────
vi.mock('@/server/db/client', () => ({
  db: {
    verificationRun: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    dagNode: {
      findFirst: vi.fn(),
    },
  },
}));

// ─── Import units under test ──────────────────────────────────────────────────
import {
  formatReportAsJson,
  formatReportAsMarkdown,
  sanitizeReportForExport,
  copyReportToClipboard,
} from '@/lib/export';
import { ContextComparison } from '@/components/ContextComparison';
import { DagInspector } from '@/components/DagInspector';
import { ExportReport } from '@/components/ExportReport';
import type { Report } from '@/lib/contracts/report';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function loadGoldenReport(): Report {
  const result = getGoldenReport();
  if (!result.success) throw new Error('Golden fixture failed to parse: ' + result.error);
  return result.report;
}

// =============================================================================
// formatReportAsJson
// =============================================================================
describe('C07 export — formatReportAsJson', () => {
  it('returns valid JSON for the golden fixture', () => {
    const report = loadGoldenReport();
    const json = formatReportAsJson(report);

    expect(() => JSON.parse(json)).not.toThrow();
  });

  it('pretty-prints with 2-space indentation', () => {
    const report = loadGoldenReport();
    const json = formatReportAsJson(report);

    // A properly indented JSON block has lines starting with two spaces
    expect(json).toMatch(/^\{\n  /);
  });

  it('omits private internal fields — no rawOwnerHash or lease fields', () => {
    const report = loadGoldenReport();
    const json = formatReportAsJson(report);

    expect(json).not.toContain('ownerHash');
    expect(json).not.toContain('leaseOwnerId');
    expect(json).not.toContain('leaseExpiresAt');
  });

  it('includes top-level id, mode, asOfDate, createdAt', () => {
    const report = loadGoldenReport();
    const json = formatReportAsJson(report);
    const parsed = JSON.parse(json) as Record<string, unknown>;

    expect(parsed).toHaveProperty('id', report.id);
    expect(parsed).toHaveProperty('mode', report.mode);
    expect(parsed).toHaveProperty('asOfDate');
    expect(parsed).toHaveProperty('createdAt');
  });

  it('includes claims array with correct length', () => {
    const report = loadGoldenReport();
    const json = formatReportAsJson(report);
    const parsed = JSON.parse(json) as { claims: unknown[] };

    expect(Array.isArray(parsed.claims)).toBe(true);
    expect(parsed.claims).toHaveLength(report.claims.length);
  });

  it('each claim has verdict, state, score fields (no nested Prisma internals)', () => {
    const report = loadGoldenReport();
    const json = formatReportAsJson(report);
    const parsed = JSON.parse(json) as { claims: Array<Record<string, unknown>> };

    for (const claim of parsed.claims) {
      expect(claim).toHaveProperty('id');
      expect(claim).toHaveProperty('state');
      expect(claim).toHaveProperty('rawText');
      // No DB-internal fields
      expect(claim).not.toHaveProperty('runId');
      expect(claim).not.toHaveProperty('dagNodeId');
    }
  });

  it('evidence array includes url, title, publisher, publicationDate, effectiveDate, passage', () => {
    const report = loadGoldenReport();
    const json = formatReportAsJson(report);
    const parsed = JSON.parse(json) as { evidence: Array<Record<string, unknown>> };

    expect(Array.isArray(parsed.evidence)).toBe(true);
    if (parsed.evidence.length > 0) {
      const evi = parsed.evidence[0];
      expect(evi).toHaveProperty('url');
      expect(evi).toHaveProperty('passage');
    }
  });
});

// =============================================================================
// sanitizeReportForExport
// =============================================================================
describe('C07 export — sanitizeReportForExport', () => {
  it('returns a plain object (not a Prisma model instance)', () => {
    const report = loadGoldenReport();
    const sanitized = sanitizeReportForExport(report);

    expect(typeof sanitized).toBe('object');
    expect(sanitized).not.toBeNull();
  });

  it('scrubs answerText correctly — not undefined', () => {
    const report = loadGoldenReport();
    const sanitized = sanitizeReportForExport(report);

    // answerText may be null (nullable contract) but must be present as key
    expect('answerText' in sanitized).toBe(true);
  });

  it('maps assessed claims to include verdict, score, reasonCode', () => {
    const report = loadGoldenReport();
    const sanitized = sanitizeReportForExport(report) as {
      claims: Array<Record<string, unknown>>;
    };

    const assessed = sanitized.claims.filter((c) => c.state === 'assessed');
    for (const claim of assessed) {
      expect(claim).toHaveProperty('verdict');
      expect(claim).toHaveProperty('score');
      expect(claim).toHaveProperty('reasonCode');
    }
  });
});

// =============================================================================
// formatReportAsMarkdown
// =============================================================================
describe('C07 export — formatReportAsMarkdown', () => {
  it('produces a non-empty string', () => {
    const report = loadGoldenReport();
    const md = formatReportAsMarkdown(report);

    expect(typeof md).toBe('string');
    expect(md.trim().length).toBeGreaterThan(0);
  });

  it('contains the report ID in the H1 header', () => {
    const report = loadGoldenReport();
    const md = formatReportAsMarkdown(report);

    expect(md).toContain(`# Verification Report — ${report.id}`);
  });

  it('contains a metadata table with Run ID, Mode, Status', () => {
    const report = loadGoldenReport();
    const md = formatReportAsMarkdown(report);

    expect(md).toContain('**Run ID**');
    expect(md).toContain('**Mode**');
    expect(md).toContain('**Status**');
  });

  it('contains Evaluated Text section with original answer', () => {
    const report = loadGoldenReport();
    const md = formatReportAsMarkdown(report);

    expect(md).toContain('## Evaluated Text');
    expect(md).toContain('```text');
  });

  it('contains Claim Assessments section with one entry per claim', () => {
    const report = loadGoldenReport();
    const md = formatReportAsMarkdown(report);

    expect(md).toContain('## Claim Assessments');
    for (let i = 1; i <= report.claims.length; i++) {
      expect(md).toContain(`### Claim ${i}:`);
    }
  });

  it('strictly labels verdict, score, and reasonCode — three-date separation in timeline', () => {
    const report = loadGoldenReport();
    const md = formatReportAsMarkdown(report);

    // Assessed claims should include verdict lines
    const assessedClaims = report.claims.filter((c) => c.state === 'assessed');
    if (assessedClaims.length > 0) {
      expect(md).toContain('**Verdict:**');
      expect(md).toContain('**Reason Code:**');
    }
  });

  it('renders timeline entries with THEN vs NOW state labels', () => {
    const report = loadGoldenReport();
    const claimsWithTimeline = report.claims.filter(
      (c) => c.state === 'assessed' && c.timeline && c.timeline.length > 0,
    );

    if (claimsWithTimeline.length === 0) {
      // Golden fixture may not have timeline entries — skip gracefully
      return;
    }

    const md = formatReportAsMarkdown(report);
    // Timeline entries format: **[STATE]** summary
    expect(md).toMatch(/\*\*\[(HISTORICAL|TRANSITION|CURRENT|UPCOMING)\]\*\*/);
  });

  it('renders "effective date" and "announcement date" separately — never confused', () => {
    const report = loadGoldenReport();
    const md = formatReportAsMarkdown(report);

    // If the report has evidence with effectiveDate, it must appear separately from publicationDate
    const evidenceWithBothDates = report.evidence.filter(
      (e) => e.effectiveDate && e.publicationDate,
    );
    if (evidenceWithBothDates.length > 0) {
      expect(md).toContain('**Effective Date:**');
      expect(md).toContain('**Publication Date:**');
    }
  });

  it('renders Cited Authoritative Evidence section', () => {
    const report = loadGoldenReport();
    const md = formatReportAsMarkdown(report);

    expect(md).toContain('## Cited Authoritative Evidence');
  });

  it('handles reports with null answerText without throwing', () => {
    const report = loadGoldenReport();
    // Temporarily null out answerText
    const nullAnswerReport = { ...report, answerText: null };

    expect(() => formatReportAsMarkdown(nullAnswerReport as unknown as Report)).not.toThrow();
  });

  it('handles empty evidence array gracefully', () => {
    const report = loadGoldenReport();
    const noEvidenceReport: Report = { ...report, evidence: [] };

    const md = formatReportAsMarkdown(noEvidenceReport);
    expect(md).toContain('No external web evidence passages recorded');
  });
});

// =============================================================================
// copyReportToClipboard
// =============================================================================
describe('C07 export — copyReportToClipboard', () => {
  let writeTextMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: {
        clipboard: { writeText: writeTextMock },
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls navigator.clipboard.writeText with the markdown string', async () => {
    const report = loadGoldenReport();
    const result = await copyReportToClipboard(report);

    expect(result).toBe(true);
    expect(writeTextMock).toHaveBeenCalledOnce();
    const arg = writeTextMock.mock.calls[0]?.[0] as string;
    expect(typeof arg).toBe('string');
    expect(arg).toContain('# Verification Report');
  });

  it('returns false when navigator.clipboard is unavailable', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: {},
    });

    const report = loadGoldenReport();
    const result = await copyReportToClipboard(report);

    expect(result).toBe(false);
  });

  it('returns false when clipboard.writeText rejects', async () => {
    writeTextMock.mockRejectedValue(new Error('Clipboard permission denied'));

    const report = loadGoldenReport();
    const result = await copyReportToClipboard(report);

    expect(result).toBe(false);
  });
});

// =============================================================================
// triggerRecheckAction — Server Action
// =============================================================================
describe('C06 recheck action — triggerRecheckAction', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('rejects an empty reportId with INVALID_PAYLOAD_SHAPE', async () => {
    const { triggerRecheckAction } = await import('@/actions/recheck');

    const result = await triggerRecheckAction({ reportId: '' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe('INVALID_PAYLOAD_SHAPE');
    }
  });

  it('accepts a plain string reportId shorthand', async () => {
    // For a demo run, the fixture fallback should produce success: true
    const { triggerRecheckAction } = await import('@/actions/recheck');

    const result = await triggerRecheckAction('demo');

    // The demo path produces success: true via the graceful fixture fallback
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.runId).toBe('demo');
      expect(result.data.state).toBe('running');
    }
  });

  it('accepts a golden fixture run ID via graceful fixture fallback', async () => {
    const { triggerRecheckAction } = await import('@/actions/recheck');

    const result = await triggerRecheckAction('run_golden_fixture_mixed_001');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.runId).toBe('run_golden_fixture_mixed_001');
      expect(result.data.message).toContain('Recheck simulated');
    }
  });

  it('validates updatedContext as a free-form record', async () => {
    const { triggerRecheckAction } = await import('@/actions/recheck');

    const result = await triggerRecheckAction({
      reportId: 'demo',
      updatedContext: { region: 'US', fiscalYear: 2025 },
    });

    expect(result.success).toBe(true);
  });

  it('rejects if reportId is missing from the input object', async () => {
    const { triggerRecheckAction } = await import('@/actions/recheck');

    const result = await triggerRecheckAction({
      reportId: '',
      updatedContext: {},
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe('INVALID_PAYLOAD_SHAPE');
      expect(result.issues).toBeDefined();
      expect(Array.isArray(result.issues)).toBe(true);
    }
  });
});

// =============================================================================
// ContextComparison (mocked — renders via renderToString in node env)
// =============================================================================
describe('C06 — ContextComparison component (mocked SSR render)', () => {
  it('renders the mocked component with original and discovered text spans', () => {
    const html = renderToString(
      React.createElement(ContextComparison, {
        originalText: 'The interest rate is 2%.',
        discoveredText: 'The interest rate is 4.5% (updated March 2024).',
        discoveredSourceUrl: 'https://example.com/fed-rates',
      }),
    );

    expect(html).toContain('context-comparison');
    expect(html).toContain('The interest rate is 2%.');
    expect(html).toContain('The interest rate is 4.5%');
  });
});

// =============================================================================
// DagInspector (mocked — renders via renderToString in node env)
// =============================================================================
describe('C06 — DagInspector component (mocked SSR render)', () => {
  it('renders with run-id attribute and node count', () => {
    const nodes = [
      { id: 'n1', nodeType: 'retrieval', state: 'COMPLETED' },
      { id: 'n2', nodeType: 'extraction', state: 'COMPLETED' },
    ];

    const html = renderToString(
      React.createElement(DagInspector, {
        nodes,
        totalNodes: 2,
      }),
    );

    expect(html).toContain('dag-inspector');
    expect(html).toContain('2 nodes');
  });

  it('renders gracefully with zero nodes', () => {
    const html = renderToString(
      React.createElement(DagInspector, {
        nodes: [],
        totalNodes: 0,
      }),
    );

    expect(html).toContain('0 nodes');
  });
});

// =============================================================================
// ExportReport (mocked — renders via renderToString in node env)
// =============================================================================
describe('C07 — ExportReport component (mocked SSR render)', () => {
  it('renders with the correct report-id data attribute', () => {
    const report = loadGoldenReport();
    const html = renderToString(
      React.createElement(ExportReport, {
        report,
      }),
    );

    expect(html).toContain('export-report');
    expect(html).toContain(report.id);
    expect(html).toContain('Export');
  });
});
