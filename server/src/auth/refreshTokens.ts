import crypto from 'crypto';
import { prisma } from '../db.js';
import { env } from '../env.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from './jwt.js';

export const REFRESH_COOKIE_NAME = 'flycrm.refresh';

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function parseRefreshTtlMs(): number {
  const ttl = env.jwtRefreshTtl;
  const match = ttl.match(/^(\d+)([smhd])$/);
  if (!match) return 30 * 24 * 60 * 60 * 1000;
  const n = parseInt(match[1], 10);
  const unit = match[2];
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };
  return n * (multipliers[unit] ?? multipliers.d);
}

export async function issueRefreshTokenOnly(userId: string): Promise<string> {
  const jti = crypto.randomUUID();
  const refreshToken = signRefreshToken(userId, jti);
  const expiresAt = new Date(Date.now() + parseRefreshTtlMs());

  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashToken(refreshToken),
      expiresAt,
    },
  });

  return refreshToken;
}

export async function issueTokenPair(userId: string): Promise<{ accessToken: string; refreshToken: string }> {
  const refreshToken = await issueRefreshTokenOnly(userId);
  return {
    accessToken: signAccessToken(userId),
    refreshToken,
  };
}

export async function isRefreshTokenValid(rawRefreshToken: string, userId: string): Promise<boolean> {
  const payload = verifyRefreshToken(rawRefreshToken);
  if (!payload || payload.sub !== userId) return false;

  const existing = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(rawRefreshToken) },
  });
  return Boolean(
    existing && existing.expiresAt >= new Date() && existing.userId === userId
  );
}

export async function rotateRefreshToken(
  rawRefreshToken: string
): Promise<{ accessToken: string; refreshToken: string; userId: string } | null> {
  const payload = verifyRefreshToken(rawRefreshToken);
  if (!payload) return null;

  const existing = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(rawRefreshToken) },
  });
  if (!existing || existing.expiresAt < new Date() || existing.userId !== payload.sub) {
    if (existing) {
      await prisma.refreshToken.delete({ where: { id: existing.id } });
    }
    return null;
  }

  await prisma.refreshToken.delete({ where: { id: existing.id } });
  const pair = await issueTokenPair(payload.sub);
  return { ...pair, userId: payload.sub };
}

export async function revokeRefreshToken(rawRefreshToken: string): Promise<void> {
  const tokenHash = hashToken(rawRefreshToken);
  await prisma.refreshToken.deleteMany({ where: { tokenHash } });
}

export async function revokeOtherRefreshTokens(userId: string, keepRaw?: string): Promise<void> {
  const keepHash = keepRaw ? hashToken(keepRaw) : undefined;
  await prisma.refreshToken.deleteMany({
    where: keepHash ? { userId, NOT: { tokenHash: keepHash } } : { userId },
  });
}

export function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: env.isProd,
    sameSite: 'lax' as const,
    maxAge: parseRefreshTtlMs(),
    path: '/',
  };
}
