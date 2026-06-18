# FlyCRM — Completed Tasks

## Outlook Email Sync & Webhooks
- [x] Fixed thread replies not syncing — added dual Graph subscriptions (CRM folder + Inbox)
- [x] Improved conversation import to merge folder cache + Graph queries (avoids `InefficientFilter`)
- [x] Added debounced sync pipeline with delta conversation tracking
- [x] Webhook handler resolves user by CRM or Inbox subscription ID
- [x] Orphan subscription fallback: valid `clientState` + unknown ID → schedule sync + re-register subs
- [x] Subscription manager reconciles orphan Graph subs; Inbox create retries 3×
- [x] DB fields: `outlookInboxSubscriptionId`, `outlookInboxSubscriptionExpiry` (migration applied)
- [x] Tests added/updated for outlook webhook receiver (19 tests passing)

## Dev Tooling Fix
- [x] Fixed `npm run dev` crash — removed `@prisma/client` → `.d.ts` path override in `server/tsconfig.json`
- [x] Removed extra root `tsconfig.json` that confused tsx/esbuild

## Email Attachments (Backend — Option A)
- [x] Object storage module: local filesystem (dev) + optional S3 (production via `S3_BUCKET`)
- [x] Gmail send: multipart MIME with attachments
- [x] Outlook send: Graph API `fileAttachment` support
- [x] Attachment metadata stored in DB (`filename`, `contentType`, `size`, `storageKey`)
- [x] Download API: `GET /api/messages/:messageId/attachments/:attachmentId`
- [x] Message detail shows attachment download links (`EmailAttachments.tsx`)
- [x] Limits enforced: 10 files, 5MB each, 25MB total

## Compose UI Cleanup
- [x] Removed **Attach Files** button from compose (backend attachment APIs kept for later)
- [x] Removed **Schedule** button from compose
- [x] Compose footer now shows **Send** only — send/reply/sync unchanged

## Landing Page UI Refresh
- [x] Redesigned `/` landing page with full marketing layout
- [x] Added header (FlyCRM logo + brand), hero headline, 3 feature cards, footer
- [x] Subtle gradient background orbs matching dark theme design system
- [x] Polished `ConnectProvider` card: “Get started” section, Gmail/Outlook icons, side-by-side buttons
- [x] Preserved all auth behavior: OAuth connect, API-offline alert, error toasts, dashboard redirect




## Apollo.io Integration
- [x] Aligned with `docs/APOLLO_INTEGRATION.md` — `POST /contacts/search`, typed errors, doc error codes
- [x] Sync returns `{ imported, created, skippedNoEmail, pages, capped }`
- [x] `upsertContactFromApollo` with name backfill and `created` tracking
- [x] Settings modal: Save key, Sync contacts now, Disconnect, error handling
- [x] Unit tests: `apollo/client.test.ts`, `apollo/sync.test.ts` (27 server tests passing)

## Contacts Page (Real API)
- [x] `/contacts` loads from `GET /api/contacts` (replaced mock data)
- [x] Source badges: Apollo / Email / Manual; search by name or email
- [x] Settings Apollo sync invalidates contacts list

## Apollo in Email Center
- [x] Inbox API includes `contactCreatedFrom` on each message (counterparty source)
- [x] `GET /api/contacts?createdFrom=apollo` filter for Apollo panel
- [x] **Apollo contacts panel** in Message Center — click contact → Compose with **To** filled
- [x] **Apollo** badge on inbox threads when counterparty is Apollo-imported
- [x] **All | Apollo** inbox filter toggle
- [x] Gmail/Outlook sync unchanged

## LinkedIn CSV Import
- [x] Documented in `docs/LINKEDIN_DATA_INTEGRATION.md` (Section 18)
- [x] Prisma: `linkedin_csv` source, `company`, `title`, `linkedinUrl`, optional `email` (migration applied)
- [x] `POST /api/contacts/import/linkedin-csv` — parse LinkedIn `Connections.csv`, upsert by email or profile URL
- [x] Import stats: `{ imported, created, updated, skippedNoIdentifier, skippedInvalidUrl }`
- [x] Settings → **LinkedIn connections** — file upload + **Import LinkedIn contacts**
- [x] Contacts page: **LinkedIn** badge, profile link, handles contacts without email
- [x] Unit tests: `server/src/contacts/linkedinCsv.test.ts`





