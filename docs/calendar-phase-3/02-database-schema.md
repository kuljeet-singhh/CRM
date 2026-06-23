# Task 02 — Database Schema

**Status:** Implemented  
**Prerequisites:** [CALENDAR_PHASE_1.md](../CALENDAR_PHASE_1.md) complete  
**Parent:** [CALENDAR_PHASE_3.md](../CALENDAR_PHASE_3.md) — Task 02 in [task index](../CALENDAR_PHASE_3.md#2-task-index)

---

## Goal

Add Prisma models and fields required for multi-calendar selection and CRM-originated events.

---

## In scope

- New `UserCalendar` model for per-user calendar selection
- Add `calendarId` and `createdFromCrm` to `CalendarEvent`
- Optional `CalendarEventContact` join table (schema only; population deferred to Tasks 04/05)
- Migration SQL and backfill for existing events
- Regenerate Prisma client

## Out of scope

- Populating `CalendarEventContact` rows (Tasks 04/05)
- API routes and sync logic (Tasks 03–05)
- Frontend changes

---

## Implementation checklist

- [x] **`UserCalendar` model** — add to `server/prisma/schema.prisma`:

```prisma
model UserCalendar {
  id           String           @id @default(cuid())
  userId       String
  provider     CalendarProvider
  calendarId   String
  calendarName String
  isPrimary    Boolean          @default(false)
  syncEnabled  Boolean          @default(true)
  syncToken    String?          @db.Text
  lastSyncedAt DateTime?
  createdAt    DateTime         @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, calendarId])
  @@index([userId, syncEnabled])
}
```

- [x] **`User` relation** — add `userCalendars UserCalendar[]` on `User`
- [x] **`CalendarEvent` fields** — add `calendarId String` and `createdFromCrm Boolean @default(false)`
- [x] **Unique constraint** — update `CalendarEvent` unique key to include `calendarId` if needed (e.g. `@@unique([workspaceId, provider, calendarId, providerEventId])`)
- [x] **`CalendarEventContact` (optional)** — add join table if included in this phase:

```prisma
model CalendarEventContact {
  id              String @id @default(cuid())
  calendarEventId String
  contactId       String

  calendarEvent CalendarEvent @relation(fields: [calendarEventId], references: [id], onDelete: Cascade)
  contact       Contact       @relation(fields: [contactId], references: [id], onDelete: Cascade)

  @@unique([calendarEventId, contactId])
}
```

- [x] **Migration** — create `server/prisma/migrations/YYYYMMDDHHMMSS_calendar_phase3/migration.sql`
- [x] **Backfill** — set `calendarId = 'primary'` (or provider default) on existing `CalendarEvent` rows
- [x] **Deploy** — run `npx prisma migrate deploy` and `npx prisma generate`

---

## Field reference

### `CalendarEvent` additions

| Field | Purpose |
|-------|---------|
| `calendarId` | Which calendar the event belongs to |
| `createdFromCrm` | Event originated in CRM vs synced only |

### Provider switch note

User switching Gmail → Outlook does not migrate events; new provider IDs create new rows. Optional future: dedup by `icalUid` across providers.

---

## Key files

| File | Change |
|------|--------|
| `server/prisma/schema.prisma` | New models and fields |
| `server/prisma/migrations/` | New migration |

---

## Manual verification

- [ ] `npx prisma migrate deploy` succeeds on local and Supabase
- [ ] Generated client exposes `prisma.userCalendar`, new `CalendarEvent` fields
- [ ] Existing Phase 1 events have `calendarId` backfilled

---

## Next task

→ [03-calendar-list-api.md](./03-calendar-list-api.md)
