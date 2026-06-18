import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchConversationMessages } from './conversation.js';

const receivedReply = {
  id: 'msg-in',
  conversationId: 'conv-1',
  receivedDateTime: '2026-06-01T11:00:00Z',
  from: { emailAddress: { address: 'shashvat@example.com' } },
};

const sentOriginal = {
  id: 'msg-out',
  conversationId: 'conv-1',
  sentDateTime: '2026-06-01T10:00:00Z',
  from: { emailAddress: { address: 'me@example.com' } },
};

function filterFromUrl(url: string): string {
  return new URL(url).searchParams.get('$filter') ?? '';
}

describe('fetchConversationMessages', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('merges received and sent Graph queries and does not stop after folder cache', async () => {
    const calls: string[] = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      const filter = filterFromUrl(url);

      if (filter.includes('receivedDateTime ge')) {
        expect(filter).toMatch(/receivedDateTime ge .+ and conversationId eq 'conv-1'/);
        return new Response(JSON.stringify({ value: [receivedReply] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (filter.includes('sentDateTime ge')) {
        expect(filter).toMatch(/sentDateTime ge .+ and conversationId eq 'conv-1'/);
        return new Response(JSON.stringify({ value: [sentOriginal] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ value: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;

    const cache = [sentOriginal];
    const messages = await fetchConversationMessages('token', 'conv-1', cache, 'folder-99');

    expect(calls.length).toBeGreaterThanOrEqual(4);
    expect(messages).toHaveLength(2);
    expect(messages.map((m) => m.id)).toEqual(['msg-out', 'msg-in']);
  });

  it('uses receivedDateTime before conversationId in filter with orderby', async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const parsed = new URL(String(input));
      const filter = parsed.searchParams.get('$filter') ?? '';
      const orderby = parsed.searchParams.get('$orderby') ?? '';

      if (filter.includes('receivedDateTime')) {
        expect(filter.indexOf('receivedDateTime')).toBeLessThan(filter.indexOf('conversationId'));
        expect(orderby).toBe('receivedDateTime desc');
      }
      if (filter.includes('sentDateTime')) {
        expect(filter.indexOf('sentDateTime')).toBeLessThan(filter.indexOf('conversationId'));
        expect(orderby).toBe('sentDateTime desc');
      }

      return new Response(JSON.stringify({ value: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;

    await fetchConversationMessages('token', 'conv-1', [], 'folder-99');

    const filters = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.map((c) =>
      filterFromUrl(String(c[0]))
    );
    expect(filters.some((f) => f.includes('receivedDateTime ge'))).toBe(true);
    expect(filters.some((f) => f.includes('sentDateTime ge'))).toBe(true);
    expect(filters.some((f) => f === "conversationId eq 'conv-1'")).toBe(false);
  });

  it('falls back to folder cache when all Graph queries return empty', async () => {
    globalThis.fetch = vi.fn(async () => {
      return new Response(JSON.stringify({ value: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;

    const cache = [{ ...receivedReply, id: 'cached-in' }];
    const messages = await fetchConversationMessages('token', 'conv-1', cache, 'folder-99');

    expect(messages).toHaveLength(1);
    expect(messages[0].id).toBe('cached-in');
  });
});
