import { describe, expect, it } from 'vitest';
import {
  doIntervalsOverlap,
  evaluateTemporalApplicability,
  isDateWithinInterval,
  parseDateToInterval,
} from '@/server/verify/temporal';

describe('Temporal Interval and Validity Evaluation', () => {
  describe('parseDateToInterval', () => {
    it('parses year partial date to full calendar year interval', () => {
      const interval = parseDateToInterval('2023');
      expect(interval).toEqual({
        start: '2023-01-01',
        end: '2023-12-31',
        precision: 'year',
        raw: '2023',
      });
    });

    it('parses month partial date with exact month day bounds including leap years', () => {
      const jul = parseDateToInterval('2023-07');
      expect(jul).toEqual({
        start: '2023-07-01',
        end: '2023-07-31',
        precision: 'month',
        raw: '2023-07',
      });

      const febLeap = parseDateToInterval('2024-02');
      expect(febLeap).toEqual({
        start: '2024-02-01',
        end: '2024-02-29',
        precision: 'month',
        raw: '2024-02',
      });

      const febNonLeap = parseDateToInterval('2023-02');
      expect(febNonLeap).toEqual({
        start: '2023-02-01',
        end: '2023-02-28',
        precision: 'month',
        raw: '2023-02',
      });
    });

    it('parses complete calendar date to single-day interval', () => {
      const jan1 = parseDateToInterval('2023-01-01');
      expect(jan1).toEqual({
        start: '2023-01-01',
        end: '2023-01-01',
        precision: 'day',
        raw: '2023-01-01',
      });
    });

    it('parses ISO timestamp with timezone', () => {
      const ts = parseDateToInterval('2023-06-15T14:30:00Z');
      expect(ts).toEqual({
        start: '2023-06-15',
        end: '2023-06-15',
        precision: 'day',
        raw: '2023-06-15T14:30:00Z',
      });
    });

    it('returns null for invalid date strings', () => {
      expect(parseDateToInterval('invalid')).toBeNull();
      expect(parseDateToInterval('2023-13')).toBeNull();
      expect(parseDateToInterval('2023-02-29')).toBeNull();
    });
  });

  describe('isDateWithinInterval and doIntervalsOverlap', () => {
    it('verifies dates falling inside year and month intervals', () => {
      expect(isDateWithinInterval('2023-06-15', '2023')).toBe(true);
      expect(isDateWithinInterval('2023-01-01', '2023')).toBe(true);
      expect(isDateWithinInterval('2023-12-31', '2023')).toBe(true);
      expect(isDateWithinInterval('2024-01-01', '2023')).toBe(false);

      expect(isDateWithinInterval('2023-07-14', '2023-07')).toBe(true);
      expect(isDateWithinInterval('2023-08-01', '2023-07')).toBe(false);
    });

    it('verifies overlap between intervals', () => {
      expect(doIntervalsOverlap('2023-07', '2023')).toBe(true);
      expect(doIntervalsOverlap('2023-07-15', '2023-07')).toBe(true);
      expect(doIntervalsOverlap('2024-01', '2023')).toBe(false);
    });
  });

  describe('evaluateTemporalApplicability (Binding Policy Cases)', () => {
    it('Case A & Historical Scope: Preserves explicit historical claim interval without supersession false contradiction', () => {
      // Claim: "The price was $10 in 2021" evaluated at targetTime 2026-11-08
      const res = evaluateTemporalApplicability({
        targetTime: '2026-11-08',
        claimTime: '2021',
        effectiveDate: '2021-01-01',
      });
      expect(res.temporalApplicability).toBe('historical_prior');
      expect(res.reasoning).toContain('matches the claim\'s explicit historical interval');
    });

    it('Case C: Publication in August does not place a July event outside July', () => {
      const res = evaluateTemporalApplicability({
        targetTime: '2026-11-08',
        claimTime: '2023-07',
        effectiveDate: '2023-07-15',
        publicationDate: '2023-08-10',
      });
      expect(res.temporalApplicability).toBe('historical_prior');
      expect(res.reasoning).toContain('matches the claim\'s explicit historical interval');
    });

    it('Case F: Future effective change does not invalidate current state', () => {
      const res = evaluateTemporalApplicability({
        targetTime: '2026-11-08',
        effectiveDate: '2027-01-01',
        publicationDate: '2026-11-01',
      });
      expect(res.temporalApplicability).toBe('future_pending');
      expect(res.reasoning).toContain('is in the future relative to target time');
    });

    it('Case E: Effective start before target time is active_at_target_time', () => {
      const res = evaluateTemporalApplicability({
        targetTime: '2026-11-08',
        effectiveDate: '2025-01-01',
      });
      expect(res.temporalApplicability).toBe('active_at_target_time');
    });

    it('Publication date alone never establishes active validity at target time', () => {
      const res = evaluateTemporalApplicability({
        targetTime: '2026-11-08',
        publicationDate: '2020-05-15',
      });
      expect(res.temporalApplicability).toBe('undetermined');
      expect(res.reasoning).toContain('publication date alone does not establish active validity');
    });

    it('Subsequent evidence effective date does not match historical claim interval', () => {
      // Historical claim for 2021, evidence is from 2023
      const res = evaluateTemporalApplicability({
        targetTime: '2026-11-08',
        claimTime: '2021',
        effectiveDate: '2023-01-01',
      });
      expect(res.temporalApplicability).toBe('undetermined');
      expect(res.reasoning).toContain('subsequent to historical claim interval');
    });

    it('returns undetermined when insufficient temporal markers are available', () => {
      const res = evaluateTemporalApplicability({
        targetTime: '2026-11-08',
      });
      expect(res.temporalApplicability).toBe('undetermined');
    });
  });
});
