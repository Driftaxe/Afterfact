import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

import { db } from '@/server/db/client';

async function main() {
  const runId = 'cmwjusfni000fgcospuq1ug0b';
  const run = await db.verificationRun.findUnique({
    where: { id: runId },
    include: {
      claims: {
        include: {
          decisionRecord: true,
          assessments: true,
        },
        orderBy: { ordinal: 'asc' },
      },
      dagNodes: true,
      clarifications: true,
    },
  });

  if (!run) {
    console.log(`Run ${runId} not found.`);
    return;
  }

  console.log(`Run ${runId} state:`, run.state);
  console.log(`Total DAG nodes:`, run.dagNodes.length);
  const byState = run.dagNodes.reduce((acc: any, n) => {
    acc[n.state] = (acc[n.state] || 0) + 1;
    return acc;
  }, {});
  console.log('Nodes by state:', byState);

  console.log(`\nDAG Nodes:`);
  for (const n of run.dagNodes) {
    console.log(`- Node ${n.id} (${n.nodeType}) state=${n.state} status=${n.status} error=${n.errorMessage}`);
  }

  console.log(`\nClaims (${run.claims.length}):`);
  for (const c of run.claims) {
    const res = c.result as any;
    console.log(`- Claim #${c.ordinal}: "${c.text}"`);
    console.log(`  State: ${c.state}, Verdict: ${res?.verdict}, Score: ${res?.score}, ReasonCode: ${res?.reasonCode}`);
    console.log(`  ScoreReason: ${res?.scoreReason}`);
    console.log(`  Assessments count: ${c.assessments.length}`);
  }
}

main().catch(console.error).finally(() => db.$disconnect());
