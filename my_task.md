# FlyCRM — Completed Tasks

## Outlook Email Sync & Webhooks
- [x] 1. Fixed thread replies not syncing — added dual Graph subscriptions (CRM folder + Inbox)
- [x] 2. Improved conversation import to merge folder cache + Graph queries (avoids `InefficientFilter`)
- [x] 3. Added debounced sync pipeline with delta conversation tracking
- [x] 4. Webhook handler resolves user by CRM or Inbox subscription ID
- [x] 5. Orphan subscription fallback: valid `clientState` + unknown ID → schedule sync + re-register subs
- [x] 6. Subscription manager reconciles orphan Graph subs; Inbox create retries 3×
- [x] 7. DB fields: `outlookInboxSubscriptionId`, `outlookInboxSubscriptionExpiry` (migration applied)
- [x] 8. Tests added/updated for outlook webhook receiver (19 tests passing)

## Dev Tooling Fix
- [x] 9. Fixed `npm run dev` crash — removed `@prisma/client` → `.d.ts` path override in `server/tsconfig.json`
- [x] 10. Removed extra root `tsconfig.json` that confused tsx/esbuild

## Email Attachments (Backend — Option A)
- [x] 11. Object storage module: local filesystem (dev) + optional S3 (production via `S3_BUCKET`)
- [x] 12. Gmail send: multipart MIME with attachments
- [x] 13. Outlook send: Graph API `fileAttachment` support
- [x] 14. Attachment metadata stored in DB (`filename`, `contentType`, `size`, `storageKey`)
- [x] 15. Download API: `GET /api/messages/:messageId/attachments/:attachmentId`
- [x] 16. Message detail shows attachment download links (`EmailAttachments.tsx`)
- [x] 17. Limits enforced: 10 files, 5MB each, 25MB total

## Compose UI Cleanup
- [x] 18. Removed **Attach Files** button from compose (backend attachment APIs kept for later)
- [x] 19. Removed **Schedule** button from compose
- [x] 20. Compose footer now shows **Send** only — send/reply/sync unchanged

## Landing Page UI Refresh
- [x] 21. Redesigned `/` landing page with full marketing layout
- [x] 22. Added header (FlyCRM logo + brand), hero headline, 3 feature cards, footer
- [x] 23. Subtle gradient background orbs matching dark theme design system
- [x] 24. Polished `ConnectProvider` card: “Get started” section, Gmail/Outlook icons, side-by-side buttons
- [x] 25. Preserved all auth behavior: OAuth connect, API-offline alert, error toasts, dashboard redirect

## Apollo.io Integration
- [x] 26. Aligned with `docs/APOLLO_INTEGRATION.md` — `POST /contacts/search`, typed errors, doc error codes
- [x] 27. Sync returns `{ imported, created, skippedNoEmail, pages, capped }`
- [x] 28. `upsertContactFromApollo` with name backfill and `created` tracking
- [x] 29. Settings modal: Save key, Sync contacts now, Disconnect, error handling
- [x] 30. Unit tests: `apollo/client.test.ts`, `apollo/sync.test.ts` (27 server tests passing)

## Contacts Page (Real API)
- [x] 31. `/contacts` loads from `GET /api/contacts` (replaced mock data)
- [x] 32. Source badges: Apollo / Email / Manual; search by name or email
- [x] 33. Settings Apollo sync invalidates contacts list

## Apollo in Email Center
- [x] 34. Inbox API includes `contactCreatedFrom` on each message (counterparty source)
- [x] 35. `GET /api/contacts?createdFrom=apollo` filter for Apollo panel
- [x] 36. **Apollo contacts panel** in Message Center — click contact → Compose with **To** filled
- [x] 37. **Apollo** badge on inbox threads when counterparty is Apollo-imported
- [x] 38. **All | Apollo** inbox filter toggle
- [x] 39. Gmail/Outlook sync unchanged

## LinkedIn CSV Import
- [x] 40. Documented in `docs/LINKEDIN_DATA_INTEGRATION.md` (Section 18)
- [x] 41. Prisma: `linkedin_csv` source, `company`, `title`, `linkedinUrl`, optional `email` (migration applied)
- [x] 42. `POST /api/contacts/import/linkedin-csv` — parse LinkedIn `Connections.csv`, upsert by email or profile URL
- [x] 43. Import stats: `{ imported, created, updated, skippedNoIdentifier, skippedInvalidUrl }`
- [x] 44. Settings → **LinkedIn connections** — file upload + **Import LinkedIn contacts**
- [x] 45. Contacts page: **LinkedIn** badge, profile link, handles contacts without email
- [x] 46. Unit tests: `server/src/contacts/linkedinCsv.test.ts`

