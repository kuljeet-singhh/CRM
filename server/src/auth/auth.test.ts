import { describe, it, expect } from 'vitest';
import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from './jwt.js';
import {
  hashPassword,
  isValidEmail,
  isValidPassword,
  normalizeEmail,
  validatePasswordChangeInput,
  verifyPassword,
} from './password.js';
import { decodeOAuthState, encodeOAuthState, safeReturnTo } from './oauthState.js';

describe('password helpers', () => {
  it('validates email and password rules', () => {
    expect(isValidEmail('user@example.com')).toBe(true);
    expect(isValidEmail('bad')).toBe(false);
    expect(isValidPassword('short')).toBe(false);
    expect(isValidPassword('longenough')).toBe(true);
    expect(normalizeEmail('  User@Example.COM ')).toBe('user@example.com');
  });

  it('hashes and verifies passwords', async () => {
    const hash = await hashPassword('testpassword1');
    expect(await verifyPassword('testpassword1', hash)).toBe(true);
    expect(await verifyPassword('wrong', hash)).toBe(false);
  });
});

describe('validatePasswordChangeInput', () => {
  it('rejects missing fields', () => {
    expect(validatePasswordChangeInput(undefined, 'newpassword1')).toBe('missing_fields');
    expect(validatePasswordChangeInput('current1', undefined)).toBe('missing_fields');
    expect(validatePasswordChangeInput('', 'newpassword1')).toBe('missing_fields');
  });

  it('rejects weak new password', () => {
    expect(validatePasswordChangeInput('current1', 'short')).toBe('weak_password');
  });

  it('rejects same password', () => {
    expect(validatePasswordChangeInput('samepassword1', 'samepassword1')).toBe('same_password');
  });

  it('accepts valid change', () => {
    expect(validatePasswordChangeInput('oldpassword1', 'newpassword1')).toBeNull();
  });
});

describe('jwt helpers', () => {
  it('signs and verifies access tokens', () => {
    const token = signAccessToken('user-1');
    const payload = verifyAccessToken(token);
    expect(payload?.sub).toBe('user-1');
    expect(payload?.type).toBe('access');
  });

  it('signs and verifies refresh tokens', () => {
    const token = signRefreshToken('user-1', 'jti-abc');
    const payload = verifyRefreshToken(token);
    expect(payload?.sub).toBe('user-1');
    expect(payload?.jti).toBe('jti-abc');
    expect(payload?.type).toBe('refresh');
  });

  it('rejects tampered tokens', () => {
    const token = signAccessToken('user-1');
    expect(verifyAccessToken(token.slice(0, -1) + 'x')).toBeNull();
  });
});

describe('oauth state', () => {
  it('round-trips login state', () => {
    const raw = encodeOAuthState({ mode: 'login', returnTo: '/dashboard' });
    const decoded = decodeOAuthState(raw);
    expect(decoded?.mode).toBe('login');
    expect(decoded?.returnTo).toBe('/dashboard');
  });

  it('round-trips connect state with userId', () => {
    const raw = encodeOAuthState({
      mode: 'connect',
      userId: 'user-42',
      returnTo: '/settings',
    });
    const decoded = decodeOAuthState(raw);
    expect(decoded?.mode).toBe('connect');
    expect(decoded?.userId).toBe('user-42');
  });

  it('rejects tampered state', () => {
    const raw = encodeOAuthState({ mode: 'login' });
    const tampered = raw.slice(0, -2) + 'xx';
    expect(decodeOAuthState(tampered)).toBeNull();
  });

  it('sanitizes returnTo paths', () => {
    expect(safeReturnTo('/settings')).toBe('/settings');
    expect(safeReturnTo('//evil.com')).toBe('/dashboard');
    expect(safeReturnTo(undefined, '/sign-in')).toBe('/sign-in');
  });
});
