import type { CalendarEvent, CalendarProvider } from '@prisma/client';
import { prisma } from '../db.js';
import { deriveMailProvider, type MailProvider } from '../auth/userResponse.js';
import {
  probeGoogleCalendarWriteScope,
  probeOutlookCalendarWriteScope,
} from './scopes.js';
import { listOutlookCalendars } from '../outlook/calendar/list.js';
import { mailProviderToCalendarProvider } from './userCalendars.js';

export class WriteCalendarError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

export async function resolveUserMailProvider(
  userId: string
): Promise<{ provider: MailProvider; calendarProvider: CalendarProvider }> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new WriteCalendarError('not_found');
  const provider = deriveMailProvider(user);
  if (!provider) throw new WriteCalendarError('no_mail_provider');
  const calendarProvider = mailProviderToCalendarProvider(provider);
  if (!calendarProvider) throw new WriteCalendarError('no_mail_provider');
  return { provider, calendarProvider };
}

export async function assertCalendarWriteScope(
  userId: string,
  provider: MailProvider
): Promise<void> {
  const ok =
    provider === 'gmail'
      ? await probeGoogleCalendarWriteScope(userId)
      : await probeOutlookCalendarWriteScope(userId);
  if (!ok) throw new WriteCalendarError('insufficient_scope');
}

export async function assertUserCanWriteToCalendar(
  userId: string,
  calendarProvider: CalendarProvider,
  calendarId: string
): Promise<void> {
  const rows = await prisma.userCalendar.findMany({
    where: { userId, provider: calendarProvider },
    select: { calendarId: true },
  });

  if (rows.length > 0) {
    if (!rows.some((r) => r.calendarId === calendarId)) {
      throw new WriteCalendarError('calendar_permission_denied');
    }
    return;
  }

  if (calendarProvider === 'gmail') {
    if (calendarId !== 'primary') {
      throw new WriteCalendarError('calendar_permission_denied');
    }
    return;
  }

  const result = await listOutlookCalendars(userId);
  if ('error' in result) {
    throw new WriteCalendarError(result.error);
  }
  const primary = result.calendars.find((c) => c.isPrimary) ?? result.calendars[0];
  if (!primary || primary.id !== calendarId) {
    throw new WriteCalendarError('calendar_permission_denied');
  }
}

export async function loadWritableEvent(
  workspaceId: string,
  eventId: string
): Promise<CalendarEvent> {
  const event = await prisma.calendarEvent.findFirst({
    where: { id: eventId, workspaceId },
  });
  if (!event) throw new WriteCalendarError('not_found');
  if (!event.googleEventId && !event.outlookEventId) {
    throw new WriteCalendarError('not_found');
  }
  return event;
}
