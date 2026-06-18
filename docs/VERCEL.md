# Vercel Deployment

FlyCRM deploys as **two Vercel projects** from the same Git repo.

| Project | Root directory | URL role |
|---------|----------------|----------|
| **Web** | `web/` | SPA; proxies `/api` and `/auth` to API |
| **API** | `server/` | Express serverless + cron jobs |

## 1. Deploy API first

1. [Vercel](https://vercel.com) → **Add New Project** → import repo.
2. **Root Directory:** `server`
3. **Framework Preset:** Other
4. **Build Command:** `npm run vercel-build` (or `npx prisma generate && npx prisma migrate deploy && npm run build`)
5. **Install Command:** `npm install --include=dev` (in `server/vercel.json`; needed when `NODE_ENV=production` so devDependencies like TypeScript install at build time)
6. **Environment variables:** copy all server vars from repo-root `.env`, plus:
   - `DATABASE_URL` — Supabase **transaction** pooler (port 6543); see [SUPABASE.md](./SUPABASE.md)
   - `DIRECT_URL` — Supabase **session** pooler (port 5432); optional if `DATABASE_URL` is Supabase — build derives it automatically
   - `NODE_ENV=production`
   - `CRON_SECRET` — long random string (Vercel Cron and GitHub Actions send `Authorization: Bearer <CRON_SECRET>`)
   - `WEB_ORIGIN=https://<your-web-project>.vercel.app` (set after web deploy, then redeploy API)
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — from Google Cloud Console
   - `GOOGLE_REDIRECT_URI=https://<web>/auth/google/callback`
   - `GOOGLE_SCOPES` — optional (defaults in code); override if needed:
     `openid,email,profile,https://www.googleapis.com/auth/gmail.send,https://www.googleapis.com/auth/gmail.modify`
   - `ENCRYPTION_KEY` — 32-byte base64 (token encryption at rest)
   - `SESSION_SECRET` — long random string
   - `MICROSOFT_REDIRECT_URI=https://<web>/auth/microsoft/callback`
   - `OUTLOOK_WEBHOOK_URL=https://<api-project>.vercel.app` (no trailing slash)
7. Deploy and note the API URL (e.g. `https://fly-crm-api.vercel.app`).

### Verify API

```bash
curl https://<api-project>.vercel.app/api/health/live
# → {"ok":true}
```

If you see **500 FUNCTION_INVOCATION_FAILED**:

1. Vercel → API project → **Deployments** → latest → **Functions** / **Runtime Logs** — look for `Missing required env: ...` or Prisma errors.
2. Confirm all required env vars are set for **Production** (not only Preview): `SESSION_SECRET`, `DATABASE_URL`, `GOOGLE_*`, `ENCRYPTION_KEY`, `WEB_ORIGIN`, OAuth redirect URIs.
3. Redeploy after env changes.

## 2. Deploy web

1. Second Vercel project → same repo, **Root Directory:** `web`
2. **Framework:** Vite
3. **Build:** `npm run build` · **Output:** `dist`
4. **No environment variables** — API URL is in `web/vercel.json`
5. Edit `web/vercel.json`: replace `YOUR_API_DOMAIN` with your API hostname (no `https://`):

```json
"destination": "https://fly-crm-api.vercel.app/api/:path*"
```

6. Deploy web → copy web URL → set `WEB_ORIGIN` on API project → **redeploy API**

## 3. External consoles

| Service | URL |
|---------|-----|
| Google OAuth redirect | `https://<web>/auth/google/callback` |
| Microsoft OAuth redirect | `https://<web>/auth/microsoft/callback` |
| Gmail Pub/Sub push | `https://<api>/api/webhooks/gmail` |
| Outlook webhook (`OUTLOOK_WEBHOOK_URL`) | `https://<api>` |

## 4. Smoke test

- [ ] Web loads without "API server is not running"
- [ ] Sign up / sign in; session survives refresh
- [ ] `GET https://<web>/api/health/live` → `{ "ok": true }` (via proxy)
- [ ] Gmail/Outlook OAuth connect
- [ ] `/contacts` loads (no P2024)
- [ ] Vercel → API project → Cron tab shows successful daily runs
- [ ] GitHub → Actions → external cron workflows succeed (see [Hobby plan](#5-hobby-plan-option-b))
- [ ] Supabase shows new user rows

## Local vs Vercel

| Feature | Local (`npm run dev`) | Vercel (Hobby + GitHub Actions) | Vercel Pro |
|---------|----------------------|--------------------------------|------------|
| Sync worker | Poll every 2s (`setInterval`) | GitHub Actions every 5 min | Vercel cron every 1 min |
| Gmail/Outlook renewal | `setInterval` 6h | GitHub Actions every 6h | Vercel cron every 6h |
| Daily sync | `setInterval` 24h | Vercel cron midnight UTC | Vercel cron midnight UTC |

## Cron routes (API only)

All require `Authorization: Bearer <CRON_SECRET>`.

### Vercel-managed (`server/vercel.json`)

Hobby allows at most one run per day per cron. Only daily jobs stay in Vercel:

| Path | Schedule |
|------|----------|
| `/api/cron/gmail-daily-sync` | `0 0 * * *` (midnight UTC) |
| `/api/cron/outlook-daily-sync` | `0 0 * * *` (midnight UTC) |

### GitHub Actions (Hobby workaround)

Frequent jobs are triggered by [`.github/workflows/cron-sync-worker.yml`](../.github/workflows/cron-sync-worker.yml) and [`.github/workflows/cron-watch-renew.yml`](../.github/workflows/cron-watch-renew.yml):

| Path | Schedule | Workflow |
|------|----------|----------|
| `/api/cron/sync-worker` | `*/5 * * * *` (every 5 min) | `cron-sync-worker.yml` |
| `/api/cron/gmail-watch-renew` | `0 */6 * * *` (every 6h) | `cron-watch-renew.yml` |
| `/api/cron/outlook-renew` | `0 */6 * * *` (every 6h) | `cron-watch-renew.yml` |

On **Vercel Pro**, you can move all five crons back into `server/vercel.json` and disable the GitHub workflows.

## 5. Hobby plan (Option B)

Vercel Hobby blocks deploy when `server/vercel.json` includes crons that run more than once per day (e.g. `* * * * *` or `0 */6 * * *`). This repo keeps only the two daily crons in Vercel and uses **GitHub Actions** for sync-worker and watch renewal.

### GitHub repo secrets

After the API is deployed, add these under **Settings → Secrets and variables → Actions**:

| Secret | Value |
|--------|-------|
| `API_BASE_URL` | Full API base URL, e.g. `https://fly-crm-api.vercel.app` (no trailing slash) |
| `CRON_SECRET` | Same value as `CRON_SECRET` on the Vercel API project |

### Verify external cron

1. Push to `main` (workflows only run on `main` for scheduled triggers).
2. **Actions** → run **External cron — sync worker** and **External cron — watch renew** via **Run workflow**.
3. Confirm green runs and `curl` exit code 0 in logs.

Manual smoke test:

```bash
curl -fsS -X POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  "https://<api-project>.vercel.app/api/cron/sync-worker"
# → {"ok":true}
```

### Trade-offs on Hobby

- Sync worker runs every **5 minutes** (GitHub minimum), not every 1 minute — Gmail webhook queue may lag slightly vs Pro.
- Daily sync still runs on Vercel at midnight UTC.
- Login, contacts, and manual sync from the UI are unchanged.

### Alternative: cron-job.org

If you cannot use GitHub Actions, register the three URLs above at [cron-job.org](https://cron-job.org) (or similar) with the same `Authorization: Bearer <CRON_SECRET>` header and matching schedules. No repo changes needed beyond the trimmed `vercel.json`.
