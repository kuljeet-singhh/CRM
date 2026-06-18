import { describe, it, expect, vi, afterEach } from 'vitest';
import { accessTokenNeedsRefresh } from './tokenExpiry';

function makeJwt(expSeconds: number): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({ exp: expSeconds }));
  return `${header}.${payload}.signature`;
}

describe('accessTokenNeedsRefresh', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns false for a token expiring well in the future', () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    expect(accessTokenNeedsRefresh(makeJwt(exp))).toBe(false);
  });

  it('returns true for an expired token', () => {
    const exp = Math.floor(Date.now() / 1000) - 60;
    expect(accessTokenNeedsRefresh(makeJwt(exp))).toBe(true);
  });

  it('returns true within the refresh buffer window', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-08T12:00:00Z'));
    const exp = Math.floor(Date.now() / 1000) + 20;
    expect(accessTokenNeedsRefresh(makeJwt(exp), 30_000)).toBe(true);
  });

  it('returns true for malformed tokens', () => {
    expect(accessTokenNeedsRefresh('not-a-jwt')).toBe(true);
  });
});
