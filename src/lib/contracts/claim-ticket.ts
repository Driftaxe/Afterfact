import { z } from 'zod';
import { AtomicClaimSpec, ClaimSpanSchema, TimeSensitivity } from './claim';
import { isValidCalendarDate, isValidCalendarDateOrPartial, isValidIsoTimestamp } from './dates';

/**
 * Permitted primitive property types for verification context.
 */
export const PropertyTypeSchema = z.enum([
  'string',
  'number',
  'boolean',
  'date',
  'selection',
  'string_list',
]);
export type PropertyType = z.infer<typeof PropertyTypeSchema>;

/**
 * Mutually exclusive origin categories for context properties.
 */
export const PropertyOriginSchema = z.enum([
  'explicit_claim_text', // Extracted directly from input text (must have sourceSpan)
  'user_target_context', // Supplied or overridden by user
  'model_inferred',      // Suggested by model during preparation
  'unknown',             // Material qualifier currently undetermined
]);
export type PropertyOrigin = z.infer<typeof PropertyOriginSchema>;

/**
 * Operational lifecycle states for context properties.
 */
export const PropertyStatusSchema = z.enum([
  'confirmed',            // Verified by user or locked by explicit claim text
  'pending_review',       // Suggested by extraction pass, awaits user confirmation
  'clarification_needed', // Ambiguity discovered that materially impacts verdict
  'system_default',       // Inferred from global run configuration
]);
export type PropertyStatus = z.infer<typeof PropertyStatusSchema>;

/**
 * Scope boundaries for context properties.
 */
export const PropertyApplicabilitySchema = z.enum([
  'claim_level', // Governs this specific claim ticket only
  'run_level',   // Inherited across all claims in the parent run
]);
export type PropertyApplicability = z.infer<typeof PropertyApplicabilitySchema>;

/**
 * Raw value union for a verification property.
 */
export const PropertyValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.string()),
  z.null(),
]);
export type PropertyValue = z.infer<typeof PropertyValueSchema>;

/**
 * Strongly typed context property governing claim validity conditions.
 */
export const VerificationPropertySchema = z
  .object({
    key: z.string().min(1, { message: 'Property key is required' }),
    label: z.string().min(1, { message: 'Property label is required' }),
    propertyType: PropertyTypeSchema,
    value: PropertyValueSchema,
    units: z.string().nullable().optional(),
    origin: PropertyOriginSchema,
    sourceSpan: ClaimSpanSchema.nullable().optional(),
    status: PropertyStatusSchema,
    applicability: PropertyApplicabilitySchema,
    confidence: z.number().min(0).max(1).nullable().optional(),
  })
  .superRefine((prop, ctx) => {
    // 1. Provenance invariant: origin 'unknown' must have value null
    if (prop.origin === 'unknown' && prop.value !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['value'],
        message: "Property with origin 'unknown' must have value null",
      });
    }

    // 2. Explicit origin invariant: explicit_claim_text must have a valid sourceSpan
    if (prop.origin === 'explicit_claim_text' && !prop.sourceSpan) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['sourceSpan'],
        message: "Property with origin 'explicit_claim_text' requires a valid sourceSpan",
      });
    }

    // 3. Type-value agreement invariants when value is not null
    if (prop.value !== null) {
      switch (prop.propertyType) {
        case 'string':
          if (typeof prop.value !== 'string') {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['value'],
              message: `Property declared as 'string' but received ${typeof prop.value}`,
            });
          }
          break;
        case 'number':
          if (typeof prop.value !== 'number' || !Number.isFinite(prop.value)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['value'],
              message: `Property declared as 'number' but received non-finite number or invalid type`,
            });
          }
          break;
        case 'boolean':
          if (typeof prop.value !== 'boolean') {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['value'],
              message: `Property declared as 'boolean' but received ${typeof prop.value}`,
            });
          }
          break;
        case 'date':
          if (
            typeof prop.value !== 'string' ||
            (!isValidCalendarDateOrPartial(prop.value) && !isValidIsoTimestamp(prop.value))
          ) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['value'],
              message: `Property declared as 'date' requires valid calendar date (YYYY, YYYY-MM, YYYY-MM-DD) or ISO timestamp`,
            });
          }
          break;
        case 'selection':
          if (typeof prop.value !== 'string') {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['value'],
              message: `Property declared as 'selection' requires string value`,
            });
          }
          break;
        case 'string_list':
          if (!Array.isArray(prop.value) || prop.value.some((x) => typeof x !== 'string')) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['value'],
              message: `Property declared as 'string_list' requires an array of strings`,
            });
          }
          break;
      }
    }
  });

export type VerificationProperty = z.infer<typeof VerificationPropertySchema>;

/**
 * Universal Claim Ticket Schema.
 * Represents an atomic factual proposition carrying variable, typed context properties.
 */
