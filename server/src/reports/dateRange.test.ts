import { describe, expect, it } from 'vitest';
import {
  bucketKey,
  parseDateRange,
  parseGranularity,
  percentChange,
  toIsoDate,
} from './dateRange.js';

describe('parseDateRange', () => {
  it('defaults to last 30 days when from omitted', () => {
    const result = parseDateRange(undefined, '2026-06-29');
    expect('error' in result).toBe(false);
    if ('error' in result) return;
    expect(toIsoDate(result.to)).toBe('2026-06-29');
    expect(toIsoDate(result.from)).toBe('2026-05-31');
  });

  it('rejects inverted range', () => {
    const result = parseDateRange('2026-06-29', '2026-06-01');
    expect(result).toEqual({ error: 'invalid_range' });
  });

  it('computes previous period of equal length', () => {
    const result = parseDateRange('2026-06-01', '2026-06-07');
    expect('error' in result).toBe(false);
    if ('error' in result) return;
    const ms = result.to.getTime() - result.from.getTime();
    const prevMs = result.previousTo.getTime() - result.previousFrom.getTime();
    expect(prevMs).toBe(ms);
    expect(result.previousTo.getTime()).toBeLessThan(result.from.getTime());
  });
});

describe('parseGranularity', () => {
  it('defaults to day', () => {
    expect(parseGranularity()).toBe('day');
    expect(parseGranularity('invalid')).toBe('day');
  });

  it('accepts week and month', () => {
    expect(parseGranularity('week')).toBe('week');
    expect(parseGranularity('month')).toBe('month');
  });
});

describe('bucketKey', () => {
  it('buckets by day', () => {
    const d = new Date('2026-06-15T14:30:00Z');
    expect(bucketKey(d, 'day')).toBe('2026-06-15');
  });

  it('buckets by month', () => {
    const d = new Date('2026-06-15T14:30:00Z');
    expect(bucketKey(d, 'month')).toBe('2026-06');
  });
});

describe('percentChange', () => {
  it('computes percentage', () => {
    expect(percentChange(110, 100)).toBe(10);
    expect(percentChange(0, 0)).toBe(0);
    expect(percentChange(5, 0)).toBeNull();
  });
});
