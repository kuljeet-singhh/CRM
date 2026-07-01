import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const { scheduleGmailSync, verifyGmailPubSubPushAuth } = vi.hoisted(() => ({
  scheduleGmailSync: vi.fn(),
  verifyGmailPubSubPushAuth: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock('../gmail/syncRunner.js', () => ({
  scheduleGmailSync,
}));

vi.mock('../gmail/gmailWebhook/auth.js', () => ({
  verifyGmailPubSubPushAuth,
}));

vi.mock('../db.js', () => ({
  prisma: {
    user: { findFirst: vi.fn().mockResolvedValue(null) },
    crmLabel: { findUnique: vi.fn() },
  },
}));

import { gmailWebhookRouter } from './gmailReceiver.js';
import { prisma } from '../db.js';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/webhooks', gmailWebhookRouter);
  return app;
}

describe('gmail webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
  });

  it('returns 200 for empty payload', async () => {
    const res = await request(createApp())
      .post('/api/webhooks/gmail')
      .send({ message: {} });

    expect(res.status).toBe(200);
    expect(scheduleGmailSync).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid decoded payload', async () => {
    const data = Buffer.from(JSON.stringify({ foo: 1 }), 'utf8').toString('base64');

    const res = await request(createApp())
      .post('/api/webhooks/gmail')
      .send({ message: { data } });

    expect(res.status).toBe(400);
    expect(scheduleGmailSync).not.toHaveBeenCalled();
  });

  it('returns 401 when Pub/Sub OIDC auth fails', async () => {
    verifyGmailPubSubPushAuth.mockResolvedValueOnce({
      ok: false,
      status: 401,
      reason: 'missing_bearer',
    });

    const res = await request(createApp())
      .post('/api/webhooks/gmail')
      .send({ message: { data: 'abc' } });

    expect(res.status).toBe(401);
    expect(scheduleGmailSync).not.toHaveBeenCalled();
  });

  it('schedules debounced sync when user and label exist', async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue({
      id: 'u1',
      email: 'user@gmail.com',
      authProvider: 'gmail',
      gmailSyncLabel: 'CRM',
    } as never);
    vi.mocked(prisma.crmLabel.findUnique).mockResolvedValue({
      userId: 'u1',
      labelId: 'Label_1',
    } as never);

    const data = Buffer.from(
      JSON.stringify({ emailAddress: 'user@gmail.com', historyId: 1 }),
      'utf8'
    ).toString('base64');

    const res = await request(createApp())
      .post('/api/webhooks/gmail')
      .send({ message: { data } });

    expect(res.status).toBe(200);
    expect(scheduleGmailSync).toHaveBeenCalledWith('u1', 'webhook');
  });
});
