import {
  ExtractClaimsInput,
  ExtractClaimsInputSchema,
  ExtractClaimsOutcome,
  ExtractClaimsOutcomeSchema,
  RawExtractionResponse,
  RawExtractionResponseSchema,
} from '@/lib/contracts/extraction';
import {
  ClaimTicket,
  ClaimTicketSchema,
  resolveEffectiveContext,
  VerificationProperty,
  VerificationPropertySchema,
} from '@/lib/contracts/claim-ticket';
import { validateClaimSpan } from '@/lib/contracts/claim';
import { isValidCalendarDate, isValidIsoTimestamp } from '@/lib/contracts/dates';
import { bifrostChat, BifrostError } from '@/server/bifrost/client';
import { getModelProfile } from '@/server/bifrost/profiles';
import { buildExtractionMessages } from '@/server/prompts/extract';

// Import modular domain helpers
import { computeInputHash, generateClaimIdentity } from './identity';
import { resolveClaimSpan, resolveQualifierSpan } from './span-resolver';
import { convertUserTargetContext, normalizePropertyValue } from './context-resolver';

// Re-export modular helpers for full backward compatibility
export { computeInputHash, generateClaimIdentity } from './identity';
export {
  isSplittingSurrogate,
  findAllOccurrences,
  resolveClaimSpan,
  resolveQualifierSpan,
} from './span-resolver';
export { convertUserTargetContext, normalizePropertyValue } from './context-resolver';

/**
 * Primary Extraction Service for Ticket A03.
 *
 * Decomposes input text into atomic ClaimTicket records with typed context properties,
 * exact UTF-16 character offsets, and strict scope precedence enforcement.
 */
