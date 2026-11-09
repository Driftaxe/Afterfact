# docs/lane-b/b02-bifrost-gateway-setup.md — Bifrost Gateway Setup & Model Profiles

- **Ticket Reference:** [B02 in docs/PHASE-TRACKER.md](../PHASE-TRACKER.md#b02-provision-bifrost-and-model-profiles)
- **Status in Tracker:** `TODO`
- **Assigned Lane:** Lane B (Platform)
- **Verification Tier:** E4 (Staging integration against Railway Bifrost) / E2 (Local mock)

---

## 1. What You Are Building

You are setting up the **Bifrost Model Gateway** (an open-source AI gateway created by Maxim AI). You will set up:
1. **Locally:** A Docker-free background gateway process running via `pnpm bifrost` on `http://127.0.0.1:8080`.
2. **Hosted (Staging/Production):** A Railway service running the prebuilt container `maximhq/bifrost` with a persistent volume mounted at `/app/data`.
3. **Application Client:** A TypeScript client in `src/server/bifrost/client.ts` that sends prompt requests to Bifrost over HTTP with typed error handling and fallback support.

---

## 2. Why Afterfact Needs It

Our verifier calls multiple AI models (for drafting, claim extraction, and passage assessment). If we call OpenAI or Anthropic directly from serverless functions:
- Private provider API keys would be scattered across environment configs.
- If OpenAI experiences a 500 error or rate limit, the entire verification run would crash.
- Bifrost intercepts failures and automatically fails over to a secondary provider (e.g. Groq Llama 3.3 70B) in <500ms without restarting the verification job.

---

## 3. Before You Start

- **Prerequisites:** Task B01 completed.
- **Credentials Required:**
  - `BIFROST_SETUP_TOKEN`: A secret string you choose (e.g. `bf_setup_mytoken123`) to initialize Bifrost admin.
  - At least one LLM API key (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or `GROQ_API_KEY`).
  - Railway account (for hosted staging deployment).

---

## 4. Where Each Action Happens

- **Terminal 1:** PowerShell running `pnpm bifrost` (local gateway).
- **Railway Dashboard:** Service deployment, volume mount (`/app/data`), and environment variables.
- **Bifrost Web UI:** Initial setup and generating `BIFROST_GATEWAY_TOKEN`.
- **VS Code:** Creating `src/server/bifrost/client.ts` and `src/server/bifrost/profiles.ts`.

---

## 5. Numbered Implementation Steps

### Step 1: Start Bifrost Locally (Docker-Free)
In a fresh PowerShell window at the project root:
```powershell
pnpm bifrost
```
- **What Happens:** Bifrost launches using Node / dlx and binds to `http://127.0.0.1:8080`.
- **Keep it Running:** Do not close this terminal!
- **How to Check:** Open your browser to `http://127.0.0.1:8080/health` or `http://127.0.0.1:8080`. It should return a 200 OK or the setup screen.

### Step 2: Deploy Bifrost to Railway (Hosted Staging)
1. Log in to [railway.app](https://railway.app) and create a new project.
2. Click **Create -> Deploy Image**. Enter: `maximhq/bifrost:latest` (or pinned version).
3. In service **Settings -> Networking**, click **Generate Domain** (exposing port `8080`).
4. In service **Settings -> Volumes**, click **Add Volume**:
   - Mount path: `/app/data`
   - Size: `5 GB`
   *(This ensures Bifrost's internal SQLite database and API keys survive redeployments).*
5. In service **Variables**, add:
   - `PORT=8080`
   - `DATA_DIR=/app/data`
   - `BIFROST_SETUP_TOKEN=your_secure_setup_token`
   - `OPENAI_API_KEY=...`
   - `ANTHROPIC_API_KEY=...`
   - `GROQ_API_KEY=...`

### Step 3: Initialize Bifrost and Obtain Gateway Token
1. Open your Railway Bifrost domain in the browser (e.g. `https://bifrost-staging.up.railway.app`).
2. Enter your `BIFROST_SETUP_TOKEN` to create the admin account.
3. In the Bifrost dashboard, navigate to **Virtual Keys / API Keys** and generate a new key named `afterfact-client`.
4. Copy this key. It is your `BIFROST_GATEWAY_TOKEN`. Add it to your `.env.local`:
   ```bash
   BIFROST_BASE_URL=https://bifrost-staging.up.railway.app
   BIFROST_GATEWAY_TOKEN=bf_gw_...
   ```

### Step 4: Implement the Server Client (`src/server/bifrost/client.ts`)
Create the TypeScript wrapper using native `fetch` with AbortSignal timeouts:
```typescript
// src/server/bifrost/client.ts
export interface BifrostChatOptions {
  model: string;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  temperature?: number;
  response_format?: { type: 'json_object' };
  timeoutMs?: number;
}

export async function bifrostChat(options: BifrostChatOptions): Promise<string> {
  const baseUrl = process.env.BIFROST_BASE_URL || 'http://127.0.0.1:8080';
  const token = process.env.BIFROST_GATEWAY_TOKEN;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs ?? 30000);

  try {
    const res = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        model: options.model,
        messages: options.messages,
        temperature: options.temperature ?? 0,
        response_format: options.response_format,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Bifrost HTTP ${res.status}: ${errText}`);
    }

    const data = await res.json();
    return data.choices[0]?.message?.content ?? '';
  } finally {
    clearTimeout(timeoutId);
  }
}
```

### Step 5: Implement Model Profiles Registry (`src/server/bifrost/profiles.ts`)
Create the centralized, type-safe profile registry mapping pipeline roles to environment variables with fallback defaults:
```typescript
// src/server/bifrost/profiles.ts
/**
 * Centralized Model Profile Registry for Afterfact.
 * Maps pipeline roles to gateway model configurations with safe defaults.
 */

