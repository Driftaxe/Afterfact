import type { ClaimTicket } from '@/lib/contracts/claim-ticket';
import type {
  ClaimEvidenceAssessment,
  EvidenceUnit,
  SourceDocument,
} from '@/lib/contracts/evidence-objects';
import type { DecisionRecord, TransitionProof } from '@/lib/contracts/decision';
import type { TimelineEntry, TimelineState } from '@/lib/contracts/report';
import { TimelineEntrySchema } from '@/lib/contracts/report';
import {
  parseDateToInterval,
  type DateInterval,
} from './temporal';

export interface ComposeTimelineInput {
  ticket: ClaimTicket;
  decision: DecisionRecord;
  evidenceUnits: EvidenceUnit[];
  transitions?: TransitionProof[];
  assessments?: ClaimEvidenceAssessment[];
  sourceDocuments?: SourceDocument[];
  asOfDate?: string; // Target evaluation date, defaults to ticket.targetTime
}

export interface ComposeTimelineResult {
  timeline: TimelineEntry[];
  limitations: string[];
  hasUpcomingChange: boolean;
  upcomingEffectiveDate: string | null;
}

const STATE_ORDER: Record<TimelineState, number> = {
  historical: 0,
  transition: 1,
  current: 2,
  upcoming: 3,
};

/**
 * Returns the effective date interval for sorting and comparison.
 */
function getInterval(dateStr?: string | null): DateInterval | null {
  if (!dateStr) return null;
  return parseDateToInterval(dateStr);
}

/**
 * Extracts a clean, concise, grounded factual summary from an evidence unit.
 * Strips surrounding markup while strictly preserving verbatim content.
 */
function extractSummaryFromUnit(unit: EvidenceUnit, defaultSummary: string): string {
  if (unit.verbatimText && unit.verbatimText.trim().length > 0) {
    const text = unit.verbatimText.trim();
    // Use first sentence if multiple sentences exist
    const firstPeriod = text.indexOf('. ');
    if (firstPeriod > 20 && firstPeriod < 160) {
      return text.slice(0, firstPeriod + 1);
    }
    if (text.length <= 160) {
      return text;
    }
    return `${text.slice(0, 157)}...`;
  }
  return defaultSummary;
}

/**
 * Deterministically composes evidence-backed Then vs. Now timeline entries.
 * Pure logic; zero model calls, zero ambient clock reads.
 */
