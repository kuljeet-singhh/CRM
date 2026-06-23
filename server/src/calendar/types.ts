export interface CalendarAttendee {
  email: string;
  name?: string;
  responseStatus?: string;
}

export interface CalendarSyncResult {
  imported: number;
  updated: number;
  cancelled: number;
  syncTokenSaved: boolean;
  error?: 'insufficient_scope' | 'calendar_sync_disabled' | 'no_provider';
}

export interface CalendarListItem {
  id: string;
  name: string;
  isPrimary: boolean;
  accessRole?: string;
}

export interface UserCalendarInput {
  calendarId: string;
  calendarName: string;
  isPrimary?: boolean;
  syncEnabled?: boolean;
}

export type CalendarListResult =
  | { calendars: CalendarListItem[] }
  | { error: 'insufficient_scope' };

export function daysAgo(days: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export function daysAhead(days: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

export function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const trimmed = email.trim().toLowerCase();
  return trimmed || null;
}

export interface CreateCalendarEventBody {
  calendarId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  attendeeEmails: string[];
  location?: string;
  contactId?: string;
}

export interface UpdateCalendarEventBody {
  title?: string;
  startsAt?: string;
  endsAt?: string;
  attendeeEmails?: string[];
  location?: string;
}

export function parseIsoDate(value: string): Date | null {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function normalizeAttendeeEmails(emails: string[] | undefined): string[] {
  if (!emails?.length) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of emails) {
    const email = normalizeEmail(raw);
    if (!email || seen.has(email)) continue;
    seen.add(email);
    result.push(email);
  }
  return result;
}

export function validateCreateEventBody(body: unknown): string | null {
  if (!body || typeof body !== 'object') return 'invalid_body';
  const b = body as Record<string, unknown>;
  if (!b.calendarId || typeof b.calendarId !== 'string' || !b.calendarId.trim()) {
    return 'invalid_body';
  }
  if (!b.title || typeof b.title !== 'string' || !b.title.trim()) return 'invalid_body';
  if (typeof b.startsAt !== 'string' || !parseIsoDate(b.startsAt)) return 'invalid_dates';
  if (typeof b.endsAt !== 'string' || !parseIsoDate(b.endsAt)) return 'invalid_dates';
  const startsAt = parseIsoDate(b.startsAt as string)!;
  const endsAt = parseIsoDate(b.endsAt as string)!;
  if (endsAt <= startsAt) return 'invalid_dates';
  if (b.attendeeEmails !== undefined && !Array.isArray(b.attendeeEmails)) return 'invalid_body';
  if (b.location !== undefined && typeof b.location !== 'string') return 'invalid_body';
  if (b.contactId !== undefined && typeof b.contactId !== 'string') return 'invalid_body';
  return null;
}

export function validateUpdateEventBody(body: unknown): string | null {
  if (!body || typeof body !== 'object') return 'invalid_body';
  const b = body as Record<string, unknown>;
  const hasField =
    b.title !== undefined ||
    b.startsAt !== undefined ||
    b.endsAt !== undefined ||
    b.attendeeEmails !== undefined ||
    b.location !== undefined;
  if (!hasField) return 'invalid_body';
  if (b.title !== undefined && (typeof b.title !== 'string' || !b.title.trim())) {
    return 'invalid_body';
  }
  if (b.startsAt !== undefined && (typeof b.startsAt !== 'string' || !parseIsoDate(b.startsAt))) {
    return 'invalid_dates';
  }
  if (b.endsAt !== undefined && (typeof b.endsAt !== 'string' || !parseIsoDate(b.endsAt))) {
    return 'invalid_dates';
  }
  if (b.attendeeEmails !== undefined && !Array.isArray(b.attendeeEmails)) return 'invalid_body';
  if (b.location !== undefined && typeof b.location !== 'string') return 'invalid_body';

  const startsAt =
    b.startsAt !== undefined ? parseIsoDate(b.startsAt as string) : null;
  const endsAt = b.endsAt !== undefined ? parseIsoDate(b.endsAt as string) : null;
  if (startsAt && endsAt && endsAt <= startsAt) return 'invalid_dates';
  return null;
}

export function toCreateCalendarEventBody(body: unknown): CreateCalendarEventBody {
  const b = body as Record<string, unknown>;
  return {
    calendarId: (b.calendarId as string).trim(),
    title: (b.title as string).trim(),
    startsAt: b.startsAt as string,
    endsAt: b.endsAt as string,
    attendeeEmails: normalizeAttendeeEmails(b.attendeeEmails as string[] | undefined),
    location: typeof b.location === 'string' ? b.location.trim() || undefined : undefined,
    contactId: typeof b.contactId === 'string' ? b.contactId : undefined,
  };
}

export function toUpdateCalendarEventBody(body: unknown): UpdateCalendarEventBody {
  const b = body as Record<string, unknown>;
  return {
    title: typeof b.title === 'string' ? b.title.trim() : undefined,
    startsAt: typeof b.startsAt === 'string' ? b.startsAt : undefined,
    endsAt: typeof b.endsAt === 'string' ? b.endsAt : undefined,
    attendeeEmails:
      b.attendeeEmails !== undefined
        ? normalizeAttendeeEmails(b.attendeeEmails as string[])
        : undefined,
    location: typeof b.location === 'string' ? b.location : undefined,
  };
}
