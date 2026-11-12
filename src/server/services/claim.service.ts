import { db } from '@/server/db/client';

export interface SaveClaimInput {
  runId: string;
  text: string;
  normalizedText: string;
}

export async function createClaim(input: SaveClaimInput) {
  return await db.claim.create({
    data: {
      runId: input.runId,
      text: input.text,
      normalizedText: input.normalizedText,
      status: 'PENDING',
    },
  });
}

export async function createDecisionRecord(claimId: string, verdict: string, confidence: number, summary: string, reasoning: any) {
  return await db.decisionRecord.create({
    data: {
      claimId,
      verdict,
      confidence,
      summary,
      reasoning,
    },
  });
}