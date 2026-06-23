import { getOutlookAccessToken } from '../auth/tokens.js';
import type { CreateCalendarEventBody, UpdateCalendarEventBody } from './types.js';
import type { OutlookCalendarEventPayload } from './upsertOutlook.js';
import { WriteCalendarError } from './writeAuth.js';

const GRAPH = 'https://graph.microsoft.com/v1.0';

function mapGraphError(status: number): never {
  if (status === 401) throw new WriteCalendarError('reauth_required');
  if (status === 403) throw new WriteCalendarError('calendar_permission_denied');
  throw new WriteCalendarError('provider_error');
}

function buildOutlookEventBody(
  body: CreateCalendarEventBody | UpdateCalendarEventBody,
  existing?: { startsAt: Date; endsAt: Date; title: string | null; location: string | null }
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  const title = 'title' in body && body.title !== undefined ? body.title : existing?.title;
  if (title !== undefined) payload.subject = title;

  const startsAt =
    body.startsAt !== undefined ? body.startsAt : existing?.startsAt.toISOString();
  const endsAt = body.endsAt !== undefined ? body.endsAt : existing?.endsAt.toISOString();
  if (startsAt) {
    payload.start = { dateTime: startsAt, timeZone: 'UTC' };
  }
  if (endsAt) {
    payload.end = { dateTime: endsAt, timeZone: 'UTC' };
  }

  if (body.location !== undefined) {
    payload.location = body.location ? { displayName: body.location } : null;
  } else if (existing?.location) {
    payload.location = { displayName: existing.location };
  }

  if (body.attendeeEmails !== undefined) {
    payload.attendees = body.attendeeEmails.map((email) => ({
      emailAddress: { address: email },
      type: 'required',
    }));
  }

  return payload;
}

export async function createOutlookCalendarEvent(
  userId: string,
  calendarId: string,
  body: CreateCalendarEventBody
): Promise<OutlookCalendarEventPayload> {
  const token = await getOutlookAccessToken(userId);
  const res = await fetch(`${GRAPH}/me/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(buildOutlookEventBody(body)),
  });
  if (!res.ok) mapGraphError(res.status);
  return (await res.json()) as OutlookCalendarEventPayload;
}

export async function updateOutlookCalendarEvent(
  userId: string,
  outlookEventId: string,
  body: UpdateCalendarEventBody,
  existing: { startsAt: Date; endsAt: Date; title: string | null; location: string | null }
): Promise<OutlookCalendarEventPayload> {
  const token = await getOutlookAccessToken(userId);
  const res = await fetch(`${GRAPH}/me/events/${encodeURIComponent(outlookEventId)}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(buildOutlookEventBody(body, existing)),
  });
  if (!res.ok) mapGraphError(res.status);
  return (await res.json()) as OutlookCalendarEventPayload;
}

export async function cancelOutlookCalendarEvent(
  userId: string,
  outlookEventId: string
): Promise<void> {
  const token = await getOutlookAccessToken(userId);
  const res = await fetch(`${GRAPH}/me/events/${encodeURIComponent(outlookEventId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok && res.status !== 404) mapGraphError(res.status);
}
