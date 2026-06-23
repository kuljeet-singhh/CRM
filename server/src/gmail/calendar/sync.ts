import { google, type calendar_v3 } from 'googleapis';
import { prisma } from '../../db.js';
import { getGoogleOAuth2 } from '../../auth/tokens.js';
import { env } from '../../env.js';
import { ensurePersonalWorkspace } from '../../workspaces/service.js';
import { upsertGoogleCalendarEvent } from '../../calendar/upsertGoogle.js';
import type { CalendarSyncResult } from '../../calendar/types.js';
import { daysAgo, daysAhead } from '../../calendar/types.js';
import {
  type CalendarToSync,
  clearCalendarSyncToken,
  getCalendarsToSync,
  migrateLegacyGoogleToken,
  saveCalendarSyncToken,
  clearUserCalendarSyncTokens,
} from '../../calendar/userCalendars.js';

function isInsufficientScope(err: unknown): boolean {
  const e = err as { code?: number; response?: { status?: number } };
  return e.code === 403 || e.response?.status === 403;
}

function isSyncTokenGone(err: unknown): boolean {
  const e = err as { code?: number; response?: { status?: number } };
  return e.code === 410 || e.response?.status === 410;
}

async function syncGoogleCalendarForUserCalendar(
  userId: string,
  calendar: CalendarToSync
): Promise<CalendarSyncResult> {
  const auth = await getGoogleOAuth2(userId);
  const calendarApi = google.calendar({ version: 'v3', auth });
  const workspace = await ensurePersonalWorkspace(userId);

  let imported = 0;
  let updated = 0;
  let cancelled = 0;
  let pageToken: string | undefined;
  let nextSyncToken: string | undefined;
  let syncToken = calendar.syncToken;

  const baseParams = {
    calendarId: calendar.calendarId,
    singleEvents: true,
    showDeleted: true,
    maxResults: 250,
  };

  const runList = async (token: string | null) => {
    pageToken = undefined;
    nextSyncToken = undefined;
    do {
      const listParams: calendar_v3.Params$Resource$Events$List = {
        ...baseParams,
        ...(token
          ? { syncToken: token }
          : {
              timeMin: daysAgo(env.calendarSyncPastDays).toISOString(),
              timeMax: daysAhead(env.calendarSyncFutureDays).toISOString(),
            }),
        pageToken,
      };
      const res = await calendarApi.events.list(listParams);

      for (const event of res.data.items ?? []) {
        const result = await upsertGoogleCalendarEvent(workspace.id, event, calendar.calendarId);
        if (result === 'imported') imported++;
        else if (result === 'updated') updated++;
        else if (result === 'cancelled') cancelled++;
      }

      pageToken = res.data.nextPageToken ?? undefined;
      nextSyncToken = res.data.nextSyncToken ?? nextSyncToken;
    } while (pageToken);
  };

  try {
    await runList(syncToken);
  } catch (err) {
    if (syncToken && isSyncTokenGone(err)) {
      await clearCalendarSyncToken(userId, 'gmail', calendar);
      syncToken = null;
      await runList(null);
    } else {
      throw err;
    }
  }

  if (nextSyncToken) {
    await saveCalendarSyncToken(userId, 'gmail', calendar, nextSyncToken);
  }

  return {
    imported,
    updated,
    cancelled,
    syncTokenSaved: Boolean(nextSyncToken),
  };
}

export async function syncGoogleCalendar(userId: string): Promise<CalendarSyncResult> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.calendarSyncEnabled) {
    return { imported: 0, updated: 0, cancelled: 0, syncTokenSaved: false, error: 'calendar_sync_disabled' };
  }
  if (!user.googleRefreshToken) {
    return { imported: 0, updated: 0, cancelled: 0, syncTokenSaved: false, error: 'no_provider' };
  }

  try {
    await migrateLegacyGoogleToken(userId);

    const calendars = await getCalendarsToSync(userId, 'gmail', user.googleCalendarSyncToken);
    let imported = 0;
    let updated = 0;
    let cancelled = 0;
    let syncTokenSaved = false;

    for (const cal of calendars) {
      const result = await syncGoogleCalendarForUserCalendar(userId, cal);
      imported += result.imported;
      updated += result.updated;
      cancelled += result.cancelled;
      if (result.syncTokenSaved) syncTokenSaved = true;
    }

    await prisma.user.update({
      where: { id: userId },
      data: { googleCalendarLastSyncedAt: new Date() },
    });

    return { imported, updated, cancelled, syncTokenSaved };
  } catch (err) {
    if ((err as Error).message === 'reauth_required' || isInsufficientScope(err)) {
      return { imported: 0, updated: 0, cancelled: 0, syncTokenSaved: false, error: 'insufficient_scope' };
    }
    throw err;
  }
}

export async function probeGoogleCalendarScope(userId: string): Promise<boolean> {
  try {
    const auth = await getGoogleOAuth2(userId);
    const calendar = google.calendar({ version: 'v3', auth });
    await calendar.events.list({
      calendarId: 'primary',
      maxResults: 1,
      timeMin: new Date().toISOString(),
      timeMax: daysAhead(1).toISOString(),
    });
    return true;
  } catch (err) {
    if ((err as Error).message === 'reauth_required' || isInsufficientScope(err)) {
      return false;
    }
    throw err;
  }
}

export async function resetGoogleCalendarSync(userId: string, workspaceId: string): Promise<void> {
  await prisma.calendarEvent.deleteMany({
    where: { workspaceId, provider: 'gmail' },
  });
  await clearUserCalendarSyncTokens(userId, 'gmail');
  await prisma.user.update({
    where: { id: userId },
    data: {
      googleCalendarSyncToken: null,
      googleCalendarLastSyncedAt: null,
    },
  });
}
