import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { signAccessToken } from './jwt.js';

vi.mock('../db.js', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
  },
}));

vi.mock('../env.js', () => ({
  env: {
    webOrigin: 'http://localhost:5173',
    googleClientId: 'test',
    googleClientSecret: 'test',
    googleRedirectUri: 'http://localhost:3000/auth/google/callback',
    googleScopes: [],
    jwtAccessSecret: 'test-access-secret-test-access!!',
    jwtRefreshSecret: 'test-refresh-secret-test-refresh',
    jwtAccessTtl: '15m',
    jwtRefreshTtl: '30d',
    isProd: false,
    encryptionKey: Buffer.alloc(32).toString('base64'),
    sessionSecret: 'test-secret',
    databaseUrl: 'postgresql://localhost/test',
    microsoftClientId: '',
    microsoftClientSecret: '',
    microsoftRedirectUri: '',
    microsoftTenantId: 'common',
    microsoftScopes: [],
    outlookWebhookUrl: '',
    outlookWebhookClientState: '',
    cronSecret: '',
    gmailPubsubTopic: '',
    googleWebhookAudience: '',
    syncWorkerPollMs: 2000,
    syncWorkerBatchSize: 5,
    port: 3000,
  },
  isMicrosoftConfigured: () => false,
  isOutlookPushEnabled: () => false,
}));

import { authRouter } from './routes.js';
import { prisma } from '../db.js';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/auth', authRouter);
  return app;
}

describe('GET /auth/me', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 with user null when no Authorization header', async () => {
    const res = await request(createApp()).get('/auth/me');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ user: null });
  });

  it('returns 401 when bearer token is invalid', async () => {
    const res = await request(createApp())
      .get('/auth/me')
      .set('Authorization', 'Bearer not-a-valid-token');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'unauthorized' });
  });

  it('returns 401 when bearer token is expired', async () => {
    const expired = signAccessToken('user-1');
    const res = await request(createApp())
      .get('/auth/me')
      .set('Authorization', `Bearer ${expired.slice(0, -1)}x`);

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'unauthorized' });
  });

  it('returns user when bearer token is valid', async () => {
    const token = signAccessToken('user-1');
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      name: 'Test User',
      authProvider: 'credential',
      passwordHash: 'hash',
      apolloApiKey: null,
      apolloLastSyncedAt: null,
      googleAccessToken: null,
      googleRefreshToken: null,
      googleTokenExpiry: null,
      gmailHistoryId: null,
      gmailWatchExpiry: null,
      gmailSubscriptionId: null,
      outlookAccessToken: null,
      outlookRefreshToken: null,
      outlookTokenExpiry: null,
      outlookDeltaLink: null,
      outlookSubscriptionId: null,
      outlookSubscriptionExpiry: null,
      outlookInboxSubscriptionId: null,
      outlookInboxSubscriptionExpiry: null,
      outlookCrmFolderId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    const res = await request(createApp())
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({
      id: 'user-1',
      email: 'user@example.com',
      name: 'Test User',
    });
  });
});
