import { Router, type Request, type Response } from 'express';
import { google } from 'googleapis';
import { AuthProvider } from '@prisma/client';
import { prisma } from '../db.js';
import { env, isMicrosoftConfigured, isOutlookPushEnabled } from '../env.js';
import { ensureOutlookSubscription } from '../outlook/subscriptionManager.js';
import { encrypt } from './crypto.js';
import { ensurePersonalWorkspace } from '../workspaces/service.js';
import { ensureGmailWatch } from '../gmail/watchManager.js';
import {
  issueTokenPair,
  REFRESH_COOKIE_NAME,
  refreshCookieOptions,
  revokeOtherRefreshTokens,
  revokeRefreshToken,
  rotateRefreshToken,
} from './refreshTokens.js';
import {
  hashPassword,
  isValidEmail,
  isValidPassword,
  normalizeEmail,
  validatePasswordChangeInput,
  verifyPassword,
} from './password.js';
import { getBearerUserId } from './requestAuth.js';
import { toPublicUser } from './userResponse.js';
import {
  decodeOAuthState,
  encodeOAuthState,
  safeReturnTo,
  type OAuthMode,
} from './oauthState.js';
import {
  CONNECT_COOKIE_NAME,
  clearConnectCookie,
  getConnectUserId,
  setConnectCookie,
} from './oauthConnect.js';

export const authRouter = Router();

function googleOAuth2() {
  return new google.auth.OAuth2(
    env.googleClientId,
    env.googleClientSecret,
    env.googleRedirectUri
  );
}

function webRedirect(path: string, params?: Record<string, string>) {
  const url = new URL(path, env.webOrigin);
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  }
  return url.toString();
}

function setRefreshCookie(res: Response, refreshToken: string) {
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions());
}

function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE_NAME, refreshCookieOptions());
}

async function respondWithAuth(res: Response, userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    res.status(500).json({ error: 'user_not_found' });
    return;
  }
  const { accessToken, refreshToken } = await issueTokenPair(userId);
  setRefreshCookie(res, refreshToken);
  res.json({ user: toPublicUser(user), accessToken });
}

function resolveConnectUserId(req: Request): string | undefined {
  return (
    getBearerUserId(req) ??
    getConnectUserId(req.cookies?.[CONNECT_COOKIE_NAME] as string | undefined) ??
    undefined
  );
}

function parseOAuthQuery(req: Request): { mode: OAuthMode; returnTo: string; userId?: string } {
  const mode = (req.query.mode as string) === 'connect' ? 'connect' : 'login';
  const returnTo = safeReturnTo(req.query.returnTo as string | undefined);
  const userId = mode === 'connect' ? resolveConnectUserId(req) : undefined;
  return { mode, returnTo, userId };
}

function buildOAuthState(req: Request): string {
  const { mode, returnTo, userId } = parseOAuthQuery(req);
  if (mode === 'connect' && !userId) {
    throw new Error('connect_requires_auth');
  }
  return encodeOAuthState({ mode, returnTo, userId });
}

authRouter.post('/register', async (req, res) => {
  const { email: rawEmail, password, name } = req.body as {
    email?: string;
    password?: string;
    name?: string;
  };

  if (!rawEmail || !password) {
    res.status(400).json({ error: 'missing_fields' });
    return;
  }
  const email = normalizeEmail(rawEmail);
  if (!isValidEmail(email)) {
    res.status(400).json({ error: 'invalid_email' });
    return;
  }
  if (!isValidPassword(password)) {
    res.status(400).json({ error: 'weak_password' });
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({ error: 'already_registered' });
    return;
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      email,
      name: name?.trim() || null,
      authProvider: AuthProvider.credential,
      passwordHash,
    },
  });
  await ensurePersonalWorkspace(user.id, user.name);
  await respondWithAuth(res, user.id);
});

authRouter.post('/login', async (req, res) => {
  const { email: rawEmail, password } = req.body as { email?: string; password?: string };

  if (!rawEmail || !password) {
    res.status(400).json({ error: 'missing_fields' });
    return;
  }

  const email = normalizeEmail(rawEmail);
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash) {
    if (user && user.authProvider !== AuthProvider.credential) {
      res.status(401).json({ error: 'use_oauth' });
      return;
    }
    res.status(401).json({ error: 'invalid_credentials' });
    return;
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: 'invalid_credentials' });
    return;
  }

  await respondWithAuth(res, user.id);
});

