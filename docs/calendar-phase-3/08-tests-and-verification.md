# Task 08 — Tests and Verification

**Status:** Done  
**Prerequisites:** [04-multi-calendar-sync.md](./04-multi-calendar-sync.md), [05-write-api-routes.md](./05-write-api-routes.md), [07-meeting-scheduler-ui.md](./07-meeting-scheduler-ui.md)  
**Parent:** [CALENDAR_PHASE_3.md](../CALENDAR_PHASE_3.md) — Task 08 in [task index](../CALENDAR_PHASE_3.md#2-task-index)

---

## Goal

Add automated tests for Phase 3 backend behavior and complete end-to-end manual verification.

---

## In scope

- Server unit/integration tests for write routes, multi-calendar sync, scope errors
- Manual verification checklist (full Phase 3)
- Confirm builds and existing test suite still pass
- Document known limitations

## Out of scope

- Frontend component tests (unless already standard in project)
- E2E browser automation

---

## Implementation checklist

### Automated tests

- [x] **Create event** — test `POST /api/calendar/events` mocks provider insert + local upsert
- [x] **Update event** — test `PATCH /api/calendar/events/:id`
- [x] **Cancel event** — test `DELETE /api/calendar/events/:id` sets `isCancelled`
- [x] **Multi-calendar sync** — test sync loops multiple `UserCalendar` rows
- [x] **Scope errors** — test `insufficient_scope` when token lacks write scope
- [x] **Workspace isolation** — test user cannot modify another workspace's event (via `loadWritableEvent` 404)
- [x] **Calendar list** — test `GET /api/gmail/calendars` and outlook equivalent (mocked)
- [x] **Contact filter** — adequate in `server/src/calendar/contactFilter.test.ts`
- [x] **Full suite** — `npm run test` in `server/` (103 tests) and `web/` (9 tests) pass; builds pass

### Suggested test files

| File | Coverage |
|------|----------|
| `server/src/calendar/routes.test.ts` | POST/PATCH/DELETE handlers, validation, scope/permission errors |
| `server/src/calendar/contactFilter.test.ts` | Existing; adequate |
| `server/src/gmail/calendar/sync.test.ts` | Multi-calendar loop |
| `server/src/outlook/calendar/sync.test.ts` | Multi-calendar loop |
| `server/src/gmail/calendar/list.routes.test.ts` | GET `/api/gmail/calendars` |
| `server/src/outlook/calendar/list.routes.test.ts` | GET `/api/outlook/calendars` |
| `web/src/lib/calendarForm.test.ts` | Form validation helpers |

---

## Manual verification (full Phase 3)

- [ ] Reconnect OAuth with write scopes (`calendar.events` / `Calendars.ReadWrite`)
- [ ] Settings shows calendar list; select secondary calendar → events sync
- [ ] Schedule meeting from contact → appears in Google/Outlook and CRM
- [ ] Edit time in CRM → updates provider event
- [ ] Cancel from CRM → cancelled in provider and `isCancelled` locally
- [ ] Event created in provider only (not CRM) still syncs via Phase 1/2 pipeline
- [ ] `insufficient_scope` if write attempted without reconnect
- [ ] `prisma migrate deploy` applied on production/staging DB

---

## Known limitations (document, do not fix in Phase 3)

| Topic | Note |
|-------|------|
| Team calendar | Still per-user; no shared workspace calendar view |
| Recurring CRM creates | Start with single events; RRULE builder is future work |
| Video links | Store `hangoutLink` / `onlineMeetingUrl` if provider returns them |
| Permission errors | Shared calendar write may fail if user lacks edit access — surface clear error |
| Google verification | Write scopes may trigger stricter OAuth verification |
| Provider switch | No event migration when switching Gmail ↔ Outlook |

---

## Done when

- All automated tests pass
- Manual checklist above is complete
- [my_task.md](../../my_task.md) updated with Calendar Phase 3 completed items
- [README.md](./README.md) task status table updated to reflect completion

---

## Related

- [CALENDAR_PHASE_3.md §4](../CALENDAR_PHASE_3.md#4-limitations) — limitations reference
- [CALENDAR_INTEGRATION.md](../CALENDAR_INTEGRATION.md) — cross-phase expectations
