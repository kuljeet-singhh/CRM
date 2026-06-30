import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const redisMock = {
  xadd: vi.fn().mockResolvedValue('1-0'),
  xtrim: vi.fn().mockResolvedValue(0),
  xread: vi.fn().mockResolvedValue(null),
};

vi.mock('@upstash/redis', () => ({
  Redis: vi.fn(() => redisMock),
}));

describe('messageBus', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    redisMock.xadd.mockClear();
    redisMock.xtrim.mockClear();
    redisMock.xread.mockClear();
    process.env = { ...originalEnv, NODE_ENV: 'development' };
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('publishes to in-memory bus in development without Upstash', async () => {
    const { publishMessagesChanged, subscribeLocal } = await import('./messageBus.js');

    const received: unknown[] = [];
    const unsub = subscribeLocal('ws-1', (p) => received.push(p));

    await publishMessagesChanged('ws-1', { added: 2 });

    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({ workspaceId: 'ws-1', added: 2 });
    expect(redisMock.xadd).not.toHaveBeenCalled();

    unsub();
  });

  it('publishes to Upstash stream when configured', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'token';

    const { publishMessagesChanged } = await import('./messageBus.js');

    await publishMessagesChanged('ws-2', { added: 1, removed: 0 });

    expect(redisMock.xadd).toHaveBeenCalledWith(
      'messages-stream:ws-2',
      '*',
      expect.objectContaining({ data: expect.stringContaining('"workspaceId":"ws-2"') })
    );
    expect(redisMock.xtrim).toHaveBeenCalled();
  });

  it('isMessageEventsEnabled is true in dev without Upstash', async () => {
    const { isMessageEventsEnabled } = await import('./messageBus.js');
    expect(isMessageEventsEnabled()).toBe(true);
  });

  it('isMessageEventsEnabled is false in prod without Upstash', async () => {
    process.env.NODE_ENV = 'production';
    const { isMessageEventsEnabled } = await import('./messageBus.js');
    expect(isMessageEventsEnabled()).toBe(false);
  });
});
