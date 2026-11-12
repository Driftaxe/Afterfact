import './setup-env';
// all your other imports below
import { describe, it, expect } from 'vitest';
import { db } from '@/server/db/client';
import { PreparationService } from '@/server/services/prep-service';
import { createRunAndInitializeDag, DagExecutionService } from '@/server/services/dag-service';

describe('Minimal Persisted DAG Execution Slice (Gate G1)', () => {
  it('initializes a run, executes all 7 DAG slice stages, and completes with confidence 1.0', async () => {
    const ownerHash = 'test_owner_' + Date.now();
    const text = 'Stripe standard fee is 2.9% + 30c.';

    const prep = await PreparationService.getOrCreatePreparation(text);
    expect(prep.id).toBeDefined();

    const { run, rootNode } = await createRunAndInitializeDag({
      ownerHash,
      inputHash: prep.inputHash,
      prepId: prep.id,
      text,
    });
    expect(run.state).toBe('running');

    const result = await DagExecutionService.executeSlice(run.id);
    expect(result.state).toBe('completed');
    expect(result.confidence).toBe(1.0);
  });
});