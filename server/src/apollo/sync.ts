import { prisma } from '../db.js';
import { upsertContactFromApollo } from '../contacts/upsert.js';
import { getApolloKey, searchApolloContacts, type ApolloContact } from './client.js';

const PER_PAGE = 100;
const MAX_PAGES = 200;

export type ApolloSyncResult = {
  imported: number;
  created: number;
  skippedNoEmail: number;
  pages: number;
  capped: boolean;
};

function mapApolloName(contact: ApolloContact): string | undefined {
  if (contact.name?.trim()) return contact.name.trim();
  const parts = [contact.first_name, contact.last_name].filter(Boolean);
  const joined = parts.join(' ').trim();
  return joined || undefined;
}

export async function syncApolloContacts(
  userId: string,
  workspaceId: string
): Promise<ApolloSyncResult> {
  const apiKey = await getApolloKey(userId);

  let imported = 0;
  let created = 0;
  let skippedNoEmail = 0;
  let pages = 0;
  let capped = false;
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    if (page > MAX_PAGES) {
      capped = true;
      console.warn('[apollo/sync] stopped at MAX_PAGES', MAX_PAGES);
      break;
    }

    const data = await searchApolloContacts(apiKey, page, PER_PAGE);
    totalPages = data.pagination?.total_pages ?? 1;
    pages++;

    for (const contact of data.contacts ?? []) {
      const email = contact.email?.trim().toLowerCase();
      if (!email) {
        skippedNoEmail++;
        continue;
      }

      const result = await upsertContactFromApollo(workspaceId, email, mapApolloName(contact));
      imported++;
      if (result.created) created++;
    }

    page++;
  }

  await prisma.user.update({
    where: { id: userId },
    data: { apolloLastSyncedAt: new Date() },
  });

  return { imported, created, skippedNoEmail, pages, capped };
}
