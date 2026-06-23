import type { CalendarProvider, UserCalendar } from '@prisma/client';
import { prisma } from '../db.js';
import type { MailProvider } from '../auth/userResponse.js';
import type { UserCalendarInput } from './types.js';
import { listOutlookCalendars } from '../outlook/calendar/list.js';

export const OUTLOOK_DEFAULT_CALENDAR_SENTINEL = 'default';

export interface CalendarToSync {
  rowId: string | null;
  calendarId: string;
  syncToken: string | null;
}

export function mailProviderToCalendarProvider(provider: MailProvider): CalendarProvider | null {
  if (provider === 'gmail') return 'gmail';
  if (provider === 'outlook') return 'outlook';
  return null;
}

export function serializeUserCalendar(row: UserCalendar) {
  return {
    id: row.id,
    calendarId: row.calendarId,
    calendarName: row.calendarName,
    isPrimary: row.isPrimary,
    syncEnabled: row.syncEnabled,
    provider: row.provider,
  };
}

export function validateUserCalendarInputs(calendars: UserCalendarInput[]): string | null {
  for (const cal of calendars) {
    if (!cal.calendarId?.trim()) return 'invalid_calendar_id';
    if (!cal.calendarName?.trim()) return 'invalid_calendar_name';
  }
  return null;
}

export async function loadUserCalendars(userId: string) {
  const rows = await prisma.userCalendar.findMany({
    where: { userId },
    orderBy: [{ isPrimary: 'desc' }, { calendarName: 'asc' }],
  });
  return rows.map(serializeUserCalendar);
}

export async function syncUserCalendars(
  userId: string,
  provider: CalendarProvider,
  calendars: UserCalendarInput[]
): Promise<void> {
  const calendarIds = calendars.map((c) => c.calendarId.trim());

  await prisma.$transaction(async (tx) => {
    await tx.userCalendar.deleteMany({
      where: {
        userId,
        provider,
        calendarId: { notIn: calendarIds },
      },
    });

    for (const cal of calendars) {
      await tx.userCalendar.upsert({
        where: {
          userId_calendarId: { userId, calendarId: cal.calendarId.trim() },
        },
        create: {
          userId,
          provider,
          calendarId: cal.calendarId.trim(),
          calendarName: cal.calendarName.trim(),
          isPrimary: cal.isPrimary ?? false,
          syncEnabled: cal.syncEnabled ?? true,
        },
        update: {
          provider,
          calendarName: cal.calendarName.trim(),
          isPrimary: cal.isPrimary ?? false,
          syncEnabled: cal.syncEnabled ?? true,
        },
      });
    }
  });
}

export async function getEnabledUserCalendars(userId: string, provider: CalendarProvider) {
  return prisma.userCalendar.findMany({
    where: { userId, provider, syncEnabled: true },
    orderBy: [{ isPrimary: 'desc' }, { calendarName: 'asc' }],
  });
}

export function resolveCalendarsToSync(
  enabledRows: UserCalendar[],
  legacyToken: string | null,
  provider: CalendarProvider
): CalendarToSync[] {
  if (enabledRows.length > 0) {
    return enabledRows.map((row) => ({
      rowId: row.id,
      calendarId: row.calendarId,
      syncToken: row.syncToken,
    }));
  }

  if (provider === 'gmail') {
    return [{ rowId: null, calendarId: 'primary', syncToken: legacyToken }];
  }

  return [
    {
      rowId: null,
      calendarId: OUTLOOK_DEFAULT_CALENDAR_SENTINEL,
      syncToken: legacyToken,
    },
  ];
}

export async function getCalendarsToSync(
  userId: string,
  provider: CalendarProvider,
  legacyToken: string | null
): Promise<CalendarToSync[]> {
  const enabled = await getEnabledUserCalendars(userId, provider);
  return resolveCalendarsToSync(enabled, legacyToken, provider);
}

export async function saveCalendarSyncToken(
  userId: string,
  provider: CalendarProvider,
  calendar: CalendarToSync,
  token: string
): Promise<void> {
  if (calendar.rowId) {
    await prisma.userCalendar.update({
      where: { id: calendar.rowId },
      data: { syncToken: token, lastSyncedAt: new Date() },
    });
    return;
  }

  if (provider === 'gmail') {
    await prisma.user.update({
      where: { id: userId },
      data: { googleCalendarSyncToken: token },
    });
    return;
  }

  await prisma.user.update({
    where: { id: userId },
    data: { outlookCalendarDeltaToken: token },
  });
}

export async function clearCalendarSyncToken(
  userId: string,
  provider: CalendarProvider,
  calendar: CalendarToSync
): Promise<void> {
  if (calendar.rowId) {
    await prisma.userCalendar.update({
      where: { id: calendar.rowId },
      data: { syncToken: null },
    });
    return;
  }

  if (provider === 'gmail') {
    await prisma.user.update({
      where: { id: userId },
      data: { googleCalendarSyncToken: null },
    });
    return;
  }

  await prisma.user.update({
    where: { id: userId },
    data: { outlookCalendarDeltaToken: null },
  });
}

export async function migrateLegacyGoogleToken(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { googleCalendarSyncToken: true },
  });
  if (!user?.googleCalendarSyncToken) return;

  const primary = await prisma.userCalendar.findFirst({
    where: { userId, provider: 'gmail', calendarId: 'primary' },
  });
  if (!primary || primary.syncToken) return;

  await prisma.userCalendar.update({
    where: { id: primary.id },
    data: { syncToken: user.googleCalendarSyncToken },
  });
}

export async function migrateLegacyOutlookToken(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { outlookCalendarDeltaToken: true },
  });
  if (!user?.outlookCalendarDeltaToken) return;

  const primary = await prisma.userCalendar.findFirst({
    where: { userId, provider: 'outlook', isPrimary: true },
  });
  if (!primary || primary.syncToken) return;

  await prisma.userCalendar.update({
    where: { id: primary.id },
    data: { syncToken: user.outlookCalendarDeltaToken },
  });
}

export async function clearUserCalendarSyncTokens(
  userId: string,
  provider: CalendarProvider
): Promise<void> {
  await prisma.userCalendar.updateMany({
    where: { userId, provider },
    data: { syncToken: null, lastSyncedAt: null },
  });
}

export async function ensureDefaultUserCalendar(
  userId: string,
  provider: MailProvider
): Promise<void> {
  if (!provider) return;

  const calendarProvider = mailProviderToCalendarProvider(provider);
  if (!calendarProvider) return;

  const existing = await prisma.userCalendar.count({
    where: { userId, provider: calendarProvider },
  });
  if (existing > 0) return;

  if (provider === 'gmail') {
    await prisma.userCalendar.upsert({
      where: { userId_calendarId: { userId, calendarId: 'primary' } },
      create: {
        userId,
        provider: 'gmail',
        calendarId: 'primary',
        calendarName: 'Primary',
        isPrimary: true,
        syncEnabled: true,
      },
      update: {},
    });
    return;
  }

  const result = await listOutlookCalendars(userId);
  if ('error' in result) return;

  const primary =
    result.calendars.find((c) => c.isPrimary) ?? result.calendars[0];
  if (!primary) return;

  await prisma.userCalendar.upsert({
    where: { userId_calendarId: { userId, calendarId: primary.id } },
    create: {
      userId,
      provider: 'outlook',
      calendarId: primary.id,
      calendarName: primary.name,
      isPrimary: primary.isPrimary,
      syncEnabled: true,
    },
    update: {},
  });
}
