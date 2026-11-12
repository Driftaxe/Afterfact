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

// Temporal Interval & Validity Utilities
export {
  parseDateToInterval,
  isDateWithinInterval,
  doIntervalsOverlap,
  evaluateTemporalApplicability,
  type DateInterval,
} from './temporal';

