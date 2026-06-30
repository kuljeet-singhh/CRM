import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const { runIncrementalMailboxSync } = vi.hoisted(() => ({
  runIncrementalMailboxSync: vi.fn().mockResolvedValue({
    gmailUsers: 2,
    outlookUsers: 1,
    gmailUsersSynced: 2,
    outlookUsersSynced: 1,
  }),
}));

vi.mock('./mailboxSync.js', () => ({
  CRON_MAILBOX_SYNC_BUDGET_MS: 45_000,
  CRON_MAILBOX_SYNC_PER_USER_TIMEOUT_MS: 35_000,
  CRON_SYNC_WORKER_RESPONSE_DEADLINE_MS: 50,
  runIncrementalMailboxSync,
}));

vi.mock('../env.js', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../env.js')>();
  return {
    ...mod,
    env: { ...mod.env, cronSecret: 'test-cron-secret' },
  };
});

import { cronRouter } from './routes.js';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/cron', cronRouter);
  return app;
}

describe('cron sync-worker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runIncrementalMailboxSync.mockResolvedValue({
      gmailUsers: 2,
      outlookUsers: 1,
      gmailUsersSynced: 2,
      outlookUsersSynced: 1,
    });
  });

  it('returns 401 without cron secret', async () => {
    const res = await request(createApp()).post('/api/cron/sync-worker');
    expect(res.status).toBe(401);
    expect(runIncrementalMailboxSync).not.toHaveBeenCalled();
  });

  it('runs mailbox sync with time budget and per-user timeout', async () => {
    const res = await request(createApp())
      .post('/api/cron/sync-worker')
      .set('Authorization', 'Bearer test-cron-secret');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      ok: true,
      gmailUsers: 2,
      outlookUsers: 1,
      gmailUsersSynced: 2,
      outlookUsersSynced: 1,
    });
    expect(runIncrementalMailboxSync).toHaveBeenCalledWith({
      timeBudgetMs: 45_000,
      perUserTimeoutMs: 35_000,
    });
  });

  it('returns 200 with timedOut when sync exceeds hard response deadline', async () => {
    runIncrementalMailboxSync.mockImplementation(
      () =>
        new Promise(() => {
          /* never resolves */
        })
    );

    const res = await request(createApp())
      .post('/api/cron/sync-worker')
      .set('Authorization', 'Bearer test-cron-secret');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      ok: true,
      gmailUsers: 0,
      outlookUsers: 0,
      gmailUsersSynced: 0,
      outlookUsersSynced: 0,
      partial: true,
      timedOut: true,
    });
  });
});
