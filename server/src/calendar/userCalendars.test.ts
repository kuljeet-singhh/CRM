import { describe, expect, it } from 'vitest';
import { mapGoogleCalendarListItem } from '../gmail/calendar/list.js';
import { mapOutlookCalendarListItem } from '../outlook/calendar/list.js';
import {
  OUTLOOK_DEFAULT_CALENDAR_SENTINEL,
  resolveCalendarsToSync,
  validateUserCalendarInputs,
} from './userCalendars.js';
import type { UserCalendar } from '@prisma/client';

describe('mapGoogleCalendarListItem', () => {
  it('maps primary calendar fields', () => {
    expect(
      mapGoogleCalendarListItem({
        id: 'primary',
        summary: 'Work',
        primary: true,
        accessRole: 'owner',
      })
    ).toEqual({
      id: 'primary',
      name: 'Work',
      isPrimary: true,
      accessRole: 'owner',
    });
  });

  it('returns null without id', () => {
    expect(mapGoogleCalendarListItem({ summary: 'No id' })).toBeNull();
  });
});

describe('mapOutlookCalendarListItem', () => {
  it('maps default calendar fields', () => {
    expect(
      mapOutlookCalendarListItem({
        id: 'cal-1',
        name: 'Calendar',
        isDefaultCalendar: true,
        canEdit: true,
      })
    ).toEqual({
      id: 'cal-1',
      name: 'Calendar',
      isPrimary: true,
      accessRole: 'writer',
    });
  });

  it('maps read-only calendar', () => {
    expect(
      mapOutlookCalendarListItem({
        id: 'cal-2',
        name: 'Shared',
        canEdit: false,
      })
    ).toEqual({
      id: 'cal-2',
      name: 'Shared',
      isPrimary: false,
      accessRole: 'reader',
    });
  });
});

describe('validateUserCalendarInputs', () => {
  it('accepts valid calendars', () => {
    expect(
      validateUserCalendarInputs([
        { calendarId: 'primary', calendarName: 'Primary', syncEnabled: true },
      ])
    ).toBeNull();
  });

  it('rejects empty calendarId', () => {
    expect(validateUserCalendarInputs([{ calendarId: ' ', calendarName: 'X' }])).toBe(
      'invalid_calendar_id'
    );
  });

  it('rejects empty calendarName', () => {
    expect(validateUserCalendarInputs([{ calendarId: 'a', calendarName: '' }])).toBe(
      'invalid_calendar_name'
    );
  });
});

function mockUserCalendar(overrides: Partial<UserCalendar> = {}): UserCalendar {
  return {
    id: 'uc-1',
    userId: 'user-1',
    provider: 'gmail',
    calendarId: 'primary',
    calendarName: 'Primary',
    isPrimary: true,
    syncEnabled: true,
    syncToken: 'token-1',
    lastSyncedAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}

describe('resolveCalendarsToSync', () => {
  it('returns fallback primary when no enabled rows', () => {
    expect(resolveCalendarsToSync([], 'legacy-token', 'gmail')).toEqual([
      { rowId: null, calendarId: 'primary', syncToken: 'legacy-token' },
    ]);
  });

  it('returns outlook default sentinel when no enabled rows', () => {
    expect(resolveCalendarsToSync([], 'delta-link', 'outlook')).toEqual([
      {
        rowId: null,
        calendarId: OUTLOOK_DEFAULT_CALENDAR_SENTINEL,
        syncToken: 'delta-link',
      },
    ]);
  });

  it('returns only syncEnabled rows when present', () => {
    const rows = [
      mockUserCalendar({ id: 'uc-1', calendarId: 'primary', syncToken: 't1' }),
      mockUserCalendar({
        id: 'uc-2',
        calendarId: 'cal-2',
        calendarName: 'Work',
        isPrimary: false,
        syncToken: 't2',
      }),
    ];
    expect(resolveCalendarsToSync(rows, 'legacy', 'gmail')).toEqual([
      { rowId: 'uc-1', calendarId: 'primary', syncToken: 't1' },
      { rowId: 'uc-2', calendarId: 'cal-2', syncToken: 't2' },
    ]);
  });
});
