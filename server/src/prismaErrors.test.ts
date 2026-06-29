import { describe, it, expect } from 'vitest';
import { isPrismaConnectivityError, isPrismaTransientError } from './prismaErrors.js';

describe('isPrismaConnectivityError', () => {
  it('returns true for P1001, P1002, P1017', () => {
    expect(isPrismaConnectivityError({ code: 'P1001' })).toBe(true);
    expect(isPrismaConnectivityError({ code: 'P1002' })).toBe(true);
    expect(isPrismaConnectivityError({ code: 'P1017' })).toBe(true);
  });

  it('returns false for other Prisma codes', () => {
    expect(isPrismaConnectivityError({ code: 'P2024' })).toBe(false);
    expect(isPrismaConnectivityError(new Error('other'))).toBe(false);
  });
});

describe('isPrismaTransientError', () => {
  it('includes connectivity and pool timeout codes', () => {
    expect(isPrismaTransientError({ code: 'P1001' })).toBe(true);
    expect(isPrismaTransientError({ code: 'P1017' })).toBe(true);
    expect(isPrismaTransientError({ code: 'P2024' })).toBe(true);
    expect(isPrismaTransientError({ code: 'P2002' })).toBe(false);
  });
});