export function composeTimeline(input: ComposeTimelineInput): ComposeTimelineResult {
  const { ticket, decision, evidenceUnits, transitions = [], assessments = [], asOfDate } = input;
  const limitations: string[] = [];

  // 1. Validate decision binding and revision
  if (decision.claimTicketId !== ticket.ticketId) {
    return {
      timeline: [],
      limitations: [`Decision record claims ticket ID '${decision.claimTicketId}', not '${ticket.ticketId}'`],
      hasUpcomingChange: false,
      upcomingEffectiveDate: null,
    };
  }

  if (decision.claimRevision !== ticket.revision) {
    return {
      timeline: [],
      limitations: [`Decision evaluated revision ${decision.claimRevision}, not current ticket revision ${ticket.revision}`],
      hasUpcomingChange: false,
      upcomingEffectiveDate: null,
    };
  }

  const targetDateStr = asOfDate || ticket.targetTime;
  const targetInterval = parseDateToInterval(targetDateStr);
  const targetPoint = targetInterval ? targetInterval.start : targetDateStr;

  const evidenceMap = new Map<string, EvidenceUnit>();
  for (const unit of evidenceUnits) {
    evidenceMap.set(unit.evidenceId, unit);
  }

  const assessmentMap = new Map<string, ClaimEvidenceAssessment>();
  for (const asm of assessments) {
    assessmentMap.set(asm.assessmentId, asm);
  }

  const entries: TimelineEntry[] = [];
  let hasUpcomingChange = false;
  let upcomingEffectiveDate: string | null = null;

  // 2. Process Transition Proofs (for Outdated / Superseded claims)
  const validTransitions = transitions.filter(
    (t) =>
      t.claimTicketId === ticket.ticketId &&
      t.claimRevision === ticket.revision &&
      t.basis === 'documented_effective_change' &&
      t.entityAndScopeMatch === 'match'
  );

  for (const trans of validTransitions) {
    const priorAsm = assessmentMap.get(trans.priorAssessmentId);
    const supersedingAsm = assessmentMap.get(trans.supersedingAssessmentId);

    const priorUnit = priorAsm ? evidenceMap.get(priorAsm.evidenceId) : undefined;
    const supersedingUnit = supersedingAsm ? evidenceMap.get(supersedingAsm.evidenceId) : undefined;

    // A. Prior State Entry (Historical)
    if (priorUnit) {
      const priorEffective = priorUnit.effectiveDate || priorUnit.publicationDate || null;
      entries.push({
        state: 'historical',
        effectiveDate: priorEffective,
        announcementDate: null,
        summary: extractSummaryFromUnit(priorUnit, `Earlier documented state established prior to transition.`),
        evidenceId: priorUnit.evidenceId,
      });
    }

    // B. Transition Event Entry
    const transEffective = trans.effectiveDate;
    const transInterval = parseDateToInterval(transEffective);
    const isTransUpcoming = transInterval ? transInterval.start > targetPoint : false;

    if (isTransUpcoming) {
      hasUpcomingChange = true;
      if (!upcomingEffectiveDate || transEffective < upcomingEffectiveDate) {
        upcomingEffectiveDate = transEffective;
      }
    }

    entries.push({
      state: isTransUpcoming ? 'upcoming' : 'transition',
      effectiveDate: transEffective,
      announcementDate: supersedingUnit?.publicationDate || null,
      summary: supersedingUnit
        ? extractSummaryFromUnit(supersedingUnit, `Documented transition effective ${transEffective}.`)
        : `Documented transition effective ${transEffective}.`,
      evidenceId: supersedingUnit?.evidenceId ?? null,
    });

    // C. Superseding State Entry (Current or Upcoming)
    if (supersedingUnit && !isTransUpcoming) {
      entries.push({
        state: 'current',
        effectiveDate: supersedingUnit.effectiveDate || transEffective,
        announcementDate: supersedingUnit.publicationDate || null,
        summary: extractSummaryFromUnit(supersedingUnit, `Superseding state confirmed active at target time.`),
        evidenceId: supersedingUnit.evidenceId,
      });
    }
  }

  // 3. Process Primary Evidence (for Supported claims or current state)
  if (decision.verdict === 'supported') {
    for (const eviId of decision.primaryEvidenceIds) {
      const unit = evidenceMap.get(eviId);
      if (!unit) {
        limitations.push(`Primary evidence ID '${eviId}' not found in provided evidence units`);
        continue;
      }

      const eff = unit.effectiveDate || null;
      const effInterval = getInterval(eff);

      if (effInterval && effInterval.start > targetPoint) {
        // Scheduled future change
        hasUpcomingChange = true;
        if (!upcomingEffectiveDate || (eff && eff < upcomingEffectiveDate)) {
          upcomingEffectiveDate = eff;
        }
        entries.push({
          state: 'upcoming',
          effectiveDate: eff,
          announcementDate: unit.publicationDate || null,
          summary: extractSummaryFromUnit(unit, `Scheduled change effective ${eff}.`),
          evidenceId: unit.evidenceId,
        });
      } else {
        entries.push({
          state: 'current',
          effectiveDate: eff,
          announcementDate: unit.publicationDate || null,
          summary: extractSummaryFromUnit(unit, `Active proposition confirmed at target time.`),
          evidenceId: unit.evidenceId,
        });
      }
    }
  }

  // 4. Process Counter-Evidence (for Contradicted claims)
  if (decision.verdict === 'contradicted') {
    for (const eviId of decision.counterEvidenceIds) {
      const unit = evidenceMap.get(eviId);
      if (!unit) continue;

      const eff = unit.effectiveDate || null;
      const effInterval = getInterval(eff);

      if (effInterval && effInterval.start > targetPoint) {
        hasUpcomingChange = true;
        if (!upcomingEffectiveDate || (eff && eff < upcomingEffectiveDate)) {
          upcomingEffectiveDate = eff;
        }
        entries.push({
          state: 'upcoming',
          effectiveDate: eff,
          announcementDate: unit.publicationDate || null,
          summary: extractSummaryFromUnit(unit, `Upcoming scheduled contradiction effective ${eff}.`),
          evidenceId: unit.evidenceId,
        });
      } else {
        entries.push({
          state: 'current',
          effectiveDate: eff,
          announcementDate: unit.publicationDate || null,
          summary: extractSummaryFromUnit(unit, `Contradicting state confirmed active at target time.`),
          evidenceId: unit.evidenceId,
        });
      }
    }
  }

  // 5. Handle missing transition proof for outdated/contradicted claims
  if (decision.verdict === 'outdated' && validTransitions.length === 0) {
    limitations.push('Outdated verdict has no matching documented TransitionProof; timeline transition entry withheld');
  }

  // 6. Validate & Deduplicate Timeline Entries
  const seenKey = new Set<string>();
  const validEntries: TimelineEntry[] = [];

  for (const rawEntry of entries) {
    // Validate entry conforms to canonical schema
    const parsed = TimelineEntrySchema.safeParse(rawEntry);
    if (!parsed.success) {
      limitations.push(`Invalid timeline entry dropped: ${parsed.error.message}`);
      continue;
    }
    const entry = parsed.data;

    // Disallow dangling evidenceId
    if (entry.evidenceId && !evidenceMap.has(entry.evidenceId)) {
      limitations.push(`Timeline entry references missing evidence ID '${entry.evidenceId}'`);
      entry.evidenceId = null;
    }

    // Deduplicate by state + effectiveDate + evidenceId
    const key = `${entry.state}|${entry.effectiveDate ?? ''}|${entry.evidenceId ?? ''}|${entry.summary}`;
    if (!seenKey.has(key)) {
      seenKey.add(key);
      validEntries.push(entry);
    }
  }

  // 7. Deterministic Sorting:
  // Ascending by effectiveDate interval start, then announcementDate, then state order
  validEntries.sort((a, b) => {
    const intA = getInterval(a.effectiveDate);
    const intB = getInterval(b.effectiveDate);

    if (intA && intB) {
      if (intA.start !== intB.start) {
        return intA.start.localeCompare(intB.start);
      }
    } else if (intA && !intB) {
      return -1;
    } else if (!intA && intB) {
      return 1;
    }

    // Secondary sort by announcement date
    const annA = a.announcementDate || '';
    const annB = b.announcementDate || '';
    if (annA !== annB) {
      return annA.localeCompare(annB);
    }

    // Tertiary sort by canonical state order
    return STATE_ORDER[a.state] - STATE_ORDER[b.state];
  });

  return {
    timeline: validEntries,
    limitations,
    hasUpcomingChange,
    upcomingEffectiveDate,
  };
}
