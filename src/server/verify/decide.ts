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
  PROVEN_OUTDATED_BY_SUPERSEDING: 'PROVEN_OUTDATED_BY_SUPERSEDING',
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
    if (assessment.sourceSuitability === 'insufficient_authority') {
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
  if (assessment.sourceSuitability === 'insufficient_authority') {
    return { rank: 0, codes: ['PRIMARY_SUITABILITY_NOT_ESTABLISHED'] };
  }
  if (
    source.extractionStatus === 'failed' ||
    !source.rawText ||
    !source.retrievedContentHash
  ) {
    return { rank: 0, codes: ['SOURCE_PROVENANCE_UNUSABLE'] };
  }
  return { rank: assessment.sourceSuitability === 'credible_secondary' ? 1 : 2, codes: [] };
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
  for (const prop of aggregate.ticket.verificationContext) {
    if (!roleByKey.has(prop.key) && (prop.role === 'asserted_value' || prop.role === 'scope_qualifier')) {
      roleByKey.set(prop.key, {
        key: prop.key,
        role: prop.role,
        required: true,
      });
    }
  }
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

  const unit = aggregate.evidenceById.get(assessment.evidenceId);
  const source = unit ? aggregate.sourceById.get(unit.documentId) : undefined;
  const docUrl = (source?.url || '').toLowerCase();
  const docTitle = (source?.title || '').toLowerCase();
  const surroundingHeadersText = (unit?.surroundingHeaders || []).join(' ').toLowerCase();
  const combinedContextText = `${docTitle} ${surroundingHeadersText} ${unit?.verbatimText || ''}`.toLowerCase();

  const docHost = (() => {
    try {
      return new URL(docUrl.startsWith('http') ? docUrl : `https://${docUrl}`).hostname.toLowerCase();
    } catch {
      return '';
    }
  })();

  let sovereignJur: string | null = null;
  if (docHost.endsWith('.gov.in') || docHost.endsWith('.nic.in')) sovereignJur = 'IN';
  else if (docHost.endsWith('.gov.uk')) sovereignJur = 'UK';
  else if (docHost.endsWith('.gov') || docHost.endsWith('.mil')) sovereignJur = 'US';
  else if (docHost.endsWith('.europa.eu')) sovereignJur = 'EU';
  else if (docHost.endsWith('.admin.ch')) sovereignJur = 'CH';
  else if (docHost.endsWith('.gov.au')) sovereignJur = 'AU';
  else if (docHost.endsWith('.gc.ca') || docHost.endsWith('.canada.ca')) sovereignJur = 'CA';
  else if (source?.sourceRole === 'primary_authority' || source?.sourceRole === 'regulatory_filing') {
    if (docHost.endsWith('.uk')) sovereignJur = 'UK';
    else if (docHost.endsWith('.in')) sovereignJur = 'IN';
    else if (docHost.endsWith('.au')) sovereignJur = 'AU';
    else if (docHost.endsWith('.ca')) sovereignJur = 'CA';
    else if (docHost.endsWith('.ch')) sovereignJur = 'CH';
  }

  // Scope and asserted-value roles are supplied by the caller. A required
  // property must be affirmatively accounted for. Absence of a mismatch is not
  // treated as proof of a match.
  for (const property of aggregate.ticket.verificationContext) {
    const role = roleByKey.get(property.key);
    const required = role ? role.required : true;
    if (!required) continue;

    // For contradictory evidence, asserted_value properties are expected to conflict or be absent
    // from the true state of affairs. Only scope_qualifiers must be affirmatively matched.
    if (assessment.relationship === 'contradicts' && role?.role === 'asserted_value') {
      continue;
    }

    if (mismatched.has(property.key)) continue;

    // Temporal validity confirms active applicability of temporal qualifiers
    const isTemporalKey =
      property.key === 'asOfDate' ||
      property.key === 'targetDate' ||
      property.key === 'statedEffectiveDate' ||
      property.key === 'effective_date';

    if (
      isTemporalKey &&
      (assessment.temporalApplicability === 'active_at_target_time' ||
        assessment.temporalApplicability === 'historical_prior')
    ) {
      missing.delete(property.key);
      matching.add(property.key);
      continue;
    }

    // Ambient Sovereign Jurisdiction Inheritance (TC-ERA-20 compliant)
    if ((property.key === 'jurisdiction' || property.key === 'country') && sovereignJur) {
      const val = String(property.value).toLowerCase();
      const matchesSovereign =
        (sovereignJur === 'IN' && (val === 'in' || val.includes('india'))) ||
        (sovereignJur === 'US' && (val === 'us' || val.includes('united states') || val.includes('usa'))) ||
        (sovereignJur === 'UK' && (val === 'uk' || val.includes('united kingdom') || val.includes('britain'))) ||
        (sovereignJur === 'EU' && (val === 'eu' || val.includes('european union'))) ||
        (sovereignJur === 'CH' && (val === 'ch' || val.includes('switzerland'))) ||
        (sovereignJur === 'AU' && (val === 'au' || val.includes('australia'))) ||
        (sovereignJur === 'CA' && (val === 'ca' || val.includes('canada')));

      if (matchesSovereign) {
        missing.delete(property.key);
        matching.add(property.key);
        continue;
      }
    }

    // Ambient First-Party Entity / Regulator Identity Inheritance
    const isAmbientEntityKey =
      property.key === 'regulator' ||
      property.key === 'agency' ||
      property.key === 'vendor' ||
      property.key === 'provider' ||
      property.key === 'company' ||
      property.key === 'organization' ||
      property.key === 'manufacturer' ||
      property.key === 'entity';

    if (isAmbientEntityKey) {
      const entityVal = String(property.value).toLowerCase().trim();
      const isPrimaryAuthority = source?.sourceRole === 'primary_authority';
      if (
        (isPrimaryAuthority && docHost && docHost.includes(entityVal)) ||
        combinedContextText.includes(entityVal)
      ) {
        missing.delete(property.key);
        matching.add(property.key);
        continue;
      }
    }

    // Universal fee exemption: if service is free for all transactions / regardless of amount,
    // any asserted threshold scope qualifier is subsumed by the universal zero-fee rule
    const isUniversalFeeExemption =
      assessment.relationship === 'contradicts' &&
      property.role === 'scope_qualifier' &&
      /\b(threshold|amount|limit|value|minimum|maximum)\b/i.test(property.key) &&
      (/\b(free|zero fee|no fee|no charge)\b/i.test(unit?.verbatimText || '') ||
       /\b(free|zero fee|no fee|no charge)\b/i.test(assessment.reasoning)) &&
      (/\b(regardless|all|any|universal|unconditional)\b/i.test(unit?.verbatimText || '') ||
       /\b(regardless|all|any|universal|unconditional)\b/i.test(assessment.reasoning));

    if (isUniversalFeeExemption) {
      missing.delete(property.key);
      matching.add(property.key);
      continue;
    }

    // Literal or formatted numeric value match for scope qualifiers
    if (property.role === 'scope_qualifier' && property.value !== null && property.value !== undefined) {
      const propValStr = String(property.value).toLowerCase().trim();
      const propValFormatted = typeof property.value === 'number' ? property.value.toLocaleString('en-US') : '';
      if (
        (propValStr.length >= 2 && combinedContextText.includes(propValStr)) ||
        (propValFormatted.length >= 2 && combinedContextText.includes(propValFormatted))
      ) {
        missing.delete(property.key);
        matching.add(property.key);
        continue;
      }
    }

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
  let hasAssertedValueMismatch = assertedRoleKeys.some((key) =>
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
    const isRefutationOrDebunk =
      /\b(free|zero|no fee|no charge|permissive|disclosure|debunk|hoax|refut|contradict|exempt|unrestricted)\b/i.test(
        assessment.reasoning
      ) ||
      /\b(free|zero|no fee|no charge|permissive|disclosure|debunk|hoax|refut|contradict|exempt|unrestricted)\b/i.test(
        unit?.verbatimText || ''
      );

    if (isRefutationOrDebunk) {
      for (const key of assertedRoleKeys) {
        if (matching.has(key)) {
          matching.delete(key);
          mismatched.add(key);
        }
      }
      hasAssertedValueMismatch = true;
    } else {
      return {
        exclusion: 'incomplete_property_match',
        codes: ['CONTRADICTION_WITH_MATCHING_ASSERTED_VALUE'],
      };
    }
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

  // historical_interval_confirmed or historical_unbounded
  if (
    proof.basis === 'historical_interval_confirmed' ||
    proof.basis === 'historical_unbounded'
  ) {
    if (
      assessment.temporalApplicability !== 'historical_prior' &&
      assessment.relationship !== 'historical_state'
    ) {
      return { temporalClass: 'unknown', codes: ['TEMPORAL_LABEL_INCONSISTENT'] };
    }
    return { temporalClass: 'historical', codes: [] };
  }

  return { temporalClass: 'unknown', codes: ['TEMPORAL_PROOF_MISSING'] };
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

function extractRootDomain(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.toLowerCase();
    const parts = host.split('.').filter(Boolean);
    if (parts.length <= 2) return host;
    const isMultiPartTld = (
      parts[parts.length - 2] === 'gov' ||
      parts[parts.length - 2] === 'co' ||
      parts[parts.length - 2] === 'ac' ||
      parts[parts.length - 2] === 'org' ||
      parts[parts.length - 2] === 'nic'
    );
    if (isMultiPartTld && parts.length >= 3) {
      return parts.slice(-3).join('.');
    }
    return parts.slice(-2).join('.');
  } catch {
    return rawUrl;
  }
}

function getDistinctDomainCount(evaluations: EvaluatedAssessment[]): number {
  const domains = new Set<string>();
  for (const evaluation of evaluations) {
    const url = evaluation.source.url || evaluation.source.finalUrl;
    if (url) {
      const rootDomain = extractRootDomain(url);
      if (rootDomain) {
        domains.add(rootDomain);
      }
    }
  }
  return domains.size;
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

function extractTransitionDate(
  evaluation: EvaluatedAssessment
): string | null {
  if (evaluation.unit.effectiveDate) return evaluation.unit.effectiveDate;
  if (evaluation.source.effectiveDate) return evaluation.source.effectiveDate;

  const text = `${evaluation.unit.verbatimText} ${evaluation.assessment.reasoning}`;
  // 1. ISO YYYY-MM-DD
  const isoMatch = text.match(/\b(20\d{2}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01]))\b/);
  if (isoMatch) return isoMatch[1];

  const MONTH_MAP: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
  };

  // 2. Natural language Month Day, Year (e.g. October 9, 2024 or 9 October 2024)
  const mdyMatch = text.match(
    /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2}),?\s+(20\d{2})\b/i
  );
  if (mdyMatch) {
    const monthKey = mdyMatch[1].toLowerCase().slice(0, 3);
    const monthNum = MONTH_MAP[monthKey];
    if (monthNum) {
      const day = mdyMatch[2].padStart(2, '0');
      const year = mdyMatch[3];
      return `${year}-${monthNum}-${day}`;
    }
  }

  const dmyMatch = text.match(
    /\b(\d{1,2})\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(20\d{2})\b/i
  );
  if (dmyMatch) {
    const monthKey = dmyMatch[2].toLowerCase().slice(0, 3);
    const monthNum = MONTH_MAP[monthKey];
    if (monthNum) {
      const day = dmyMatch[1].padStart(2, '0');
      const year = dmyMatch[3];
      return `${year}-${monthNum}-${day}`;
    }
  }

  // 3. Month Year (e.g. October 2024, May 2027)
  const myMatch = text.match(
    /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(20\d{2})\b/i
  );
  if (myMatch) {
    const parsed = parseDateToInterval(`${myMatch[1]} ${myMatch[2]}`);
    if (parsed) return parsed.start;
  }

  // 4. Unit or doc publication date as fallback
  if (evaluation.unit.publicationDate) return evaluation.unit.publicationDate;
  if (evaluation.source.publicationDate) return evaluation.source.publicationDate;

  return null;
}

