# Task 04 — Multi-Calendar Read Sync

**Status:** Done  
**Prerequisites:** [02-database-schema.md](./02-database-schema.md), [03-calendar-list-api.md](./03-calendar-list-api.md)  
**Parent:** [CALENDAR_PHASE_3.md](../CALENDAR_PHASE_3.md) — Task 04 in [task index](../CALENDAR_PHASE_3.md#2-task-index)

---

## Goal

Sync events from all user-selected calendars (not only `primary`) and store `calendarId` on each `CalendarEvent`.

---

## In scope

- Loop `UserCalendar` where `syncEnabled = true` during sync
- Per-calendar sync tokens on `UserCalendar.syncToken` (preferred)
- Store `calendarId` on upsert via `upsertGoogle.ts` / `upsertOutlook.ts`
- Populate `CalendarEventContact` on sync when contact email matches (if join table added in Task 02)
- Daily cron and manual sync use multi-calendar loop

## Out of scope

- Create/update/delete events (Task 05)
- Settings picker UI (Task 06)
- Webhook push per calendar (Phase 2)

---

## Implementation checklist

- [x] **Google sync** — refactor `server/src/gmail/calendar/sync.ts`:
  - Load `UserCalendar` rows for user where `provider = gmail` and `syncEnabled = true`
  - For each calendar, call `calendar.events.list({ calendarId, ... })`
  - Store/read sync token on `UserCalendar.syncToken` (not only `User.googleCalendarSyncToken`)
  - Fall back to primary if no `UserCalendar` rows exist (migration path)
- [x] **Outlook sync** — refactor `server/src/outlook/calendar/sync.ts`:
  - Loop enabled `UserCalendar` rows for outlook provider
  - Use per-calendar delta token on `UserCalendar.syncToken`
- [x] **Upsert modules** — update `server/src/calendar/upsertGoogle.ts` and `upsertOutlook.ts` to accept and persist `calendarId`
- [x] **Unique keys** — ensure upsert uses `workspaceId + provider + calendarId + providerEventId`
- [x] **Sync runners** — aggregation inside sync modules; runners unchanged
- [x] **Cron** — `server/src/cron/calendarDailySync.ts` unchanged entry point; benefits from multi-calendar loop automatically
- [x] **Background sync** — `web/src/hooks/useBackgroundSync.ts` no change required if sync endpoints unchanged
- [x] **`CalendarEventContact`** — on upsert, link matching `Contact` by attendee/organizer email via `linkContacts.ts`
- [x] **Helpers** — `getCalendarsToSync`, `saveCalendarSyncToken`, `migrateLegacyGoogleToken`, `migrateLegacyOutlookToken`, `clearUserCalendarSyncTokens` in `userCalendars.ts`
- [x] **Reset sync** — clears per-calendar tokens on `UserCalendar` plus legacy `User` tokens

---

## Sync behavior

| Phase 1 | Phase 3 |
|---------|---------|
| Hardcoded `calendarId: 'primary'` | Loop `UserCalendar` where `syncEnabled = true` |
| Token on `User` | Per-calendar token on `UserCalendar` (preferred) |
| No `calendarId` on event | `calendarId` stored on `CalendarEvent` |

### Shared and delegated calendars

Google Workspace shared calendars and Outlook delegated calendars appear in calendar list — user opts in per calendar. See [CALENDAR_INTEGRATION.md §6](../CALENDAR_INTEGRATION.md#6-limitations-and-expectations).

### Legacy fallback

Users with no `UserCalendar` rows (pre-Task-03) still sync via `primary` (Gmail) or default calendar delta (Outlook) using `User.googleCalendarSyncToken` / `User.outlookCalendarDeltaToken`.

---

## Key files

| File | Change |
|------|--------|
| `server/src/calendar/userCalendars.ts` | `getCalendarsToSync`, token save/migrate/clear helpers |
| `server/src/calendar/linkContacts.ts` | `linkCalendarEventContacts` on upsert |
| `server/src/gmail/calendar/sync.ts` | Multi-calendar loop |
| `server/src/outlook/calendar/sync.ts` | Multi-calendar loop |
| `server/src/calendar/upsertGoogle.ts` | `calendarId` param |
| `server/src/calendar/upsertOutlook.ts` | `calendarId` param |

---

## Manual verification

- [ ] Enable secondary calendar in settings → sync imports its events
- [ ] Events on `/calendar` show from multiple calendars
- [ ] `calendarId` column populated on synced events
- [ ] Incremental sync (sync token) works per calendar
- [ ] User with only primary calendar (no `UserCalendar` rows) still syncs via fallback

---

## Next task

→ [05-write-api-routes.md](./05-write-api-routes.md) (can proceed in parallel after Task 02)
