function dateTimeOptions(timezone?: string | null): Intl.DateTimeFormatOptions {
  return timezone ? { timeZone: timezone } : {};
}

export function formatDateTime(iso: string, timezone?: string | null): string {
  const date = new Date(iso);
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    ...dateTimeOptions(timezone),
  });
}

export function formatCalendarEventRange(
  startsAt: string,
  endsAt: string,
  allDay: boolean,
  timezone?: string | null
): string {
  if (allDay) {
    const date = new Date(startsAt);
    const datePart = date.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      ...dateTimeOptions(timezone),
    });
    return `${datePart} (all day)`;
  }

  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const tz = dateTimeOptions(timezone);
  const timeOpts: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit', ...tz };

  if (start.toDateString() === end.toDateString()) {
    const datePart = start.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      ...tz,
    });
    return `${datePart}, ${start.toLocaleTimeString(undefined, timeOpts)} – ${end.toLocaleTimeString(undefined, timeOpts)}`;
  }

  return `${formatDateTime(startsAt, timezone)} – ${formatDateTime(endsAt, timezone)}`;
}

export function formatRelativeTime(iso: string, timezone?: string | null): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;

  return date.toLocaleString(undefined, timezone ? { timeZone: timezone } : undefined);
}
