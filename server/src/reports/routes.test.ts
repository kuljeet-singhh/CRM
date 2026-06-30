import { describe, expect, it, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { signAccessToken } from '../auth/jwt.js';

const mocks = vi.hoisted(() => ({
  buildReportSummary: vi.fn(),
  buildContactsReport: vi.fn(),
  buildEmailReport: vi.fn(),
  buildEngagementReport: vi.fn(),
  buildCalendarReport: vi.fn(),
  exportContactsList: vi.fn(),
}));

vi.mock('./service.js', () => ({
  buildReportSummary: mocks.buildReportSummary,
  buildContactsReport: mocks.buildContactsReport,
  buildEmailReport: mocks.buildEmailReport,
  buildEngagementReport: mocks.buildEngagementReport,
  buildCalendarReport: mocks.buildCalendarReport,
  exportContactsList: mocks.exportContactsList,
}));

vi.mock('../db.js', () => ({
  prisma: {
    membership: { findFirst: vi.fn() },
  },
}));

vi.mock('../env.js', () => ({
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
    googleCalendarWriteScope: 'https://www.googleapis.com/auth/calendar.events',
    outlookCalendarWriteScope: 'Calendars.ReadWrite',
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
    calendarSyncPastDays: 90,
    calendarSyncFutureDays: 365,
  },
  isMicrosoftConfigured: () => false,
  isOutlookPushEnabled: () => false,
}));

import { reportsRouter } from './routes.js';
import { prisma } from '../db.js';

const userId = 'user-1';
const workspaceId = 'ws-1';

function createApp() {
  const app = express();
  app.use('/api/reports', reportsRouter);
  return app;
}

function authHeader() {
  return { Authorization: `Bearer ${signAccessToken(userId)}` };
}

const sampleSummary = {
  period: {
    from: '2026-06-01',
    to: '2026-06-30',
    previousFrom: '2026-05-02',
    previousTo: '2026-05-31',
  },
  kpis: {
    totalContacts: { value: 10, changePct: null },
    newContacts: { value: 2, changePct: 0 },
    emailsSent: { value: 5, changePct: 0 },
    emailsReceived: { value: 3, changePct: 0 },
    meetingsScheduled: { value: 1, changePct: 0 },
    crmMeetingsCreated: { value: 0, changePct: 0 },
  },
  series: {
    contactGrowth: [],
    emailActivity: [],
    contactsBySource: [],
  },
};

describe('GET /api/reports/summary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.membership.findFirst).mockResolvedValue({
      id: 'm1',
      userId,
      workspaceId,
      role: 'owner',
      createdAt: new Date(),
    } as never);
    mocks.buildReportSummary.mockResolvedValue(sampleSummary);
  });

  it('returns 401 without auth', async () => {
    const res = await request(createApp()).get('/api/reports/summary');
    expect(res.status).toBe(401);
  });

  it('returns summary JSON', async () => {
    const res = await request(createApp())
      .get('/api/reports/summary?from=2026-06-01&to=2026-06-30')
      .set(authHeader());
    expect(res.status).toBe(200);
    expect(res.body.kpis.totalContacts.value).toBe(10);
    expect(mocks.buildReportSummary).toHaveBeenCalledWith(
      workspaceId,
      expect.objectContaining({ from: expect.any(Date), to: expect.any(Date) })
    );
  });

  it('returns 400 for invalid range', async () => {
    const res = await request(createApp())
      .get('/api/reports/summary?from=2026-06-30&to=2026-06-01')
      .set(authHeader());
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_range');
  });
});

describe('GET /api/reports/export', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.membership.findFirst).mockResolvedValue({
      id: 'm1',
      userId,
      workspaceId,
      role: 'owner',
      createdAt: new Date(),
    } as never);
    mocks.buildReportSummary.mockResolvedValue(sampleSummary);
    mocks.buildEmailReport.mockResolvedValue({
      period: { from: '2026-06-01', to: '2026-06-30' },
      granularity: 'day',
      activity: [{ date: '2026-06-01', sent: 1, received: 2 }],
      totals: { sent: 1, received: 2 },
    });
    mocks.exportContactsList.mockResolvedValue([]);
  });

  it('returns CSV for summary export', async () => {
    const res = await request(createApp())
      .get('/api/reports/export?type=summary&format=csv&from=2026-06-01&to=2026-06-30')
      .set(authHeader());
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.text).toContain('total_contacts,10');
  });

  it('rejects invalid export type', async () => {
    const res = await request(createApp())
      .get('/api/reports/export?type=invalid&format=csv')
      .set(authHeader());
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_type');
  });
});
