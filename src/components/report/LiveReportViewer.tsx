'use client';

import React from 'react';
import { useRun } from '@/hooks/useRun';
import { ReportView } from '@/components/report/ReportView';
import { ReportLoadingSkeleton } from '@/components/report/ReportStates';

export function LiveReportViewer({ runId }: { runId: string }) {
  const { runSnapshot } = useRun(runId);

  if (!runSnapshot) {
    return <ReportLoadingSkeleton />;
  }

  return <ReportView report={runSnapshot} />;
}