## JWT Hybrid Sign In / Sign Up
- [x] 47. Prisma: `credential` auth provider, `passwordHash` on User, `RefreshToken` model (migration `20260610100000_jwt_auth`)
- [x] 48. Backend JWT auth: `POST /auth/register`, `/login`, `/refresh`, `/logout`, `GET /auth/me` with `mailProvider` + `hasPassword`
- [x] 49. OAuth `mode=login|connect` with signed state; JWT issued on login; connect links inbox tokens for credential users
- [x] 50. `requireAuth` middleware validates Bearer JWT (replaces session-based guard)
- [x] 51. Frontend: `/sign-in`, `/sign-up`, `AuthLayout`, `OAuthButtons`; landing CTAs updated
- [x] 52. Frontend JWT client: in-memory access token + httpOnly refresh cookie, auto-refresh on 401
- [x] 53. `mailProvider` used for inbox routing; Email Center empty state when no inbox connected
- [x] 54. Settings: Connect Gmail/Outlook via `POST /auth/connect/init` for credential users
- [x] 55. Env: `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_TTL`, `JWT_REFRESH_TTL` in `.env.example`
- [x] 56. Unit tests: `server/src/auth/auth.test.ts` (password, JWT, OAuth state)

## Fix Auth Session on Page Refresh
- [x] 57. Added `restoreSession()` in `web/src/lib/api.ts` — calls `POST /auth/refresh` when no in-memory access token
- [x] 58. `api()` bootstraps session before requests (except login/register/refresh)
- [x] 59. `useAuth` calls `restoreSession()` before `GET /auth/me` on app load
- [x] 60. Dashboard hard refresh stays authenticated when `flycrm.refresh` cookie is valid

## Prisma Client / IDE Type Fix
- [x] 61. Regenerated Prisma Client (`npm run prisma:generate`) after JWT schema changes
- [x] 62. Confirmed `tsc` build and 41 server tests pass — `credential`, `passwordHash`, `prisma.refreshToken` types valid
- [x] 63. Dropped legacy `session` table migration (`drop_session_table`) — JWT auth no longer uses express-session store

## Logout Redirect to Landing
- [x] 64. Reordered logout in `layout.tsx`: `navigate("/", { replace: true })` before `await logout()` to avoid `RequireAuth` race
- [x] 65. Added `/auth/logout` to `SKIP_BOOTSTRAP` in `api.ts` so logout does not trigger session restore

## Fix Sign-In Autofill
- [x] 66. SignIn: unique `signin-email` / `signin-password` IDs, `autoComplete="username"`, readonly-until-focus
- [x] 67. SignUp: unique `signup-*` field IDs/names, readonly-until-focus on credential fields
- [x] 68. Settings: renamed profile/security field IDs, `autoComplete="off"` on non-login email/password inputs
- [x] 69. Sign up Name label: removed “(optional)” text

## Auth UI / TypeScript Fixes
- [x] 70. `OAuthTokenHandler` returns `null` — fixes “cannot be used as a JSX component” (`() => void`) error in `App.tsx`

## Working Profile Settings Page
- [x] 71. `GET/PUT /api/settings` returns and updates `User.name` + `email` (`server/src/users/settings.ts`)
- [x] 72. `UserSettings` type extended with `name` and `email` (`web/src/types.ts`)
- [x] 73. Settings → Profile tab: editable Name, read-only Email; removed job title, phone, timezone
- [x] 74. Save → `PUT /api/settings` → toast + invalidate `auth/me`; Cancel resets name from user

## Working Change Password (Security Tab)
- [x] 75. `POST /auth/change-password` — verifies current password, updates hash, revokes other refresh tokens (`server/src/auth/routes.ts`)
- [x] 76. `revokeOtherRefreshTokens` keeps current browser session, signs out other devices (`server/src/auth/refreshTokens.ts`)
- [x] 77. `validatePasswordChangeInput` helper for missing/weak/same-password guards (`server/src/auth/password.ts`)
- [x] 78. Settings → Security tab: working form for credential users (`user.hasPassword`)
- [x] 79. OAuth-only users see message that password change is not available
- [x] 80. Client validation (confirm match, min 8 chars) + API error toasts
- [x] 81. Unit tests for `validatePasswordChangeInput` (45 server tests passing)

