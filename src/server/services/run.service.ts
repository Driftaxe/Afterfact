import { db } from '@/server/db/client';

export interface CreateRunInput {
  ownerHash: string;
  inputHash: string;
  text: string;
  mode?: string;
  context?: any;
  expiresAt: Date;
}

export async function createVerificationRun(input: CreateRunInput) {
  return await db.verificationRun.create({
    data: {
      ownerHash: input.ownerHash,
      inputHash: input.inputHash,
      text: input.text,
      mode: input.mode ?? 'FAST',
      state: 'PENDING',
      context: input.context ?? {},
      expiresAt: input.expiresAt,
    },
  });
}

export async function getVerificationRun(runId: string) {
  return await db.verificationRun.findUnique({
    where: { id: runId },
    include: {
      claims: true,
      dagNodes: true,
      events: {
        orderBy: { seq: 'asc' },
      },
    },
  });
}