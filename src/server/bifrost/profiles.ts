// src/server/bifrost/profiles.ts
export type ModelProfileRole = 'extract' | 'assess' | 'draft' | 'fallback';

export interface ModelProfileConfig {
  extract: string;
  assess: string;
  draft: string;
  fallback: string;
}

export const DEFAULT_PROFILES = {
  extract: 'gemini-3.5-flash-lite',
  assess: 'gemini-3.5-flash-lite',
  draft: 'gemini-3.5-flash-lite',
  fallback: 'gemini-3.5-flash-lite',
} as const;

export function getModelProfile(role: ModelProfileRole): string {
  switch (role) {
    case 'extract':
      return process.env.BIFROST_EXTRACT_MODEL || DEFAULT_PROFILES.extract;
    case 'assess':
      return process.env.BIFROST_ASSESS_MODEL || DEFAULT_PROFILES.assess;
    case 'draft':
      return process.env.BIFROST_DRAFT_MODEL || DEFAULT_PROFILES.draft;
    case 'fallback':
      return process.env.BIFROST_ASSESS_FALLFALLBACK || DEFAULT_PROFILES.fallback;
    default: {
      const _exhaustive: never = role;
      throw new Error(`Unknown model profile role: ${_exhaustive}`);
    }
  }
}

export function getAllModelProfiles(): ModelProfileConfig {
  return {
    extract: getModelProfile('extract'),
    assess: getModelProfile('assess'),
    draft: getModelProfile('draft'),
    fallback: getModelProfile('fallback'),
  };
}