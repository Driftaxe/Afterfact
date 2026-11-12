import type { ClaimTicket, VerificationProperty } from '@/lib/contracts/claim-ticket';
import { VerificationPropertySchema } from '@/lib/contracts/claim-ticket';
import { isValidCalendarDateOrPartial } from '@/lib/contracts/dates';
import type {
  EvidenceUnit,
  SourceDocument,
} from '@/lib/contracts/evidence-objects';
import {
  EvidenceUnitSchema,
  validateEvidenceUnitAgainstSource,
} from '@/lib/contracts/evidence-objects';
import { bifrostChat } from '@/server/bifrost/client';
import { getModelProfile } from '@/server/bifrost/profiles';
import {
  buildEvidenceExtractionUserPrompt,
  EVIDENCE_EXTRACTION_SYSTEM_PROMPT,
} from '@/server/prompts/extract-evidence';

/**
 * Details of an evidence passage proposal that failed grounding or validation.
 */
export interface RejectedEvidenceCandidate {
  proposedText: string;
  reason: string;
  locator?: unknown;
}

/**
 * Parameters for evidence unit extraction.
 */
export interface ExtractEvidenceParams {
  source: SourceDocument;
  ticket: ClaimTicket;
  maxPassages?: number;
}

/**
 * Discriminated outcome union for evidence unit extraction.
 */
export type ExtractEvidenceOutcome =
  | {
      status: 'success';
      evidenceUnits: EvidenceUnit[];
      rejectedCandidates: RejectedEvidenceCandidate[];
      coverageLimitations: string[];
    }
  | {
      status: 'no_usable_passages';
      documentId: string;
      reason: string;
    }
  | {
      status: 'source_failed';
      documentId: string;
      failureReason: string;
    }
  | {
      status: 'error';
      documentId: string;
      error: string;
    };

/**
 * Strips markdown json fencing if present.
 */
function cleanJsonOutput(text: string): string {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenceMatch ? fenceMatch[1].trim() : trimmed;
}

/**
 * Disambiguates repeated occurrences of a verbatim quote in a document using surrounding context.
 */
function findBestOccurrenceOffset(
  rawText: string,
  verbatimText: string,
  surroundingHeaders: string[]
): { start: number; end: number } | null {
  const firstIndex = rawText.indexOf(verbatimText);
  if (firstIndex === -1) return null;

  const secondIndex = rawText.indexOf(verbatimText, firstIndex + 1);
  // Unambiguous single occurrence
  if (secondIndex === -1) {
    return { start: firstIndex, end: firstIndex + verbatimText.length };
  }

  // Multiple occurrences: scan occurrences and score proximity to surrounding header breadcrumbs
  const candidateIndices: number[] = [];
  let curIndex = firstIndex;
  while (curIndex !== -1) {
    candidateIndices.push(curIndex);
    curIndex = rawText.indexOf(verbatimText, curIndex + 1);
  }

  if (surroundingHeaders.length > 0) {
    const primaryHeader = surroundingHeaders[surroundingHeaders.length - 1];
    const headerPos = rawText.indexOf(primaryHeader);
    if (headerPos !== -1) {
      // Find candidate occurrence closest following the header
      const subsequentCandidates = candidateIndices.filter((idx) => idx >= headerPos);
      if (subsequentCandidates.length > 0) {
        const best = subsequentCandidates[0];
        return { start: best, end: best + verbatimText.length };
      }
    }
  }

  // Default to first match if no disambiguation context exists
  return { start: firstIndex, end: firstIndex + verbatimText.length };
}

/**
 * Context-preserving extraction of EvidenceUnits from a retrieved SourceDocument.
 * Enforces deterministic quotation verification against SourceDocument.rawText.
 */
