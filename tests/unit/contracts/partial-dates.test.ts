import { describe, expect, it } from 'vitest';
import {
  getDatePrecision,
  isValidCalendarDate,
  isValidCalendarDateOrPartial,
  CalendarDateOrPartialDateSchema,
  CalendarDateOrTimestampSchema,
} from '@/lib/contracts/dates';
import { VerificationPropertySchema } from '@/lib/contracts/claim-ticket';
import { normalizePropertyValue } from '@/server/verify/context-resolver';

describe('Partial Calendar Date Contracts and Validation', () => {
  describe('isValidCalendarDateOrPartial', () => {
    it('accepts valid 4-digit years and detects year precision', () => {
      expect(isValidCalendarDateOrPartial('2023')).toBe(true);
      expect(isValidCalendarDateOrPartial('1999')).toBe(true);
      expect(isValidCalendarDateOrPartial('2030')).toBe(true);
      expect(getDatePrecision('2023')).toBe('year');
    });

    it('accepts valid YYYY-MM partial dates and detects month precision', () => {
      expect(isValidCalendarDateOrPartial('2023-07')).toBe(true);
      expect(isValidCalendarDateOrPartial('2024-01')).toBe(true);
      expect(isValidCalendarDateOrPartial('2024-12')).toBe(true);
      expect(getDatePrecision('2023-07')).toBe('month');
    });

    it('accepts valid YYYY-MM-DD complete dates and detects day precision', () => {
      expect(isValidCalendarDateOrPartial('2023-01-01')).toBe(true);
      expect(isValidCalendarDateOrPartial('2024-02-29')).toBe(true); // leap year
      expect(getDatePrecision('2023-01-01')).toBe('day');
    });

    it('rejects invalid months, days, and leap year mismatches', () => {
      expect(isValidCalendarDateOrPartial('2023-00')).toBe(false); // Month 00
      expect(isValidCalendarDateOrPartial('2023-13')).toBe(false); // Month 13
      expect(isValidCalendarDateOrPartial('2023-02-29')).toBe(false); // 2023 non-leap year
      expect(isValidCalendarDateOrPartial('2023-04-31')).toBe(false); // April has 30 days
      expect(isValidCalendarDateOrPartial('2023-00-15')).toBe(false);
      expect(isValidCalendarDateOrPartial('2023-12-32')).toBe(false);
    });

    it('rejects malformed strings and trailing characters', () => {
      expect(isValidCalendarDateOrPartial('202')).toBe(false);
      expect(isValidCalendarDateOrPartial('20234')).toBe(false);
      expect(isValidCalendarDateOrPartial('2023-7')).toBe(false);
      expect(isValidCalendarDateOrPartial('2023-07-1')).toBe(false);
      expect(isValidCalendarDateOrPartial('2023-07-01trailing')).toBe(false);
      expect(isValidCalendarDateOrPartial(' 2023 ')).toBe(false);
      expect(isValidCalendarDateOrPartial('invalid')).toBe(false);
      expect(isValidCalendarDateOrPartial(null as unknown as string)).toBe(false);
    });
  });

  describe('Unweakened Exact Date Validators', () => {
    it('ensures isValidCalendarDate strictly continues to require YYYY-MM-DD', () => {
      expect(isValidCalendarDate('2023-01-01')).toBe(true);
      expect(isValidCalendarDate('2023')).toBe(false);
      expect(isValidCalendarDate('2023-07')).toBe(false);
    });

    it('ensures CalendarDateOrTimestampSchema strictly continues to require exact date or timestamp', () => {
      expect(CalendarDateOrTimestampSchema.safeParse('2023-01-01').success).toBe(true);
      expect(CalendarDateOrTimestampSchema.safeParse('2023-01-01T00:00:00Z').success).toBe(true);
      expect(CalendarDateOrTimestampSchema.safeParse('2023').success).toBe(false);
      expect(CalendarDateOrTimestampSchema.safeParse('2023-07').success).toBe(false);

      expect(CalendarDateOrPartialDateSchema.safeParse('2023').success).toBe(true);
      expect(CalendarDateOrPartialDateSchema.safeParse('2023-07').success).toBe(true);
      expect(CalendarDateOrPartialDateSchema.safeParse('2023-01-01').success).toBe(true);
    });
  });

  describe('VerificationPropertySchema Partial Date Support', () => {
    it('accepts partial year and month date properties without artificial padding', () => {
      const yearProp = {
        key: 'effectiveYear',
        label: 'Effective Year',
        propertyType: 'date' as const,
        value: '2023',
        origin: 'explicit_claim_text' as const,
        sourceSpan: { start: 0, end: 4, text: '2023' },
        status: 'confirmed' as const,
        applicability: 'claim_level' as const,
      };
      const parsedYear = VerificationPropertySchema.safeParse(yearProp);
      expect(parsedYear.success).toBe(true);

      const monthProp = {
        key: 'effectiveMonth',
        label: 'Effective Month',
        propertyType: 'date' as const,
        value: '2023-07',
        origin: 'explicit_claim_text' as const,
        sourceSpan: { start: 0, end: 7, text: '2023-07' },
        status: 'confirmed' as const,
        applicability: 'claim_level' as const,
      };
      const parsedMonth = VerificationPropertySchema.safeParse(monthProp);
      expect(parsedMonth.success).toBe(true);
    });

    it('accepts exact calendar dates and timestamps', () => {
      const exactProp = {
        key: 'effectiveDate',
        label: 'Effective Date',
        propertyType: 'date' as const,
        value: '2023-01-01',
        origin: 'user_target_context' as const,
        status: 'confirmed' as const,
        applicability: 'run_level' as const,
      };
      expect(VerificationPropertySchema.safeParse(exactProp).success).toBe(true);
    });

    it('rejects invalid partial dates in VerificationProperty', () => {
      const invalidProp = {
        key: 'effectiveDate',
        label: 'Effective Date',
        propertyType: 'date' as const,
        value: '2023-13',
        origin: 'user_target_context' as const,
        status: 'confirmed' as const,
        applicability: 'run_level' as const,
      };
      const parsed = VerificationPropertySchema.safeParse(invalidProp);
      expect(parsed.success).toBe(false);
    });
  });

  describe('normalizePropertyValue', () => {
    it('preserves exact partial date precision without inventing day or month padding', () => {
      expect(normalizePropertyValue('date', '2023')).toBe('2023');
      expect(normalizePropertyValue('date', ' 2023 ')).toBe('2023');
      expect(normalizePropertyValue('date', '2023-07')).toBe('2023-07');
      expect(normalizePropertyValue('date', '2023-01-01')).toBe('2023-01-01');
    });

    it('preserves other primitive types', () => {
      expect(normalizePropertyValue('string', 'hello')).toBe('hello');
      expect(normalizePropertyValue('number', 42)).toBe(42);
      expect(normalizePropertyValue('boolean', true)).toBe(true);
    });
  });
});
