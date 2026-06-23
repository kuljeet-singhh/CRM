import { prisma } from '../db.js';
import type { CalendarAttendee } from './types.js';
import { normalizeEmail } from './types.js';

export async function linkCalendarEventContacts(
  workspaceId: string,
  calendarEventId: string,
  organizerEmail: string | null,
  attendees: CalendarAttendee[]
): Promise<void> {
  const emails = new Set<string>();
  const org = normalizeEmail(organizerEmail);
  if (org) emails.add(org);
  for (const a of attendees) {
    const email = normalizeEmail(a.email);
    if (email) emails.add(email);
  }
  if (emails.size === 0) return;

  const contacts = await prisma.contact.findMany({
    where: {
      workspaceId,
      email: { in: [...emails] },
    },
    select: { id: true },
  });
  if (contacts.length === 0) return;

  await prisma.calendarEventContact.createMany({
    data: contacts.map((c) => ({
      calendarEventId,
      contactId: c.id,
    })),
    skipDuplicates: true,
  });
}

export async function linkContactToCalendarEvent(
  workspaceId: string,
  calendarEventId: string,
  contactId: string
): Promise<void> {
  const contact = await prisma.contact.findFirst({
    where: { id: contactId, workspaceId },
    select: { id: true },
  });
  if (!contact) return;

  await prisma.calendarEventContact.createMany({
    data: [{ calendarEventId, contactId: contact.id }],
    skipDuplicates: true,
  });
}
