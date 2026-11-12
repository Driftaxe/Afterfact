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

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs ?? 30000);

  try {
    const res = await fetch(`${baseUrl}/v1/chat/completions`, {
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
      throw new BifrostError(res.status, errText, `Bifrost HTTP ${res.status}: ${errText}`);
    }

    const data = await res.json();
    return data.choices[0]?.message?.content ?? '';
  } catch (error) {
    const fallbackModel = getModelProfile('fallback');
    if (options.enableFallback && modelToUse !== fallbackModel) {
      console.warn(`[Bifrost] Primary model ${modelToUse} failed. Falling back to ${fallbackModel}...`);
      
      return bifrostChat({
        ...options,
        model: fallbackModel,
        enableFallback: false,
      });
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}