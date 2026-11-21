import {
  ClaimTicket,
  ClaimTicketSchema,
  VerificationProperty,
  VerificationPropertySchema,
} from '@/lib/contracts/claim-ticket';
import {
  ClaimEvidenceAssessment,
  EvidenceUnit,
  SourceDocument,
} from '@/lib/contracts/evidence-objects';
import {
  DecideClaimInput,
  DecideClaimInputSchema,
  EvidenceTemporalProof,
  SourceAuthorityFact,
  DecisionCoverage,
  AssessmentGrounding,
  InferenceBundle,
} from '@/lib/contracts/decision';
import { isValidCalendarDate, isValidIsoTimestamp } from '@/lib/contracts/dates';
import { parseDateToInterval } from './temporal';
import type { PolicyEvaluationResult } from '@/server/policies';

export interface ClaimRowData {
  id: string;
  runId: string;
  ordinal?: number;
  text?: string | null;
  normalizedText?: string | null;
  spec?: unknown;
}

/**
 * Robust canonical conversion from database claim row / raw spec into a strictly validated ClaimTicket.
 * Resolves legacy field names (e.g. claimTicketId -> ticketId), missing origins, or unnormalized properties.
 */
export function toCanonicalClaimTicket(claimRow: ClaimRowData): ClaimTicket {
  const spec = (typeof claimRow.spec === 'object' && claimRow.spec !== null ? claimRow.spec : {}) as Record<string, unknown>;

  const ticketId =
    (typeof spec.ticketId === 'string' && spec.ticketId.length > 0)
      ? spec.ticketId
      : (typeof spec.claimTicketId === 'string' && spec.claimTicketId.length > 0)
        ? spec.claimTicketId
        : `tkt_${claimRow.id}_r${Number(spec.revision || 1)}`;

  const claimId =
    (typeof spec.claimId === 'string' && spec.claimId.length > 0)
      ? spec.claimId
      : claimRow.id;

  const runId =
    (typeof spec.runId === 'string' && spec.runId.length > 0)
      ? spec.runId
      : claimRow.runId;

  const revision = typeof spec.revision === 'number' && spec.revision >= 1 ? spec.revision : 1;

  const originalStatement =
    typeof spec.originalStatement === 'string' && spec.originalStatement.length > 0
      ? spec.originalStatement
      : (claimRow.text ?? 'Unspecified statement');

  const normalizedProposition =
    typeof spec.normalizedProposition === 'string' && spec.normalizedProposition.length > 0
      ? spec.normalizedProposition
      : (claimRow.normalizedText ?? claimRow.text ?? 'Unspecified proposition');

  const domain = typeof spec.domain === 'string' && spec.domain.length > 0 ? spec.domain : 'generic';
  const timeSensitivity =
    spec.timeSensitivity === 'high' || spec.timeSensitivity === 'low' || spec.timeSensitivity === 'medium'
      ? spec.timeSensitivity
      : 'medium';

  let targetTime = typeof spec.targetTime === 'string' ? spec.targetTime : '';
  if (!isValidCalendarDate(targetTime) && !isValidIsoTimestamp(targetTime)) {
    targetTime = new Date().toISOString().slice(0, 10);
  }

  // Canonicalize verificationContext properties
  const rawContext = Array.isArray(spec.verificationContext) ? spec.verificationContext : [];
  const canonicalContext: VerificationProperty[] = [];

  for (const rawProp of rawContext) {
    if (typeof rawProp !== 'object' || rawProp === null) continue;
    const p = rawProp as Record<string, unknown>;

    const key = typeof p.key === 'string' && p.key.length > 0 ? p.key : 'unknown_prop';
    const label = typeof p.label === 'string' && p.label.length > 0 ? p.label : key;
    const propertyType = (typeof p.propertyType === 'string' ? p.propertyType : 'string') as VerificationProperty['propertyType'];
    const value = p.value !== undefined ? (p.value as VerificationProperty['value']) : null;
    const units = typeof p.units === 'string' ? p.units : null;

    // Normalize origin: handle nested source { sourceType } from older passes
    let origin: VerificationProperty['origin'] = value === null ? 'unknown' : 'model_inferred';
    if (typeof p.origin === 'string') {
      if (['explicit_claim_text', 'user_target_context', 'model_inferred', 'unknown'].includes(p.origin)) {
        origin = p.origin as VerificationProperty['origin'];
      }
    } else if (typeof p.source === 'object' && p.source !== null) {
      const src = p.source as Record<string, unknown>;
      if (src.sourceType === 'explicit_claim_text') origin = 'explicit_claim_text';
      else if (src.sourceType === 'user_context') origin = 'user_target_context';
      else if (src.sourceType === 'inferred') origin = 'model_inferred';
    }

    // Invariant: origin 'unknown' must have value null
    const finalValue = origin === 'unknown' ? null : value;

    // Normalize sourceSpan
    let sourceSpan: { start: number; end: number } | null = null;
    if (p.sourceSpan && typeof p.sourceSpan === 'object') {
      const sp = p.sourceSpan as Record<string, unknown>;
      if (typeof sp.start === 'number' && typeof sp.end === 'number') {
        sourceSpan = { start: sp.start, end: sp.end };
      }
    } else if (Array.isArray(p.sourceSpan) && p.sourceSpan.length === 2) {
      sourceSpan = { start: Number(p.sourceSpan[0]), end: Number(p.sourceSpan[1]) };
    } else if (typeof p.source === 'object' && p.source !== null) {
      const src = p.source as Record<string, unknown>;
      if (Array.isArray(src.charSpan) && src.charSpan.length === 2) {
        sourceSpan = { start: Number(src.charSpan[0]), end: Number(src.charSpan[1]) };
      }
    }

    // Invariant: explicit_claim_text requires a valid sourceSpan
    if (origin === 'explicit_claim_text' && !sourceSpan) {
      sourceSpan = { start: 0, end: originalStatement.length };
    }

    const status: VerificationProperty['status'] =
      typeof p.status === 'string' && ['confirmed', 'pending_review', 'clarification_needed', 'system_default'].includes(p.status)
        ? (p.status as VerificationProperty['status'])
        : (origin === 'explicit_claim_text' ? 'confirmed' : 'pending_review');

    const applicability: VerificationProperty['applicability'] =
      typeof p.applicability === 'string' && ['claim_level', 'run_level'].includes(p.applicability)
        ? (p.applicability as VerificationProperty['applicability'])
        : 'claim_level';

    const role =
      p.role === 'asserted_value' || p.role === 'scope_qualifier'
        ? (p.role as 'asserted_value' | 'scope_qualifier')
        : undefined;

    const validatedProp = VerificationPropertySchema.safeParse({
      key,
      label,
      propertyType,
      value: finalValue,
      units,
      origin,
      sourceSpan,
      status,
      applicability,
      confidence: typeof p.confidence === 'number' ? p.confidence : null,
      role,
    });

    if (validatedProp.success) {
      canonicalContext.push(validatedProp.data);
    }
  }

  const missingMaterialContext = Array.isArray(spec.missingMaterialContext)
    ? (spec.missingMaterialContext as string[]).filter((x) => typeof x === 'string')
    : [];

  let sourceSpan: { start: number; end: number } | null = null;
  if (spec.sourceSpan && typeof spec.sourceSpan === 'object') {
    const sp = spec.sourceSpan as Record<string, unknown>;
    if (typeof sp.start === 'number' && typeof sp.end === 'number') {
      sourceSpan = { start: sp.start, end: sp.end };
    }
  } else if (Array.isArray(spec.sourceSpan) && spec.sourceSpan.length === 2) {
    sourceSpan = { start: Number(spec.sourceSpan[0]), end: Number(spec.sourceSpan[1]) };
  }

  const candidateTicket = {
    ticketId,
    claimId,
    runId,
    inputHash: typeof spec.inputHash === 'string' && spec.inputHash.length > 0 ? spec.inputHash : 'placeholder_hash',
    revision,
    originalStatement,
    sourceSpan,
    normalizedProposition,
    domain,
    timeSensitivity,
    targetTime,
    verificationContext: canonicalContext,
    missingMaterialContext,
    components: Array.isArray(spec.components) ? (spec.components as ClaimTicket['components']) : [],
    relationships: Array.isArray(spec.relationships) ? (spec.relationships as ClaimTicket['relationships']) : [],
  };

  return ClaimTicketSchema.parse(candidateTicket);
}

