import { describe, expect, it, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  getCalendarsToSync: vi.fn(),
  migrateLegacyOutlookToken: vi.fn(),
  saveCalendarSyncToken: vi.fn(),
  upsertOutlookCalendarEvent: vi.fn(),
  markOutlookCalendarEventCancelled: vi.fn(),
  getOutlookAccessToken: vi.fn(),
  ensurePersonalWorkspace: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock('../../db.js', () => ({
  prisma: {
    user: { findUnique: vi.fn(), update: vi.fn() },
  },
}));

vi.mock('../../auth/tokens.js', () => ({
  getOutlookAccessToken: mocks.getOutlookAccessToken,
}));

vi.mock('../../workspaces/service.js', () => ({
  ensurePersonalWorkspace: mocks.ensurePersonalWorkspace,
}));

vi.mock('../../calendar/upsertOutlook.js', () => ({
  upsertOutlookCalendarEvent: mocks.upsertOutlookCalendarEvent,
  markOutlookCalendarEventCancelled: mocks.markOutlookCalendarEventCancelled,
}));

vi.mock('../../calendar/userCalendars.js', () => ({
  getCalendarsToSync: mocks.getCalendarsToSync,
  migrateLegacyOutlookToken: mocks.migrateLegacyOutlookToken,
  saveCalendarSyncToken: mocks.saveCalendarSyncToken,
  clearCalendarSyncToken: vi.fn(),
  clearUserCalendarSyncTokens: vi.fn(),
  OUTLOOK_DEFAULT_CALENDAR_SENTINEL: 'default',
}));

vi.mock('../../env.js', () => ({
  env: { calendarSyncPastDays: 90, calendarSyncFutureDays: 365 },
}));

vi.stubGlobal('fetch', mocks.fetch);

import { prisma } from '../../db.js';
import { syncOutlookCalendar } from './sync.js';

const userId = 'user-1';
const workspaceId = 'ws-1';

const enabledUser = {
  id: userId,
  calendarSyncEnabled: true,
  outlookRefreshToken: 'refresh',
  outlookCalendarDeltaToken: null,
};

function jsonResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: () => Promise.resolve(body),
  };
}

describe('syncOutlookCalendar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getOutlookAccessToken.mockResolvedValue('access-token');
    mocks.ensurePersonalWorkspace.mockResolvedValue({ id: workspaceId });
    mocks.migrateLegacyOutlookToken.mockResolvedValue(undefined);
    vi.mocked(prisma.user.update).mockResolvedValue({} as never);
    mocks.upsertOutlookCalendarEvent.mockResolvedValue('imported');
  });

  it('returns calendar_sync_disabled when sync is off', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      ...enabledUser,
      calendarSyncEnabled: false,
    } as never);

    const result = await syncOutlookCalendar(userId);
    expect(result.error).toBe('calendar_sync_disabled');
    expect(mocks.getCalendarsToSync).not.toHaveBeenCalled();
  });

  it('loops multiple calendars and aggregates counts', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(enabledUser as never);
    mocks.getCalendarsToSync.mockResolvedValue([
      { rowId: 'uc-1', calendarId: 'cal-a', syncToken: null },
      { rowId: 'uc-2', calendarId: 'cal-b', syncToken: null },
    ]);

    mocks.fetch
      .mockResolvedValueOnce(
        jsonResponse({
          value: [{ id: 'out-1', subject: 'A' }],
          '@odata.deltaLink': 'https://graph.microsoft.com/delta-a',
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          value: [{ id: 'out-2', subject: 'B' }, { id: 'out-3', subject: 'C' }],
          '@odata.deltaLink': 'https://graph.microsoft.com/delta-b',
        })
      );

    mocks.upsertOutlookCalendarEvent
      .mockResolvedValueOnce('imported')
      .mockResolvedValueOnce('imported')
      .mockResolvedValueOnce('updated');

    const result = await syncOutlookCalendar(userId);

    expect(mocks.fetch).toHaveBeenCalledTimes(2);
    expect(result.imported).toBe(2);
    expect(result.updated).toBe(1);
    expect(result.syncTokenSaved).toBe(true);
    expect(mocks.saveCalendarSyncToken).toHaveBeenCalledTimes(2);
    expect(mocks.upsertOutlookCalendarEvent).toHaveBeenCalledWith(
      workspaceId,
      expect.objectContaining({ id: 'out-1' }),
      'cal-a'
    );
    expect(mocks.upsertOutlookCalendarEvent).toHaveBeenCalledWith(
      workspaceId,
      expect.objectContaining({ id: 'out-3' }),
      'cal-b'
    );
  });
});
