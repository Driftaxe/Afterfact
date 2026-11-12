import { createHash } from 'node:crypto';
import type { ClaimTicket } from '@/lib/contracts/claim-ticket';
import type {
  ClaimEvidenceAssessment,
  EvidenceUnit,
  SourceDocument,
} from '@/lib/contracts/evidence-objects';
import { validateEvidenceUnitAgainstSource } from '@/lib/contracts/evidence-objects';
import type { SourceRole } from '@/lib/contracts/research';
import type {
  AssessmentGrounding,
  ClaimTemporalScope,
  DecisionCoverage,
  DecisionPolicy,
  DecisionRecord,
  EvidenceTemporalProof,
  ExcludedEvidenceItem,
  SourceAuthorityFact,
  TemporalBasis,
  TransitionProof,
} from '@/lib/contracts/decision';
import {
  DecideClaimInputSchema,
  DecisionRecordSchema,
  validateDecisionRecordReferences,
} from '@/lib/contracts/decision';
import {
  doIntervalsOverlap,
  parseDateToInterval,
  type DateInterval,
} from './temporal';

/**
 * Canonical machine reason codes emitted by the deterministic decision gate.
 * The first seven are the documented public rubric; the last three describe
 * boundary outcomes that are not factual verdicts.
 */
export const DECISION_REASON_CODES = {
  AUTHORITATIVE_PRIMARY_SUPPORT: 'AUTHORITATIVE_PRIMARY_SUPPORT',
  INDIRECT_CREDIBLE_SUPPORT: 'INDIRECT_CREDIBLE_SUPPORT',
  DECISIVE_CONTRADICTION: 'DECISIVE_CONTRADICTION',
  SUPERSEDED_HISTORICAL_CLAIM: 'SUPERSEDED_HISTORICAL_CLAIM',
  CREDIBLE_SOURCES_DISAGREE: 'CREDIBLE_SOURCES_DISAGREE',
  ESSENTIAL_CONTEXT_MISSING: 'ESSENTIAL_CONTEXT_MISSING',
  INSUFFICIENT_RETRIEVAL_DATA: 'INSUFFICIENT_RETRIEVAL_DATA',
  INVALID_AGGREGATE_INPUT: 'INVALID_AGGREGATE_INPUT',
  INTERNAL_INVARIANT_FAILURE: 'INTERNAL_INVARIANT_FAILURE',
} as const;

export type DecisionReasonCode =
  (typeof DECISION_REASON_CODES)[keyof typeof DECISION_REASON_CODES];

export interface DecisionInputIssue {
  code: string;
  message: string;
}

/**
 * Discriminated outcome for the decision boundary.
 *
 * - `decided` is a valid factual result, including factual uncertainty.
 * - `invalid_input` means the aggregate itself is malformed and no verdict was
 *   fabricated from a partial remainder.
 * - `internal_error` means an A05 invariant failed after a decision was built.
 */
export type DecideClaimOutcome =
  | { status: 'decided'; decision: DecisionRecord }
  | {
      status: 'invalid_input';
      reasonCode: typeof DECISION_REASON_CODES.INVALID_AGGREGATE_INPUT;
      issues: DecisionInputIssue[];
    }
  | {
      status: 'internal_error';
      reasonCode: typeof DECISION_REASON_CODES.INTERNAL_INVARIANT_FAILURE;
      message: string;
    };

// =============================================================================
// Aggregate indexing & validation
// =============================================================================

interface Aggregate {
  input: ReturnType<typeof DecideClaimInputSchema.parse>;
  ticket: ClaimTicket;
  assessments: ClaimEvidenceAssessment[];
  evidenceUnits: EvidenceUnit[];
  sources: SourceDocument[];
  assessmentById: Map<string, ClaimEvidenceAssessment>;
  assessmentByEvidenceId: Map<string, ClaimEvidenceAssessment>;
  evidenceById: Map<string, EvidenceUnit>;
  sourceById: Map<string, SourceDocument>;
  groundingByAssessmentId: Map<string, AssessmentGrounding>;
  proofByEvidenceId: Map<string, EvidenceTemporalProof>;
  authorityByDocumentId: Map<string, SourceAuthorityFact>;
  policy: DecisionPolicy;
  coverage: DecisionCoverage;
  claimScope: ClaimTemporalScope;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value !== null && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) {
      result[key] = canonicalize(source[key]);
    }
    return result;
  }
  return value;
}