authRouter.post('/refresh', async (req, res) => {
  const raw = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
  if (!raw) {
    res.status(401).json({ error: 'no_refresh_token' });
    return;
  }

  const rotated = await rotateRefreshToken(raw);
  if (!rotated) {
    clearRefreshCookie(res);
    res.status(401).json({ error: 'invalid_refresh_token' });
    return;
  }

  setRefreshCookie(res, rotated.refreshToken);
  res.json({ accessToken: rotated.accessToken });
});

authRouter.post('/logout', async (req, res) => {
  const raw = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
  if (raw) {
    await revokeRefreshToken(raw);
  }
  clearRefreshCookie(res);
  res.json({ ok: true });
});

authRouter.post('/change-password', async (req, res) => {
  const userId = getBearerUserId(req);
  if (!userId) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  if (!user.passwordHash) {
    res.status(400).json({ error: 'no_password' });
    return;
  }

  const { currentPassword, newPassword } = req.body as {
    currentPassword?: string;
    newPassword?: string;
  };

  const validationError = validatePasswordChangeInput(currentPassword, newPassword);
  if (validationError) {
    res.status(400).json({ error: validationError });
    return;
  }

  const valid = await verifyPassword(currentPassword!, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: 'wrong_current_password' });
    return;
  }

  const passwordHash = await hashPassword(newPassword!);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });

  const keepRefresh = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
  await revokeOtherRefreshTokens(userId, keepRefresh);

  res.json({ ok: true });
});

authRouter.post('/connect/init', async (req, res) => {
  const userId = getBearerUserId(req);
  if (!userId) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  const { provider, returnTo } = req.body as { provider?: string; returnTo?: string };
  if (provider !== 'gmail' && provider !== 'outlook') {
    res.status(400).json({ error: 'invalid_provider' });
    return;
  }
  setConnectCookie(res, userId);
  const path = provider === 'gmail' ? '/auth/google' : '/auth/microsoft';
  const safeReturn = safeReturnTo(returnTo, '/settings');
  res.json({ url: `${path}?mode=connect&returnTo=${encodeURIComponent(safeReturn)}` });
});

authRouter.get('/me', async (req, res) => {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    const userId = getBearerUserId(req);
    if (!userId) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    res.json({ user: toPublicUser(user) });
    return;
  }
  res.json({ user: null });
});

authRouter.get('/google', (req, res) => {
  try {
    const state = buildOAuthState(req);
    const url = googleOAuth2().generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: env.googleScopes,
      state,
    });
    res.redirect(url);
  } catch (err) {
    if (err instanceof Error && err.message === 'connect_requires_auth') {
      res.redirect(webRedirect('/sign-in', { error: 'connect_requires_auth' }));
      return;
    }
    res.status(500).json({ error: 'oauth_init_failed' });
  }
});