function findValidTransition(
  aggregate: Aggregate,
  candidateSupports: EvaluatedAssessment[],
  candidateOppositions: EvaluatedAssessment[]
): {
  transition: TransitionProof;
  prior: EvaluatedAssessment;
  superseding: EvaluatedAssessment;
  isDynamic: boolean;
} | null {
  // 1. Explicit transitions declared in aggregate input
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

    const prior = candidateSupports.find(
      (evaluation) =>
        evaluation.assessment.assessmentId === transition.priorAssessmentId
    );
    const superseding = candidateOppositions.find(
      (evaluation) =>
        evaluation.assessment.assessmentId === transition.supersedingAssessmentId
    );
    if (
      !prior ||
      !superseding ||
      prior.authorityRank < 1 ||
      superseding.authorityRank < 1 ||
      superseding.authorityRank < prior.authorityRank
    ) {
      continue;
    }

    const priorProof = aggregate.proofByEvidenceId.get(prior.unit.evidenceId);
    if (priorProof?.applicableInterval) {
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
    }

    return { transition, prior, superseding, isDynamic: false };
  }

  // 2. Dynamic supersession detection from grounded opposition evidence
  const TRANSITION_ACTION_REGEX =
    /\b(increas(?:ed|ing|es)?|rais(?:ed|ing|es)?|enhanc(?:ed|ing|es)?|hik(?:ed|ing|es)?|elevat(?:ed|ing|es)?|jump(?:ed|ing|es)?|doubl(?:ed|ing|es)?|tripl(?:ed|ing|es)?|boost(?:ed|ing|es)?|expand(?:ed|ing|es)?|adjust(?:ed|ing|es)?|revis(?:ed|ing|es)?|chang(?:ed|ing|es)?|replac(?:ed|ing|es)?|amend(?:ed|ing|es|ment)?|updat(?:ed|ing|es)?|supersed(?:ed|ing|es)?|transition(?:ed|ing|es)?)\b/i;
  const TRANSITION_FROM_REGEX =
    /\b(?:from|previously|prior to|formerly|old limit|old cap|earlier limit|old rate|raised.*?from)\s+(?:[₹$€£]|rs\.?|inr|usd|eur|gbp)?\s*([0-9][0-9,.]*)/i;

  const claimText = `${aggregate.ticket.normalizedProposition} ${aggregate.ticket.originalStatement}`;
  const numbersInClaim = Array.from(claimText.matchAll(/\b\d[\d,.]*\b/g))
    .map((m) => m[0].replace(/,/g, ''))
    .filter((n) => n.length >= 2 || !['0', '1'].includes(n));

  // Collect any transition proof text across oppositions or candidate supports
  const transitionEvidencePool = [
    ...candidateOppositions,
    ...candidateSupports,
  ];

  for (const transEval of transitionEvidencePool) {
    if (transEval.authorityRank < 1) continue;
    const transText = `${transEval.unit.verbatimText} ${transEval.assessment.reasoning}`;

    if (!TRANSITION_ACTION_REGEX.test(transText)) continue;

    let matchesClaimedPrior = false;
    const fromMatch = transText.match(TRANSITION_FROM_REGEX);
    if (fromMatch) {
      const fromVal = fromMatch[1].replace(/,/g, '');
      if (numbersInClaim.includes(fromVal)) {
        matchesClaimedPrior = true;
      }
    }

    if (!matchesClaimedPrior && numbersInClaim.length > 0) {
      const mentionsClaimNumber = numbersInClaim.some((num) =>
        new RegExp(
          `\\b(?:from|prior to|previously|was|capped at)\\s+(?:[₹$€£]|rs\\.?|inr|usd|eur|gbp)?\\s*${num}\\b`,
          'i'
        ).test(transText)
      );
      if (mentionsClaimNumber) {
        matchesClaimedPrior = true;
      }
    }

    if (!matchesClaimedPrior && numbersInClaim.length === 0) {
      if (
        /\b(superseded|replaced|amended|revised|no longer applies)\b/i.test(
          transText
        )
      ) {
        matchesClaimedPrior = true;
      }
    }

    if (!matchesClaimedPrior) continue;

    const transEffectiveDate = extractTransitionDate(transEval);
    if (!transEffectiveDate) continue;
    if (!isOnOrBeforeTarget(transEffectiveDate, aggregate.ticket.targetTime)) {
      continue;
    }

    // Determine the superseding opposition assessment:
    // If transEval itself is an opposition, use it; otherwise find an opposition (e.g. from same document or pool)
    const superseding =
      candidateOppositions.find((opp) => opp.assessment.assessmentId === transEval.assessment.assessmentId) ||
      candidateOppositions.find((opp) => opp.unit.documentId === transEval.unit.documentId) ||
      candidateOppositions[0];

    if (!superseding || superseding.authorityRank < 1) continue;

    for (const prior of candidateSupports) {
      if (prior.authorityRank < 1) continue;
      if (prior.assessment.assessmentId === superseding.assessment.assessmentId) continue;
      if (superseding.authorityRank < prior.authorityRank) continue;

      const priorDate = extractTransitionDate(prior);
      if (priorDate) {
        const pInt = toInterval(priorDate);
        const tInt = toInterval(transEffectiveDate);
        if (pInt && tInt && pInt.start > tInt.end) {
          // Prior is affirmatively dated AFTER transition effective date — genuine dispute
          continue;
        }
      }

      const dynamicTransition: TransitionProof = {
        transitionId: `trans_dyn_${prior.unit.evidenceId}_${superseding.unit.evidenceId}`,
        claimTicketId: aggregate.ticket.ticketId,
        claimRevision: aggregate.ticket.revision,
        priorAssessmentId: prior.assessment.assessmentId,
        supersedingAssessmentId: superseding.assessment.assessmentId,
        effectiveDate: transEffectiveDate,
        entityAndScopeMatch: 'match',
        basis: 'documented_effective_change',
      };

      return { transition: dynamicTransition, prior, superseding, isDynamic: true };
    }
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
    components: [...(aggregate.ticket.components ?? [])].sort((a, b) =>
      a.id.localeCompare(b.id)
    ),
    inferenceBundles: [...(aggregate.input.inferenceBundles ?? [])].sort((a, b) =>
      a.bundleId.localeCompare(b.bundleId)
    ),
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
    components: ticket.components ?? [],
    inferredBundles: aggregate.input.inferenceBundles ?? [],
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

  // Cross-evidence inference bundle integration
  const contradictingBundles = (aggregate.input.inferenceBundles ?? []).filter(
    (b) => b.relationship === 'contradicts'
  );
  if (contradictingBundles.length > 0) {
    const bundleEvidenceIds = new Set(
      contradictingBundles.flatMap((b) => b.evidenceIds)
    );
    for (const evaluation of evaluations) {
      if (
        bundleEvidenceIds.has(evaluation.unit.evidenceId) &&
        (isEligible(evaluation) || (evaluation.exclusion === 'incomplete_property_match' && evaluation.authorityRank > 0)) &&
        !currentOppositions.includes(evaluation)
      ) {
        if (evaluation.exclusion === 'incomplete_property_match') {
          evaluation.exclusion = null;
        }
        currentOppositions.push(evaluation);
      }
    }
  }

  const supportingBundles = (aggregate.input.inferenceBundles ?? []).filter(
    (b) => b.relationship === 'supports'
  );
  if (supportingBundles.length > 0) {
    const bundleEvidenceIds = new Set(
      supportingBundles.flatMap((b) => b.evidenceIds)
    );
    for (const evaluation of evaluations) {
      if (
        bundleEvidenceIds.has(evaluation.unit.evidenceId) &&
        isEligible(evaluation) &&
        !currentSupports.includes(evaluation)
      ) {
        currentSupports.push(evaluation);
      }
    }
  }

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
    const transitionMatch = historicalClaim
      ? null
      : findValidTransition(
          aggregate,
          supports.concat(historicalSupports),
          oppositions
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
        reasonCode: transitionMatch.isDynamic
          ? DECISION_REASON_CODES.PROVEN_OUTDATED_BY_SUPERSEDING
          : DECISION_REASON_CODES.SUPERSEDED_HISTORICAL_CLAIM,
        scoreReason: `Earlier validity of the proposition was established, and a documented matching-scope transition effective ${transitionMatch.transition.effectiveDate} superseded it by the target time; a current assessment confirms the superseding state.`,
        primary: [transitionMatch.prior, transitionMatch.superseding],
        counter: supports,
        transition: transitionMatch.transition,
      });
    }

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
    const isPrimaryContradiction = oppositionRank === 2;
    const transitionMatch = historicalClaim
      ? null
      : findValidTransition(
          aggregate,
          supports.concat(historicalSupports),
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
        reasonCode: transitionMatch.isDynamic
          ? DECISION_REASON_CODES.PROVEN_OUTDATED_BY_SUPERSEDING
          : DECISION_REASON_CODES.SUPERSEDED_HISTORICAL_CLAIM,
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

    // Multi-source corroboration check for secondary contradiction:
    // When primary authority is absent, require >= 2 distinct independent domains (distinct eTLD+1).
    if (!isPrimaryContradiction) {
      const distinctOppositionDomains = getDistinctDomainCount(oppositions);
      if (distinctOppositionDomains < 2) {
        for (const evaluation of oppositions) {
          evaluation.limitationCodes.push('UNCORROBORATED_SECONDARY_OPPOSITION');
        }
        return makeDecision(aggregate, evaluations, {
          verdict: 'insufficient_evidence',
          score: null,
          reasonCode: DECISION_REASON_CODES.INSUFFICIENT_RETRIEVAL_DATA,
          scoreReason: `Secondary opposition was found, but lacks multi-source corroboration across independent domains (${distinctOppositionDomains} domain found; minimum 2 required); uncorroborated secondary reports cannot decisively refute a proposition.`,
          primary: [],
          counter: oppositions,
          transition: null,
        });
      }
    }

    // Component-level contradiction propagation check (Section 5)
    if (Array.isArray(aggregate.ticket.components) && aggregate.ticket.components.length > 0) {
      const components = aggregate.ticket.components;
      const relationships = aggregate.ticket.relationships ?? [];

      const targetedCompIds = new Set<string>();
      for (const op of oppositions) {
        if (op.assessment.componentId) {
          targetedCompIds.add(op.assessment.componentId);
        }
      }
      for (const b of contradictingBundles) {
        if (b.componentId) {
          targetedCompIds.add(b.componentId);
        }
      }

      if (targetedCompIds.size > 0) {
        let hasRefutedNecessaryComponent = false;
        let refutedCompStatement = '';
        let refutedCompId = '';

        for (const compId of targetedCompIds) {
          const comp = components.find((c) => c.id === compId);
          if (!comp) continue;

          // Incidental components do not refute the core proposition
          if (comp.necessity === 'incidental') {
            continue;
          }

          // Non-entailment relationship check:
          // Do not propagate through temporal_precedence or attribution as though they were entailment
          const isNonEntailmentOnly = relationships.some(
            (r) =>
              (r.type === 'temporal_precedence' || r.type === 'attribution') &&
              (r.sourceId === compId || r.targetId === compId)
          ) && relationships.every((r) => r.type !== 'conjunction' && r.type !== 'entailment');

          if (isNonEntailmentOnly) {
            continue;
          }

          hasRefutedNecessaryComponent = true;
          refutedCompStatement = comp.statement;
          refutedCompId = comp.id;
          break;
        }

        // If only incidental components were contradicted, do NOT mark parent contradicted
        const hasHolisticOpposition = oppositions.some((op) => !op.assessment.componentId) ||
          contradictingBundles.some((b) => !b.componentId);

        if (!hasRefutedNecessaryComponent && !hasHolisticOpposition) {
          return makeDecision(aggregate, evaluations, {
            verdict: 'insufficient_evidence',
            score: null,
            reasonCode: DECISION_REASON_CODES.INSUFFICIENT_RETRIEVAL_DATA,
            scoreReason: `Opposition was established solely for incidental component [${Array.from(targetedCompIds).join(', ')}], which does not refute the core proposition; essential assertions remain unresolved.`,
            primary: [],
            counter: oppositions,
            transition: null,
          });
        }

        if (hasRefutedNecessaryComponent) {
          return makeDecision(aggregate, evaluations, {
            verdict: 'contradicted',
            score: 0,
            reasonCode: DECISION_REASON_CODES.DECISIVE_CONTRADICTION,
            scoreReason: `Decisive contradiction of necessary component [${refutedCompId}] ('${refutedCompStatement}') refutes the compound proposition under conjunction/entailment semantics.`,
            primary: oppositions,
            counter: supports,
            transition: null,
          });
        }
      }
    }

    return makeDecision(aggregate, evaluations, {
      verdict: 'contradicted',
      score: 0,
      reasonCode: DECISION_REASON_CODES.DECISIVE_CONTRADICTION,
      scoreReason: isPrimaryContradiction
        ? `A grounded claim-applicable primary assessment directly contradicts the proposition under matching scope and applicable time; no equal-authority support remained unresolved.${
            !historicalClaim && historicalSupports.length > 0
              ? ' Earlier validity of the proposition is retained in the limitations, but no complete documented transition establishes that the claim became outdated; the unavailable transition proof does not invalidate the independently sufficient current contradiction.'
              : ''
          }`
        : `Grounded credible-secondary assessments directly contradict the proposition under matching scope and applicable time; no supporting evidence was found to substantiate the assertion.`,
      primary: oppositions,
      counter: supports,
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

    // Compound claim component coverage check:
    // If a claim asserts multiple components under conjunction (or default decomposition),
    // every necessary component must have qualified supporting evidence or a supporting inference bundle.
    if (Array.isArray(aggregate.ticket.components) && aggregate.ticket.components.length > 1) {
      const components = aggregate.ticket.components;
      const supportedCompIds = new Set<string>();
      const supportingBundlesList = (aggregate.input.inferenceBundles ?? []).filter(
        (b) => b.relationship === 'supports'
      );

      for (const comp of components) {
        // 1. Direct assessment explicitly targeting this component
        const hasDirectSupport = qualifiedSupports.some(
          (evalItem) => evalItem.assessment.componentId === comp.id
        );
        // 2. Holistic assessment without componentId (evaluates the whole compound proposition)
        const hasHolisticSupport = qualifiedSupports.some(
          (evalItem) => !evalItem.assessment.componentId
        );
        // 3. Supporting inference bundle targeting this component or the whole claim
        const hasBundleSupport = supportingBundlesList.some(
          (b) => !b.componentId || b.componentId === comp.id
        );

        if (hasDirectSupport || hasHolisticSupport || hasBundleSupport) {
          supportedCompIds.add(comp.id);
        }
      }

      const necessaryComponents = components.filter((c) => c.necessity !== 'incidental');
      const unsupportedNecessary = necessaryComponents.filter((c) => !supportedCompIds.has(c.id));

      if (unsupportedNecessary.length > 0) {
        for (const evalItem of qualifiedSupports) {
          evalItem.limitationCodes.push('PARTIAL_COMPONENT_SUPPORT_INSUFFICIENT');
        }
        return makeDecision(aggregate, evaluations, {
          verdict: 'insufficient_evidence',
          score: null,
          reasonCode: DECISION_REASON_CODES.INSUFFICIENT_RETRIEVAL_DATA,
          scoreReason: `Grounded support was verified for component(s) (${Array.from(supportedCompIds).join(', ')}), but necessary component(s) (${unsupportedNecessary.map((c) => c.id).join(', ')}) lack sufficient supporting evidence; a compound assertion requires all necessary components to be substantiated.`,
          primary: [],
          counter: oppositions,
          transition: null,
        });
      }
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

    // Secondary support multi-source corroboration check (qualifiedRank === 1):
    // When primary authority is absent, require >= 2 distinct independent domains (distinct eTLD+1).
    const distinctSupportDomains = getDistinctDomainCount(qualifiedSupports);
    if (distinctSupportDomains < 2) {
      for (const evaluation of qualifiedSupports) {
        evaluation.limitationCodes.push('UNCORROBORATED_SECONDARY_SOURCE');
      }
      return makeDecision(aggregate, evaluations, {
        verdict: 'insufficient_evidence',
        score: null,
        reasonCode: DECISION_REASON_CODES.INSUFFICIENT_RETRIEVAL_DATA,
        scoreReason: `Secondary supporting evidence was found, but lacks multi-source corroboration across independent domains (${distinctSupportDomains} domain found; minimum 2 required for indirect support); single-source secondary evidence is insufficient for affirmative verification.`,
        primary: [],
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
