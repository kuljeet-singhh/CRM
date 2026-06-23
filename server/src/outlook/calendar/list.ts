import { getOutlookAccessToken } from '../../auth/tokens.js';
import { hasOutlookCalendarWriteScope } from '../../calendar/scopes.js';
import type { CalendarListItem, CalendarListResult } from '../../calendar/types.js';

const GRAPH = 'https://graph.microsoft.com/v1.0';

export interface OutlookCalendarListEntry {
  id: string;
  name?: string;
  isDefaultCalendar?: boolean;
  canEdit?: boolean;
}

export function mapOutlookCalendarListItem(entry: OutlookCalendarListEntry): CalendarListItem {
  return {
    id: entry.id,
    name: entry.name ?? entry.id,
    isPrimary: Boolean(entry.isDefaultCalendar),
    accessRole: entry.canEdit === false ? 'reader' : 'writer',
  };
}

export async function listOutlookCalendars(userId: string): Promise<CalendarListResult> {
  let token: string;
  try {
    token = await getOutlookAccessToken(userId);
  } catch (err) {
    if ((err as Error).message === 'reauth_required') throw err;
    throw err;
  }

  if (!hasOutlookCalendarWriteScope(token)) {
    return { error: 'insufficient_scope' };
  }

  try {
    const calendars: CalendarListItem[] = [];
    let url: string | null = `${GRAPH}/me/calendars?$top=100`;

    while (url) {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 403) return { error: 'insufficient_scope' };
      if (!res.ok) {
        if (res.status === 401) throw new Error('reauth_required');
        throw new Error(`graph_calendars_failed:${res.status}`);
      }

      const data = (await res.json()) as {
        value?: OutlookCalendarListEntry[];
        '@odata.nextLink'?: string;
      };
      for (const item of data.value ?? []) {
        if (item.id) calendars.push(mapOutlookCalendarListItem(item));
      }
      url = data['@odata.nextLink'] ?? null;
    }

    return { calendars };
  } catch (err) {
    if ((err as Error).message === 'reauth_required') throw err;
    throw err;
  }
}
