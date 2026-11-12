'use client';

import React from 'react';
import { useRun } from '@/hooks/useRun';
import { ReportView } from '@/components/report/ReportView';
import { ReportErrorState, ReportLoadingSkeleton } from '@/components/report/ReportStates';

export function LiveReportViewer({ runId }: { runId: string }) {
  const { runSnapshot, notFound } = useRun(runId);

  if (notFound) {
    return (
      <ReportErrorState
        title="Report Not Found"
        message={`Report '${runId}' not found. It may have expired or the ID is incorrect.`}
      />
    );
  }

  if (!runSnapshot) {
    return <ReportLoadingSkeleton />;
  }

  return <ReportView report={runSnapshot} />;
}
