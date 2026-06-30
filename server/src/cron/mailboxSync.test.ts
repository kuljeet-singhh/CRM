import { describe, it, expect, vi, beforeEach } from 'vitest';

const { prismaMock, runGmailSyncForUser, runOutlookSyncForUser } = vi.hoisted(() => ({
  prismaMock: {
    user: {
      findMany: vi.fn(),
    },
  },
  runGmailSyncForUser: vi.fn().mockResolvedValue({
    messagesAdded: 0,
    messagesUpdated: 0,
    messagesRemoved: 0,
    messagesLabeled: 0,
    contactsTouched: 0,
  }),
  runOutlookSyncForUser: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../db.js', () => ({ prisma: prismaMock }));
vi.mock('../gmail/syncRunner.js', () => ({ runGmailSyncForUser }));
vi.mock('../outlook/syncRunner.js', () => ({ runOutlookSyncForUser }));
vi.mock('../env.js', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../env.js')>();
  return {
    ...mod,
    isOutlookPushEnabled: () => false,
  };
});

import { runIncrementalMailboxSync } from './mailboxSync.js';

describe('runIncrementalMailboxSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.user.findMany.mockResolvedValue([{ id: 'u1' }, { id: 'u2' }, { id: 'u3' }]);
    runGmailSyncForUser.mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 30));
      return {
        messagesAdded: 0,
        messagesUpdated: 0,
        messagesRemoved: 0,
        messagesLabeled: 0,
        contactsTouched: 0,
      };
    });
  });

  it('syncs all users when no time budget', async () => {
    const result = await runIncrementalMailboxSync();
    expect(result.gmailUsersSynced).toBe(3);
    expect(result.partial).toBeUndefined();
    expect(runGmailSyncForUser).toHaveBeenCalledTimes(3);
  });

  it('stops early when time budget exceeded', async () => {
    const result = await runIncrementalMailboxSync({ timeBudgetMs: 40 });
    expect(result.gmailUsersSynced).toBeLessThan(3);
    expect(result.partial).toBe(true);
  });
});
