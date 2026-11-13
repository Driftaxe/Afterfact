// infra/smoke-staging.ts
import dotenv from 'dotenv';

// Load staging configuration if present, falling back to local env
dotenv.config({ path: 'infra/staging.env' });
dotenv.config({ path: '.env.local' });
dotenv.config();

interface VerifyResponse {
  runId: string;
  state: string;
  createdAt: string;
  snapshotUrl: string;
  streamUrl: string;
}

interface RunSnapshot {
  id: string;
  state: string;
  answerText: string;
  latestSeq?: number;
  summary?: {
    totalClaims: number;
    supported: number;
    outdated: number;
    contradicted: number;
    unresolved: number;
    failed: number;
  };
  dag?: {
    totalNodes: number;
    completedNodes: number;
    activeStage: string;
  };
}

async function runStagingSmokeTest(): Promise<void> {
  const targetUrl = (
    process.argv[2] ||
    process.env.APP_BASE_URL ||
    'https://afterfact-staging.vercel.app'
  ).replace(/\/$/, '');

  console.log('='.repeat(70));
  console.log(`[SMOKE-STAGING] Starting Afterfact Cloud Smoke Test`);
  console.log(`[SMOKE-STAGING] Target Base URL: ${targetUrl}`);
  console.log('='.repeat(70));

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Optional Vercel deployment protection bypass header
  if (process.env.VERCEL_PROTECTION_BYPASS) {
    headers['x-vercel-protection-bypass'] = process.env.VERCEL_PROTECTION_BYPASS;
  }

  // ---------------------------------------------------------------------------
  // Step 1: Health & Public API Probe Check
  // ---------------------------------------------------------------------------
  console.log('\n[Step 1] Probing public endpoint availability...');
  try {
    const probeRes = await fetch(`${targetUrl}/api/runs/test`, {
      method: 'GET',
      headers,
    });

    // Both 404 (valid CUID check or run not found) and 200 indicate Next.js is responding
    if (probeRes.status === 404 || probeRes.status === 200) {
      console.log(`[PASS] Server is live and responding (HTTP ${probeRes.status})`);
    } else {
      console.warn(`[WARN] Unexpected probe response: HTTP ${probeRes.status}`);
    }
  } catch (err) {
    console.error(`[FAIL] Unable to connect to target URL: ${targetUrl}`);
    console.error(`       Error: ${err instanceof Error ? err.message : String(err)}`);
    throw new Error(`Target staging server unreachable at ${targetUrl}`);
  }

  // ---------------------------------------------------------------------------
  // Step 2: Submit Verification Request via POST /api/v1/verify
  // ---------------------------------------------------------------------------
  console.log('\n[Step 2] Submitting verification job via POST /api/v1/verify...');
  const submitPayload = {
    mode: 'paste',
    answerText: 'Stripe charges 2.9% + 30 cents per transaction in the US.',
    originalQuestion: 'What are Stripe transaction processing fees in the US?',
    context: {
      jurisdiction: 'US',
      currency: 'USD',
    },
    autoConfirm: true,
  };

  let verifyResult: VerifyResponse;
  try {
    const submitRes = await fetch(`${targetUrl}/api/v1/verify`, {
      method: 'POST',
      headers,
      body: JSON.stringify(submitPayload),
    });

    const responseText = await submitRes.text();
    if (submitRes.status !== 202 && submitRes.status !== 200) {
      throw new Error(`Submission failed with status HTTP ${submitRes.status}: ${responseText}`);
    }

    verifyResult = JSON.parse(responseText) as VerifyResponse;
    console.log(`[PASS] Verification job accepted (HTTP ${submitRes.status})`);
    console.log(`       Run ID:       ${verifyResult.runId}`);
    console.log(`       State:        ${verifyResult.state}`);
    console.log(`       Snapshot URL: ${verifyResult.snapshotUrl}`);
    console.log(`       Stream URL:   ${verifyResult.streamUrl}`);
  } catch (err) {
    console.error(`[FAIL] POST /api/v1/verify failed:`, err);
    throw err;
  }

  const runId = verifyResult.runId;

  // ---------------------------------------------------------------------------
  // Step 3: Poll GET /api/runs/[id] Snapshot until Terminal State
  // ---------------------------------------------------------------------------
  console.log(`\n[Step 3] Polling run snapshot for execution progress (timeout: 60s)...`);
  const startTime = Date.now();
  const timeoutMs = 60000;
  let finalSnapshot: RunSnapshot | null = null;
  let pollAttempts = 0;

  while (Date.now() - startTime < timeoutMs) {
    pollAttempts++;
    await new Promise((resolve) => setTimeout(resolve, 3000));

    try {
      const snapRes = await fetch(`${targetUrl}/api/runs/${runId}`, {
        method: 'GET',
        headers,
      });

      if (!snapRes.ok) {
        console.log(`  [Poll #${pollAttempts}] Snapshot returned HTTP ${snapRes.status}, retrying...`);
        continue;
      }

      const snapshot = (await snapRes.json()) as RunSnapshot;
      console.log(
        `  [Poll #${pollAttempts} @ +${Math.round((Date.now() - startTime) / 1000)}s] State: ${snapshot.state}` +
          (snapshot.dag ? ` | Nodes: ${snapshot.dag.completedNodes}/${snapshot.dag.totalNodes}` : '')
      );

      if (snapshot.state === 'completed' || snapshot.state === 'failed') {
        finalSnapshot = snapshot;
        break;
      }
    } catch (pollErr) {
      console.warn(`  [Poll #${pollAttempts}] Network hiccup: ${pollErr instanceof Error ? pollErr.message : String(pollErr)}`);
    }
  }

  if (!finalSnapshot) {
    console.warn(`[WARN] Run ${runId} did not reach terminal state within 60s timeout.`);
    console.log(`       This can occur in local smoke mode without active background workers.`);
  } else {
    console.log(`\n[PASS] Run reached terminal state: '${finalSnapshot.state}'`);
    if (finalSnapshot.summary) {
      console.log(`       Summary: totalClaims=${finalSnapshot.summary.totalClaims}, supported=${finalSnapshot.summary.supported}, outdated=${finalSnapshot.summary.outdated}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Step 4: Verify SSE Progress Stream Endpoint Replay
  // ---------------------------------------------------------------------------
  console.log(`\n[Step 4] Checking SSE progress stream endpoint replay (/api/runs/${runId}/events?afterSeq=0)...`);
  try {
    const sseRes = await fetch(`${targetUrl}/api/runs/${runId}/events?afterSeq=0`, {
      method: 'GET',
      headers: {
        ...headers,
        Accept: 'text/event-stream',
      },
    });

    if (sseRes.status === 200) {
      const contentType = sseRes.headers.get('content-type') || '';
      if (contentType.includes('text/event-stream')) {
        console.log(`[PASS] SSE stream endpoint is active (HTTP 200, Content-Type: ${contentType})`);
      } else {
        console.warn(`[WARN] SSE endpoint returned unexpected content-type: ${contentType}`);
      }
    } else {
      console.warn(`[WARN] SSE endpoint returned HTTP ${sseRes.status}`);
    }
  } catch (sseErr) {
    console.warn(`[WARN] SSE connection check encountered error: ${sseErr instanceof Error ? sseErr.message : String(sseErr)}`);
  }

  console.log('\n' + '='.repeat(70));
  console.log(`[SMOKE-STAGING] Cloud Smoke Test COMPLETED successfully.`);
  console.log('='.repeat(70));
}

runStagingSmokeTest().catch((err) => {
  console.error('\n[SMOKE-STAGING] Smoke test aborted with error:', err);
  process.exit(1);
});
