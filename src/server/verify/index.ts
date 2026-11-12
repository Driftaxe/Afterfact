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
