import { prisma } from '../../db.js';
import { getOutlookAccessToken } from '../../auth/tokens.js';
import { env } from '../../env.js';
import { ensurePersonalWorkspace } from '../../workspaces/service.js';
import {
  markOutlookCalendarEventCancelled,
  upsertOutlookCalendarEvent,
  type OutlookCalendarEventPayload,
} from '../../calendar/upsertOutlook.js';
import type { CalendarSyncResult } from '../../calendar/types.js';
import { daysAgo, daysAhead } from '../../calendar/types.js';
import {
  type CalendarToSync,
  clearCalendarSyncToken,
  getCalendarsToSync,
  migrateLegacyOutlookToken,
  OUTLOOK_DEFAULT_CALENDAR_SENTINEL,
  saveCalendarSyncToken,
  clearUserCalendarSyncTokens,
} from '../../calendar/userCalendars.js';

const GRAPH = 'https://graph.microsoft.com/v1.0';

function isInsufficientScope(status: number): boolean {
  return status === 403;
}

function buildInitialDeltaUrl(calendarId: string): string {
  const start = daysAgo(env.calendarSyncPastDays).toISOString();
  const end = daysAhead(env.calendarSyncFutureDays).toISOString();
  const select =
    'id,iCalUId,subject,bodyPreview,start,end,location,organizer,attendees,webLink,isCancelled,showAs,isAllDay';
  const base =
    calendarId === OUTLOOK_DEFAULT_CALENDAR_SENTINEL
      ? `${GRAPH}/me/calendar/events/delta`
      : `${GRAPH}/me/calendars/${encodeURIComponent(calendarId)}/events/delta`;
  return `${base}?$select=${select}&$top=50&startDateTime=${encodeURIComponent(start)}&endDateTime=${encodeURIComponent(end)}`;
}

async function syncOutlookCalendarForUserCalendar(
  userId: string,
  calendar: CalendarToSync
): Promise<CalendarSyncResult> {
  const token = await getOutlookAccessToken(userId);
  const workspace = await ensurePersonalWorkspace(userId);

  let imported = 0;
  let updated = 0;
  let cancelled = 0;
  let url: string | undefined =
    calendar.syncToken ?? buildInitialDeltaUrl(calendar.calendarId);
  let deltaLink: string | undefined;

  while (url) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      if (res.status === 410 && calendar.syncToken) {
        await clearCalendarSyncToken(userId, 'outlook', calendar);
        url = buildInitialDeltaUrl(calendar.calendarId);
        continue;
      }
      const err = new Error(`graph_delta_${res.status}`);
      (err as Error & { status: number }).status = res.status;
      throw err;
    }
    const body = (await res.json()) as {
      value?: Array<OutlookCalendarEventPayload & { '@removed'?: { reason: string } }>;
      '@odata.nextLink'?: string;
      '@odata.deltaLink'?: string;
    };

    const storedCalendarId =
      calendar.calendarId === OUTLOOK_DEFAULT_CALENDAR_SENTINEL
        ? OUTLOOK_DEFAULT_CALENDAR_SENTINEL
        : calendar.calendarId;

    for (const event of body.value ?? []) {
      if (event['@removed']) {
        await markOutlookCalendarEventCancelled(workspace.id, event.id, storedCalendarId);
        cancelled++;
        continue;
      }
      const r = await upsertOutlookCalendarEvent(workspace.id, event, storedCalendarId);
      if (r === 'imported') imported++;
      else if (r === 'updated') updated++;
      else if (r === 'cancelled') cancelled++;
    }

    url = body['@odata.nextLink'];
    deltaLink = body['@odata.deltaLink'] ?? deltaLink;
  }

  if (deltaLink) {
    await saveCalendarSyncToken(userId, 'outlook', calendar, deltaLink);
  }

  return {
    imported,
    updated,
    cancelled,
    syncTokenSaved: Boolean(deltaLink),
  };
}

export async function syncOutlookCalendar(userId: string): Promise<CalendarSyncResult> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.calendarSyncEnabled) {
    return { imported: 0, updated: 0, cancelled: 0, syncTokenSaved: false, error: 'calendar_sync_disabled' };
  }
  if (!user.outlookRefreshToken) {
    return { imported: 0, updated: 0, cancelled: 0, syncTokenSaved: false, error: 'no_provider' };
  }

  try {
    await migrateLegacyOutlookToken(userId);

    const calendars = await getCalendarsToSync(
      userId,
      'outlook',
      user.outlookCalendarDeltaToken
    );
    let imported = 0;
    let updated = 0;
    let cancelled = 0;
    let syncTokenSaved = false;

    for (const cal of calendars) {
      const result = await syncOutlookCalendarForUserCalendar(userId, cal);
      imported += result.imported;
      updated += result.updated;
      cancelled += result.cancelled;
      if (result.syncTokenSaved) syncTokenSaved = true;
    }

    await prisma.user.update({
      where: { id: userId },
      data: { outlookCalendarLastSyncedAt: new Date() },
    });

    return { imported, updated, cancelled, syncTokenSaved };
  } catch (err) {
    const status = (err as { status?: number }).status;
    if ((err as Error).message === 'reauth_required' || isInsufficientScope(status ?? 0)) {
      return { imported: 0, updated: 0, cancelled: 0, syncTokenSaved: false, error: 'insufficient_scope' };
    }
    throw err;
  }
}

export async function probeOutlookCalendarScope(userId: string): Promise<boolean> {
  try {
    const token = await getOutlookAccessToken(userId);
    const start = new Date().toISOString();
    const end = daysAhead(1).toISOString();
    const url = `${GRAPH}/me/calendar/events?$top=1&startDateTime=${encodeURIComponent(start)}&endDateTime=${encodeURIComponent(end)}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    return res.ok;
  } catch (err) {
    if ((err as Error).message === 'reauth_required') return false;
    throw err;
  }
}

export async function resetOutlookCalendarSync(userId: string, workspaceId: string): Promise<void> {
  await prisma.calendarEvent.deleteMany({
    where: { workspaceId, provider: 'outlook' },
  });
  await clearUserCalendarSyncTokens(userId, 'outlook');
  await prisma.user.update({
    where: { id: userId },
    data: {
      outlookCalendarDeltaToken: null,
      outlookCalendarLastSyncedAt: null,
    },
  });
}
