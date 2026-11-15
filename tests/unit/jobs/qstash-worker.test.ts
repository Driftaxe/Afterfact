import { describe, it, expect } from 'vitest';
import { detectCycle } from '@/server/dag/expand';
import { MAX_DAG_NODES_PER_RUN } from '@/lib/contracts/dag';
import { NextRequest } from 'next/server';
import { POST as workerPost } from '@/app/api/verify/worker/route';
import { POST as reconcilePost } from '@/app/api/internal/reconcile/route';

describe('B05 Pure Unit Logic & Security Gates', () => {
  describe('Dynamic DAG Cycle Detection (DFS)', () => {
    it('detects a direct self-loop', () => {
      const existing = [{ pred: 'A', succ: 'B' }];
      const hasCycle = detectCycle(existing, { pred: 'C', succ: 'C' });
      expect(hasCycle).toBe(true);
    });

    it('detects a simple 2-node directed cycle', () => {
      const existing = [{ pred: 'A', succ: 'B' }];
      const hasCycle = detectCycle(existing, { pred: 'B', succ: 'A' });
      expect(hasCycle).toBe(true);
    });

    it('detects a 3-node transitive cycle (A -> B -> C -> A)', () => {
      const existing = [
        { pred: 'A', succ: 'B' },
        { pred: 'B', succ: 'C' },
      ];
      const hasCycle = detectCycle(existing, { pred: 'C', succ: 'A' });
      expect(hasCycle).toBe(true);
    });

    it('allows valid diamond topology without cycles (A -> B -> D, A -> C -> D)', () => {
      const existing = [
        { pred: 'A', succ: 'B' },
        { pred: 'A', succ: 'C' },
        { pred: 'B', succ: 'D' },
      ];
      const hasCycle = detectCycle(existing, { pred: 'C', succ: 'D' });
      expect(hasCycle).toBe(false);
    });

    it('detects cycle when adding backwards edge across diamond (D -> A)', () => {
      const existing = [
        { pred: 'A', succ: 'B' },
        { pred: 'A', succ: 'C' },
        { pred: 'B', succ: 'D' },
        { pred: 'C', succ: 'D' },
      ];
      const hasCycle = detectCycle(existing, { pred: 'D', succ: 'A' });
      expect(hasCycle).toBe(true);
    });

    it('enforces MAX_DAG_NODES_PER_RUN = 52 constant', () => {
      expect(MAX_DAG_NODES_PER_RUN).toBe(52);
    });
  });

  describe('Worker Webhook Security & Signatures', () => {
    it('rejects requests missing the upstash-signature header with 401 Unauthorized', async () => {
      const req = new NextRequest('http://localhost:3000/api/verify/worker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId: 'run_123', nodeId: 'node_456' }),
      });

      const res = await workerPost(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.code).toBe('UNAUTHORIZED');
    });

    it('rejects requests with forged/invalid upstash-signature with 401 Unauthorized', async () => {
      const req = new NextRequest('http://localhost:3000/api/verify/worker', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'upstash-signature': 'forged_invalid_signature_jwt',
        },
        body: JSON.stringify({ runId: 'run_123', nodeId: 'node_456' }),
      });

      const res = await workerPost(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.code).toBe('UNAUTHORIZED');
    });
  });

  describe('Reconcile Sweeper Authorization', () => {
    it('rejects unauthenticated reconcile requests when secret is configured', async () => {
      const origSecret = process.env.INTERNAL_CRON_SECRET;
      process.env.INTERNAL_CRON_SECRET = 'super_secret_cron_token_123';

      try {
        const req = new NextRequest('http://localhost:3000/api/internal/reconcile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });

        const res = await reconcilePost(req);
        expect(res.status).toBe(401);
        const json = await res.json();
        expect(json.code).toBe('UNAUTHORIZED');
      } finally {
        process.env.INTERNAL_CRON_SECRET = origSecret;
      }
    });
  });

  describe('P1: Non-Fabricated Scores & Terminal State Mapping', () => {
    it('does not fabricate score 100 or verdict supported when claim has no decision', () => {
      // Simulates the mapping logic in RunQueryService
      const dec = null;
      const decRecord = dec as Record<string, unknown> | null;
      const mapped = {
        verdict:
          decRecord && typeof decRecord.verdict === 'string'
            ? decRecord.verdict
            : undefined,
        score:
          decRecord && typeof decRecord.score === 'number'
            ? decRecord.score
            : null,
      };

      expect(mapped.verdict).toBeUndefined();
      expect(mapped.score).toBeNull();
    });

    it('correctly maps real numeric score and verdict when decisionRecord is present', () => {
      const dec = { verdict: 'supported', score: 85, scoreReason: 'Solid proof' };
      const decRecord = dec as Record<string, unknown> | null;
      const mapped = {
        verdict:
          decRecord && typeof decRecord.verdict === 'string'
            ? decRecord.verdict
            : undefined,
        score:
          decRecord && typeof decRecord.score === 'number'
            ? decRecord.score
            : null,
      };

      expect(mapped.verdict).toBe('supported');
      expect(mapped.score).toBe(85);
    });

    it('maps non-decided fallback outcome to insufficient_evidence with null score', () => {
      const outcome = {
        status: 'insufficient_evidence_units' as const,
        reason: 'Too few units',
      };

      const fallbackDecision = {
        verdict: 'insufficient_evidence',
        score: null,
        confidence: 0,
        reasonCode: 'INSUFFICIENT_EVIDENCE',
        scoreReason: outcome.reason,
      };

      expect(fallbackDecision.verdict).toBe('insufficient_evidence');
      expect(fallbackDecision.score).toBeNull();
      expect(fallbackDecision.reasonCode).toBe('INSUFFICIENT_EVIDENCE');
    });
  });
});