## Fix Auth Session on Tab Refocus
- [x] 82. Root cause: expired in-memory access JWT (15m TTL) while refresh cookie still valid; `restoreSession()` skipped refresh when stale token present
- [x] 83. `web/src/lib/tokenExpiry.ts` — `accessTokenNeedsRefresh()` with 30s buffer before JWT `exp`
- [x] 84. `restoreSession()` refreshes when token missing, expired, or near expiry (`web/src/lib/api.ts`)
- [x] 85. `api()` calls `restoreSession()` before requests (not only when token absent)
- [x] 86. `GET /auth/me` returns **401** when `Bearer` present but invalid; **200 `{ user: null }`** only when no auth header (`server/src/auth/routes.ts`)
- [x] 87. `useAuth`: `retry: 1`, `placeholderData: keepPreviousData`, exports `isFetching`
- [x] 88. `RequireAuth` keeps dashboard during background auth refetch; redirects only after fetch settles with no user
- [x] 89. `useSessionRefresh` hook on `visibilitychange` → proactive `restoreSession()` (`web/src/hooks/useSessionRefresh.ts`, `App.tsx`)
- [x] 90. Unit tests: `web/src/lib/tokenExpiry.test.ts`; `server/src/auth/auth.routes.test.ts` (`/me` 401 vs 200)

## Fix TypeScript Red Lines in auth.routes.test.ts
- [x] 91. Included test files in `server/tsconfig.json` (`esModuleInterop: true`) — removed `exclude: ["src/**/*.test.ts"]` for IDE typecheck
- [x] 92. Added `server/tsconfig.build.json` — production `tsc` excludes `*.test.ts`; `npm run build` uses `-p tsconfig.build.json`
- [x] 93. Removed conflicting configs: `server/src/tsconfig.json`, root `tsconfig.json`, `server/tsconfig.tsbuildinfo`
- [x] 94. Removed `composite: true` from server tsconfig (single unified project for IDE + `tsc --noEmit`)
- [x] 95. `.vscode/settings.json` — removed `enableProjectDiagnostics` / `useSyntaxOnly` (false `esModuleInterop` diagnostics on test files)
- [x] 96. Verified: `tsc --noEmit`, `npm run build` (no `dist/**/*.test.js`), `auth.routes.test.ts` 4/4 tests pass, IDE clean on `express` / `supertest` imports

## Supabase PostgreSQL Integration
- [x] 97. Prisma `directUrl` + `DATABASE_URL` / `DIRECT_URL` in `server/prisma/schema.prisma`
- [x] 98. `server/src/env.ts` — load dotenv only when `NODE_ENV !== 'production'` (Vercel-safe)
- [x] 99. `server/src/db.ts` — Prisma client singleton for serverless / hot reload
- [x] 100. Removed dead `express-session`, `connect-pg-simple`, and `pg` pool from `server/src/index.ts` (session table already dropped)
- [x] 101. Moved `prisma` to `dependencies` in `server/package.json` for Vercel builds
- [x] 102. Updated `.env.example` with Supabase pooler + session pooler URL templates
- [x] 103. Added `DIRECT_URL` to `server/vitest.setup.ts`
- [x] 104. Documented setup in `docs/SUPABASE.md`

## Supabase Production Database (Live)
- [x] 105. Wired `.env` to Supabase project `qvauaicrvutnnqgmxokq` (ap-southeast-1)
- [x] 106. `DATABASE_URL` — transaction pooler port 6543 with `pgbouncer=true&connection_limit=1`
- [x] 107. `DIRECT_URL` — session pooler port 5432 (direct `db.*.supabase.co` unreachable from dev machine)
- [x] 108. Ran `prisma migrate deploy` — all 8 migrations applied on Supabase
- [x] 109. Verified `GET /api/health/live`, `GET /api/health` (DB connected), `POST /auth/register`
- [x] 110. Confirmed user rows in Supabase Table Editor

