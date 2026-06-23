import { describe, expect, it, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { signAccessToken } from '../auth/jwt.js';

const mocks = vi.hoisted(() => ({
  upsertContactFromOcr: vi.fn(),
}));

vi.mock('./upsert.js', async (importOriginal) => {
  const mod = await importOriginal<typeof import('./upsert.js')>();
  return {
    ...mod,
    upsertContactFromOcr: mocks.upsertContactFromOcr,
  };
});

vi.mock('./linkedinImport.js', () => ({
  importLinkedInCsv: vi.fn(),
}));

vi.mock('../db.js', () => ({
  prisma: {
    membership: { findFirst: vi.fn() },
    contact: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn(),
    },
    emailMessage: { findMany: vi.fn().mockResolvedValue([]) },
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

import { contactsRouter } from './routes.js';
import { prisma } from '../db.js';

const userId = 'user-1';
const workspaceId = 'ws-1';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/contacts', contactsRouter);
  return app;
}

function authHeader() {
  return { Authorization: `Bearer ${signAccessToken(userId)}` };
}

describe('POST /api/contacts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.membership.findFirst).mockResolvedValue({
      id: 'm1',
      userId,
      workspaceId,
      role: 'owner',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);
  });

  it('creates contact from OCR fields', async () => {
    mocks.upsertContactFromOcr.mockResolvedValue({
      contact: {
        id: 'c1',
        workspaceId,
        email: 'jane@acme.com',
        name: 'Jane Doe',
        company: 'Acme',
        title: 'VP Sales',
        linkedinUrl: null,
        createdFrom: 'ocr_card',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      created: true,
      updated: false,
    });

    const res = await request(createApp())
      .post('/api/contacts')
      .set(authHeader())
      .send({
        name: 'Jane Doe',
        email: 'jane@acme.com',
        company: 'Acme',
        title: 'VP Sales',
      });

    expect(res.status).toBe(201);
    expect(res.body.created).toBe(true);
    expect(res.body.contact.email).toBe('jane@acme.com');
    expect(mocks.upsertContactFromOcr).toHaveBeenCalledWith(workspaceId, {
      name: 'Jane Doe',
      email: 'jane@acme.com',
      company: 'Acme',
      title: 'VP Sales',
      linkedinUrl: undefined,
    });
  });

  it('returns 400 for missing identifier', async () => {
    const res = await request(createApp())
      .post('/api/contacts')
      .set(authHeader())
      .send({ name: 'Jane Doe' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('missing_identifier');
    expect(mocks.upsertContactFromOcr).not.toHaveBeenCalled();
  });

  it('returns 400 when upsert skips invalid url', async () => {
    mocks.upsertContactFromOcr.mockResolvedValue({ skipped: 'invalid_url' });

    const res = await request(createApp())
      .post('/api/contacts')
      .set(authHeader())
      .send({ linkedinUrl: 'not-a-url' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_url');
  });

  it('updates existing contact', async () => {
    mocks.upsertContactFromOcr.mockResolvedValue({
      contact: {
        id: 'c1',
        workspaceId,
        email: 'jane@acme.com',
        name: 'Jane Doe',
        company: 'Acme',
        title: null,
        linkedinUrl: null,
        createdFrom: 'logged_email',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      created: false,
      updated: true,
    });

    const res = await request(createApp())
      .post('/api/contacts')
      .set(authHeader())
      .send({ email: 'jane@acme.com', company: 'Acme' });

    expect(res.status).toBe(200);
    expect(res.body.created).toBe(false);
  });
});
