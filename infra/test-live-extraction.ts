import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

import { extractClaimsFromText } from '../src/server/verify/extract-claims';
import { DEMO_TEXT_INPUT, DEMO_SUBJECTIVE_INPUT } from '../tests/fixtures/demo-text';

async function runLiveModelExtractionDemo() {
  console.log('='.repeat(70));
  console.log(' AFTERFACT — Real Model Extraction Live Test (Railway Bifrost)');
  console.log('='.repeat(70));
  console.log('\n[1] Demo Input Text:\n');
  console.log(DEMO_TEXT_INPUT);
  console.log('\n' + '-'.repeat(70));
  console.log('Sending request to Bifrost gateway...');

  const startTime = Date.now();
  const outcome = await extractClaimsFromText({
    text: DEMO_TEXT_INPUT,
    runId: `demo_exec_${Date.now()}`,
    revision: 1,
  });
  const elapsedMs = Date.now() - startTime;

  console.log(`Received extraction response in ${elapsedMs}ms.`);
  console.log(`Outcome Status: ${outcome.status.toUpperCase()}`);

  if (outcome.status === 'success') {
    console.log(`Extracted Claims Count: ${outcome.tickets.length}\n`);

    outcome.tickets.forEach((ticket, idx) => {
      console.log(`--- [Claim ${idx + 1}] --------------------------------`);
      console.log(`  Claim ID:               ${ticket.claimId}`);
      console.log(`  Ticket ID:              ${ticket.ticketId}`);
      console.log(`  Domain:                 ${ticket.domain}`);
      console.log(`  Original Statement:     "${ticket.originalStatement}"`);
      console.log(`  Normalized Proposition: "${ticket.normalizedProposition}"`);
      if (ticket.sourceSpan) {
        console.log(`  Source Span:            [${ticket.sourceSpan.start}..${ticket.sourceSpan.end}]`);
        const slice = DEMO_TEXT_INPUT.slice(ticket.sourceSpan.start, ticket.sourceSpan.end);
        console.log(`  Exact Text Match:       "${slice}"`);
      } else {
        console.log(`  Source Span:            null (unanchored/ambiguous)`);
      }

      if (ticket.verificationContext.length > 0) {
        console.log(`  Context Properties (${ticket.verificationContext.length}):`);
        ticket.verificationContext.forEach((p) => {
          const spanStr = p.sourceSpan ? ` [${p.sourceSpan.start}..${p.sourceSpan.end}]` : '';
          console.log(`    - ${p.key}: "${p.value}" (${p.origin}${spanStr})`);
        });
      }
      if (ticket.missingMaterialContext.length > 0) {
        console.log(`  Missing Material Keys:  [${ticket.missingMaterialContext.join(', ')}]`);
      }
      console.log('');
    });
  } else if (outcome.status === 'failed') {
    console.error(`Extraction failed: [${outcome.error.code}] ${outcome.error.message}`);
  } else {
    console.log(`No claims extracted: ${outcome.reason}`);
  }

  console.log('='.repeat(70));
  console.log('[2] Subjective / Opinion Demo Input:');
  console.log(`"${DEMO_SUBJECTIVE_INPUT}"`);
  console.log('-'.repeat(70));

  const subjectiveOutcome = await extractClaimsFromText({
    text: DEMO_SUBJECTIVE_INPUT,
    runId: `demo_subj_${Date.now()}`,
    revision: 1,
  });

  console.log(`Outcome Status: ${subjectiveOutcome.status.toUpperCase()}`);
  if (subjectiveOutcome.status === 'no_claims') {
    console.log(`Result: Correctly abstained from extracting claims.`);
    console.log(`Reason: ${subjectiveOutcome.reason}`);
  } else {
    console.log('Unexpected outcome:', subjectiveOutcome);
  }
  console.log('='.repeat(70));
}

runLiveModelExtractionDemo().catch((err) => {
  console.error('Fatal error during live model extraction:', err);
  process.exit(1);
});
