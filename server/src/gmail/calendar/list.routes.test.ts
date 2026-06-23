import { describe, expect, it, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { signAccessToken } from '../../auth/jwt.js';

const mocks = vi.hoisted(() => ({
  listGoogleCalendars: vi.fn(),
}));

vi.mock('./list.js', () => ({
  listGoogleCalendars: mocks.listGoogleCalendars,
}));

vi.mock('../send.js', () => ({ sendGmailMessage: vi.fn() }));
vi.mock('../sync.js', () => ({ manualGmailSync: vi.fn() }));
vi.mock('./calendar/routes.js', () => ({ gmailCalendarRouter: express.Router() }));
vi.mock('../../auth/tokens.js', () => ({ getAuthorizedClient: vi.fn() }));

vi.mock('../../db.js', () => ({
  prisma: {
    membership: { findFirst: vi.fn() },
  },
}));

vi.mock('../../env.js', () => ({
  env: {
    webOrigin: 'http://localhost:5173',
    jwtAccessSecret: 'test-access-secret-test-access!!',
    jwtRefreshSecret: 'test-refresh-secret-test-refresh',
    jwtAccessTtl: '15m',
    jwtRefreshTtl: '30d',
    isProd: false,
    encryptionKey: Buffer.alloc(32).toString('base64'),
    sessionSecret: 'test-secret',
    databaseUrl: 'postgresql://localhost/test',
    googleClientId: 'test',
    googleClientSecret: 'test',
    googleRedirectUri: 'http://localhost:3000/auth/google/callback',
    googleScopes: [],
    gmailPubsubTopic: '',
    googleWebhookAudience: '',
    syncWorkerPollMs: 2000,
    syncWorkerBatchSize: 5,
    port: 3000,
    cronSecret: '',
    microsoftClientId: '',
    microsoftClientSecret: '',
    microsoftRedirectUri: '',
    microsoftTenantId: 'common',
    microsoftScopes: [],
    outlookWebhookUrl: '',
    outlookWebhookClientState: '',
    calendarSyncPastDays: 90,
    calendarSyncFutureDays: 365,
  },
  isMicrosoftConfigured: () => false,
  isOutlookPushEnabled: () => false,
}));

import { gmailRouter } from '../routes.js';
import { prisma } from '../../db.js';

const userId = 'user-1';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/gmail', gmailRouter);
  return app;
}

describe('GET /api/gmail/calendars', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.membership.findFirst).mockResolvedValue({
      id: 'm1',
      userId,
      workspaceId: 'ws-1',
      role: 'owner',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);
  });

  it('returns 401 without auth', async () => {
    const res = await request(createApp()).get('/api/gmail/calendars');
    expect(res.status).toBe(401);
  });

  it('returns calendar list', async () => {
    mocks.listGoogleCalendars.mockResolvedValue({
      calendars: [{ id: 'primary', name: 'Primary', isPrimary: true }],
    });

    const res = await request(createApp())
      .get('/api/gmail/calendars')
      .set('Authorization', `Bearer ${signAccessToken(userId)}`);

    expect(res.status).toBe(200);
    expect(res.body.calendars).toHaveLength(1);
    expect(mocks.listGoogleCalendars).toHaveBeenCalledWith(userId);
  });

  it('returns 403 on insufficient_scope', async () => {
    mocks.listGoogleCalendars.mockResolvedValue({ error: 'insufficient_scope' });

    const res = await request(createApp())
      .get('/api/gmail/calendars')
      .set('Authorization', `Bearer ${signAccessToken(userId)}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('insufficient_scope');
  });
});