export type ModelProfileRole = 'extract' | 'assess' | 'draft' | 'fallback';

export interface ModelProfileConfig {
  extract: string;
  assess: string;
  draft: string;
  fallback: string;
}

export const DEFAULT_PROFILES = {
  extract: 'openai/gpt-4o-mini',
  assess: 'anthropic/claude-3-5-sonnet-20241022',
  draft: 'openai/gpt-4o',
  fallback: 'groq/llama-3.3-70b-versatile',
} as const;

/**
 * Returns the configured Bifrost model identifier for a given pipeline role.
 */
export function getModelProfile(role: ModelProfileRole): string {
  switch (role) {
    case 'extract':
      return process.env.BIFROST_EXTRACT_MODEL || DEFAULT_PROFILES.extract;
    case 'assess':
      return process.env.BIFROST_ASSESS_MODEL || DEFAULT_PROFILES.assess;
    case 'draft':
      return process.env.BIFROST_DRAFT_MODEL || DEFAULT_PROFILES.draft;
    case 'fallback':
      return process.env.BIFROST_ASSESS_FALLBACK || DEFAULT_PROFILES.fallback;
    default: {
      const _exhaustive: never = role;
      throw new Error(`Unknown model profile role: ${_exhaustive}`);
    }
  }
}

/**
 * Returns a snapshot of all active model profile assignments.
 */
export function getAllModelProfiles(): ModelProfileConfig {
  return {
    extract: getModelProfile('extract'),
    assess: getModelProfile('assess'),
    draft: getModelProfile('draft'),
    fallback: getModelProfile('fallback'),
  };
}
```

### Step 6: Author Smoke Test Script (`infra/smoke-bifrost.ts`)
Create a verification script that validates profile resolution and executes a gateway inference call:
```typescript
// infra/smoke-bifrost.ts
import { bifrostChat } from '../src/server/bifrost/client';
import { getModelProfile, getAllModelProfiles } from '../src/server/bifrost/profiles';

async function main() {
  console.log('Testing Bifrost Gateway connection and profile resolution...');
  
  const profiles = getAllModelProfiles();
  console.log('Resolved profiles:', JSON.stringify(profiles, null, 2));

  const extractModel = getModelProfile('extract');
  console.log(`Sending ping using extraction profile (${extractModel})...`);

  const response = await bifrostChat({
    model: extractModel,
    messages: [
      { role: 'user', content: 'Respond with exactly: "Bifrost connection healthy."' }
    ],
    temperature: 0,
    timeoutMs: 15000,
  });

  console.log('Gateway response:', response.trim());
  if (!response.toLowerCase().includes('healthy')) {
    throw new Error(`Unexpected gateway response: "${response}"`);
  }

  console.log('Bifrost smoke test PASSED successfully.');
}

main().catch((err) => {
  console.error('Bifrost smoke test FAILED:', err);
  process.exit(1);
});
```

### Step 7: Run the Smoke Test
Execute the smoke test in PowerShell:
```powershell
pnpm tsx infra/smoke-bifrost.ts
```
- **Expected Result:** Prints the 4 resolved profiles and confirms gateway connection over HTTP with `Bifrost smoke test PASSED successfully.`

---

## 6. Verification and Handoff

Collect the execution output from Step 7.
- Update `B02` in [docs/PHASE-TRACKER.md](../PHASE-TRACKER.md) with the command and observed evidence.
- **Handoff:** Downstream tickets **A03** (Claim Extraction) and **B04b** (Minimal DAG Slice) can now call `bifrostChat` and `getModelProfile` safely.