## JWT Hybrid Sign In / Sign Up
- [x] Prisma: `credential` auth provider, `passwordHash` on User, `RefreshToken` model (migration `20260610100000_jwt_auth`)
- [x] Backend JWT auth: `POST /auth/register`, `/login`, `/refresh`, `/logout`, `GET /auth/me` with `mailProvider` + `hasPassword`
- [x] OAuth `mode=login|connect` with signed state; JWT issued on login; connect links inbox tokens for credential users
- [x] `requireAuth` middleware validates Bearer JWT (replaces session-based guard)
- [x] Frontend: `/sign-in`, `/sign-up`, `AuthLayout`, `OAuthButtons`; landing CTAs updated
- [x] Frontend JWT client: in-memory access token + httpOnly refresh cookie, auto-refresh on 401
- [x] `mailProvider` used for inbox routing; Email Center empty state when no inbox connected
- [x] Settings: Connect Gmail/Outlook via `POST /auth/connect/init` for credential users
- [x] Env: `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_TTL`, `JWT_REFRESH_TTL` in `.env.example`
- [x] Unit tests: `server/src/auth/auth.test.ts` (password, JWT, OAuth state)

## Fix Auth Session on Page Refresh
- [x] Added `restoreSession()` in `web/src/lib/api.ts` — calls `POST /auth/refresh` when no in-memory access token
- [x] `api()` bootstraps session before requests (except login/register/refresh)
- [x] `useAuth` calls `restoreSession()` before `GET /auth/me` on app load
- [x] Dashboard hard refresh stays authenticated when `flycrm.refresh` cookie is valid

## Prisma Client / IDE Type Fix
- [x] Regenerated Prisma Client (`npm run prisma:generate`) after JWT schema changes
- [x] Confirmed `tsc` build and 41 server tests pass — `credential`, `passwordHash`, `prisma.refreshToken` types valid
- [x] Dropped legacy `session` table migration (`drop_session_table`) — JWT auth no longer uses express-session store

## Logout Redirect to Landing
- [x] Reordered logout in `layout.tsx`: `navigate("/", { replace: true })` before `await logout()` to avoid `RequireAuth` race
- [x] Added `/auth/logout` to `SKIP_BOOTSTRAP` in `api.ts` so logout does not trigger session restore

## Fix Sign-In Autofill
- [x] SignIn: unique `signin-email` / `signin-password` IDs, `autoComplete="username"`, readonly-until-focus
- [x] SignUp: unique `signup-*` field IDs/names, readonly-until-focus on credential fields
- [x] Settings: renamed profile/security field IDs, `autoComplete="off"` on non-login email/password inputs
- [x] Sign up Name label: removed “(optional)” text

## Auth UI / TypeScript Fixes
- [x] `OAuthTokenHandler` returns `null` — fixes “cannot be used as a JSX component” (`() => void`) error in `App.tsx`

## Working Profile Settings Page
- [x] `GET/PUT /api/settings` returns and updates `User.name` + `email` (`server/src/users/settings.ts`)
- [x] `UserSettings` type extended with `name` and `email` (`web/src/types.ts`)
- [x] Settings → Profile tab: editable Name, read-only Email; removed job title, phone, timezone
- [x] Save → `PUT /api/settings` → toast + invalidate `auth/me`; Cancel resets name from user

