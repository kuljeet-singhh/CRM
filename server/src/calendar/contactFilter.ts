import { prisma } from '../db.js';
import { normalizeEmail } from './types.js';

export async function resolveContactEmail(
  workspaceId: string,
  contactId: string
): Promise<string | null> {
  const contact = await prisma.contact.findFirst({
    where: { id: contactId, workspaceId },
    select: { email: true },
  });
  return normalizeEmail(contact?.email);
}

export function eventMatchesContactEmail(
  organizerEmail: string | null,
  attendees: unknown,
  contactEmail: string
): boolean {
  if (organizerEmail === contactEmail) return true;
  if (!Array.isArray(attendees)) return false;
  return attendees.some((a) => {
    if (!a || typeof a !== 'object') return false;
    const email = normalizeEmail((a as { email?: string }).email);
    return email === contactEmail;
  });
}
