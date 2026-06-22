import { google, type calendar_v3 } from 'googleapis';
import { prisma } from '../../db.js';
import { getGoogleOAuth2 } from '../../auth/tokens.js';
import { env } from '../../env.js';
import { ensurePersonalWorkspace } from '../../workspaces/service.js';
import { upsertGoogleCalendarEvent } from '../../calendar/upsertGoogle.js';
import type { CalendarSyncResult } from '../../calendar/types.js';
import { daysAgo, daysAhead } from '../../calendar/types.js';

function isInsufficientScope(err: unknown): boolean {
  const e = err as { code?: number; response?: { status?: number } };
  return e.code === 403 || e.response?.status === 403;
}

function isSyncTokenGone(err: unknown): boolean {
  const e = err as { code?: number; response?: { status?: number } };
  return e.code === 410 || e.response?.status === 410;
}

async function listGoogleEvents(userId: string, syncToken: string | null) {
  const auth = await getGoogleOAuth2(userId);
  const calendar = google.calendar({ version: 'v3', auth });

  let imported = 0;
  let updated = 0;
  let cancelled = 0;
  let pageToken: string | undefined;
  let nextSyncToken: string | undefined;

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const workspace = await ensurePersonalWorkspace(userId);

  const baseParams = {
    calendarId: 'primary',
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
      const res = await calendar.events.list(listParams);

      for (const event of res.data.items ?? []) {
        const result = await upsertGoogleCalendarEvent(workspace.id, event);
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
      await prisma.user.update({
        where: { id: userId },
        data: { googleCalendarSyncToken: null },
      });
      await runList(null);
    } else {
      throw err;
    }
  }

  if (nextSyncToken) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        googleCalendarSyncToken: nextSyncToken,
        googleCalendarLastSyncedAt: new Date(),
      },
    });
  }

  return {
    imported,
    updated,
    cancelled,
    syncTokenSaved: Boolean(nextSyncToken),
  } satisfies CalendarSyncResult;
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
    return await listGoogleEvents(userId, user.googleCalendarSyncToken);
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
  await prisma.user.update({
    where: { id: userId },
    data: {
      googleCalendarSyncToken: null,
      googleCalendarLastSyncedAt: null,
    },
  });
}
