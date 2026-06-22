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

const GRAPH = 'https://graph.microsoft.com/v1.0';

function isInsufficientScope(status: number): boolean {
  return status === 403;
}

function buildInitialDeltaUrl(): string {
  const start = daysAgo(env.calendarSyncPastDays).toISOString();
  const end = daysAhead(env.calendarSyncFutureDays).toISOString();
  const select =
    'id,iCalUId,subject,bodyPreview,start,end,location,organizer,attendees,webLink,isCancelled,showAs,isAllDay';
  return `${GRAPH}/me/calendar/events/delta?$select=${select}&$top=50&startDateTime=${encodeURIComponent(start)}&endDateTime=${encodeURIComponent(end)}`;
}

async function fetchDelta(userId: string, startUrl: string) {
  const token = await getOutlookAccessToken(userId);
  const workspace = await ensurePersonalWorkspace(userId);

  let imported = 0;
  let updated = 0;
  let cancelled = 0;
  let url: string | undefined = startUrl;
  let deltaLink: string | undefined;

  while (url) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      const err = new Error(`graph_delta_${res.status}`);
      (err as Error & { status: number }).status = res.status;
      throw err;
    }
    const body = (await res.json()) as {
      value?: Array<OutlookCalendarEventPayload & { '@removed'?: { reason: string } }>;
      '@odata.nextLink'?: string;
      '@odata.deltaLink'?: string;
    };

    for (const event of body.value ?? []) {
      if (event['@removed']) {
        await markOutlookCalendarEventCancelled(workspace.id, event.id);
        cancelled++;
        continue;
      }
      const r = await upsertOutlookCalendarEvent(workspace.id, event);
      if (r === 'imported') imported++;
      else if (r === 'updated') updated++;
      else if (r === 'cancelled') cancelled++;
    }

    url = body['@odata.nextLink'];
    deltaLink = body['@odata.deltaLink'] ?? deltaLink;
  }

  return { imported, updated, cancelled, deltaLink };
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
    const startUrl = user.outlookCalendarDeltaToken ?? buildInitialDeltaUrl();
    const { imported, updated, cancelled, deltaLink } = await fetchDelta(userId, startUrl);

    if (deltaLink) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          outlookCalendarDeltaToken: deltaLink,
          outlookCalendarLastSyncedAt: new Date(),
        },
      });
    }

    return {
      imported,
      updated,
      cancelled,
      syncTokenSaved: Boolean(deltaLink),
    };
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
  await prisma.user.update({
    where: { id: userId },
    data: {
      outlookCalendarDeltaToken: null,
      outlookCalendarLastSyncedAt: null,
    },
  });
}
