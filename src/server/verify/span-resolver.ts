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
