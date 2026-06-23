# Task 05 — Write API Routes

**Status:** Done  
**Prerequisites:** [01-oauth-write-scopes.md](./01-oauth-write-scopes.md), [02-database-schema.md](./02-database-schema.md)  
**Parent:** [CALENDAR_PHASE_3.md](../CALENDAR_PHASE_3.md) — Task 05 in [task index](../CALENDAR_PHASE_3.md#2-task-index)

---

## Goal

Add API routes to create, update, and cancel calendar events in the provider and local database.

---

## In scope

- `POST /api/calendar/events` — create event
- `PATCH /api/calendar/events/:id` — update event
- `DELETE /api/calendar/events/:id` — cancel/delete event
- Provider write then immediate local upsert (`createdFromCrm = true` on create)
- Workspace scoping and auth on all routes
- `insufficient_scope` and permission error handling

## Out of scope

- Frontend modals and buttons (Task 07)
- Settings calendar picker (Task 06)
- Webhook confirmation (Phase 2) — do not wait for push

---

## Implementation checklist

- [x] **POST create** — `server/src/calendar/routes.ts`:
  - Validate body: `calendarId`, `title`, `startsAt`, `endsAt`, `attendeeEmails`, optional `location`, `contactId`
  - Resolve user's mail provider (gmail/outlook)
  - Google: `calendar.events.insert({ calendarId, requestBody })`
  - Outlook: `POST /me/calendars/{id}/events`
  - Upsert local `CalendarEvent` with `createdFromCrm: true`
  - Link `CalendarEventContact` if `contactId` provided
- [x] **PATCH update** — update time, title, attendees, location via provider patch + local upsert
- [x] **DELETE cancel** — cancel in provider and mark local `isCancelled`
- [x] **Authorization** — `writeAuth.ts`: workspace event load; `calendarId` in user's `UserCalendar` list (legacy primary fallback)
- [x] **Video links** — Google `hangoutLink` and Outlook `onlineMeeting.joinUrl` mapped to `webLink`
- [x] **Error mapping** — 403 permission errors on shared calendars → `calendar_permission_denied`
- [x] **Serialize response** — `serializeEvent` includes `calendarId`, `createdFromCrm`

---

## API routes

| Method | Route | Purpose |
|--------|-------|---------|
| `POST` | `/api/calendar/events` | Create event on selected calendar |
| `PATCH` | `/api/calendar/events/:id` | Update time, title, attendees |
| `DELETE` | `/api/calendar/events/:id` | Cancel/delete (provider + local) |

### Create request body

```json
{
  "calendarId": "primary",
  "title": "Call with Jane",
  "startsAt": "2026-06-25T15:00:00.000Z",
  "endsAt": "2026-06-25T15:30:00.000Z",
  "attendeeEmails": ["jane@example.com"],
  "location": "Zoom",
  "contactId": "optional-link-to-contact"
}
```

---

## Key files

| File | Change |
|------|--------|
| `server/src/calendar/routes.ts` | POST, PATCH, DELETE handlers |
| `server/src/calendar/writeAuth.ts` | Scope + calendar access checks |
| `server/src/calendar/writeGoogle.ts` | Google create/update/cancel |
| `server/src/calendar/writeOutlook.ts` | Outlook create/update/cancel |
| `server/src/calendar/types.ts` | Request types + validators |
| `server/src/calendar/upsertGoogle.ts` | `createdFromCrm` option; `hangoutLink` → `webLink` |
| `server/src/calendar/upsertOutlook.ts` | `createdFromCrm` option; `onlineMeeting` → `webLink` |
| `server/src/calendar/linkContacts.ts` | `linkContactToCalendarEvent` |

---

## Manual verification

- [ ] `POST /api/calendar/events` creates event in Google/Outlook and local DB
- [ ] `PATCH` updates time/title in provider and CRM
- [ ] `DELETE` cancels in provider; `isCancelled` true locally
- [ ] `createdFromCrm` is true for CRM-created events
- [ ] Write without reconnect returns `insufficient_scope`
- [ ] Write to shared calendar without edit access returns clear error

---

## Next task

→ [06-settings-calendar-picker.md](./06-settings-calendar-picker.md) (parallel) or [07-meeting-scheduler-ui.md](./07-meeting-scheduler-ui.md)
