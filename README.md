# FlyCRM

CRM with a full **Message Center** (Gmail and Outlook), JWT + OAuth sign-in, real **Contacts** (Apollo, LinkedIn CSV, email sync), and **Settings** (profile, password, integrations).

## Stack

- **Frontend:** Vite + React + shadcn in `web/` (port `5173`)
- **Backend:** Express + Prisma + PostgreSQL + JWT auth (access token + httpOnly refresh cookie) (port `3000`)
- **Docs:** `docs/PROJECT_GUIDE.md`, `docs/SUPABASE.md`, `docs/COMPLETE_FEATURE_SPEC.md`, `docs/UI_STRUCTURE.md`, `docs/UI_REFERENCE.md`, `docs/GOOGLE_WEBHOOK_GUIDE.md`, `docs/gmail-webhook-integration-spec.md`, `docs/outlook-webhook-integration-spec.md`, `docs/APOLLO_INTEGRATION.md`, `docs/LINKEDIN_DATA_INTEGRATION.md`

## First run (checklist)

1. `cp .env.example .env` and fill required vars (see below)
2. Set `DATABASE_URL` and `DIRECT_URL` in `.env` (see [docs/SUPABASE.md](docs/SUPABASE.md))
3. `cd server && npm install && npm run prisma:deploy && npm run prisma:generate` (migrations + Prisma client for `@prisma/client` types)
4. From repo root: `npm install && npm run dev:all`
5. Open http://localhost:5173 — landing page should **not** show "API server is not running"

## Quick start

### 1. Environment

```bash
cp .env.example .env
```

**Required:**

- `SESSION_SECRET` — long random string
- `DATABASE_URL` / `DIRECT_URL` — Supabase Postgres (see [docs/SUPABASE.md](docs/SUPABASE.md))
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI=http://localhost:5173/auth/google/callback`
- `ENCRYPTION_KEY` — `openssl rand -base64 32`

**JWT (optional — defaults to `SESSION_SECRET` if unset):**

- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`
- `JWT_ACCESS_TTL` (default `15m`), `JWT_REFRESH_TTL` (default `30d`)

**Optional — Outlook OAuth:**

- `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`
- `MICROSOFT_REDIRECT_URI=http://localhost:5173/auth/microsoft/callback`

**Optional — push webhooks:**

- Gmail: `GMAIL_PUBSUB_TOPIC`, `GOOGLE_WEBHOOK_AUDIENCE`
- Outlook: `OUTLOOK_WEBHOOK_URL`, `OUTLOOK_WEBHOOK_CLIENT_STATE`

### 2. Database

Set Supabase connection strings in `.env` — see [docs/SUPABASE.md](docs/SUPABASE.md).

```bash
cd server && npm install && npm run prisma:deploy && npm run prisma:generate
```

From repo root you can also run `npm run prisma:generate` after migrations.

Browse data in the Supabase **Table Editor** or run `npx dotenv -e ../.env -- prisma studio` from `server/`.

### 3. Run

**Option A — both servers (recommended):**

```bash
npm install
npm run dev:all
```

**Option B — two terminals:**

```bash
# Terminal 1 — API
cd server && npm run dev

# Terminal 2 — frontend (from repo root or cd web)
npm run dev
# equivalent: cd web && npm run dev
```

The Vite dev server proxies `/auth` and `/api` to port **3000**.

Open http://localhost:5173 → **Sign up** (email/password) or **Sign in** → connect Gmail or Outlook under **Settings → Integrations** (or sign in with OAuth) → **Dashboard** and **Message Center** at `/email`.

### Troubleshooting

**Red banner: "API server is not running"**

The frontend proxies `/api` and `/auth` to port **3000**. Start the API:

```bash
npm run dev:all
```

Or `cd server && npm run dev` in a second terminal. Confirm: `Server listening on http://localhost:3000`.

Test liveness: `curl http://localhost:3000/api/health/live` should return `{"ok":true}`.

**TypeScript: `AuthProvider` (or other enums) not exported from `@prisma/client`**

Generate the client after clone or schema changes (stop `dev:all` first on Windows if you see `EPERM` on the query engine DLL):

