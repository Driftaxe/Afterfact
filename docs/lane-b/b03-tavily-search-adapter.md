# docs/lane-b/b03-tavily-search-adapter.md — Tavily Web Intelligence Adapter

- **Ticket Reference:** [B03 in docs/PHASE-TRACKER.md](../PHASE-TRACKER.md#b03-search-extract-and-evidence-capture)
- **Status in Tracker:** `TODO`
- **Assigned Lane:** Lane B (Platform)
- **Verification Tier:** E4 (Staging live Tavily integration) / E2 (Mock double)

---

## 1. What You Are Building

You are building the server-side integration with **Tavily**, a query-aware web search and extraction service. You will implement:
1. `src/server/tavily/client.ts`: A client that executes `POST https://api.tavily.com/search` and `POST https://api.tavily.com/extract`.
2. A mapper that converts raw Tavily responses into strongly typed `SourceDocument` records containing final redirected URLs, published dates, and content hashes.

---

## 2. Why Afterfact Needs It

Without live web evidence, verifiers either hallucinate answers or rely on outdated LLM memory. Tavily provides:
- Live, query-relevant web documents from official sources.
- Clean text passages without requiring us to build web scrapers, headless browsers, or HTML cleaning pipelines.
- Direct provenance links and publication dates needed for Then vs. Now timelines.

---

## 3. Before You Start

- **Prerequisites:** Task B01 completed.
- **Contract Schemas:** Read `SourceDocument` schema in `src/lib/contracts/evidence-objects.ts` (authored in A10).
- **Credentials:** A Tavily API Key (`TAVILY_API_KEY=tvly-...`) from [tavily.com](https://tavily.com). (During early development, mock doubles can be used).

---

## 4. Where Each Action Happens

- **VS Code:** Create `src/server/tavily/client.ts` and `src/server/tavily/queries.ts`.
- **PowerShell:** Run unit and integration tests.

---

## 5. Numbered Implementation Steps

### Step 1: Add Tavily API Key to `.env.local`
In `.env.local`:
```bash
TAVILY_API_KEY=tvly-your-actual-api-key
```

### Step 2: Implement the Tavily Client (`src/server/tavily/client.ts`)
```typescript
// src/server/tavily/client.ts
import crypto from 'node:crypto';

export interface TavilySearchParams {
  query: string;
  searchDepth?: 'basic' | 'advanced';
  includeDomains?: string[];
  excludeDomains?: string[];
  maxResults?: number;
}

export interface RawSourceDoc {
  url: string;
  finalUrl: string;
  title: string;
  publisher: string;
  contentHash: string;
  rawContent: string;
  publicationDate?: string;
}

export async function tavilySearch(params: TavilySearchParams): Promise<RawSourceDoc[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) throw new Error('Missing TAVILY_API_KEY in environment');

  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      api_key: apiKey,
      query: params.query,
      search_depth: params.searchDepth ?? 'advanced',
      include_domains: params.includeDomains,
      exclude_domains: params.excludeDomains,
      max_results: params.maxResults ?? 5,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Tavily HTTP ${res.status}: ${errText}`);
  }

  const data = await res.json();
  return (data.results ?? []).map((r: any) => ({
    url: r.url,
    finalUrl: r.url,
    title: r.title ?? '',
    publisher: new URL(r.url).hostname,
    contentHash: crypto.createHash('sha256').update(r.content ?? '').digest('hex'),
    rawContent: r.content ?? '',
    publicationDate: r.published_date,
  }));
}
```

### Step 3: Implement Query Builder (`src/server/tavily/queries.ts`)
Map incoming `ResearchPlan` queries (from Lane A) into Tavily search calls:
- Current-state queries (targeting official docs)
- Historical queries (targeting press releases and changelogs)
- Counterevidence queries (seeking refutations)

### Step 4: Write Integration Test (`tests/integration/tavily-live.test.ts`)
Create a test executing a real search:
```powershell
pnpm vitest run tests/integration/tavily-live.test.ts
```
- **Expected Result:** Query returns results with title, URL, and non-empty text content.

---

## 6. Verification and Handoff

Collect the test execution output and record it in [docs/PHASE-TRACKER.md](../PHASE-TRACKER.md).
- **Handoff:** Downstream tickets **A04** (Evidence Extraction) and **B04b** (Minimal DAG Slice) can now consume `tavilySearch`.
