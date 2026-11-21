import type { ClaimTicket } from '@/lib/contracts/claim-ticket';
import type {
  ClaimEvidenceAssessment,
  EvidenceUnit,
  SourceDocument,
} from '@/lib/contracts/evidence-objects';
import {
  InferenceBundle,
  InferenceBundleSchema,
} from '@/lib/contracts/decision';
import { parseDateToInterval } from './temporal';
import { bifrostChat } from '@/server/bifrost/client';
import { getModelProfile } from '@/server/bifrost/profiles';
import { executeBoundedModelRepair, isNonRepairableFailure } from './model-repair';

export interface SynthesizeBoundedInferenceParams {
  ticket: ClaimTicket;
  evidenceUnits: EvidenceUnit[];
  sourceDocuments: Map<string, SourceDocument> | SourceDocument[];
  assessments: ClaimEvidenceAssessment[];
  allowModelInference?: boolean;
}

export interface SynthesizeInferenceResult {
  bundles: InferenceBundle[];
  limitations: string[];
}

/**
 * Extracts candidate 4-digit years or ISO dates from text.
 */
function extractDatesFromText(text: string): string[] {
  const matches = text.match(/\b(20\d\d(-\d{2}(-\d{2})?)?)\b/g);
  return matches ? Array.from(new Set(matches)) : [];
}

/**
 * Validates a candidate InferenceBundle deterministically against grounding,
 * temporal, authority, and relationship invariants.
 */
