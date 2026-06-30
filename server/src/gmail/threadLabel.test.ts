import { describe, it, expect, vi } from 'vitest';
import { applyCrmLabelToThreadMessages } from './threadLabel.js';

describe('applyCrmLabelToThreadMessages', () => {
  it('adds CRM label only to thread messages that lack it', async () => {
    const modify = vi.fn().mockResolvedValue({});
    const gmail = {
      users: {
        threads: {
          get: vi.fn().mockResolvedValue({
            data: {
              messages: [
                { id: 'sent-1', labelIds: ['Label_CRM', 'SENT'] },
                { id: 'reply-1', labelIds: ['INBOX'] },
              ],
            },
          }),
        },
        messages: { modify },
      },
    };

    const labeled = await applyCrmLabelToThreadMessages(
      gmail as never,
      'thread-abc',
      'Label_CRM'
    );

    expect(labeled).toBe(1);
    expect(modify).toHaveBeenCalledTimes(1);
    expect(modify).toHaveBeenCalledWith({
      userId: 'me',
      id: 'reply-1',
      requestBody: { addLabelIds: ['Label_CRM'] },
    });
  });

  it('returns 0 when all messages already have the label', async () => {
    const modify = vi.fn();
    const gmail = {
      users: {
        threads: {
          get: vi.fn().mockResolvedValue({
            data: {
              messages: [{ id: 'm1', labelIds: ['Label_CRM'] }],
            },
          }),
        },
        messages: { modify },
      },
    };

    const labeled = await applyCrmLabelToThreadMessages(
      gmail as never,
      'thread-abc',
      'Label_CRM'
    );

    expect(labeled).toBe(0);
    expect(modify).not.toHaveBeenCalled();
  });
});
