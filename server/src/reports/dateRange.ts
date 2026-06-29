import type { ReportGranularity } from './types.js';

const DEFAULT_RANGE_DAYS = 30;
const MAX_RANGE_DAYS = 366;

export interface ParsedDateRange {
  from: Date;
  to: Date;
  previousFrom: Date;
  previousTo: Date;
}

export function parseIsoDate(value: string | undefined): Date | null {
  if (!value?.trim()) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function startOfDayUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function endOfDayUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
}

export function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function parseDateRange(fromRaw?: string, toRaw?: string): ParsedDateRange | { error: string } {
  const now = new Date();
  let to = parseIsoDate(toRaw) ?? now;
  let from = parseIsoDate(fromRaw);

  if (!from) {
    from = new Date(to);
    from.setUTCDate(from.getUTCDate() - (DEFAULT_RANGE_DAYS - 1));
  }

  from = startOfDayUtc(from);
  to = endOfDayUtc(to);

  if (from > to) {
    return { error: 'invalid_range' };
  }

  const rangeMs = to.getTime() - from.getTime();
  const rangeDays = rangeMs / (24 * 60 * 60 * 1000);
  if (rangeDays > MAX_RANGE_DAYS) {
    return { error: 'range_too_large' };
  }

  const previousTo = new Date(from.getTime() - 1);
  const previousFrom = new Date(previousTo.getTime() - rangeMs);

  return {
    from,
    to,
    previousFrom: startOfDayUtc(previousFrom),
    previousTo: endOfDayUtc(previousTo),
  };
}

export function parseGranularity(raw?: string): ReportGranularity {
  if (raw === 'week' || raw === 'month') return raw;
  return 'day';
}

export function bucketKey(date: Date, granularity: ReportGranularity): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');

  if (granularity === 'month') {
    return `${y}-${m}`;
  }

  if (granularity === 'week') {
    const day = date.getUTCDay();
    const diff = day === 0 ? -6 : 1 - day;
    const monday = new Date(date);
    monday.setUTCDate(date.getUTCDate() + diff);
    return toIsoDate(startOfDayUtc(monday));
  }

  return `${y}-${m}-${d}`;
}

export function fillDateBuckets(
  from: Date,
  to: Date,
  granularity: ReportGranularity
): string[] {
  const keys: string[] = [];
  const cursor = startOfDayUtc(from);
  const end = startOfDayUtc(to);

  while (cursor <= end) {
    keys.push(bucketKey(cursor, granularity));
    if (granularity === 'month') {
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    } else if (granularity === 'week') {
      cursor.setUTCDate(cursor.getUTCDate() + 7);
    } else {
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }

  return [...new Set(keys)];
}

export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) {
    return current === 0 ? 0 : null;
  }
  return Math.round(((current - previous) / previous) * 1000) / 10;
}
