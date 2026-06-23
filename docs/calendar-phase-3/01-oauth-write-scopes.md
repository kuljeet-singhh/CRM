# Task 01 — OAuth Write Scopes

**Status:** Implemented  
**Prerequisites:** [CALENDAR_PHASE_1.md](../CALENDAR_PHASE_1.md) complete  
**Parent:** [CALENDAR_PHASE_3.md](../CALENDAR_PHASE_3.md) — Task 01 in [task index](../CALENDAR_PHASE_3.md#2-task-index)

---

## Goal

Upgrade OAuth scopes so the CRM can create and update calendar events. Existing users must reconnect after the scope change.

---

## In scope

- Google: add `https://www.googleapis.com/auth/calendar.events` (or full `calendar` scope if calendar list management is needed)
- Microsoft: replace `Calendars.Read` with `Calendars.ReadWrite`
- Update `GOOGLE_SCOPES` default in `server/src/env.ts` and `.env.example`
- Update Microsoft scope in `server/src/env.ts` and `.env.example`
- `insufficient_scope` detection for write operations and calendar list fetch
- Reconnect banner in Settings (reuse Phase 1 pattern)

## Out of scope

- Database schema changes (Task 02)
- Calendar list API routes (Task 03)
- Write API routes (Task 05)
- Calendar picker UI (Task 06)

---

## Implementation checklist

- [x] **Google scopes** — in `server/src/env.ts`, replace or extend `calendar.readonly` with `calendar.events` in `GOOGLE_SCOPES` default
- [x] **Microsoft scopes** — in `server/src/env.ts`, replace `Calendars.Read` with `Calendars.ReadWrite` in `OUTLOOK_SCOPES` default
- [x] **`.env.example`** — document new scope strings for both providers
- [x] **GCP consent screen** — add `calendar.events` scope in Google Cloud Console ([GOOGLE_CLOUD_SETUP.md](../GOOGLE_CLOUD_SETUP.md))
- [x] **Entra app** — update API permissions to `Calendars.ReadWrite`; note admin consent may be required for org tenants
- [x] **Scope probe** — extend `server/src/auth/tokens.ts` or settings probe to detect missing write scope before write/list calls
- [x] **Settings UX** — in `web/src/components/settings/SettingsModal.tsx`, show reconnect banner on `insufficient_scope` (same as Phase 1 calendar toggle)
- [x] **Read sync preserved** — verify existing `calendar.readonly`-era tokens still work for read until user reconnects (or document that upgrade replaces read scope)

---

## Scope reference

### Google

```
https://www.googleapis.com/auth/calendar.events
```

Or full `https://www.googleapis.com/auth/calendar` if calendar list management is needed.

### Microsoft

```
Calendars.ReadWrite
```

---

## Key files

| File | Change |
|------|--------|
| `server/src/env.ts` | `googleScopes`, `outlookScopes` defaults |
| `.env.example` | Scope documentation |
| `server/src/auth/tokens.ts` | Scope validation if applicable |
| `web/src/components/settings/SettingsModal.tsx` | Reconnect banner on `insufficient_scope` |
| `docs/GOOGLE_CLOUD_SETUP.md` | OAuth consent screen update (if not already documented) |

---

## Manual verification

- [ ] New OAuth connect includes write scopes in consent screen
- [ ] User with old read-only token sees `insufficient_scope` on write-scope probe
- [ ] Reconnect banner appears in Settings; reconnect grants write access
- [ ] After reconnect, Phase 1 read sync still works on `/calendar`

---

## Next task

→ [02-database-schema.md](./02-database-schema.md) (can run in parallel with this task after Phase 1)
