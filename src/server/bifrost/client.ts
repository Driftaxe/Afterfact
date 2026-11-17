// src/server/bifrost/client.ts
import { getModelProfile, ModelProfileRole } from './profiles';

export interface BifrostChatOptions {
  model?: string;
  role?: ModelProfileRole;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  temperature?: number;
  response_format?: { type: 'json_object' };
  timeoutMs?: number;
  enableFallback?: boolean;
  maxRetries?: number;
}

export class BifrostError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly responseBody: string,
    message: string
  ) {
    super(message);
    this.name = 'BifrostError';
  }
}

export async function bifrostChat(options: BifrostChatOptions): Promise<string> {
  const baseUrl = (process.env.BIFROST_BASE_URL || 'http://127.0.0.1:8080').replace(/\/+$/, '');
  
  const adminUser = process.env.BIFROST_ADMIN_USER || '';
  const adminPassword = process.env.BIFROST_ADMIN_PASSWORD || '';
  const credentials = Buffer.from(`${adminUser}:${adminPassword}`).toString('base64');

  // Support multiple common names for the virtual key env var
  const virtualKey = 
    process.env.BIFROST_GATEWAY_TOKEN || 
    process.env.BIFROST_VIRTUAL_KEY || 
    process.env.BIFROST_VK || '';

  if (!virtualKey) {
    console.warn('[Bifrost Warning] No virtual key found in environment variables (BIFROST_GATEWAY_TOKEN / BIFROST_VIRTUAL_KEY / BIFROST_VK).');
  }

  let modelToUse = options.model;
  if (!modelToUse) {
    const role = options.role || 'extract';
    modelToUse = getModelProfile(role);
  }

  const maxRetries = options.maxRetries ?? 2;
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs ?? 30000);

    try {
      const url = `${baseUrl}/v1/chat/completions`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${credentials}`,
          ...(virtualKey ? { 'x-bf-vk': virtualKey } : {}),
        },
        body: JSON.stringify({
          model: modelToUse,
          messages: options.messages,
          temperature: options.temperature ?? 0,
          response_format: options.response_format,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error('[BIFROST HTTP ERROR]', {
          status: res.status,
          url,
          model: modelToUse,
          response: errText,
        });
        const isRetryable = res.status === 503 || res.status === 429 || res.status === 502;
        if (isRetryable && attempt < maxRetries) {
          let backoffMs = (attempt + 1) * 2000;
          if (res.status === 429) {
            try {
              const parsedErr = JSON.parse(errText);
              const retryAfterMs = parsedErr?.extra_fields?.retry_after_ms;
              if (typeof retryAfterMs === 'number' && retryAfterMs > 0) {
                backoffMs = Math.min(retryAfterMs + 1000, 15000);
              }
            } catch {
              backoffMs = 5000;
            }
          }
          console.warn(`[Bifrost] Received HTTP ${res.status} (model high demand / capacity spike). Retrying in ${backoffMs}ms (attempt ${attempt + 1}/${maxRetries})...`);
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
          continue;
        }
        throw new BifrostError(res.status, errText, `Bifrost HTTP ${res.status}: ${errText}`);
      }

      const data = await res.json();
      return data.choices[0]?.message?.content ?? '';
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries && error instanceof Error && (error.name === 'AbortError' || error.message.includes('fetch failed'))) {
        const backoffMs = (attempt + 1) * 1500;
        console.warn(`[Bifrost] Request timed out or network error. Retrying in ${backoffMs}ms (attempt ${attempt + 1}/${maxRetries})...`);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
        continue;
      }
      break;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  const fallbackModel = getModelProfile('fallback');
  if (options.enableFallback && modelToUse !== fallbackModel) {
    console.warn(`[Bifrost] Primary model ${modelToUse} failed. Trying Bifrost fallback to ${fallbackModel}...`);
    try {
      return await bifrostChat({
        ...options,
        model: fallbackModel,
        enableFallback: false,
      });
    } catch (fbErr) {
      console.warn(`[Bifrost] Bifrost fallback model ${fallbackModel} also failed:`, fbErr);
    }
  }

  // Direct Google Gemini fallback if configured in environment
  const geminiFallbackKey = (
    process.env.GEMINI_FALLBACK ||
    process.env['GEMINI_FALLBACK '] ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    ''
  )
    .trim()
    .replace(/^["']|["']$/g, '');

  if (geminiFallbackKey) {
    console.warn('[Bifrost] Gateway unavailable or failed. Engaging direct Google Gemini fallback API...');
    try {
      const directResult = await callDirectGemini(options, geminiFallbackKey);
      if (directResult && directResult.trim().length > 0) {
        return directResult;
      }
    } catch (geminiError) {
      console.error('[Gemini Direct Fallback Error]', geminiError);
    }
  }

  throw lastError;
}

/**
 * Direct Google Gemini API caller for zero-downtime gateway fallback.
 */
async function callDirectGemini(options: BifrostChatOptions, apiKey: string): Promise<string> {
  const model = process.env.GEMINI_FALLBACK_MODEL || 'gemini-2.5-flash';
  const controller = new AbortController();
  const timeoutMs = Math.max(options.timeoutMs ?? 30000, 15000);
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const systemMessages = options.messages.filter((m) => m.role === 'system');
    const systemInstruction =
      systemMessages.length > 0
        ? { parts: [{ text: systemMessages.map((m) => m.content).join('\n\n') }] }
        : undefined;

    const nonSystemMessages = options.messages.filter((m) => m.role !== 'system');
    const contents =
      nonSystemMessages.length > 0
        ? nonSystemMessages.map((m) => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }],
          }))
        : [{ role: 'user', parts: [{ text: 'Begin' }] }];

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        ...(systemInstruction ? { systemInstruction } : {}),
        generationConfig: {
          temperature: options.temperature ?? 0,
          ...(options.response_format?.type === 'json_object'
            ? { responseMimeType: 'application/json' }
            : {}),
        },
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Direct Gemini API HTTP ${res.status}: ${errText}`);
    }

    const data = await res.json();
    const candidate = data.candidates?.[0];
    const text = candidate?.content?.parts?.[0]?.text;
    if (typeof text === 'string') {
      return text;
    }
    return '';
  } finally {
    clearTimeout(timeoutId);
  }
}