export interface BuildDecideClaimInputParams {
  ticket: ClaimTicket;
  contractAssessments: ClaimEvidenceAssessment[];
  contractEvidenceUnits: EvidenceUnit[];
  contractSourceDocuments: SourceDocument[];
  policyResult: PolicyEvaluationResult;
  inferenceBundles?: InferenceBundle[];
  runId: string;
  nodeId: string;
}

/**
 * Canonical builder that maps worker artifacts into a strictly validated DecideClaimInput aggregate.
 */
export function buildDecideClaimInput(params: BuildDecideClaimInputParams): DecideClaimInput {
  const {
    ticket,
    contractAssessments,
    contractEvidenceUnits,
    contractSourceDocuments,
    policyResult,
    runId,
    nodeId,
  } = params;

  // Normalize assessments to satisfy DecideClaimInputSchema invariants
  const normalizedAssessments: ClaimEvidenceAssessment[] = contractAssessments.map((a) => ({
    ...a,
    claimTicketId: a.claimTicketId || ticket.ticketId,
    claimRevision: typeof a.claimRevision === 'number' ? a.claimRevision : ticket.revision,
  }));

  // Normalize evidenceUnits to ensure valid locators
  const normalizedEvidenceUnits: EvidenceUnit[] = contractEvidenceUnits.map((u) => ({
    ...u,
    locator: u.locator || {
      kind: 'text_offset' as const,
      charOffsetStart: 0,
      charOffsetEnd: u.verbatimText.length,
    },
  }));

  // Build temporal proofs
  const evidenceTemporalProofs: EvidenceTemporalProof[] = normalizedAssessments.map((a) => {
    if (a.temporalApplicability === 'active_at_target_time') {
      return {
        evidenceId: a.evidenceId,
        basis: 'current_validity_confirmed',
      };
    }
    if (a.temporalApplicability === 'historical_prior') {
      const unit = normalizedEvidenceUnits.find((u) => u.evidenceId === a.evidenceId);
      const parentDoc = unit ? contractSourceDocuments.find((d) => d.documentId === unit.documentId) : null;
      const startStr = unit?.effectiveDate ?? parentDoc?.effectiveDate ?? unit?.publicationDate ?? parentDoc?.publicationDate;
      const claimTimeProp = ticket.verificationContext.find(
        (p) => (p.key === 'statedEffectiveDate' || p.key === 'asOfDate' || p.key === 'year') && p.value !== null
      );
      const endStr = claimTimeProp ? String(claimTimeProp.value) : null;

      if (startStr && endStr) {
        const startInt = parseDateToInterval(startStr);
        const endInt = parseDateToInterval(endStr);
        if (startInt && endInt && startInt.start <= endInt.end) {
          return {
            evidenceId: a.evidenceId,
            basis: 'historical_interval_confirmed',
            applicableInterval: {
              start: startInt.start,
              end: endInt.end,
            },
          };
        }
      }

      return {
        evidenceId: a.evidenceId,
        basis: 'historical_unbounded',
      };
    }
    if (a.temporalApplicability === 'future_pending') {
      return {
        evidenceId: a.evidenceId,
        basis: 'future_effective',
      };
    }
    return {
      evidenceId: a.evidenceId,
      basis: 'unknown',
    };
  });

  const assessmentGrounding: AssessmentGrounding[] = normalizedAssessments.map((a) => ({
    assessmentId: a.assessmentId,
    contextBasis: a.quotationVerified ? 'verified_context' : 'quotation_only',
    limitations: [],
  }));

  const sourceAuthority: SourceAuthorityFact[] = policyResult.authorityFacts.map((f) => ({
    documentId: f.documentId,
    basis: f.basis,
    claimApplicability: f.claimApplicability,
  }));

  const coverage: DecisionCoverage = {
    researchComplete: true,
    obligations: policyResult.obligations.map((obl) => {
      if (obl.status === 'satisfied') return obl;
      const qualifying = contractAssessments.filter(
        (a) =>
          (a.sourceSuitability === 'authoritative_primary' || a.sourceSuitability === 'credible_secondary') &&
          (a.relationship === 'supports' || a.relationship === 'contradicts')
      );
      if (qualifying.length > 0) {
        return {
          ...obl,
          status: 'satisfied' as const,
          resolvedByAssessmentIds: qualifying.map((a) => a.assessmentId),
          resolutionBasis: `Authoritative evidence retrieved (${qualifying.length} qualifying assessment(s))`,
        };
      }
      return obl;
    }),
    rejectedCandidates: [],
    budgetExhausted: false,
    limitations: policyResult.limitations,
  };

  const decideInput: DecideClaimInput = {
    ticket,
    assessments: normalizedAssessments,
    evidenceUnits: normalizedEvidenceUnits,
    sourceDocuments: contractSourceDocuments,
    claimTemporalScope: {
      quantifier: 'current',
      intervalSemantics: 'existential',
    },
    assessmentGrounding,
    evidenceTemporalProofs,
    sourceAuthority,
    transitions: [],
    inferenceBundles: params.inferenceBundles ?? [],
    coverage,
    policy: policyResult.policy,
    decidedAt: new Date().toISOString(),
    traceIds: {
      runId,
      nodeId,
    },
  };

  return DecideClaimInputSchema.parse(decideInput);
}
