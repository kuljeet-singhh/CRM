import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const { runOutlookSyncForUser, ensureOutlookSubscription } = vi.hoisted(() => ({
  runOutlookSyncForUser: vi.fn().mockResolvedValue(undefined),
  ensureOutlookSubscription: vi.fn().mockResolvedValue({ expiresAt: new Date() }),
}));

vi.mock('../outlook/syncRunner.js', () => ({
  runOutlookSyncForUser,
}));

vi.mock('../env.js', () => ({
  env: { outlookWebhookClientState: 'test-secret' },
  isOutlookPushEnabled: () => true,
}));

vi.mock('../db.js', () => ({
  prisma: {
    user: { findFirst: vi.fn().mockResolvedValue(null) },
  },
}));

vi.mock('../outlook/subscriptionManager.js', () => ({
  handleSubscriptionLifecycle: vi.fn(),
  ensureOutlookSubscription,
}));

import { outlookWebhookRouter } from './outlookReceiver.js';
import { prisma } from '../db.js';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/webhooks', outlookWebhookRouter);
  return app;
}

describe('outlook webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
  });

  it('echoes validationToken on GET', async () => {
    const res = await request(createApp())
      .get('/api/webhooks/outlook')
      .query({ validationToken: 'abc123' });

    expect(res.status).toBe(200);
    expect(res.text).toBe('abc123');
    expect(runOutlookSyncForUser).not.toHaveBeenCalled();
  });

  it('returns 200 for empty notification batch', async () => {
    const res = await request(createApp()).post('/api/webhooks/outlook').send({ value: [] });

    expect(res.status).toBe(200);
    expect(runOutlookSyncForUser).not.toHaveBeenCalled();
  });

  it('runs sync when user and clientState match', async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue({
      id: 'u1',
      authProvider: 'outlook',
      outlookSyncFolder: 'CRM',
    } as never);

    const res = await request(createApp())
      .post('/api/webhooks/outlook')
      .send({
        value: [
          {
            subscriptionId: 'sub-1',
            clientState: 'test-secret',
            changeType: 'created',
          },
        ],
      });

    expect(res.status).toBe(200);
    expect(runOutlookSyncForUser).toHaveBeenCalledWith('u1', 'webhook');
  });

  it('runs sync when inbox subscriptionId matches', async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue({
      id: 'u1',
      authProvider: 'outlook',
      outlookSyncFolder: 'CRM1',
      outlookSubscriptionId: 'sub-crm',
      outlookInboxSubscriptionId: 'sub-inbox',
    } as never);

    const res = await request(createApp())
      .post('/api/webhooks/outlook')
      .send({
        value: [
          {
            subscriptionId: 'sub-inbox',
            clientState: 'test-secret',
            changeType: 'created',
          },
        ],
      });

    expect(res.status).toBe(200);
    expect(runOutlookSyncForUser).toHaveBeenCalledWith('u1', 'webhook');
    expect(prisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { outlookSubscriptionId: 'sub-inbox' },
            { outlookInboxSubscriptionId: 'sub-inbox' },
          ],
        }),
      })
    );
  });

  it('runs sync for orphan subscription with valid clientState', async () => {
    vi.mocked(prisma.user.findFirst)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'u1',
        authProvider: 'outlook',
        outlookSyncFolder: 'CRM1',
      } as never);

    const res = await request(createApp())
      .post('/api/webhooks/outlook')
      .send({
        value: [
          {
            subscriptionId: 'orphan-sub-id',
            clientState: 'test-secret',
            changeType: 'created',
          },
        ],
      });

    expect(res.status).toBe(200);
    expect(runOutlookSyncForUser).toHaveBeenCalledWith('u1', 'webhook');
    expect(ensureOutlookSubscription).toHaveBeenCalledWith('u1');
  });

  it('ignores invalid clientState', async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue({
      id: 'u1',
      authProvider: 'outlook',
      outlookSyncFolder: 'CRM',
    } as never);

    const res = await request(createApp())
      .post('/api/webhooks/outlook')
      .send({
        value: [{ subscriptionId: 'sub-1', clientState: 'wrong', changeType: 'created' }],
      });

    expect(res.status).toBe(200);
    expect(runOutlookSyncForUser).not.toHaveBeenCalled();
  });
});
