import type { ClaimTicket } from '@/lib/contracts/claim-ticket';
import type {
  AssessmentRelationship,
  ClaimEvidenceAssessment,
  EvidenceUnit,
  ScopeMatching,
  SourceDocument,
} from '@/lib/contracts/evidence-objects';
import {
  AssessmentRelationshipSchema,
  ClaimEvidenceAssessmentSchema,
  ScopeMatchingSchema,
  validateClaimEvidenceAssessmentReferences,
  validateEvidenceUnitAgainstSource,
} from '@/lib/contracts/evidence-objects';
import { bifrostChat } from '@/server/bifrost/client';
import { getModelProfile } from '@/server/bifrost/profiles';
import {
  buildSemanticAssessmentUserPrompt,
  SEMANTIC_ASSESSMENT_SYSTEM_PROMPT,
} from '@/server/prompts/assess';
import { evaluateTemporalApplicability } from '@/server/verify/temporal';

/**
 * Details of an assessment discarded due to invalid references or grounding failure.
 */
export interface DiscardedAssessment {
  evidenceId: string;
  reason: string;
}

/**
 * Parameters for claim–evidence assessment.
 */
export interface AssessEvidenceParams {
  ticket: ClaimTicket;
  evidenceUnits: EvidenceUnit[];
  sourceDocuments: Map<string, SourceDocument> | Record<string, SourceDocument>;
}

/**
 * Discriminated outcome union for claim–evidence assessment.
 */
