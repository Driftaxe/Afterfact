import { createHash } from 'node:crypto';

/**
 * Computes deterministic SHA-256 hash of exact source text.
 */
export function computeInputHash(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

export interface ClaimIdentityParams {
  runId: string;
  ordinal: number;
  statement: string;
  revision: number;
}

export interface ClaimIdentity {
  claimId: string;
  ticketId: string;
}

/**
 * Generates unique, collision-resistant claim & ticket identities incorporating
 * execution identity (runId/prepId), candidate ordinal, and statement hash.
 *
 * Identity Formula:
 *   claimId:  `clm_${execHash}_${ordinal}_${stmtHash}` (<= 25 chars, fits PostgreSQL VARCHAR(36))
 *   ticketId: `tkt_${claimId}_r${revision}`
 *
 * Guarantees:
 * - Deterministic within the same execution ID and revision.
 * - Differentiated across distinct executions via truncated SHA-256 execHash.
 * - Duplicate identical statements within one extraction are disambiguated by candidate ordinal.
 */
export function generateClaimIdentity(params: ClaimIdentityParams): ClaimIdentity {
  const { runId, ordinal, statement, revision } = params;
  const execHash = createHash('sha256').update(runId, 'utf8').digest('hex').slice(0, 8);
  const stmtHash = createHash('sha256').update(statement, 'utf8').digest('hex').slice(0, 8);
  const claimId = `clm_${execHash}_${ordinal}_${stmtHash}`;
  const ticketId = `tkt_${claimId}_r${revision}`;
  return { claimId, ticketId };
}
