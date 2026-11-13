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
  if (!apiKey) {
    if (process.env.NODE_ENV === 'test') {
      return [];
    }
    throw new Error('Missing TAVILY_API_KEY in environment');
  }

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

  const data = (await res.json()) as { results?: Array<{ url: string; title?: string; content?: string; published_date?: string }> };
  return (data.results ?? []).map((r) => {
    let hostname = '';
    try {
      hostname = new URL(r.url).hostname;
    } catch {
      hostname = 'unknown';
    }
    const raw = sanitizePassageText(r.content ?? '');
    return {
      url: r.url,
      finalUrl: r.url,
      title: r.title ?? '',
      publisher: hostname,
      contentHash: crypto.createHash('sha256').update(raw).digest('hex'),
      rawContent: raw,
      publicationDate: r.published_date,
    };
  });
}

export async function tavilyExtract(params: TavilyExtractParams): Promise<RawSourceDoc[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    if (process.env.NODE_ENV === 'test') {
      return [];
    }
    throw new Error('Missing TAVILY_API_KEY in environment');
  }

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

  const data = (await res.json()) as { results?: Array<{ url: string; title?: string; raw_content?: string; published_date?: string }> };
  return (data.results ?? []).map((r) => {
    let hostname = '';
    try {
      hostname = new URL(r.url).hostname;
    } catch {
      hostname = 'unknown';
    }
    const raw = sanitizePassageText(r.raw_content ?? '');
    return {
      url: r.url,
      finalUrl: r.url,
      title: r.title ?? '',
      publisher: hostname,
      contentHash: crypto.createHash('sha256').update(raw).digest('hex'),
      rawContent: raw,
      publicationDate: r.published_date,
    };
  });
}
