import { CalendarProvider, Prisma } from '@prisma/client';
import { prisma } from '../db.js';
import type { CalendarAttendee } from './types.js';
import { normalizeEmail } from './types.js';

export interface OutlookCalendarEventPayload {
  id: string;
  iCalUId?: string;
  subject?: string;
  bodyPreview?: string;
  start?: { dateTime?: string; timeZone?: string };
  end?: { dateTime?: string; timeZone?: string };
  isAllDay?: boolean;
  isCancelled?: boolean;
  showAs?: string;
  location?: { displayName?: string };
  organizer?: { emailAddress?: { address?: string; name?: string } };
  attendees?: Array<{
    emailAddress?: { address?: string; name?: string };
    status?: { response?: string };
  }>;
  webLink?: string;
}

export function mapOutlookAttendees(
  attendees: OutlookCalendarEventPayload['attendees']
): CalendarAttendee[] {
  if (!attendees?.length) return [];
  const mapped: CalendarAttendee[] = [];
  for (const a of attendees) {
    const email = normalizeEmail(a.emailAddress?.address);
    if (!email) continue;
    mapped.push({
      email,
      name: a.emailAddress?.name ?? undefined,
      responseStatus: a.status?.response ?? undefined,
    });
  }
  return mapped;
}

export async function upsertOutlookCalendarEvent(
  workspaceId: string,
  event: OutlookCalendarEventPayload
): Promise<'imported' | 'updated' | 'cancelled' | 'skipped'> {
  const outlookEventId = event.id;
  if (!outlookEventId) return 'skipped';

  const cancelled = Boolean(event.isCancelled);
  const startsAt = new Date(event.start?.dateTime ?? Date.now());
  const endsAt = new Date(event.end?.dateTime ?? startsAt);
  const attendees = mapOutlookAttendees(event.attendees);
  const organizerEmail = normalizeEmail(event.organizer?.emailAddress?.address);
  const now = new Date();

  const data = {
    provider: CalendarProvider.outlook,
    googleEventId: null,
    outlookEventId,
    icalUid: event.iCalUId ?? null,
    title: event.subject ?? null,
    description: event.bodyPreview ?? null,
    location: event.location?.displayName ?? null,
    startsAt,
    endsAt,
    allDay: Boolean(event.isAllDay),
    timezone: event.start?.timeZone ?? null,
    status: event.showAs ?? null,
    isCancelled: cancelled,
    organizerEmail,
    attendees: attendees.length ? (attendees as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
    htmlLink: null,
    webLink: event.webLink ?? null,
    lastSyncedAt: now,
  };

  const existing = await prisma.calendarEvent.findFirst({
    where: { workspaceId, outlookEventId },
  });

  if (existing) {
    await prisma.calendarEvent.update({ where: { id: existing.id }, data });
    return cancelled ? 'cancelled' : 'updated';
  }

  await prisma.calendarEvent.create({ data: { workspaceId, ...data } });
  return cancelled ? 'cancelled' : 'imported';
}

export async function markOutlookCalendarEventCancelled(
  workspaceId: string,
  outlookEventId: string
): Promise<void> {
  await prisma.calendarEvent.updateMany({
    where: { workspaceId, outlookEventId },
    data: { isCancelled: true, lastSyncedAt: new Date() },
  });
}