## Remove Docker (Supabase-Only Dev)
- [x] 111. Deleted `docker-compose.yml` (local Postgres, Adminer, prisma-migrate service)
- [x] 112. Updated `README.md` — Supabase-first onboarding (no Docker steps)
- [x] 113. Updated `docs/SUPABASE.md`, `docs/PROJECT_GUIDE.md` §13, `docs/COMPLETE_FEATURE_SPEC.md`
- [x] 114. Removed commented Docker `DATABASE_URL` / `DIRECT_URL` from `.env` and `.env.example`

## Fix Prisma P2024 Connection Pool Timeout (`GET /api/contacts`)
- [x] 115. Root cause: `connection_limit=1` on Supabase pooler + `Promise.all` N+1 queries per contact
- [x] 116. Refactored `server/src/contacts/routes.ts` — single `findMany` with `_count.recipients` + included last recipient
- [x] 117. Removed per-contact `count` + `findFirst` parallel queries (Vercel-safe, faster)
- [x] 118. Documented `connection_limit` guidance in `docs/SUPABASE.md`
- [x] 119. Verified batched query against 13 contacts; 49 server tests pass






## Vercel Deployment
- [x] 120. Split `server/src/index.ts` → `app.ts` + `backgroundJobs.ts` + `server/api/index.ts` (serverless Express)
- [x] 121. Add cron routes (`/api/cron/*`) + `CRON_SECRET` for background jobs; export `pollOnce` from worker
- [x] 122. Add `server/vercel.json` + `web/vercel.json` (two Vercel projects: root `server` + root `web`)
- [x] 123. `vercel-build` script + `docs/VERCEL.md` deploy guide
- [x] 124. Deploy API project (`crm-fly1.vercel.app`) + web project (`fly-crm-web.vercel.app`) with API proxy rewrites
- [x] 125. Production OAuth / webhook URLs set on Vercel API (`WEB_ORIGIN`, `GOOGLE_REDIRECT_URI`, `MICROSOFT_REDIRECT_URI`, `OUTLOOK_WEBHOOK_URL`, `GOOGLE_WEBHOOK_AUDIENCE`)

## Vercel Hobby Plan — External Cron (Option B)
- [x] 126. Trimmed `server/vercel.json` to daily crons only (`gmail-daily-sync`, `outlook-daily-sync`) — Hobby allows max 1 run/day per cron
- [x] 127. Added `.github/workflows/cron-sync-worker.yml` — POST `/api/cron/sync-worker` every 5 min with `CRON_SECRET`
- [x] 128. Added `.github/workflows/cron-watch-renew.yml` — POST Gmail/Outlook watch renew every 6h
- [x] 129. Documented Hobby plan, GitHub secrets (`API_BASE_URL`, `CRON_SECRET`), and cron-job.org fallback in `docs/VERCEL.md`
- [x] 130. Updated `.env.example` — `CRON_SECRET` note for Vercel Cron + GitHub Actions

## Vercel API Build Fixes
- [x] 131. `server/scripts/ensure-direct-url.mjs` — derive `DIRECT_URL` from Supabase `DATABASE_URL` at build time
- [x] 132. `server/scripts/postinstall.mjs` + `server/scripts/vercel-build.mjs` — run ensure-direct-url before `prisma generate` / migrate / build
- [x] 133. `installCommand: npm install --include=dev` in `server/vercel.json` — fixes `tsc: command not found` when `NODE_ENV=production`
- [x] 134. `npm run build` uses `npx tsc -p tsconfig.build.json`
- [x] 135. Documented install command + env vars in `docs/VERCEL.md`

## Vercel API Runtime Fixes
- [x] 136. `server/src/ensureDirectUrl.ts` — derive `DIRECT_URL` at runtime (not only build) for Prisma on serverless
- [x] 137. Wired `ensureDirectUrl` in `server/src/env.ts` and `server/src/db.ts` before Prisma init
- [x] 138. Prisma `binaryTargets = ["native", "rhel-openssl-3.0.x"]` in `server/prisma/schema.prisma`
- [x] 139. `server/vercel.json` — `includeFiles: node_modules/.prisma/**` for query engine on Vercel
- [x] 140. `server/api/index.ts` — safe startup wrapper with `startup_failed` JSON on env/load errors
- [x] 141. `GOOGLE_SCOPES` default in `server/src/env.ts` (matches `.env.example`; no longer required on Vercel)
- [x] 142. Fixed root URL crash — `server/vercel.json` rewrites only `/api/*` and `/auth/*` (removed catch-all `/` → `/api`)
- [x] 143. Added `GET /` and `GET /api` JSON health pointers in `server/src/app.ts`
- [x] 144. `web/vercel.json` — proxy `/api` and `/auth` to `https://crm-fly1.vercel.app`
- [x] 145. Verified `GET https://crm-fly1.vercel.app/api/health/live` → `{"ok":true}`

