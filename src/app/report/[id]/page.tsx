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

  // Use fixture playback when requesting demo mode, sample-run alias, or explicit fixture mode
  if (id === 'demo' || id === 'sample-run' || mode === 'fixture') {
    const fixtureId = id === 'sample-run' ? 'demo' : id;
    const result = getReportById(fixtureId);

    if (!result.success) {
      return (
        <main className="min-h-[calc(100vh-8.5rem)] flex items-center justify-center px-4 sm:px-6 pt-20 pb-16">
          <ReportErrorState
            title={result.notFound ? 'Report Not Found' : 'Report Error'}
            message={result.error}
          />
        </main>
      );
    }

    return (
      <main className="min-h-[calc(100vh-8.5rem)] px-4 sm:px-6 lg:px-8 pt-20 sm:pt-24 pb-16 sm:pb-24">
        <ReportView report={result.report} />
      </main>
    );
  }

  // Live dynamic run stream with SSE and snapshot polling fallback
  return (
    <main className="min-h-[calc(100vh-8.5rem)] px-4 sm:px-6 lg:px-8 pt-20 sm:pt-24 pb-16 sm:pb-24">
      <LiveReportViewer runId={id} />
    </main>
  );
}