export async function extractClaimsFromText(
  rawInput: ExtractClaimsInput
): Promise<ExtractClaimsOutcome> {
  // 1. Validate input boundary
  const parsedInput = ExtractClaimsInputSchema.safeParse(rawInput);
  if (!parsedInput.success) {
    const firstIssue = parsedInput.error.issues[0]?.message;
    return {
      status: 'failed',
      tickets: [],
      error: {
        code: 'INVALID_INPUT',
        message: firstIssue || 'Invalid input: answer text or execution parameters failed validation',
        retryable: false,
      },
    };
  }

  const input = parsedInput.data;
  const computedHash = computeInputHash(input.text);

  // Validate caller-supplied inputHash if provided
  if (input.inputHash && input.inputHash !== computedHash) {
    return {
      status: 'failed',
      tickets: [],
      inputHash: computedHash,
      error: {
        code: 'INVALID_INPUT',
        message: 'Provided inputHash does not match computed SHA-256 hash of answer text',
        retryable: false,
      },
    };
  }

  // Resolve target evaluation time (defaults once per invocation to current date)
  let resolvedTargetTime: string;
  if (input.targetTime) {
    if (!isValidCalendarDate(input.targetTime) && !isValidIsoTimestamp(input.targetTime)) {
      return {
        status: 'failed',
        tickets: [],
        inputHash: computedHash,
        error: {
          code: 'INVALID_INPUT',
          message: 'Invalid targetTime format: must be valid calendar date or ISO timestamp',
          retryable: false,
        },
      };
    }
    resolvedTargetTime = input.targetTime;
  } else if (input.contextOverrides?.targetDate) {
    resolvedTargetTime = input.contextOverrides.targetDate;
  } else {
    resolvedTargetTime = new Date().toISOString().slice(0, 10);
  }

  // 2. Invoke Bifrost Model Gateway
  let rawResponse: string;
  try {
    const messages = buildExtractionMessages(input.text, input.contextOverrides);
    rawResponse = await bifrostChat({
      role: 'extract',
      model: input.model ?? getModelProfile('extract'),
      messages,
      response_format: { type: 'json_object' },
      enableFallback: input.enableFallback ?? true,
      timeoutMs: 30000,
    });
  } catch (error) {
    if (error instanceof BifrostError) {
      const isRetryable = error.statusCode >= 500;
      return {
        status: 'failed',
        tickets: [],
        inputHash: computedHash,
        error: {
          code: 'PROVIDER_ERROR',
          message: `Model provider returned error HTTP ${error.statusCode}`,
          retryable: isRetryable,
        },
      };
    }

    if (error instanceof Error && (error.name === 'AbortError' || error.message.includes('timeout'))) {
      return {
        status: 'failed',
        tickets: [],
        inputHash: computedHash,
        error: {
          code: 'TIMEOUT',
          message: 'Model extraction request timed out',
          retryable: true,
        },
      };
    }

    return {
      status: 'failed',
      tickets: [],
      inputHash: computedHash,
      error: {
        code: 'PROVIDER_ERROR',
        message: 'Failed to communicate with model gateway',
        retryable: true,
      },
    };
  }

  // 3. Decode and validate model JSON output
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawResponse);
  } catch {
    return {
      status: 'failed',
      tickets: [],
      inputHash: computedHash,
      error: {
        code: 'MALFORMED_OUTPUT',
        message: 'Model returned malformed JSON output',
        retryable: false,
      },
    };
  }

  const validatedResponse = RawExtractionResponseSchema.safeParse(parsedJson);
  if (!validatedResponse.success) {
    return {
      status: 'failed',
      tickets: [],
      inputHash: computedHash,
      error: {
        code: 'SCHEMA_VIOLATION',
        message: 'Model response violated extraction schema structure',
        retryable: false,
      },
    };
  }

  const modelOutput: RawExtractionResponse = validatedResponse.data;

  // Check for model refusal
  if (modelOutput.refusal) {
    return {
      status: 'failed',
      tickets: [],
      inputHash: computedHash,
      error: {
        code: 'PROVIDER_REFUSAL',
        message: 'Model provider refused extraction request',
        retryable: false,
      },
    };
  }

  // 4. Handle valid empty extraction (zero verifiable claims)
  if (modelOutput.claims.length === 0) {
    const outcome: ExtractClaimsOutcome = {
      status: 'no_claims',
      tickets: [],
      inputHash: computedHash,
      reason: 'Input text contains no verifiable factual propositions',
    };
    return ExtractClaimsOutcomeSchema.parse(outcome);
  }

  // 5. Ground claims, resolve spans, and enforce scope precedence
  const userTargetProperties = convertUserTargetContext(input.contextOverrides);
  const tickets: ClaimTicket[] = [];

  for (let i = 0; i < modelOutput.claims.length; i++) {
    const claim = modelOutput.claims[i];

    // Resolve claim statement span
    let sourceSpan: { start: number; end: number } | null = null;
    try {
      sourceSpan = resolveClaimSpan(input.text, claim);
    } catch {
      return {
        status: 'failed',
        tickets: [],
        inputHash: computedHash,
        error: {
          code: 'GROUNDING_FAILURE',
          message: 'Claim statement could not be grounded in source text',
          retryable: false,
        },
      };
    }

    // Double check span fidelity with canonical validator
    const spanValidation = validateClaimSpan(input.text, sourceSpan, claim.statement);
    if (!spanValidation.valid) {
      return {
        status: 'failed',
        tickets: [],
        inputHash: computedHash,
        error: {
          code: 'GROUNDING_FAILURE',
          message: 'Extracted claim character span does not match source text slice',
          retryable: false,
        },
      };
    }

    // Resolve explicit qualifiers
    const explicitQualifiers: VerificationProperty[] = [];
    for (const q of claim.explicitQualifiers) {
      let qSpan: { start: number; end: number };
      try {
        qSpan = resolveQualifierSpan(input.text, q.exactExcerpt, sourceSpan);
      } catch {
        return {
          status: 'failed',
          tickets: [],
          inputHash: computedHash,
          error: {
            code: 'GROUNDING_FAILURE',
            message: 'Explicit qualifier excerpt not found in source text',
            retryable: false,
          },
        };
      }

      const propParsed = VerificationPropertySchema.safeParse({
        key: q.key,
        label: q.label,
        propertyType: q.propertyType,
        value: normalizePropertyValue(q.propertyType, q.value),
        units: q.units ?? null,
        origin: 'explicit_claim_text',
        sourceSpan: qSpan,
        status: 'confirmed',
        applicability: 'claim_level',
      });

      if (!propParsed.success) {
        return {
          status: 'failed',
          tickets: [],
          inputHash: computedHash,
          error: {
            code: 'SCHEMA_VIOLATION',
            message: 'Extracted explicit qualifier failed property schema validation',
            retryable: false,
          },
        };
      }

      explicitQualifiers.push(propParsed.data);
    }

    // Resolve inferred qualifiers
    const inferredQualifiers: VerificationProperty[] = [];
    for (const inf of claim.inferredQualifiers) {
      const propParsed = VerificationPropertySchema.safeParse({
        key: inf.key,
        label: inf.label,
        propertyType: inf.propertyType,
        value: normalizePropertyValue(inf.propertyType, inf.value),
        origin: 'model_inferred',
        sourceSpan: null,
        status: 'pending_review',
        applicability: 'claim_level',
        confidence: inf.confidence ?? null,
      });

      if (!propParsed.success) {
        return {
          status: 'failed',
          tickets: [],
          inputHash: computedHash,
          error: {
            code: 'SCHEMA_VIOLATION',
            message: 'Extracted inferred qualifier failed property schema validation',
            retryable: false,
          },
        };
      }

      inferredQualifiers.push(propParsed.data);
    }

    // Enforce Scope Precedence:
    // Explicit Qualifiers > User Target Context > Model Inferred
    const effectiveContext = resolveEffectiveContext(explicitQualifiers, userTargetProperties);

    // Append remaining non-conflicting inferred qualifiers
    const effectiveKeys = new Set(effectiveContext.map((p) => p.key));
    for (const inf of inferredQualifiers) {
      if (!effectiveKeys.has(inf.key)) {
        effectiveContext.push(inf);
        effectiveKeys.add(inf.key);
      }
    }

    // Reconcile missing material context keys:
    // Remove any qualifier that is now known from explicit text or confirmed user context
    const missingKeys = claim.missingMaterialQualifiers.filter((k) => {
      const matched = effectiveContext.find((p) => p.key === k);
      return !matched || matched.origin === 'model_inferred' || matched.origin === 'unknown' || matched.value === null;
    });

    // Incorporate trusted execution identity (runId/prepId), candidate ordinal, and statement hash
    const { claimId, ticketId } = generateClaimIdentity({
      runId: input.runId,
      ordinal: i,
      statement: claim.statement,
      revision: input.revision,
    });

    // Assemble and validate canonical ClaimTicket
    const ticketParsed = ClaimTicketSchema.safeParse({
      ticketId,
      claimId,
      runId: input.runId,
      inputHash: computedHash,
      revision: input.revision,
      originalStatement: claim.statement,
      sourceSpan,
      normalizedProposition: claim.normalizedProposition,
      domain: claim.domain ?? 'generic',
      targetTime: resolvedTargetTime,
      verificationContext: effectiveContext,
      missingMaterialContext: missingKeys,
    });

    if (!ticketParsed.success) {
      return {
        status: 'failed',
        tickets: [],
        inputHash: computedHash,
        error: {
          code: 'SCHEMA_VIOLATION',
          message: 'Assembled ClaimTicket failed canonical schema validation',
          retryable: false,
        },
      };
    }

    tickets.push(ticketParsed.data);
  }

  // 6. Return successful validated extraction outcome
  const outcome: ExtractClaimsOutcome = {
    status: 'success',
    tickets,
    inputHash: computedHash,
    rawCount: tickets.length,
  };

  return ExtractClaimsOutcomeSchema.parse(outcome);
}
