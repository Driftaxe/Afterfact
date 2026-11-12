import {
  isValidCalendarDate,
  isValidCalendarDateOrPartial,
  isValidIsoTimestamp,
} from '@/lib/contracts/dates';

/**
 * Closed calendar interval representing the exact range of a partial or complete date.
 * Both start and end dates are complete ISO calendar dates formatted as YYYY-MM-DD.
 */
export interface DateInterval {
  start: string; // YYYY-MM-DD (inclusive)
  end: string;   // YYYY-MM-DD (inclusive)
  precision: 'year' | 'month' | 'day';
  raw: string;
}

/**
 * Checks whether a 4-digit year is a leap year.
 */
function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

/**
 * Returns the last day of a given month (1-12) for a given year.
 */
function getLastDayOfMonth(year: number, month: number): number {
  const daysInMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return daysInMonth[month - 1];
}

/**
 * Parses a valid partial date (YYYY, YYYY-MM), complete date (YYYY-MM-DD),
 * or ISO timestamp into a bounded DateInterval.
 * Returns null if the input is not a recognized date format.
 */
export function parseDateToInterval(dateStr: string): DateInterval | null {
  if (typeof dateStr !== 'string') return null;
  const trimmed = dateStr.trim();

  // 1. ISO Timestamp with timezone: extract YYYY-MM-DD portion
  if (isValidIsoTimestamp(trimmed)) {
    const dayPart = trimmed.slice(0, 10);
    return {
      start: dayPart,
      end: dayPart,
      precision: 'day',
      raw: trimmed,
    };
  }

  // 2. Partial or complete calendar date
  if (!isValidCalendarDateOrPartial(trimmed)) return null;

  // Year: YYYY
  if (/^\d{4}$/.test(trimmed)) {
    return {
      start: `${trimmed}-01-01`,
      end: `${trimmed}-12-31`,
      precision: 'year',
      raw: trimmed,
    };
  }

  // Year-Month: YYYY-MM
  const ymMatch = trimmed.match(/^(\d{4})-(\d{2})$/);
  if (ymMatch) {
    const year = parseInt(ymMatch[1], 10);
    const month = parseInt(ymMatch[2], 10);
    const lastDay = getLastDayOfMonth(year, month);
    const paddedLastDay = String(lastDay).padStart(2, '0');
    return {
      start: `${trimmed}-01`,
      end: `${trimmed}-${paddedLastDay}`,
      precision: 'month',
      raw: trimmed,
    };
  }

  // Complete date: YYYY-MM-DD
  if (isValidCalendarDate(trimmed)) {
    return {
      start: trimmed,
      end: trimmed,
      precision: 'day',
      raw: trimmed,
    };
  }

  return null;
}

/**
 * Checks whether a given point date (YYYY-MM-DD or timestamp) falls within an interval.
 */
export function isDateWithinInterval(
  pointDateStr: string,
  targetIntervalOrDateStr: string | DateInterval
): boolean {
  const pointInterval = parseDateToInterval(pointDateStr);
  if (!pointInterval) return false;

  const targetInterval =
    typeof targetIntervalOrDateStr === 'string'
      ? parseDateToInterval(targetIntervalOrDateStr)
      : targetIntervalOrDateStr;
  if (!targetInterval) return false;

  return pointInterval.start >= targetInterval.start && pointInterval.end <= targetInterval.end;
}

/**
 * Checks whether two date intervals overlap.
 */
export function doIntervalsOverlap(
  a: string | DateInterval,
  b: string | DateInterval
): boolean {
  const intA = typeof a === 'string' ? parseDateToInterval(a) : a;
  const intB = typeof b === 'string' ? parseDateToInterval(b) : b;
  if (!intA || !intB) return false;

  return intA.start <= intB.end && intA.end >= intB.start;
}

/**
 * Evaluates the temporal applicability of an evidence excerpt against the evaluation target time
 * and explicit claim temporal qualifiers.
 *
 * Distinguishes:
 * - Claim assertion interval (T_claim)
 * - Evaluation target time (T_target)
 * - Effective start (T_effective)
 * - Announcement time (T_announce)
 * - Publication time (T_pub)
 */
export function evaluateTemporalApplicability(params: {
  targetTime: string;
  claimTime?: string | null;
  effectiveDate?: string | null;
  announcementDate?: string | null;
  publicationDate?: string | null;
}): {
  temporalApplicability: 'active_at_target_time' | 'historical_prior' | 'future_pending' | 'undetermined';
  reasoning: string;
} {
  const targetInterval = parseDateToInterval(params.targetTime);
  const targetPoint = targetInterval ? targetInterval.start : params.targetTime;

  // 1. Future pending change: effective date is strictly after evaluation target time
  if (params.effectiveDate) {
    const effInterval = parseDateToInterval(params.effectiveDate);
    if (effInterval && effInterval.start > targetPoint) {
      return {
        temporalApplicability: 'future_pending',
        reasoning: `Effective date ${params.effectiveDate} is in the future relative to target time ${params.targetTime}`,
      };
    }
  }

  // 2. Explicit historical claim interval: claim asserts past state (e.g. "In 2021", "July 2023")
  if (params.claimTime) {
    const claimInterval = parseDateToInterval(params.claimTime);
    if (claimInterval && claimInterval.end < targetPoint) {
      // Claim is explicitly about the past.
      // If evidence date falls within the claim interval, it is contemporaneous with the historical assertion
      if (params.effectiveDate && isDateWithinInterval(params.effectiveDate, claimInterval)) {
        return {
          temporalApplicability: 'historical_prior',
          reasoning: `Evidence effective date ${params.effectiveDate} matches the claim's explicit historical interval [${claimInterval.start}, ${claimInterval.end}]`,
        };
      }
      if (params.publicationDate && isDateWithinInterval(params.publicationDate, claimInterval)) {
        return {
          temporalApplicability: 'historical_prior',
          reasoning: `Evidence publication date ${params.publicationDate} matches the claim's explicit historical interval [${claimInterval.start}, ${claimInterval.end}]`,
        };
      }
      return {
        temporalApplicability: 'historical_prior',
        reasoning: `Claim asserted historical interval ${params.claimTime} prior to target time ${params.targetTime}`,
      };
    }
  }

  // 3. Evidence effective date before or at target time
  if (params.effectiveDate) {
    const effInterval = parseDateToInterval(params.effectiveDate);
    if (effInterval && effInterval.start <= targetPoint) {
      return {
        temporalApplicability: 'active_at_target_time',
        reasoning: `Effective date ${params.effectiveDate} is on or before target time ${params.targetTime}`,
      };
    }
  }

  // 4. Evidence publication date on or before target time (publication alone does not guarantee active validity)
  if (params.publicationDate) {
    const pubInterval = parseDateToInterval(params.publicationDate);
    if (pubInterval && pubInterval.start <= targetPoint) {
      return {
        temporalApplicability: 'active_at_target_time',
        reasoning: `Published ${params.publicationDate} prior to target time ${params.targetTime}`,
      };
    }
  }

  return {
    temporalApplicability: 'undetermined',
    reasoning: `Insufficient temporal markers to decisively place evidence relative to target time ${params.targetTime}`,
  };
}
