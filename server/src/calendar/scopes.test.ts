import { describe, expect, it, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  getAccessToken: vi.fn(),
  getTokenInfo: vi.fn(),
  getGoogleOAuth2: vi.fn(),
}));

vi.mock('../auth/tokens.js', () => ({
  getGoogleOAuth2: mocks.getGoogleOAuth2,
  getOutlookAccessToken: vi.fn(),
}));

import {
  decodeJwtPayload,
  getGoogleGrantedScopes,
  hasGoogleCalendarWriteScope,
  hasOutlookCalendarWriteScope,
  parseGoogleScopeString,
  probeGoogleCalendarWriteScope,
} from './scopes.js';

function jwtWithScp(scp: string): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ scp })).toString('base64url');
  return `${header}.${payload}.signature`;
}

describe('hasGoogleCalendarWriteScope', () => {
  it('returns true for calendar.events', () => {
    expect(
      hasGoogleCalendarWriteScope([
        'https://www.googleapis.com/auth/calendar.readonly',
        'https://www.googleapis.com/auth/calendar.events',
      ])
    ).toBe(true);
  });

  it('returns true for full calendar scope', () => {
    expect(
      hasGoogleCalendarWriteScope(['https://www.googleapis.com/auth/calendar'])
    ).toBe(true);
  });

  it('returns false for read-only calendar scope', () => {
    expect(
      hasGoogleCalendarWriteScope(['https://www.googleapis.com/auth/calendar.readonly'])
    ).toBe(false);
  });
});

describe('hasOutlookCalendarWriteScope', () => {
  it('returns true when Calendars.ReadWrite is granted', () => {
    const token = jwtWithScp('Mail.ReadWrite Calendars.ReadWrite Mail.Send');
    expect(hasOutlookCalendarWriteScope(token)).toBe(true);
  });

  it('returns false when only Calendars.Read is granted', () => {
    const token = jwtWithScp('Mail.ReadWrite Calendars.Read Mail.Send');
    expect(hasOutlookCalendarWriteScope(token)).toBe(false);
  });
});

describe('decodeJwtPayload', () => {
  it('parses scp claim from access token', () => {
    const token = jwtWithScp('openid profile Calendars.ReadWrite');
    expect(decodeJwtPayload(token).scp).toBe('openid profile Calendars.ReadWrite');
  });
});

describe('parseGoogleScopeString', () => {
  it('splits space-delimited scopes', () => {
    expect(
      parseGoogleScopeString(
        'openid https://www.googleapis.com/auth/calendar.events'
      )
    ).toContain('https://www.googleapis.com/auth/calendar.events');
  });
});

describe('getGoogleGrantedScopes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getGoogleOAuth2.mockResolvedValue({
      credentials: { scope: undefined },
      getAccessToken: mocks.getAccessToken,
      getTokenInfo: mocks.getTokenInfo,
    });
  });

  it('returns scopes from oauth credentials when present', async () => {
    mocks.getGoogleOAuth2.mockResolvedValue({
      credentials: {
        scope: 'https://www.googleapis.com/auth/calendar.events openid',
      },
      getAccessToken: mocks.getAccessToken,
      getTokenInfo: mocks.getTokenInfo,
    });

    const scopes = await getGoogleGrantedScopes('user-1');
    expect(scopes).toContain('https://www.googleapis.com/auth/calendar.events');
    expect(mocks.getTokenInfo).not.toHaveBeenCalled();
  });

  it('returns scopes from getTokenInfo', async () => {
    mocks.getAccessToken.mockResolvedValue({ token: 'access-token' });
    mocks.getTokenInfo.mockResolvedValue({
      scopes: [
        'https://www.googleapis.com/auth/calendar.events',
        'https://www.googleapis.com/auth/gmail.modify',
      ],
    });

    const scopes = await getGoogleGrantedScopes('user-1');
    expect(scopes).toContain('https://www.googleapis.com/auth/calendar.events');
    expect(mocks.getTokenInfo).toHaveBeenCalledWith('access-token');
  });

  it('falls back to scope string on getTokenInfo response', async () => {
    mocks.getAccessToken.mockResolvedValue({ token: 'access-token' });
    mocks.getTokenInfo.mockResolvedValue({
      scope: 'https://www.googleapis.com/auth/calendar.events openid',
    });

    const scopes = await getGoogleGrantedScopes('user-1');
    expect(scopes).toContain('https://www.googleapis.com/auth/calendar.events');
  });

  it('returns empty array when getTokenInfo fails', async () => {
    mocks.getAccessToken.mockResolvedValue({ token: 'access-token' });
    mocks.getTokenInfo.mockRejectedValue(new Error('invalid_token'));

    await expect(getGoogleGrantedScopes('user-1')).resolves.toEqual([]);
  });
});

describe('probeGoogleCalendarWriteScope', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getGoogleOAuth2.mockResolvedValue({
      credentials: { scope: undefined },
      getAccessToken: mocks.getAccessToken,
      getTokenInfo: mocks.getTokenInfo,
    });
  });

  it('returns true when calendar.events is granted', async () => {
    mocks.getAccessToken.mockResolvedValue({ token: 'access-token' });
    mocks.getTokenInfo.mockResolvedValue({
      scopes: ['https://www.googleapis.com/auth/calendar.events'],
    });

    await expect(probeGoogleCalendarWriteScope('user-1')).resolves.toBe(true);
  });

  it('returns false for read-only calendar scope', async () => {
    mocks.getAccessToken.mockResolvedValue({ token: 'access-token' });
    mocks.getTokenInfo.mockResolvedValue({
      scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
    });

    await expect(probeGoogleCalendarWriteScope('user-1')).resolves.toBe(false);
  });

  it('returns false when getTokenInfo fails', async () => {
    mocks.getAccessToken.mockResolvedValue({ token: 'access-token' });
    mocks.getTokenInfo.mockRejectedValue(new Error('invalid_token'));

    await expect(probeGoogleCalendarWriteScope('user-1')).resolves.toBe(false);
  });

  it('returns false on reauth_required', async () => {
    mocks.getGoogleOAuth2.mockRejectedValue(new Error('reauth_required'));

    await expect(probeGoogleCalendarWriteScope('user-1')).resolves.toBe(false);
  });
});