## Working Change Password (Security Tab)
- [x] `POST /auth/change-password` — verifies current password, updates hash, revokes other refresh tokens (`server/src/auth/routes.ts`)
- [x] `revokeOtherRefreshTokens` keeps current browser session, signs out other devices (`server/src/auth/refreshTokens.ts`)
- [x] `validatePasswordChangeInput` helper for missing/weak/same-password guards (`server/src/auth/password.ts`)
- [x] Settings → Security tab: working form for credential users (`user.hasPassword`)
- [x] OAuth-only users see message that password change is not available
- [x] Client validation (confirm match, min 8 chars) + API error toasts
- [x] Unit tests for `validatePasswordChangeInput` (45 server tests passing)





## Fix Auth Session on Tab Refocus
- [x] Root cause: expired in-memory access JWT (15m TTL) while refresh cookie still valid; `restoreSession()` skipped refresh when stale token present
- [x] `web/src/lib/tokenExpiry.ts` — `accessTokenNeedsRefresh()` with 30s buffer before JWT `exp`
- [x] `restoreSession()` refreshes when token missing, expired, or near expiry (`web/src/lib/api.ts`)
- [x] `api()` calls `restoreSession()` before requests (not only when token absent)
- [x] `GET /auth/me` returns **401** when `Bearer` present but invalid; **200 `{ user: null }`** only when no auth header (`server/src/auth/routes.ts`)
- [x] `useAuth`: `retry: 1`, `placeholderData: keepPreviousData`, exports `isFetching`
- [x] `RequireAuth` keeps dashboard during background auth refetch; redirects only after fetch settles with no user
- [x] `useSessionRefresh` hook on `visibilitychange` → proactive `restoreSession()` (`web/src/hooks/useSessionRefresh.ts`, `App.tsx`)
- [x] Unit tests: `web/src/lib/tokenExpiry.test.ts`; `server/src/auth/auth.routes.test.ts` (`/me` 401 vs 200)

## Fix TypeScript Red Lines in auth.routes.test.ts
- [x] Included test files in `server/tsconfig.json` (`esModuleInterop: true`) — removed `exclude: ["src/**/*.test.ts"]` for IDE typecheck
- [x] Added `server/tsconfig.build.json` — production `tsc` excludes `*.test.ts`; `npm run build` uses `-p tsconfig.build.json`
- [x] Removed conflicting configs: `server/src/tsconfig.json`, root `tsconfig.json`, `server/tsconfig.tsbuildinfo`
- [x] Removed `composite: true` from server tsconfig (single unified project for IDE + `tsc --noEmit`)
- [x] `.vscode/settings.json` — removed `enableProjectDiagnostics` / `useSyntaxOnly` (false `esModuleInterop` diagnostics on test files)
- [x] Verified: `tsc --noEmit`, `npm run build` (no `dist/**/*.test.js`), `auth.routes.test.ts` 4/4 tests pass, IDE clean on `express` / `supertest` imports












## Supabase PostgreSQL Integration
- [x] Prisma `directUrl` + `DATABASE_URL` / `DIRECT_URL` in `server/prisma/schema.prisma`
- [x] `server/src/env.ts` — load dotenv only when `NODE_ENV !== 'production'` (Vercel-safe)
- [x] `server/src/db.ts` — Prisma client singleton for serverless / hot reload
- [x] Removed dead `express-session`, `connect-pg-simple`, and `pg` pool from `server/src/index.ts` (session table already dropped)
- [x] Moved `prisma` to `dependencies` in `server/package.json` for Vercel builds
- [x] Updated `.env.example` with Supabase pooler + session pooler URL templates
- [x] Added `DIRECT_URL` to `server/vitest.setup.ts`
- [x] Documented setup in `docs/SUPABASE.md`

## Supabase Production Database (Live)
- [x] Wired `.env` to Supabase project `qvauaicrvutnnqgmxokq` (ap-southeast-1)
- [x] `DATABASE_URL` — transaction pooler port 6543 with `pgbouncer=true&connection_limit=1`
- [x] `DIRECT_URL` — session pooler port 5432 (direct `db.*.supabase.co` unreachable from dev machine)
- [x] Ran `prisma migrate deploy` — all 8 migrations applied on Supabase
- [x] Verified `GET /api/health/live`, `GET /api/health` (DB connected), `POST /auth/register`
- [x] Confirmed user rows in Supabase Table Editor

