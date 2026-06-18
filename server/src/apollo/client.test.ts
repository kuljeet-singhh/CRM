import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    user: { findUnique: vi.fn() },
  },
}));

vi.mock('../db.js', () => ({ prisma: prismaMock }));
vi.mock('../auth/crypto.js', () => ({
  decrypt: vi.fn((v: string) => `decrypted:${v}`),
}));

import {
  apolloFetch,
  ApolloAuthError,
  ApolloRateLimitError,
  getApolloKey,
  verifyApolloKey,
  APOLLO_BASE_URL,
} from './client.js';

describe('apollo client', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('getApolloKey returns decrypted key', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ apolloApiKey: 'enc-key' });
    const key = await getApolloKey('u1');
    expect(key).toBe('decrypted:enc-key');
  });

  it('getApolloKey throws when missing', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ apolloApiKey: null });
    await expect(getApolloKey('u1')).rejects.toMatchObject({
      message: 'apollo_not_connected',
    });
  });

  it('apolloFetch sends X-Api-Key and POST body', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ contacts: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    ) as typeof fetch;

    await apolloFetch('test-key', '/contacts/search', { page: 1, per_page: 1 });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${APOLLO_BASE_URL}/contacts/search`,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'X-Api-Key': 'test-key' }),
        body: JSON.stringify({ page: 1, per_page: 1 }),
      })
    );
  });

  it('maps 401 to ApolloAuthError', async () => {
    globalThis.fetch = vi.fn(async () => new Response('', { status: 401 })) as typeof fetch;
    await expect(apolloFetch('k', '/contacts/search', {})).rejects.toBeInstanceOf(ApolloAuthError);
  });

  it('maps 429 to ApolloRateLimitError', async () => {
    globalThis.fetch = vi.fn(async () => new Response('', { status: 429 })) as typeof fetch;
    await expect(apolloFetch('k', '/contacts/search', {})).rejects.toBeInstanceOf(
      ApolloRateLimitError
    );
  });

  it('verifyApolloKey probes with per_page 1', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ contacts: [] }), { status: 200 })
    ) as typeof fetch;

    await verifyApolloKey('probe-key');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({ page: 1, per_page: 1 }),
      })
    );
  });
});