authRouter.get('/google/callback', async (req, res) => {
  const code = req.query.code as string | undefined;
  const oauthState = decodeOAuthState(req.query.state as string | undefined);

  if (!code) {
    res.redirect(webRedirect('/sign-in', { error: 'oauth_denied' }));
    return;
  }
  if (!oauthState) {
    res.redirect(webRedirect('/sign-in', { error: 'oauth_state_invalid' }));
    return;
  }

  const returnTo = safeReturnTo(oauthState.returnTo);

  try {
    const oauth2 = googleOAuth2();
    const { tokens } = await oauth2.getToken(code);
    oauth2.setCredentials(tokens);

    const oauth2Api = google.oauth2({ version: 'v2', auth: oauth2 });
    const { data: profile } = await oauth2Api.userinfo.get();
    if (!profile.email) {
      res.redirect(webRedirect(returnTo, { error: 'no_email' }));
      return;
    }

    const email = normalizeEmail(profile.email);

    if (oauthState.mode === 'connect') {
      if (!oauthState.userId) {
        res.redirect(webRedirect('/sign-in', { error: 'connect_requires_auth' }));
        return;
      }
      const user = await prisma.user.findUnique({ where: { id: oauthState.userId } });
      if (!user) {
        res.redirect(webRedirect('/sign-in', { error: 'oauth_failed' }));
        return;
      }
      await prisma.user.update({
        where: { id: user.id },
        data: {
          googleAccessToken: tokens.access_token ? encrypt(tokens.access_token) : null,
          googleRefreshToken: tokens.refresh_token ? encrypt(tokens.refresh_token) : undefined,
          tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
        },
      });
      if (user.gmailSyncLabel) {
        try {
          await ensureGmailWatch(user.id);
        } catch {
          /* best-effort */
        }
      }
      clearConnectCookie(res);
      const { accessToken, refreshToken } = await issueTokenPair(user.id);
      setRefreshCookie(res, refreshToken);
      res.redirect(webRedirect(returnTo, { token: accessToken, connected: 'gmail' }));
      return;
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      if (existing.authProvider === AuthProvider.outlook) {
        res.redirect(webRedirect('/sign-in', { error: 'provider_conflict' }));
        return;
      }
      if (existing.authProvider === AuthProvider.credential) {
        const user = await prisma.user.update({
          where: { id: existing.id },
          data: {
            name: profile.name ?? undefined,
            googleAccessToken: tokens.access_token ? encrypt(tokens.access_token) : null,
            googleRefreshToken: tokens.refresh_token ? encrypt(tokens.refresh_token) : undefined,
            tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
          },
        });
        await ensurePersonalWorkspace(user.id, user.name);
        const { accessToken, refreshToken } = await issueTokenPair(user.id);
        setRefreshCookie(res, refreshToken);
        res.redirect(webRedirect(returnTo, { token: accessToken }));
        return;
      }
    }

    const user = await prisma.user.upsert({
      where: { email },
      create: {
        email,
        name: profile.name ?? null,
        authProvider: AuthProvider.gmail,
        googleAccessToken: tokens.access_token ? encrypt(tokens.access_token) : null,
        googleRefreshToken: tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
        tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      },
      update: {
        name: profile.name ?? undefined,
        googleAccessToken: tokens.access_token ? encrypt(tokens.access_token) : undefined,
        googleRefreshToken: tokens.refresh_token ? encrypt(tokens.refresh_token) : undefined,
        tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
      },
    });

    const workspace = await ensurePersonalWorkspace(user.id, user.name);
    if (user.gmailSyncLabel) {
      try {
        await ensureGmailWatch(user.id);
      } catch {
        /* best-effort */
      }
    }

    const { accessToken, refreshToken } = await issueTokenPair(user.id);
    setRefreshCookie(res, refreshToken);
    void workspace;
    res.redirect(webRedirect(returnTo, { token: accessToken }));
  } catch (err) {
    console.error('[auth/google/callback]', err);
    res.redirect(webRedirect('/sign-in', { error: 'oauth_failed' }));
  }
});

authRouter.get('/microsoft', (req, res) => {
  if (!isMicrosoftConfigured()) {
    res.status(503).json({ error: 'microsoft_oauth_not_configured' });
    return;
  }
  try {
    const state = buildOAuthState(req);
    const params = new URLSearchParams({
      client_id: env.microsoftClientId,
      response_type: 'code',
      redirect_uri: env.microsoftRedirectUri,
      scope: env.microsoftScopes.join(' '),
      response_mode: 'query',
      state,
    });
    res.redirect(
      `https://login.microsoftonline.com/${env.microsoftTenantId}/oauth2/v2.0/authorize?${params}`
    );
  } catch (err) {
    if (err instanceof Error && err.message === 'connect_requires_auth') {
      res.redirect(webRedirect('/sign-in', { error: 'connect_requires_auth' }));
      return;
    }
    res.status(500).json({ error: 'oauth_init_failed' });
  }
});

