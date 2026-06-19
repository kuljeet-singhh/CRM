# Google Cloud Setup (OAuth + Gmail Webhooks)

Step-by-step guide to create a **new Google Cloud project** for FlyCRM: OAuth credentials for Gmail login/sync and (optional) Pub/Sub for real-time webhook sync.

**Related docs:**
- [GOOGLE_WEBHOOK_GUIDE.md](./GOOGLE_WEBHOOK_GUIDE.md) — how webhook sync works after setup
- [VERCEL.md](./VERCEL.md) — where to set env vars on production
- [PROJECT_GUIDE.md](./PROJECT_GUIDE.md) — architecture overview

---

## What you need from Google

| Piece | Purpose | Required? |
|-------|---------|-----------|
| **OAuth 2.0 Client ID + Secret** | Gmail login, send, manual sync | Yes |
| **Pub/Sub topic + push subscription** | Real-time Gmail webhook sync | Optional (recommended for production) |

---

## Your URLs (production example)

Replace with your own if domains differ.

| Role | URL |
|------|-----|
| **Web app** (OAuth redirect) | `https://fly-crm-web.vercel.app` |
| **API** (Gmail webhook) | `https://crm-fly1.vercel.app` |

OAuth redirect URI (always on **web**, not API):

```
https://fly-crm-web.vercel.app/auth/google/callback
```

Gmail webhook URL (on **API**):

```
https://crm-fly1.vercel.app/api/webhooks/gmail
```

---

## Part 1 — Create the Google Cloud project

