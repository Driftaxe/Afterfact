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
Implement both `tavilySearch` and `tavilyExtract` endpoints along with passage text sanitization:
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

export interface TavilyExtractParams {
  urls: string[];
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

/**
 * Sanitizes passage text by collapsing redundant whitespace and bounding length to worker prompt budget.
 */
export function sanitizePassageText(rawText: string, maxChars: number = 8000): string {
  if (!rawText) return '';
  const cleaned = rawText
    .replace(/<[^>]*>/g, ' ') // Strip HTML tags
    .replace(/[\r\n\t]+/g, ' ') // Collapse whitespace
    .replace(/\s{2,}/g, ' ')
    .trim();
  return cleaned.length > maxChars ? cleaned.slice(0, maxChars) + '... [truncated]' : cleaned;
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
    throw new Error(`Tavily search HTTP ${res.status}: ${errText}`);
  }

  const data = await res.json();
  return (data.results ?? []).map((r: any) => ({
    url: r.url,
    finalUrl: r.url,
    title: r.title ?? '',
    publisher: new URL(r.url).hostname,
    contentHash: crypto.createHash('sha256').update(r.content ?? '').digest('hex'),
    rawContent: sanitizePassageText(r.content ?? ''),
    publicationDate: r.published_date,
  }));
}

export async function tavilyExtract(params: TavilyExtractParams): Promise<RawSourceDoc[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) throw new Error('Missing TAVILY_API_KEY in environment');

  const res = await fetch('https://api.tavily.com/extract', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      api_key: apiKey,
      urls: params.urls,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Tavily extract HTTP ${res.status}: ${errText}`);
  }

  const data = await res.json();
  return (data.results ?? []).map((r: any) => ({
    url: r.url,
    finalUrl: r.url,
    title: r.title ?? '',
    publisher: new URL(r.url).hostname,
    contentHash: crypto.createHash('sha256').update(r.raw_content ?? '').digest('hex'),
    rawContent: sanitizePassageText(r.raw_content ?? ''),
    publicationDate: r.published_date,
  }));
}
```

### Step 3: Implement Query Executor & Source Document Mapper (`src/server/tavily/queries.ts`)
Map incoming `ResearchPlan` queries (current-state, counterevidence, and historical changes) into Tavily calls, capturing results into strongly-typed `SourceDocument` records:
```typescript
// src/server/tavily/queries.ts
import { tavilySearch, RawSourceDoc } from './client';
import type { ResearchPlan } from '@/lib/contracts/research';
import type { SourceDocument } from '@/lib/contracts/evidence-objects';

export interface ExecutedResearchResults {
  runId: string;
  claimId: string;
  documents: SourceDocument[];
}

export async function executeResearchQueries(params: {
  runId: string;
  claimId: string;
  plan: ResearchPlan;
}): Promise<ExecutedResearchResults> {
  const { runId, claimId, plan } = params;
  const queriesToExecute: Array<{ query: string; role: 'primary' | 'counterevidence' | 'historical' }> = [
    ...plan.currentStateQueries.map((q) => ({ query: q, role: 'primary' as const })),
    ...plan.counterevidenceQueries.map((q) => ({ query: q, role: 'counterevidence' as const })),
    ...plan.historicalQueries.map((q) => ({ query: q, role: 'historical' as const })),
  ];

  // Execute searches in parallel bounded by error boundaries
  const searchPromises = queriesToExecute.map(async ({ query, role }) => {
    try {
      const results = await tavilySearch({ query, maxResults: 3 });
      return results.map((doc, idx) => ({
        id: `doc_${claimId}_${role}_${idx}_${doc.contentHash.slice(0, 8)}`,
        runId,
        url: doc.url,
        finalUrl: doc.finalUrl,
        title: doc.title,
        publisher: doc.publisher,
        contentHash: doc.contentHash,
        sourceRole: role,
        rawContent: doc.rawContent,
        publicationDate: doc.publicationDate,
        createdAt: new Date().toISOString(),
      }));
    } catch (err) {
      console.warn(`Query execution failed for "${query}":`, err);
      return [];
    }
  });

  const nestedDocs = await Promise.all(searchPromises);
  const documents = nestedDocs.flat();

  return { runId, claimId, documents };
}
```

### Step 4: Write Integration Test (`tests/integration/tavily-live.test.ts`)
Create a verification test executing real or mocked search and extraction:
```typescript
// tests/integration/tavily-live.test.ts
import { describe, it, expect } from 'vitest';
import { tavilySearch, tavilyExtract, sanitizePassageText } from '@/server/tavily/client';

describe('Tavily Web Search and Extraction Adapter', () => {
  it('sanitizes text passages and bounds length to prompt budget', () => {
    const rawHtml = '<p>Stripe   pricing \t was updated in 2024.</p>';
    const cleaned = sanitizePassageText(rawHtml, 100);
    expect(cleaned).toBe('Stripe pricing was updated in 2024.');
  });

  it('executes live search when TAVILY_API_KEY is configured', async () => {
    if (!process.env.TAVILY_API_KEY) {
      console.log('Skipping live Tavily test: TAVILY_API_KEY not set.');
      return;
    }

    const results = await tavilySearch({
      query: 'Stripe standard processing fee US pricing 2024',
      maxResults: 2,
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].url).toMatch(/^https?:\/\//);
    expect(results[0].contentHash).toHaveLength(64);
    expect(results[0].rawContent.length).toBeGreaterThan(10);
  });
});
```

Run the test suite in PowerShell:
```powershell
pnpm vitest run tests/integration/tavily-live.test.ts
```
- **Expected Result:** Sanitization passes, and live/mocked queries return structured `SourceDocument` candidates.

---

## 6. Verification and Handoff

Collect the test execution output and record it in [docs/PHASE-TRACKER.md](../PHASE-TRACKER.md).
- **Handoff:** Downstream tickets **A04** (Evidence Extraction) and **B04b** (Minimal DAG Slice) can now consume `tavilySearch`, `tavilyExtract`, and `executeResearchQueries`.
