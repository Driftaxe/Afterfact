import type { SharedContext } from '@/lib/contracts/request';
import type { PropertyType, VerificationProperty } from '@/lib/contracts/claim-ticket';

/**
 * Converts user-supplied target context into VerificationProperty items.
 */
export function convertUserTargetContext(contextOverrides?: SharedContext | null): VerificationProperty[] {
  if (!contextOverrides) return [];
  const properties: VerificationProperty[] = [];

  if (contextOverrides.jurisdiction) {
    properties.push({
      key: 'jurisdiction',
      label: 'Geographic Jurisdiction',
      propertyType: 'string',
      value: contextOverrides.jurisdiction,
      origin: 'user_target_context',
      status: 'confirmed',
      applicability: 'run_level',
    });
  }

  if (contextOverrides.region) {
    properties.push({
      key: 'region',
      label: 'Geographic Region',
      propertyType: 'string',
      value: contextOverrides.region,
      origin: 'user_target_context',
      status: 'confirmed',
      applicability: 'run_level',
    });
  }

  if (contextOverrides.currency) {
    properties.push({
      key: 'currency',
      label: 'Currency',
      propertyType: 'string',
      value: contextOverrides.currency,
      origin: 'user_target_context',
      status: 'confirmed',
      applicability: 'run_level',
    });
  }

  if (contextOverrides.version) {
    properties.push({
      key: 'version',
      label: 'Version or Release',
      propertyType: 'string',
      value: contextOverrides.version,
      origin: 'user_target_context',
      status: 'confirmed',
      applicability: 'run_level',
    });
  }

  if (contextOverrides.billingTerm) {
    properties.push({
      key: 'billingTerm',
      label: 'Billing Commitment',
      propertyType: 'string',
      value: contextOverrides.billingTerm,
      origin: 'user_target_context',
      status: 'confirmed',
      applicability: 'run_level',
    });
  }

  return properties;
}

/**
 * Normalizes property values according to their declared property type.
 * Trims whitespace for strings and dates.
 * Preserves exact calendar date and partial date precision without artificial day/month padding.
 */
export function normalizePropertyValue(type: PropertyType, val: unknown): unknown {
  if (type === 'date' && typeof val === 'string') {
    return val.trim();
  }
  return val;
}
