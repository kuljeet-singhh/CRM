import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const { pollOnce, runIncrementalMailboxSync } = vi.hoisted(() => ({
  pollOnce: vi.fn().mockResolvedValue(undefined),
  runIncrementalMailboxSync: vi.fn().mockResolvedValue({ gmailUsers: 2, outlookUsers: 1 }),
}));

vi.mock('../queue/worker.js', () => ({ pollOnce }));
vi.mock('./mailboxSync.js', () => ({ runIncrementalMailboxSync }));

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
  });

  it('returns 401 without cron secret', async () => {
    const res = await request(createApp()).post('/api/cron/sync-worker');
    expect(res.status).toBe(401);
    expect(pollOnce).not.toHaveBeenCalled();
  });

  it('drains queue and runs mailbox sync', async () => {
    const res = await request(createApp())
      .post('/api/cron/sync-worker')
      .set('Authorization', 'Bearer test-cron-secret');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, gmailUsers: 2, outlookUsers: 1 });
    expect(pollOnce).toHaveBeenCalledOnce();
    expect(runIncrementalMailboxSync).toHaveBeenCalledOnce();
  });
});
