import { describe, expect, it, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { signAccessToken } from '../../auth/jwt.js';

const mocks = vi.hoisted(() => ({
  listOutlookCalendars: vi.fn(),
}));

vi.mock('./list.js', () => ({
  listOutlookCalendars: mocks.listOutlookCalendars,
}));

vi.mock('../send.js', () => ({ sendOutlookMessage: vi.fn() }));
vi.mock('../sync.js', () => ({ manualOutlookSync: vi.fn() }));
vi.mock('./calendar/routes.js', () => ({ outlookCalendarRouter: express.Router() }));
vi.mock('../../auth/tokens.js', () => ({ getOutlookAccessToken: vi.fn() }));

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

import { outlookRouter } from '../routes.js';
import { prisma } from '../../db.js';

const userId = 'user-1';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/outlook', outlookRouter);
  return app;
}

describe('GET /api/outlook/calendars', () => {
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
    const res = await request(createApp()).get('/api/outlook/calendars');
    expect(res.status).toBe(401);
  });

  it('returns calendar list', async () => {
    mocks.listOutlookCalendars.mockResolvedValue({
      calendars: [{ id: 'cal-1', name: 'Calendar', isPrimary: true }],
    });

    const res = await request(createApp())
      .get('/api/outlook/calendars')
      .set('Authorization', `Bearer ${signAccessToken(userId)}`);

    expect(res.status).toBe(200);
    expect(res.body.calendars).toHaveLength(1);
    expect(mocks.listOutlookCalendars).toHaveBeenCalledWith(userId);
  });

  it('returns 403 on insufficient_scope', async () => {
    mocks.listOutlookCalendars.mockResolvedValue({ error: 'insufficient_scope' });

    const res = await request(createApp())
      .get('/api/outlook/calendars')
      .set('Authorization', `Bearer ${signAccessToken(userId)}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('insufficient_scope');
  });
});
