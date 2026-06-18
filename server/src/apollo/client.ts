import { prisma } from '../db.js';
import { decrypt } from '../auth/crypto.js';

export const APOLLO_BASE_URL = 'https://api.apollo.io/api/v1';

export class ApolloAuthError extends Error {
  constructor() {
    super('apollo_auth');
    this.name = 'ApolloAuthError';
  }
}

export class ApolloRateLimitError extends Error {
  constructor() {
    super('apollo_rate_limited');
    this.name = 'ApolloRateLimitError';
  }
}

export class ApolloApiError extends Error {
  constructor(public status: number, message?: string) {
    super(message ?? `apollo_api_${status}`);
    this.name = 'ApolloApiError';
  }
}

export class ApolloNotConnectedError extends Error {
  constructor() {
    super('apollo_not_connected');
    this.name = 'ApolloNotConnectedError';
  }
}

export type ApolloContact = {
  email?: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  organization_name?: string;
  organization?: { name?: string };
};

export type ApolloSearchResponse = {
  contacts?: ApolloContact[];
  pagination?: { total_pages?: number };
};

export async function apolloFetch<T>(
  apiKey: string,
  path: string,
  body: Record<string, unknown>
): Promise<T> {
  const res = await fetch(`${APOLLO_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      'X-Api-Key': apiKey,
    },
    body: JSON.stringify(body),
  });

  if (res.status === 401 || res.status === 403) {
    throw new ApolloAuthError();
  }
  if (res.status === 429) {
    throw new ApolloRateLimitError();
  }
  if (!res.ok) {
    throw new ApolloApiError(res.status);
  }

  return res.json() as Promise<T>;
}

export async function getApolloKey(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.apolloApiKey) {
    throw new ApolloNotConnectedError();
  }
  return decrypt(user.apolloApiKey);
}

export async function verifyApolloKey(apiKey: string): Promise<void> {
  await apolloFetch<ApolloSearchResponse>(apiKey, '/contacts/search', {
    page: 1,
    per_page: 1,
  });
}

export async function searchApolloContacts(
  apiKey: string,
  page: number,
  perPage: number
): Promise<ApolloSearchResponse> {
  return apolloFetch<ApolloSearchResponse>(apiKey, '/contacts/search', {
    page,
    per_page: perPage,
  });
}
