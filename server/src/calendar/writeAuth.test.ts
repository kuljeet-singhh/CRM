import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../db.js', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    userCalendar: { findMany: vi.fn() },
    calendarEvent: { findFirst: vi.fn() },
  },
}));

vi.mock('./scopes.js', () => ({
  probeGoogleCalendarWriteScope: vi.fn(),
  probeOutlookCalendarWriteScope: vi.fn(),
}));

vi.mock('../outlook/calendar/list.js', () => ({
  listOutlookCalendars: vi.fn(),
}));

import { prisma } from '../db.js';
import {
  assertCalendarWriteScope,
  assertUserCanWriteToCalendar,
  WriteCalendarError,
} from './writeAuth.js';
import { probeGoogleCalendarWriteScope } from './scopes.js';
import { listOutlookCalendars } from '../outlook/calendar/list.js';

describe('assertUserCanWriteToCalendar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows calendarId in user rows', async () => {
    vi.mocked(prisma.userCalendar.findMany).mockResolvedValue([
      { calendarId: 'primary' },
      { calendarId: 'cal-2' },
    ] as never);

    await expect(
      assertUserCanWriteToCalendar('u1', 'gmail', 'cal-2')
    ).resolves.toBeUndefined();
  });

  it('denies unknown calendarId when rows exist', async () => {
    vi.mocked(prisma.userCalendar.findMany).mockResolvedValue([
      { calendarId: 'primary' },
    ] as never);

    await expect(assertUserCanWriteToCalendar('u1', 'gmail', 'other')).rejects.toThrow(
      WriteCalendarError
    );
  });

  it('allows legacy gmail primary when no rows', async () => {
    vi.mocked(prisma.userCalendar.findMany).mockResolvedValue([]);

    await expect(
      assertUserCanWriteToCalendar('u1', 'gmail', 'primary')
    ).resolves.toBeUndefined();
  });

  it('denies legacy gmail non-primary', async () => {
    vi.mocked(prisma.userCalendar.findMany).mockResolvedValue([]);

    await expect(assertUserCanWriteToCalendar('u1', 'gmail', 'other')).rejects.toThrow(
      WriteCalendarError
    );
  });

  it('allows legacy outlook primary calendar', async () => {
    vi.mocked(prisma.userCalendar.findMany).mockResolvedValue([]);
    vi.mocked(listOutlookCalendars).mockResolvedValue({
      calendars: [{ id: 'out-cal-1', name: 'Calendar', isPrimary: true }],
    });

    await expect(
      assertUserCanWriteToCalendar('u1', 'outlook', 'out-cal-1')
    ).resolves.toBeUndefined();
  });
});

describe('assertCalendarWriteScope', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws insufficient_scope when probe fails', async () => {
    vi.mocked(probeGoogleCalendarWriteScope).mockResolvedValue(false);

    await expect(assertCalendarWriteScope('u1', 'gmail')).rejects.toThrow(WriteCalendarError);
  });
});
