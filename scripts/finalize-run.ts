import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

import { db } from '@/server/db/client';
import { processWorkerJob } from '@/server/jobs/worker';
import { getSanitizedRunSnapshot } from '@/server/services/run-query-service';
import fs from 'node:fs';
import path from 'node:path';

async function main() {
  const runId = 'cmwjusfni000fgcospuq1ug0b';
  const finalizeNodeId = 'node_finalize_' + runId;

  // Reset finalize node to pending so it can acquire lease and run
  await db.dagNode.update({
    where: { id: finalizeNodeId },
    data: {
      state: 'pending',
      status: 'PENDING',
      leaseToken: null,
      leaseOwner: null,
      leaseUntil: null,
    },
  });

  console.log(`Executing finalize node for run ${runId}...`);
  await processWorkerJob(runId, finalizeNodeId);

  const run = await db.verificationRun.findUnique({
    where: { id: runId },
    select: { state: true, finishedAt: true },
  });

  console.log(`Run state after finalization:`, run?.state);

  const snapshot = await getSanitizedRunSnapshot(runId, 'mode_c_audit_runner_1794869213077');
  const outputPath = path.resolve('scratch', `live-mode-c-snapshot-${runId}.json`);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(snapshot, null, 2), 'utf8');
  console.log(`Saved snapshot to: ${outputPath}`);

  console.log('Summary:', JSON.stringify(snapshot?.summary, null, 2));
}

main().catch(console.error).finally(() => db.$disconnect());
