import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { prismaMock, upsertMock } = vi.hoisted(() => ({
  prismaMock: {
    user: { findUnique: vi.fn(), update: vi.fn() },
  },
  upsertMock: vi.fn(),
}));

vi.mock('../db.js', () => ({ prisma: prismaMock }));
vi.mock('../auth/crypto.js', () => ({
  decrypt: vi.fn(() => 'api-key'),
}));
vi.mock('../contacts/upsert.js', () => ({
  upsertContactFromApollo: upsertMock,
}));

import { syncApolloContacts } from './sync.js';

describe('syncApolloContacts', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.user.findUnique.mockResolvedValue({ apolloApiKey: 'enc' });
    prismaMock.user.update.mockResolvedValue({});
    upsertMock.mockImplementation(async (_ws: string, email: string) => ({
      contact: { id: email, email },
      created: email.includes('new'),
    }));
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('imports contacts with email and skips missing email', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          contacts: [
            { email: 'new@example.com', name: 'New User' },
            { email: '', name: 'No Email' },
            { first_name: 'Jane', last_name: 'Doe', email: 'jane@example.com' },
          ],
          pagination: { total_pages: 1 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    ) as typeof fetch;

    const result = await syncApolloContacts('u1', 'ws1');

    expect(result.imported).toBe(2);
    expect(result.created).toBe(1);
    expect(result.skippedNoEmail).toBe(1);
    expect(result.pages).toBe(1);
    expect(result.capped).toBe(false);
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u1' },
        data: expect.objectContaining({ apolloLastSyncedAt: expect.any(Date) }),
      })
    );
  });

  it('paginates multiple pages', async () => {
    let page = 0;
    globalThis.fetch = vi.fn(async (_input, init) => {
      const body = JSON.parse(String(init?.body)) as { page: number };
      page = body.page;
      return new Response(
        JSON.stringify({
          contacts: [{ email: `p${body.page}@example.com` }],
          pagination: { total_pages: 2 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }) as typeof fetch;

    const result = await syncApolloContacts('u1', 'ws1');

    expect(page).toBe(2);
    expect(result.pages).toBe(2);
    expect(result.imported).toBe(2);
  });
});
