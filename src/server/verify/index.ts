// src/server/verify/index.ts

export {
  computeInputHash,
  generateClaimIdentity,
  type ClaimIdentityParams,
  type ClaimIdentity,
} from './identity';

export {
  isSplittingSurrogate,
  findAllOccurrences,
  resolveClaimSpan,
  resolveQualifierSpan,
} from './span-resolver';

export {
  convertUserTargetContext,
  normalizePropertyValue,
} from './context-resolver';

export { extractClaimsFromText } from './extract-claims';

// Stage 1: Research Planning
export {
  generateResearchPlan,
  requiresCounterevidencePolicy,
  type GenerateResearchPlanParams,
  type ResearchPlanOutcome,
  type ResearchGapContext,
} from './research-planner';

// Stage 2: Grounded Evidence Extraction
export {
  extractEvidenceUnits,
  type ExtractEvidenceParams,
  type ExtractEvidenceOutcome,
  type RejectedEvidenceCandidate,
} from './extract-evidence';

// Stage 3: Claim–Evidence Semantic Assessment
export {
  assessEvidenceAgainstClaim,
  type AssessEvidenceParams,
  type AssessEvidenceOutcome,
  type DiscardedAssessment,
} from './assess-evidence';

// Stage 4: Deterministic Decision Gate
export {
  decideClaim,
  DECISION_REASON_CODES,
  type DecideClaimOutcome,
  type DecisionInputIssue,
  type DecisionReasonCode,
} from './decide';

// Stage 5: Timeline & Chronological Transitions (Ticket A07)
export {
  composeTimeline,
  type ComposeTimelineInput,
  type ComposeTimelineResult,
} from './transition';

// Stage 6: Surgical Claim Correction & Re-Verification (Ticket A07)
export {
  isCorrectionEligible,
  buildCorrectionPrompt,
  draftSurgicalReplacement,
  reconstructCandidate,
  reverifyCandidate,
  createExactSpanEdit,
  reconcileMultipleEdits,
  orchestrateClaimCorrection,
  formatUnifiedDiff,
  type GenerateCorrectionInput,
} from './correction';

// Temporal Interval & Validity Utilities
export {
  parseDateToInterval,
  isDateWithinInterval,
  doIntervalsOverlap,
  evaluateTemporalApplicability,
  type DateInterval,
} from './temporal';

// Export correction contracts
export * from '@/lib/contracts/correction';
