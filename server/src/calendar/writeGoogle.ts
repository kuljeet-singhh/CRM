import { google, type calendar_v3 } from 'googleapis';
import { getGoogleOAuth2 } from '../auth/tokens.js';
import type { CreateCalendarEventBody, UpdateCalendarEventBody } from './types.js';
import { WriteCalendarError } from './writeAuth.js';

function isPermissionDenied(err: unknown): boolean {
  const e = err as { code?: number; response?: { status?: number } };
  return e.code === 403 || e.response?.status === 403;
}

function mapGoogleError(err: unknown): never {
  if ((err as Error).message === 'reauth_required') {
    throw new WriteCalendarError('reauth_required');
  }
  if (isPermissionDenied(err)) {
    throw new WriteCalendarError('calendar_permission_denied');
  }
  throw err;
}

function buildGoogleEventBody(
  body: CreateCalendarEventBody | UpdateCalendarEventBody,
  existing?: { startsAt: Date; endsAt: Date; title: string | null; location: string | null }
): calendar_v3.Schema$Event {
  const requestBody: calendar_v3.Schema$Event = {};
  const title = 'title' in body && body.title !== undefined ? body.title : existing?.title;
  if (title !== undefined) requestBody.summary = title;

  const startsAt =
    body.startsAt !== undefined ? body.startsAt : existing?.startsAt.toISOString();
  const endsAt = body.endsAt !== undefined ? body.endsAt : existing?.endsAt.toISOString();
  if (startsAt) {
    requestBody.start = { dateTime: startsAt, timeZone: 'UTC' };
  }
  if (endsAt) {
    requestBody.end = { dateTime: endsAt, timeZone: 'UTC' };
  }

  if (body.location !== undefined) {
    requestBody.location = body.location || undefined;
  } else if (existing?.location) {
    requestBody.location = existing.location;
  }

  if (body.attendeeEmails !== undefined) {
    requestBody.attendees = body.attendeeEmails.map((email) => ({ email }));
  }

  return requestBody;
}

export async function createGoogleCalendarEvent(
  userId: string,
  calendarId: string,
  body: CreateCalendarEventBody
): Promise<calendar_v3.Schema$Event> {
  try {
    const auth = await getGoogleOAuth2(userId);
    const calendar = google.calendar({ version: 'v3', auth });
    const res = await calendar.events.insert({
      calendarId,
      sendUpdates: 'all',
      requestBody: buildGoogleEventBody(body),
    });
    if (!res.data.id) throw new WriteCalendarError('provider_error');
    return res.data;
  } catch (err) {
    mapGoogleError(err);
  }
}

export async function updateGoogleCalendarEvent(
  userId: string,
  calendarId: string,
  googleEventId: string,
  body: UpdateCalendarEventBody,
  existing: { startsAt: Date; endsAt: Date; title: string | null; location: string | null }
): Promise<calendar_v3.Schema$Event> {
  try {
    const auth = await getGoogleOAuth2(userId);
    const calendar = google.calendar({ version: 'v3', auth });
    const res = await calendar.events.patch({
      calendarId,
      eventId: googleEventId,
      sendUpdates: 'all',
      requestBody: buildGoogleEventBody(body, existing),
    });
    if (!res.data.id) throw new WriteCalendarError('provider_error');
    return res.data;
  } catch (err) {
    mapGoogleError(err);
  }
}

export async function cancelGoogleCalendarEvent(
  userId: string,
  calendarId: string,
  googleEventId: string
): Promise<void> {
  try {
    const auth = await getGoogleOAuth2(userId);
    const calendar = google.calendar({ version: 'v3', auth });
    await calendar.events.delete({ calendarId, eventId: googleEventId });
  } catch (err) {
    mapGoogleError(err);
  }
}
