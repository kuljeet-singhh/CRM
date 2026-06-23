import { getGoogleOAuth2, getOutlookAccessToken } from '../auth/tokens.js';
import { env } from '../env.js';

const GOOGLE_CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar';

export function hasGoogleCalendarWriteScope(scopes: string[]): boolean {
  return scopes.some(
    (s) => s === env.googleCalendarWriteScope || s === GOOGLE_CALENDAR_SCOPE
  );
}

export function decodeJwtPayload(token: string): { scp?: string } {
  const parts = token.split('.');
  if (parts.length < 2) return {};
  const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4);
  return JSON.parse(Buffer.from(padded, 'base64').toString('utf8')) as { scp?: string };
}

export function hasOutlookCalendarWriteScope(accessToken: string): boolean {
  const { scp } = decodeJwtPayload(accessToken);
  if (!scp) return false;
  return scp.split(' ').includes(env.outlookCalendarWriteScope);
}

export function parseGoogleScopeString(scope: string | undefined | null): string[] {
  if (!scope) return [];
  return scope.split(/[\s,]+/).filter(Boolean);
}

export async function getGoogleGrantedScopes(userId: string): Promise<string[]> {
  const oauth2 = await getGoogleOAuth2(userId);

  const fromCredentials = parseGoogleScopeString(oauth2.credentials.scope);
  if (fromCredentials.length > 0) return fromCredentials;

  const { token } = await oauth2.getAccessToken();
  if (!token) return [];

  try {
    const info = await oauth2.getTokenInfo(token);
    if (info.scopes?.length) return info.scopes;
    const raw = info as { scope?: string };
    return parseGoogleScopeString(raw.scope);
  } catch {
    return [];
  }
}

export async function probeGoogleCalendarWriteScope(userId: string): Promise<boolean> {
  try {
    const scopes = await getGoogleGrantedScopes(userId);
    return hasGoogleCalendarWriteScope(scopes);
  } catch (err) {
    if ((err as Error).message === 'reauth_required') return false;
    throw err;
  }
}

export async function probeOutlookCalendarWriteScope(userId: string): Promise<boolean> {
  try {
    const token = await getOutlookAccessToken(userId);
    return hasOutlookCalendarWriteScope(token);
  } catch (err) {
    if ((err as Error).message === 'reauth_required') return false;
    throw err;
  }
}
