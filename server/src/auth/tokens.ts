import { google } from 'googleapis';
import { prisma } from '../db.js';
import { env } from '../env.js';
import { decrypt, encrypt } from './crypto.js';

export async function getAuthorizedClient(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.googleRefreshToken) {
    throw new Error('reauth_required');
  }

  const oauth2 = new google.auth.OAuth2(
    env.googleClientId,
    env.googleClientSecret,
    env.googleRedirectUri
  );

  oauth2.setCredentials({
    access_token: user.googleAccessToken ? decrypt(user.googleAccessToken) : undefined,
    refresh_token: decrypt(user.googleRefreshToken),
    expiry_date: user.tokenExpiry?.getTime(),
  });

  oauth2.on('tokens', async (tokens) => {
    if (!tokens.access_token) return;
    await prisma.user.update({
      where: { id: userId },
      data: {
        googleAccessToken: encrypt(tokens.access_token),
        tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
        ...(tokens.refresh_token ? { googleRefreshToken: encrypt(tokens.refresh_token) } : {}),
      },
    });
  });

  return google.gmail({ version: 'v1', auth: oauth2 });
}

export async function getOutlookAccessToken(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.outlookRefreshToken) throw new Error('reauth_required');

  let accessToken = user.outlookAccessToken ? decrypt(user.outlookAccessToken) : null;
  const expired = !user.outlookTokenExpiry || user.outlookTokenExpiry.getTime() < Date.now() + 60_000;

  if (!accessToken || expired) {
    const params = new URLSearchParams({
      client_id: env.microsoftClientId,
      client_secret: env.microsoftClientSecret,
      refresh_token: decrypt(user.outlookRefreshToken),
      grant_type: 'refresh_token',
      scope: env.microsoftScopes.join(' '),
    });
    const res = await fetch(
      `https://login.microsoftonline.com/${env.microsoftTenantId}/oauth2/v2.0/token`,
      { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params }
    );
    if (!res.ok) throw new Error('reauth_required');
    const data = (await res.json()) as { access_token: string; expires_in: number; refresh_token?: string };
    accessToken = data.access_token;
    await prisma.user.update({
      where: { id: userId },
      data: {
        outlookAccessToken: encrypt(data.access_token),
        outlookTokenExpiry: new Date(Date.now() + data.expires_in * 1000),
        ...(data.refresh_token ? { outlookRefreshToken: encrypt(data.refresh_token) } : {}),
      },
    });
  }

  return accessToken!;
}
