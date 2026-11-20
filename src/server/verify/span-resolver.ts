import type { RawExtractedClaim } from '@/lib/contracts/extraction';

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
export function findAllOccurrences(source: string, sub: string): number[] {
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
 * Throws an Error with code 'GROUNDING_FAILURE' if the statement is absent or splits surrogates.
 */
export function resolveClaimSpan(
  sourceText: string,
  claim: RawExtractedClaim
): { start: number; end: number } | null {
  const statement = claim.statement;
  const occurrences = findAllOccurrences(sourceText, statement);

  if (occurrences.length === 0) {
    // Bounded Recovery: If the model reconstructed an elided statement or resolved a pronoun
    // (e.g. statement = "Example Labs released Willow on 10 November 2026" when source says ", Willow on 10 November 2026",
    // or statement = "Birch general availability starts..." when source says "its general availability starts..."),
    // find if a unique substantive tail/subphrase from statement exists in sourceText.
    let recovered: { start: number; end: number; exactText: string } | null = null;

    const NEGATION_REGEX = /\b(not|never|cannot|can't|won't|doesn't|didn't|isn't|aren't|no|neither|nor|without)\b/i;
    const stmtHasNegation =
      NEGATION_REGEX.test(statement) ||
      (typeof (claim as { normalizedProposition?: unknown }).normalizedProposition === 'string' &&
        NEGATION_REGEX.test((claim as { normalizedProposition: string }).normalizedProposition));

    // Bare date or prepositional fragment filter: whole assertions cannot ground on bare fragments
    const isBareFragment = (text: string): boolean => {
      const trimmed = text.trim();
      const words = trimmed.split(/\s+/);
      if (words.length <= 2) return true;
      if (/^(?:on|in|at|by|from|to|for|during)\s+[\w\s\d,-]+$/i.test(trimmed)) {
        // If it only contains preposition + date/time or bare name without a verb, reject
        const hasVerb = /\b(released|announced|cost|costs|is|are|was|were|has|have|had|started|starts|deprecated|requires|enforces|limits|pays|charges|applied)\b/i.test(trimmed);
        return !hasVerb;
      }
      return false;
    };

    // Strategy A: Check explicit qualifier excerpts
    for (const q of claim.explicitQualifiers || []) {
      if (q.exactExcerpt && sourceText.includes(q.exactExcerpt)) {
        const qIdxInStmt = statement.indexOf(q.exactExcerpt);
        if (qIdxInStmt >= 0) {
          const candidateTail = statement.slice(qIdxInStmt).trim();
          if (candidateTail.length > 8 && !isBareFragment(candidateTail)) {
            // Guard: Cannot drop negation
            if (!stmtHasNegation || NEGATION_REGEX.test(candidateTail)) {
              const tailOccurrences = findAllOccurrences(sourceText, candidateTail);
              if (tailOccurrences.length === 1) {
                recovered = {
                  start: tailOccurrences[0],
                  end: tailOccurrences[0] + candidateTail.length,
                  exactText: candidateTail,
                };
                break;
              }
            }
          }
        }
      }
    }

    // Strategy B: Longest matching suffix/sub-clause of words
    if (!recovered) {
      const words = statement.trim().split(/\s+/);
      for (let w = 1; w < words.length - 2; w++) {
        const subphrase = words.slice(w).join(' ');
        if (subphrase.length >= 12 && !isBareFragment(subphrase)) {
          // Guard: Cannot drop negation
          if (!stmtHasNegation || NEGATION_REGEX.test(subphrase)) {
            const subOccurrences = findAllOccurrences(sourceText, subphrase);
            if (subOccurrences.length === 1) {
              recovered = {
                start: subOccurrences[0],
                end: subOccurrences[0] + subphrase.length,
                exactText: subphrase,
              };
              break;
            }
          }
        }
      }
    }

    if (recovered) {
      // Guard against surrogate splitting
      if (isSplittingSurrogate(sourceText, recovered.start) || isSplittingSurrogate(sourceText, recovered.end)) {
        throw new Error('GROUNDING_FAILURE: Recovered span splits a Unicode surrogate pair');
      }
      claim.statement = recovered.exactText;
      return { start: recovered.start, end: recovered.end };
    }

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
export function resolveQualifierSpan(
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
