import { createHash, randomUUID } from 'node:crypto';
import type { NextRequest } from 'next/server';

export const OWNER_COOKIE_NAME = 'afterfact_owner';

export interface ResolvedOwner {
  ownerHash: string;
  isNew: boolean;
  rawToken?: string;
}

/**
 * Resolves the caller's anonymous identity (ownerHash).
 * Checks in order:
 * 1. `afterfact_owner` HttpOnly cookie
 * 2. `Authorization: Bearer <token>` header (hashed with SHA-256)
 * 3. `x-owner-hash` direct header (used in integration tests and benchmark scripts)
 * 4. Fallback: generates a fresh UUID token, SHA-256 hashes it, and flags as `isNew: true`
 */
export function resolveOwnerHash(req: NextRequest): ResolvedOwner {
  // 1. Check HttpOnly cookie
  const cookieValue = req.cookies.get(OWNER_COOKIE_NAME)?.value;
  if (cookieValue && cookieValue.trim().length > 0) {
    return { ownerHash: cookieValue.trim(), isNew: false };
  }

  // 2. Check Authorization Bearer header
  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token.length > 0) {
      const hashed = createHash('sha256').update(token, 'utf8').digest('hex');
      return { ownerHash: hashed, isNew: false };
    }
  }

  // 3. Check X-Owner-Hash header (direct hash header for testing / eval harness)
  const xOwnerHash = req.headers.get('x-owner-hash');
  if (xOwnerHash && xOwnerHash.trim().length > 0) {
    return { ownerHash: xOwnerHash.trim(), isNew: false };
  }

  // 4. Generate new anonymous token
  const rawToken = randomUUID();
  const ownerHash = createHash('sha256').update(rawToken, 'utf8').digest('hex');
  return { ownerHash, isNew: true, rawToken };
}
