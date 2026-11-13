import React from 'react';
import type { Metadata } from 'next';
import { getReportById } from '@/lib/fixtures/golden-report';
import { ReportView } from '@/components/report/ReportView';
import { ReportErrorState } from '@/components/report/ReportStates';
import { LiveReportViewer } from '@/components/report/LiveReportViewer';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mode?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Verification Report — ${id} | Afterfact`,
    description: 'Evidence-grounded temporal fact verification report',
  };
}

export default async function ReportPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { mode } = await searchParams;

  // Live dynamic run stream with SSE and snapshot polling fallback
  // Only valid live verification run IDs (e.g. run_<hash>) that are not fixtures use the dynamic hook
  const isLiveRun = id.startsWith('run_') && id !== 'run_golden_fixture_mixed_001' && mode !== 'fixture';

  if (!isLiveRun) {
    const result = getReportById(id);

    if (!result.success) {
      return (
        <main className="min-h-[calc(100vh-8.5rem)] flex items-center justify-center px-4 sm:px-6 py-12">
          <ReportErrorState
            title={result.notFound ? 'Report Not Found' : 'Report Error'}
            message={result.error}
          />
        </main>
      );
    }

    return (
      <main className="min-h-[calc(100vh-8.5rem)] px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <ReportView report={result.report} />
      </main>
    );
  }

  // Live dynamic run stream with SSE and snapshot polling fallback
  return (
    <main className="min-h-[calc(100vh-8.5rem)] px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <LiveReportViewer runId={id} />
    </main>
  );
}
