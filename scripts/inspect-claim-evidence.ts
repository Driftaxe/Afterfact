import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

import { db } from '@/server/db/client';

async function main() {
  const runId = 'cmwjusfni000fgcospuq1ug0b';
  const claims = await db.claim.findMany({
    where: { runId },
    include: {
      assessments: {
        include: {
          evidenceUnit: true,
        },
      },
    },
    orderBy: { ordinal: 'asc' },
  });

  for (const c of claims) {
    console.log(`\n======================================================`);
    console.log(`Claim #${c.ordinal}: "${c.text}"`);
    console.log(`Spec:`, JSON.stringify(c.spec, null, 2));
    const res = c.result as any;
    console.log(`Verdict: ${res?.verdict} | Score: ${res?.score} | ReasonCode: ${res?.reasonCode}`);
    console.log(`Score Reason: ${res?.scoreReason}`);
    console.log(`Assessments (${c.assessments.length}):`);
    for (const a of c.assessments) {
      console.log(`  - Assessment ID: ${a.id}`);
      console.log(`    Document ID: ${a.evidenceUnit.documentId}`);
      console.log(`    Relationship: ${a.relationship} | Confidence: ${a.confidence}`);
      console.log(`    Temporal: ${a.temporalApplicability} | QuotationVerified: ${a.quotationVerified}`);
      console.log(`    Reasoning: ${a.reasoning}`);
      console.log(`    Passage: "${a.evidenceUnit.verbatimText?.slice(0, 100)}..."`);
    }
  }
}

main().catch(console.error).finally(() => db.$disconnect());