authRouter.get('/microsoft/callback', async (req, res) => {
  if (!isMicrosoftConfigured()) {
    res.status(503).json({ error: 'microsoft_oauth_not_configured' });
    return;
  }

  const code = req.query.code as string | undefined;
  const oauthState = decodeOAuthState(req.query.state as string | undefined);

  if (!code) {
    res.redirect(webRedirect('/sign-in', { error: 'oauth_denied' }));
    return;
  }
  if (!oauthState) {
    res.redirect(webRedirect('/sign-in', { error: 'oauth_state_invalid' }));
    return;
  }

  const returnTo = safeReturnTo(oauthState.returnTo);

  try {
    const tokenRes = await fetch(
      `https://login.microsoftonline.com/${env.microsoftTenantId}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: env.microsoftClientId,
          client_secret: env.microsoftClientSecret,
          code,
          redirect_uri: env.microsoftRedirectUri,
          grant_type: 'authorization_code',
          scope: env.microsoftScopes.join(' '),
        }),
      }
    );
    if (!tokenRes.ok) throw new Error('token_exchange_failed');
    const tokens = (await tokenRes.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
    };

    const meRes = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!meRes.ok) throw new Error('profile_failed');
    const profile = (await meRes.json()) as {
      mail?: string;
      userPrincipalName?: string;
      displayName?: string;
    };
    const rawEmail = profile.mail ?? profile.userPrincipalName;
    if (!rawEmail) {
      res.redirect(webRedirect(returnTo, { error: 'no_email' }));
      return;
    }
    const email = normalizeEmail(rawEmail);

    if (oauthState.mode === 'connect') {
      if (!oauthState.userId) {
        res.redirect(webRedirect('/sign-in', { error: 'connect_requires_auth' }));
        return;
      }
      const user = await prisma.user.findUnique({ where: { id: oauthState.userId } });
      if (!user) {
        res.redirect(webRedirect('/sign-in', { error: 'oauth_failed' }));
        return;
      }
      await prisma.user.update({
        where: { id: user.id },
        data: {
          outlookAccessToken: encrypt(tokens.access_token),
          outlookRefreshToken: tokens.refresh_token ? encrypt(tokens.refresh_token) : undefined,
          outlookTokenExpiry: new Date(Date.now() + tokens.expires_in * 1000),
        },
      });
      if (isOutlookPushEnabled() && user.outlookSyncFolder) {
        void ensureOutlookSubscription(user.id);
      }
      clearConnectCookie(res);
      const { accessToken, refreshToken } = await issueTokenPair(user.id);
      setRefreshCookie(res, refreshToken);
      res.redirect(webRedirect(returnTo, { token: accessToken, connected: 'outlook' }));
      return;
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      if (existing.authProvider === AuthProvider.gmail) {
        res.redirect(webRedirect('/sign-in', { error: 'provider_conflict' }));
        return;
      }
      if (existing.authProvider === AuthProvider.credential) {
        const user = await prisma.user.update({
          where: { id: existing.id },
          data: {
            name: profile.displayName ?? undefined,
            outlookAccessToken: encrypt(tokens.access_token),
            outlookRefreshToken: tokens.refresh_token ? encrypt(tokens.refresh_token) : undefined,
            outlookTokenExpiry: new Date(Date.now() + tokens.expires_in * 1000),
          },
        });
        await ensurePersonalWorkspace(user.id, user.name);
        const { accessToken, refreshToken } = await issueTokenPair(user.id);
        setRefreshCookie(res, refreshToken);
        res.redirect(webRedirect(returnTo, { token: accessToken }));
        return;
      }
    }

    const user = await prisma.user.upsert({
      where: { email },
      create: {
        email,
        name: profile.displayName ?? null,
        authProvider: AuthProvider.outlook,
        outlookAccessToken: encrypt(tokens.access_token),
        outlookRefreshToken: tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
        outlookTokenExpiry: new Date(Date.now() + tokens.expires_in * 1000),
      },
      update: {
        name: profile.displayName ?? undefined,
        outlookAccessToken: encrypt(tokens.access_token),
        outlookRefreshToken: tokens.refresh_token ? encrypt(tokens.refresh_token) : undefined,
        outlookTokenExpiry: new Date(Date.now() + tokens.expires_in * 1000),
      },
    });

    await ensurePersonalWorkspace(user.id, user.name);

    if (isOutlookPushEnabled() && user.outlookSyncFolder) {
      void ensureOutlookSubscription(user.id);
    }

    const { accessToken, refreshToken } = await issueTokenPair(user.id);
    setRefreshCookie(res, refreshToken);
    res.redirect(webRedirect(returnTo, { token: accessToken }));
  } catch (err) {
    console.error('[auth/microsoft/callback]', err);
    res.redirect(webRedirect('/sign-in', { error: 'oauth_failed' }));
  }
});
