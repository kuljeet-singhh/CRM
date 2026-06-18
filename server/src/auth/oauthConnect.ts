import crypto from 'crypto';
import type { Response } from 'express';
import { env } from '../env.js';

export const CONNECT_COOKIE_NAME = 'flycrm.oauth_connect';

const MAX_AGE_MS = 10 * 60 * 1000;

function sign(data: string): string {
  return crypto.createHmac('sha256', env.sessionSecret).update(data).digest('base64url');
}

export function setConnectCookie(res: Response, userId: string) {
  const exp = Date.now() + MAX_AGE_MS;
  const payload = `${userId}.${exp}`;
  const sig = sign(payload);
  res.cookie(CONNECT_COOKIE_NAME, `${payload}.${sig}`, {
    httpOnly: true,
    secure: env.isProd,
    sameSite: env.isProd ? 'none' : 'lax',
    maxAge: MAX_AGE_MS,
    path: '/',
  });
}

export function getConnectUserId(cookieValue: string | undefined): string | null {
  if (!cookieValue) return null;
  const [userId, expStr, sig] = cookieValue.split('.');
  if (!userId || !expStr || !sig) return null;
  const payload = `${userId}.${expStr}`;
  if (sign(payload) !== sig) return null;
  const exp = parseInt(expStr, 10);
  if (!exp || exp < Date.now()) return null;
  return userId;
}

export function clearConnectCookie(res: Response) {
  res.clearCookie(CONNECT_COOKIE_NAME, { path: '/' });
}
