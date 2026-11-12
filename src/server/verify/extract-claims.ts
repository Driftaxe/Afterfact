import { createHash } from 'node:crypto';
import {
  ExtractClaimsInput,
  ExtractClaimsInputSchema,
  ExtractClaimsOutcome,
  ExtractClaimsOutcomeSchema,
  RawExtractedClaim,
  RawExtractionResponse,
  RawExtractionResponseSchema,
} from '@/lib/contracts/extraction';
import {
  ClaimTicket,
  ClaimTicketSchema,
  PropertyType,
  resolveEffectiveContext,
  VerificationProperty,
  VerificationPropertySchema,
} from '@/lib/contracts/claim-ticket';
import { validateClaimSpan } from '@/lib/contracts/claim';
import { isValidCalendarDate, isValidIsoTimestamp } from '@/lib/contracts/dates';
import { bifrostChat, BifrostError } from '@/server/bifrost/client';
import { getModelProfile } from '@/server/bifrost/profiles';
import { buildExtractionMessages } from '@/server/prompts/extract';
import type { SharedContext } from '@/lib/contracts/request';

/**
 * Computes deterministic SHA-256 hash of exact source text.
 */
export function computeInputHash(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/**
 * Checks whether an index in a UTF-16 string splits a surrogate pair.
 */
export function isSplittingSurrogate(str: string, index: number): boolean {
  if (index <= 0 || index >= str.length) return false;
  const prev = str.charCodeAt(index - 1);
  const curr = str.charCodeAt(index);
  return prev >= 0xd800 && prev <= 0xdbff && curr >= 0xdc00 && curr <= 0xdfff;
}

/**
 * Finds all exact 0-based UTF-16 character indices of a substring in source text.
 */
function findAllOccurrences(source: string, sub: string): number[] {
  const indices: number[] = [];
  if (!sub || !source) return indices;
  let idx = 0;
  while (idx < source.length) {
    const found = source.indexOf(sub, idx);
    if (found === -1) break;
    indices.push(found);
    idx = found + 1;
  }
  return indices;
}

/**
 * Resolves the character span for a claim statement in the unmodified source text.
 * Returns null if the excerpt is present but its specific occurrence is ambiguous.
 * Throws an Error with code 'GROUNDING_FAILURE' if the statement is absent.
 */
function resolveClaimSpan(
  sourceText: string,
  claim: RawExtractedClaim
): { start: number; end: number } | null {
  const statement = claim.statement;
  const occurrences = findAllOccurrences(sourceText, statement);

  if (occurrences.length === 0) {
    throw new Error('GROUNDING_FAILURE: Claim statement not found in source text');
  }

  // Single unique occurrence: direct grounding
  if (occurrences.length === 1) {
    const start = occurrences[0];
    const end = start + statement.length;
    if (isSplittingSurrogate(sourceText, start) || isSplittingSurrogate(sourceText, end)) {
      throw new Error('GROUNDING_FAILURE: Span splits a Unicode surrogate pair');
    }
    return { start, end };
  }

  // Multiple occurrences: attempt disambiguation using locationHint
  const hint = claim.locationHint;
  if (hint) {
    // 1. Candidate span check
    if (hint.candidateSpan) {
      const { start, end } = hint.candidateSpan;
      if (
        start >= 0 &&
        end <= sourceText.length &&
        start < end &&
        sourceText.slice(start, end) === statement &&
        !isSplittingSurrogate(sourceText, start) &&
        !isSplittingSurrogate(sourceText, end)
      ) {
        return { start, end };
      }
    }

    // 2. Occurrence index check
    if (hint.occurrence !== undefined && hint.occurrence >= 0 && hint.occurrence < occurrences.length) {
      const start = occurrences[hint.occurrence];
      const end = start + statement.length;
      if (!isSplittingSurrogate(sourceText, start) && !isSplittingSurrogate(sourceText, end)) {
        return { start, end };
      }
    }

    // 3. Prefix/suffix anchoring
    if (hint.prefix || hint.suffix) {
      const matchingIndices = occurrences.filter((idx) => {
        let matches = true;
        if (hint.prefix) {
          const expectedPrefixStart = idx - hint.prefix.length;
          if (expectedPrefixStart < 0 || sourceText.slice(expectedPrefixStart, idx) !== hint.prefix) {
            matches = false;
          }
        }
        if (hint.suffix) {
          const expectedSuffixStart = idx + statement.length;
          const expectedSuffixEnd = expectedSuffixStart + hint.suffix.length;
          if (
            expectedSuffixEnd > sourceText.length ||
            sourceText.slice(expectedSuffixStart, expectedSuffixEnd) !== hint.suffix
          ) {
            matches = false;
          }
        }
        return matches;
      });

      if (matchingIndices.length === 1) {
        const start = matchingIndices[0];
        const end = start + statement.length;
        if (!isSplittingSurrogate(sourceText, start) && !isSplittingSurrogate(sourceText, end)) {
          return { start, end };
        }
      }
    }
  }

  // Ambiguous occurrence with no conclusive disambiguation:
  // Preserved as an unhighlighted claim (sourceSpan: null) per canonical specification.
  return null;
}

/**
 * Resolves the character span for an explicit qualifier.
 * Checks within the claim's statement bounds first, then in the surrounding source text.
 */
function resolveQualifierSpan(
  sourceText: string,
  exactExcerpt: string,
  claimSpan: { start: number; end: number } | null
): { start: number; end: number } {
  // If claim has an established span, try to locate excerpt within that statement first
  if (claimSpan) {
    const claimSubstring = sourceText.slice(claimSpan.start, claimSpan.end);
    const relIdx = claimSubstring.indexOf(exactExcerpt);
    if (relIdx !== -1) {
      const start = claimSpan.start + relIdx;
      const end = start + exactExcerpt.length;
      if (!isSplittingSurrogate(sourceText, start) && !isSplittingSurrogate(sourceText, end)) {
        return { start, end };
      }
    }
  }

  // Otherwise, locate in the broader source text (e.g. shared sentence qualifier)
  const occurrences = findAllOccurrences(sourceText, exactExcerpt);
  if (occurrences.length === 0) {
    throw new Error('GROUNDING_FAILURE: Explicit qualifier excerpt not found in source text');
  }

  // If claim span exists, choose the occurrence closest to the claim span
  let chosenIdx = occurrences[0];
  if (claimSpan && occurrences.length > 1) {
    let minDistance = Infinity;
    for (const idx of occurrences) {
      const dist = Math.abs(idx - claimSpan.start);
      if (dist < minDistance) {
        minDistance = dist;
        chosenIdx = idx;
      }
    }
  }

  const start = chosenIdx;
  const end = start + exactExcerpt.length;
  if (isSplittingSurrogate(sourceText, start) || isSplittingSurrogate(sourceText, end)) {
    throw new Error('GROUNDING_FAILURE: Qualifier span splits a Unicode surrogate pair');
  }

  return { start, end };
}

/**
 * Converts user-supplied target context into VerificationProperty items.
 */
function convertUserTargetContext(contextOverrides: SharedContext): VerificationProperty[] {
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
 * Helper to normalize partial dates (e.g. "YYYY-MM" or "YYYY") into complete ISO calendar dates.
 */
function normalizePropertyValue(type: PropertyType, val: unknown): unknown {
  if (type === 'date' && typeof val === 'string') {
    const trimmed = val.trim();
    if (/^\d{4}-\d{2}$/.test(trimmed)) {
      return `${trimmed}-01`;
    }
    if (/^\d{4}$/.test(trimmed)) {
      return `${trimmed}-01-01`;
    }
  }
  return val;
}

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

    // Incorporate trusted execution identity (runId/prepId), candidate ordinal, and statement hash.
    // Length: "clm_" (4) + execHash (8) + "_" (1) + ordinal (1..3) + "_" (1) + stmtHash (8) <= 25 chars (fits VARCHAR(36)).
    // Deterministic within the same execution and revision; differentiated across distinct executions.
    const execHash = createHash('sha256').update(input.runId, 'utf8').digest('hex').slice(0, 8);
    const stmtHash = createHash('sha256').update(claim.statement, 'utf8').digest('hex').slice(0, 8);
    const claimId = `clm_${execHash}_${i}_${stmtHash}`;
    const ticketId = `tkt_${claimId}_r${input.revision}`;

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