## CRM API Postman Collection
- [x] 146. Documented full API inventory (55 routes) — health, auth, Gmail, Outlook, messages, contacts, settings, workspaces, Apollo, webhooks, cron, dev
- [x] 147. Created Postman environments: `postman/CRM-API-Local.postman_environment.json` (`http://localhost:3000`) and `postman/CRM-API-Production.postman_environment.json` (`https://crm-fly1.vercel.app`)
- [x] 148. Environment variables: `baseUrl`, `accessToken`, `cronSecret`, `contactId`, `threadId`, `outlookWebhookClientState`
- [x] 149. Generated Postman Collection v2.1: `postman/CRM-API.postman_collection.json` (53 requests across 12 folders)
- [x] 150. Collection folders: 00 Setup, 01 Health, 02 Auth, 03 Settings & Workspaces, 04 Messages, 05 Contacts, 06 Gmail, 07 Outlook, 08 Apollo, 09 Webhooks, 10 Cron, 11 Dev
- [x] 151. Collection-level Bearer auth (`Authorization: Bearer {{accessToken}}`); cron routes use `{{cronSecret}}`
- [x] 152. Login / Register / Refresh test scripts auto-save `accessToken` to collection + environment variables
- [x] 153. Sample JSON bodies for POST/PUT routes: register, login, change-password, connect init, settings, Gmail/Outlook send, labels/folders, Apollo key, reset-sync (WIPE), webhooks
- [x] 154. LinkedIn CSV import request with raw `text/csv` body sample
- [x] 155. Regenerator script: `postman/generate.mjs` — run `node postman/generate.mjs` after route changes

## Manual Verification Still Recommended
- [ ] 156. ngrok → port 3000, `OUTLOOK_WEBHOOK_URL` matches ngrok URL
- [ ] 157. Re-save CRM folder in Settings → logs show CRM + Inbox subscription renewed
- [ ] 158. Reply in thread → webhook fires → sync logs `merged 2 messages` → UI shows both messages
- [ ] 159. Send test email from Compose → confirms send still works after UI changes
- [ ] 160. Visit `/` logged out → landing page renders; Sign up / Sign in CTAs work
- [ ] 161. Sign up with email/password → dashboard → Settings → Connect Gmail → inbox sync works
- [ ] 162. Sign in with Gmail OAuth → dashboard with inbox; hard refresh stays logged in
- [ ] 163. Logout from dashboard → lands on `/` landing page (not `/sign-in`)
- [ ] 164. Sign out → refresh `/dashboard` → redirects to `/sign-in`
- [ ] 165. Background tab 15+ min (or `JWT_ACCESS_TTL=1m`) → return to tab → stays on dashboard (no false `/sign-in` redirect)
- [ ] 166. Open `/sign-in` → email/password empty on load (no wrong browser autofill like “CRM1”)
- [ ] 167. Apollo sync in Settings → Contacts page + Email Center panel show imported contacts
- [ ] 168. Click Apollo contact in Email Center panel → Compose opens with **To** filled
- [ ] 169. Email an Apollo contact → inbox thread shows **Apollo** badge; **Apollo** filter works
- [ ] 170. Export LinkedIn `Connections.csv` → Settings import → Contacts page shows **LinkedIn** badge + profile links
- [ ] 171. Re-import same CSV → no duplicates (`created` = 0, `updated` > 0)
- [ ] 172. Settings → Profile: name/email prefilled; change name → Save → persists after reload
- [ ] 173. Settings → Security (credential user): change password → success toast; sign in with new password works
- [ ] 174. Settings → Security (OAuth user): informational message, no password form
- [x] 175. `GET /api/health` and `/api/contacts` against Supabase — no `P2024` pool timeout
- [x] 176. Sign up / sign in with Supabase-backed DB — user visible in Supabase Table Editor
- [x] 177. Contacts page loads with email counts / last email date (`GET /api/contacts` batched query verified)
