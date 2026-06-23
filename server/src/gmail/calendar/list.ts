import { google, type calendar_v3 } from 'googleapis';
import { getGoogleOAuth2 } from '../../auth/tokens.js';
import { probeGoogleCalendarWriteScope } from '../../calendar/scopes.js';
import type { CalendarListItem, CalendarListResult } from '../../calendar/types.js';

function isInsufficientScope(err: unknown): boolean {
  const e = err as { code?: number; response?: { status?: number } };
  return e.code === 403 || e.response?.status === 403;
}

export function mapGoogleCalendarListItem(
  entry: calendar_v3.Schema$CalendarListEntry
): CalendarListItem | null {
  const id = entry.id;
  if (!id) return null;
  return {
    id,
    name: entry.summary ?? id,
    isPrimary: Boolean(entry.primary),
    accessRole: entry.accessRole ?? undefined,
  };
}

export async function listGoogleCalendars(userId: string): Promise<CalendarListResult> {
  const hasWriteScope = await probeGoogleCalendarWriteScope(userId);
  if (!hasWriteScope) {
    return { error: 'insufficient_scope' };
  }

  try {
    const auth = await getGoogleOAuth2(userId);
    const calendar = google.calendar({ version: 'v3', auth });
    const calendars: CalendarListItem[] = [];
    let pageToken: string | undefined;

    do {
      const res = await calendar.calendarList.list({ pageToken, maxResults: 250 });
      for (const item of res.data.items ?? []) {
        const mapped = mapGoogleCalendarListItem(item);
        if (mapped) calendars.push(mapped);
      }
      pageToken = res.data.nextPageToken ?? undefined;
    } while (pageToken);

    return { calendars };
  } catch (err) {
    if ((err as Error).message === 'reauth_required') throw err;
    if (isInsufficientScope(err)) return { error: 'insufficient_scope' };
    throw err;
  }
}
