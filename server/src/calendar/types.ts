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
