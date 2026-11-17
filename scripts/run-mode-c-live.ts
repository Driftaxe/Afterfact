import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

import { db } from '@/server/db/client';
import { ClarificationService } from '@/server/services/clarification-service';
import goldenReportJson from '../fixtures/golden-mixed-report.json';
import fs from 'node:fs';
import path from 'node:path';

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log('=== Mode C: Live Verification Run Execution ===');
  const ownerHash = 'mode_c_audit_runner_' + Date.now();
  const text = goldenReportJson.answerText;

  console.log(`Submitting text: "${text.slice(0, 80)}..."`);
  console.log(`Owner Hash: ${ownerHash}`);

  // 1. Submit through real HTTP API
  const submitRes = await fetch('http://localhost:3000/api/v1/verify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-owner-hash': ownerHash,
    },
    body: JSON.stringify({
      mode: 'paste',
      answerText: text,
      context: {
        jurisdiction: 'US',
        currency: 'USD',
      },
    }),
  });

  if (!submitRes.ok) {
    const errText = await submitRes.text();
    console.error(`Submission failed with status ${submitRes.status}:`, errText);
    process.exit(1);
  }

  const submitJson = await submitRes.json();
  const runId = submitJson.runId;
  console.log(`Run successfully created: ${runId}`);
  console.log(`Initial state: ${submitJson.state}`);

  // 2. Poll for DAG completion, monitoring for clarifications and worker processing
  let terminal = false;
  let pollCount = 0;
  const maxPolls = 180; // Up to ~6 minutes
  let lastState = '';
  let answeredClarification = false;

  while (!terminal && pollCount < maxPolls) {
    await sleep(2000);
    pollCount++;

    const snapshotRes = await fetch(`http://localhost:3000/api/runs/${runId}`, {
      headers: {
        cookie: `af_owner_hash=${ownerHash}`,
        'x-owner-hash': ownerHash,
      },
    });

    if (!snapshotRes.ok) {
      console.warn(`Snapshot poll returned status ${snapshotRes.status}`);
      continue;
    }

    const snapshot = await snapshotRes.json();
    if (snapshot.state !== lastState || pollCount % 5 === 0) {
      console.log(
        `[Poll #${pollCount}] State: ${snapshot.state} | Nodes: ${snapshot.dag?.completedNodes ?? 0}/${snapshot.dag?.totalNodes ?? 0} | Claims: ${snapshot.claims?.length ?? 0}`
      );
      lastState = snapshot.state;
    }

    // Check if any DAG node is waiting for input (clarification)
    const waitingNode = snapshot.dagNodes?.find(
      (n: any) => n.state === 'waiting_for_input' || n.status === 'WAITING_FOR_INPUT'
    );

    if (waitingNode && !answeredClarification) {
      console.log(`Found node waiting for clarification: ${waitingNode.id} (nodeKey: ${waitingNode.nodeKey})`);
      const clarification = await db.clarification.findFirst({
        where: { runId, nodeId: waitingNode.id, status: 'pending' },
      });

      if (clarification) {
        console.log(`Clarification Question: "${clarification.question}"`);
        console.log(`Question Definition:`, JSON.stringify(clarification.questionDefinition, null, 2));

        // For the audit, let's observe and record the question, then resume it with 'Workers Paid'
        console.log('Answering clarification with plan_tier = "Workers Paid"...');
        await ClarificationService.resumeWithAnswer(
          clarification.id,
          { plan_tier: 'Workers Paid' },
          clarification.version
        );
        answeredClarification = true;
        console.log('Clarification submitted and branch resumed.');
      }
    }

    if (['completed', 'partial', 'failed'].includes(snapshot.state)) {
      terminal = true;
      console.log(`Run reached terminal state: ${snapshot.state}`);

      const outputPath = path.resolve('scratch', `live-mode-c-snapshot-${runId}.json`);
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, JSON.stringify(snapshot, null, 2), 'utf8');
      console.log(`Full snapshot saved to: ${outputPath}`);

      console.log('\n=== Mode C Claims Summary ===');
      for (const claim of snapshot.claims || []) {
        console.log(`--------------------------------------------------`);
        console.log(`Ordinal: ${claim.ordinal} | Claim ID: ${claim.id}`);
        console.log(`Raw Text: "${claim.rawText}"`);
        console.log(`Verdict: ${claim.verdict} | Score: ${claim.score}`);
        console.log(`Reason Code: ${claim.reasonCode}`);
        console.log(`Score Reason: ${claim.scoreReason}`);
        if (claim.timeline?.length > 0) {
          console.log(`Timeline (${claim.timeline.length} entries):`);
          for (const t of claim.timeline) {
            console.log(`  - [${t.state}] ${t.effectiveDate}: ${t.summary}`);
          }
        }
        if (claim.correction) {
          console.log(`Correction:`, claim.correction);
        }
      }
      console.log(`--------------------------------------------------`);
      console.log(`Run Summary:`, JSON.stringify(snapshot.summary, null, 2));
    }
  }

  if (!terminal) {
    console.error(`Run ${runId} timed out after ${maxPolls * 2} seconds!`);
  }
}

main().catch((err) => {
  console.error('Mode C Live Runner Exception:', err);
  process.exit(1);
});
