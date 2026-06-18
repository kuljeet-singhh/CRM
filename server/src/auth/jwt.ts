import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../env.js';

const signOptions = (ttl: string): SignOptions => ({ expiresIn: ttl as SignOptions['expiresIn'] });

export interface AccessTokenPayload {
  sub: string;
  type: 'access';
}

export interface RefreshTokenPayload {
  sub: string;
  jti: string;
  type: 'refresh';
}

export function signAccessToken(userId: string): string {
  const payload: AccessTokenPayload = { sub: userId, type: 'access' };
  return jwt.sign(payload, env.jwtAccessSecret, signOptions(env.jwtAccessTtl));
}

export function signRefreshToken(userId: string, jti: string): string {
  const payload: RefreshTokenPayload = { sub: userId, jti, type: 'refresh' };
  return jwt.sign(payload, env.jwtRefreshSecret, signOptions(env.jwtRefreshTtl));
}

export function verifyAccessToken(token: string): AccessTokenPayload | null {
  try {
    const payload = jwt.verify(token, env.jwtAccessSecret) as AccessTokenPayload;
    if (payload.type !== 'access') return null;
    return payload;
  } catch {
    return null;
  }
}

export function verifyRefreshToken(token: string): RefreshTokenPayload | null {
  try {
    const payload = jwt.verify(token, env.jwtRefreshSecret) as RefreshTokenPayload;
    if (payload.type !== 'refresh' || !payload.jti) return null;
    return payload;
  } catch {
    return null;
  }
}
