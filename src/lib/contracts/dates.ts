import { z } from 'zod';

/**
 * Validates that a string is a strictly formatted, complete ISO 8601 calendar date (YYYY-MM-DD).
 * Rejects trailing text, malformed patterns, impossible months, and impossible days (including leap years).
 */
export function isValidCalendarDate(dateStr: string): boolean {
  if (typeof dateStr !== 'string') return false;
  // Strict regex: exactly 4 digits, dash, 2 digits, dash, 2 digits with nothing else.
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);

  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;

  const isLeapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, isLeapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= daysInMonth[month - 1];
}

/**
 * Validates that a string is a valid ISO 8601 timestamp with explicit timezone information (Z or [+-]HH:MM).
 * Enforces calendar bounds for the date portion, bounds on hours, minutes, and seconds,
 * and valid numeric bounds on timezone offset hours (00-23) and minutes (00-59).
 */
export function isValidIsoTimestamp(timestampStr: string): boolean {
  if (typeof timestampStr !== 'string') return false;
  // Must match YYYY-MM-DDTHH:mm:ss(.sss)?(Z|[+-]HH:MM)
  const match = timestampStr.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|([+-])(\d{2}):(\d{2}))$/
  );
  if (!match) return false;

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);
  const hours = parseInt(match[4], 10);
  const minutes = parseInt(match[5], 10);
  const seconds = parseInt(match[6], 10);

  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;

  const isLeapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, isLeapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (day > daysInMonth[month - 1]) return false;

  if (hours < 0 || hours > 23) return false;
  if (minutes < 0 || minutes > 59) return false;
  if (seconds < 0 || seconds > 59) return false;

  // Validate timezone offset range when not UTC ('Z')
  if (match[7] !== 'Z') {
    const tzHours = parseInt(match[9], 10);
    const tzMinutes = parseInt(match[10], 10);
    if (tzHours < 0 || tzHours > 23) return false;
    if (tzMinutes < 0 || tzMinutes > 59) return false;
  }

  return true;
}

/**
 * Complete calendar date schema (YYYY-MM-DD only).
 */
export const CompleteCalendarDateSchema = z.string().refine(isValidCalendarDate, {
  message: 'Must be a complete, valid calendar date formatted strictly as YYYY-MM-DD',
});

/**
 * ISO 8601 timestamp schema with explicit timezone requirement.
 */
export const IsoTimestampSchema = z.string().refine(isValidIsoTimestamp, {
  message: 'Must be a valid ISO 8601 timestamp with explicit timezone (e.g. YYYY-MM-DDTHH:mm:ssZ or +HH:MM)',
});

/**
 * Accepts either a complete calendar date (YYYY-MM-DD) or an ISO 8601 timestamp with timezone.
 * Preserves source date precision without manufacturing artificial midnight timestamps.
 */
export const CalendarDateOrTimestampSchema = z.string().refine(
  (val) => isValidCalendarDate(val) || isValidIsoTimestamp(val),
  {
    message: 'Must be a complete calendar date (YYYY-MM-DD) or a valid ISO 8601 timestamp with explicit timezone',
  }
);
