# FlyConnector — Complete Feature Specification

**File:** `docs/COMPLETE_FEATURE_SPEC.md`  
**Purpose:** Single reference for all functionality in this repository (web + server). Use to understand the product or re-implement the same features in another project.

**Related documentation**

- **[GOOGLE_WEBHOOK_GUIDE.md](./GOOGLE_WEBHOOK_GUIDE.md)** — webhook setup, testing, troubleshooting (operational)
- **[PROJECT_GUIDE.md](./PROJECT_GUIDE.md)** — onboarding and architecture overview
- **[CALENDAR_INTEGRATION.md](./CALENDAR_INTEGRATION.md)** — Google/Outlook calendar sync (planned; see phase docs)

## Table of contents

1. [Product overview](#1-product-overview)
2. [Technology stack](#2-technology-stack)
3. [Repository structure](#3-repository-structure)
4. [Environment configuration](#4-environment-configuration)
5. [Database schema](#5-database-schema)
6. [System architecture](#6-system-architecture)
7. [Authentication and sessions](#7-authentication-and-sessions)
8. [Server API reference](#8-server-api-reference)
9. [Gmail — send, manual sync, labels](#9-gmail--send-manual-sync-labels)
10. [Gmail — real-time webhook sync](#10-gmail--real-time-webhook-sync)
11. [Outlook integration](#11-outlook-integration)
12. [Apollo.io contact import](#12-apolloio-contact-import)
13. [Contacts and workspaces](#13-contacts-and-workspaces)
14. [User settings](#14-user-settings)
15. [Health and dev endpoints](#15-health-and-dev-endpoints)
16. [Web application (frontend)](#16-web-application-frontend)
17. [Local development](#17-local-development)
18. [Testing](#18-testing)
19. [Server file index](#19-server-file-index)
20. [Web file index](#20-web-file-index)

---

## 1. Product overview

FlyConnector is a lightweight CRM for email relationship management.

**Core rule:** Email is sent and received through the user's real **Gmail** or **Outlook** account (Gmail API / Microsoft Graph). No separate SMTP server.

**Features:**

| Area | Capability |
|------|------------|
| Auth | Google OAuth or Microsoft OAuth; one provider per user |
| Send | Compose and send from app; appears in user's Sent folder |
| Manual sync | Poll Gmail label or Outlook folder into CRM (frontend timer + manual button) |
| Webhook sync | Real-time Gmail sync via Pub/Sub + background queue (Gmail only) |
| Contacts | List, search, thread timeline per contact |
| Settings | Sync label/folder, timezone, create label/folder, reset sync, Apollo key |
| Apollo | Import contacts from Apollo.io API into workspace |
| Calendar (planned) | Read-only primary calendar sync — [CALENDAR_INTEGRATION.md](./CALENDAR_INTEGRATION.md) |

---

## 2. Technology stack

### Server (`server/`)

| Layer | Technology |
|-------|------------|
| Runtime | Node.js, TypeScript |
| HTTP | Express 4 |
| ORM | Prisma 5 + PostgreSQL |
| Gmail | `googleapis` |
| Outlook | Microsoft Graph REST (`fetch`) |
| Session | `express-session` + `connect-pg-simple` (Postgres store) |
| Queue | Postgres `SyncJob` table + in-process worker |
| Tests | Vitest, Supertest |

### Web (`web/`)

| Layer | Technology |
|-------|------------|
| UI | React 18, TypeScript |
| Build | Vite 5 |
| Styling | Tailwind CSS 4, Radix UI, shadcn-style components |
| Toasts | Sonner |

### Infrastructure

- **Supabase** PostgreSQL via Prisma (`DATABASE_URL` + `DIRECT_URL`) — see [SUPABASE.md](./SUPABASE.md)
- Root `.env` loaded by `server/src/env.ts` (dev only; production uses Vercel env vars)

---

## 3. Repository structure

```text
gmail-microsoft-connector/
├── .env                          # secrets (gitignored)
├── .env.example                  # template
├── docs/
│   ├── COMPLETE_FEATURE_SPEC.md  # this file
│   └── SUPABASE.md
├── server/
│   ├── vitest.config.ts
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   └── src/
│       ├── index.ts              # app bootstrap, routes, worker
│       ├── env.ts
│       ├── db.ts
│       ├── auth/                 # OAuth, tokens, crypto, middleware
│       ├── gmail/                # send, sync, mime, parser, watchManager
│       ├── outlook/              # send, sync, folders, graph errors
│       ├── webhooks/             # Gmail Pub/Sub receiver
│       ├── queue/                # worker + label_sync / thread_sync
│       ├── contacts/             # routes + upsert helpers
│       ├── workspaces/
│       ├── users/settings.ts
│       ├── apollo/
│       └── dev/                  # webhook simulate (non-prod)
└── web/
    ├── vite.config.ts            # proxy /auth, /api → :3000
    └── src/
        ├── App.tsx
        ├── components/           # TopBar, ContactList, ContactDetail, ComposeForm, SettingsModal
        ├── lib/                  # provider, preferences, formatters
        └── types.ts
```

---

## 4. Environment configuration

Copy `.env.example` → `.env` at repo root. Server reads via `dotenv` from `server/src/env.ts` (`../../.env`).

### Required — all deployments

```env
SESSION_SECRET=                        # long random string
DATABASE_URL=                          # Supabase transaction pooler — see .env.example
DIRECT_URL=                            # Supabase session pooler — see .env.example
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:5173/auth/google/callback
GOOGLE_SCOPES=openid,email,profile,https://www.googleapis.com/auth/gmail.send,https://www.googleapis.com/auth/gmail.modify
ENCRYPTION_KEY=                        # openssl rand -base64 32
```

### Required for Outlook (optional for Gmail-only)

```env
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
MICROSOFT_REDIRECT_URI=http://localhost:5173/auth/microsoft/callback
MICROSOFT_TENANT_ID=common
MICROSOFT_SCOPES=openid profile email offline_access User.Read Mail.ReadWrite Mail.Send
```

Server starts without Microsoft vars; `/auth/microsoft` returns `503 microsoft_oauth_not_configured`.

### Required for Gmail webhook (real-time sync)

```env
GMAIL_PUBSUB_TOPIC=projects/YOUR_PROJECT/topics/gmail-notifications
```

### Optional — webhook / worker

```env
GOOGLE_WEBHOOK_AUDIENCE=https://YOUR_PUBLIC_HOST/api/webhooks/gmail
SYNC_WORKER_POLL_MS=2000
SYNC_WORKER_BATCH_SIZE=5
```

### Optional — defaults in code

```env
PORT=3000
WEB_ORIGIN=http://localhost:5173
NODE_ENV=                            # production → webhook OIDC enforced
```

### `server/src/env.ts` mapping

| Env var | Code property | Notes |
|---------|---------------|-------|
| `SESSION_SECRET` | `sessionSecret` | required |
| `DATABASE_URL` | `databaseUrl` | required |
| `GOOGLE_*` | `googleClientId`, etc. | required |
| `GOOGLE_SCOPES` | `googleScopes[]` | comma-separated |
| `GMAIL_PUBSUB_TOPIC` | `gmailPubsubTopic` | default `''` |
| `GOOGLE_WEBHOOK_AUDIENCE` | `googleWebhookAudience` | default `''` |
| `MICROSOFT_*` | microsoft* | optional strings |
| `ENCRYPTION_KEY` | `encryptionKey` | required |
| `SYNC_WORKER_*` | `syncWorkerPollMs`, `syncWorkerBatchSize` | defaults 2000, 5 |
| `NODE_ENV` | `isProd` | `production` → strict webhook auth |

### Google Cloud (webhook)

1. Pub/Sub **topic** = `GMAIL_PUBSUB_TOPIC`
2. IAM: `gmail-api-push@system.gserviceaccount.com` → **Pub/Sub Publisher** on topic
3. **Push subscription** URL: `https://PUBLIC_HOST/api/webhooks/gmail`

---

## 5. Database schema

### Enums

- `AuthProvider`: `gmail` | `outlook`
- `ContactSource`: `manual` | `logged_email` | `apollo`
- `EmailDirection`: `sent` | `received`
- `RecipientRole`: `from` | `to` | `cc` | `bcc`
- `WorkspaceRole`: `owner` | `admin` | `member`
- `SyncJobType`: `label_sync` | `thread_sync`
- `SyncJobStatus`: `pending` | `processing` | `done` | `failed`

### Models (summary)

| Model | Purpose |
|-------|---------|
| `User` | Identity, OAuth tokens (encrypted), sync settings, watch expiry, Apollo key |
| `Workspace` | Tenant boundary |
| `Membership` | User ↔ workspace + role |
| `Contact` | Unique `(workspaceId, email)` |
| `EmailMessage` | Synced/sent messages; Gmail + Outlook provider fields |
| `EmailMessageRecipient` | Message ↔ contact ↔ role |
| `CrmLabel` | Gmail label tracked for webhook sync |
| `SyncJob` | Background job queue |

### User fields

```
email, name, authProvider
googleAccessToken, googleRefreshToken, tokenExpiry
outlookAccessToken, outlookRefreshToken, outlookTokenExpiry
gmailSyncLabel, gmailLastHistoryId, gmailWatchExpiry
outlookSyncFolder, outlookLastDeltaToken
timezone, apolloApiKey, apolloLastSyncedAt
```

### CrmLabel

Created when user saves Gmail sync label in Settings. Webhook reads this table (not `gmailSyncLabel` alone).

### SyncJob

Queue row: `type`, `status`, `payload` (JSON), retry fields (`attempts`, `maxAttempts`, `runAt`, `lastError`).

Migration: `server/prisma/migrations/20260602143000_add_crm_labels_and_sync_queue/migration.sql`

---

## 6. System architecture

### Manual sync path (browser)

```text
Web → POST /api/gmail/sync or /api/outlook/sync → Provider API → Prisma → Contact/EmailMessage
```

### Webhook path (Gmail only)

```text
Settings → CrmLabel + users.watch
Gmail change → Pub/Sub → POST /api/webhooks/gmail → SyncJob (label_sync)
Worker → label_sync → SyncJob (thread_sync) → Contact/EmailMessage
```

### Express mount order (`server/src/index.ts`)

1. CORS, JSON, cookies
2. **`/api/webhooks/gmail`** — before session (no auth cookie)
3. Session middleware (Postgres store, cookie `gmail_connector.sid`)
4. `/auth`, `/api/gmail`, `/api/outlook`, `/api/workspaces`, `/api/contacts`, `/api/settings`, `/api/apollo`
5. Health routes
6. `/api/dev` (non-prod)
7. On listen: `startWorker`, `renewExpiredWatches`, 6h renewal interval

### Vite proxy (`web/vite.config.ts`)

```text
/auth  → http://localhost:3000
/api   → http://localhost:3000
```

Keeps OAuth callback same-origin with frontend (`localhost:5173`).

---

## 7. Authentication and sessions

### Google OAuth

| Route | Behavior |
|-------|----------|
| `GET /auth/google` | Redirect to Google consent (`prompt=consent`, offline refresh token) |
| `GET /auth/google/callback` | Exchange code, upsert User, create workspace membership, session, best-effort `ensureGmailWatch`, redirect to `WEB_ORIGIN` |

### Microsoft OAuth

| Route | Behavior |
|-------|----------|
| `GET /auth/microsoft` | Redirect to Microsoft login (503 if env not configured) |
| `GET /auth/microsoft/callback` | Exchange code, upsert User (`authProvider: outlook`), session |

### Session API

| Route | Behavior |
|-------|----------|
| `GET /auth/me` | `{ user: { id, email, name, authProvider, createdAt } \| null }` |
| `POST /auth/logout` | Destroy session |

### Middleware (`requireAuth`)

- Reads `req.session.userId`
- Resolves `workspaceId` from session or first membership
- Sets `AuthedRequest.userId`, `AuthedRequest.workspaceId`

### Token handling

- Google/Outlook tokens encrypted at rest (`ENCRYPTION_KEY`)
- `getAuthorizedClient(userId)` / `getOutlookAccessToken(userId)` refresh when expired
- Failures return `401 { error: 'reauth_required' }`

### Provider rule

One user = one provider (`gmail` or `outlook`). Cross-provider login returns `409`.

---

## 8. Server API reference

All `/api/*` routes below require session unless noted.

### Auth — `/auth`

| Method | Path | Auth |
|--------|------|------|
| GET | `/auth/google` | No |
| GET | `/auth/google/callback` | No |
| GET | `/auth/microsoft` | No |
| GET | `/auth/microsoft/callback` | No |
| GET | `/auth/me` | Session |
| POST | `/auth/logout` | Session |

### Gmail — `/api/gmail`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/profile` | Gmail profile (email, message/thread counts) |
| POST | `/send` | Send MIME message via Gmail API |
| POST | `/labels` | Create or return existing label by name |
| POST | `/reset-sync` | Delete workspace emails + contacts; clear history id |
| POST | `/sync` | Manual label-filtered sync |

### Outlook — `/api/outlook`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/profile` | Graph `/me` profile |
| POST | `/send` | Send via Graph |
| POST | `/folders` | Create or return mail folder |
| POST | `/reset-sync` | Delete Outlook emails + contacts; clear delta token |
| POST | `/sync` | Folder delta sync |

### Apollo — `/api/apollo`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/status` | `{ connected, lastSyncedAt }` |
| PUT | `/key` | Validate and save encrypted API key |
| DELETE | `/key` | Remove key |
| POST | `/sync` | Import contacts to workspace |

### Workspaces — `/api/workspaces`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/me` | `{ currentWorkspaceId, workspaces[] }` |

### Contacts — `/api/contacts`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List/search; query `search`, `limit`, `offset` |
| GET | `/:id` | Contact detail |
| GET | `/:id/threads` | Thread-grouped timeline |
| GET | `/:id/emails` | Flat paginated emails |

### Settings — `/api/settings`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | `{ provider, syncSelector, gmailSyncLabel, outlookSyncFolder, timezone }` |
| PUT | `/` | Update sync selector + timezone; Gmail → CrmLabel + watch |

### Webhook — no session

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/webhooks/gmail` | Pub/Sub push; returns **204** |

### Health

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/health` | No | Failed jobs + watch issues |
| GET | `/api/health/watch` | No | Expired/missing watches |
| GET | `/api/health/gmail-sync` | Session | Per-user webhook readiness |

### Dev (non-production)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/dev/gmail-webhook-simulate` | Enqueue webhook jobs for logged-in Gmail user |

---

## 9. Gmail — send, manual sync, labels

### Send (`server/src/gmail/send.ts`)

1. Build RFC 2822 MIME (`mime.ts`); base64url `raw` for `messages.send`
2. Optional `inReplyTo` → thread + `In-Reply-To` / `References` headers
3. Fetch `Message-ID` after send for immediate reply support
4. If `gmailSyncLabel` set → apply label to sent message in Gmail
5. Upsert `Contact`, `EmailMessage`, `EmailMessageRecipient` in CRM

### Manual sync (`server/src/gmail/sync.ts`)

1. Requires `User.gmailSyncLabel`; resolves label name → `labelId`
2. Incremental: `history.list` from `gmailLastHistoryId`; fallback `messages.list` on 404
3. Parses headers/body; upserts contacts and messages
4. Updates `gmailLastHistoryId` watermark
5. Does **not** use `SyncJob`

### Labels route

- `POST /api/gmail/labels` `{ name }` — idempotent create/list

---

## 10. Gmail — real-time webhook sync

### Setup trigger

**Settings save (Gmail):** `server/src/users/settings.ts`

1. `gmail.users.labels.list` → resolve `labelId`
2. Delete existing `CrmLabel` for user; create new row
3. Update `User.gmailSyncLabel`
4. Call `ensureGmailWatch` when label changed or CrmLabel was missing
5. Optional response field `watchWarning`

**OAuth callback:** best-effort `ensureGmailWatch` (usually skipped until CrmLabel exists)

### Watch (`server/src/gmail/watchManager.ts`)

- `ensureGmailWatch(userId)`: `users.watch` with `topicName` + `labelIds: ['INBOX','SENT']`
- Saves `User.gmailWatchExpiry` (~7 days)
- `renewExpiredWatches`: startup + every 6 hours

### Webhook (`server/src/webhooks/gmailReceiver.ts`)

1. Prod: verify Pub/Sub JWT against `GOOGLE_WEBHOOK_AUDIENCE`
2. Return **204** immediately
3. Decode `message.data` → `{ emailAddress, historyId }`
4. Find user + workspace + `CrmLabel` rows
5. Enqueue `label_sync` per label

### Worker (`server/src/queue/worker.ts`)

- Poll interval: `SYNC_WORKER_POLL_MS`
- Claim: `FOR UPDATE SKIP LOCKED`
- Retry backoff; stuck `processing` recovery after 60s

### `label_sync` handler

- Gmail `history.list` / `messages.list` for tracked `labelId`
- Enqueue `thread_sync` per message id
- Update `gmailLastHistoryId`

### `thread_sync` handler

- `messages.get` full; parse headers/body
- Upsert `Contact`, `EmailMessage`, recipients
- Idempotent on `gmailMessageId`

---

## 11. Outlook integration

### Send (`server/src/outlook/send.ts`)

Graph `POST /me/sendMail`; logs to CRM similar to Gmail.

### Sync (`server/src/outlook/sync.ts`)

Uses configured `outlookSyncFolder` + `outlookLastDeltaToken` (Microsoft Graph delta).

### Settings

Validates folder exists via Graph before save (`listMailFolders`).

---

## 12. Apollo.io contact import

### Server

- `apollo/client.ts` — verify key, fetch contacts
- `apollo/sync.ts` — import into workspace; `Contact.createdFrom = apollo`
- Key stored encrypted on `User.apolloApiKey`

### Web (`SettingsModal`)

- Save key → `PUT /api/apollo/key`
- Sync now → `POST /api/apollo/sync`
- Disconnect → `DELETE /api/apollo/key`

---

## 13. Contacts and workspaces

### Contact list API

- Search by email/name (case-insensitive)
- Sorted by last email activity
- Returns `emailCount`, `lastEmailAt`

### Threads API

- Groups by `gmailThreadId`
- Includes full message bodies, recipients, attachments JSON

### Workspace

- Personal workspace created on first OAuth (`workspaces/service.ts`)
- Session stores `workspaceId`; middleware backfills from first membership

---

## 14. User settings

### GET `/api/settings`

Returns provider-aware `syncSelector` (label or folder name).

### PUT `/api/settings`

Body fields:

- `syncSelector` or `gmailSyncLabel` / `outlookSyncFolder`
- `timezone` (IANA validated)

Gmail label save side effects: **CrmLabel** + **ensureGmailWatch** (see section 10).

Outlook folder change clears `outlookLastDeltaToken`.

---

## 15. Health and dev endpoints

Documented in section 8. Logs:

- `[gmail-webhook]` — skip reasons, enqueue success
- `[gmail-watch]` — registration, renewal, skips

---

## 16. Web application (frontend)

> **Authoritative UI documentation:** [UI_STRUCTURE.md](./UI_STRUCTURE.md) — routing, layout shell, Message Center components, design system, and state patterns. The component table below describes an older two-pane layout and is kept for historical reference only.

### Entry (`web/src/App.tsx`)

| State | UI |
|-------|-----|
| Loading | "Loading…" |
| Not authenticated | Connect Gmail / Connect Outlook buttons → `/auth/google`, `/auth/microsoft` |
| Authenticated | TopBar + ContactList + ContactDetail |

### Background sync

- Every **3 minutes** while tab visible: `POST ${mailApiBase(provider)}/sync`
- Refreshes contact list if `messagesAdded > 0`

### Components

| Component | File | Responsibility |
|-----------|------|----------------|
| `TopBar` | `components/TopBar.tsx` | Sync now, Compose, Settings, Logout; workspace name |
| `ContactList` | `components/ContactList.tsx` | Search, list contacts, `GET /api/contacts` |
| `ContactDetail` | `components/ContactDetail.tsx` | Contact info, thread timeline, Reply, Compose |
| `ComposeForm` | `components/ComposeForm.tsx` | To/Cc/Subject/Body; reply quoting; `POST .../send` |
| `SettingsModal` | `components/SettingsModal.tsx` | Sync label/folder, timezone, create label/folder, wipe, Apollo |

### Provider routing (`web/src/lib/provider.ts`)

```typescript
connectPath('gmail')   → '/auth/google'
connectPath('outlook') → '/auth/microsoft'
mailApiBase('gmail')   → '/api/gmail'
mailApiBase('outlook') → '/api/outlook'
```

### Settings modal flows

1. **Save sync selector** → `PUT /api/settings` with `syncSelector`
2. **Create label/folder** → `POST /api/gmail/labels` or `/api/outlook/folders` then save
3. **Reset sync** → type `WIPE` confirm → `POST .../reset-sync`
4. **Apollo** → save key, sync contacts, disconnect

### User preferences (`web/src/lib/preferences.tsx`)

- Loads timezone from settings
- `useFormatters()` for date/time display in contact views

### Types (`web/src/types.ts`)

`Me`, `Contact`, `Thread`, `EmailRow`, `SyncResult`, `ReplyContext`, `AuthProvider`, etc.

---

## 17. Local development

```bash
# 1. Copy env
cp .env.example .env   # set Supabase DATABASE_URL + DIRECT_URL — see docs/SUPABASE.md

# 2. Database
cd server && npm run prisma:deploy && npm run prisma:generate

# 3. Backend
cd server && npm run dev    # http://localhost:3000

# 4. Frontend
cd web && npm run dev       # http://localhost:5173
```

- Browse data: Supabase **Table Editor** or `npx dotenv -e ../.env -- prisma studio` from `server/`
- Register Google redirect: `http://localhost:5173/auth/google/callback`
- Webhook local testing: ngrok + update Pub/Sub push URL

---

## 18. Testing

```bash
cd server
npm run test        # vitest, src/**/*.test.ts only
npm run build       # tsc
```

Coverage includes: auth, gmail send/sync/mime/parser, outlook, webhooks, watch, queue, handlers, contacts, settings, apollo, dev routes.

Manual webhook test (PowerShell):

```powershell
$payload = '{"emailAddress":"USER@EMAIL.COM","historyId":"999999"}'
$b64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($payload))
Invoke-RestMethod -Method POST -Uri "http://localhost:3000/api/webhooks/gmail" `
  -ContentType "application/json" `
  -Body (@{ message = @{ data = $b64 } } | ConvertTo-Json)
```

Prerequisites: user in DB, `CrmLabel` row (save label in Settings).

---

## 19. Server file index

| Path | Role |
|------|------|
| `src/index.ts` | Bootstrap, routes, worker, health |
| `src/env.ts` | Environment |
| `src/auth/routes.ts` | OAuth |
| `src/auth/middleware.ts` | Session auth |
| `src/auth/tokens.ts` | Token refresh |
| `src/auth/crypto.ts` | Encryption |
| `src/gmail/routes.ts` | Gmail HTTP API |
| `src/gmail/send.ts` | Send + CRM log |
| `src/gmail/sync.ts` | Manual sync |
| `src/gmail/watchManager.ts` | Gmail watch |
| `src/gmail/mime.ts` | MIME builder |
| `src/gmail/parser.ts` | Header parse |
| `src/gmail/body.ts` | Body extract |
| `src/webhooks/gmailReceiver.ts` | Pub/Sub webhook |
| `src/queue/worker.ts` | Job queue |
| `src/queue/handlers/labelSync.ts` | Label sync job |
| `src/queue/handlers/threadSync.ts` | Thread sync job |
| `src/outlook/routes.ts` | Outlook HTTP API |
| `src/outlook/send.ts` | Outlook send |
| `src/outlook/sync.ts` | Outlook sync |
| `src/apollo/routes.ts` | Apollo HTTP API |
| `src/contacts/routes.ts` | Contact API |
| `src/contacts/upsert.ts` | Contact upsert helpers |
| `src/workspaces/routes.ts` | Workspace API |
| `src/workspaces/service.ts` | Personal workspace |
| `src/users/settings.ts` | Settings + CrmLabel |
| `src/dev/routes.ts` | Dev webhook simulate |

---

## 20. Web file index

| Path | Role |
|------|------|
| `src/App.tsx` | Root layout, auth gate, background sync |
| `src/main.tsx` | React mount |
| `src/types.ts` | Shared types |
| `src/components/TopBar.tsx` | Header actions |
| `src/components/ContactList.tsx` | Sidebar list |
| `src/components/ContactDetail.tsx` | Thread view |
| `src/components/ComposeForm.tsx` | Send modal |
| `src/components/SettingsModal.tsx` | Settings + Apollo + wipe |
| `src/lib/provider.ts` | Provider URL helpers |
| `src/lib/preferences.tsx` | Timezone context |
| `src/lib/formatters.ts` | Date formatting |
| `src/lib/syncResult.ts` | Sync toast messages |
| `src/lib/outlookErrors.ts` | Error formatting |
| `vite.config.ts` | Dev server + API proxy |

---

*This document reflects the codebase as implemented in this repository. For webhook setup detail and troubleshooting, see also `docs/GOOGLE_WEBHOOK_GUIDE.md`.*
