import type { CalendarEventItem } from '@/types';

export interface MeetingFormState {
  title: string;
  attendeesText: string;
  startDate: Date | undefined;
  startTime: string;
  endDate: Date | undefined;
  endTime: string;
  location: string;
  calendarId: string;
}

export function padTimePart(n: number): string {
  return String(n).padStart(2, '0');
}

export function formatDateInput(date: Date): string {
  return `${date.getFullYear()}-${padTimePart(date.getMonth() + 1)}-${padTimePart(date.getDate())}`;
}

export function formatTimeInput(date: Date): string {
  return `${padTimePart(date.getHours())}:${padTimePart(date.getMinutes())}`;
}

export function toIsoFromDateAndTime(date: Date | undefined, time: string): string | null {
  if (!date || !time) return null;
  const [hours, minutes] = time.split(':').map((p) => parseInt(p, 10));
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  const d = new Date(date);
  d.setHours(hours, minutes, 0, 0);
  return d.toISOString();
}

export function parseAttendeesText(text: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const part of text.split(/[,;\n]+/)) {
    const email = part.trim().toLowerCase();
    if (!email || !email.includes('@') || seen.has(email)) continue;
    seen.add(email);
    result.push(email);
  }
  return result;
}

export function attendeesToText(
  attendees: CalendarEventItem['attendees'],
  fallbackEmail?: string
): string {
  const emails = attendees.map((a) => a.email).filter(Boolean);
  if (emails.length > 0) return emails.join(', ');
  return fallbackEmail ?? '';
}

export function defaultCreateFormState(contact?: {
  name: string | null;
  email: string;
}): MeetingFormState {
  const start = new Date();
  start.setMinutes(0, 0, 0);
  start.setHours(start.getHours() + 1);
  const end = new Date(start);
  end.setMinutes(30);

  return {
    title: contact?.name ? `Meeting with ${contact.name}` : '',
    attendeesText: contact?.email ?? '',
    startDate: start,
    startTime: formatTimeInput(start),
    endDate: end,
    endTime: formatTimeInput(end),
    location: '',
    calendarId: '',
  };
}

export function parseEventToFormState(event: CalendarEventItem): MeetingFormState {
  const start = new Date(event.startsAt);
  const end = new Date(event.endsAt);
  return {
    title: event.title ?? '',
    attendeesText: attendeesToText(event.attendees),
    startDate: start,
    startTime: formatTimeInput(start),
    endDate: end,
    endTime: formatTimeInput(end),
    location: event.location ?? '',
    calendarId: event.calendarId,
  };
}

export function validateMeetingForm(form: MeetingFormState): string | null {
  if (!form.title.trim()) return 'Title is required.';
  if (!form.calendarId) return 'Select a calendar.';
  const startsAt = toIsoFromDateAndTime(form.startDate, form.startTime);
  const endsAt = toIsoFromDateAndTime(form.endDate, form.endTime);
  if (!startsAt || !endsAt) return 'Start and end date/time are required.';
  if (new Date(endsAt) <= new Date(startsAt)) return 'End must be after start.';
  return null;
}