## Remove Docker (Supabase-Only Dev)
- [x] Deleted `docker-compose.yml` (local Postgres, Adminer, prisma-migrate service)
- [x] Updated `README.md` — Supabase-first onboarding (no Docker steps)
- [x] Updated `docs/SUPABASE.md`, `docs/PROJECT_GUIDE.md` §13, `docs/COMPLETE_FEATURE_SPEC.md`
- [x] Removed commented Docker `DATABASE_URL` / `DIRECT_URL` from `.env` and `.env.example`

## Fix Prisma P2024 Connection Pool Timeout (`GET /api/contacts`)
- [x] Root cause: `connection_limit=1` on Supabase pooler + `Promise.all` N+1 queries per contact
- [x] Refactored `server/src/contacts/routes.ts` — single `findMany` with `_count.recipients` + included last recipient
- [x] Removed per-contact `count` + `findFirst` parallel queries (Vercel-safe, faster)
- [x] Documented `connection_limit` guidance in `docs/SUPABASE.md`
- [x] Verified batched query against 13 contacts; 49 server tests pass

## Vercel Deployment
- [x] Split `server/src/index.ts` → `app.ts` + `backgroundJobs.ts` + `server/api/index.ts` (serverless Express)
- [x] Add cron routes (`/api/cron/*`) + `CRON_SECRET` for background jobs; export `pollOnce` from worker
- [x] Add `server/vercel.json` + `web/vercel.json` (two Vercel projects: root `server` + root `web`)
- [x] `vercel-build` script + `docs/VERCEL.md` deploy guide
- [ ] Deploy API project → deploy web project with API proxy rewrites (manual — see `docs/VERCEL.md`)
- [ ] Production OAuth / webhook URLs + smoke test on Vercel (after deploy)





## Manual Verification Still Recommended
- [ ] ngrok → port 3000, `OUTLOOK_WEBHOOK_URL` matches ngrok URL
- [ ] Re-save CRM folder in Settings → logs show CRM + Inbox subscription renewed
- [ ] Reply in thread → webhook fires → sync logs `merged 2 messages` → UI shows both messages
- [ ] Send test email from Compose → confirms send still works after UI changes
- [ ] Visit `/` logged out → landing page renders; Sign up / Sign in CTAs work
- [ ] Sign up with email/password → dashboard → Settings → Connect Gmail → inbox sync works
- [ ] Sign in with Gmail OAuth → dashboard with inbox; hard refresh stays logged in
- [ ] Logout from dashboard → lands on `/` landing page (not `/sign-in`)
- [ ] Sign out → refresh `/dashboard` → redirects to `/sign-in`
- [ ] Background tab 15+ min (or `JWT_ACCESS_TTL=1m`) → return to tab → stays on dashboard (no false `/sign-in` redirect)
- [ ] Open `/sign-in` → email/password empty on load (no wrong browser autofill like “CRM1”)
- [ ] Apollo sync in Settings → Contacts page + Email Center panel show imported contacts
- [ ] Click Apollo contact in Email Center panel → Compose opens with **To** filled
- [ ] Email an Apollo contact → inbox thread shows **Apollo** badge; **Apollo** filter works
- [ ] Export LinkedIn `Connections.csv` → Settings import → Contacts page shows **LinkedIn** badge + profile links
- [ ] Re-import same CSV → no duplicates (`created` = 0, `updated` > 0)
- [ ] Settings → Profile: name/email prefilled; change name → Save → persists after reload
- [ ] Settings → Security (credential user): change password → success toast; sign in with new password works
- [ ] Settings → Security (OAuth user): informational message, no password form
- [x] `GET /api/health` and `/api/contacts` against Supabase — no `P2024` pool timeout
- [x] Sign up / sign in with Supabase-backed DB — user visible in Supabase Table Editor
- [x] Contacts page loads with email counts / last email date (`GET /api/contacts` batched query verified)
