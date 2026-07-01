import { describe, it, expect, vi, beforeEach } from 'vitest';

const { prismaMock, getAuthorizedClient, watchMock } = vi.hoisted(() => ({
  prismaMock: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
  getAuthorizedClient: vi.fn(),
  watchMock: vi.fn(),
}));

vi.mock('../db.js', () => ({ prisma: prismaMock }));
vi.mock('../auth/tokens.js', () => ({ getAuthorizedClient }));
vi.mock('../env.js', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../env.js')>();
  return {
    ...mod,
    env: { ...mod.env, gmailPubsubTopic: 'projects/test/topics/gmail' },
  };
});

import { ensureGmailWatch } from './watchManager.js';

describe('ensureGmailWatch force', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    watchMock.mockResolvedValue({
      data: { expiration: String(Date.now() + 7 * 24 * 60 * 60 * 1000), historyId: '99' },
    });
    getAuthorizedClient.mockResolvedValue({
      users: {
        labels: {
          list: vi.fn().mockResolvedValue({
            data: {
              labels: [
                { id: 'crm-label', name: 'CRM1' },
                { id: 'INBOX', name: 'INBOX' },
              ],
            },
          }),
        },
        watch: watchMock,
      },
    });
    prismaMock.user.update.mockResolvedValue({});
  });

  it('skips registration when watch is active and force is false', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'u1',
      gmailSyncLabel: 'CRM1',
      gmailWatchExpiry: new Date(Date.now() + 60 * 60 * 1000),
      gmailLastHistoryId: '1',
      crmLabels: [{ labelId: 'crm-label' }],
    });

    const result = await ensureGmailWatch('u1');

    expect(result.expiresAt).toBeTruthy();
    expect(watchMock).not.toHaveBeenCalled();
  });

  it('re-registers watch when force is true even if watch is active', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'u1',
      gmailSyncLabel: 'CRM1',
      gmailWatchExpiry: new Date(Date.now() + 60 * 60 * 1000),
      gmailLastHistoryId: '1',
      crmLabels: [{ labelId: 'crm-label' }],
    });

    const result = await ensureGmailWatch('u1', { force: true });

    expect(result.expiresAt).toBeTruthy();
    expect(watchMock).toHaveBeenCalledWith({
      userId: 'me',
      requestBody: {
        topicName: 'projects/test/topics/gmail',
        labelIds: ['crm-label', 'INBOX'],
        labelFilterAction: 'include',
      },
    });
  });
});
