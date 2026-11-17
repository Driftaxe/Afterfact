import { createRunAndInitializeDag } from '@/server/services/dag-service';
import { extractClaimsFromText } from '@/server/verify/extract-claims';
import { processWorkerJob } from '@/server/jobs/worker';
import { getSanitizedRunSnapshot } from '@/server/services/run-query-service';
import { db } from '@/server/db/client';

async function main() {
  const text = 'Sam Altman is gay and her boyfriend is virgin';
  console.log('1. Extracting claims for input:', text);

  const extraction = await extractClaimsFromText({
    text,
    runId: 'audit_altman',
    revision: 1,
  });

  if (extraction.status !== 'success') {
    console.error('Extraction failed:', extraction);
    return;
  }

  console.log(`2. Successfully extracted ${extraction.tickets.length} atomic claims:`);
  extraction.tickets.forEach((t, i) => {
    console.log(`   [${i + 1}] "${t.originalStatement}" -> "${t.normalizedProposition}" (${t.domain})`);
  });

  console.log('3. Materializing run and DAG in database...');
  const { run, rootNode } = await createRunAndInitializeDag({
    ownerHash: 'audit_owner_altman',
    inputHash: extraction.inputHash,
    text,
    initialClaims: extraction.tickets,
  });

  console.log(`   Run ID: ${run.id}, Root Node: ${rootNode.id}`);
  console.log('4. Processing root node...');
  await processWorkerJob(run.id, rootNode.id);

  console.log('5. Executing dynamic DAG nodes...');
  let pass = 0;
  while (pass < 35) {
    const pendingNodes = await db.dagNode.findMany({
      where: {
        runId: run.id,
        state: { in: ['pending', 'running', 'leased'] },
      },
    });

    if (pendingNodes.length === 0) {
      console.log('   All DAG nodes completed.');
      break;
    }

    for (const node of pendingNodes) {
      try {
        await processWorkerJob(run.id, node.id);
      } catch (err) {
        console.warn(`   Node ${node.id} (${node.nodeType}) execution note:`, (err as Error).message);
      }
    }
    pass++;
  }

  console.log('6. Querying finalized sanitized run snapshot...');
  const snapshot = await getSanitizedRunSnapshot(run.id, 'audit_owner_altman');
  console.log('   Run State:', snapshot?.state);
  console.log('   Claims Summary:', snapshot?.summary);

  console.log('\n--- CLAIM VERIFICATION RESULTS ---');
  for (const claim of snapshot?.claims || []) {
    console.log(`Claim #${claim.ordinal + 1}: "${claim.rawText}"`);
    console.log(`  Verdict:     ${claim.verdict}`);
    console.log(`  Score:       ${claim.score}`);
    console.log(`  Reason Code: ${claim.reasonCode}`);
    console.log(`  Reason:      ${claim.scoreReason}`);
    console.log('------------------------------------');
  }
}

main().catch(console.error);
