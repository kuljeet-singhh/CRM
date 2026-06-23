# Task 06 — Settings Calendar Picker UI

**Status:** Done  
**Prerequisites:** [03-calendar-list-api.md](./03-calendar-list-api.md)  
**Parent:** [CALENDAR_PHASE_3.md](../CALENDAR_PHASE_3.md) — Task 06 in [task index](../CALENDAR_PHASE_3.md#2-task-index)

---

## Goal

Let users view available calendars and choose which to sync from the Settings modal.

---

## In scope

- Multi-checkbox calendar list in Settings
- Load calendars from `GET /api/gmail/calendars` or `GET /api/outlook/calendars`
- Save selection via `PUT /api/settings`
- Reconnect banner on `insufficient_scope`
- Show primary calendar indicator
- Trigger initial sync when enabling a new calendar (optional)

## Out of scope

- Meeting scheduler modal (Task 07)
- `/calendar` page new event button (Task 07)
- Write API implementation (Task 05)

---

## Implementation checklist

- [x] **Types** — `CalendarListItem`, `UserCalendarSettings`, `UserCalendarInput`, `CalendarListResponse` in `web/src/types.ts`
- [x] **Fetch calendars** — `CalendarPickerSection` loads provider list when sync enabled
- [x] **Calendar list UI** — checkbox per calendar, Primary badge, View only badge for read-only
- [x] **Save selection** — `PUT /api/settings` with calendars array on toggle
- [x] **Reconnect banner** — existing amber banner + picker `insufficient_scope` message
- [x] **Merge with toggle** — label **Sync calendars**; picker below toggle
- [x] **Error toasts** — view-only calendar toast; save/load failures
- [x] **Background sync** — triggers `POST .../calendar/sync` when enabling a calendar

---

## Key files

| File | Change |
|------|--------|
| `web/src/components/settings/CalendarPickerSection.tsx` | Calendar picker component |
| `web/src/components/settings/SettingsModal.tsx` | Integration + copy updates |
| `web/src/types.ts` | Calendar list + user calendar types |
| `web/src/pages/Calendar.tsx` | Multi-calendar copy |

---

## Manual verification

- [ ] Settings shows list of Google/Outlook calendars after connect
- [ ] Checking a secondary calendar saves and persists after reload
- [ ] Unchecking a calendar stops it from syncing (after next sync)
- [ ] `insufficient_scope` shows reconnect banner
- [ ] Primary calendar is clearly labeled

---

## Next task

→ [07-meeting-scheduler-ui.md](./07-meeting-scheduler-ui.md)