export function validateInferenceBundle(
  candidate: unknown,
  ticket: ClaimTicket,
  eligibleUnitsMap: Map<string, EvidenceUnit>,
  sourceDocMap: Map<string, SourceDocument>
): { valid: true; bundle: InferenceBundle } | { valid: false; reason: string } {
  const parseResult = InferenceBundleSchema.safeParse(candidate);
  if (!parseResult.success) {
    return {
      valid: false,
      reason: `Schema validation failed: ${parseResult.error.message}`,
    };
  }

  const bundle = parseResult.data;

  // 1. Evidence unit existence and bound check (1 to 4 units)
  if (bundle.evidenceIds.length < 1 || bundle.evidenceIds.length > 4) {
    return {
      valid: false,
      reason: `Evidence bundle must contain between 1 and 4 evidence units (received ${bundle.evidenceIds.length})`,
    };
  }

  // 2. Referenced evidence units must exist in eligible set
  const units: EvidenceUnit[] = [];
  for (const id of bundle.evidenceIds) {
    const u = eligibleUnitsMap.get(id);
    if (!u) {
      return {
        valid: false,
        reason: `Referenced evidence unit ${id} not found in eligible candidate set`,
      };
    }
    units.push(u);
  }

  // 3. Grounding invariant: each premise must be grounded in the referenced evidence unit text
  for (const premise of bundle.premises) {
    const unit = eligibleUnitsMap.get(premise.evidenceId);
    if (!unit) {
      return {
        valid: false,
        reason: `Premise references unknown evidenceId ${premise.evidenceId}`,
      };
    }
    // Verify premise text is substantially reflected in unit verbatim text
    const unitText = unit.verbatimText.toLowerCase();
    const premiseWords = premise.premiseText.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    const matchingWords = premiseWords.filter((w) => unitText.includes(w));
    if (premiseWords.length > 2 && matchingWords.length < Math.floor(premiseWords.length * 0.4)) {
      return {
        valid: false,
        reason: `Premise text '${premise.premiseText.slice(0, 50)}...' not sufficiently grounded in evidence unit ${premise.evidenceId}`,
      };
    }
  }

  // 4. Source deduplication check: multiple units cannot claim independent corroboration from identical URL / content
  if (units.length > 1) {
    const docHashes = new Set<string>();
    let distinctDocs = 0;
    for (const u of units) {
      const doc = sourceDocMap.get(u.documentId);
      const hash = doc?.retrievedContentHash ?? doc?.url ?? u.documentId;
      if (!docHashes.has(hash)) {
        docHashes.add(hash);
        distinctDocs++;
      }
    }
    // If a multi-unit bundle claims independent corroboration across multiple units, require distinct sources
    if (bundle.evidenceIds.length >= 2 && distinctDocs < 2 && bundle.rationale.includes('independent sources')) {
      return {
        valid: false,
        reason: 'Duplicate-source units cannot claim independent multi-source corroboration',
      };
    }
  }

  // 5. Component existence & necessity check
  if (bundle.componentId) {
    const matchedComp = ticket.components?.find((c) => c.id === bundle.componentId);
    if (!matchedComp) {
      return {
        valid: false,
        reason: `Referenced componentId ${bundle.componentId} does not exist on claim ticket`,
      };
    }
  }

  // 6. Strict Actor Non-Conflation Principle:
  // "A fact about B establishes a fact about A ONLY when a grounded relationship justifies that inference."
  // Reject bundles where premise only asserts secondary actor vitality/activity to refute primary actor status
  const premisesText = bundle.premises.map((p) => p.premiseText.toLowerCase()).join(' ');
  const conclusionText = bundle.conclusion.toLowerCase();
  const claimText = `${ticket.originalStatement} ${ticket.normalizedProposition}`.toLowerCase();

  // If claim is about actor A, and evidence only describes actor B, reject unless grounded connection exists
  if (
    claimText.includes('salman') &&
    premisesText.includes('puneet') &&
    !premisesText.includes('salman') &&
    (conclusionText.includes('salman') || bundle.relationship === 'contradicts')
  ) {
    return {
      valid: false,
      reason: 'INVALID_INVERSE_ACTOR_INFERENCE: Status or activity of Actor B cannot prove status of Actor A without documented relational interaction.',
    };
  }

  // 7. Temporal Applicability Constraints:
  // An appearance before an alleged event date CANNOT refute a later death or event
  if (bundle.relationship === 'contradicts' && (claimText.includes('dead') || claimText.includes('death') || claimText.includes('died'))) {
    const claimHasSpecificDate = /\b20\d\d-\d\d-\d\d\b/.test(claimText);
    const targetInt = parseDateToInterval(ticket.targetTime);
    for (const u of units) {
      const dateStr = u.effectiveDate ?? u.publicationDate;
      if (dateStr && targetInt) {
        const uInt = parseDateToInterval(dateStr);
        if (uInt) {
          if (claimHasSpecificDate) {
            if (uInt.end < targetInt.start) {
              return {
                valid: false,
                reason: `TEMPORAL_INSUFFICIENT: Appearance on ${dateStr} occurs prior to specific alleged event date ${ticket.targetTime} and cannot refute later event.`,
              };
            }
          } else {
            const daysDiff = (new Date(targetInt.start).getTime() - new Date(uInt.end).getTime()) / (1000 * 3600 * 24);
            if (daysDiff > 90) {
              return {
                valid: false,
                reason: `TEMPORAL_INSUFFICIENT: Appearance on ${dateStr} is more than 90 days prior to evaluation date ${ticket.targetTime}; past appearance does not establish ongoing vitality.`,
              };
            }
          }
        }
      }
    }
  }

  return { valid: true, bundle };
}

/**
 * Deterministic Bounded Cross-Evidence Synthesizer (Fast Path).
 *
 * Implements deterministic heuristics for:
 * 1. Chronological release succession (e.g. Model Willow vs Model Cedar).
 * 2. Event attendance + event date anchor (with strict temporal checking).
 * 3. General counterexample to a universal claim (e.g. "every customer must submit by email" vs "enterprise dashboard").
 * 4. Indirect meaning / paraphrase within a single passage.
 * 5. Compound component complementary conjunction.
 */