export const ClaimTicketSchema = z.object({
  ticketId: z.string().min(1, { message: 'Ticket ID is required' }),
  claimId: z.string().min(1, { message: 'Claim ID is required' }),
  runId: z.string().min(1, { message: 'Run ID is required' }),
  inputHash: z.string().min(1, { message: 'Input hash is required' }),
  revision: z.number().int().min(1, { message: 'Revision must be an integer >= 1' }),
  originalStatement: z.string().min(1, { message: 'Original statement cannot be empty' }),
  sourceSpan: ClaimSpanSchema.nullable().optional(),
  normalizedProposition: z.string().min(1, { message: 'Normalized proposition cannot be empty' }),
  domain: z.string().optional().default('generic'),
  targetTime: z
    .string()
    .refine((v) => isValidCalendarDate(v) || isValidIsoTimestamp(v), {
      message: 'targetTime must be a valid calendar date (YYYY-MM-DD) or ISO timestamp',
    }),
  verificationContext: z.array(VerificationPropertySchema).default([]),
  searchContext: z.record(z.string(), PropertyValueSchema).nullable().optional(),
  missingMaterialContext: z.array(z.string()).default([]),
});

export type ClaimTicket = z.infer<typeof ClaimTicketSchema>;

/**
 * Scope Precedence Invariant:
 * Explicit Claim Qualifier > User Target Context > Model Suggestion > Default.
 * Resolves the effective context by prioritizing explicit qualifiers permanently over user target context.
 */
export function resolveEffectiveContext(
  explicitQualifiers: VerificationProperty[],
  userTargetContext: VerificationProperty[]
): VerificationProperty[] {
  const resolved = new Map<string, VerificationProperty>();

  // 1. Explicit qualifiers take absolute precedence
  for (const prop of explicitQualifiers) {
    if (prop.origin === 'explicit_claim_text') {
      resolved.set(prop.key, prop);
    }
  }

  // 2. User target context fills in qualifiers not explicitly fixed by claim text
  for (const prop of userTargetContext) {
    if (!resolved.has(prop.key)) {
      resolved.set(prop.key, prop);
    }
  }

  return Array.from(resolved.values());
}

/**
 * Helper to get a specific property by key from a ClaimTicket.
 */
export function getContextProperty(
  ticket: ClaimTicket,
  key: string
): VerificationProperty | undefined {
  return ticket.verificationContext.find((p) => p.key === key);
}

/**
 * Explicit conversion from foundational AtomicClaimSpec to stateful ClaimTicket.
 * Establishes an unambiguous consumer path without duplicate or conflicting definitions.
 */
export function createClaimTicketFromSpec(
  spec: AtomicClaimSpec,
  options: {
    runId: string;
    inputHash: string;
    targetTime: string;
    revision?: number;
    domain?: string;
  }
): ClaimTicket {
  const revision = options.revision ?? 1;
  const verificationContext: VerificationProperty[] = [];

  // Convert explicit qualifiers from sourceScope into VerificationProperties
  if (spec.sourceScope) {
    for (const [key, value] of Object.entries(spec.sourceScope)) {
      if (value !== undefined && value !== null) {
        verificationContext.push({
          key,
          label: key,
          propertyType: 'string',
          value,
          origin: 'explicit_claim_text',
          sourceSpan: spec.span ?? undefined,
          status: 'confirmed',
          applicability: 'claim_level',
        });
      }
    }
  }

  const normalizedProposition = `${spec.entity} ${spec.attribute} is ${spec.assertedValue}.`;

  return ClaimTicketSchema.parse({
    ticketId: `tkt_${spec.id}_r${revision}`,
    claimId: spec.id,
    runId: options.runId,
    inputHash: options.inputHash,
    revision,
    originalStatement: spec.rawText,
    sourceSpan: spec.span ?? null,
    normalizedProposition,
    domain: options.domain ?? 'generic',
    targetTime: options.targetTime,
    verificationContext,
    missingMaterialContext: [],
  });
}

/**
 * Explicit conversion from ClaimTicket back to AtomicClaimSpec for triple-oriented verifier components.
 */
export function toAtomicClaimSpec(
  ticket: ClaimTicket,
  extractionDetails?: {
    entity?: string;
    attribute?: string;
    assertedValue?: string;
    timeSensitivity?: TimeSensitivity;
    ordinal?: number;
  }
): AtomicClaimSpec {
  const sourceScope: Record<string, string> = {};
  for (const prop of ticket.verificationContext) {
    if (prop.origin === 'explicit_claim_text' && typeof prop.value === 'string') {
      sourceScope[prop.key] = prop.value;
    }
  }

  return {
    id: ticket.claimId,
    ordinal: extractionDetails?.ordinal,
    rawText: ticket.originalStatement,
    entity: extractionDetails?.entity ?? 'UnknownEntity',
    attribute: extractionDetails?.attribute ?? 'UnknownAttribute',
    assertedValue: extractionDetails?.assertedValue ?? ticket.normalizedProposition,
    timeSensitivity: extractionDetails?.timeSensitivity ?? 'medium',
    sourceScope: Object.keys(sourceScope).length > 0 ? sourceScope : null,
    span: ticket.sourceSpan ?? null,
  };
}