function canonicalStringify(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function indexById<T>(
  items: T[],
  getId: (item: T) => string,
  kind: string,
  issues: DecisionInputIssue[]
): Map<string, T> {
  const index = new Map<string, T>();
  for (const item of items) {
    const id = getId(item);
    const existing = index.get(id);
    if (existing) {
      if (canonicalStringify(existing) !== canonicalStringify(item)) {
        issues.push({
          code: 'DUPLICATE_ID_CONFLICT',
          message: `Duplicate ${kind} '${id}' has conflicting definitions`,
        });
      }
      continue;
    }
    index.set(id, item);
  }
  return index;
}

function addIssue(
  issues: DecisionInputIssue[],
  code: string,
  message: string
): void {
  issues.push({ code, message });
}

function validateAndIndex(
  parsed: ReturnType<typeof DecideClaimInputSchema.parse>
): { ok: true; aggregate: Aggregate } | { ok: false; issues: DecisionInputIssue[] } {
  const issues: DecisionInputIssue[] = [];
  const { ticket } = parsed;

  const assessmentById = indexById(
    parsed.assessments,
    (assessment) => assessment.assessmentId,
    'assessment',
    issues
  );
  const evidenceById = indexById(
    parsed.evidenceUnits,
    (unit) => unit.evidenceId,
    'evidence unit',
    issues
  );
  const sourceById = indexById(
    parsed.sourceDocuments,
    (source) => source.documentId,
    'source document',
    issues
  );
  const groundingByAssessmentId = indexById(
    parsed.assessmentGrounding,
    (grounding) => grounding.assessmentId,
    'assessment grounding',
    issues
  );
  const proofByEvidenceId = indexById(
    parsed.evidenceTemporalProofs,
    (proof) => proof.evidenceId,
    'temporal proof',
    issues
  );
  const authorityByDocumentId = indexById(
    parsed.sourceAuthority,
    (authority) => authority.documentId,
    'source authority fact',
    issues
  );
  const transitionById = indexById(
    parsed.transitions,
    (transition) => transition.transitionId,
    'transition proof',
    issues
  );
  indexById(
    parsed.coverage.obligations,
    (obligation) => obligation.obligationId,
    'coverage obligation',
    issues
  );
  indexById(
    parsed.policy.propertyRoles,
    (role) => role.key,
    'policy property role',
    issues
  );

  const claimPropertyKeys = new Set(
    ticket.verificationContext.map((property) => property.key)
  );
  for (const role of parsed.policy.propertyRoles) {
    if (!claimPropertyKeys.has(role.key)) {
      addIssue(
        issues,
        'POLICY_ROLE_UNKNOWN_PROPERTY',
        `Policy declares a role for property '${role.key}', which is not in the claim verification context`
      );
    }
  }

  const assessments = [...assessmentById.values()].sort((a, b) =>
    a.assessmentId.localeCompare(b.assessmentId)
  );
  const evidenceUnits = [...evidenceById.values()].sort((a, b) =>
    a.evidenceId.localeCompare(b.evidenceId)
  );
  const sources = [...sourceById.values()].sort((a, b) =>
    a.documentId.localeCompare(b.documentId)
  );

  for (const source of sources) {
    if (source.runId !== ticket.runId) {
      addIssue(
        issues,
        'INCOMPATIBLE_RUN_REFERENCE',
        `Source document '${source.documentId}' belongs to run '${source.runId}', not claim run '${ticket.runId}'`
      );
    }
  }

  for (const unit of evidenceUnits) {
    const source = sourceById.get(unit.documentId);
    if (!source) {
      addIssue(
        issues,
        'DANGLING_SOURCE_REFERENCE',
        `Evidence unit '${unit.evidenceId}' references unknown source document '${unit.documentId}'`
      );
      continue;
    }

    const groundingCheck = validateEvidenceUnitAgainstSource(source, unit);
    if (!groundingCheck.valid) {
      addIssue(
        issues,
        'SOURCE_GROUNDING_INCONSISTENT',
        `Evidence unit '${unit.evidenceId}' is inconsistent with source '${source.documentId}': ${groundingCheck.reason ?? 'unknown grounding failure'}`
      );
    }
  }

  const assessmentByEvidenceId = new Map<string, ClaimEvidenceAssessment>();
  for (const assessment of assessments) {
    if (assessment.claimTicketId !== ticket.ticketId) {
      addIssue(
        issues,
        'WRONG_CLAIM_TICKET',
        `Assessment '${assessment.assessmentId}' is bound to claim '${assessment.claimTicketId}', not '${ticket.ticketId}'`
      );
    }
    if (assessment.claimRevision !== ticket.revision) {
      addIssue(
        issues,
        'STALE_CLAIM_REVISION',
        `Assessment '${assessment.assessmentId}' evaluated revision ${assessment.claimRevision}, not current revision ${ticket.revision}`
      );
    }

    if (assessmentByEvidenceId.has(assessment.evidenceId)) {
      addIssue(
        issues,
        'DUPLICATE_ASSESSMENT_FOR_EVIDENCE',
        `Multiple assessments '${assessmentByEvidenceId.get(assessment.evidenceId)?.assessmentId}' and '${assessment.assessmentId}' target the same evidence unit '${assessment.evidenceId}'`
      );
    } else {
      assessmentByEvidenceId.set(assessment.evidenceId, assessment);
    }

    const unit = evidenceById.get(assessment.evidenceId);
    if (!unit) {
      addIssue(
        issues,
        'DANGLING_EVIDENCE_REFERENCE',
        `Assessment '${assessment.assessmentId}' references unknown evidence unit '${assessment.evidenceId}'`
      );
      continue;
    }

  }

  for (const grounding of groundingByAssessmentId.values()) {
    if (!assessmentById.has(grounding.assessmentId)) {
      addIssue(
        issues,
        'DANGLING_GROUNDING_REFERENCE',
        `Assessment grounding references unknown assessment '${grounding.assessmentId}'`
      );
    }
  }

  for (const proof of proofByEvidenceId.values()) {
    if (!evidenceById.has(proof.evidenceId)) {
      addIssue(
        issues,
        'DANGLING_TEMPORAL_PROOF_REFERENCE',
        `Temporal proof references unknown evidence unit '${proof.evidenceId}'`
      );
    }
  }

  for (const authority of authorityByDocumentId.values()) {
    if (!sourceById.has(authority.documentId)) {
      addIssue(
        issues,
        'DANGLING_AUTHORITY_REFERENCE',
        `Source authority fact references unknown source document '${authority.documentId}'`
      );
    }
  }

  for (const transition of transitionById.values()) {
    if (transition.claimTicketId !== ticket.ticketId) {
      addIssue(
        issues,
        'TRANSITION_WRONG_CLAIM',
        `Transition '${transition.transitionId}' is bound to claim '${transition.claimTicketId}', not '${ticket.ticketId}'`
      );
    }
    if (transition.claimRevision !== ticket.revision) {
      addIssue(
        issues,
        'TRANSITION_STALE_REVISION',
        `Transition '${transition.transitionId}' evaluated revision ${transition.claimRevision}, not current revision ${ticket.revision}`
      );
    }
    if (!assessmentById.has(transition.priorAssessmentId)) {
      addIssue(
        issues,
        'DANGLING_TRANSITION_PRIOR',
        `Transition '${transition.transitionId}' references unknown prior assessment '${transition.priorAssessmentId}'`
      );
    }
    if (!assessmentById.has(transition.supersedingAssessmentId)) {
      addIssue(
        issues,
        'DANGLING_TRANSITION_SUPERSEDING',
        `Transition '${transition.transitionId}' references unknown superseding assessment '${transition.supersedingAssessmentId}'`
      );
    }
    if (transition.priorAssessmentId === transition.supersedingAssessmentId) {
      addIssue(
        issues,
        'TRANSITION_SELF_REFERENCE',
        `Transition '${transition.transitionId}' uses the same assessment for prior and superseding states`
      );
    }
  }

  for (const obligation of parsed.coverage.obligations) {
    for (const assessmentId of obligation.affectedAssessmentIds) {
      if (!assessmentById.has(assessmentId)) {
        addIssue(
          issues,
          'DANGLING_COVERAGE_AFFECTED_ASSESSMENT',
          `Coverage obligation '${obligation.obligationId}' references unknown affected assessment '${assessmentId}'`
        );
      }
    }
    for (const assessmentId of obligation.resolvedByAssessmentIds) {
      if (!assessmentById.has(assessmentId)) {
        addIssue(
          issues,
          'DANGLING_COVERAGE_RESOLUTION_ASSESSMENT',
          `Coverage obligation '${obligation.obligationId}' references unknown resolving assessment '${assessmentId}'`
        );
      }
    }
  }

  if (parsed.claimTemporalScope.quantifier === 'historical') {
    const asserted = parsed.claimTemporalScope.assertedTime;
    if (!asserted || !parseDateToInterval(asserted)) {
      addIssue(
        issues,
        'INVALID_HISTORICAL_INTERVAL',
        'Historical claim scope requires a parseable assertedTime'
      );
    }
  }

  if (issues.length > 0) {
    issues.sort((a, b) => `${a.code}|${a.message}`.localeCompare(`${b.code}|${b.message}`));
    return { ok: false, issues };
  }

  return {
    ok: true,
    aggregate: {
      input: parsed,
      ticket,
      assessments,
      evidenceUnits,
      sources,
      assessmentById,
      assessmentByEvidenceId,
      evidenceById,
      sourceById,
      groundingByAssessmentId,
      proofByEvidenceId,
      authorityByDocumentId,
      policy: parsed.policy,
      coverage: parsed.coverage,
      claimScope: parsed.claimTemporalScope,
    },
  };
}

// =============================================================================
// Per-assessment deterministic evaluation
// =============================================================================

type TemporalClass = 'current' | 'historical' | 'future' | 'unknown';

interface EvaluatedAssessment {
  assessment: ClaimEvidenceAssessment;
  unit: EvidenceUnit;
  source: SourceDocument;
  authorityRank: 0 | 1 | 2;
  exclusion: ExcludedEvidenceItem['exclusionReason'] | null;
  limitationCodes: string[];
  temporalClass: TemporalClass;
  decisive: boolean;
}

const AUTHORITY_ROLE_BY_BASIS: Record<
  Exclude<SourceAuthorityFact['basis'], 'unknown'>,
  SourceRole
> = {
  official_primary_record: 'primary_authority',
  regulatory_filing: 'regulatory_filing',
  official_changelog: 'official_changelog',
  independent_secondary_report: 'reputable_secondary',
};

function isDecisiveRelationship(
  relationship: ClaimEvidenceAssessment['relationship']
): boolean {
  return (
    relationship === 'supports' ||
    relationship === 'contradicts' ||
    relationship === 'historical_state'
  );
}

function evaluateAuthority(
  aggregate: Aggregate,
  assessment: ClaimEvidenceAssessment,
  source: SourceDocument,
  authority: SourceAuthorityFact | undefined
): { rank: 0 | 1 | 2; codes: string[] } {
  if (!authority || authority.basis === 'unknown') {
    return { rank: 0, codes: ['AUTHORITY_PROVENANCE_UNCONFIRMED'] };
  }
  if (authority.claimApplicability === 'not_applicable') {
    return { rank: 0, codes: ['AUTHORITY_NOT_APPLICABLE_TO_CLAIM'] };
  }
  if (authority.claimApplicability === 'unknown') {
    return { rank: 0, codes: ['AUTHORITY_APPLICABILITY_UNKNOWN'] };
  }

  const expectedRole = AUTHORITY_ROLE_BY_BASIS[authority.basis];
  if (authority.basis === 'independent_secondary_report') {
    if (source.sourceRole !== 'reputable_secondary' && source.sourceRole !== 'counter_perspective') {
      return { rank: 0, codes: ['SECONDARY_PROVENANCE_LABEL_MISMATCH'] };
    }
    if (assessment.sourceSuitability !== 'credible_secondary') {
      return { rank: 0, codes: ['SECONDARY_SUITABILITY_NOT_ESTABLISHED'] };
    }
    return { rank: 1, codes: [] };
  }

  if (source.sourceRole !== expectedRole) {
    return { rank: 0, codes: ['AUTHORITY_BASIS_LABEL_MISMATCH'] };
  }
  if (!aggregate.policy.authoritativeSourceRoles.includes(source.sourceRole)) {
    return { rank: 0, codes: ['SOURCE_ROLE_NOT_AUTHORITATIVE_FOR_POLICY'] };
  }
  if (assessment.sourceSuitability !== 'authoritative_primary') {
    return { rank: 0, codes: ['PRIMARY_SUITABILITY_NOT_ESTABLISHED'] };
  }
  if (
    source.extractionStatus === 'failed' ||
    !source.rawText ||
    !source.retrievedContentHash
  ) {
    return { rank: 0, codes: ['SOURCE_PROVENANCE_UNUSABLE'] };
  }
  return { rank: 2, codes: [] };
}

function evaluateScopeAndProperties(
  aggregate: Aggregate,
  assessment: ClaimEvidenceAssessment
): {
  exclusion: ExcludedEvidenceItem['exclusionReason'] | null;
  codes: string[];
} {
  const roleByKey = new Map(
    aggregate.policy.propertyRoles.map((role) => [role.key, role])
  );
  const claimKeys = new Set(
    aggregate.ticket.verificationContext.map((property) => property.key)
  );
  const matching = new Set(assessment.propertyMatchStatus.matching);
  const mismatched = new Set(assessment.propertyMatchStatus.mismatched);
  const missing = new Set(assessment.propertyMatchStatus.missingInEvidence);

  let hasScopeMismatch = false;
  let hasUnknownClaimPropertyMismatch = false;
  const codes: string[] = [];

  for (const key of mismatched) {
    const role = roleByKey.get(key);
    if (!role) {
      if (claimKeys.has(key)) {
        hasUnknownClaimPropertyMismatch = true;
      } else {
        // A property outside the claim cannot silently become decisive scope.
        codes.push(`UNCLASSIFIED_NON_CLAIM_PROPERTY_MISMATCH: ${key}`);
      }
    } else if (role.role === 'scope_qualifier') {
      hasScopeMismatch = true;
    }
  }

  if (hasScopeMismatch) {
    return { exclusion: 'wrong_scope', codes: ['SCOPE_QUALIFIER_MISMATCH'] };
  }
  if (hasUnknownClaimPropertyMismatch) {
    return {
      exclusion: 'incomplete_property_match',
      codes: ['PROPERTY_ROLE_UNCLASSIFIED'],
    };
  }

  // Scope and asserted-value roles are supplied by the caller. A required
  // property must be affirmatively accounted for. Absence of a mismatch is not
  // treated as proof of a match.
  for (const property of aggregate.ticket.verificationContext) {
    const role = roleByKey.get(property.key);
    const required = role ? role.required : true;
    if (!required) continue;
    if (mismatched.has(property.key)) continue;
    if (missing.has(property.key)) {
      return {
        exclusion: 'incomplete_property_match',
        codes: ['REQUIRED_PROPERTY_MISSING'],
      };
    }
    if (!matching.has(property.key)) {
      return {
        exclusion: 'incomplete_property_match',
        codes: ['PROPERTY_MATCH_UNDETERMINED'],
      };
    }
  }

  for (const key of missing) {
    if (!claimKeys.has(key)) {
      codes.push(`NON_CLAIM_PROPERTY_MISSING: ${key}`);
    }
  }

  const assertedRoleKeys = aggregate.policy.propertyRoles
    .filter((role) => role.role === 'asserted_value')
    .map((role) => role.key);
  const hasAssertedValueMismatch = assertedRoleKeys.some((key) =>
    mismatched.has(key)
  );

  // Only asserted-value properties differ. This is a same-scope value
  // disagreement, not a wrong-scope exclusion.
  if (
    hasAssertedValueMismatch &&
    assessment.relationship === 'supports'
  ) {
    return {
      exclusion: 'incomplete_property_match',
      codes: ['SUPPORT_WITH_ASSERTED_VALUE_MISMATCH'],
    };
  }
  if (
    assessment.relationship === 'contradicts' &&
    !hasAssertedValueMismatch &&
    assertedRoleKeys.length > 0 &&
    assertedRoleKeys.some((key) => matching.has(key))
  ) {
    return {
      exclusion: 'incomplete_property_match',
      codes: ['CONTRADICTION_WITH_MATCHING_ASSERTED_VALUE'],
    };
  }

  if (assessment.scopeMatching === 'unknown') {
    // Every required property was affirmatively matched above, so positive
    // property-level facts, not the coarse label, establish same-scope use.
    codes.push('SCOPE_LABEL_UNKNOWN_PROPERTY_MATCH_CONFIRMED');
  } else if (
    assessment.scopeMatching === 'mismatch' &&
    mismatched.size === 0
  ) {
    return {
      exclusion: 'incomplete_property_match',
      codes: ['SCOPE_LABEL_INCONSISTENT_WITH_PROPERTIES'],
    };
  }

  if (hasAssertedValueMismatch) {
    codes.push('ASSERTED_VALUE_MISMATCH');
  }

  return { exclusion: null, codes };
}

function evaluateTemporal(
  assessment: ClaimEvidenceAssessment,
  proof: EvidenceTemporalProof | undefined
): { temporalClass: TemporalClass; codes: string[] } {
  if (assessment.relationship === 'future_scheduled_change') {
    return { temporalClass: 'future', codes: ['FUTURE_CHANGE_NOT_APPLIED'] };
  }
  if (!proof || proof.basis === 'unknown') {
    return { temporalClass: 'unknown', codes: ['TEMPORAL_PROOF_MISSING'] };
  }
  if (proof.basis === 'future_effective') {
    return { temporalClass: 'future', codes: ['FUTURE_CHANGE_NOT_APPLIED'] };
  }
  if (proof.basis === 'effective_start_only') {
    return { temporalClass: 'unknown', codes: ['EFFECTIVE_START_ONLY'] };
  }
  if (proof.basis === 'publication_only') {
    return { temporalClass: 'unknown', codes: ['PUBLICATION_DATE_INSUFFICIENT'] };
  }
  if (proof.basis === 'current_validity_confirmed') {
    if (assessment.temporalApplicability !== 'active_at_target_time') {
      return {
        temporalClass: 'unknown',
        codes: ['TEMPORAL_LABEL_INCONSISTENT'],
      };
    }
    return { temporalClass: 'current', codes: [] };
  }

  // historical_interval_confirmed
  if (
    assessment.temporalApplicability !== 'historical_prior' &&
    assessment.relationship !== 'historical_state'
  ) {
    return { temporalClass: 'unknown', codes: ['TEMPORAL_LABEL_INCONSISTENT'] };
  }
  return { temporalClass: 'historical', codes: [] };
}

function evaluateAssessment(
  aggregate: Aggregate,
  assessment: ClaimEvidenceAssessment
): EvaluatedAssessment {
  const unit = aggregate.evidenceById.get(assessment.evidenceId)!;
  const source = aggregate.sourceById.get(unit.documentId)!;
  const grounding = aggregate.groundingByAssessmentId.get(assessment.assessmentId);
  const proof = aggregate.proofByEvidenceId.get(assessment.evidenceId);
  const authority = aggregate.authorityByDocumentId.get(source.documentId);
  const limitationCodes: string[] = [];

  let exclusion: ExcludedEvidenceItem['exclusionReason'] | null = null;

  if (source.extractionStatus !== 'success') {
    limitationCodes.push(
      `SOURCE_EXTRACTION_${source.extractionStatus.toUpperCase()}`
    );
  }
  for (const limitation of unit.extractionLimitations) {
    limitationCodes.push(`EVIDENCE_EXTRACTION_LIMITATION: ${limitation}`);
  }
  for (const limitation of grounding?.limitations ?? []) {
    limitationCodes.push(`UPSTREAM_GROUNDING: ${limitation}`);
  }

  if (!assessment.quotationVerified) {
    exclusion = 'unverifiable_quote';
  } else if (
    isDecisiveRelationship(assessment.relationship) &&
    (!grounding ||
      grounding.contextBasis === 'unknown' ||
      grounding.contextBasis === 'unverified_context')
  ) {
    exclusion = 'unverified_context';
    limitationCodes.push(
      grounding?.contextBasis === 'unverified_context'
        ? 'UNVERIFIED_CONTEXT_ASSOCIATION'
        : 'CONTEXT_GROUNDING_UNKNOWN'
    );
  }

  if (!exclusion) {
    const scope = evaluateScopeAndProperties(aggregate, assessment);
    exclusion = scope.exclusion;
    limitationCodes.push(...scope.codes);
  }

  const temporal = evaluateTemporal(assessment, proof);
  if (temporal.temporalClass === 'future' || temporal.temporalClass === 'unknown') {
    limitationCodes.push(...temporal.codes);
  }

  const authorityResult = evaluateAuthority(aggregate, assessment, source, authority);
  limitationCodes.push(...authorityResult.codes);

  if (
    !exclusion &&
    authorityResult.rank === 0 &&
    isDecisiveRelationship(assessment.relationship)
  ) {
    exclusion = 'insufficient_authority';
  }

  const temporalOk =
    assessment.relationship === 'historical_state'
      ? temporal.temporalClass === 'historical'
      : aggregate.claimScope.quantifier === 'historical'
        ? temporal.temporalClass === 'historical'
        : temporal.temporalClass === 'current';

  if (
    !isDecisiveRelationship(assessment.relationship) &&
    assessment.relationship === 'relevant_but_inconclusive'
  ) {
    limitationCodes.push('RELATIONSHIP_NOT_DECISIVE');
  }

  const decisive =
    exclusion === null &&
    authorityResult.rank > 0 &&
    temporalOk &&
    isDecisiveRelationship(assessment.relationship);

  return {
    assessment,
    unit,
    source,
    authorityRank: authorityResult.rank,
    exclusion,
    limitationCodes,
    temporalClass: temporal.temporalClass,
    decisive,
  };
}

// =============================================================================
// Temporal and policy helpers
// =============================================================================

function maxRank(evaluations: EvaluatedAssessment[]): 0 | 1 | 2 {
  let rank: 0 | 1 | 2 = 0;
  for (const evaluation of evaluations) {
    if (evaluation.authorityRank > rank) {
      rank = evaluation.authorityRank;
    }
  }
  return rank;
}

function toInterval(
  value: string | null | undefined
): DateInterval | null {
  if (!value) return null;
  return parseDateToInterval(value);
}

function isOnOrBeforeTarget(
  value: string,
  targetTime: string
): boolean {
  const valueInterval = toInterval(value);
  const targetInterval = toInterval(targetTime);
  if (!valueInterval || !targetInterval) return false;
  return valueInterval.start <= targetInterval.end;
}

function isStrictlyAfterTarget(
  value: string,
  targetTime: string
): boolean {
  const valueInterval = toInterval(value);
  const targetInterval = toInterval(targetTime);
  if (!valueInterval || !targetInterval) return false;
  return valueInterval.start > targetInterval.end;
}

function isHistoricalIntervalApplicable(
  evaluation: EvaluatedAssessment,
  claimScope: ClaimTemporalScope,
  proof: EvidenceTemporalProof | undefined
): boolean {
  if (!claimScope.assertedTime || !proof?.applicableInterval) return false;
  const asserted = toInterval(claimScope.assertedTime);
  const evidenceStart = toInterval(proof.applicableInterval.start);
  const evidenceEnd = toInterval(proof.applicableInterval.end);
  if (!asserted || !evidenceStart || !evidenceEnd) return false;

  const evidenceInterval: DateInterval = {
    start: evidenceStart.start,
    end: evidenceEnd.end,
    precision: evidenceStart.precision === 'day' && evidenceEnd.precision === 'day' ? 'day' : 'month',
    raw: `${proof.applicableInterval.start}/${proof.applicableInterval.end}`,
  };

  if (claimScope.intervalSemantics === 'throughout') {
    return evidenceInterval.start <= asserted.start && evidenceInterval.end >= asserted.end;
  }
  return doIntervalsOverlap(evidenceInterval, asserted);
}

function collectMissingMaterialContext(
  aggregate: Aggregate
): string[] {
  const optionalKeys = new Set(
    aggregate.policy.propertyRoles
      .filter((role) => !role.required)
      .map((role) => role.key)
  );
  const missing = new Set<string>();

  for (const key of aggregate.ticket.missingMaterialContext) {
    missing.add(key);
  }
  for (const property of aggregate.ticket.verificationContext) {
    if (optionalKeys.has(property.key)) continue;
    if (
      property.status === 'clarification_needed' ||
      property.status === 'pending_review'
    ) {
      missing.add(property.key);
    } else if (property.origin === 'unknown' && property.value === null) {
      missing.add(property.key);
    }
  }

  return [...missing].sort();
}

interface CoverageEffect {
  /** A claim-wide material gap applies to every available support. */
  blocksAllSupports: boolean;
  /** Assessment IDs whose support is specifically blocked by a scoped gap. */
  blockedAssessmentIds: Set<string>;
  /** Human-readable reasons retained in the decision explanation. */
  reasons: string[];
}

/**
 * Translate typed coverage facts into the support they actually block.
 *
 * - An explicit research-incomplete assertion blocks every support unless the
 *   caller also records budget exhaustion as the reason research stopped.
 *   Budget exhaustion alone is retained as a limitation, not treated as an
 *   unresolved factual gap.
 * - A material unresolved obligation blocks its declared affected assessments.
 *   Without a bounded affected set it blocks every support: unknown material
 *   coverage must not silently become complete.
 * - Material rejected candidates block support unless they were rejected as
 *   `unrelated`; non-material rejections and free-text limitations never
 *   mechanically block independently sufficient evidence.
 */
function evaluateCoverageEffect(aggregate: Aggregate): CoverageEffect {
  const { coverage } = aggregate;
  const blockedAssessmentIds = new Set<string>();
  const reasons: string[] = [];
  let blocksAllSupports = false;

  if (!coverage.researchComplete && !coverage.budgetExhausted) {
    blocksAllSupports = true;
    reasons.push('research coverage is explicitly incomplete');
  }

  for (const obligation of coverage.obligations) {
    if (!obligation.material || obligation.status !== 'unresolved') continue;

    if (
      obligation.scope === 'claim' ||
      obligation.affectedAssessmentIds.length === 0
    ) {
      blocksAllSupports = true;
      reasons.push(`obligation '${obligation.obligationId}' remains unresolved`);
      continue;
    }

    for (const assessmentId of obligation.affectedAssessmentIds) {
      blockedAssessmentIds.add(assessmentId);
    }
    reasons.push(
      `obligation '${obligation.obligationId}' remains unresolved for ${uniqueSorted(
        obligation.affectedAssessmentIds
      ).join(', ')}`
    );
  }

  for (const candidate of coverage.rejectedCandidates) {
    if (!candidate.material || candidate.reason === 'unrelated') continue;
    blocksAllSupports = true;
    reasons.push(
      `material candidate '${candidate.evidenceId}' was rejected as '${candidate.reason}'`
    );
  }

  return {
    blocksAllSupports,
    blockedAssessmentIds,
    reasons: uniqueSorted(reasons),
  };
}

function findValidTransition(
  aggregate: Aggregate,
  historicalSupports: EvaluatedAssessment[],
  currentOppositions: EvaluatedAssessment[]
): {
  transition: TransitionProof;
  prior: EvaluatedAssessment;
  superseding: EvaluatedAssessment;
} | null {
  const transitions = [...aggregate.input.transitions].sort((a, b) =>
    a.transitionId.localeCompare(b.transitionId)
  );

  for (const transition of transitions) {
    if (
      transition.claimTicketId !== aggregate.ticket.ticketId ||
      transition.claimRevision !== aggregate.ticket.revision
    ) {
      continue;
    }
    if (
      transition.basis !== 'documented_effective_change' ||
      transition.entityAndScopeMatch !== 'match'
    ) {
      continue;
    }
    if (isStrictlyAfterTarget(transition.effectiveDate, aggregate.ticket.targetTime)) {
      continue;
    }
    if (!isOnOrBeforeTarget(transition.effectiveDate, aggregate.ticket.targetTime)) {
      continue;
    }

    const prior = historicalSupports.find(
      (evaluation) =>
        evaluation.assessment.assessmentId === transition.priorAssessmentId
    );
    const superseding = currentOppositions.find(
      (evaluation) =>
        evaluation.assessment.assessmentId === transition.supersedingAssessmentId
    );
    if (
      !prior ||
      !superseding ||
      prior.authorityRank !== 2 ||
      superseding.authorityRank !== 2
    ) {
      continue;
    }

    const priorProof = aggregate.proofByEvidenceId.get(prior.unit.evidenceId);
    if (!priorProof?.applicableInterval) {
      continue;
    }
    const priorStart = toInterval(priorProof.applicableInterval.start);
    const priorEnd = toInterval(priorProof.applicableInterval.end);
    const transitionEffective = toInterval(transition.effectiveDate);
    if (!priorStart || !priorEnd || !transitionEffective) {
      continue;
    }
    // Earlier validity must end no later than the transition's effective start.
    if (priorEnd.end > transitionEffective.start) {
      continue;
    }

    return { transition, prior, superseding };
  }

  return null;
}

// =============================================================================
// Decision record construction
// =============================================================================

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function buildRecordId(aggregate: Aggregate): string {
  const policy = aggregate.policy;
  const coverage = aggregate.coverage;
  const hashPayload = {
    ticket: aggregate.ticket,
    assessments: aggregate.assessments.map((assessment) => ({
      ...assessment,
      propertyMatchStatus: {
        matching: [...assessment.propertyMatchStatus.matching].sort(),
        mismatched: [...assessment.propertyMatchStatus.mismatched].sort(),
        missingInEvidence: [...assessment.propertyMatchStatus.missingInEvidence].sort(),
      },
    })),
    evidenceUnits: aggregate.evidenceUnits,
    sourceDocuments: aggregate.sources,
    claimTemporalScope: aggregate.claimScope,
    assessmentGrounding: [...aggregate.input.assessmentGrounding].sort((a, b) =>
      a.assessmentId.localeCompare(b.assessmentId)
    ),
    evidenceTemporalProofs: [...aggregate.input.evidenceTemporalProofs].sort((a, b) =>
      a.evidenceId.localeCompare(b.evidenceId)
    ),
    sourceAuthority: [...aggregate.input.sourceAuthority].sort((a, b) =>
      a.documentId.localeCompare(b.documentId)
    ),
    transitions: [...aggregate.input.transitions].sort((a, b) =>
      a.transitionId.localeCompare(b.transitionId)
    ),
    coverage: {
      ...coverage,
      obligations: [...coverage.obligations].sort((a, b) =>
        a.obligationId.localeCompare(b.obligationId)
      ),
      rejectedCandidates: [...coverage.rejectedCandidates].sort((a, b) =>
        `${a.evidenceId}|${a.reason}`.localeCompare(`${b.evidenceId}|${b.reason}`)
      ),
      limitations: [...coverage.limitations].sort(),
    },
    policy: {
      ...policy,
      propertyRoles: [...policy.propertyRoles].sort((a, b) =>
        a.key.localeCompare(b.key)
      ),
      authoritativeSourceRoles: [...policy.authoritativeSourceRoles].sort(),
    },
    // decidedAt and traceIds are audit metadata, not decision inputs.
  };

  const digest = createHash('sha256')
    .update(canonicalStringify(hashPayload), 'utf8')
    .digest('hex');
  return `dec_${digest.slice(0, 24)}`;
}

function buildTemporalBasis(
  targetTime: string,
  primary: EvaluatedAssessment[],
  transition: TransitionProof | null
): TemporalBasis {
  const first = [...primary].sort((a, b) =>
    a.assessment.assessmentId.localeCompare(b.assessment.assessmentId)
  )[0];

  return {
    targetTime,
    effectiveDate:
      transition?.effectiveDate ??
      first?.unit.effectiveDate ??
      first?.source.effectiveDate ??
      null,
    publicationDate:
      first?.unit.publicationDate ?? first?.source.publicationDate ?? null,
    transitionEventDate: transition?.effectiveDate ?? null,
  };
}

function buildLimitations(
  aggregate: Aggregate,
  evaluations: EvaluatedAssessment[]
): string[] {
  const limitations = new Set<string>();

  for (const limitation of aggregate.coverage.limitations) {
    limitations.add(limitation);
  }
  if (!aggregate.coverage.researchComplete) {
    limitations.add('RESEARCH_COVERAGE_INCOMPLETE');
  }
  for (const obligation of aggregate.coverage.obligations) {
    if (obligation.material && obligation.status === 'unresolved') {
      limitations.add(`MATERIAL_OBLIGATION_UNRESOLVED: ${obligation.obligationId}`);
    }
  }
  if (aggregate.coverage.budgetExhausted) {
    limitations.add('RESEARCH_BUDGET_EXHAUSTED');
  }
  for (const candidate of aggregate.coverage.rejectedCandidates) {
    if (candidate.material && candidate.reason !== 'unrelated') {
      limitations.add(
        `MATERIAL_REJECTED_CANDIDATE: ${candidate.evidenceId}:${candidate.reason}`
      );
    }
  }

  for (const evaluation of evaluations) {
    for (const code of evaluation.limitationCodes) {
      limitations.add(`${code}: ${evaluation.assessment.assessmentId}`);
    }
  }

  return [...limitations].sort();
}

function buildExcludedEvidence(
  evaluations: EvaluatedAssessment[]
): ExcludedEvidenceItem[] {
  const byKey = new Map<string, ExcludedEvidenceItem>();
  for (const evaluation of evaluations) {
    if (!evaluation.exclusion) continue;
    const key = `${evaluation.unit.evidenceId}|${evaluation.exclusion}`;
    if (!byKey.has(key)) {
      byKey.set(key, {
        evidenceId: evaluation.unit.evidenceId,
        exclusionReason: evaluation.exclusion,
      });
    }
  }
  return [...byKey.values()].sort((a, b) =>
    `${a.evidenceId}|${a.exclusionReason}`.localeCompare(
      `${b.evidenceId}|${b.exclusionReason}`
    )
  );
}

interface DecisionDraft {
  verdict: DecisionRecord['verdict'];
  score: DecisionRecord['score'];
  reasonCode: string;
  scoreReason: string;
  primary: EvaluatedAssessment[];
  counter: EvaluatedAssessment[];
  transition: TransitionProof | null;
}

function makeDecision(
  aggregate: Aggregate,
  evaluations: EvaluatedAssessment[],
  draft: DecisionDraft
): DecideClaimOutcome {
  const { ticket } = aggregate;
  const record = {
    recordId: buildRecordId(aggregate),
    claimTicketId: ticket.ticketId,
    claimRevision: ticket.revision,
    appliedPolicy: `${aggregate.policy.policyId}@${aggregate.policy.policyVersion}`,
    verdict: draft.verdict,
    score: draft.score,
    reasonCode: draft.reasonCode,
    scoreReason: draft.scoreReason,
    primaryEvidenceIds: uniqueSorted(
      draft.primary.map((evaluation) => evaluation.assessment.assessmentId)
    ),
    counterEvidenceIds: uniqueSorted(
      draft.counter.map((evaluation) => evaluation.assessment.assessmentId)
    ),
    excludedEvidence: buildExcludedEvidence(evaluations),
    extractedQualifiers: ticket.verificationContext,
    temporalBasis: buildTemporalBasis(
      ticket.targetTime,
      draft.primary,
      draft.transition
    ),
    limitations: buildLimitations(aggregate, evaluations),
    traceIds: aggregate.input.traceIds ?? {},
    verifiedAt: aggregate.input.decidedAt,
  };

  const parsedRecord = DecisionRecordSchema.safeParse(record);
  if (!parsedRecord.success) {
    return {
      status: 'internal_error',
      reasonCode: DECISION_REASON_CODES.INTERNAL_INVARIANT_FAILURE,
      message: `Constructed DecisionRecord failed schema validation: ${parsedRecord.error.issues
        .map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`)
        .join('; ')}`,
    };
  }

  const referenceCheck = validateDecisionRecordReferences(
    parsedRecord.data,
    aggregate.assessments,
    aggregate.evidenceUnits,
    [ticket]
  );
  if (!referenceCheck.valid) {
    return {
      status: 'internal_error',
      reasonCode: DECISION_REASON_CODES.INTERNAL_INVARIANT_FAILURE,
      message: `Constructed DecisionRecord failed reference validation: ${referenceCheck.reason ?? 'unknown reference failure'}`,
    };
  }

  return { status: 'decided', decision: parsedRecord.data };
}

// =============================================================================
// Public entry point
// =============================================================================

/**
 * Pure deterministic decision gate.
 *
 * No network, database, queue, model, clock, or environment access occurs here.
 * The caller supplies the complete validated aggregate and an injected
 * `decidedAt` timestamp. The function never mutates its input.
 *
 * Contract:
 * - Invalid aggregate shape or cross-references -> `invalid_input`.
 * - Valid aggregate -> a `DecisionRecord` covering support, contradiction,
 *   outdated, context dependence, conflict, or insufficiency.
 * - Unexpected post-construction invariant failure -> `internal_error`.
 */
export function decideClaim(input: unknown): DecideClaimOutcome {
  const parsed = DecideClaimInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: 'invalid_input',
      reasonCode: DECISION_REASON_CODES.INVALID_AGGREGATE_INPUT,
      issues: parsed.error.issues.map((issue) => ({
        code: 'SCHEMA_VALIDATION_FAILED',
        message: `${issue.path.join('.') || '<root>'}: ${issue.message}`,
      })),
    };
  }

  const indexed = validateAndIndex(parsed.data);
  if (!indexed.ok) {
    return {
      status: 'invalid_input',
      reasonCode: DECISION_REASON_CODES.INVALID_AGGREGATE_INPUT,
      issues: indexed.issues,
    };
  }

  const aggregate = indexed.aggregate;
  const evaluations = aggregate.assessments.map((assessment) =>
    evaluateAssessment(aggregate, assessment)
  );

  // Gate 1: material missing user context. This is not the same as missing
  // evidence, and an optional unknown qualifier does not trigger it.
  const missingContext = collectMissingMaterialContext(aggregate);
  if (missingContext.length > 0) {
    const evaluatedEvidence = evaluations.filter((evaluation) => evaluation.decisive);
    return makeDecision(aggregate, evaluations, {
      verdict: 'depends_on_context',
      score: null,
      reasonCode: DECISION_REASON_CODES.ESSENTIAL_CONTEXT_MISSING,
      scoreReason: `The claim has material unresolved context (${missingContext.join(
        ', '
      )}); different valid context values can change the verdict, so no score is assigned.`,
      primary: [],
      counter: evaluatedEvidence.filter(
        (evaluation) => evaluation.assessment.relationship === 'contradicts'
      ),
      transition: null,
    });
  }

  const historicalClaim = aggregate.claimScope.quantifier === 'historical';

  // Eligibility is distinct from decisiveness. A current-state claim may be
  // outmatched by a historical assessment that is not directly decisive for
  // the present proposition, yet still proves prior validity for a documented
  // supersession. `decisive` additionally requires claim-time applicability.
  const isEligible = (evaluation: EvaluatedAssessment): boolean =>
    evaluation.exclusion === null && evaluation.authorityRank > 0;

  const historicalSupports = evaluations.filter(
    (evaluation) =>
      isEligible(evaluation) &&
      evaluation.temporalClass === 'historical' &&
      (evaluation.assessment.relationship === 'supports' ||
        evaluation.assessment.relationship === 'historical_state')
  );
  const historicalOppositions = evaluations.filter(
    (evaluation) =>
      isEligible(evaluation) &&
      evaluation.temporalClass === 'historical' &&
      evaluation.assessment.relationship === 'contradicts'
  );
  const currentSupports = evaluations.filter(
    (evaluation) =>
      isEligible(evaluation) &&
      evaluation.temporalClass === 'current' &&
      evaluation.assessment.relationship === 'supports'
  );
  const currentOppositions = evaluations.filter(
    (evaluation) =>
      isEligible(evaluation) &&
      evaluation.temporalClass === 'current' &&
      evaluation.assessment.relationship === 'contradicts'
  );

  let supports = currentSupports;
  let oppositions = currentOppositions;
  if (historicalClaim) {
    supports = historicalSupports.filter((evaluation) =>
      isHistoricalIntervalApplicable(
        evaluation,
        aggregate.claimScope,
        aggregate.proofByEvidenceId.get(evaluation.unit.evidenceId)
      )
    );
    oppositions = historicalOppositions.filter((evaluation) =>
      isHistoricalIntervalApplicable(
        evaluation,
        aggregate.claimScope,
        aggregate.proofByEvidenceId.get(evaluation.unit.evidenceId)
      )
    );

    for (const evaluation of historicalSupports) {
      if (!supports.includes(evaluation)) {
        evaluation.limitationCodes.push('TEMPORAL_INTERVAL_NOT_APPLICABLE');
      }
    }
    for (const evaluation of historicalOppositions) {
      if (!oppositions.includes(evaluation)) {
        evaluation.limitationCodes.push('TEMPORAL_INTERVAL_NOT_APPLICABLE');
      }
    }
    for (const evaluation of currentSupports.concat(currentOppositions)) {
      evaluation.limitationCodes.push(
        'CURRENT_STATE_NOT_APPLICABLE_TO_HISTORICAL_CLAIM'
      );
    }
  }

  const supportRank = maxRank(supports);
  const oppositionRank = maxRank(oppositions);

  // Gate 2: equal-authority unresolved opposition. A contradiction never wins
  // merely because a later gate appears first.
  if (supportRank > 0 && oppositionRank > 0 && supportRank === oppositionRank) {
    return makeDecision(aggregate, evaluations, {
      verdict: 'conflicting_evidence',
      score: null,
      reasonCode: DECISION_REASON_CODES.CREDIBLE_SOURCES_DISAGREE,
      scoreReason: `Grounded assessments of equal authority both support and contradict the proposition under the same scope and applicable time (${uniqueSorted(
        supports.map((evaluation) => evaluation.assessment.assessmentId)
      ).join(', ')} vs ${uniqueSorted(
        oppositions.map((evaluation) => evaluation.assessment.assessmentId)
      ).join(
        ', '
      )}); no documented scope, time, or supersession rule resolved the disagreement, so no score is assigned.`,
      primary: [],
      counter: [...supports, ...oppositions],
      transition: null,
    });
  }

  // Gate 3: decisive contradiction or proven outdated transition.
  if (oppositionRank > supportRank && oppositionRank > 0) {
    if (oppositionRank === 2) {
      const transitionMatch = historicalClaim
        ? null
        : findValidTransition(
            aggregate,
            historicalSupports,
            currentOppositions
          );

      if (transitionMatch) {
        for (const evaluation of supports) {
          evaluation.limitationCodes.push(
            'LOWER_RANKED_SUPPORT_RESOLVED_BY_TRANSITION'
          );
        }
        return makeDecision(aggregate, evaluations, {
          verdict: 'outdated',
          score: 0,
          reasonCode: DECISION_REASON_CODES.SUPERSEDED_HISTORICAL_CLAIM,
          scoreReason: `Earlier validity of the proposition was established, and a documented matching-scope transition effective ${transitionMatch.transition.effectiveDate} superseded it by the target time; a current primary assessment confirms the superseding state.`,
          primary: [transitionMatch.prior, transitionMatch.superseding],
          counter: supports,
          transition: transitionMatch.transition,
        });
      }

      for (const evaluation of supports) {
        evaluation.limitationCodes.push(
          'LOWER_RANKED_SUPPORT_RESOLVED_BY_AUTHORITY'
        );
      }

      // Earlier validity can make the more specific `outdated` classification
      // available, but a missing transition proof does not weaken a current
      // contradiction that is independently sufficient. Preserve the earlier
      // validity as a limitation rather than pretending it was never there.
      if (!historicalClaim && historicalSupports.length > 0) {
        for (const evaluation of historicalSupports) {
          evaluation.limitationCodes.push(
            'PRIOR_VALIDITY_TRANSITION_UNESTABLISHED'
          );
        }
      }

      return makeDecision(aggregate, evaluations, {
        verdict: 'contradicted',
        score: 0,
        reasonCode: DECISION_REASON_CODES.DECISIVE_CONTRADICTION,
        scoreReason: `A grounded claim-applicable primary assessment directly contradicts the proposition under matching scope and applicable time; no equal-authority support remained unresolved.${
          !historicalClaim && historicalSupports.length > 0
            ? ' Earlier validity of the proposition is retained in the limitations, but no complete documented transition establishes that the claim became outdated; the unavailable transition proof does not invalidate the independently sufficient current contradiction.'
            : ''
        }`,
        primary: oppositions,
        counter: supports,
        transition: null,
      });
    }

    // A credible-secondary contradiction is not decisive enough for score 0.
    for (const evaluation of oppositions) {
      evaluation.limitationCodes.push(
        'SECONDARY_CONTRADICTION_NOT_DECISIVE'
      );
    }
    return makeDecision(aggregate, evaluations, {
      verdict: 'insufficient_evidence',
      score: null,
      reasonCode: DECISION_REASON_CODES.INSUFFICIENT_RETRIEVAL_DATA,
      scoreReason:
        'A credible-secondary assessment contradicts the proposition, but no claim-applicable primary authority establishes a decisive contradiction and no equal-authority support resolves the question; no score is assigned.',
      primary: [],
      counter: oppositions,
      transition: null,
    });
  }

  // Gate 4: sufficient support.
  if (supportRank > 0) {
    const coverageEffect = evaluateCoverageEffect(aggregate);
    const blockedSupports = supports.filter(
      (evaluation) =>
        coverageEffect.blocksAllSupports ||
        coverageEffect.blockedAssessmentIds.has(
          evaluation.assessment.assessmentId
        )
    );
    for (const evaluation of blockedSupports) {
      evaluation.limitationCodes.push(
        'MATERIAL_COVERAGE_LIMITATION_UNRESOLVED'
      );
    }
    const qualifiedSupports = supports.filter(
      (evaluation) => !blockedSupports.includes(evaluation)
    );

    if (qualifiedSupports.length === 0) {
      return makeDecision(aggregate, evaluations, {
        verdict: 'insufficient_evidence',
        score: null,
        reasonCode: DECISION_REASON_CODES.INSUFFICIENT_RETRIEVAL_DATA,
        scoreReason: `Grounded support exists, but a material unresolved coverage limitation applies to every available supporting assessment (${coverageEffect.reasons.join(
          '; '
        )}); adding another source does not itself resolve the missing requirement, so no supported verdict or score is assigned.`,
        primary: [],
        counter: oppositions,
        transition: null,
      });
    }

    const qualifiedRank = maxRank(qualifiedSupports);
    const lowerRankedOpposition = oppositions.filter(
      (evaluation) => evaluation.authorityRank < qualifiedRank
    );
    for (const evaluation of lowerRankedOpposition) {
      evaluation.limitationCodes.push(
        'LOWER_RANKED_OPPOSITION_RESOLVED_BY_AUTHORITY'
      );
    }

    if (qualifiedRank === 2) {
      return makeDecision(aggregate, evaluations, {
        verdict: 'supported',
        score: 100,
        reasonCode: DECISION_REASON_CODES.AUTHORITATIVE_PRIMARY_SUPPORT,
        scoreReason: `Grounded claim-applicable primary authority directly supports the proposition under matching scope and applicable time; no unresolved material conflict remained.${
          blockedSupports.length > 0
            ? ' Coverage-limited supporting assessments were retained as limitations but were not needed for the perfect score.'
            : ''
        }${
          lowerRankedOpposition.length > 0
            ? ' Lower-ranked opposing assessments were recorded but did not override the governing support.'
            : ''
        }`,
        primary: qualifiedSupports,
        counter: oppositions,
        transition: null,
      });
    }

    return makeDecision(aggregate, evaluations, {
      verdict: 'supported',
      score: 75,
      reasonCode: DECISION_REASON_CODES.INDIRECT_CREDIBLE_SUPPORT,
      scoreReason: `Grounded credible-secondary assessments directly support the proposition under matching scope and applicable time; no unresolved material conflict remained.${
        blockedSupports.length > 0
          ? ' Coverage-limited supporting assessments were not counted as primary support, so the qualifying support is credible-secondary rather than authoritative primary.'
          : ''
      }`,
      primary: qualifiedSupports,
      counter: oppositions,
      transition: null,
    });
  }

  // Gate 5: factual uncertainty. Retrieval absence is not proof of falsity.
  for (const evaluation of evaluations) {
    if (evaluation.decisive) {
      evaluation.limitationCodes.push('EVIDENCE_NOT_DECISIVE');
    }
  }
  return makeDecision(aggregate, evaluations, {
    verdict: 'insufficient_evidence',
    score: null,
    reasonCode: DECISION_REASON_CODES.INSUFFICIENT_RETRIEVAL_DATA,
    scoreReason:
      'No eligible assessment satisfied the grounding, scope, applicable-time, authority, and coverage conditions required for a decisive verdict; no score is assigned.',
    primary: [],
    counter: evaluations
      .filter(
        (evaluation) =>
          evaluation.decisive &&
          evaluation.assessment.relationship === 'contradicts'
      )
      .map((evaluation) => evaluation),
    transition: null,
  });
}
