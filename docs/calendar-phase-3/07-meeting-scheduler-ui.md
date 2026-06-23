# Task 07 — Meeting Scheduler UI

**Status:** Done  
**Prerequisites:** [05-write-api-routes.md](./05-write-api-routes.md), [06-settings-calendar-picker.md](./06-settings-calendar-picker.md)  
**Parent:** [CALENDAR_PHASE_3.md](../CALENDAR_PHASE_3.md) — Task 07 in [task index](../CALENDAR_PHASE_3.md#2-task-index)

---

## Goal

Let users create and edit meetings from contact records and the `/calendar` page.

---

## In scope

- **Schedule meeting** button on contact detail / Contacts page
- **New event** button on `/calendar` page
- Modal form: title, attendees, start/end, location, calendar dropdown
- Edit flow for `createdFromCrm` events
- Cancel meeting from modal
- Types: `CreateCalendarEventRequest`, `UpdateCalendarEventRequest`

## Out of scope

- Recurring event builder (RRULE) — single events only
- Team/shared workspace calendar view
- Automated tests (Task 08)

---

## Implementation checklist

- [x] **Types** — `CreateCalendarEventRequest`, `UpdateCalendarEventRequest`, `CalendarEventResponse`; `calendarId` + `createdFromCrm` on `CalendarEventItem`
- [x] **Form helpers** — `web/src/lib/calendarForm.ts`
- [x] **Modal** — `web/src/components/calendar/MeetingSchedulerModal.tsx`
- [x] **Contact integration** — Schedule meeting button + modal on `Contacts.tsx`
- [x] **Calendar page** — New event button; click CRM-created events to edit
- [x] **API calls** — POST / PATCH / DELETE `/api/calendar/events`
- [x] **Invalidate queries** — refresh calendar events after create/update/cancel
- [x] **Error handling** — scope, permission, validation errors
- [x] **Contact upcoming meetings** — optional Schedule quick link

---

## Key files

| File | Change |
|------|--------|
| `web/src/components/calendar/MeetingSchedulerModal.tsx` | Create/edit/cancel modal |
| `web/src/lib/calendarForm.ts` | Form state + validation helpers |
| `web/src/pages/Calendar.tsx` | New event + edit on click |
| `web/src/pages/Contacts.tsx` | Schedule meeting button |
| `web/src/types.ts` | Request types + extended event fields |
| `web/src/components/calendar/ContactUpcomingMeetings.tsx` | Schedule quick link |

---

## Manual verification

- [ ] Schedule meeting from contact → appears in Google/Outlook and CRM `/calendar`
- [ ] New event from `/calendar` page works without contact context
- [ ] Edit time/title in modal → updates provider event
- [ ] Cancel from modal → cancelled in provider and CRM
- [ ] Calendar dropdown only shows enabled calendars
- [ ] Events not created from CRM are read-only in edit flow

---

## Next task

→ [08-tests-and-verification.md](./08-tests-and-verification.md)