1. Sign in at [Google Cloud Console](https://console.cloud.google.com/).
2. Top bar → **Select a project** → **New Project**.
3. Name it (e.g. `FlyCRM`) → **Create**.
4. Select the new project when creation finishes.

---

## Part 2 — Enable Gmail API

1. Open [APIs & Services → Library](https://console.cloud.google.com/apis/library).
2. Search **Gmail API** → open → **Enable**.

---

## Part 3 — OAuth consent screen

1. Open [OAuth consent screen](https://console.cloud.google.com/apis/credentials/consent).
2. Choose user type:
   - **External** — any Gmail user (add test users while in Testing)
   - **Internal** — Google Workspace org only
3. Fill in app name (**FlyCRM**), support email, developer contact email.
4. **Scopes** → **Add or remove scopes** → add:
   - `openid`
   - `.../auth/userinfo.email`
   - `.../auth/userinfo.profile`
   - `https://www.googleapis.com/auth/gmail.send`
   - `https://www.googleapis.com/auth/gmail.modify`
5. **Save and continue**.
6. If **External** and status is **Testing**: add your Gmail address under **Test users**.
7. Finish the wizard.

> While the app is in **Testing**, only listed test users can sign in. For public use with Gmail scopes, submit for **Verification** later in Google Cloud Console.

---

## Part 4 — Create OAuth 2.0 credentials

1. Open [Credentials](https://console.cloud.google.com/apis/credentials).
2. **+ Create credentials** → **OAuth client ID**.
3. Application type: **Web application**.
4. Name: e.g. `FlyCRM Web`.

### Authorized JavaScript origins

```
http://localhost:5173
https://fly-crm-web.vercel.app
```

### Authorized redirect URIs

```
http://localhost:5173/auth/google/callback
https://fly-crm-web.vercel.app/auth/google/callback
```

5. **Create**.
6. Copy **Client ID** → `GOOGLE_CLIENT_ID`
7. Copy **Client secret** → `GOOGLE_CLIENT_SECRET`

---

## Part 5 — Environment variables

### Local (repo root `.env`)

```env
GOOGLE_CLIENT_ID=<Client ID from step 4>
GOOGLE_CLIENT_SECRET=<Client secret from step 4>
GOOGLE_REDIRECT_URI=http://localhost:5173/auth/google/callback
GOOGLE_SCOPES=openid,email,profile,https://www.googleapis.com/auth/gmail.send,https://www.googleapis.com/auth/gmail.modify
```

Restart the API after changing `.env`: `npm run dev:server` or `npm run dev:all`.

### Vercel API project

Set on the **API** project (Settings → Environment Variables → **Production**):

```env
GOOGLE_CLIENT_ID=<same Client ID>
GOOGLE_CLIENT_SECRET=<same Client secret>
GOOGLE_REDIRECT_URI=https://fly-crm-web.vercel.app/auth/google/callback
GOOGLE_SCOPES=openid,email,profile,https://www.googleapis.com/auth/gmail.send,https://www.googleapis.com/auth/gmail.modify
WEB_ORIGIN=https://fly-crm-web.vercel.app
```

**Redeploy the API** after saving env vars.

---

## Part 6 — Gmail real-time sync (Pub/Sub) — optional

Skip if you only need login + manual sync. Required for webhook / push sync.

### 6a. Enable Pub/Sub API

1. [APIs & Services → Library](https://console.cloud.google.com/apis/library) → search **Cloud Pub/Sub API** → **Enable**.

### 6b. Create a topic

1. [Pub/Sub → Topics](https://console.cloud.google.com/cloudpubsub/topic/list) → **Create topic**.
2. Topic ID: e.g. `gmail-notifications` → **Create**.
3. Copy the full resource name from topic details:

```
projects/YOUR-PROJECT-ID/topics/gmail-notifications
```

Set as `GMAIL_PUBSUB_TOPIC` in `.env` and Vercel.

### 6c. Grant Gmail permission to publish

1. Open the topic → **Permissions** → **Add principal**.
2. Principal:

```
gmail-api-push@system.gserviceaccount.com
```

3. Role: **Pub/Sub Publisher** → **Save**.

Without this, `users.watch` may succeed but **no events** reach Pub/Sub.

### 6d. Create push subscription

1. [Pub/Sub → Subscriptions](https://console.cloud.google.com/cloudpubsub/subscription/list) → **Create subscription**.
2. Subscription ID: e.g. `gmail-push-to-flycrm`.
3. Select your topic.
4. Delivery type: **Push**.
5. Endpoint URL:

```
https://crm-fly1.vercel.app/api/webhooks/gmail
```

6. **Create**.

For **local dev**, use ngrok and update the subscription URL when the hostname changes. See [GOOGLE_WEBHOOK_GUIDE.md](./GOOGLE_WEBHOOK_GUIDE.md) and [google-webhook-tasks/pubsub-ngrok-setup.md](./google-webhook-tasks/pubsub-ngrok-setup.md).

### 6e. Webhook env vars

**Local `.env`:**

```env
GMAIL_PUBSUB_TOPIC=projects/YOUR-PROJECT-ID/topics/gmail-notifications
GOOGLE_WEBHOOK_AUDIENCE=https://crm-fly1.vercel.app/api/webhooks/gmail
```

**Vercel API (Production):**

```env
GMAIL_PUBSUB_TOPIC=projects/YOUR-PROJECT-ID/topics/gmail-notifications
GOOGLE_WEBHOOK_AUDIENCE=https://crm-fly1.vercel.app/api/webhooks/gmail
```

Redeploy API after changes.

---

## Part 7 — Verify

1. Open the **web** app: `https://fly-crm-web.vercel.app` (not the API URL in the browser for daily use).
2. Sign in or **Connect Gmail** and approve Google permissions.
3. In **Settings**, choose a Gmail sync label and save (creates `CrmLabel` + Gmail watch).
4. Health check:

```bash
curl https://crm-fly1.vercel.app/api/health/live
# → {"ok":true}
```

5. Optional webhook check: label a message in Gmail → see sync within ~5–15s (see [GOOGLE_WEBHOOK_GUIDE.md](./GOOGLE_WEBHOOK_GUIDE.md) §7).

---

## Replacing a deleted / old Google project

If you moved to a new Google Cloud project:

1. Complete Parts 1–5 (and 6 if using webhooks).
2. Update `.env` and **all** Vercel API env vars with the new Client ID/Secret and topic.
3. **Redeploy** the API on Vercel.
4. Existing users must **Connect Gmail again** — old encrypted tokens in the database are tied to the previous OAuth client.

---

## Common mistakes

| Problem | Fix |
|---------|-----|
| `redirect_uri_mismatch` | Redirect URI in Google Console must **exactly** match `GOOGLE_REDIRECT_URI` (scheme, host, path; no trailing slash) |
| OAuth redirect on API domain | Use **web** URL: `https://fly-crm-web.vercel.app/auth/google/callback` |
| Access blocked / app not verified | Add your Gmail as **Test user** on OAuth consent screen, or complete Google verification |
| Webhook never fires | Check `GMAIL_PUBSUB_TOPIC`, Pub/Sub Publisher IAM, push subscription URL, and save sync label in Settings |
| `startup_failed` on API | Missing env vars on Vercel — see [VERCEL.md](./VERCEL.md) |
| Users still broken after new project | Re-connect Gmail; old tokens are invalid |

---

## Checklist

- [ ] Google Cloud project created
- [ ] Gmail API enabled
- [ ] OAuth consent screen configured (+ test users if External/Testing)
- [ ] OAuth Web client: local + production origins and redirect URIs
- [ ] `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` in `.env` and Vercel API
- [ ] `GOOGLE_REDIRECT_URI` points to **web** callback URL
- [ ] `WEB_ORIGIN` set on Vercel API
- [ ] API redeployed on Vercel
- [ ] (Optional) Pub/Sub topic + `gmail-api-push@system.gserviceaccount.com` Publisher
- [ ] (Optional) Push subscription → `/api/webhooks/gmail`
- [ ] (Optional) `GMAIL_PUBSUB_TOPIC` + `GOOGLE_WEBHOOK_AUDIENCE` set
- [ ] Gmail connect tested on production web app

---

## Env var reference

| Variable | Example (production) |
|----------|----------------------|
| `GOOGLE_CLIENT_ID` | From OAuth client |
| `GOOGLE_CLIENT_SECRET` | From OAuth client |
| `GOOGLE_REDIRECT_URI` | `https://fly-crm-web.vercel.app/auth/google/callback` |
| `GOOGLE_SCOPES` | `openid,email,profile,https://www.googleapis.com/auth/gmail.send,https://www.googleapis.com/auth/gmail.modify` |
| `GMAIL_PUBSUB_TOPIC` | `projects/YOUR-PROJECT-ID/topics/gmail-notifications` |
| `GOOGLE_WEBHOOK_AUDIENCE` | `https://crm-fly1.vercel.app/api/webhooks/gmail` |
| `WEB_ORIGIN` | `https://fly-crm-web.vercel.app` |

See root [`.env.example`](../.env.example) for the full template.
