import crypto from 'crypto';
import { env } from '../env.js';

export type OAuthMode = 'login' | 'connect';

export interface OAuthState {
  mode: OAuthMode;
  userId?: string;
  returnTo?: string;
  exp: number;
}

const MAX_AGE_MS = 10 * 60 * 1000;

function sign(data: string): string {
  return crypto.createHmac('sha256', env.sessionSecret).update(data).digest('base64url');
}

export function encodeOAuthState(state: Omit<OAuthState, 'exp'>): string {
  const payload: OAuthState = {
    ...state,
    exp: Date.now() + MAX_AGE_MS,
  };
  const json = JSON.stringify(payload);
  const encoded = Buffer.from(json).toString('base64url');
  const sig = sign(encoded);
  return `${encoded}.${sig}`;
}

export function decodeOAuthState(raw: string | undefined): OAuthState | null {
  if (!raw) return null;
  const [encoded, sig] = raw.split('.');
  if (!encoded || !sig) return null;
  if (sign(encoded) !== sig) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as OAuthState;
    if (!payload.exp || payload.exp < Date.now()) return null;
    if (payload.mode !== 'login' && payload.mode !== 'connect') return null;
    return payload;
  } catch {
    return null;
  }
}

export function safeReturnTo(returnTo: string | undefined, fallback = '/dashboard'): string {
  if (!returnTo || !returnTo.startsWith('/') || returnTo.startsWith('//')) {
    return fallback;
  }
  return returnTo;
}