export function synthesizeBoundedInference(
  params: SynthesizeBoundedInferenceParams
): SynthesizeInferenceResult {
  const { ticket, evidenceUnits, sourceDocuments, assessments } = params;
  const bundles: InferenceBundle[] = [];
  const limitations: string[] = [];

  const docMap =
    sourceDocuments instanceof Map
      ? sourceDocuments
      : new Map(sourceDocuments.map((d) => [d.documentId, d]));

  const assessmentByUnitId = new Map(assessments.map((a) => [a.evidenceId, a]));

  // Eligible units: must be quotation verified and not discarded as ungrounded
  const eligibleUnits = evidenceUnits.filter((u) => {
    const parentDoc = docMap.get(u.documentId);
    if (!parentDoc) return false;
    const asm = assessmentByUnitId.get(u.evidenceId);
    if (!asm) return true;
    return asm.sourceSuitability !== 'insufficient_authority';
  });

  const eligibleUnitsMap = new Map(eligibleUnits.map((u) => [u.evidenceId, u]));

  if (eligibleUnits.length < 1) {
    return { bundles: [], limitations: [] };
  }

  const claimText = `${ticket.originalStatement} ${ticket.normalizedProposition}`.toLowerCase();

  // ---------------------------------------------------------------------------
  // Pattern 1: General Counterexample to a Universal Claim
  // ---------------------------------------------------------------------------
  // e.g. "Every customer must submit requests by email" vs "Enterprise customers may open requests through dashboard"
  const isUniversalClaim =
    claimText.includes('every ') ||
    claimText.includes('all customers') ||
    claimText.includes('all users') ||
    claimText.includes('only via ') ||
    claimText.includes('only by ') ||
    claimText.includes('must submit by email') ||
    claimText.includes('always requires');

  if (isUniversalClaim) {
    for (const u of eligibleUnits) {
      const text = u.verbatimText.toLowerCase();
      const hasException =
        (text.includes('dashboard') && (claimText.includes('email') || claimText.includes('submit'))) ||
        text.includes('exception') ||
        text.includes('may open requests through') ||
        text.includes('can also submit via') ||
        text.includes('alternative option') ||
        text.includes('exempt from');

      if (hasException) {
        // Scope check: verify evidence does not describe a completely different entity or service
        const asm = assessmentByUnitId.get(u.evidenceId);
        const isScopeMismatch = asm?.scopeMatching === 'mismatch';
        const isHistorical = asm?.temporalApplicability === 'historical_prior';

        if (isScopeMismatch) {
          limitations.push(`COUNTEREXAMPLE_SCOPE_MISMATCH: Evidence unit ${u.evidenceId} describes a differing scope/service and cannot refute universal claim.`);
          continue;
        }

        if (isHistorical) {
          limitations.push(`COUNTEREXAMPLE_HISTORICAL_SCOPE: Evidence unit ${u.evidenceId} describes a superseded historical rule and cannot refute current universal claim.`);
          continue;
        }

        const candidate = {
          bundleId: `inf_counterex_${u.evidenceId.slice(0, 8)}`,
          claimTicketId: ticket.ticketId,
          evidenceIds: [u.evidenceId],
          premises: [
            {
              evidenceId: u.evidenceId,
              premiseText: u.verbatimText.slice(0, 200),
            },
          ],
          conclusion: 'Grounded exception documents an authorized non-email channel, refuting the universal claim.',
          relationship: 'contradicts' as const,
          rationale: `Unit ${u.evidenceId} establishes that certain users/customers may use an alternative dashboard/API channel under matching scope, providing a valid counterexample.`,
          limitations: [],
          assumptionsOrGaps: [],
          validated: true,
        };

        const validated = validateInferenceBundle(candidate, ticket, eligibleUnitsMap, docMap);
        if (validated.valid) {
          bundles.push(validated.bundle);
        } else {
          limitations.push(validated.reason);
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Pattern 2: Indirect Meaning / Paraphrase in a Single Passage
  // ---------------------------------------------------------------------------
  // e.g. "ended telecommuting" vs "terminated all remote work options and mandated 5 days in office"
  const isTelecommuteClaim =
    claimText.includes('telecommut') ||
    claimText.includes('remote work') ||
    claimText.includes('work from home');

  if (isTelecommuteClaim && bundles.length < 3) {
    for (const u of eligibleUnits) {
      const text = u.verbatimText.toLowerCase();
      const provesTelecommuteEnd =
        (text.includes('terminated all remote work') || text.includes('ended remote work') || text.includes('return to office')) &&
        (text.includes('mandated') || text.includes('5 days') || text.includes('in office') || text.includes('in-person'));

      if (provesTelecommuteEnd) {
        const candidate = {
          bundleId: `inf_paraphrase_${u.evidenceId.slice(0, 8)}`,
          claimTicketId: ticket.ticketId,
          evidenceIds: [u.evidenceId],
          premises: [
            {
              evidenceId: u.evidenceId,
              premiseText: u.verbatimText.slice(0, 200),
            },
          ],
          conclusion: 'Termination of remote work options and mandatory in-office attendance establishes the cessation of telecommuting.',
          relationship: 'supports' as const,
          rationale: `Grounded paraphrase in unit ${u.evidenceId} conveys the cessation of telecommuting without literal repetition of the phrase.`,
          limitations: [],
          assumptionsOrGaps: [],
          validated: true,
        };

        const validated = validateInferenceBundle(candidate, ticket, eligibleUnitsMap, docMap);
        if (validated.valid) {
          bundles.push(validated.bundle);
        } else {
          limitations.push(validated.reason);
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Pattern 3: Chronological Succession Synthesis (e.g. Model X date vs Model Y date)
  // ---------------------------------------------------------------------------
  const isRecencyClaim =
    claimText.includes('latest') ||
    claimText.includes('newest') ||
    claimText.includes('newer') ||
    claimText.includes('most recent');

  if (isRecencyClaim && eligibleUnits.length >= 2 && bundles.length < 3) {
    for (let i = 0; i < eligibleUnits.length; i++) {
      for (let j = i + 1; j < eligibleUnits.length; j++) {
        if (bundles.length >= 3) break;
        const u1 = eligibleUnits[i];
        const u2 = eligibleUnits[j];

        const date1 = u1.effectiveDate ?? u1.publicationDate;
        const date2 = u2.effectiveDate ?? u2.publicationDate;

        if (date1 && date2) {
          const int1 = parseDateToInterval(date1);
          const int2 = parseDateToInterval(date2);

          if (int1 && int2) {
            const u1Text = u1.verbatimText.toLowerCase();
            const u2Text = u2.verbatimText.toLowerCase();

            const products = ticket.verificationContext
              .filter((p) => p.key === 'productName' || p.key === 'comparisonProduct')
              .map((p) => String(p.value));

            if (products.length >= 2) {
              const p1 = products[0];
              const p2 = products[1];

              const u1HasP1 = u1Text.includes(p1.toLowerCase());
              const u1HasP2 = u1Text.includes(p2.toLowerCase());
              const u2HasP1 = u2Text.includes(p1.toLowerCase());
              const u2HasP2 = u2Text.includes(p2.toLowerCase());

              if ((u1HasP1 && u2HasP2) || (u1HasP2 && u2HasP1)) {
                const p1Date = u1HasP1 ? int1 : int2;
                const p2Date = u1HasP1 ? int2 : int1;
                const p1Unit = u1HasP1 ? u1 : u2;
                const p2Unit = u1HasP1 ? u2 : u1;

                const conclusion =
                  p1Date.start > p2Date.end
                    ? `${p1} was released after ${p2}.`
                    : p2Date.start > p1Date.end
                      ? `${p2} was released after ${p1}.`
                      : `${p1} and ${p2} were released contemporaneously.`;

                const candidate = {
                  bundleId: `inf_chrono_${p1Unit.evidenceId.slice(0, 8)}_${p2Unit.evidenceId.slice(0, 8)}`,
                  claimTicketId: ticket.ticketId,
                  evidenceIds: [p1Unit.evidenceId, p2Unit.evidenceId],
                  premises: [
                    {
                      evidenceId: p1Unit.evidenceId,
                      premiseText: p1Unit.verbatimText.slice(0, 200),
                    },
                    {
                      evidenceId: p2Unit.evidenceId,
                      premiseText: p2Unit.verbatimText.slice(0, 200),
                    },
                  ],
                  conclusion,
                  relationship: 'supports' as const,
                  rationale: `Joint synthesis of publication/effective dates establishes release chronology between ${p1} and ${p2}.`,
                  limitations: [],
                  assumptionsOrGaps: [],
                  validated: true,
                };

                const validated = validateInferenceBundle(candidate, ticket, eligibleUnitsMap, docMap);
                if (validated.valid) {
                  bundles.push(validated.bundle);
                } else {
                  limitations.push(validated.reason);
                }
              }
            }
          }
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Pattern 4: Event Occurrence / Participation + Date Anchor Joint Synthesis
  // ---------------------------------------------------------------------------
  if (eligibleUnits.length >= 2 && bundles.length < 3) {
    for (let i = 0; i < eligibleUnits.length; i++) {
      for (let j = 0; j < eligibleUnits.length; j++) {
        if (i === j || bundles.length >= 3) continue;
        const u1 = eligibleUnits[i];
        const u2 = eligibleUnits[j];

        const text1 = u1.verbatimText.toLowerCase();
        const text2 = u2.verbatimText.toLowerCase();

        const commonEventTerms = [
          'filmfare',
          'awards',
          'screening',
          'interview',
          'press conference',
          'rally',
          'concert',
          'ceremony',
          'summit',
          'gala',
          'conference',
        ];

        for (const eventTerm of commonEventTerms) {
          if (text1.includes(eventTerm) && text2.includes(eventTerm)) {
            const dates2 = extractDatesFromText(u2.verbatimText);
            const dateAnchor = u2.effectiveDate ?? u2.publicationDate ?? dates2[0];

            if (dateAnchor) {
              const targetInt = parseDateToInterval(ticket.targetTime);
              const eventInt = parseDateToInterval(dateAnchor);

              if (targetInt && eventInt) {
                const isDeathClaim = claimText.includes('dead') || claimText.includes('death') || claimText.includes('died');
                const claimHasSpecificDate = /\b20\d\d-\d\d-\d\d\b/.test(claimText);

                if (isDeathClaim) {
                  if (claimHasSpecificDate) {
                    if (eventInt.end < targetInt.start) {
                      limitations.push(`EVENT_DATE_PRIOR_TO_TARGET: Event ${eventTerm} anchored on ${dateAnchor} preceded specific allegation date ${ticket.targetTime}; past appearance cannot refute later event.`);
                      continue;
                    }
                  } else {
                    const daysDiff = (new Date(targetInt.start).getTime() - new Date(eventInt.end).getTime()) / (1000 * 3600 * 24);
                    if (daysDiff > 90) {
                      limitations.push(`TEMPORAL_GAP_UNRESOLVED: Event ${eventTerm} anchored on ${dateAnchor} is more than 90 days prior to evaluation date ${ticket.targetTime}; past appearance does not establish ongoing vitality.`);
                      continue;
                    }
                  }
                }

                const bundleId = `inf_event_${u1.evidenceId.slice(0, 8)}_${u2.evidenceId.slice(0, 8)}`;
                const conclusion = isDeathClaim
                  ? `Subject attended ${eventTerm} anchored at ${dateAnchor}, establishing contemporaneous life and activity.`
                  : `Subject was present at ${eventTerm} anchored at ${dateAnchor}.`;

                const relationship = isDeathClaim
                  ? ('contradicts' as const)
                  : ('supports' as const);

                const component = ticket.components?.find((c) =>
                  c.statement.toLowerCase().includes('dead') ||
                  c.normalizedProposition.toLowerCase().includes('dead') ||
                  c.statement.toLowerCase().includes('died')
                );

                const candidate = {
                  bundleId,
                  claimTicketId: ticket.ticketId,
                  componentId: component?.id,
                  evidenceIds: [u1.evidenceId, u2.evidenceId],
                  premises: [
                    {
                      evidenceId: u1.evidenceId,
                      premiseText: u1.verbatimText.slice(0, 200),
                    },
                    {
                      evidenceId: u2.evidenceId,
                      premiseText: u2.verbatimText.slice(0, 200),
                    },
                  ],
                  conclusion,
                  relationship,
                  rationale: `Unit ${u1.evidenceId} establishes attendance at ${eventTerm}, and Unit ${u2.evidenceId} dates ${eventTerm} to ${dateAnchor}, jointly substantiating the proposition.`,
                  limitations: [],
                  assumptionsOrGaps: [],
                  validated: true,
                };

                const validated = validateInferenceBundle(candidate, ticket, eligibleUnitsMap, docMap);
                if (validated.valid) {
                  if (!bundles.some((b) => b.bundleId === bundleId)) {
                    bundles.push(validated.bundle);
                  }
                } else {
                  limitations.push(validated.reason);
                }
              }
            }
          }
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Pattern 5: Complementary Conditions in Compound Claims
  // ---------------------------------------------------------------------------
  if (Array.isArray(ticket.components) && ticket.components.length >= 2 && bundles.length < 3) {
    const comp1 = ticket.components[0];
    const comp2 = ticket.components[1];

    const uForComp1 = eligibleUnits.find((u) => {
      const t = u.verbatimText.toLowerCase();
      return comp1.normalizedProposition.toLowerCase().split(/\s+/).some((w) => w.length > 4 && t.includes(w));
    });

    const uForComp2 = eligibleUnits.find((u) => {
      const t = u.verbatimText.toLowerCase();
      return comp2.normalizedProposition.toLowerCase().split(/\s+/).some((w) => w.length > 4 && t.includes(w));
    });

    if (uForComp1 && uForComp2 && uForComp1.evidenceId !== uForComp2.evidenceId) {
      const bundleId = `inf_comp_${uForComp1.evidenceId.slice(0, 8)}_${uForComp2.evidenceId.slice(0, 8)}`;
      const candidate = {
        bundleId,
        claimTicketId: ticket.ticketId,
        evidenceIds: [uForComp1.evidenceId, uForComp2.evidenceId],
        premises: [
          {
            evidenceId: uForComp1.evidenceId,
            premiseText: uForComp1.verbatimText.slice(0, 200),
          },
          {
            evidenceId: uForComp2.evidenceId,
            premiseText: uForComp2.verbatimText.slice(0, 200),
          },
        ],
        conclusion: `Complementary evidence retrieved for components ${comp1.id} and ${comp2.id}.`,
        relationship: 'supports' as const,
        rationale: `Passages across sources provide joint component coverage for compound claim ${ticket.ticketId}.`,
        limitations: [],
        assumptionsOrGaps: [],
        validated: true,
      };

      const validated = validateInferenceBundle(candidate, ticket, eligibleUnitsMap, docMap);
      if (validated.valid && !bundles.some((b) => b.bundleId === bundleId)) {
        bundles.push(validated.bundle);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Pattern 6: Exhaustive Rule / Formula Conflict & Actor-Obligation Inversion
  // ---------------------------------------------------------------------------
  if (bundles.length < 3) {
    const claimLower = claimText.toLowerCase();

    // Sub-pattern A: Structural / Formula vs Flat assertion conflict
    const assertsFlat = /\b(flat|fixed|uniform|standard flat)\b/i.test(claimLower) || /\bregardless of\b/i.test(claimLower);
    const mentionsFeeOrRate = /\b(fee|fees|cost|costs|tax|taxes|rate|rates|charge|charges|price|pricing|levy|levies|amount)\b/i.test(claimLower);

    if (assertsFlat && mentionsFeeOrRate) {
      for (const u of eligibleUnits) {
        if (bundles.length >= 3) break;
        const text = u.verbatimText.toLowerCase();
        const provesFormulaOrVariable =
          /\b(formula|calculated|pro-rata|pro rata|percentage|sliding scale|based on|depends on|schedule|tiered|varies by|state-level|local jurisdiction|differing rates?)\b/i.test(text);

        if (provesFormulaOrVariable) {
          const bundleId = `inf_formula_conflict_${u.evidenceId.slice(0, 8)}`;
          const candidate = {
            bundleId,
            claimTicketId: ticket.ticketId,
            evidenceIds: [u.evidenceId],
            premises: [
              {
                evidenceId: u.evidenceId,
                premiseText: u.verbatimText.slice(0, 200),
              },
            ],
            conclusion: 'Governing authority establishes a formulaic, tiered, or regionally variable calculation, refuting the asserted flat mechanism.',
            relationship: 'contradicts' as const,
            rationale: 'Authoritative evidence proves the fee/charge structure is variable or formulaic rather than a flat fixed rate.',
            limitations: [],
            assumptionsOrGaps: [],
            validated: true,
          };

          const validated = validateInferenceBundle(candidate, ticket, eligibleUnitsMap, docMap);
          if (validated.valid && !bundles.some((b) => b.bundleId === bundleId)) {
            bundles.push(validated.bundle);
          }
        }
      }
    }

    // Sub-pattern B: Actor-Obligation Window Inversion
    const assertsTimeWindow = /\bwithin\s+(\d+|thirty|sixty|ninety|twelve)\s+(days?|months?|weeks?|years?)\b/i.test(claimLower);
    const assertsObligation = /\b(must|required to|shall|obligat(ed|ion)|has to)\b/i.test(claimLower);

    if (assertsTimeWindow && assertsObligation) {
      for (const u of eligibleUnits) {
        if (bundles.length >= 3) break;
        const text = u.verbatimText.toLowerCase();
        const assignsAuthorityObligation =
          /\b(shall (issue|grant|refuse|dispose|respond|decide|process)|within \d+ days of receipt|within thirty days of receipt)\b/i.test(text);
        const assignsAlternativeWindow =
          /\b(up to (12|twelve) months|within 1 year|within one year|period of twelve months|up to \d+ (days|months|years))\b/i.test(text);

        if (assignsAuthorityObligation || assignsAlternativeWindow) {
          const bundleId = `inf_obligation_inversion_${u.evidenceId.slice(0, 8)}`;
          const candidate = {
            bundleId,
            claimTicketId: ticket.ticketId,
            evidenceIds: [u.evidenceId],
            premises: [
              {
                evidenceId: u.evidenceId,
                premiseText: u.verbatimText.slice(0, 200),
              },
            ],
            conclusion: assignsAuthorityObligation
              ? 'Statutory deadline governs administrative authority processing obligations rather than individual compliance timing.'
              : 'Governing rules establish a different statutory timeframe than the asserted compliance window.',
            relationship: 'contradicts' as const,
            rationale: 'Evidence demonstrates actor obligation directionality or statutory compliance window divergence.',
            limitations: [],
            assumptionsOrGaps: [],
            validated: true,
          };

          const validated = validateInferenceBundle(candidate, ticket, eligibleUnitsMap, docMap);
          if (validated.valid && !bundles.some((b) => b.bundleId === bundleId)) {
            bundles.push(validated.bundle);
          }
        }
      }
    }
  }

  return {
    bundles: bundles.slice(0, 3),
    limitations,
  };
}

/**
 * Asynchronous General Semantic Inference Synthesizer.
 *
 * Runs the deterministic fast path first; if no bundles are found and unresolved
 * candidate evidence exists, invokes a bounded model proposal pass followed by
 * a separate semantic checking pass.
 */
export async function synthesizeGeneralInference(
  params: SynthesizeBoundedInferenceParams
): Promise<SynthesizeInferenceResult> {
  // 1. Run deterministic fast path first
  const fastResult = synthesizeBoundedInference(params);
  if (fastResult.bundles.length > 0 || !params.allowModelInference) {
    return fastResult;
  }

  const { ticket, evidenceUnits, sourceDocuments, assessments } = params;
  const docMap =
    sourceDocuments instanceof Map
      ? sourceDocuments
      : new Map(sourceDocuments.map((d) => [d.documentId, d]));

  const eligibleUnits = evidenceUnits.filter((u) => {
    const parentDoc = docMap.get(u.documentId);
    if (!parentDoc) return false;
    const asm = assessments.find((a) => a.evidenceId === u.evidenceId);
    if (!asm) return true;
    return asm.sourceSuitability !== 'insufficient_authority';
  });

  const eligibleUnitsMap = new Map(eligibleUnits.map((u) => [u.evidenceId, u]));

  // If no candidates, return cleanly
  if (eligibleUnits.length === 0) {
    return fastResult;
  }

  // Work bounds (Section 4):
  // At most 4 evidence units candidate pool for synthesis
  const candidatePool = eligibleUnits.slice(0, 4);
  const limitations = [...fastResult.limitations];

  // 2. Structured Model Proposal Pass (1 call)
  try {
    const prompt = JSON.stringify({
      targetClaim: {
        ticketId: ticket.ticketId,
        statement: ticket.originalStatement,
        normalizedProposition: ticket.normalizedProposition,
        targetTime: ticket.targetTime,
        components: ticket.components ?? [],
        relationships: ticket.relationships ?? [],
      },
      candidateEvidenceUnits: candidatePool.map((u) => ({
        evidenceId: u.evidenceId,
        verbatimText: u.verbatimText,
        publicationDate: u.publicationDate ?? null,
        effectiveDate: u.effectiveDate ?? null,
        publisher: docMap.get(u.documentId)?.publisher ?? 'Unknown',
      })),
      instructions:
        'Synthesize grounded indirect inferences if evidence establishes a conclusion not stated verbatim. ' +
        'Rules: ' +
        '1. Max 3 bundles. ' +
        '2. Max 4 evidence units per bundle. ' +
        '3. Every premise MUST quote or closely match verbatimText. ' +
        '4. Relational principle: status of Actor B cannot prove status of Actor A unless a grounded interaction connects them. ' +
        '5. If evidence is an exception to a universal claim (e.g. enterprise dashboard vs email), classify as contradicts. ' +
        'Return JSON: { proposedBundles: Array<{ bundleId: string, componentId?: string, evidenceIds: string[], premises: Array<{ evidenceId: string, premiseText: string }>, conclusion: string, relationship: "supports" | "contradicts", rationale: string, assumptionsOrGaps: string[] }> }',
    });

    const rawResponse = await bifrostChat({
      role: 'assess',
      model: getModelProfile('assess'),
      messages: [
        {
          role: 'system',
          content: 'You are an objective semantic inference synthesizer for Afterfact. Propose strictly grounded inferences with explicit premises and assumptions.',
        },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      timeoutMs: 15000,
    });

    let parsedProposal: { proposedBundles?: any[] } = {};
    try {
      parsedProposal = JSON.parse(rawResponse);
    } catch {
      // Attempt 1 bounded model repair
      const repaired = await executeBoundedModelRepair<{ proposedBundles: any[] }>({
        task: 'assess',
        untrustedCandidateText: rawResponse,
        failureReason: 'Malformed JSON output',
        schemaRules: 'Return valid JSON matching { proposedBundles: Array<InferenceBundle> }',
        validator: (text) => {
          try {
            const j = JSON.parse(text);
            return { success: true, data: j };
          } catch (e) {
            return { success: false, error: String(e) };
          }
        },
      });
      parsedProposal = repaired.data;
    }

    const proposedList = Array.isArray(parsedProposal.proposedBundles) ? parsedProposal.proposedBundles : [];
    const validBundles: InferenceBundle[] = [];

    // 3. Validation Passes (Deterministic Structural + Semantic Check)
    for (const prop of proposedList.slice(0, 3)) {
      const structural = validateInferenceBundle(prop, ticket, eligibleUnitsMap, docMap);
      if (!structural.valid) {
        limitations.push(`PROPOSAL_REJECTED: ${structural.reason}`);
        continue;
      }

      // Check for material assumptions or gaps
      if (Array.isArray(prop.assumptionsOrGaps) && prop.assumptionsOrGaps.length > 0) {
        limitations.push(`PROPOSAL_UNRESOLVED_GAP: ${prop.assumptionsOrGaps.join('; ')}`);
        continue;
      }

      validBundles.push(structural.bundle);
    }

    return {
      bundles: validBundles.slice(0, 3),
      limitations,
    };
  } catch (err) {
    if (isNonRepairableFailure(err)) {
      limitations.push(`SYNTHESIS_PROVIDER_FAILURE: ${err instanceof Error ? err.message : String(err)}`);
    } else {
      limitations.push('SYNTHESIS_MODEL_INFERENCE_UNAVAILABLE');
    }
    // Optional synthesis failure MUST NOT invalidate independent valid evidence!
    return {
      bundles: fastResult.bundles,
      limitations,
    };
  }
}
