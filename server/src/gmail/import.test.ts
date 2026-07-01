import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mergeHistoryCollections, resolveInboxLabelId } from './import.js';

describe('resolveInboxLabelId', () => {
  it('returns INBOX label id', () => {
    expect(
      resolveInboxLabelId([
        { id: 'crm-label', name: 'CRM1' },
        { id: 'INBOX', name: 'INBOX' },
      ])
    ).toBe('INBOX');
  });
});

describe('mergeHistoryCollections', () => {
  it('merges message ids and picks latest historyId', () => {
    const merged = mergeHistoryCollections(
      {
        messageIds: ['a', 'b'],
        removedMessageIds: ['x'],
        historyId: '100',
      },
      {
        messageIds: ['b', 'c'],
        removedMessageIds: [],
        historyId: '200',
      }
    );

    expect(merged.messageIds).toEqual(['a', 'b', 'c']);
    expect(merged.removedMessageIds).toEqual(['x']);
    expect(merged.historyId).toBe('200');
  });
});

const { prismaMock, processMock, applyLabelMock } = vi.hoisted(() => ({
  prismaMock: {
    emailMessage: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
  },
  processMock: vi.fn(),
  applyLabelMock: vi.fn(),
}));

vi.mock('../db.js', () => ({ prisma: prismaMock }));
vi.mock('../auth/tokens.js', () => ({
  getAuthorizedClient: vi.fn().mockResolvedValue({
    users: {
      threads: {
        get: vi.fn().mockResolvedValue({
          data: {
            messages: [
              { id: 'sent-1', labelIds: ['crm-label'] },
              { id: 'reply-1', labelIds: ['INBOX'] },
            ],
          },
        }),
      },
    },
  }),
}));
vi.mock('./send.js', () => ({
  processGmailMessageForCrm: processMock,
  processGmailMessagePayload: processMock,
}));
vi.mock('./threadLabel.js', () => ({
  applyCrmLabelToThreadMessages: applyLabelMock,
}));

import { importGmailThreadForCrm } from './import.js';

describe('importGmailThreadForCrm', () => {
  beforeEach(() => {
    processMock.mockReset();
    applyLabelMock.mockReset();
    prismaMock.emailMessage.findUnique.mockReset();
    prismaMock.emailMessage.findMany.mockReset();
    applyLabelMock.mockResolvedValue(1);
    prismaMock.emailMessage.findMany.mockResolvedValue([]);
  });

  it('imports all thread messages and labels unlabeled Gmail messages', async () => {
    processMock.mockResolvedValue({ id: 'db-1' });

    const result = await importGmailThreadForCrm({
      userId: 'u1',
      workspaceId: 'ws1',
      userEmail: 'me@test.com',
      threadId: 'thread-1',
      labelId: 'crm-label',
    });

    expect(processMock).toHaveBeenCalledTimes(2);
    expect(processMock).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.objectContaining({ id: 'sent-1' }),
        skipLabelCheck: true,
      })
    );
    expect(processMock).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.objectContaining({ id: 'reply-1' }),
        skipLabelCheck: true,
      })
    );
    expect(applyLabelMock).toHaveBeenCalledWith(expect.anything(), 'thread-1', 'crm-label');
    expect(result.messagesAdded).toBe(2);
    expect(result.messagesLabeled).toBe(1);
  });

  it('skips threads with no CRM-labeled messages', async () => {
    const { getAuthorizedClient } = await import('../auth/tokens.js');
    vi.mocked(getAuthorizedClient).mockResolvedValueOnce({
      users: {
        threads: {
          get: vi.fn().mockResolvedValue({
            data: {
              messages: [{ id: 'm1', labelIds: ['INBOX'] }],
            },
          }),
        },
      },
    } as never);

    const result = await importGmailThreadForCrm({
      userId: 'u1',
      workspaceId: 'ws1',
      userEmail: 'me@test.com',
      threadId: 'thread-2',
      labelId: 'crm-label',
    });

    expect(processMock).not.toHaveBeenCalled();
    expect(applyLabelMock).not.toHaveBeenCalled();
    expect(result.messagesAdded).toBe(0);
  });
});