export async function extractEvidenceUnits(
  params: ExtractEvidenceParams
): Promise<ExtractEvidenceOutcome> {
  const { source, ticket, maxPassages = 4 } = params;

  // 1. Validate SourceDocument extraction status
  if (source.extractionStatus === 'failed') {
    return {
      status: 'source_failed',
      documentId: source.documentId,
      failureReason: source.failureReason ?? 'Source retrieval failed or was inaccessible',
    };
  }

  if (!source.rawText || source.rawText.trim().length === 0) {
    return {
      status: 'no_usable_passages',
      documentId: source.documentId,
      reason: `Source document ${source.documentId} contains no extracted text (status: ${source.extractionStatus})`,
    };
  }

  const rawDocText = source.rawText;
  const coverageLimitations: string[] = [];
  const MAX_RAW_TEXT_BUDGET = 12000;
  if (rawDocText.length > MAX_RAW_TEXT_BUDGET) {
    coverageLimitations.push(
      `Source text bounded to first ${MAX_RAW_TEXT_BUDGET} characters for passage extraction`
    );
  }

  // 2. Invoke Bifrost extraction pass
  const userPrompt = buildEvidenceExtractionUserPrompt({
    ticket,
    source,
    maxPassages,
  });

  let rawModelOutput: string;
  try {
    rawModelOutput = await bifrostChat({
      messages: [
        { role: 'system', content: EVIDENCE_EXTRACTION_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      model: getModelProfile('extract'),
      temperature: 0.1,
      response_format: { type: 'json_object' },
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      status: 'error',
      documentId: source.documentId,
      error: `Model extraction call failed: ${errorMsg}`,
    };
  }

  // 3. Parse JSON response
  let parsedPayload: Record<string, unknown>;
  try {
    parsedPayload = JSON.parse(cleanJsonOutput(rawModelOutput));
  } catch {
    return {
      status: 'error',
      documentId: source.documentId,
      error: 'Model returned malformed JSON output',
    };
  }

  const rawPassages = Array.isArray(parsedPayload.passages) ? parsedPayload.passages : [];
  if (rawPassages.length === 0) {
    return {
      status: 'no_usable_passages',
      documentId: source.documentId,
      reason: 'No relevant candidate passages identified in source document',
    };
  }

  // 4. Grounding and quote verification for each candidate passage
  const evidenceUnits: EvidenceUnit[] = [];
  const rejectedCandidates: RejectedEvidenceCandidate[] = [];

  for (let idx = 0; idx < rawPassages.length; idx++) {
    const p = rawPassages[idx];
    const verbatimText = typeof p.verbatimText === 'string' ? p.verbatimText.trim() : '';
    if (!verbatimText) {
      rejectedCandidates.push({
        proposedText: '',
        reason: 'Empty verbatimText in model proposal',
      });
      continue;
    }

    // Deterministic quotation check: substring presence in rawText
    if (!rawDocText.includes(verbatimText)) {
      rejectedCandidates.push({
        proposedText: verbatimText,
        reason: 'Quotation not found verbatim in source document rawText (ungrounded hallucination)',
      });
      continue;
    }

    // Context preservation structures: validate headers against actual source text
    const surroundingHeaders = Array.isArray(p.surroundingHeaders)
      ? (p.surroundingHeaders as unknown[])
          .filter(
            (h): h is string =>
              typeof h === 'string' &&
              h.trim().length > 0 &&
              rawDocText.includes(h.trim())
          )
          .map((h) => h.trim())
      : [];

    const rawTable = typeof p.tableContext === 'object' && p.tableContext !== null
      ? (p.tableContext as Record<string, unknown>)
      : null;
    const tableTitle = typeof rawTable?.tableTitle === 'string' && rawDocText.includes(rawTable.tableTitle.trim())
      ? rawTable.tableTitle.trim()
      : undefined;

    const tableContext = rawTable
      ? {
          tableTitle,
          columnHeader: typeof rawTable.columnHeader === 'string' ? rawTable.columnHeader.trim() : undefined,
          rowHeader: typeof rawTable.rowHeader === 'string' ? rawTable.rowHeader.trim() : undefined,
        }
      : undefined;

    // Resolve exact character offsets using genuine surrounding headers
    const offsets = findBestOccurrenceOffset(
      rawDocText,
      verbatimText,
      surroundingHeaders
    );
    if (!offsets) {
      rejectedCandidates.push({
        proposedText: verbatimText,
        reason: 'Unable to resolve character offset bounds in source text',
      });
      continue;
    }

    const footnotes = Array.isArray(p.footnotes)
      ? (p.footnotes as unknown[]).filter((f): f is string => typeof f === 'string' && f.trim().length > 0)
      : [];

    // Parse extracted properties
    const extractedProperties: VerificationProperty[] = [];
    if (Array.isArray(p.extractedProperties)) {
      for (const prop of p.extractedProperties) {
        const validatedProp = VerificationPropertySchema.safeParse({
          ...prop,
          origin: 'explicit_claim_text',
          status: 'confirmed',
          applicability: 'claim_level',
          sourceSpan: { start: offsets.start, end: offsets.end, text: verbatimText },
        });
        if (validatedProp.success) {
          extractedProperties.push(validatedProp.data);
        }
      }
    }

    // Dates validation
    const publicationDate =
      typeof p.publicationDate === 'string' && isValidCalendarDateOrPartial(p.publicationDate)
        ? p.publicationDate
        : source.publicationDate ?? null;

    const effectiveDate =
      typeof p.effectiveDate === 'string' && isValidCalendarDateOrPartial(p.effectiveDate)
        ? p.effectiveDate
        : source.effectiveDate ?? null;

    const announcementDate =
      typeof p.announcementDate === 'string' && isValidCalendarDateOrPartial(p.announcementDate)
        ? p.announcementDate
        : null;

    const evidenceId = `evi_${source.documentId.replace(/^doc_/, '')}_${evidenceUnits.length + 1}`;

    const candidateUnit: EvidenceUnit = {
      evidenceId,
      documentId: source.documentId,
      verbatimText,
      locator: {
        charOffsetStart: offsets.start,
        charOffsetEnd: offsets.end,
      },
      surroundingHeaders,
      tableContext,
      footnotes,
      extractedProperties,
      publicationDate,
      effectiveDate,
      announcementDate,
      extractionLimitations: [],
    };

    // Schema validation and pure aggregate source check
    const unitValidation = EvidenceUnitSchema.safeParse(candidateUnit);
    if (!unitValidation.success) {
      rejectedCandidates.push({
        proposedText: verbatimText,
        reason: `EvidenceUnit contract validation error: ${unitValidation.error.message}`,
      });
      continue;
    }

    const sourceCheck = validateEvidenceUnitAgainstSource(source, unitValidation.data);
    if (!sourceCheck.valid) {
      rejectedCandidates.push({
        proposedText: verbatimText,
        reason: sourceCheck.reason ?? 'Failed aggregate source verification',
      });
      continue;
    }

    evidenceUnits.push(unitValidation.data);
    if (evidenceUnits.length >= maxPassages) break;
  }

  if (evidenceUnits.length === 0) {
    return {
      status: 'no_usable_passages',
      documentId: source.documentId,
      reason: 'All candidate passages failed deterministic quotation verification or schema validation',
    };
  }

  return {
    status: 'success',
    evidenceUnits,
    rejectedCandidates,
    coverageLimitations,
  };
}