export type AssessEvidenceOutcome =
  | {
      status: 'success';
      assessments: ClaimEvidenceAssessment[];
      discardedAssessments: DiscardedAssessment[];
      requiresAdditionalResearch: boolean;
      additionalResearchReasons: string[];
    }
  | {
      status: 'no_evidence_assessed';
      claimTicketId: string;
      reason: string;
    }
  | {
      status: 'error';
      claimTicketId: string;
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
 * Assesses a collection of candidate EvidenceUnits against an individual ClaimTicket revision.
 * Enforces deterministic quotation grounding, scope mismatch constraints, and temporal validity rules.
 */
export async function assessEvidenceAgainstClaim(
  params: AssessEvidenceParams
): Promise<AssessEvidenceOutcome> {
  const { ticket, evidenceUnits, sourceDocuments } = params;

  if (!evidenceUnits || evidenceUnits.length === 0) {
    return {
      status: 'no_evidence_assessed',
      claimTicketId: ticket.ticketId,
      reason: 'No evidence units provided for semantic assessment',
    };
  }

  const docMap =
    sourceDocuments instanceof Map
      ? sourceDocuments
      : new Map(Object.entries(sourceDocuments));

  // 1. Pre-validate grounding against SourceDocument representations
  const validCandidates: EvidenceUnit[] = [];
  const discardedAssessments: DiscardedAssessment[] = [];

  for (const unit of evidenceUnits) {
    const parentDoc = docMap.get(unit.documentId);
    if (!parentDoc) {
      discardedAssessments.push({
        evidenceId: unit.evidenceId,
        reason: `Dangling document reference: SourceDocument ${unit.documentId} not found in map`,
      });
      continue;
    }

    const groundCheck = validateEvidenceUnitAgainstSource(parentDoc, unit);
    if (!groundCheck.valid) {
      discardedAssessments.push({
        evidenceId: unit.evidenceId,
        reason: groundCheck.reason ?? 'Failed aggregate source quotation check',
      });
      continue;
    }

    validCandidates.push(unit);
  }

  if (validCandidates.length === 0) {
    return {
      status: 'no_evidence_assessed',
      claimTicketId: ticket.ticketId,
      reason: 'All candidate evidence units failed source grounding checks',
    };
  }

  // 2. Candidate shortlisting bound (max 8 candidates sent to Bifrost)
  const MAX_CANDIDATE_UNITS = 8;
  const additionalResearchReasons: string[] = [];
  let evaluatedUnits = validCandidates;

  if (validCandidates.length > MAX_CANDIDATE_UNITS) {
    additionalResearchReasons.push(
      `Candidate units bounded from ${validCandidates.length} to top ${MAX_CANDIDATE_UNITS} for model assessment`
    );
    evaluatedUnits = validCandidates.slice(0, MAX_CANDIDATE_UNITS);
  }

  // 3. Call Bifrost assessment pass
  const userPrompt = buildSemanticAssessmentUserPrompt({
    ticket,
    evidenceUnits: evaluatedUnits,
    sourceDocuments: docMap,
  });

  let rawModelOutput: string;
  try {
    rawModelOutput = await bifrostChat({
      messages: [
        { role: 'system', content: SEMANTIC_ASSESSMENT_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      model: getModelProfile('assess'),
      temperature: 0.1,
      response_format: { type: 'json_object' },
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      status: 'error',
      claimTicketId: ticket.ticketId,
      error: `Bifrost semantic assessment call failed: ${errorMsg}`,
    };
  }

  // 4. Parse model proposals
  let parsedPayload: Record<string, unknown>;
  try {
    parsedPayload = JSON.parse(cleanJsonOutput(rawModelOutput));
  } catch {
    return {
      status: 'error',
      claimTicketId: ticket.ticketId,
      error: 'Model returned malformed JSON during semantic assessment',
    };
  }

  const rawAssessments = Array.isArray(parsedPayload.assessments) ? parsedPayload.assessments : [];
  const unitMap = new Map(evaluatedUnits.map((u) => [u.evidenceId, u]));
  const assessments: ClaimEvidenceAssessment[] = [];
  const seenEvidenceIds = new Set<string>();

  // Extract explicit claim temporal qualifier if present
  const claimTimeProp = ticket.verificationContext.find(
    (p) => (p.key === 'year' || p.key === 'effectiveDate' || p.key === 'targetDate') && p.value !== null
  );
  const claimTimeStr = claimTimeProp ? String(claimTimeProp.value) : null;

  for (const rawAsm of rawAssessments) {
    const evidenceId = typeof rawAsm.evidenceId === 'string' ? rawAsm.evidenceId : '';
    const unit = unitMap.get(evidenceId);
    if (!unit) {
      discardedAssessments.push({
        evidenceId,
        reason: 'Assessment references unknown or unbounded EvidenceUnit ID',
      });
      continue;
    }

    // INVARIANT 3: Prevent duplicate assessments for the same EvidenceUnit
    if (seenEvidenceIds.has(evidenceId)) {
      discardedAssessments.push({
        evidenceId,
        reason: `Duplicate assessment for EvidenceUnit '${evidenceId}' discarded; deterministic 1:1 assessment mapping enforced`,
      });
      continue;
    }

    const parentDoc = docMap.get(unit.documentId);

    // Parse relationship
    const relParsed = AssessmentRelationshipSchema.safeParse(rawAsm.relationship);
    let relationship: AssessmentRelationship = relParsed.success
      ? relParsed.data
      : 'relevant_but_inconclusive';

    // Parse scope matching
    const scopeParsed = ScopeMatchingSchema.safeParse(rawAsm.scopeMatching);
    const scopeMatching: ScopeMatching = scopeParsed.success ? scopeParsed.data : 'unknown';

    // INVARIANT 1: Scope Mismatch Cannot Support or Contradict the Differently Scoped Claim
    if (scopeMatching === 'mismatch' && (relationship === 'supports' || relationship === 'contradicts')) {
      relationship = 'relevant_but_inconclusive';
    }

    // INVARIANT 2: Deterministic Temporal Applicability Check
    const temporalResult = evaluateTemporalApplicability({
      targetTime: ticket.targetTime,
      claimTime: claimTimeStr,
      effectiveDate: unit.effectiveDate ?? parentDoc?.effectiveDate ?? null,
      publicationDate: unit.publicationDate ?? parentDoc?.publicationDate ?? null,
      announcementDate: unit.announcementDate ?? null,
    });

    const rawTemporal = typeof rawAsm.temporalApplicability === 'string' ? rawAsm.temporalApplicability : null;
    const isValidModelTemporal =
      rawTemporal === 'active_at_target_time' ||
      rawTemporal === 'historical_prior' ||
      rawTemporal === 'future_pending' ||
      rawTemporal === 'undetermined';

    let temporalApplicability: 'active_at_target_time' | 'historical_prior' | 'future_pending' | 'undetermined';

    if (temporalResult.temporalApplicability === 'future_pending') {
      relationship = 'future_scheduled_change';
      temporalApplicability = 'future_pending';
    } else if (temporalResult.temporalApplicability === 'historical_prior') {
      temporalApplicability = 'historical_prior';
    } else if (relationship === 'historical_state') {
      temporalApplicability = 'historical_prior';
    } else if (temporalResult.temporalApplicability === 'undetermined') {
      // Publication date alone or missing markers cannot establish active validity
      temporalApplicability = (isValidModelTemporal && rawTemporal === 'historical_prior')
        ? 'historical_prior'
        : 'undetermined';
    } else if (isValidModelTemporal && rawTemporal !== 'active_at_target_time') {
      // Prevent unjustified deterministic override: preserve model's historical or undetermined assessment
      temporalApplicability = rawTemporal;
    } else {
      temporalApplicability = temporalResult.temporalApplicability;
    }

    // Parse property match status
    const rawProps =
      typeof rawAsm.propertyMatchStatus === 'object' && rawAsm.propertyMatchStatus !== null
        ? (rawAsm.propertyMatchStatus as Record<string, unknown>)
        : {};

    const propertyMatchStatus = {
      matching: Array.isArray(rawProps.matching) ? rawProps.matching.map(String) : [],
      mismatched: Array.isArray(rawProps.mismatched) ? rawProps.mismatched.map(String) : [],
      missingInEvidence: Array.isArray(rawProps.missingInEvidence) ? rawProps.missingInEvidence.map(String) : [],
    };

    // Source suitability
    const rawSuitability = String(rawAsm.sourceSuitability || '');
    let sourceSuitability: 'authoritative_primary' | 'credible_secondary' | 'insufficient_authority' =
      'credible_secondary';
    if (rawSuitability === 'authoritative_primary' || rawSuitability === 'insufficient_authority') {
      sourceSuitability = rawSuitability;
    } else if (parentDoc?.sourceRole === 'primary_authority' || parentDoc?.sourceRole === 'regulatory_filing') {
      sourceSuitability = 'authoritative_primary';
    }

    const reasoning =
      typeof rawAsm.reasoning === 'string' && rawAsm.reasoning.trim().length > 0
        ? rawAsm.reasoning.trim()
        : temporalResult.reasoning;

    const assessmentId = `asm_${ticket.ticketId.replace(/^tkt_/, '')}_${unit.evidenceId.replace(/^evi_/, '')}`;

    const candidateAssessment: ClaimEvidenceAssessment = {
      assessmentId,
      claimTicketId: ticket.ticketId,
      claimRevision: ticket.revision,
      evidenceId: unit.evidenceId,
      relationship,
      scopeMatching,
      quotationVerified: true,
      propertyMatchStatus,
      temporalApplicability,
      sourceSuitability,
      modelConfidence:
        typeof rawAsm.modelConfidence === 'number' && Number.isFinite(rawAsm.modelConfidence)
          ? Math.max(0, Math.min(1, rawAsm.modelConfidence))
          : null,
      reasoning,
    };

    // Validate schema and reference integrity
    const schemaValidation = ClaimEvidenceAssessmentSchema.safeParse(candidateAssessment);
    if (!schemaValidation.success) {
      discardedAssessments.push({
        evidenceId: unit.evidenceId,
        reason: `Schema validation failed: ${schemaValidation.error.message}`,
      });
      continue;
    }

    const refValidation = validateClaimEvidenceAssessmentReferences(
      schemaValidation.data,
      ticket,
      unit
    );
    if (!refValidation.valid) {
      discardedAssessments.push({
        evidenceId: unit.evidenceId,
        reason: refValidation.reason ?? 'Failed reference integrity validation',
      });
      continue;
    }

    seenEvidenceIds.add(evidenceId);
    assessments.push(schemaValidation.data);
  }

  if (assessments.length === 0) {
    return {
      status: 'no_evidence_assessed',
      claimTicketId: ticket.ticketId,
      reason: 'All proposed assessments failed validation or reference checks',
    };
  }

  // 5. Evaluate additional research needs
  let requiresAdditionalResearch = Boolean(parsedPayload.requiresAdditionalResearch);

  const hasSupport = assessments.some((a) => a.relationship === 'supports');
  const hasContradiction = assessments.some((a) => a.relationship === 'contradicts');
  const hasAuthoritative = assessments.some(
    (a) => a.sourceSuitability === 'authoritative_primary' && a.relationship === 'supports'
  );

  // Preserve conflicts for A05 and flag additional research
  if (hasSupport && hasContradiction) {
    requiresAdditionalResearch = true;
    additionalResearchReasons.push('Discovered direct contradiction between evaluated evidence sources');
  }

  if (!hasAuthoritative && !hasContradiction) {
    requiresAdditionalResearch = true;
    additionalResearchReasons.push('No authoritative primary source confirmed the asserted proposition');
  }

  return {
    status: 'success',
    assessments,
    discardedAssessments,
    requiresAdditionalResearch,
    additionalResearchReasons,
  };
}
