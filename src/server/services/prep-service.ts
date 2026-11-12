import crypto from 'node:crypto';
import { db } from '@/server/db/client';

export class PreparationService {
  static computeInputHash(text: string, question?: string, context?: object): string {
    return crypto
      .createHash('sha256')
      .update(JSON.stringify({ text: text.trim(), question: question?.trim(), context: context ?? {} }))
      .digest('hex');
  }

  static async getOrCreatePreparation(text: string, question?: string, context?: object) {
    const inputHash = this.computeInputHash(text, question, context);

    const existing = await db.preparation.findUnique({
      where: { inputHash },
    });

    if (existing) return existing;

    return await db.preparation.create({
      data: {
        inputHash,
        normalizedText: text.trim(),
        claimTickets: [],
        qualifiers: {},
      },
    });
  }
}