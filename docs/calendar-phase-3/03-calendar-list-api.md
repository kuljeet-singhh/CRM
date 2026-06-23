# Task 03 — Calendar List API

**Status:** Implemented  
**Prerequisites:** [01-oauth-write-scopes.md](./01-oauth-write-scopes.md), [02-database-schema.md](./02-database-schema.md)  
**Parent:** [CALENDAR_PHASE_3.md](../CALENDAR_PHASE_3.md) — Task 03 in [task index](../CALENDAR_PHASE_3.md#2-task-index)

---

## Goal

Expose provider calendar lists and persist user calendar selections as `UserCalendar` rows.

---

## In scope

- `GET /api/gmail/calendars` — Google `calendar.calendarList.list`
- `GET /api/outlook/calendars` — Microsoft Graph `GET /me/calendars`
- Persist selection via settings API (`UserCalendar` upsert/delete)
- Return `insufficient_scope` when write/list scopes missing

## Out of scope

- Multi-calendar sync loop (Task 04)
- Settings UI checkboxes (Task 06)
- Create/update event routes (Task 05)

---

## Implementation checklist

- [x] **Google list handler** — add `GET /calendars` route in `server/src/gmail/calendar/routes.ts`
  - Call `calendar.calendarList.list` via authorized client
  - Return `{ calendars: [{ id, name, isPrimary, accessRole }] }`
- [x] **Outlook list handler** — add `GET /calendars` route in `server/src/outlook/calendar/routes.ts`
  - Call Graph `GET /me/calendars`
  - Map to same response shape
- [x] **Mount routes** — ensure routes are registered in `server/src/gmail/routes.ts` and `server/src/outlook/routes.ts`
- [x] **Settings persistence** — extend `server/src/users/settings.ts` `PUT /api/settings` to accept calendar selection:
  - Input: `calendars: [{ calendarId, calendarName, isPrimary, syncEnabled }]`
  - Upsert `UserCalendar` rows for active provider; remove deselected rows
- [x] **GET settings** — include `userCalendars` in settings response for frontend
- [x] **Scope errors** — return `{ error: 'insufficient_scope' }` with 403 when token lacks required scope
- [x] **Default primary** — on first enable, auto-create `UserCalendar` row for primary calendar if none exist

---

## API routes

| Method | Route | Purpose |
|--------|-------|---------|
| `GET` | `/api/gmail/calendars` | List Google calendars |
| `GET` | `/api/outlook/calendars` | List Outlook calendars |
| `PUT` | `/api/settings` | Save `UserCalendar` rows |

---

## Provider APIs

| Provider | API |
|----------|-----|
| Google | `calendar.calendarList.list` |
| Outlook | `GET /me/calendars` |

---

## Key files

| File | Change |
|------|--------|
| `server/src/gmail/calendar/routes.ts` | `GET /calendars` |
| `server/src/outlook/calendar/routes.ts` | `GET /calendars` |
| `server/src/users/settings.ts` | Read/write `UserCalendar` |
| `server/src/gmail/routes.ts` | Mount calendar routes |
| `server/src/outlook/routes.ts` | Mount calendar routes |

---

## Manual verification

- [ ] `GET /api/gmail/calendars` returns calendar list for connected Gmail user
- [ ] `GET /api/outlook/calendars` returns calendar list for connected Outlook user
- [ ] `PUT /api/settings` with calendar selection persists to `UserCalendar` table
- [ ] `GET /api/settings` returns saved calendars
- [ ] Old token without write scope returns `insufficient_scope`

---

## Next task

→ [04-multi-calendar-sync.md](./04-multi-calendar-sync.md)
