import goldenReportJson from '../../../fixtures/golden-mixed-report.json';
import { ReportSchema, type Report } from '@/lib/contracts/report';

export type LoadReportResult =
  | { success: true; report: Report }
  | { success: false; error: string; notFound?: boolean };

/**
 * Loads and validates the canonical golden mixed report fixture.
 * Guarantees that only valid schema-conforming data reaches consumers.
 */
export function getGoldenReport(): LoadReportResult {
  const parsed = ReportSchema.safeParse(goldenReportJson);
  if (!parsed.success) {
    return {
      success: false,
      error: `Failed to validate golden fixture: ${parsed.error.message}`,
    };
  }
  return { success: true, report: parsed.data };
}

/**
 * Resolves a report by run ID.
 * In Phase 0 / C02, only the canonical golden fixture ('demo' or 'run_golden_fixture_mixed_001')
 * is available as a deterministic replay fixture. Unknown IDs honestly return notFound.
 */
export function getReportById(id: string): LoadReportResult {
  if (id === 'demo' || id === 'run_golden_fixture_mixed_001') {
    return getGoldenReport();
  }

  return {
    success: false,
    notFound: true,
    error: `Report '${id}' not found. Live persistent reports will be queryable once Phase 1 backend integration (Task C03) is deployed.`,
  };
}
