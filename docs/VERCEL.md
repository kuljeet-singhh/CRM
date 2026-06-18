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
5. **Install Command:** `npm install`
6. **Environment variables:** copy all server vars from repo-root `.env`, plus:
   - `NODE_ENV=production`
   - `CRON_SECRET` — long random string (Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`)
   - `WEB_ORIGIN=https://<your-web-project>.vercel.app` (set after web deploy, then redeploy API)
   - `GOOGLE_REDIRECT_URI=https://<web>/auth/google/callback`
   - `MICROSOFT_REDIRECT_URI=https://<web>/auth/microsoft/callback`
   - `OUTLOOK_WEBHOOK_URL=https://<api-project>.vercel.app` (no trailing slash)
7. Deploy and note the API URL (e.g. `https://fly-crm-api.vercel.app`).

### Verify API

```bash
curl https://<api-project>.vercel.app/api/health/live
# → {"ok":true}
```

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
- [ ] Vercel → API project → Cron tab shows successful runs
- [ ] Supabase shows new user rows

## Local vs Vercel

| Feature | Local (`npm run dev`) | Vercel |
|---------|----------------------|--------|
| Sync worker | Poll every 2s (`setInterval`) | Cron every 1 min |
| Gmail/Outlook renewal | `setInterval` 6h | Cron every 6h |
| Daily sync | `setInterval` 24h | Cron midnight UTC |

## Cron routes (API only)

All require `Authorization: Bearer <CRON_SECRET>`:

| Path | Schedule |
|------|----------|
| `/api/cron/sync-worker` | `* * * * *` |
| `/api/cron/gmail-watch-renew` | `0 */6 * * *` |
| `/api/cron/gmail-daily-sync` | `0 0 * * *` |
| `/api/cron/outlook-renew` | `0 */6 * * *` |
| `/api/cron/outlook-daily-sync` | `0 0 * * *` |

Cron jobs require a Vercel plan that supports the configured schedules (1-minute cron may need Pro).
