import { Prisma } from '@prisma/client';
import {
  VerificationEventSchema,
  VerificationEvent,
} from '@/lib/contracts/events';

export type EventInput =
  | {
      type: 'run_started';
      mode: 'paste' | 'ask';
      textLength: number;
    }
  | {
      type: 'claims_identified';
      claims: Array<{
        id: string;
        ordinal: number;
        text: string;
        span?: { start: number; end: number } | null;
      }>;
    }
  | {
      type: 'claim_result';
      claimId: string;
      verdict: 'supported' | 'contradicted' | 'outdated' | 'depends_on_context' | 'conflicting_evidence' | 'insufficient_evidence';
      score: 100 | 75 | 0 | null;
      reasonCode: string;
      scoreReason?: string | null;
    }
  | {
      type: 'claim_failed';
      claimId: string;
      reasonCode: string;
      error: string;
    }
  | {
      type: 'run_finished';
      state: 'completed' | 'partial' | 'failed';
      summary: {
        totalClaims: number;
        supported?: number;
        outdated?: number;
        contradicted?: number;
        unresolved?: number;
        supportedClaims?: number;
        contradictedClaims?: number;
        outdatedClaims?: number;
        indeterminateClaims?: number;
        truthScore?: number | null;
        failed?: number;
        pending?: number;
      };
    };

/**
 * EventService: Atomically allocates sequential sequence numbers (nextEventSeq)
 * and inserts validated contract events within a database transaction.
 */
export class EventService {
  static async recordEvent(
    tx: Prisma.TransactionClient,
    runId: string,
    eventData: EventInput
  ): Promise<VerificationEvent> {
    // 1. Atomically increment nextEventSeq on VerificationRun
    const updatedRun = await tx.verificationRun.update({
      where: { id: runId },
      data: {
        nextEventSeq: { increment: 1 },
      },
      select: {
        nextEventSeq: true,
      },
    });

    const allocatedSeq = updatedRun.nextEventSeq - 1;
    const timestamp = new Date().toISOString();

    // Normalize run_finished summary so both contract format (supported/outdated/etc.)
    // and legacy format (supportedClaims/outdatedClaims/etc.) satisfy ReportSummarySchema
    let normalizedData = eventData;
    if (eventData.type === 'run_finished') {
      const s = eventData.summary as Record<string, unknown>;
      normalizedData = {
        ...eventData,
        summary: {
          totalClaims: typeof s.totalClaims === 'number' ? s.totalClaims : 0,
          supported:
            typeof s.supported === 'number'
              ? s.supported
              : typeof s.supportedClaims === 'number'
                ? s.supportedClaims
                : 0,
          outdated:
            typeof s.outdated === 'number'
              ? s.outdated
              : typeof s.outdatedClaims === 'number'
                ? s.outdatedClaims
                : 0,
          contradicted:
            typeof s.contradicted === 'number'
              ? s.contradicted
              : typeof s.contradictedClaims === 'number'
                ? s.contradictedClaims
                : 0,
          unresolved:
            typeof s.unresolved === 'number'
              ? s.unresolved
              : typeof s.indeterminateClaims === 'number'
                ? s.indeterminateClaims
                : 0,
          failed: typeof s.failed === 'number' ? s.failed : 0,
          pending: typeof s.pending === 'number' ? s.pending : 0,
        },
      };
    }

    const fullEvent = {
      ...normalizedData,
      runId,
      seq: allocatedSeq,
      timestamp,
    };

    // 2. Validate against official VerificationEventSchema
    const validated = VerificationEventSchema.parse(fullEvent);

    // 3. Persist to events table
    await tx.runEvent.create({
      data: {
        runId,
        seq: allocatedSeq,
        type: validated.type,
        payload: validated as unknown as Prisma.InputJsonValue,
      },
    });

    return validated;
  }
}
