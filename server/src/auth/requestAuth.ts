import type { Request } from 'express';
import { verifyAccessToken } from './jwt.js';

export function getBearerUserId(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice(7);
  const payload = verifyAccessToken(token);
  return payload?.sub ?? null;
}
