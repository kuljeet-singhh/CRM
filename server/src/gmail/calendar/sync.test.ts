import { describe, expect, it, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  eventsList: vi.fn(),
  getCalendarsToSync: vi.fn(),
  migrateLegacyGoogleToken: vi.fn(),
  saveCalendarSyncToken: vi.fn(),
  upsertGoogleCalendarEvent: vi.fn(),
  getGoogleOAuth2: vi.fn(),
  ensurePersonalWorkspace: vi.fn(),
}));

vi.mock('googleapis', () => ({
  google: {
    calendar: vi.fn(() => ({
      events: { list: mocks.eventsList },
    })),
  },
}));

vi.mock('../../db.js', () => ({
  prisma: {
    user: { findUnique: vi.fn(), update: vi.fn() },
  },
}));

vi.mock('../../auth/tokens.js', () => ({
  getGoogleOAuth2: mocks.getGoogleOAuth2,
}));

vi.mock('../../workspaces/service.js', () => ({
  ensurePersonalWorkspace: mocks.ensurePersonalWorkspace,
}));

vi.mock('../../calendar/upsertGoogle.js', () => ({
  upsertGoogleCalendarEvent: mocks.upsertGoogleCalendarEvent,
}));

vi.mock('../../calendar/userCalendars.js', () => ({
  getCalendarsToSync: mocks.getCalendarsToSync,
  migrateLegacyGoogleToken: mocks.migrateLegacyGoogleToken,
  saveCalendarSyncToken: mocks.saveCalendarSyncToken,
  clearCalendarSyncToken: vi.fn(),
  clearUserCalendarSyncTokens: vi.fn(),
}));

vi.mock('../../env.js', () => ({
  env: { calendarSyncPastDays: 90, calendarSyncFutureDays: 365 },
}));

import { prisma } from '../../db.js';
import { syncGoogleCalendar } from './sync.js';

const userId = 'user-1';
const workspaceId = 'ws-1';

const enabledUser = {
  id: userId,
  calendarSyncEnabled: true,
  googleRefreshToken: 'refresh',
  googleCalendarSyncToken: null,
};

describe('syncGoogleCalendar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getGoogleOAuth2.mockResolvedValue({});
    mocks.ensurePersonalWorkspace.mockResolvedValue({ id: workspaceId });
    mocks.migrateLegacyGoogleToken.mockResolvedValue(undefined);
    vi.mocked(prisma.user.update).mockResolvedValue({} as never);
    mocks.upsertGoogleCalendarEvent.mockResolvedValue('imported');
  });

  it('returns calendar_sync_disabled when sync is off', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      ...enabledUser,
      calendarSyncEnabled: false,
    } as never);

    const result = await syncGoogleCalendar(userId);
    expect(result.error).toBe('calendar_sync_disabled');
    expect(mocks.getCalendarsToSync).not.toHaveBeenCalled();
  });

  it('loops multiple calendars and aggregates counts', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(enabledUser as never);
    mocks.getCalendarsToSync.mockResolvedValue([
      { rowId: 'uc-1', calendarId: 'primary', syncToken: null },
      { rowId: 'uc-2', calendarId: 'cal-2', syncToken: null },
    ]);

    mocks.eventsList.mockImplementation((params: { calendarId?: string }) => {
      if (params.calendarId === 'primary') {
        return Promise.resolve({
          data: {
            items: [{ id: 'ev-1' }],
            nextSyncToken: 'token-primary',
          },
        });
      }
      return Promise.resolve({
        data: {
          items: [{ id: 'ev-2' }, { id: 'ev-3' }],
          nextSyncToken: 'token-cal-2',
        },
      });
    });

    mocks.upsertGoogleCalendarEvent
      .mockResolvedValueOnce('imported')
      .mockResolvedValueOnce('imported')
      .mockResolvedValueOnce('updated');

    const result = await syncGoogleCalendar(userId);

    expect(mocks.eventsList).toHaveBeenCalledTimes(2);
    expect(mocks.eventsList.mock.calls[0][0].calendarId).toBe('primary');
    expect(mocks.eventsList.mock.calls[1][0].calendarId).toBe('cal-2');
    expect(result.imported).toBe(2);
    expect(result.updated).toBe(1);
    expect(result.syncTokenSaved).toBe(true);
    expect(mocks.saveCalendarSyncToken).toHaveBeenCalledTimes(2);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: userId },
      data: { googleCalendarLastSyncedAt: expect.any(Date) },
    });
  });
});
