import type { calendar_v3 } from 'googleapis';
import { CalendarProvider, Prisma } from '@prisma/client';
import { prisma } from '../db.js';
import { linkCalendarEventContacts } from './linkContacts.js';
import type { CalendarAttendee } from './types.js';
import { normalizeEmail } from './types.js';

export function mapGoogleAttendees(
  attendees: calendar_v3.Schema$EventAttendee[] | null | undefined
): CalendarAttendee[] {
  if (!attendees?.length) return [];
  const mapped: CalendarAttendee[] = [];
  for (const a of attendees) {
    const email = normalizeEmail(a.email);
    if (!email) continue;
    mapped.push({
      email,
      name: a.displayName ?? undefined,
      responseStatus: a.responseStatus ?? undefined,
    });
  }
  return mapped;
}

export function parseGoogleEventTimes(event: calendar_v3.Schema$Event): {
  startsAt: Date;
  endsAt: Date;
  allDay: boolean;
  timezone: string | null;
} {
  const allDay = Boolean(event.start?.date && !event.start?.dateTime);
  const timezone = event.start?.timeZone ?? null;

  if (allDay) {
    const start = event.start?.date ?? new Date().toISOString().slice(0, 10);
    const end = event.end?.date ?? start;
    const startsAt = new Date(`${start}T00:00:00.000Z`);
    const endsAt = new Date(`${end}T00:00:00.000Z`);
    return { startsAt, endsAt, allDay: true, timezone };
  }

  const startsAt = new Date(event.start?.dateTime ?? Date.now());
  const endsAt = new Date(event.end?.dateTime ?? startsAt);
  return { startsAt, endsAt, allDay: false, timezone };
}

export interface UpsertCalendarEventOptions {
  createdFromCrm?: boolean;
}

export async function upsertGoogleCalendarEvent(
  workspaceId: string,
  event: calendar_v3.Schema$Event,
  calendarId: string,
  options?: UpsertCalendarEventOptions
): Promise<'imported' | 'updated' | 'cancelled' | 'skipped'> {
  const googleEventId = event.id;
  if (!googleEventId) return 'skipped';

  const cancelled = event.status === 'cancelled';
  const { startsAt, endsAt, allDay, timezone } = parseGoogleEventTimes(event);
  const attendees = mapGoogleAttendees(event.attendees);
  const organizerEmail = normalizeEmail(event.organizer?.email);
  const now = new Date();

  const data = {
    provider: CalendarProvider.gmail,
    calendarId,
    googleEventId,
    outlookEventId: null,
    icalUid: event.iCalUID ?? null,
    title: event.summary ?? null,
    description: event.description ?? null,
    location: event.location ?? null,
    startsAt,
    endsAt,
    allDay,
    timezone,
    status: event.status ?? null,
    isCancelled: cancelled,
    organizerEmail,
    attendees: attendees.length ? (attendees as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
    htmlLink: event.htmlLink ?? null,
    webLink: event.hangoutLink ?? null,
    lastSyncedAt: now,
  };

  const existing = await prisma.calendarEvent.findFirst({
    where: { workspaceId, calendarId, googleEventId },
  });

  const dataWithCrm = {
    ...data,
    createdFromCrm: options?.createdFromCrm ?? existing?.createdFromCrm ?? false,
  };

  let eventId: string;
  let result: 'imported' | 'updated' | 'cancelled';

  if (existing) {
    await prisma.calendarEvent.update({ where: { id: existing.id }, data: dataWithCrm });
    eventId = existing.id;
    result = cancelled ? 'cancelled' : 'updated';
  } else {
    const created = await prisma.calendarEvent.create({
      data: { workspaceId, ...dataWithCrm },
    });
    eventId = created.id;
    result = cancelled ? 'cancelled' : 'imported';
  }

  await linkCalendarEventContacts(workspaceId, eventId, organizerEmail, attendees);
  return result;
}