```bash
cd server && npm run prisma:generate
# or from repo root:
npm run prisma:generate
```

**API starts then crashes (Prisma `updatedAt` / column errors)**

Re-run migrations:

```bash
cd server && npm run prisma:deploy
```

**HTTP 500 on `/auth/google`**

Same as above — API must be running on port 3000.

## Authentication

- **Email/password:** `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`
- **Session refresh:** `POST /auth/refresh` (httpOnly `flycrm.refresh` cookie)
- **Change password:** `POST /auth/change-password` (credential accounts with existing password)
- **OAuth:** `GET /auth/google`, `GET /auth/microsoft` — login or connect inbox to an existing credential account via `POST /auth/connect/init`
- Frontend stores the access token in memory; the refresh cookie restores the session on page reload

## Message Center

- **Inbox** — `GET /api/messages` (synced CRM emails)
- **Compose** — `POST /api/gmail/send` or `POST /api/outlook/send`
- **Sync** — manual + every 3 minutes while tab is visible (`POST /api/gmail/sync` or `/api/outlook/sync`)
- **Apollo panel** — quick-compose to Apollo-imported contacts from the inbox sidebar
- **Templates** — local UI; prefills compose (no API)
- **Star / Archive** — client-only until Gmail label actions are added

## Integrations

- **Apollo.io** — API key in Settings modal; sync contacts. See [docs/APOLLO_INTEGRATION.md](docs/APOLLO_INTEGRATION.md)
- **LinkedIn CSV** — import `Connections.csv` from Settings. See [docs/LINKEDIN_DATA_INTEGRATION.md](docs/LINKEDIN_DATA_INTEGRATION.md)
- **Contacts** — `GET /api/contacts` with sources: manual, logged email, Apollo, LinkedIn CSV

## Gmail webhook setup

See [docs/GOOGLE_WEBHOOK_GUIDE.md](docs/GOOGLE_WEBHOOK_GUIDE.md).

1. Save sync label in the **Settings modal** (Email Center empty-inbox link, or **Settings → Integrations → Email sync settings**; creates `CrmLabel` + `users.watch`)
2. Configure Pub/Sub push to `https://YOUR_PUBLIC_HOST/api/webhooks/gmail`

### Test levels

**Level A** (queue only, no ngrok):

```powershell
$payload = '{"emailAddress":"YOUR_GMAIL_EMAIL","historyId":"999999"}'
$b64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($payload))
Invoke-RestMethod -Method POST -Uri "http://localhost:3000/api/webhooks/gmail" `
  -ContentType "application/json" `
  -Body (@{ message = @{ data = $b64 } } | ConvertTo-Json)
```

Expect HTTP **204** and `SyncJob` rows in Supabase Table Editor (or Prisma Studio).

**Level B** (logged in, dev only): `POST /api/dev/gmail-webhook-simulate`

**Level C** — ngrok + real labeled mail (full E2E)

## Outlook webhook setup

See [docs/outlook-webhook-integration-spec.md](docs/outlook-webhook-integration-spec.md).

1. Set `OUTLOOK_WEBHOOK_URL` (public base URL, e.g. ngrok) and `OUTLOOK_WEBHOOK_CLIENT_STATE` in `.env`
2. Save CRM folder in the **Settings modal** (registers Graph subscriptions for CRM folder + Inbox)
3. Push notifications arrive at `https://YOUR_PUBLIC_HOST/api/webhooks/outlook`

### Health

```bash
curl http://localhost:3000/api/health/live
curl http://localhost:3000/api/health/watch
# Authenticated (Bearer JWT after sign-in):
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/health/gmail-sync
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/health/outlook-sync
```

## Server tests

```bash
cd server && npm test
# or from repo root:
npm run test:server
```

Build API TypeScript from root: `npm run build:server`.

## Project layout

```text
server/          Express API, Prisma, Gmail/Outlook sync, webhooks, JWT auth
web/             React UI — Message Center, Contacts, Settings (Profile/Security/Integrations)
docs/            Feature specs and webhook guides
```

Dashboard, Companies, Pipeline, Tasks, Reports, and AI are UI shells without backend persistence yet.
